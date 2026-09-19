import { describe, it, expect, vi, beforeEach } from 'vitest';
import { urlRequest } from '@/src/test/helpers/api-request';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/src/infrastructure/container', () => ({
  transactionRepo: { findTrackingByMonth: vi.fn() },
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
    vi.mocked(transactionRepo.findTrackingByMonth).mockResolvedValue([
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
    ] as never);
    vi.mocked(categoryRepo.findByUserId).mockResolvedValue([
      { id: 'cat-1', userId: 'user-1', name: 'Alimentación', color: '#f97316', icon: null, isDefault: true, createdAt: new Date(), updatedAt: new Date() },
    ]);

    const res = await GET(urlRequest('http://localhost/api/snapshot/report', { month: '2024-03' }));
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/html');
    expect(html).toContain('Marzo 2024');
    expect(html).toContain('Alimentación');
  });
});
