import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jsonRequest } from '@/src/test/helpers/api-request';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/src/infrastructure/container', () => ({
  financialChatUseCase: { execute: vi.fn() },
}));

import { auth } from '@clerk/nextjs/server';
import { financialChatUseCase } from '@/src/infrastructure/container';
import { POST } from './route';

const mockAuth = vi.mocked(auth);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/chat', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const res = await POST(jsonRequest('http://localhost', 'POST', { messages: [{ role: 'user', content: 'Hola' }] }) as never);

    expect(res.status).toBe(401);
  });

  it('returns 400 when messages is empty', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);

    const res = await POST(jsonRequest('http://localhost', 'POST', { messages: [] }) as never);

    expect(res.status).toBe(400);
    expect(financialChatUseCase.execute).not.toHaveBeenCalled();
  });

  it('streams the chat response as text/plain', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(financialChatUseCase.execute).mockResolvedValue(new ReadableStream() as never);

    const res = await POST(
      jsonRequest('http://localhost', 'POST', { messages: [{ role: 'user', content: 'Hola' }] }) as never
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/plain');
    expect(financialChatUseCase.execute).toHaveBeenCalledWith('user-1', [{ role: 'user', content: 'Hola' }]);
  });

  it('returns 500 when the use-case throws', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(financialChatUseCase.execute).mockRejectedValue(new Error('AI down'));

    const res = await POST(
      jsonRequest('http://localhost', 'POST', { messages: [{ role: 'user', content: 'Hola' }] }) as never
    );

    expect(res.status).toBe(500);
  });
});
