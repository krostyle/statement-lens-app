import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jsonRequest, urlRequest, routeParams } from '@/src/test/helpers/api-request';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/src/infrastructure/container', () => ({
  upsertBudgetUseCase: { execute: vi.fn() },
  budgetRepo: { delete: vi.fn() },
}));

import { auth } from '@clerk/nextjs/server';
import { upsertBudgetUseCase, budgetRepo } from '@/src/infrastructure/container';
import { PATCH, DELETE } from './route';

const mockAuth = vi.mocked(auth);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PATCH /api/budgets/[categoryId]', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const res = await PATCH(jsonRequest('http://localhost', 'PATCH', {}), routeParams({ categoryId: 'cat-1' }));

    expect(res.status).toBe(401);
  });

  it('returns 400 when the body fails validation', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);

    const res = await PATCH(
      jsonRequest('http://localhost', 'PATCH', { monthlyAmount: -100, month: '2024-03' }),
      routeParams({ categoryId: 'cat-1' })
    );

    expect(res.status).toBe(400);
  });

  it('upserts the budget and returns it', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(upsertBudgetUseCase.execute).mockResolvedValue({ id: 'b-1', monthlyAmount: 100000 } as never);

    const res = await PATCH(
      jsonRequest('http://localhost', 'PATCH', { monthlyAmount: 100000, month: '2024-03' }),
      routeParams({ categoryId: 'cat-1' })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ id: 'b-1', monthlyAmount: 100000 });
    expect(upsertBudgetUseCase.execute).toHaveBeenCalledWith('user-1', 'cat-1', 100000, '2024-03');
  });

  it('returns 400 when the use-case throws', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(upsertBudgetUseCase.execute).mockRejectedValue(new Error('Category not found'));

    const res = await PATCH(
      jsonRequest('http://localhost', 'PATCH', { monthlyAmount: 100000, month: '2024-03' }),
      routeParams({ categoryId: 'cat-1' })
    );

    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/budgets/[categoryId]', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const res = await DELETE(urlRequest('http://localhost'), routeParams({ categoryId: 'cat-1' }));

    expect(res.status).toBe(401);
  });

  it('deletes the budget for the given (or current) month', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(budgetRepo.delete).mockResolvedValue(undefined);

    const res = await DELETE(urlRequest('http://localhost', { month: '2024-03' }), routeParams({ categoryId: 'cat-1' }));

    expect(res.status).toBe(204);
    expect(budgetRepo.delete).toHaveBeenCalledWith('user-1', 'cat-1', '2024-03');
  });

  it('returns 404 when the repo throws', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(budgetRepo.delete).mockRejectedValue(new Error('not found'));

    const res = await DELETE(urlRequest('http://localhost', { month: '2024-03' }), routeParams({ categoryId: 'cat-1' }));

    expect(res.status).toBe(404);
  });
});
