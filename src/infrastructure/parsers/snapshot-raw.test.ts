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

// Full Santander statement extras: totals header, CUOTA COMERCIO installments
// (2-digit years from past purchases) and the payment-stub section.
const SANTANDER_FULL_SAMPLE = [
  '2.PERÍODO ACTUAL',
  'DESCRIPCIÓN OPERACIÓN O COBRO',
  '1. TOTAL OPERACIONES $ 2.332.942',
  'MOVIMIENTOS TARJETA XXXX-1125 $ 2.332.942',
  '10/12/24 MACONLINE TOBALABA CUOTA COMERCIO 0,00 % $ 1.452.960 $ 1.452.960 17/36 $40.360',
  '10/12/24 MACONLINE TOBALABA CUOTA COMERCIO 0,00 % $ 1.342.960 $ 1.342.960 17/36 $37.304',
  '28/05/25 SIGLO XXI CUOTA FIJA 2,55 % $ 762.395 $ 926.765 11/12 $77.231',
  '04/02/26 PARIS PUENTE ALTO CUOTA COMERCIO 0,00 % $ 58.966 $ 58.966 03/03 $19.656',
  '04/02/26 RIPLEY PLAZA VESPUCIO CUOTA FIJA 2,54 % $ 182.970 $ 205.205 03/06 $34.201',
  'COMPROBANTE DE PAGO',
  'MONTO MÍNIMO A PAGAR',
  'Cheque',
  'DIEGO BUSTAMANTE ALBARRAN',
  'MONTO TOTAL FACTURADO A PAGAR',
  'NÚMERO DE TARJETA',
  '$ 15.800',
  '09/06/2026',
  'MONTO CANCELADO',
  '$ 2.332.942',
  'XXXX XXXX XXXX 1125',
  'SANTIAGO 30/04/26 PAYU *UBER TRIP $1.863',
].join('\n');

describe('parseRawStatementText — full Santander statement', () => {
  it('parses CUOTA COMERCIO / CUOTA FIJA installments with 2-digit years', () => {
    const rows = parseRawStatementText(SANTANDER_FULL_SAMPLE, '2026-06');

    const maconline = rows.filter((r) => r.merchant === 'MACONLINE TOBALABA');
    expect(maconline.map((r) => r.amount).sort()).toEqual([37304, 40360]);
    expect(maconline[0]).toMatchObject({ installmentNum: 17, installmentTotal: 36, date: '2026-06-01' });
    expect(maconline[0].description).toContain('compra 10/12/24');

    expect(rows.find((r) => r.merchant === 'SIGLO XXI')).toMatchObject({ amount: 77231, installmentNum: 11, installmentTotal: 12 });
    expect(rows.find((r) => r.merchant === 'PARIS PUENTE ALTO')).toMatchObject({ amount: 19656, installmentTotal: 3 });
    expect(rows.find((r) => r.merchant === 'RIPLEY PLAZA VESPUCIO')).toMatchObject({ amount: 34201, installmentTotal: 6 });
  });

  it('ignores the totals header and the payment-stub section', () => {
    const rows = parseRawStatementText(SANTANDER_FULL_SAMPLE, '2026-06');

    expect(rows.some((r) => /total operaciones|movimientos tarjeta|monto/i.test(r.description))).toBe(false);
    // standalone "$ 15.800" / "$ 2.332.942" stub amounts must not become rows
    expect(rows.some((r) => r.amount === 15800 || r.amount === 2332942)).toBe(false);
    expect(rows).toHaveLength(6); // 5 cuotas + 1 regular purchase
  });
});

