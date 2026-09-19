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
      { id: 'cat-1', userId: 'user-1', name: 'Alimentación', color: '#f97316', icon: null, isDefault: true, createdAt: new Date(), updatedAt: new Date() },
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
});
