import { describe, it, expect, vi, beforeEach } from 'vitest';
import { urlRequest } from '@/src/test/helpers/api-request';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/src/infrastructure/database/prisma.client', () => ({
  prisma: { transaction: { findMany: vi.fn() } },
}));

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/src/infrastructure/database/prisma.client';
import { GET } from './route';

const mockAuth = vi.mocked(auth);

function makeInstallmentTx(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tx-1',
    merchant: 'Falabella',
    description: 'Compra en cuotas',
    bank: 'falabella',
    amount: -13715,
    currency: 'CLP',
    date: new Date('2024-06-01'),
    installmentNum: 2,
    installmentTotal: 6,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/installments', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const res = await GET(urlRequest('http://localhost/api/installments'));

    expect(res.status).toBe(401);
  });

  it('excludes fully-paid installment plans', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      makeInstallmentTx({ installmentNum: 6, installmentTotal: 6 }),
    ] as never);

    const res = await GET(urlRequest('http://localhost/api/installments'));
    const json = await res.json();

    expect(json.installments).toEqual([]);
    expect(json.totalMonthly).toBe(0);
  });

  it('deduplicates plans by bank + total + rounded amount, keeping the most recent', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    // Repo already sorts desc by date; the mock returns them pre-sorted like Prisma would.
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      makeInstallmentTx({ id: 'tx-recent', installmentNum: 3, date: new Date('2024-08-01') }),
      makeInstallmentTx({ id: 'tx-old', installmentNum: 2, date: new Date('2024-07-01') }),
    ] as never);

    const res = await GET(urlRequest('http://localhost/api/installments'));
    const json = await res.json();

    expect(json.installments).toHaveLength(1);
    expect(json.installments[0].id).toBe('tx-recent');
    expect(json.installments[0].installmentNum).toBe(3);
  });

  it('computes remaining balance and totals', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      makeInstallmentTx({ amount: -10000, installmentNum: 2, installmentTotal: 5 }),
    ] as never);

    const res = await GET(urlRequest('http://localhost/api/installments'));
    const json = await res.json();

    expect(json.installments[0].remaining).toBe(3 * 10000);
    expect(json.totalMonthly).toBe(10000);
    expect(json.totalDebt).toBe(30000);
  });
});
