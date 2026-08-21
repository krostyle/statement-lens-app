import { describe, it, expect } from 'vitest';
import { parseFalabellaEstadoCuenta, parseSantanderCCCartola, parseSantanderPortalTab, toSnapshotRows } from './snapshot-raw';

// ─── Falabella TC — Excel/portal tab-separated ────────────────────────────────

const FAL_HEADER = 'FECHA\tDESCRIPCION\tTITULAR/ADICIONAL\tMONTO\tCUOTAS PENDIENTES\tVALOR CUOTA';

const FAL_SAMPLE = [
  FAL_HEADER,
  '19-07-2026\tCOMPRA FALABELLA.COM\tAdicional\t$50.961\t0\t$50.961',
  '29-06-2026\tCOMPRA EN CUOTAS MERCADOPAGO *IVETASPA\tAdicional\t$72.766\t5\t$13.715',
  '28-06-2026\tCOMPRA EN CUOTAS SODIMAC HC Puente Alto\tAdicional\t$84.870\t2\t$30.453',
  '26-06-2026\tPAGO TARJETA CMR\tTitular\t$1.146.950\t0\t-$1.146.950',
].join('\n');

describe('parseFalabellaEstadoCuenta', () => {
  it('parses regular purchase with zero cuotas', () => {
    const rows = parseFalabellaEstadoCuenta(FAL_SAMPLE);
    const row = rows.find((r) => r.merchant === 'COMPRA FALABELLA.COM' && r.date === '2026-07-19')!;

    expect(row).toMatchObject({
      date: '2026-07-19',
      description: 'COMPRA FALABELLA.COM',
      merchant: 'COMPRA FALABELLA.COM',
      amount: -50961,
      explicitSign: true,
    });
    expect(row.installmentTotal).toBeUndefined();
  });

  it('marks installment when cuotas pendientes > 0 and uses VALOR CUOTA as amount', () => {
    const rows = parseFalabellaEstadoCuenta(FAL_SAMPLE);
    const row = rows.find((r) => r.merchant === 'COMPRA EN CUOTAS MERCADOPAGO *IVETASPA')!;

    expect(row.amount).toBe(-13715); // VALOR CUOTA, not MONTO
    expect(row.installmentTotal).toBe(6); // cuotas + 1
    expect(row.description).toContain('5 cuotas pendientes');
    expect(row.merchant).toBe('COMPRA EN CUOTAS MERCADOPAGO *IVETASPA'); // merchant is clean (no "(X cuotas)")
  });

  it('parses payment row (negative VALOR CUOTA) as positive amount', () => {
    const rows = parseFalabellaEstadoCuenta(FAL_SAMPLE);
    const pago = rows.find((r) => r.description === 'PAGO TARJETA CMR')!;

    expect(pago.amount).toBe(1146950);
    expect(pago.explicitSign).toBe(true);
  });

  it('handles amounts with multiple thousands separators', () => {
    const rows = parseFalabellaEstadoCuenta(FAL_SAMPLE);
    const pago = rows.find((r) => r.description === 'PAGO TARJETA CMR')!;
    expect(pago.amount).toBe(1146950);
  });

  it('returns [] when header is missing or wrong format', () => {
    expect(parseFalabellaEstadoCuenta('FECHA\tDESCRIPCION\tMONTO\n01-01-2026\tFoo\t$100')).toEqual([]);
    expect(parseFalabellaEstadoCuenta('no hay nada aqui')).toEqual([]);
    expect(parseFalabellaEstadoCuenta('')).toEqual([]);
  });

  it('produces correct toSnapshotRows output for credit_card', () => {
    const txs = toSnapshotRows(parseFalabellaEstadoCuenta(FAL_SAMPLE), 'credit_card', 'falabella');

    const compra = txs.find((t) => t.merchant === 'COMPRA FALABELLA.COM' && t.date === '2026-07-19')!;
    expect(compra.amount).toBe(-50961);
    expect(compra.transactionType).toBe('expense');
    expect(compra.source).toBe('credit_card');
    expect(compra.bank).toBe('falabella');

    const pago = txs.find((t) => t.description === 'PAGO TARJETA CMR')!;
    expect(pago.amount).toBe(1146950);
    expect(pago.transactionType).toBe('transfer');

    const cuota = txs.find((t) => t.merchant === 'COMPRA EN CUOTAS MERCADOPAGO *IVETASPA')!;
    expect(cuota.amount).toBe(-13715);
    expect((cuota.installmentTotal ?? 1) > 1).toBe(true);
  });
});

// ─── Santander TC — portal copy-paste, dates con año, continuation rows ───────

const SAN_TC_SAMPLE = [
  'Fecha\tTipo\tDetalle\tMonto cargo\tMonto abono\t',
  '25/07/2026\t\tFASIL MARKET\t-$19.190\t\t',
  '24/07/2026\t\tDELIVERY DEL SO\t-$40.710\t\t',
  'PAYU *UBER TR\t-$2.581\t\t',
  '23/07/2026\t\tUBER RIDES UBER\t-$2.196\t\t',
  'PAYU *UBER TR\t-$2.010\t\t',
  'EKONO CIUDAD DEL SOL\t-$39.242\t\t',
  'SALDO INICIAL\t-$1.539.308\t\t',
].join('\n');

