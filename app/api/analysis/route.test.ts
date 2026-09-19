import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jsonRequest } from '@/src/test/helpers/api-request';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/src/infrastructure/container', () => ({
  analyzeFinancesUseCase: { execute: vi.fn() },
}));

import { auth } from '@clerk/nextjs/server';
import { analyzeFinancesUseCase } from '@/src/infrastructure/container';
import { POST } from './route';

const mockAuth = vi.mocked(auth);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/analysis', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const res = await POST(jsonRequest('http://localhost', 'POST', {}));

    expect(res.status).toBe(401);
  });

  it('passes the requested month through to the use-case', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(analyzeFinancesUseCase.execute).mockResolvedValue({ summary: 'ok' } as never);

    const res = await POST(jsonRequest('http://localhost', 'POST', { month: '2024-03' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ summary: 'ok' });
    expect(analyzeFinancesUseCase.execute).toHaveBeenCalledWith('user-1', { month: '2024-03' });
  });

  it('tolerates a missing/invalid JSON body', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(analyzeFinancesUseCase.execute).mockResolvedValue({ summary: 'ok' } as never);

    const res = await POST(new Request('http://localhost', { method: 'POST' }));

    expect(res.status).toBe(200);
    expect(analyzeFinancesUseCase.execute).toHaveBeenCalledWith('user-1', { month: undefined });
  });

  it('returns 500 when the use-case throws', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(analyzeFinancesUseCase.execute).mockRejectedValue(new Error('AI unavailable'));

    const res = await POST(jsonRequest('http://localhost', 'POST', {}));

    expect(res.status).toBe(500);
  });
});
