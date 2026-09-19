import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jsonRequest, routeParams } from '@/src/test/helpers/api-request';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/src/infrastructure/container', () => ({
  deleteMerchantRuleUseCase: { execute: vi.fn() },
}));

import { auth } from '@clerk/nextjs/server';
import { deleteMerchantRuleUseCase } from '@/src/infrastructure/container';
import { DELETE } from './route';

const mockAuth = vi.mocked(auth);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DELETE /api/merchant-rules/[id]', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const res = await DELETE(jsonRequest('http://localhost', 'DELETE'), routeParams({ id: 'rule-1' }));

    expect(res.status).toBe(401);
  });

  it('deletes the rule and returns 204', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(deleteMerchantRuleUseCase.execute).mockResolvedValue(undefined);

    const res = await DELETE(jsonRequest('http://localhost', 'DELETE'), routeParams({ id: 'rule-1' }));

    expect(res.status).toBe(204);
  });

  it('maps "Forbidden" to 403', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(deleteMerchantRuleUseCase.execute).mockRejectedValue(new Error('Forbidden'));

    const res = await DELETE(jsonRequest('http://localhost', 'DELETE'), routeParams({ id: 'rule-1' }));

    expect(res.status).toBe(403);
  });

  it('maps "Regla no encontrada" to 404', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(deleteMerchantRuleUseCase.execute).mockRejectedValue(new Error('Regla no encontrada'));

    const res = await DELETE(jsonRequest('http://localhost', 'DELETE'), routeParams({ id: 'rule-1' }));

    expect(res.status).toBe(404);
  });

  it('maps any other error to 422', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(deleteMerchantRuleUseCase.execute).mockRejectedValue(new Error('boom'));

    const res = await DELETE(jsonRequest('http://localhost', 'DELETE'), routeParams({ id: 'rule-1' }));

    expect(res.status).toBe(422);
  });
});