// Real-world sample: billed Falabella CMR statement. No $ symbols, " T "
// separator, every row carries a cuota marker (01/01 = simple purchase) and
// usually a month-year token. Credits (refunds, payments) are negative.
const FALABELLA_SAMPLE = [
  '2. PERÍODO ACTUAL',
  '2.1 Total Operaciones',
  'FALABELLA',
  'S/I 18/02/2026 Falabella.com T 304.990 330.497 03/03 abr-2026 110.167',
  'HOMECENTER - SODIMAC',
  'Sin Movimientos',
  'ESTADO DE CUENTA',
  'Nombre del Titular: DIEGO BUSTAMANTE ALBARRAN',
  'Cupon de Pago N°: 18.762.089.09',
  'N° de Contrato: 999920******8863',
  'Fecha Facturación Estado de',
  'Cuenta:',
  '19/05/2026',
  'COMPRAS NACIONALES',
  'Santiago 26/12/2025 Universidad mayor T 365.240 365.240 05/12 feb-2026 30.436',
  'Santiago 20/04/2026 Uber eats T 7.258 7.258 01/01 jun-2026 7.258',
  'Las Condes 28/04/2026 Mercadopago *mercadol T -44.990 -44.990 01/01 -44.990',
  'Santiago 23/04/2026 Salcobrand huerfanos 9 T 24.845 24.845 01/01 jun-2026 24.845',
  'COMPRAS INTERNACIONALES',
  'San Francisco 19/04/2026 Claude.ai su CL USD 23,8 T 21.443 21.443 01/01 jun-2026 21.443',
  'OTROS',
  'Sin Movimientos',
  '2.3 Cargos, Comisiones, Impuestos y Abonos',
  'S/I 28/04/2026 Pago tarjeta cmr T -849.300 0 01/01',
  '19/05/2026 Servicio administracion 14.142 14.142 01/01 14.142',
].join('\n');

describe('parseRawStatementText — billed statement (Falabella)', () => {
  it('parses installment rows: bare amounts, month-year token, valor cuota', () => {
    const rows = parseRawStatementText(FALABELLA_SAMPLE, '2026-06');

    const falabella = rows.find((r) => r.merchant === 'Falabella.com')!;
    expect(falabella.amount).toBe(110167); // valor cuota, NOT 304.990 nor 330.497
    expect(falabella.installmentNum).toBe(3);
    expect(falabella.installmentTotal).toBe(3);
    expect(falabella.date).toBe('2026-06-01');

    const uni = rows.find((r) => r.merchant === 'Universidad mayor')!;
    expect(uni.amount).toBe(30436);
    expect(uni.description).toBe('Universidad mayor (cuota 05/12 · compra 26/12/2025)');
  });

  it('treats 01/01 rows as simple purchases with their real date', () => {
    const rows = parseRawStatementText(FALABELLA_SAMPLE, '2026-06');
    const uber = rows.find((r) => r.description === 'Uber eats')!;

    expect(uber.amount).toBe(7258);
    expect(uber.date).toBe('2026-04-20');
    expect(uber.installmentNum).toBeUndefined();
  });

  it('flips negative amounts to positive credits (refunds) in billed docs', () => {
    const rows = parseRawStatementText(FALABELLA_SAMPLE, '2026-06');
    const refund = rows.find((r) => r.description === 'Mercadopago *mercadol')!;

    expect(refund.amount).toBe(44990);
    expect(refund.explicitSign).toBe(true); // survives the credit-card negation downstream
  });

  it('drops card payment rows (Pago tarjeta cmr)', () => {
    const rows = parseRawStatementText(FALABELLA_SAMPLE, '2026-06');
    expect(rows.some((r) => /pago tarjeta/i.test(r.description))).toBe(false);
  });

  it('keeps decimals and digits inside descriptions (USD rows, store numbers)', () => {
    const rows = parseRawStatementText(FALABELLA_SAMPLE, '2026-06');

    expect(rows.find((r) => r.description === 'Claude.ai su CL USD 23,8')).toMatchObject({
      date: '2026-04-19',
      amount: 21443,
    });
    expect(rows.find((r) => r.description === 'Salcobrand huerfanos 9')).toMatchObject({ amount: 24845 });
  });

  it('parses fee rows without the T separator and ignores header noise with numbers', () => {
    const rows = parseRawStatementText(FALABELLA_SAMPLE, '2026-06');

    expect(rows.find((r) => r.description === 'Servicio administracion')).toMatchObject({ amount: 14142 });
    // "Cupon de Pago N°: 18.762.089.09" and "N° de Contrato" must not become rows
    expect(rows.some((r) => /cupon|contrato|titular/i.test(r.description))).toBe(false);
    expect(rows).toHaveLength(7);
  });

  it('produces all-negative expenses except the refund via toSnapshotRows', () => {
    const txs = toSnapshotRows(parseRawStatementText(FALABELLA_SAMPLE, '2026-06'), 'credit_card', 'falabella');

    const refund = txs.find((t) => t.description === 'Mercadopago *mercadol')!;
    expect(refund.amount).toBe(44990);
    expect(refund.transactionType).toBe('expense'); // positive expense = refund convention

    expect(txs.filter((t) => t.amount < 0)).toHaveLength(6);
  });
});

