import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/src/infrastructure/container', () => ({
  transactionRepo: { confirmAllPending: vi.fn() },
}));

import { auth } from '@clerk/nextjs/server';
import { transactionRepo } from '@/src/infrastructure/container';
import { PATCH } from './route';

const mockAuth = vi.mocked(auth);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PATCH /api/transactions/confirm-all', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const res = await PATCH();

    expect(res.status).toBe(401);
  });

  it('confirms all pending transactions for the user', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(transactionRepo.confirmAllPending).mockResolvedValue(4);

    const res = await PATCH();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ confirmed: 4 });
    expect(transactionRepo.confirmAllPending).toHaveBeenCalledWith('user-1');
  });

  it('returns 500 when the repo throws', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(transactionRepo.confirmAllPending).mockRejectedValue(new Error('db down'));

    const res = await PATCH();

    expect(res.status).toBe(500);
  });
});
