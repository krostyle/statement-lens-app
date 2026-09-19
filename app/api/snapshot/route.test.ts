import { describe, it, expect, vi, beforeEach } from 'vitest';
import { urlRequest } from '@/src/test/helpers/api-request';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/src/infrastructure/container', () => ({
  categoryRepo: { findByUserId: vi.fn() },
  transactionRepo: {
    deleteManyTracking: vi.fn(),
    findByUserId: vi.fn(),
    createManyAndReturn: vi.fn(),
    findTrackingByMonth: vi.fn(),
  },
  merchantRuleRepo: { findByUserId: vi.fn() },
  budgetRepo: { findByUserId: vi.fn() },
  rawSnapshotParser: { parse: vi.fn() },
  trackingUploadRepo: { deleteByMonth: vi.fn(), create: vi.fn(), findByUserId: vi.fn() },
}));
vi.mock('@/src/infrastructure/parsers/snapshot-raw', () => ({
  parseFalabellaEstadoCuenta: vi.fn(),
  parseSantanderCCCartola: vi.fn(),
  parseSantanderPortalTab: vi.fn(),
  toSnapshotRows: vi.fn(),
}));

import { auth } from '@clerk/nextjs/server';
import {
  categoryRepo,
  transactionRepo,
  merchantRuleRepo,
  budgetRepo,
  rawSnapshotParser,
  trackingUploadRepo,
} from '@/src/infrastructure/container';
import {
  parseFalabellaEstadoCuenta,
  parseSantanderCCCartola,
  parseSantanderPortalTab,
  toSnapshotRows,
} from '@/src/infrastructure/parsers/snapshot-raw';
import { GET, POST } from './route';

const mockAuth = vi.mocked(auth);

function formRequest(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return new Request('http://localhost/api/snapshot', { method: 'POST', body: fd });
}

const otrosCategory = { id: 'cat-otros', userId: 'user-1', name: 'Otros', color: '#999', icon: null, isDefault: true, createdAt: new Date(), updatedAt: new Date() };
const comidaCategory = { id: 'cat-comida', userId: 'user-1', name: 'Alimentación', color: '#f97316', icon: null, isDefault: false, createdAt: new Date(), updatedAt: new Date() };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(categoryRepo.findByUserId).mockResolvedValue([otrosCategory, comidaCategory]);
  vi.mocked(merchantRuleRepo.findByUserId).mockResolvedValue([]);
  vi.mocked(budgetRepo.findByUserId).mockResolvedValue([]);
  vi.mocked(transactionRepo.deleteManyTracking).mockResolvedValue(undefined);
  vi.mocked(transactionRepo.findByUserId).mockResolvedValue([]);
  vi.mocked(transactionRepo.createManyAndReturn).mockResolvedValue([]);
  vi.mocked(transactionRepo.findTrackingByMonth).mockResolvedValue([]);
  vi.mocked(trackingUploadRepo.deleteByMonth).mockResolvedValue(undefined);
  vi.mocked(trackingUploadRepo.create).mockResolvedValue({ id: 'upload-1' } as never);
  vi.mocked(trackingUploadRepo.findByUserId).mockResolvedValue([]);
  vi.mocked(parseFalabellaEstadoCuenta).mockReturnValue([]);
  vi.mocked(parseSantanderCCCartola).mockReturnValue([]);
  vi.mocked(parseSantanderPortalTab).mockReturnValue([]);
  vi.mocked(toSnapshotRows).mockReturnValue([]);
  vi.mocked(rawSnapshotParser.parse).mockResolvedValue([]);
});

