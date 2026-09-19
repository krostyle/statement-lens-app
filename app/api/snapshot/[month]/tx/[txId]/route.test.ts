import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jsonRequest } from '@/src/test/helpers/api-request';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/src/infrastructure/container', () => ({
  transactionRepo: { findById: vi.fn(), update: vi.fn(), findTrackingByMonth: vi.fn() },
  categoryRepo: { findByUserId: vi.fn() },
  budgetRepo: { findByUserId: vi.fn() },
}));

import { auth } from '@clerk/nextjs/server';
import { transactionRepo, categoryRepo, budgetRepo } from '@/src/infrastructure/container';
import { PATCH } from './route';

const mockAuth = vi.mocked(auth);

function params(month: string, txId: string) {
  return { params: Promise.resolve({ month, txId }) };
}

const validBody = { categoryId: 'cat-2', categoryName: 'Transporte', transactionType: 'expense' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(categoryRepo.findByUserId).mockResolvedValue([]);
  vi.mocked(budgetRepo.findByUserId).mockResolvedValue([]);
  vi.mocked(transactionRepo.findTrackingByMonth).mockResolvedValue([]);
});

describe('PATCH /api/snapshot/[month]/tx/[txId]', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const res = await PATCH(jsonRequest('http://localhost', 'PATCH', validBody), params('2024-03', 'tx-1'));

    expect(res.status).toBe(401);
  });

  it('returns 400 when a required field is missing', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);

    const res = await PATCH(
      jsonRequest('http://localhost', 'PATCH', { categoryId: 'cat-2' }),
      params('2024-03', 'tx-1')
    );

    expect(res.status).toBe(400);
    expect(transactionRepo.update).not.toHaveBeenCalled();
  });

  it('returns 404 when the transaction does not exist', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(transactionRepo.findById).mockResolvedValue(null);

    const res = await PATCH(jsonRequest('http://localhost', 'PATCH', validBody), params('2024-03', 'tx-1'));

    expect(res.status).toBe(404);
  });

  it('returns 404 when the transaction belongs to another user', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(transactionRepo.findById).mockResolvedValue({ userId: 'other-user', origin: 'tracking' } as never);

    const res = await PATCH(jsonRequest('http://localhost', 'PATCH', validBody), params('2024-03', 'tx-1'));

    expect(res.status).toBe(404);
  });

  it('returns 404 when the transaction is not a tracking transaction', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(transactionRepo.findById).mockResolvedValue({ userId: 'user-1', origin: 'manual' } as never);

    const res = await PATCH(jsonRequest('http://localhost', 'PATCH', validBody), params('2024-03', 'tx-1'));

    expect(res.status).toBe(404);
  });

  it('updates the transaction and returns fresh metrics', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(transactionRepo.findById).mockResolvedValue({ userId: 'user-1', origin: 'tracking' } as never);
    vi.mocked(transactionRepo.update).mockResolvedValue({} as never);

    const res = await PATCH(jsonRequest('http://localhost', 'PATCH', validBody), params('2024-03', 'tx-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toHaveProperty('metrics');
    expect(transactionRepo.update).toHaveBeenCalledWith('tx-1', {
      categoryId: 'cat-2',
      transactionType: 'expense',
    });
  });
});
