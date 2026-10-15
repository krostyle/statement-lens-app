import { describe, it, expect, vi, beforeEach } from 'vitest';
import { urlRequest } from '@/src/test/helpers/api-request';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/src/infrastructure/container', () => ({
  transactionRepo: { findTrackingByMonth: vi.fn(), findByUserId: vi.fn() },
  categoryRepo: { findByUserId: vi.fn() },
  budgetRepo: { findByUserId: vi.fn() },
}));

import { auth } from '@clerk/nextjs/server';
import { transactionRepo, categoryRepo, budgetRepo } from '@/src/infrastructure/container';
import { GET } from './route';

const mockAuth = vi.mocked(auth);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(categoryRepo.findByUserId).mockResolvedValue([]);
  vi.mocked(budgetRepo.findByUserId).mockResolvedValue([]);
  vi.mocked(transactionRepo.findByUserId).mockResolvedValue([]);
});

describe('GET /api/snapshot/report', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const res = await GET(urlRequest('http://localhost/api/snapshot/report'));

    expect(res.status).toBe(401);
  });

  it('returns 400 when month is missing or invalid', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);

    const res = await GET(urlRequest('http://localhost/api/snapshot/report', { month: '03-2024' }));

    expect(res.status).toBe(400);
  });

  it('returns 404 when there is no tracking data for the month', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(transactionRepo.findTrackingByMonth).mockResolvedValue([]);

    const res = await GET(urlRequest('http://localhost/api/snapshot/report', { month: '2024-03' }));

    expect(res.status).toBe(404);
  });

  it('renders an HTML report when tracking data exists', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(transactionRepo.findTrackingByMonth).mockImplementation(async (_userId, month) =>
      month === '2024-03'
        ? ([
            {
              id: 'tx-1',
              date: new Date('2024-03-05'),
              description: 'Supermercado',
              merchant: 'Lider',
              amount: -15000,
              transactionType: 'expense',
              categoryId: 'cat-1',
              accountType: 'credit_card',
              bank: 'santander',
            },
          ] as never)
        : []
    );
    vi.mocked(categoryRepo.findByUserId).mockResolvedValue([
      { id: 'cat-1', userId: 'user-1', name: 'Alimentación', color: '#f97316', icon: null, isDefault: true, excludeFromBudget: false, isFixed: false, createdAt: new Date(), updatedAt: new Date() },
    ]);

    const res = await GET(urlRequest('http://localhost/api/snapshot/report', { month: '2024-03' }));
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/html');
    expect(html).toContain('Marzo 2024');
    expect(html).toContain('Alimentación');
  });

  it('shows a "Fijo" badge next to a category flagged isFixed', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(transactionRepo.findTrackingByMonth).mockImplementation(async (_userId, month) =>
      month === '2024-03'
        ? ([
            { id: 'tx-1', date: new Date('2024-03-05'), description: 'Arriendo depto', merchant: 'Inmobiliaria', amount: -450000, transactionType: 'expense', categoryId: 'cat-arriendo', accountType: 'checking', bank: 'santander' },
          ] as never)
        : []
    );
    vi.mocked(categoryRepo.findByUserId).mockResolvedValue([
      { id: 'cat-arriendo', userId: 'user-1', name: 'Arriendo', color: '#f97316', icon: null, isDefault: false, excludeFromBudget: false, isFixed: true, createdAt: new Date(), updatedAt: new Date() },
    ]);

    const res = await GET(urlRequest('http://localhost/api/snapshot/report', { month: '2024-03' }));
    const html = await res.text();

    expect(html).toContain('<span class="badge badge-amber">Fijo</span>');
  });

  it('excludes a category flagged excludeFromBudget from totalExpenses, but keeps it in the detail section', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(transactionRepo.findTrackingByMonth).mockImplementation(async (_userId, month) =>
      month === '2024-03'
        ? ([
            { id: 'tx-1', date: new Date('2024-03-05'), description: 'Super', merchant: 'Lider', amount: -30000, transactionType: 'expense', categoryId: 'cat-1', accountType: 'credit_card', bank: 'santander' },
            { id: 'tx-2', date: new Date('2024-03-06'), description: 'Falabella', merchant: 'Falabella', amount: -200000, transactionType: 'expense', categoryId: 'cat-amorcito', accountType: 'credit_card', bank: 'falabella' },
          ] as never)
        : []
    );
    vi.mocked(categoryRepo.findByUserId).mockResolvedValue([
      { id: 'cat-1', userId: 'user-1', name: 'Alimentación', color: '#f97316', icon: null, isDefault: true, excludeFromBudget: false, isFixed: false, createdAt: new Date(), updatedAt: new Date() },
      { id: 'cat-amorcito', userId: 'user-1', name: 'Mi Amorcito', color: '#000', icon: null, isDefault: false, excludeFromBudget: true, isFixed: false, createdAt: new Date(), updatedAt: new Date() },
    ]);

    const res = await GET(urlRequest('http://localhost/api/snapshot/report', { month: '2024-03' }));
    const html = await res.text();

    expect(html).toContain('Mi Amorcito');
    expect(html).toContain('$30.000'); // "Total gastado" headline excludes Mi Amorcito's 200.000
    expect(html).not.toContain('$230.000');
  });

  it('lists every transaction including returns, which the merchant table nets away', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(transactionRepo.findTrackingByMonth).mockImplementation(async (_userId, month) =>
      month === '2024-03'
        ? ([
            { id: 'tx-1', date: new Date('2024-03-05'), description: 'Falabella', merchant: 'Falabella', amount: -1435756, transactionType: 'expense', categoryId: 'cat-amorcito', accountType: 'credit_card', bank: 'falabella' },
            { id: 'tx-2', date: new Date('2024-03-10'), description: 'Falabella', merchant: 'Falabella', amount: 365896, transactionType: 'expense', categoryId: 'cat-amorcito', accountType: 'credit_card', bank: 'falabella' },
          ] as never)
        : []
    );
    vi.mocked(categoryRepo.findByUserId).mockResolvedValue([
      { id: 'cat-amorcito', userId: 'user-1', name: 'Mi Amorcito', color: '#000', icon: null, isDefault: false, excludeFromBudget: true, isFixed: false, createdAt: new Date(), updatedAt: new Date() },
    ]);

    const res = await GET(urlRequest('http://localhost/api/snapshot/report', { month: '2024-03' }));
    const html = await res.text();

    expect(html).toContain('devolución');
    expect(html).toContain('$365.896'); // the return shows as its own line
    expect(html).toContain('$1.069.860'); // the net total in "Por comercio"/category still reflects it
  });

  it('renders a comparison vs. the previous month when it had tracking data', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(transactionRepo.findTrackingByMonth).mockImplementation(async (_userId, month) => {
      if (month === '2024-03') {
        return [
          { id: 'tx-1', date: new Date('2024-03-05'), description: 'Super', merchant: 'Lider', amount: -20000, transactionType: 'expense', categoryId: 'cat-1', accountType: 'credit_card', bank: 'santander' },
        ] as never;
      }
      if (month === '2024-02') {
        return [
          { id: 'tx-0', date: new Date('2024-02-05'), description: 'Super', merchant: 'Lider', amount: -10000, transactionType: 'expense', categoryId: 'cat-1', accountType: 'credit_card', bank: 'santander' },
        ] as never;
      }
      return [];
    });
    vi.mocked(categoryRepo.findByUserId).mockResolvedValue([
      { id: 'cat-1', userId: 'user-1', name: 'Alimentación', color: '#f97316', icon: null, isDefault: true, excludeFromBudget: false, isFixed: false, createdAt: new Date(), updatedAt: new Date() },
    ]);

    const res = await GET(urlRequest('http://localhost/api/snapshot/report', { month: '2024-03' }));
    const html = await res.text();

    expect(html).toContain('Comparativa vs. Febrero 2024');
    expect(html).toContain('$10.000'); // previous month's total
    expect(html).toContain('+100.0%'); // doubled spend vs. previous month
  });

  it('renders a trend section when at least 2 months of tracking data exist', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(transactionRepo.findTrackingByMonth).mockImplementation(async (_userId, month) =>
      month === '2024-03'
        ? ([{ id: 'tx-1', date: new Date('2024-03-05'), description: 'Super', merchant: 'Lider', amount: -20000, transactionType: 'expense', categoryId: 'cat-1', accountType: 'credit_card', bank: 'santander' }] as never)
        : []
    );
    vi.mocked(transactionRepo.findByUserId).mockResolvedValue([
      { id: 'tx-1', userId: 'user-1', categoryId: 'cat-1', date: new Date('2024-03-05'), description: 'Super', merchant: 'Lider', amount: -20000, currency: 'CLP', bank: 'santander', accountType: 'credit_card', origin: 'tracking', accountingMonth: '2024-03', isInstallment: false, notes: null, reviewStatus: 'confirmed', transactionType: 'expense', createdAt: new Date(), updatedAt: new Date() },
      { id: 'tx-0', userId: 'user-1', categoryId: 'cat-1', date: new Date('2024-02-05'), description: 'Super', merchant: 'Lider', amount: -5000, currency: 'CLP', bank: 'santander', accountType: 'credit_card', origin: 'tracking', accountingMonth: '2024-02', isInstallment: false, notes: null, reviewStatus: 'confirmed', transactionType: 'expense', createdAt: new Date(), updatedAt: new Date() },
    ] as never);

    const res = await GET(urlRequest('http://localhost/api/snapshot/report', { month: '2024-03' }));
    const html = await res.text();

    expect(html).toContain('Tendencia de gastos');
    expect(transactionRepo.findByUserId).toHaveBeenCalledWith('user-1', expect.objectContaining({ origin: 'tracking' }));
  });
});
