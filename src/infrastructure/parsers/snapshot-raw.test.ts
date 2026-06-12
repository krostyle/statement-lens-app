import { describe, it, expect } from 'vitest';
import { parseRawStatementText, toSnapshotRows } from './snapshot-raw';

// Real-world sample: tab-separated text copied from a bank web portal.
// Dates appear only on the first row of each day.
const SAMPLE = [
  '11/06/2026\t\tPAYU *UBER TR\t-$19.989\t\t',
  'SERVICIOS Y COM\t-$3.750\t\t',
  'PAYU *UBER TR\t-$2.177\t\t',
  '10/06/2026\t\tPAYU *UBER TR\t-$18.946\t\t',
  'SERVICIOS Y COMERCIAL RAU\t-$3.750\t\t',
  '07/06/2026\t\tPARIS MALL PLAZA VESPUCIO\t-$72.990\t\t',
  '40663SBX KIOSKO MPV\t-$9.550\t\t',
  '28/05/2026\t\tSERVICIOS Y COMERCIAL RAU\t-$3.750\t\t',
  'PAGO\t\t+$2.332.942\t',
  '25/05/2026\t\tPAYU *UBER TRIP\t-$4.854\t\t',
  'SALDO INICIAL\t-$2.332.942\t\t',
  '24/05/2026\t\tSUMUP * NOSETTY CAFE\t-$6.640\t',
].join('\n');

describe('parseRawStatementText', () => {
  it('parses tab-separated bank portal text with carried-forward dates', () => {
    const rows = parseRawStatementText(SAMPLE, '2026-06');

    expect(rows).toHaveLength(11); // 12 lines minus SALDO INICIAL

    expect(rows[0]).toMatchObject({
      date: '2026-06-11',
      description: 'PAYU *UBER TR',
      amount: -19989,
      explicitSign: true,
    });

    // Continuation lines inherit the previous date
    expect(rows[1]).toMatchObject({ date: '2026-06-11', description: 'SERVICIOS Y COM', amount: -3750 });
    expect(rows[2]).toMatchObject({ date: '2026-06-11', amount: -2177 });
    expect(rows[3].date).toBe('2026-06-10');
  });

  it('parses Chilean amounts with multiple thousands separators', () => {
    const rows = parseRawStatementText(SAMPLE, '2026-06');
    const pago = rows.find((r) => r.description === 'PAGO');
    expect(pago).toMatchObject({ date: '2026-05-28', amount: 2332942 });
  });

  it('skips balance rows', () => {
    const rows = parseRawStatementText(SAMPLE, '2026-06');
    expect(rows.some((r) => /saldo/i.test(r.description))).toBe(false);
  });

  it('keeps digits inside descriptions and uses the last money token as the amount', () => {
    const rows = parseRawStatementText(SAMPLE, '2026-06');
    const kiosko = rows.find((r) => r.description.includes('KIOSKO'));
    expect(kiosko).toMatchObject({ description: '40663SBX KIOSKO MPV', amount: -9550 });
  });

  it('infers the year from the month when the date lacks one', () => {
    const rows = parseRawStatementText('05/06\tFASIL MARKET\t-$17.990', '2026-06');
    expect(rows[0].date).toBe('2026-06-05');
  });

  it('returns [] for unrecognizable text', () => {
    expect(parseRawStatementText('hola esto no es una cartola', '2026-06')).toEqual([]);
  });
});

describe('toSnapshotRows', () => {
  it('marks credit-card PAGO as transfer and charges as expenses', () => {
    const rows = toSnapshotRows(parseRawStatementText(SAMPLE, '2026-06'), 'credit_card', 'santander');

    const pago = rows.find((r) => r.description === 'PAGO')!;
    expect(pago.transactionType).toBe('transfer');
    expect(pago.amount).toBe(2332942);

    const charge = rows.find((r) => r.description === 'PAYU *UBER TR')!;
    expect(charge.transactionType).toBe('expense');
    expect(charge.amount).toBe(-19989);
    expect(charge.source).toBe('credit_card');
    expect(charge.bank).toBe('santander');
  });

  it('negates unsigned credit-card amounts (CSV-style convention)', () => {
    const rows = toSnapshotRows(
      [{ date: '2026-06-05', description: 'FASIL MARKET', amount: 17990, explicitSign: false }],
      'credit_card',
      'santander',
    );
    expect(rows[0].amount).toBe(-17990);
    expect(rows[0].transactionType).toBe('expense');
  });

  it('classifies checking rows by sign and description', () => {
    const rows = toSnapshotRows(
      [
        { date: '2026-06-05', description: 'TRANSFERENCIA RECIBIDA', amount: 500000, explicitSign: true },
        { date: '2026-06-06', description: 'COMPRA SUPERMERCADO', amount: -25000, explicitSign: true },
        { date: '2026-06-07', description: 'PAGO TARJETA CREDITO', amount: -100000, explicitSign: true },
      ],
      'checking',
      'santander',
    );
    expect(rows[0].transactionType).toBe('income');
    expect(rows[1].transactionType).toBe('expense');
    expect(rows[2].transactionType).toBe('transfer');
  });
});
