import type { SnapshotTransaction } from '@/src/domain/entities/snapshot';
import { classifyCheckingType } from './snapshot-csv';

export type SnapshotRow = Pick<
  SnapshotTransaction,
  'id' | 'date' | 'description' | 'merchant' | 'amount' | 'transactionType' | 'source' | 'bank'
> & {
  installmentNum?: number | null;
  installmentTotal?: number | null;
  isAdditional?: boolean;
};

export interface RawParsedRow {
  date: string;        // "YYYY-MM-DD"
  description: string;
  amount: number;      // signed: negative = cargo, positive = abono
  explicitSign: boolean;
  merchant?: string;
  installmentNum?: number | null;
  installmentTotal?: number | null;
  isAdditional?: boolean;
}

const SKIP_PATTERNS = [
  /saldo\s+(inicial|final|anterior|contable|disponible)/i,
  /^total(es)?\b/i,
  /^subtotal\b/i,
  /monto\s+(facturado|cancelado|pagado|total|m[ií]nimo)/i,
  /cupo\s+(total|disponible|utilizado)/i,
  /^fecha\b/i,
  /sin\s+movimientos/i,
  /total\s+operaciones/i,
  /movimientos\s+tarjeta/i,
];

const CC_PAYMENT_PATTERNS = [
  /^pago\b/i,
  /pago\s+(recibido|pap|autom[aá]tico)/i,
  /abono\s+pago/i,
];

// Leading date: "11/06/2026", "11-06-2026", "12/02/26", "27/07" (year optional)
const DATE_RE = /^(\d{1,2})[/\-](\d{1,2})(?:[/\-](\d{2,4}))?\b/;

