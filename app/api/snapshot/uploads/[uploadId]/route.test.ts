import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jsonRequest, routeParams } from '@/src/test/helpers/api-request';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/src/infrastructure/container', () => ({
  trackingUploadRepo: { deleteById: vi.fn(), setFinalized: vi.fn() },
}));

import { auth } from '@clerk/nextjs/server';
import { trackingUploadRepo } from '@/src/infrastructure/container';
import { DELETE, PATCH } from './route';

const mockAuth = vi.mocked(auth);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DELETE /api/snapshot/uploads/[uploadId]', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const res = await DELETE(jsonRequest('http://localhost', 'DELETE'), routeParams({ uploadId: 'up-1' }));

    expect(res.status).toBe(401);
  });

  it('deletes the upload scoped to the user and returns 204', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(trackingUploadRepo.deleteById).mockResolvedValue(undefined);

    const res = await DELETE(jsonRequest('http://localhost', 'DELETE'), routeParams({ uploadId: 'up-1' }));

    expect(res.status).toBe(204);
    expect(trackingUploadRepo.deleteById).toHaveBeenCalledWith('up-1', 'user-1');
  });
});

describe('PATCH /api/snapshot/uploads/[uploadId]', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const res = await PATCH(jsonRequest('http://localhost', 'PATCH', { isFinalized: true }), routeParams({ uploadId: 'up-1' }));

    expect(res.status).toBe(401);
  });

  it('sets the finalized flag and returns the updated upload', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(trackingUploadRepo.setFinalized).mockResolvedValue({ id: 'up-1', isFinalized: true } as never);

    const res = await PATCH(jsonRequest('http://localhost', 'PATCH', { isFinalized: true }), routeParams({ uploadId: 'up-1' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ id: 'up-1', isFinalized: true });
    expect(trackingUploadRepo.setFinalized).toHaveBeenCalledWith('up-1', 'user-1', true);
  });
});
