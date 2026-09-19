import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jsonRequest } from '@/src/test/helpers/api-request';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/src/infrastructure/container', () => ({
  bulkUpdateTransactionsUseCase: { execute: vi.fn() },
  transactionRepo: { deleteManyByIds: vi.fn() },
}));

import { auth } from '@clerk/nextjs/server';
import { bulkUpdateTransactionsUseCase, transactionRepo } from '@/src/infrastructure/container';
import { PATCH, DELETE } from './route';

const mockAuth = vi.mocked(auth);
const uuid1 = '11111111-1111-4111-8111-111111111111';
const uuid2 = '22222222-2222-4222-8222-222222222222';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DELETE /api/transactions/bulk', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const res = await DELETE(jsonRequest('http://localhost', 'DELETE', { ids: [uuid1] }));

    expect(res.status).toBe(401);
  });

  it('returns 400 when ids is empty', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);

    const res = await DELETE(jsonRequest('http://localhost', 'DELETE', { ids: [] }));

    expect(res.status).toBe(400);
    expect(transactionRepo.deleteManyByIds).not.toHaveBeenCalled();
  });

  it('deletes the given ids scoped to the user', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(transactionRepo.deleteManyByIds).mockResolvedValue(2);

    const res = await DELETE(jsonRequest('http://localhost', 'DELETE', { ids: [uuid1, uuid2] }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ deleted: 2 });
    expect(transactionRepo.deleteManyByIds).toHaveBeenCalledWith([uuid1, uuid2], 'user-1');
  });
});

describe('PATCH /api/transactions/bulk', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const res = await PATCH(jsonRequest('http://localhost', 'PATCH', { ids: [uuid1], update: { reviewStatus: 'confirmed' } }));

    expect(res.status).toBe(401);
  });

  it('returns 400 when update has no fields set', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);

    const res = await PATCH(jsonRequest('http://localhost', 'PATCH', { ids: [uuid1], update: {} }));

    expect(res.status).toBe(400);
  });

  it('applies the bulk update and returns the count', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(bulkUpdateTransactionsUseCase.execute).mockResolvedValue(2);

    const res = await PATCH(
      jsonRequest('http://localhost', 'PATCH', { ids: [uuid1, uuid2], update: { reviewStatus: 'confirmed' } })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ updated: 2 });
  });

  it('returns 422 when the use-case throws', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(bulkUpdateTransactionsUseCase.execute).mockRejectedValue(new Error('Categoría no válida'));

    const res = await PATCH(
      jsonRequest('http://localhost', 'PATCH', { ids: [uuid1], update: { categoryId: uuid2 } })
    );

    expect(res.status).toBe(422);
  });
});
