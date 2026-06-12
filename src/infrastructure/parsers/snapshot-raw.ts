import type { SnapshotTransaction } from '@/src/domain/entities/snapshot';
import { classifyCheckingType } from './snapshot-csv';

export type SnapshotRow = Pick<
  SnapshotTransaction,
  'id' | 'date' | 'description' | 'merchant' | 'amount' | 'transactionType' | 'source' | 'bank'
>;

/** A movement extracted from raw text, before categorization. */
export interface RawParsedRow {
  date: string;        // "YYYY-MM-DD"
  description: string;
  amount: number;      // signed: negative = cargo, positive = abono
  /** true when the source text carried an explicit +/- sign for the amount */
  explicitSign: boolean;
  /** Clean merchant name when it differs from description (installment rows). */
  merchant?: string;
  installmentNum?: number | null;
  installmentTotal?: number | null;
}

/** Rows that are balances/summaries, not real movements. */
const SKIP_PATTERNS = [
  /saldo\s+(inicial|final|anterior|contable|disponible)/i,
  /^total(es)?\b/i,
  /^subtotal\b/i,
  /monto\s+(facturado|cancelado|pagado|total|m[ií]nimo)/i,
  /cupo\s+(total|disponible|utilizado)/i,
  /^fecha\b/i,            // table header pasted along with the data
  /sin\s+movimientos/i,
  /total\s+operaciones/i, // "1. TOTAL OPERACIONES $ 2.332.942"
  /movimientos\s+tarjeta/i,
];

/** Credit-card payments (abonos a la tarjeta) — internal movements, not income. */
const CC_PAYMENT_PATTERNS = [
  /^pago\b/i,
  /pago\s+(recibido|pap|autom[aá]tico)/i,
  /abono\s+pago/i,
];

// Leading date: "11/06/2026", "11-06-2026", "12/02/26", "11/06" (year optional)
const DATE_RE = /^(\d{1,2})[/\-](\d{1,2})(?:[/\-](\d{2,4}))?\b/;
// Date anywhere in the line (after a "lugar de operación" prefix). Year is
// REQUIRED here so installment markers like "04/12" are never mistaken for dates.
const ANY_DATE_RE = /(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})\b/;
// Chilean money token with $: "-$19.989", "+$2.332.942", "$ 3.750", "$ -1.800.019"
const MONEY_RE = /([-+]?)\s*\$\s*([-+]?)\s*(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?)/g;
// Bare money token (Falabella billed statements have no $): "-849.300", "330.497", "0"
const BARE_MONEY_RE = /([-+]?)(\d{1,3}(?:\.\d{3})+|\d+)(,\d+)?/g;
// Installment marker "NN/TT" — guards reject date fragments like 22/04/26
const CUOTA_MARKER_RE = /(?<![/\d])(\d{1,2})\/(\d{1,2})(?![/\d])/;
// Falabella prints the billing month of the cuota: "abr-2026", "jun-2026"
const MONTH_YEAR_RE = /\b[a-záéíóúñ]{3,5}-\d{4}\b/gi;
// Column separator in billed statements: Falabella " T ", LiderBCI " (T) "
const T_MARKER_RE = /\s\(T\)\s|\sT\s/g;

interface MoneyToken { sign: string; num: string; index: number }

