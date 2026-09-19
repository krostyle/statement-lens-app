import { describe, it, expect, vi, beforeEach } from 'vitest';
import { urlRequest } from '@/src/test/helpers/api-request';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/src/infrastructure/database/prisma.client', () => ({
  prisma: { transaction: { findMany: vi.fn() } },
}));

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/src/infrastructure/database/prisma.client';
import { GET } from './route';

const mockAuth = vi.mocked(auth);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/transactions/export', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const res = await GET(urlRequest('http://localhost/api/transactions/export'));

    expect(res.status).toBe(401);
  });

  it('returns a CSV with header and rows as an attachment', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      {
        date: new Date('2024-03-15'),
        description: 'Supermercado',
        merchant: 'Lider',
        category: { name: 'Alimentación' },
        amount: -15000,
        currency: 'CLP',
        installmentNum: null,
        installmentTotal: null,
      },
    ] as never);

    const res = await GET(urlRequest('http://localhost/api/transactions/export'));
    const csv = await res.text();
    const lines = csv.split('\n');

    expect(res.headers.get('Content-Type')).toContain('text/csv');
    expect(res.headers.get('Content-Disposition')).toContain('attachment');
    expect(lines[0]).toBe('fecha,descripcion,comercio,categoria,monto,moneda,cuota_num,cuota_total');
    expect(lines[1]).toBe('2024-03-15,Supermercado,Lider,Alimentación,-15000,CLP,,');
  });

  it('quotes fields that contain a comma', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      {
        date: new Date('2024-03-15'),
        description: 'Compra, con coma',
        merchant: 'Lider',
        category: { name: 'Alimentación' },
        amount: -1000,
        currency: 'CLP',
        installmentNum: null,
        installmentTotal: null,
      },
    ] as never);

    const res = await GET(urlRequest('http://localhost/api/transactions/export'));
    const csv = await res.text();

    expect(csv).toContain('"Compra, con coma"');
  });

  it('filters by categoryId when provided', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);

    await GET(urlRequest('http://localhost/api/transactions/export', { categoryId: 'cat-1' }));

    expect(prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'user-1', categoryId: 'cat-1' }) })
    );
  });
});
