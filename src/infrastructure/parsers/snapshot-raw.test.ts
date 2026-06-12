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

// Real-world sample: text copied from a billed Santander credit-card statement
// (estado de cuenta facturado). Installment rows have no "lugar de operación"
// prefix and end with the cuota marker + monthly installment value; regular
// rows start with the place. Includes page-footer/header noise as pasted.
const BILLED_SAMPLE = [
  '12/02/26 3094 SPARTA CONCEPT STORE N/CUOTAS PRECIO 0,00 % $ 1.883.462 $ 1.883.462 04/12 $156.955',
  '13/02/26 3094 SPARTA CONCEPT STORE N/CUOTAS PRECIO 0,00 % $ 48.975 $ 48.975 04/06 $8.163',
  '14/04/26 TICKETMASTER SANTANDER TC CUOTA FIJA 2,77 % $ 165.750 $ 186.491 01/06 $31.082',
  'LAS CONDES 22/04/26 MERCADOPAGO*PRODUCTOSSANC $2.980',
  'CORDILLERA 23/04/26 DELIVERY DEL SOL $52.490',
  'SANTIAGO 23/04/26 PAYU *UBER TRIP $1.973',
  '29/04/26 MONTO CANCELADO $ -1.800.019',
  '3 DE 6',
  'MONTO',
  'ORIGEN',
  'OPERACIÓN',
  'O COBRO',
  'FECHA DE',
  'OPERACIÓN',
  '2.PERÍODO ACTUAL',
  'DESCRIPCIÓN OPERACIÓN O COBRO',
  'VALOR CUOTA',
  'MENSUAL',
  'CARGO DEL MES',
  'SANTIAGO 14/05/26 PAYU *UBER TRIP $56',
  'SAN JOSE DEL 09/05/26 SUMUP * INESITA $13.200',
].join('\n');

describe('parseRawStatementText — billed statement (Santander)', () => {
  it('extracts the monthly installment value, never the total purchase amount', () => {
    const rows = parseRawStatementText(BILLED_SAMPLE, '2026-06');
    const sparta = rows.find((r) => r.merchant === 'SPARTA CONCEPT STORE' && r.installmentTotal === 12)!;

    expect(sparta.amount).toBe(156955); // valor cuota mensual, NOT 1.883.462
    expect(sparta.installmentNum).toBe(4);
    expect(sparta.installmentTotal).toBe(12);
    expect(sparta.description).toBe('SPARTA CONCEPT STORE (cuota 04/12 · compra 12/02/26)');
  });

  it('re-dates installment rows to the tracked month, keeping the purchase date in the description', () => {
    const rows = parseRawStatementText(BILLED_SAMPLE, '2026-06');
    const ticket = rows.find((r) => r.merchant === 'TICKETMASTER')!;

    expect(ticket.date).toBe('2026-06-01');
    expect(ticket.amount).toBe(31082);
    expect(ticket.installmentNum).toBe(1);
    expect(ticket.installmentTotal).toBe(6);
    expect(ticket.description).toContain('compra 14/04/26');
  });

  it('skips informational 00/NN installment rows (not real charges yet)', () => {
    const rows = parseRawStatementText(
      '15/05/26 3094 FALABELLA RETAIL N/CUOTAS PRECIO 0,00 % $ 120.000 $ 120.000 00/12 $10.000',
      '2026-06',
    );
    expect(rows).toEqual([]);
  });

  it('parses regular rows with a place prefix, dropping the place', () => {
    const rows = parseRawStatementText(BILLED_SAMPLE, '2026-06');
    const mp = rows.find((r) => r.description === 'MERCADOPAGO*PRODUCTOSSANC')!;

    expect(mp.date).toBe('2026-04-22');
    expect(mp.amount).toBe(2980);
    expect(mp.explicitSign).toBe(false); // unsigned → negated later for credit_card
    expect(rows.some((r) => r.description.includes('LAS CONDES'))).toBe(false);
  });

  it('handles truncated place names and amounts without thousands separator', () => {
    const rows = parseRawStatementText(BILLED_SAMPLE, '2026-06');
    expect(rows.find((r) => r.description === 'SUMUP * INESITA')).toMatchObject({ date: '2026-05-09', amount: 13200 });
    expect(rows.find((r) => r.amount === 56)).toMatchObject({ description: 'PAYU *UBER TRIP', date: '2026-05-14' });
  });

  it('skips MONTO CANCELADO (payment) and page header/footer noise', () => {
    const rows = parseRawStatementText(BILLED_SAMPLE, '2026-06');
    expect(rows.some((r) => /monto cancelado/i.test(r.description))).toBe(false);
    expect(rows.some((r) => /per[ií]odo|cargo del mes|valor cuota/i.test(r.description))).toBe(false);
    expect(rows).toHaveLength(8); // 3 cuotas + 5 regular rows
  });

  it('produces negative expenses with clean merchants via toSnapshotRows', () => {
    const txs = toSnapshotRows(parseRawStatementText(BILLED_SAMPLE, '2026-06'), 'credit_card', 'santander');

    const sparta = txs.find((t) => t.merchant === 'SPARTA CONCEPT STORE' && t.description.includes('04/12'))!;
    expect(sparta.amount).toBe(-156955);
    expect(sparta.transactionType).toBe('expense');

    // All billed-statement rows are unsigned charges → all negative expenses
    expect(txs.every((t) => t.amount < 0 && t.transactionType === 'expense')).toBe(true);
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
