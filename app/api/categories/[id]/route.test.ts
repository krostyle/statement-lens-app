import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jsonRequest, routeParams } from '@/src/test/helpers/api-request';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/src/infrastructure/container', () => ({
  updateCategoryUseCase: { execute: vi.fn() },
  deleteCategoryUseCase: { execute: vi.fn() },
}));

import { auth } from '@clerk/nextjs/server';
import { updateCategoryUseCase, deleteCategoryUseCase } from '@/src/infrastructure/container';
import { PATCH, DELETE } from './route';

const mockAuth = vi.mocked(auth);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PATCH /api/categories/[id]', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const res = await PATCH(jsonRequest('http://localhost', 'PATCH', {}), routeParams({ id: 'cat-1' }));

    expect(res.status).toBe(401);
  });

  it('returns 400 when the body fails validation', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);

    const res = await PATCH(
      jsonRequest('http://localhost', 'PATCH', { color: 'not-a-hex' }),
      routeParams({ id: 'cat-1' })
    );

    expect(res.status).toBe(400);
    expect(updateCategoryUseCase.execute).not.toHaveBeenCalled();
  });

  it('updates the category and returns it', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(updateCategoryUseCase.execute).mockResolvedValue({ id: 'cat-1', name: 'Nuevo' } as never);

    const res = await PATCH(jsonRequest('http://localhost', 'PATCH', { name: 'Nuevo' }), routeParams({ id: 'cat-1' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ id: 'cat-1', name: 'Nuevo' });
    expect(updateCategoryUseCase.execute).toHaveBeenCalledWith('cat-1', 'user-1', expect.objectContaining({ name: 'Nuevo' }));
  });

  it('maps "Forbidden" to 403', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(updateCategoryUseCase.execute).mockRejectedValue(new Error('Forbidden'));

    const res = await PATCH(jsonRequest('http://localhost', 'PATCH', { name: 'X' }), routeParams({ id: 'cat-1' }));

    expect(res.status).toBe(403);
  });

  it('maps "Category not found" to 404', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(updateCategoryUseCase.execute).mockRejectedValue(new Error('Category not found'));

    const res = await PATCH(jsonRequest('http://localhost', 'PATCH', { name: 'X' }), routeParams({ id: 'cat-1' }));

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/categories/[id]', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const res = await DELETE(jsonRequest('http://localhost', 'DELETE'), routeParams({ id: 'cat-1' }));

    expect(res.status).toBe(401);
  });

  it('deletes the category and returns 204', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(deleteCategoryUseCase.execute).mockResolvedValue(undefined);

    const res = await DELETE(jsonRequest('http://localhost', 'DELETE'), routeParams({ id: 'cat-1' }));

    expect(res.status).toBe(204);
    expect(deleteCategoryUseCase.execute).toHaveBeenCalledWith('cat-1', 'user-1');
  });

  it('maps "Forbidden" to 403', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(deleteCategoryUseCase.execute).mockRejectedValue(new Error('Forbidden'));

    const res = await DELETE(jsonRequest('http://localhost', 'DELETE'), routeParams({ id: 'cat-1' }));

    expect(res.status).toBe(403);
  });
});
