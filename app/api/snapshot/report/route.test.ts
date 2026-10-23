import { describe, it, expect, vi, beforeEach } from 'vitest';
import { urlRequest } from '@/src/test/helpers/api-request';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/src/infrastructure/container', () => ({
  getReportDataUseCase: { execute: vi.fn() },
}));

import { auth } from '@clerk/nextjs/server';
import { getReportDataUseCase } from '@/src/infrastructure/container';
import { GET } from './route';

const mockAuth = vi.mocked(auth);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/snapshot/report', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const res = await GET(urlRequest('http://localhost/api/snapshot/report', { month: '2024-03' }));

    expect(res.status).toBe(401);
    expect(getReportDataUseCase.execute).not.toHaveBeenCalled();
  });

  it('returns 400 when month is missing or invalid', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);

    const missing = await GET(urlRequest('http://localhost/api/snapshot/report'));
    const invalid = await GET(urlRequest('http://localhost/api/snapshot/report', { month: '03-2024' }));

    expect(missing.status).toBe(400);
    expect(invalid.status).toBe(400);
  });

  it('returns 404 when there is no tracking data for the month', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(getReportDataUseCase.execute).mockResolvedValue(null);

    const res = await GET(urlRequest('http://localhost/api/snapshot/report', { month: '2024-03' }));

    expect(res.status).toBe(404);
  });

  it('returns the report data as JSON for the authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    const payload = {
      month: '2024-03',
      months: ['2024-03'],
      transactionsByMonth: { '2024-03': [] },
      categories: [],
      budgets: [],
    };
    vi.mocked(getReportDataUseCase.execute).mockResolvedValue(payload);

    const res = await GET(urlRequest('http://localhost/api/snapshot/report', { month: '2024-03' }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(payload);
    expect(getReportDataUseCase.execute).toHaveBeenCalledWith('user-1', '2024-03');
  });
});