describe('POST /api/snapshot', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const res = await POST(formRequest({ month: '2024-03', bank: 'santander', sourceType: 'credit_card', csvText: 'x' }));

    expect(res.status).toBe(401);
  });

  it('returns 400 when month is missing or malformed', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);

    const res = await POST(formRequest({ month: '03-2024', bank: 'santander', sourceType: 'credit_card', csvText: 'x' }));

    expect(res.status).toBe(400);
  });

  it('returns 400 when bank is missing', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);

    const res = await POST(formRequest({ month: '2024-03', bank: '', sourceType: 'credit_card', csvText: 'x' }));

    expect(res.status).toBe(400);
  });

  it('returns 400 when sourceType is invalid', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);

    const res = await POST(formRequest({ month: '2024-03', bank: 'santander', sourceType: 'savings', csvText: 'x' }));

    expect(res.status).toBe(400);
  });

  it('returns 400 when neither csvText nor csvFile is provided', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);

    const res = await POST(formRequest({ month: '2024-03', bank: 'santander', sourceType: 'credit_card' }));

    expect(res.status).toBe(400);
  });

  it('returns 400 when no parser (deterministic or AI fallback) recognizes any movement', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);

    const res = await POST(formRequest({ month: '2024-03', bank: 'santander', sourceType: 'credit_card', csvText: 'texto sin sentido' }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain('No se reconocieron movimientos');
  });

  it('persists parsed rows, auto-categorizing via matching merchant rules', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(parseFalabellaEstadoCuenta).mockReturnValue([{ date: '2024-03-05', description: 'COMPRA LIDER', amount: -15000 } as never]);
    vi.mocked(toSnapshotRows).mockReturnValue([
      {
        id: 'row-1',
        date: '2024-03-05',
        description: 'COMPRA LIDER',
        merchant: 'COMPRA LIDER',
        amount: -15000,
        transactionType: 'expense',
        source: 'credit_card',
        bank: 'santander',
      },
    ] as never);
    vi.mocked(merchantRuleRepo.findByUserId).mockResolvedValue([
      { id: 'rule-1', userId: 'user-1', merchantPattern: 'compra lider', bank: '', categoryId: 'cat-comida', transactionType: null, createdAt: new Date(), updatedAt: new Date() },
    ]);

    const res = await POST(formRequest({ month: '2024-03', bank: 'santander', sourceType: 'credit_card', csvText: 'irrelevant, parser is mocked' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.month).toBe('2024-03');
    expect(transactionRepo.createManyAndReturn).toHaveBeenCalledWith([
      expect.objectContaining({ categoryId: 'cat-comida', reviewStatus: 'auto', merchant: 'COMPRA LIDER' }),
    ]);
  });

  it('defaults to the "Otros" category with reviewStatus pending when no rule matches', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(parseFalabellaEstadoCuenta).mockReturnValue([{ date: '2024-03-05', description: 'COMPRA DESCONOCIDA', amount: -5000 } as never]);
    vi.mocked(toSnapshotRows).mockReturnValue([
      {
        id: 'row-1',
        date: '2024-03-05',
        description: 'COMPRA DESCONOCIDA',
        merchant: 'COMPRA DESCONOCIDA',
        amount: -5000,
        transactionType: 'expense',
        source: 'credit_card',
        bank: 'santander',
      },
    ] as never);

    await POST(formRequest({ month: '2024-03', bank: 'santander', sourceType: 'credit_card', csvText: 'irrelevant' }));

    expect(transactionRepo.createManyAndReturn).toHaveBeenCalledWith([
      expect.objectContaining({ categoryId: 'cat-otros', reviewStatus: 'pending' }),
    ]);
  });

  it('skips rows that already exist as tracking transactions (cross-month duplicate check)', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(parseFalabellaEstadoCuenta).mockReturnValue([{ date: '2024-03-05', description: 'COMPRA LIDER', amount: -15000 } as never]);
    vi.mocked(toSnapshotRows).mockReturnValue([
      {
        id: 'row-1',
        date: '2024-03-05',
        description: 'COMPRA LIDER',
        merchant: 'COMPRA LIDER',
        amount: -15000,
        transactionType: 'expense',
        source: 'credit_card',
        bank: 'santander',
      },
    ] as never);
    vi.mocked(transactionRepo.findByUserId).mockResolvedValue([
      { date: new Date('2024-03-05T12:00:00.000Z'), amount: -15000, description: 'COMPRA LIDER' } as never,
    ]);

    const res = await POST(formRequest({ month: '2024-03', bank: 'santander', sourceType: 'credit_card', csvText: 'irrelevant' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.duplicatesSkipped).toBe(1);
    expect(transactionRepo.createManyAndReturn).toHaveBeenCalledWith([]);
  });

  it('falls back to the AI parser when deterministic parsers find nothing', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(rawSnapshotParser.parse).mockResolvedValue([{ date: '2024-03-05', description: 'AI PARSED', amount: -1000 } as never]);
    vi.mocked(toSnapshotRows).mockReturnValue([
      {
        id: 'row-1',
        date: '2024-03-05',
        description: 'AI PARSED',
        merchant: 'AI PARSED',
        amount: -1000,
        transactionType: 'expense',
        source: 'credit_card',
        bank: 'santander',
      },
    ] as never);

    const res = await POST(formRequest({ month: '2024-03', bank: 'santander', sourceType: 'credit_card', csvText: 'texto raro' }));

    expect(res.status).toBe(200);
    expect(rawSnapshotParser.parse).toHaveBeenCalledWith('texto raro', 'credit_card', '2024-03');
  });

  it('returns 500 and does not leak internals when persistence throws', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(parseFalabellaEstadoCuenta).mockReturnValue([{ date: '2024-03-05', description: 'X', amount: -1 } as never]);
    vi.mocked(toSnapshotRows).mockReturnValue([
      { id: 'row-1', date: '2024-03-05', description: 'X', merchant: 'X', amount: -1, transactionType: 'expense', source: 'credit_card', bank: 'santander' } as never,
    ]);
    vi.mocked(trackingUploadRepo.create).mockRejectedValue(new Error('db down'));

    const res = await POST(formRequest({ month: '2024-03', bank: 'santander', sourceType: 'credit_card', csvText: 'x' }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('db down');
  });
});

describe('GET /api/snapshot', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const res = await GET(urlRequest('http://localhost/api/snapshot'));

    expect(res.status).toBe(401);
  });

  it('returns null when there is no tracking data and no uploads for the month', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);

    const res = await GET(urlRequest('http://localhost/api/snapshot', { month: '2024-03' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toBeNull();
  });

  it('splits tracking transactions by source and returns metrics', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1' } as never);
    vi.mocked(transactionRepo.findTrackingByMonth).mockResolvedValue([
      {
        id: 'tx-1', date: new Date('2024-03-05'), description: 'Compra', merchant: 'Lider',
        amount: -15000, transactionType: 'expense', categoryId: 'cat-comida', accountType: 'credit_card', bank: 'santander',
      },
      {
        id: 'tx-2', date: new Date('2024-03-06'), description: 'Retiro', merchant: 'Cuenta',
        amount: -20000, transactionType: 'expense', categoryId: 'cat-otros', accountType: 'checking', bank: 'santander',
      },
    ] as never);

    const res = await GET(urlRequest('http://localhost/api/snapshot', { month: '2024-03' }));
    const json = await res.json();

    expect(json.month).toBe('2024-03');
    expect(json.ccTxs).toHaveLength(1);
    expect(json.checkingTxs).toHaveLength(1);
    expect(json.metrics).toBeDefined();
  });
});
