import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jsonRequest, routeParams } from '@/src/test/helpers/api-request';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/src/infrastructure/container', () => ({
  updateTransactionUseCase: { execute: vi.fn() },
  deleteTransactionUseCase: { execute: vi.fn() },
  upsertMerchantRuleUseCase: { execute: vi.fn() },
  transactionRepo: { findById: vi.fn(), findInstallmentGroup: vi.fn(), updateMany: vi.fn() },
}));

import { auth } from '@clerk/nextjs/server';
import {
  updateTransactionUseCase,
  deleteTransactionUseCase,
  upsertMerchantRuleUseCase,
  transactionRepo,
} from '@/src/infrastructure/container';
import { PATCH, DELETE } from './route';

const mockAuth = vi.mocked(auth);

const updatedTransaction = {
  id: 'tx-1',
  categoryId: 'cat-1',
  merchant: 'Lider',
  transactionType: 'expense',
  isInstallment: false,
  installmentTotal: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(updateTransactionUseCase.execute).mockResolvedValue(updatedTransaction as never);
});

describe('PATCH /api/transactions/[id]', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const res = await PATCH(jsonRequest('http://localhost', 'PATCH', {}), routeParams({ id: 'tx-1' }));

    expect(res.status).toBe(401);
  });

  it('returns 400 when the body fails validation', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);

    const res = await PATCH(jsonRequest('http://localhost', 'PATCH', { categoryId: 'not-a-uuid' }), routeParams({ id: 'tx-1' }));

    expect(res.status).toBe(400);
    expect(updateTransactionUseCase.execute).not.toHaveBeenCalled();
  });

  it('updates the transaction and returns it', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);

    const res = await PATCH(jsonRequest('http://localhost', 'PATCH', { merchant: 'Jumbo' }), routeParams({ id: 'tx-1' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.id).toBe('tx-1');
    expect(updateTransactionUseCase.execute).toHaveBeenCalledWith('tx-1', 'user-1', expect.objectContaining({ merchant: 'Jumbo' }));
  });

  it('translates confirm=true into a reviewStatus-only update', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);

    await PATCH(jsonRequest('http://localhost', 'PATCH', { confirm: true, merchant: 'Ignored' }), routeParams({ id: 'tx-1' }));

    expect(updateTransactionUseCase.execute).toHaveBeenCalledWith('tx-1', 'user-1', { reviewStatus: 'confirmed' });
  });

  it('maps "Forbidden" to 403 with a Spanish message', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(updateTransactionUseCase.execute).mockRejectedValue(new Error('Forbidden'));

    const res = await PATCH(jsonRequest('http://localhost', 'PATCH', { merchant: 'X' }), routeParams({ id: 'tx-1' }));

    expect(res.status).toBe(403);
  });

  it('maps "Transaction not found" to 404', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(updateTransactionUseCase.execute).mockRejectedValue(new Error('Transaction not found'));

    const res = await PATCH(jsonRequest('http://localhost', 'PATCH', { merchant: 'X' }), routeParams({ id: 'tx-1' }));

    expect(res.status).toBe(404);
  });

  it('maps "Categoría no válida" to 422', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(updateTransactionUseCase.execute).mockRejectedValue(new Error('Categoría no válida'));

    const res = await PATCH(jsonRequest('http://localhost', 'PATCH', { merchant: 'X' }), routeParams({ id: 'tx-1' }));

    expect(res.status).toBe(422);
  });

  it('saves a merchant rule using the pre-update merchant name when saveMerchantRule is set', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(transactionRepo.findById).mockResolvedValue({ merchant: 'LIDER ORIGINAL' } as never);
    vi.mocked(upsertMerchantRuleUseCase.execute).mockResolvedValue({} as never);

    const categoryId = '22222222-2222-4222-8222-222222222222';
    await PATCH(
      jsonRequest('http://localhost', 'PATCH', { merchant: 'Lider (renombrado)', categoryId, saveMerchantRule: true }),
      routeParams({ id: 'tx-1' })
    );

    expect(upsertMerchantRuleUseCase.execute).toHaveBeenCalledWith('user-1', 'LIDER ORIGINAL', '', categoryId, 'expense');
  });

  it('adds a ruleWarning instead of failing when the merchant rule upsert throws', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(transactionRepo.findById).mockResolvedValue({ merchant: 'Lider' } as never);
    vi.mocked(upsertMerchantRuleUseCase.execute).mockRejectedValue(new Error('conflict'));

    const res = await PATCH(
      jsonRequest('http://localhost', 'PATCH', { saveMerchantRule: true }),
      routeParams({ id: 'tx-1' })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ruleWarning).toContain('No se pudo guardar la regla');
  });

  it('propagates category/description to sibling installments when applyToInstallmentGroup is set', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(updateTransactionUseCase.execute).mockResolvedValue({
      ...updatedTransaction,
      isInstallment: true,
      installmentTotal: 6,
    } as never);
    vi.mocked(transactionRepo.findInstallmentGroup).mockResolvedValue([
      { id: 'tx-1' },
      { id: 'tx-2' },
      { id: 'tx-3' },
    ] as never);

    const categoryId = '22222222-2222-4222-8222-222222222222';
    await PATCH(
      jsonRequest('http://localhost', 'PATCH', { categoryId, applyToInstallmentGroup: true }),
      routeParams({ id: 'tx-1' })
    );

    expect(transactionRepo.updateMany).toHaveBeenCalledWith(['tx-2', 'tx-3'], 'user-1', expect.objectContaining({ categoryId }));
  });
});

describe('DELETE /api/transactions/[id]', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const res = await DELETE(jsonRequest('http://localhost', 'DELETE'), routeParams({ id: 'tx-1' }));

    expect(res.status).toBe(401);
  });

  it('deletes the transaction and returns 204', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(deleteTransactionUseCase.execute).mockResolvedValue(undefined);

    const res = await DELETE(jsonRequest('http://localhost', 'DELETE'), routeParams({ id: 'tx-1' }));

    expect(res.status).toBe(204);
  });

  it('maps "Transaction not found" to 404', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(deleteTransactionUseCase.execute).mockRejectedValue(new Error('Transaction not found'));

    const res = await DELETE(jsonRequest('http://localhost', 'DELETE'), routeParams({ id: 'tx-1' }));

    expect(res.status).toBe(404);
  });
});
