import { describe, it, expect } from 'vitest';
import { parseCsvSnapshot, classifyCheckingType } from './snapshot-csv';

describe('classifyCheckingType', () => {
  it('classifies a positive amount as income by default', () => {
    expect(classifyCheckingType('DEPOSITO SUELDO', 500000)).toBe('income');
  });

  it('classifies a negative amount as expense by default', () => {
    expect(classifyCheckingType('COMPRA SUPERMERCADO', -15000)).toBe('expense');
  });

  it('classifies credit card payments as transfer', () => {
    expect(classifyCheckingType('PAGO TARJETA CREDITO', -100000)).toBe('transfer');
  });

  it('classifies credit line movements as transfer', () => {
    expect(classifyCheckingType('LINEA DE CREDITO USO', -50000)).toBe('transfer');
  });

  it('classifies own-account transfers as transfer', () => {
    expect(classifyCheckingType('TRASPASO CON LA CUENTA N°1234', -30000)).toBe('transfer');
  });
});

describe('parseCsvSnapshot', () => {
  const HEADER = 'date,description,amount';

  it('returns an empty array when there is no header row', () => {
    const rows = parseCsvSnapshot('2026-05-08,DELIVERY,31430', 'credit_card', 'santander');
    expect(rows).toEqual([]);
  });

  it('returns an empty array when there are fewer than 2 lines', () => {
    expect(parseCsvSnapshot(HEADER, 'credit_card', 'santander')).toEqual([]);
    expect(parseCsvSnapshot('', 'credit_card', 'santander')).toEqual([]);
  });

  it('negates credit_card amounts (always expense) regardless of CSV sign', () => {
    const csv = [HEADER, '2026-05-08,DELIVERY DEL SO,31430'].join('\n');
    const [row] = parseCsvSnapshot(csv, 'credit_card', 'santander');

    expect(row.amount).toBe(-31430);
    expect(row.transactionType).toBe('expense');
    expect(row.date).toBe('2026-05-08');
    expect(row.merchant).toBe('DELIVERY DEL SO');
    expect(row.bank).toBe('santander');
    expect(row.source).toBe('credit_card');
    expect(row.id).toBeTruthy();
  });

  it('preserves the signed amount for checking accounts and classifies the type', () => {
    const csv = [HEADER, '2026-05-08,DEPOSITO SUELDO,500000', '2026-05-09,COMPRA VARIOS,-12000'].join('\n');
    const rows = parseCsvSnapshot(csv, 'checking', 'falabella');

    expect(rows[0]).toMatchObject({ amount: 500000, transactionType: 'income' });
    expect(rows[1]).toMatchObject({ amount: -12000, transactionType: 'expense' });
  });

  it('parses CLP-formatted amounts with thousands separators', () => {
    const csv = [HEADER, '2026-05-08,COMPRA GRANDE,$1.234.567'].join('\n');
    const [row] = parseCsvSnapshot(csv, 'credit_card', 'santander');

    expect(row.amount).toBe(-1234567);
  });

  it('skips rows with an invalid date format', () => {
    const csv = [HEADER, '08/05/2026,DELIVERY,31430'].join('\n');
    expect(parseCsvSnapshot(csv, 'credit_card', 'santander')).toEqual([]);
  });

  it('skips rows with a non-numeric amount', () => {
    const csv = [HEADER, '2026-05-08,DELIVERY,not-a-number'].join('\n');
    expect(parseCsvSnapshot(csv, 'credit_card', 'santander')).toEqual([]);
  });

  it('skips rows missing a field', () => {
    const csv = [HEADER, '2026-05-08,,31430'].join('\n');
    expect(parseCsvSnapshot(csv, 'credit_card', 'santander')).toEqual([]);
  });

  it('skips a row when the description contains a comma (only date,description,amount is supported)', () => {
    const csv = [HEADER, '2026-05-08,COMPRA, CON COMA,31430'].join('\n');
    expect(parseCsvSnapshot(csv, 'credit_card', 'santander')).toEqual([]);
  });
});
