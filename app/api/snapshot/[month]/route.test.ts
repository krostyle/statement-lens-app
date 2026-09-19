import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jsonRequest, urlRequest } from '@/src/test/helpers/api-request';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/src/infrastructure/container', () => ({
  transactionRepo: { findTrackingByMonth: vi.fn(), updateMany: vi.fn(), deleteManyTracking: vi.fn() },
  categoryRepo: { findByUserId: vi.fn() },
  budgetRepo: { findByUserId: vi.fn() },
  trackingUploadRepo: { deleteByMonth: vi.fn() },
}));

import { auth } from '@clerk/nextjs/server';
import { transactionRepo, categoryRepo, budgetRepo, trackingUploadRepo } from '@/src/infrastructure/container';
import { DELETE, PATCH } from './route';

const mockAuth = vi.mocked(auth);

function params(month: string) {
  return { params: Promise.resolve({ month }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(categoryRepo.findByUserId).mockResolvedValue([]);
  vi.mocked(budgetRepo.findByUserId).mockResolvedValue([]);
});

describe('DELETE /api/snapshot/[month]', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const res = await DELETE(urlRequest('http://localhost'), params('2024-03'));

    expect(res.status).toBe(401);
  });

  it('deletes the upload records and tracking transactions for the month', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(trackingUploadRepo.deleteByMonth).mockResolvedValue(undefined);
    vi.mocked(transactionRepo.deleteManyTracking).mockResolvedValue(undefined);

    const res = await DELETE(urlRequest('http://localhost', { bank: 'santander', source: 'checking' }), params('2024-03'));

    expect(res.status).toBe(204);
    expect(trackingUploadRepo.deleteByMonth).toHaveBeenCalledWith('user-1', '2024-03', 'santander', 'checking');
    expect(transactionRepo.deleteManyTracking).toHaveBeenCalledWith('user-1', '2024-03', 'santander', 'checking');
  });
});

describe('PATCH /api/snapshot/[month]', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const res = await PATCH(
      jsonRequest('http://localhost', 'PATCH', { merchant: 'Lider', categoryId: 'cat-1', categoryName: 'Alimentación' }),
      params('2024-03')
    );

    expect(res.status).toBe(401);
  });

  it('returns 400 when a required field is missing', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);

    const res = await PATCH(jsonRequest('http://localhost', 'PATCH', { merchant: 'Lider' }), params('2024-03'));

    expect(res.status).toBe(400);
    expect(transactionRepo.updateMany).not.toHaveBeenCalled();
  });

  it('re-categorizes every tracking transaction for the merchant and returns fresh metrics', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(transactionRepo.findTrackingByMonth).mockResolvedValue([
      { id: 'tx-1', merchant: 'Lider', date: new Date('2024-03-05'), description: 'Compra', amount: -1000, transactionType: 'expense', categoryId: 'cat-1', accountType: 'credit_card', bank: 'santander' },
      { id: 'tx-2', merchant: 'Jumbo', date: new Date('2024-03-06'), description: 'Compra', amount: -2000, transactionType: 'expense', categoryId: 'cat-2', accountType: 'credit_card', bank: 'santander' },
    ] as never);
    vi.mocked(transactionRepo.updateMany).mockResolvedValue(1);

    const res = await PATCH(
      jsonRequest('http://localhost', 'PATCH', { merchant: 'Lider', categoryId: 'cat-1', categoryName: 'Alimentación' }),
      params('2024-03')
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toHaveProperty('metrics');
    expect(transactionRepo.updateMany).toHaveBeenCalledWith(['tx-1'], 'user-1', { categoryId: 'cat-1' });
  });

  it('does not call updateMany when no transaction matches the merchant', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(transactionRepo.findTrackingByMonth).mockResolvedValue([
      { id: 'tx-2', merchant: 'Jumbo', date: new Date('2024-03-06'), description: 'Compra', amount: -2000, transactionType: 'expense', categoryId: 'cat-2', accountType: 'credit_card', bank: 'santander' },
    ] as never);

    await PATCH(
      jsonRequest('http://localhost', 'PATCH', { merchant: 'Lider', categoryId: 'cat-1', categoryName: 'Alimentación' }),
      params('2024-03')
    );

    expect(transactionRepo.updateMany).not.toHaveBeenCalled();
  });
});
