import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jsonRequest } from '@/src/test/helpers/api-request';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/src/infrastructure/container', () => ({
  listMerchantRulesUseCase: { execute: vi.fn() },
  upsertMerchantRuleUseCase: { execute: vi.fn() },
  merchantRuleRepo: { bulkUpdateTransactionType: vi.fn() },
}));

import { auth } from '@clerk/nextjs/server';
import { listMerchantRulesUseCase, upsertMerchantRuleUseCase, merchantRuleRepo } from '@/src/infrastructure/container';
import { GET, PATCH, POST } from './route';

const mockAuth = vi.mocked(auth);
const uuid1 = '11111111-1111-4111-8111-111111111111';
const uuid2 = '22222222-2222-4222-8222-222222222222';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/merchant-rules', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const res = await GET();

    expect(res.status).toBe(401);
  });

  it('returns the rules for the authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(listMerchantRulesUseCase.execute).mockResolvedValue([{ id: 'rule-1' }] as never);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual([{ id: 'rule-1' }]);
  });
});

describe('PATCH /api/merchant-rules', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const res = await PATCH(jsonRequest('http://localhost', 'PATCH', { ids: [uuid1], transactionType: 'income' }));

    expect(res.status).toBe(401);
  });

  it('returns 400 when the body fails validation', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);

    const res = await PATCH(jsonRequest('http://localhost', 'PATCH', { ids: [], transactionType: 'income' }));

    expect(res.status).toBe(400);
  });

  it('bulk-updates the transaction type for the given rule ids', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(merchantRuleRepo.bulkUpdateTransactionType).mockResolvedValue([{ id: uuid1 }] as never);

    const res = await PATCH(jsonRequest('http://localhost', 'PATCH', { ids: [uuid1], transactionType: 'income' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual([{ id: uuid1 }]);
    expect(merchantRuleRepo.bulkUpdateTransactionType).toHaveBeenCalledWith('user-1', [uuid1], 'income');
  });
});

describe('POST /api/merchant-rules', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const res = await POST(jsonRequest('http://localhost', 'POST', { merchant: 'Lider', categoryId: uuid1 }));

    expect(res.status).toBe(401);
  });

  it('returns 400 when the body fails validation', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);

    const res = await POST(jsonRequest('http://localhost', 'POST', { merchant: '', categoryId: uuid1 }));

    expect(res.status).toBe(400);
  });

  it('creates the rule and returns 201', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(upsertMerchantRuleUseCase.execute).mockResolvedValue({ id: 'rule-1' } as never);

    const res = await POST(jsonRequest('http://localhost', 'POST', { merchant: 'Lider', categoryId: uuid1 }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json).toEqual({ id: 'rule-1' });
    expect(upsertMerchantRuleUseCase.execute).toHaveBeenCalledWith('user-1', 'Lider', '', uuid1, null);
  });

  it('maps "Categoría no válida" to 422', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(upsertMerchantRuleUseCase.execute).mockRejectedValue(new Error('Categoría no válida'));

    const res = await POST(jsonRequest('http://localhost', 'POST', { merchant: 'Lider', categoryId: uuid1 }));

    expect(res.status).toBe(422);
  });

  it('returns 500 for unexpected errors', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(upsertMerchantRuleUseCase.execute).mockRejectedValue(new Error('boom'));

    const res = await POST(jsonRequest('http://localhost', 'POST', { merchant: 'Lider', categoryId: uuid1 }));

    expect(res.status).toBe(500);
  });
});