function toIsoDate(day: string, monthNum: string, year: string | undefined, fallbackYear: string): string {
  const y = year ? (year.length === 2 ? `20${year}` : year) : fallbackYear;
  return `${y}-${monthNum.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function parseChileanAmount(sign: string, num: string): number {
  const value = parseFloat(num.replace(/\./g, '').replace(',', '.'));
  return sign === '-' ? -value : value;
}

function extractDollarTokens(s: string): MoneyToken[] {
  return [...s.matchAll(MONEY_RE)].map((m) => ({ sign: m[1] || m[2], num: m[3], index: m.index! }));
}

/** Replace cuota markers and month-year tokens with '#' (same length, indices preserved). */
function maskNonAmountNumbers(s: string): string {
  const mask = (m: string) => '#'.repeat(m.length);
  return s
    .replace(MONTH_YEAR_RE, mask)
    .replace(new RegExp(CUOTA_MARKER_RE.source, 'g'), mask);
}

function extractBareTokens(s: string): MoneyToken[] {
  return [...maskNonAmountNumbers(s).matchAll(BARE_MONEY_RE)]
    .map((m) => ({ sign: m[1], num: `${m[2]}${m[3] ?? ''}`, index: m.index! }));
}

function findLastTMarker(s: string): { index: number; end: number } | null {
  let last: { index: number; end: number } | null = null;
  for (const m of s.matchAll(T_MARKER_RE)) last = { index: m.index!, end: m.index! + m[0].length };
  return last;
}

/**
 * Clean the merchant name of a billed-statement installment row, e.g.
 * "3094 SPARTA CONCEPT STORE N/CUOTAS PRECIO 0,00 %" → "SPARTA CONCEPT STORE"
 * "TICKETMASTER SANTANDER TC CUOTA FIJA 2,77 %"     → "TICKETMASTER"
 * "MACONLINE TOBALABA CUOTA COMERCIO 0,00 %"        → "MACONLINE TOBALABA"
 * "LIDER DOMICILIO VENTAS 3,14%"                    → "LIDER DOMICILIO VENTAS"
 */
function cleanInstallmentMerchant(desc: string): string {
  return desc
    .replace(/\s+\d+(?:,\d+)?\s*%/g, '')                                                          // interest rate
    .replace(/\s+(?:SANTANDER\s+TC\s+CUOTA|[NS]\/?\s?CUOTAS?|CUOTA\s+(?:FIJA|COMERCIO))\b.*$/i, '') // cuota descriptor + tail
    .replace(/^\d{3,5}\s+/, '')                                                                   // card/reference number
    .trim();
}

/**
 * Parse Santander (and similar) web-portal exports that arrive as tab-separated
 * text with two separate amount columns: "Monto cargo" and "Monto abono".
 *
 * Expected header (case-insensitive, tab-separated):
 *   Fecha   Tipo    Detalle   Monto cargo   Monto abono
 *
 * Cargo rows  → negative amount (expense).
 * Abono rows  → positive amount (income).
 * Date carry-forward: when the Fecha cell is empty, the previous date is reused.
 *
 * Returns [] when the text doesn't look like this format.
 */
export function parseSantanderPortalTab(text: string, fallbackYear: string): RawParsedRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // Header must have tabs and recognisable column names
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
    const n = parseFloat(s.replace(/[$.]/g, '').replace(',', '.'));
    return isNaN(n) ? 0 : Math.abs(n);
  };

  for (const line of lines.slice(headerIdx + 1)) {
    if (!line.includes('\t')) continue;
    const parts = line.split('\t');

    const dateStr   = (parts[dateCol]  ?? '').trim();
    const description = (parts[descCol] ?? '').trim();
    const cargoStr  = (parts[cargoCol] ?? '').trim();
    const abonoStr  = (parts[abonoCol] ?? '').trim();

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
 * Parse raw movement text pasted from a bank web portal OR copied from a
 * billed credit-card statement (estado de cuenta facturado).
 *
 * Portal format — signed $ amounts, date only on the first row of each day:
 *   11/06/2026   PAYU *UBER TR   -$19.989
 *   SERVICIOS Y COM   -$3.750
 *
 * Santander billed — regular rows carry a place prefix; installment rows
 * don't and end with "NN/TT $valor cuota":
 *   LAS CONDES 22/04/26 MERCADOPAGO*PRODUCTOSSANC $2.980
 *   12/02/26 3094 SPARTA CONCEPT STORE N/CUOTAS PRECIO 0,00 % $ 1.883.462 $ 1.883.462 04/12 $156.955
 *
 * Falabella billed — bare amounts (no $), " T " separator, every row has a
 * cuota marker (01/01 = simple purchase) and may carry a month-year token:
 *   Santiago 26/12/2025 Universidad mayor T 365.240 365.240 05/12 feb-2026 30.436
 *
 * LiderBCI billed — " (T) " separator, $ amounts, Santander-style cuotas:
 *   SANTIAGO SCLCHL 07/01/2026 LIDER DOMICILIO VENTAS 3,14% (T) $ 399.990 $ 486.480 03/12 $ 40.540
 *
 * Sign convention is detected per document: portal text signs every amount
 * (negative = charge); billed statements leave charges unsigned and mark
 * credits (refunds, payments) negative. In billed documents payment rows
 * (PAGO, PAGO TARJETA CMR) are dropped and refunds are flipped to positive.
 *
 * Installment rows (TT > 1) keep the ORIGINAL purchase date in the text, so
 * they are re-dated to the tracked month (`month`-01) and the purchase date
 * moves into the description. Informational 00/NN rows are skipped.
 *
 * Returns [] when the text doesn't look like any of these formats (caller can
 * then fall back to the AI parser).
 */
export function parseRawStatementText(text: string, month: string): RawParsedRow[] {
  const fallbackYear = month.slice(0, 4);
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const rows: RawParsedRow[] = [];
  let currentDate: string | null = null;

  for (const line of lines) {
    let rest = line;
    let rowDateRaw: string | null = null;

    const startMatch = DATE_RE.exec(rest);
    if (startMatch) {
      currentDate = toIsoDate(startMatch[1], startMatch[2], startMatch[3], fallbackYear);
      rowDateRaw = startMatch[0];
      rest = rest.slice(startMatch[0].length);
    } else {
      // Billed-statement rows: "LAS CONDES 22/04/26 MERCADO..." — drop the
      // place prefix and take the date mid-line.
      const anyMatch = ANY_DATE_RE.exec(rest);
      if (anyMatch) {
        currentDate = toIsoDate(anyMatch[1], anyMatch[2], anyMatch[3], fallbackYear);
        rowDateRaw = anyMatch[0];
        rest = rest.slice(anyMatch.index + anyMatch[0].length);
      }
    }

    let tokens: MoneyToken[];
    let descEnd: number;
    let amountsStart: number;

    if (rest.includes('$')) {
      tokens = extractDollarTokens(rest);
      if (tokens.length === 0) continue;
      descEnd = amountsStart = tokens[0].index;
    } else {
      // Bare amounts are ambiguous (any number qualifies), so they are only
      // accepted on lines that carry their own date — this rejects header
      // noise like "Cupon de Pago N°: 18.762.089.09".
      if (!rowDateRaw) continue;
      const marker = findLastTMarker(rest);
      if (marker) {
        const region = rest.slice(marker.end);
        tokens = extractBareTokens(region).map((t) => ({ ...t, index: t.index + marker.end }));
        descEnd = marker.index;
        amountsStart = marker.end;
      } else {
        tokens = extractBareTokens(rest);
        if (tokens.length === 0) continue;
        descEnd = amountsStart = tokens[0].index;
      }
      if (tokens.length === 0) continue;
    }

    const description = rest
      .slice(0, descEnd)
      .replace(/\s*\(T\)\s*$/, '')
      .replace(/[\t]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (!currentDate || !description) continue;
    if (SKIP_PATTERNS.some((re) => re.test(description))) continue;

    const amountTok = tokens[tokens.length - 1];
    const row: RawParsedRow = {
      date: currentDate,
      description,
      amount: parseChileanAmount(amountTok.sign, amountTok.num),
      explicitSign: amountTok.sign === '-' || amountTok.sign === '+',
    };

    // Installment marker in the amounts section ("04/12", "03/03", "01/01")
    const cuota = CUOTA_MARKER_RE.exec(rest.slice(amountsStart));
    if (cuota) {
      const num   = parseInt(cuota[1], 10);
      const total = parseInt(cuota[2], 10);
      if (num === 0) continue; // informational "compra en cuotas del período" — not a real charge yet
      if (total > 1) {
        const merchant = cleanInstallmentMerchant(description);
        row.merchant         = merchant;
        row.description      = `${merchant} (cuota ${cuota[1]}/${cuota[2]}${rowDateRaw ? ` · compra ${rowDateRaw}` : ''})`;
        row.installmentNum   = num;
        row.installmentTotal = total;
        // The cuota charge belongs to the tracked month, not the original purchase date
        row.date = `${month}-01`;
      }
      // total === 1 → simple purchase billed as "01/01"; keep date/description as-is
    }

    rows.push(row);
  }

  // ── Document-level sign convention ──────────────────────────────────────
  // Portal text signs every amount (negative = charge). Billed statements
  // leave charges unsigned and mark credits negative; there, payment rows are
  // internal movements (dropped) and remaining negatives are refunds (abonos).
  const signedCount = rows.filter((r) => r.explicitSign).length;
  const isBilledDoc = rows.length > 0 && signedCount <= rows.length / 2;
  if (isBilledDoc) {
    return rows
      .filter((r) => !CC_PAYMENT_PATTERNS.some((re) => re.test(r.description)))
      .map((r) => (r.amount < 0 ? { ...r, amount: Math.abs(r.amount), explicitSign: true } : r));
  }
  return rows;
}

/**
 * Apply sign conventions and transaction-type classification, producing the
 * same row shape as parseCsvSnapshot. Shared by the deterministic raw parser
 * and the AI fallback.
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
        // Payment to the card — internal movement, excluded from expenses/income
        transactionType = 'transfer';
      } else {
        // Unsigned credit-card amounts are charges (same convention as the CSV parser);
        // explicitly positive non-payment amounts are refunds (positive expense).
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
    };
  });
}
