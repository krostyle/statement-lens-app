import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jsonRequest, urlRequest } from '@/src/test/helpers/api-request';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/src/infrastructure/container', () => ({
  listTransactionsUseCase: { execute: vi.fn() },
  createTransactionUseCase: { execute: vi.fn() },
}));

import { auth } from '@clerk/nextjs/server';
import { listTransactionsUseCase, createTransactionUseCase } from '@/src/infrastructure/container';
import { GET, POST } from './route';

const mockAuth = vi.mocked(auth);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/transactions', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const res = await GET(urlRequest('http://localhost/api/transactions'));

    expect(res.status).toBe(401);
  });

  it('forwards filters and pagination to the use-case', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(listTransactionsUseCase.execute).mockResolvedValue({ data: [], total: 0 } as never);

    const res = await GET(urlRequest('http://localhost/api/transactions', { page: '2', categoryId: 'cat-1', isInstallment: 'true' }));

    expect(res.status).toBe(200);
    expect(listTransactionsUseCase.execute).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ categoryId: 'cat-1', isInstallment: true }),
      2,
      25
    );
  });

  it('defaults page to 1 when not provided', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(listTransactionsUseCase.execute).mockResolvedValue({ data: [], total: 0 } as never);

    await GET(urlRequest('http://localhost/api/transactions'));

    expect(listTransactionsUseCase.execute).toHaveBeenCalledWith('user-1', expect.anything(), 1, 25);
  });
});

describe('POST /api/transactions', () => {
  const validBody = {
    categoryId: '11111111-1111-4111-8111-111111111111',
    date: '2024-03-15T00:00:00.000Z',
    description: 'Supermercado',
    merchant: 'Lider',
    amount: -15000,
  };

  it('returns 401 when there is no authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const res = await POST(jsonRequest('http://localhost/api/transactions', 'POST', validBody));

    expect(res.status).toBe(401);
  });

  it('returns 400 when the body fails validation', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);

    const res = await POST(jsonRequest('http://localhost/api/transactions', 'POST', { ...validBody, categoryId: 'not-a-uuid' }));

    expect(res.status).toBe(400);
    expect(createTransactionUseCase.execute).not.toHaveBeenCalled();
  });

  it('creates the transaction and returns 201', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(createTransactionUseCase.execute).mockResolvedValue({ id: 'tx-1' } as never);

    const res = await POST(jsonRequest('http://localhost/api/transactions', 'POST', validBody));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json).toEqual({ id: 'tx-1' });
  });

  it('returns 400 when the use-case throws', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(createTransactionUseCase.execute).mockRejectedValue(new Error('Category not found'));

    const res = await POST(jsonRequest('http://localhost/api/transactions', 'POST', validBody));

    expect(res.status).toBe(400);
  });
});
