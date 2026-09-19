import { describe, it, expect, vi, beforeEach } from 'vitest';
import { urlRequest } from '@/src/test/helpers/api-request';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/src/infrastructure/container', () => ({
  listBudgetsUseCase: { execute: vi.fn() },
}));

import { auth } from '@clerk/nextjs/server';
import { listBudgetsUseCase } from '@/src/infrastructure/container';
import { GET } from './route';

const mockAuth = vi.mocked(auth);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/budgets', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const res = await GET(urlRequest('http://localhost/api/budgets'));

    expect(res.status).toBe(401);
  });

  it('uses the given month when provided', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(listBudgetsUseCase.execute).mockResolvedValue([{ id: 'b-1' }] as never);

    const res = await GET(urlRequest('http://localhost/api/budgets', { month: '2024-03' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual([{ id: 'b-1' }]);
    expect(listBudgetsUseCase.execute).toHaveBeenCalledWith('user-1', '2024-03');
  });

  it('defaults to the current month when none is given', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(listBudgetsUseCase.execute).mockResolvedValue([]);

    await GET(urlRequest('http://localhost/api/budgets'));

    const currentMonth = new Date().toISOString().slice(0, 7);
    expect(listBudgetsUseCase.execute).toHaveBeenCalledWith('user-1', currentMonth);
  });
});
