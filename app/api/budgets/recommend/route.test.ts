import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/src/infrastructure/container', () => ({
  recommendBudgetsUseCase: { execute: vi.fn() },
}));

import { auth } from '@clerk/nextjs/server';
import { recommendBudgetsUseCase } from '@/src/infrastructure/container';
import { POST } from './route';

const mockAuth = vi.mocked(auth);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/budgets/recommend', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const res = await POST();

    expect(res.status).toBe(401);
  });

  it('returns the recommendations for the authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(recommendBudgetsUseCase.execute).mockResolvedValue([{ categoryId: 'cat-1' }] as never);

    const res = await POST();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual([{ categoryId: 'cat-1' }]);
    expect(recommendBudgetsUseCase.execute).toHaveBeenCalledWith('user-1');
  });
});
