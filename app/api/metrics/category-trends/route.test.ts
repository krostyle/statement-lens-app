import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/src/infrastructure/database/prisma.client', () => ({
  prisma: { transaction: { findMany: vi.fn() } },
}));

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/src/infrastructure/database/prisma.client';
import { GET } from './route';

const mockAuth = vi.mocked(auth);

function makeTx(overrides: Record<string, unknown> = {}) {
  return {
    date: new Date('2024-03-10'),
    amount: -10000,
    category: { name: 'Alimentación' },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/metrics/category-trends', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const res = await GET();

    expect(res.status).toBe(401);
  });

  it('aggregates spend by category and month', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      makeTx({ date: new Date('2024-03-10'), amount: -10000, category: { name: 'Alimentación' } }),
      makeTx({ date: new Date('2024-04-10'), amount: -5000, category: { name: 'Alimentación' } }),
    ] as never);

    const res = await GET();
    const json = await res.json();

    expect(json.months).toEqual(['2024-03', '2024-04']);
    expect(json.series).toEqual([{ name: 'Alimentación', data: [10000, 5000] }]);
  });

  it('limits the series to the top 5 categories by total spend', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    const txs = Array.from({ length: 6 }, (_, i) =>
      makeTx({ category: { name: `Cat${i}` }, amount: -(1000 * (i + 1)) })
    );
    vi.mocked(prisma.transaction.findMany).mockResolvedValue(txs as never);

    const res = await GET();
    const json = await res.json();

    expect(json.series).toHaveLength(5);
    // Highest spend (Cat5) must be included; lowest (Cat0) must be dropped.
    expect(json.series.map((s: { name: string }) => s.name)).toContain('Cat5');
    expect(json.series.map((s: { name: string }) => s.name)).not.toContain('Cat0');
  });
});