// Real-world sample: billed LiderBCI statement. " (T) " separator, $ amounts,
// Santander-style installment rows, subtotal lines and filler noise.
const LIDERBCI_SAMPLE = [
  '2. Período Actual',
  'Lugar',
  'Operación',
  'Descripción',
  'Operación',
  '1. Total Operaciones',
  'LIDER',
  'PUENTE ALTO 28/03/2026 HIPER PUENTE ALTO., PUENTE ALTO (T) $ 81.131',
  'SANTIAGO SCLCHL 29/03/2026 LIDER DOMICILIO VENTAS Y DISTRIBUCION L (T) $ 117.571',
  '$ 432.278',
  'OTROS COMERCIOS',
  'SANTIAGO SCLCHL 07/01/2026 LIDER DOMICILIO VENTAS 3,14% (T) $ 399.990 $ 486.480 03/12 $ 40.540',
  '$ 40.540',
  '3. Cargos / Comisiones, Impuestos / Abonos',
  '25/03/2026 PAGO $ -1.109.173',
  '$ -1.109.173',
  'Brelleno',
].join('\n');

describe('parseRawStatementText — billed statement (LiderBCI)', () => {
  it('parses regular rows, stripping the (T) marker from descriptions', () => {
    const rows = parseRawStatementText(LIDERBCI_SAMPLE, '2026-06');
    const hiper = rows.find((r) => r.description.startsWith('HIPER'))!;

    expect(hiper.description).toBe('HIPER PUENTE ALTO., PUENTE ALTO');
    expect(hiper.amount).toBe(81131);
    expect(hiper.date).toBe('2026-03-28');
  });

  it('extracts the valor cuota mensual from installment rows', () => {
    const rows = parseRawStatementText(LIDERBCI_SAMPLE, '2026-06');
    const cuota = rows.find((r) => r.installmentTotal === 12)!;

    expect(cuota.amount).toBe(40540); // NOT 399.990 nor 486.480
    expect(cuota.merchant).toBe('LIDER DOMICILIO VENTAS');
    expect(cuota.installmentNum).toBe(3);
    expect(cuota.date).toBe('2026-06-01');
  });

  it('drops the PAGO row and subtotal/filler lines', () => {
    const rows = parseRawStatementText(LIDERBCI_SAMPLE, '2026-06');

    expect(rows.some((r) => /^pago/i.test(r.description))).toBe(false);
    expect(rows.some((r) => /brelleno|lider$|otros comercios/i.test(r.description))).toBe(false);
    expect(rows).toHaveLength(3); // 2 regular + 1 cuota
  });

  it('produces negative expenses via toSnapshotRows', () => {
    const txs = toSnapshotRows(parseRawStatementText(LIDERBCI_SAMPLE, '2026-06'), 'credit_card', 'liderbci');
    expect(txs.every((t) => t.amount < 0 && t.transactionType === 'expense')).toBe(true);
    expect(txs.find((t) => t.merchant === 'LIDER DOMICILIO VENTAS')!.amount).toBe(-40540);
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
