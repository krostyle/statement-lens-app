import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jsonRequest } from '@/src/test/helpers/api-request';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/src/infrastructure/container', () => ({
  upsertBudgetUseCase: { execute: vi.fn() },
}));

import { auth } from '@clerk/nextjs/server';
import { upsertBudgetUseCase } from '@/src/infrastructure/container';
import { POST } from './route';

const mockAuth = vi.mocked(auth);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/budgets/batch', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const res = await POST(jsonRequest('http://localhost', 'POST', { month: '2024-03', budgets: [] }));

    expect(res.status).toBe(401);
  });

  it('returns 400 when the body fails validation', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);

    const res = await POST(jsonRequest('http://localhost', 'POST', { month: '2024-03', budgets: [] }));

    expect(res.status).toBe(400);
    expect(upsertBudgetUseCase.execute).not.toHaveBeenCalled();
  });

  it('upserts every budget in the batch for the given month', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(upsertBudgetUseCase.execute)
      .mockResolvedValueOnce({ id: 'b-1' } as never)
      .mockResolvedValueOnce({ id: 'b-2' } as never);

    const res = await POST(
      jsonRequest('http://localhost', 'POST', {
        month: '2024-03',
        budgets: [
          { categoryId: 'cat-1', monthlyAmount: 100000 },
          { categoryId: 'cat-2', monthlyAmount: 50000 },
        ],
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual([{ id: 'b-1' }, { id: 'b-2' }]);
    expect(upsertBudgetUseCase.execute).toHaveBeenCalledWith('user-1', 'cat-1', 100000, '2024-03');
    expect(upsertBudgetUseCase.execute).toHaveBeenCalledWith('user-1', 'cat-2', 50000, '2024-03');
  });
});