describe('parseSantanderPortalTab — TC (tarjeta de crédito)', () => {
  it('parses dated rows correctly', () => {
    const rows = parseSantanderPortalTab(SAN_TC_SAMPLE, '2026');

    expect(rows.find((r) => r.description === 'FASIL MARKET')).toMatchObject({
      date: '2026-07-25',
      amount: -19190,
      explicitSign: true,
    });
    expect(rows.find((r) => r.description === 'DELIVERY DEL SO')).toMatchObject({
      date: '2026-07-24',
      amount: -40710,
    });
  });

  it('continuation rows inherit the previous date', () => {
    const rows = parseSantanderPortalTab(SAN_TC_SAMPLE, '2026');

    const payu1 = rows.filter((r) => r.description === 'PAYU *UBER TR')[0];
    expect(payu1.date).toBe('2026-07-24'); // inherits from DELIVERY DEL SO row

    const ekono = rows.find((r) => r.description === 'EKONO CIUDAD DEL SOL')!;
    expect(ekono.date).toBe('2026-07-23');
    expect(ekono.amount).toBe(-39242);
  });

  it('skips SALDO INICIAL and other balance rows', () => {
    const rows = parseSantanderPortalTab(SAN_TC_SAMPLE, '2026');
    expect(rows.some((r) => /saldo/i.test(r.description))).toBe(false);
  });

  it('returns the expected row count', () => {
    const rows = parseSantanderPortalTab(SAN_TC_SAMPLE, '2026');
    expect(rows).toHaveLength(6); // 3 dated + 3 continuation; SALDO INICIAL skipped
  });

  it('returns [] when header is missing', () => {
    expect(parseSantanderPortalTab('25/07/2026\tFASIL MARKET\t-$19.190', '2026')).toEqual([]);
  });

  it('produces expense rows via toSnapshotRows for credit_card', () => {
    const txs = toSnapshotRows(parseSantanderPortalTab(SAN_TC_SAMPLE, '2026'), 'credit_card', 'santander');
    expect(txs.every((t) => t.transactionType === 'expense')).toBe(true);
    expect(txs.every((t) => t.amount < 0)).toBe(true);
  });
});

// ─── Santander CC — portal copy-paste, fechas sin año, columna Saldo ─────────

const SAN_CC_SAMPLE = [
  'Fecha\tTipo\tDetalle\tMonto cargo\tMonto abono\tSaldo\t',
  '27/07\t\t0200476123 TRANSF A MARCELO FERNANDEZ BARBERO\t-$15.000\t\t$365.012\t',
  '20/07\t\t0233520314 TRANSF DE CRISTOPHER ALEXIS J\t\t+$19.000\t$410.012\t',
  '26/06\t\t076042014K REMUNERACION WALMART CHI\t\t+$3.335.364\t$3.658.441\t',
  '13/07\t\tTraspaso Internet a Línea Crédito\t-$27.988\t\t$168.712\t',
  '08/07\t\tPAGO CUOTA CREDITO CONSUMO N° 650051370478\t-$199.757\t\t$19.661\t',
].join('\n');

describe('parseSantanderPortalTab — CC (cuenta corriente)', () => {
  it('parses cargo row without year using fallback', () => {
    const rows = parseSantanderPortalTab(SAN_CC_SAMPLE, '2026');
    const row = rows.find((r) => r.description.includes('MARCELO FERNANDEZ'))!;

    expect(row.date).toBe('2026-07-27');
    expect(row.amount).toBe(-15000);
  });

  it('parses abono row as positive amount', () => {
    const rows = parseSantanderPortalTab(SAN_CC_SAMPLE, '2026');
    const row = rows.find((r) => r.description.includes('CRISTOPHER ALEXIS'))!;

    expect(row.date).toBe('2026-07-20');
    expect(row.amount).toBe(19000);
  });

  it('parses large amounts with multiple thousands separators', () => {
    const rows = parseSantanderPortalTab(SAN_CC_SAMPLE, '2026');
    const remuneracion = rows.find((r) => r.description.includes('REMUNERACION'))!;

    expect(remuneracion.date).toBe('2026-06-26');
    expect(remuneracion.amount).toBe(3335364);
  });

  it('classifies transfers and income/expense correctly via toSnapshotRows', () => {
    const txs = toSnapshotRows(parseSantanderPortalTab(SAN_CC_SAMPLE, '2026'), 'checking', 'santander');

    const remuneracion = txs.find((t) => t.description.includes('REMUNERACION'))!;
    expect(remuneracion.transactionType).toBe('income');

    const transf = txs.find((t) => t.description.includes('MARCELO FERNANDEZ'))!;
    expect(transf.transactionType).toBe('expense');

    const linea = txs.find((t) => t.description.includes('Línea Crédito'))!;
    expect(linea.transactionType).toBe('transfer');

    const pago = txs.find((t) => t.description.includes('PAGO CUOTA CREDITO'))!;
    expect(pago.transactionType).toBe('transfer');
  });
});

