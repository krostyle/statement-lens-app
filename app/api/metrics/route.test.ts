import { describe, it, expect, vi, beforeEach } from 'vitest';
import { urlRequest } from '@/src/test/helpers/api-request';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/src/infrastructure/container', () => ({
  transactionRepo: { findByUserId: vi.fn() },
}));

import { auth } from '@clerk/nextjs/server';
import { transactionRepo } from '@/src/infrastructure/container';
import { GET } from './route';
import type { Transaction } from '@/src/domain/entities/transaction';

const mockAuth = vi.mocked(auth);

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: `tx-${Math.random()}`,
    userId: 'user-1',
    categoryId: 'cat-1',
    date: new Date('2024-03-15'),
    description: 'Gasto',
    merchant: 'Lider',
    amount: -10000,
    currency: 'CLP',
    bank: '',
    accountType: '',
    isInstallment: false,
    notes: null,
    reviewStatus: 'confirmed',
    transactionType: 'expense',
    origin: 'manual',
    accountingMonth: '2024-03',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/metrics', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const res = await GET(urlRequest('http://localhost/api/metrics'));

    expect(res.status).toBe(401);
  });

  it('scopes to the given month and sets filterMode "month"', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(transactionRepo.findByUserId).mockResolvedValue([
      makeTransaction({ accountingMonth: '2024-03', amount: -20000 }),
      makeTransaction({ accountingMonth: '2024-02', amount: -5000 }),
    ]);

    const res = await GET(urlRequest('http://localhost/api/metrics', { month: '2024-03' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.filterMode).toBe('month');
    expect(json.currentMonthTotal).toBe(20000);
    expect(json.previousMonthTotal).toBe(5000);
  });

  it('defaults to the current month when no month param is given', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(transactionRepo.findByUserId).mockResolvedValue([]);

    const res = await GET(urlRequest('http://localhost/api/metrics'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.filterMode).toBe('default');
  });
});
