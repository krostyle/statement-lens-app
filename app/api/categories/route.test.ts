import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jsonRequest } from '@/src/test/helpers/api-request';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/src/infrastructure/container', () => ({
  listCategoriesUseCase: { execute: vi.fn() },
  createCategoryUseCase: { execute: vi.fn() },
}));

import { auth } from '@clerk/nextjs/server';
import { listCategoriesUseCase, createCategoryUseCase } from '@/src/infrastructure/container';
import { GET, POST } from './route';

const mockAuth = vi.mocked(auth);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/categories', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const res = await GET();

    expect(res.status).toBe(401);
  });

  it('returns the categories for the authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(listCategoriesUseCase.execute).mockResolvedValue([{ id: 'cat-1' }] as never);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual([{ id: 'cat-1' }]);
    expect(listCategoriesUseCase.execute).toHaveBeenCalledWith('user-1');
  });
});

describe('POST /api/categories', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const res = await POST(jsonRequest('http://localhost/api/categories', 'POST', { name: 'Viajes' }));

    expect(res.status).toBe(401);
  });

  it('returns 400 when the body fails validation', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);

    const res = await POST(jsonRequest('http://localhost/api/categories', 'POST', { name: '' }));

    expect(res.status).toBe(400);
    expect(createCategoryUseCase.execute).not.toHaveBeenCalled();
  });

  it('creates the category and returns 201', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(createCategoryUseCase.execute).mockResolvedValue({ id: 'cat-1', name: 'Viajes' } as never);

    const res = await POST(jsonRequest('http://localhost/api/categories', 'POST', { name: 'Viajes' }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json).toEqual({ id: 'cat-1', name: 'Viajes' });
    expect(createCategoryUseCase.execute).toHaveBeenCalledWith('user-1', expect.objectContaining({ name: 'Viajes' }));
  });

  it('returns 400 when the use-case throws', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(createCategoryUseCase.execute).mockRejectedValue(new Error('Category with this name already exists'));

    const res = await POST(jsonRequest('http://localhost/api/categories', 'POST', { name: 'Viajes' }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Category with this name already exists');
  });
});