// ─── Santander CC Cartola — tabla portal con CHEQUES Y OTROS CARGOS ──────────

const SAN_CC_CARTOLA = [
  'FECHA\tSUCURSAL\tDESCRIPCIÓN\tN° DOCUMENTO\tCHEQUES Y OTROS CARGOS\tDEPOSITOS Y OTROS ABONOS\tSALDO',
  '06/07\tAgustinas\t0187620899 Transf. DIEGO BUSTAMANTE ALBARRAN\t1010157\t\t$200.000\t$219.575',
  '07/07\tAgustinas\t0761872877 Transf a khipu CLBS D\t\t$30.157\t\t$189.418',
  '08/07\tAgustinas\tPago Cuota Crédito Consumo N° 650051370478\t\t$199.757\t\t',
  '08/07\tOPER. CENT\tTraspaso con la Cuenta N° 001016850736\t\t\t$27.988\t',
  '30/07\tG.Finanzas\t076042014K REMUNERACION    WALMART CHI\t\t\t$2.536.213\t',
  '30/07\tAgustinas\tTraspaso Internet a T. Crédito\t\t$1.539.308\t\t',
].join('\n');

describe('parseSantanderCCCartola', () => {
  it('parses abono row (DEPOSITOS) as positive amount', () => {
    const rows = parseSantanderCCCartola(SAN_CC_CARTOLA, '2026');
    const row = rows.find((r) => r.description.includes('DIEGO BUSTAMANTE'))!;

    expect(row.date).toBe('2026-07-06');
    expect(row.amount).toBe(200000);
    expect(row.explicitSign).toBe(true);
  });

  it('parses cargo row (CHEQUES) as negative amount', () => {
    const rows = parseSantanderCCCartola(SAN_CC_CARTOLA, '2026');
    const row = rows.find((r) => r.description.includes('khipu CLBS'))!;

    expect(row.date).toBe('2026-07-07');
    expect(row.amount).toBe(-30157);
  });

  it('handles amounts with multiple thousands separators', () => {
    const rows = parseSantanderCCCartola(SAN_CC_CARTOLA, '2026');
    const remuneracion = rows.find((r) => r.description.includes('REMUNERACION'))!;

    expect(remuneracion.amount).toBe(2536213);
  });

  it('uses fallbackYear for dates without year', () => {
    const rows = parseSantanderCCCartola(SAN_CC_CARTOLA, '2026');
    expect(rows.every((r) => r.date.startsWith('2026-'))).toBe(true);
  });

  it('returns correct row count (no header, no empty-amount rows)', () => {
    const rows = parseSantanderCCCartola(SAN_CC_CARTOLA, '2026');
    expect(rows).toHaveLength(6);
  });

  it('returns [] when header is missing or wrong format', () => {
    expect(parseSantanderCCCartola('FECHA\tDESCRIPCIÓN\tMONTO\n06/07\tFoo\t$100', '2026')).toEqual([]);
    expect(parseSantanderCCCartola('no hay nada aqui', '2026')).toEqual([]);
  });

  it('classifies types correctly via toSnapshotRows for checking', () => {
    const txs = toSnapshotRows(parseSantanderCCCartola(SAN_CC_CARTOLA, '2026'), 'checking', 'santander');

    const remuneracion = txs.find((t) => t.description.includes('REMUNERACION'))!;
    expect(remuneracion.transactionType).toBe('income');

    const traspaso = txs.find((t) => t.description.includes('T. Crédito'))!;
    expect(traspaso.transactionType).toBe('transfer');

    const pago = txs.find((t) => t.description.includes('Pago Cuota'))!;
    expect(pago.transactionType).toBe('transfer');

    expect(txs.every((t) => t.source === 'checking')).toBe(true);
    expect(txs.every((t) => t.bank === 'santander')).toBe(true);
  });
});

// ─── toSnapshotRows ───────────────────────────────────────────────────────────

describe('toSnapshotRows', () => {
  it('assigns id, source and bank to every row', () => {
    const rows = toSnapshotRows(
      [{ date: '2026-07-01', description: 'UBER', amount: -5000, explicitSign: true }],
      'credit_card',
      'falabella',
    );
    expect(rows[0].id).toBeTruthy();
    expect(rows[0].source).toBe('credit_card');
    expect(rows[0].bank).toBe('falabella');
  });

  it('negates unsigned credit-card amounts (unsigned = charge)', () => {
    const rows = toSnapshotRows(
      [{ date: '2026-06-05', description: 'FASIL MARKET', amount: 17990, explicitSign: false }],
      'credit_card',
      'santander',
    );
    expect(rows[0].amount).toBe(-17990);
    expect(rows[0].transactionType).toBe('expense');
  });

  it('passes null for installment fields when absent', () => {
    const rows = toSnapshotRows(
      [{ date: '2026-07-01', description: 'UBER', amount: -5000, explicitSign: true }],
      'checking',
      'santander',
    );
    expect(rows[0].installmentNum).toBeNull();
    expect(rows[0].installmentTotal).toBeNull();
  });
});
