import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/src/infrastructure/database/prisma.client', () => ({
  prisma: { transaction: { findMany: vi.fn() } },
}));

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/src/infrastructure/database/prisma.client';
import { GET } from './route';

const mockAuth = vi.mocked(auth);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/reports/months', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const res = await GET();

    expect(res.status).toBe(401);
  });

  it('returns distinct months sorted descending, preferring accountingMonth', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      { date: new Date('2024-01-15'), accountingMonth: '2024-03' },
      { date: new Date('2024-02-15'), accountingMonth: '' },
      { date: new Date('2024-02-15'), accountingMonth: '' },
    ] as never);

    const res = await GET();
    const json = await res.json();

    expect(json.months).toEqual(['2024-03', '2024-02']);
  });
});
