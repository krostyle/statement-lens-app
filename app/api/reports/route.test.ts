import { describe, it, expect, vi, beforeEach } from 'vitest';
import { urlRequest } from '@/src/test/helpers/api-request';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/src/infrastructure/container', () => ({
  transactionRepo: { findByUserId: vi.fn() },
  budgetRepo: { findByUserId: vi.fn() },
  categoryRepo: { findByUserId: vi.fn() },
}));

import { auth } from '@clerk/nextjs/server';
import { transactionRepo, budgetRepo, categoryRepo } from '@/src/infrastructure/container';
import { GET } from './route';

const mockAuth = vi.mocked(auth);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(transactionRepo.findByUserId).mockResolvedValue([]);
  vi.mocked(budgetRepo.findByUserId).mockResolvedValue([]);
  vi.mocked(categoryRepo.findByUserId).mockResolvedValue([]);
});

describe('GET /api/reports', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const res = await GET(urlRequest('http://localhost/api/reports'));

    expect(res.status).toBe(401);
  });

  it('returns 400 when month is missing', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);

    const res = await GET(urlRequest('http://localhost/api/reports'));

    expect(res.status).toBe(400);
  });

  it('returns 400 when month has an invalid format', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);

    const res = await GET(urlRequest('http://localhost/api/reports', { month: '03-2024' }));

    expect(res.status).toBe(400);
  });

  it('renders an HTML report for a valid month', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(categoryRepo.findByUserId).mockResolvedValue([
      { id: 'cat-1', userId: 'user-1', name: 'Alimentación', color: '#f97316', icon: null, isDefault: true, excludeFromBudget: false, createdAt: new Date(), updatedAt: new Date() },
    ]);
    vi.mocked(budgetRepo.findByUserId).mockImplementation(async (_userId, month) =>
      month === '2024-03' ? [{ id: 'b-1', userId: 'user-1', categoryId: 'cat-1', month: '2024-03', monthlyAmount: 100000, createdAt: new Date(), updatedAt: new Date() }] : []
    );

    const res = await GET(urlRequest('http://localhost/api/reports', { month: '2024-03' }));
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/html');
    expect(html).toContain('Marzo 2024');
    expect(html).toContain('Alimentación');
  });

  it('excludes a category flagged excludeFromBudget from the headline totals, but keeps it in the breakdown', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(categoryRepo.findByUserId).mockResolvedValue([
      { id: 'cat-1', userId: 'user-1', name: 'Alimentación', color: '#f97316', icon: null, isDefault: true, excludeFromBudget: false, createdAt: new Date(), updatedAt: new Date() },
      { id: 'cat-amorcito', userId: 'user-1', name: 'Mi Amorcito', color: '#000000', icon: null, isDefault: false, excludeFromBudget: true, createdAt: new Date(), updatedAt: new Date() },
    ]);
    vi.mocked(budgetRepo.findByUserId).mockImplementation(async (_userId, month) =>
      month === '2024-03'
        ? [
            { id: 'b-1', userId: 'user-1', categoryId: 'cat-1', month: '2024-03', monthlyAmount: 100000, createdAt: new Date(), updatedAt: new Date() },
            { id: 'b-2', userId: 'user-1', categoryId: 'cat-amorcito', month: '2024-03', monthlyAmount: 500000, createdAt: new Date(), updatedAt: new Date() },
          ]
        : []
    );
    vi.mocked(transactionRepo.findByUserId).mockResolvedValue([
      { id: 'tx-1', userId: 'user-1', categoryId: 'cat-1', date: new Date('2024-03-05'), description: 'Super', merchant: 'Lider', amount: -30000, currency: 'CLP', bank: '', accountType: '', isInstallment: false, notes: null, reviewStatus: 'confirmed', transactionType: 'expense', origin: 'manual', accountingMonth: '2024-03', createdAt: new Date(), updatedAt: new Date() },
      { id: 'tx-2', userId: 'user-1', categoryId: 'cat-amorcito', date: new Date('2024-03-06'), description: 'Falabella', merchant: 'Falabella', amount: -200000, currency: 'CLP', bank: '', accountType: '', isInstallment: false, notes: null, reviewStatus: 'confirmed', transactionType: 'expense', origin: 'manual', accountingMonth: '2024-03', createdAt: new Date(), updatedAt: new Date() },
    ] as never);

    const res = await GET(urlRequest('http://localhost/api/reports', { month: '2024-03' }));
    const html = await res.text();

    expect(html).toContain('Mi Amorcito'); // still in the per-category breakdown
    expect(html).toContain('$30.000'); // "Total gastado" headline excludes Mi Amorcito's 200.000
    expect(html).not.toContain('$230.000');
  });
});
