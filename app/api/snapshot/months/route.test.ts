import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/src/infrastructure/container', () => ({
  transactionRepo: { findTrackingMonths: vi.fn() },
}));

import { auth } from '@clerk/nextjs/server';
import { transactionRepo } from '@/src/infrastructure/container';
import { GET } from './route';

const mockAuth = vi.mocked(auth);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/snapshot/months', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const res = await GET();

    expect(res.status).toBe(401);
  });

  it('returns the tracking months for the user', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(transactionRepo.findTrackingMonths).mockResolvedValue(['2024-03', '2024-02']);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ months: ['2024-03', '2024-02'] });
    expect(transactionRepo.findTrackingMonths).toHaveBeenCalledWith('user-1');
  });
});
