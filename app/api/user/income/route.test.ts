import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jsonRequest } from '@/src/test/helpers/api-request';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/src/infrastructure/container', () => ({
  userProfileRepo: { ensureExists: vi.fn(), findById: vi.fn(), updateIncome: vi.fn() },
}));

import { auth } from '@clerk/nextjs/server';
import { userProfileRepo } from '@/src/infrastructure/container';
import { GET, PATCH } from './route';

const mockAuth = vi.mocked(auth);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/user/income', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const res = await GET();

    expect(res.status).toBe(401);
  });

  it('ensures the profile exists and returns its monthlyIncome', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(userProfileRepo.ensureExists).mockResolvedValue({ clerkId: 'user-1', monthlyIncome: null });
    vi.mocked(userProfileRepo.findById).mockResolvedValue({ clerkId: 'user-1', monthlyIncome: 1500000 });

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ monthlyIncome: 1500000 });
    expect(userProfileRepo.ensureExists).toHaveBeenCalledWith('user-1');
  });

  it('returns null when the profile has no income set', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(userProfileRepo.ensureExists).mockResolvedValue({ clerkId: 'user-1', monthlyIncome: null });
    vi.mocked(userProfileRepo.findById).mockResolvedValue(null);

    const res = await GET();
    const json = await res.json();

    expect(json).toEqual({ monthlyIncome: null });
  });
});

describe('PATCH /api/user/income', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const res = await PATCH(jsonRequest('http://localhost', 'PATCH', { monthlyIncome: 1000000 }));

    expect(res.status).toBe(401);
  });

  it('returns 400 for a non-positive amount', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);

    const res = await PATCH(jsonRequest('http://localhost', 'PATCH', { monthlyIncome: -100 }));

    expect(res.status).toBe(400);
    expect(userProfileRepo.updateIncome).not.toHaveBeenCalled();
  });

  it('updates and returns the new monthlyIncome', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(userProfileRepo.updateIncome).mockResolvedValue({ clerkId: 'user-1', monthlyIncome: 2000000 });

    const res = await PATCH(jsonRequest('http://localhost', 'PATCH', { monthlyIncome: 2000000 }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ monthlyIncome: 2000000 });
    expect(userProfileRepo.updateIncome).toHaveBeenCalledWith('user-1', 2000000);
  });
});