function toIsoDate(day: string, monthNum: string, year: string | undefined, fallbackYear: string): string {
  const y = year ? (year.length === 2 ? `20${year}` : year) : fallbackYear;
  return `${y}-${monthNum.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Parse Falabella CMR portal exports (Excel copy-paste, tab-separated).
 *
 * Expected header (tab-separated, case-insensitive):
 *   FECHA  DESCRIPCION  TITULAR/ADICIONAL  MONTO  CUOTAS PENDIENTES  VALOR CUOTA
 *
 * Amount convention:
 *   Positive VALOR CUOTA → purchase (cargo) → stored as negative (expense).
 *   Negative VALOR CUOTA → payment (PAGO TARJETA CMR) → stored as positive (transfer).
 *
 * Installments: CUOTAS PENDIENTES > 0 → marks as installment and appends
 *   "(N cuotas pendientes)" to the description.
 *
 * Returns [] when the text doesn't match this format.
 */
export function parseFalabellaEstadoCuenta(text: string): RawParsedRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headerIdx = lines.findIndex(
    (l) =>
      l.includes('\t') &&
      /\bfecha\b/i.test(l) &&
      /\bdescripci[oó]n\b/i.test(l) &&
      /cuotas\s+pendientes/i.test(l) &&
      /valor\s+cuota/i.test(l),
  );
  if (headerIdx === -1) return [];

  const headers        = lines[headerIdx].split('\t').map((h) => h.trim().toLowerCase());
  const dateCol        = headers.findIndex((h) => /^fecha$/.test(h));
  const descCol        = headers.findIndex((h) => /^descripci[oó]n$/.test(h));
  const cuotasCol      = headers.findIndex((h) => /cuotas\s+pendientes/.test(h));
  const valorCuotaCol  = headers.findIndex((h) => /valor\s+cuota/.test(h));
  const cardHolderCol  = headers.findIndex((h) => /titular/i.test(h)); // TITULAR/ADICIONAL column
  if (dateCol === -1 || descCol === -1 || cuotasCol === -1 || valorCuotaCol === -1) return [];

  const parseAmt = (s: string): number => {
    const clean = s.trim().replace(/\s/g, '');
    if (!clean) return NaN;
    const neg = clean.startsWith('-');
    const abs = parseFloat(
      clean.replace(/^-/, '').replace('$', '').replace(/\./g, '').replace(',', '.'),
    );
    return isNaN(abs) ? NaN : neg ? -abs : abs;
  };

  const rows: RawParsedRow[] = [];

  for (const line of lines.slice(headerIdx + 1)) {
    if (!line.includes('\t')) continue;
    const parts = line.split('\t');

    const dateStr       = (parts[dateCol]       ?? '').trim();
    const desc          = (parts[descCol]        ?? '').trim();
    const cuotasStr     = (parts[cuotasCol]      ?? '').trim();
    const valorCuotaStr = (parts[valorCuotaCol]  ?? '').trim();
    const cardHolder    = cardHolderCol !== -1 ? (parts[cardHolderCol] ?? '').trim() : '';
    const isAdditional  = /^adicional$/i.test(cardHolder);

    if (!desc || !dateStr) continue;
    if (SKIP_PATTERNS.some((re) => re.test(desc))) continue;

    // Date: DD-MM-YYYY → YYYY-MM-DD
    const dm = /^(\d{1,2})-(\d{1,2})-(\d{2,4})$/.exec(dateStr);
    if (!dm) continue;
    const date = `${dm[3].length === 2 ? `20${dm[3]}` : dm[3]}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}`;

    const parsedAmt = parseAmt(valorCuotaStr);
    if (isNaN(parsedAmt) || parsedAmt === 0) continue;

    // Positive VALOR CUOTA = cargo → negative in our system; negative = payment → positive
    const amount = -parsedAmt;

    const cuotas = parseInt(cuotasStr, 10);
    const hasInstallments = !isNaN(cuotas) && cuotas > 0;
    const installmentTotal = hasInstallments ? cuotas + 1 : undefined;

    rows.push({
      date,
      description: desc,
      merchant: desc,
      amount,
      explicitSign: true,
      ...(hasInstallments ? { installmentTotal } : {}),
      ...(isAdditional ? { isAdditional: true } : {}),
    });
  }

  return rows;
}

/**
 * Parse Santander portal exports copied from the web (tab-separated).
 * Handles both TC (tarjeta de crédito) and CC (cuenta corriente).
 *
 * Expected header (case-insensitive, tab-separated):
 *   Fecha   Tipo   Detalle   Monto cargo   Monto abono   [Saldo]
 *
 * TC dates carry the full year (25/07/2026); CC dates omit the year (27/07)
 * and the fallbackYear is used instead.
 *
 * Continuation rows (TC): Santander drops the Fecha AND Tipo cells entirely,
 * shifting every later column 2 positions left. The shift is detected by
 * checking whether the leading cell looks like a date.
 *
 * Cargo rows  → negative amount (expense).
 * Abono rows  → positive amount (income / transfer).
 *
 * Returns [] when the text doesn't look like this format.
 */
export function parseSantanderPortalTab(text: string, fallbackYear: string): RawParsedRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const headerIdx = lines.findIndex(
    (l) =>
      l.includes('\t') &&
      /fecha/i.test(l) &&
      /detalle/i.test(l) &&
      /cargo/i.test(l) &&
      /abono/i.test(l),
  );
  if (headerIdx === -1) return [];

  const headers = lines[headerIdx].split('\t').map((h) => h.trim().toLowerCase());
  const dateCol  = headers.findIndex((h) => h === 'fecha');
  const descCol  = headers.findIndex((h) => /detalle/i.test(h));
  const cargoCol = headers.findIndex((h) => /cargo/i.test(h));
  const abonoCol = headers.findIndex((h) => /abono/i.test(h));
  if (dateCol === -1 || descCol === -1 || cargoCol === -1 || abonoCol === -1) return [];

  const rows: RawParsedRow[] = [];
  let currentDate: string | null = null;

  const parseAmt = (s: string): number => {
    if (!s || s === '-') return 0;
    const n = parseFloat(s.replace(/[$.+]/g, '').replace(',', '.'));
    return isNaN(n) ? 0 : Math.abs(n);
  };

  for (const line of lines.slice(headerIdx + 1)) {
    if (!line.includes('\t')) continue;
    const parts = line.split('\t');

    // Continuation rows (TC only): Fecha + Tipo are dropped entirely, shifting
    // Detalle/Cargo/Abono 2 positions left. Detect by checking the leading cell.
    const leadingLooksLikeDate = DATE_RE.test((parts[dateCol] ?? '').trim());
    const shift = leadingLooksLikeDate ? 0 : 2;

    const dateStr     = leadingLooksLikeDate ? (parts[dateCol] ?? '').trim() : '';
    const description = (parts[descCol  - shift] ?? '').trim();
    const cargoStr    = (parts[cargoCol - shift] ?? '').trim();
    const abonoStr    = (parts[abonoCol - shift] ?? '').trim();

    if (!description) continue;
    if (SKIP_PATTERNS.some((re) => re.test(description))) continue;

    if (dateStr) {
      const m = DATE_RE.exec(dateStr);
      if (m) currentDate = toIsoDate(m[1], m[2], m[3], fallbackYear);
    }
    if (!currentDate) continue;

    const cargo = parseAmt(cargoStr);
    const abono = parseAmt(abonoStr);
    if (cargo === 0 && abono === 0) continue;

    rows.push({
      date: currentDate,
      description,
      amount: cargo > 0 ? -cargo : abono,
      explicitSign: true,
    });
  }

  return rows;
}

/**
 * Parse Santander cartola CC (cuenta corriente) exported from the web portal
 * as a tab-separated table (paste from browser).
 *
 * Expected header (tab-separated, case-insensitive):
 *   FECHA  SUCURSAL  DESCRIPCIÓN  N° DOCUMENTO  CHEQUES Y OTROS CARGOS  DEPOSITOS Y OTROS ABONOS  SALDO
 *
 * Date format: DD/MM (no year) → fallbackYear is used.
 * Cargo  (col 4) > 0 → expense → stored as negative.
 * Abono  (col 5) > 0 → income  → stored as positive.
 *
 * Returns [] when the text doesn't match this format.
 */
export function parseSantanderCCCartola(text: string, fallbackYear: string): RawParsedRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headerIdx = lines.findIndex(
    (l) =>
      l.includes('\t') &&
      /fecha/i.test(l) &&
      /cheques\s+y\s+otros\s+cargos/i.test(l) &&
      /dep[oó]sitos\s+y\s+otros\s+abonos/i.test(l),
  );
  if (headerIdx === -1) return [];

  const headers  = lines[headerIdx].split('\t').map((h) => h.trim().toLowerCase());
  const dateCol  = headers.findIndex((h) => /^fecha$/.test(h));
  const descCol  = headers.findIndex((h) => /^descripci[oó]n$/.test(h));
  const cargoCol = headers.findIndex((h) => /cheques\s+y\s+otros\s+cargos/i.test(h));
  const abonoCol = headers.findIndex((h) => /dep[oó]sitos\s+y\s+otros\s+abonos/i.test(h));
  if (dateCol === -1 || descCol === -1 || cargoCol === -1 || abonoCol === -1) return [];

  const parseAmt = (s: string): number => {
    if (!s || s === '-' || s === '0') return 0;
    const n = parseFloat(s.replace(/[$.\s]/g, '').replace(',', '.'));
    return isNaN(n) ? 0 : Math.abs(n);
  };

  const rows: RawParsedRow[] = [];

  for (const line of lines.slice(headerIdx + 1)) {
    if (!line.includes('\t')) continue;
    const parts = line.split('\t');

    const dateStr     = (parts[dateCol]  ?? '').trim();
    const description = (parts[descCol]  ?? '').trim();
    const cargoStr    = (parts[cargoCol] ?? '').trim();
    const abonoStr    = (parts[abonoCol] ?? '').trim();

    if (!description || !dateStr) continue;
    if (SKIP_PATTERNS.some((re) => re.test(description))) continue;

    const m = DATE_RE.exec(dateStr);
    if (!m) continue;
    const date = toIsoDate(m[1], m[2], m[3], fallbackYear);

    const cargo = parseAmt(cargoStr);
    const abono = parseAmt(abonoStr);
    if (cargo === 0 && abono === 0) continue;

    rows.push({
      date,
      description,
      amount: cargo > 0 ? -cargo : abono,
      explicitSign: true,
    });
  }

  return rows;
}

/**
 * Apply sign conventions and transaction-type classification, producing the
 * same row shape used throughout the app. Shared by both parsers.
 */
export function toSnapshotRows(
  rows: RawParsedRow[],
  source: 'checking' | 'credit_card',
  bank: string,
): SnapshotRow[] {
  return rows.map((row) => {
    let amount = row.amount;
    let transactionType: 'expense' | 'income' | 'transfer';

    if (source === 'credit_card') {
      if (amount > 0 && row.explicitSign && CC_PAYMENT_PATTERNS.some((re) => re.test(row.description))) {
        transactionType = 'transfer';
      } else {
        if (!row.explicitSign) amount = -Math.abs(amount);
        transactionType = 'expense';
      }
    } else {
      transactionType = classifyCheckingType(row.description, amount);
    }

    return {
      id: crypto.randomUUID(),
      date: row.date,
      description: row.description,
      merchant: row.merchant ?? row.description,
      amount,
      transactionType,
      source,
      bank,
      installmentNum:   row.installmentNum   ?? null,
      installmentTotal: row.installmentTotal ?? null,
      ...(row.isAdditional ? { isAdditional: true } : {}),
    };
  });
}
