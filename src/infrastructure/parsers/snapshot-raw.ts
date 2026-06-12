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
  /monto\s+(facturado|cancelado|pagado|total)/i,
  /cupo\s+(total|disponible|utilizado)/i,
  /^fecha\b/i, // table header pasted along with the data
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
// Chilean money token: "-$19.989", "+$2.332.942", "$ 3.750", "$ -1.800.019"
const MONEY_RE = /([-+]?)\s*\$\s*([-+]?)\s*(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?)/g;
// Installment marker between the last two money tokens: "04/12"
const INSTALLMENT_RE = /^\s*(\d{1,2})\/(\d{1,2})\s*$/;

function toIsoDate(day: string, monthNum: string, year: string | undefined, fallbackYear: string): string {
  const y = year ? (year.length === 2 ? `20${year}` : year) : fallbackYear;
  return `${y}-${monthNum.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function parseChileanAmount(sign: string, num: string): number {
  const value = parseFloat(num.replace(/\./g, '').replace(',', '.'));
  return sign === '-' ? -value : value;
}

/**
 * Clean the merchant name of a billed-statement installment row, e.g.
 * "3094 SPARTA CONCEPT STORE N/CUOTAS PRECIO 0,00 %" → "SPARTA CONCEPT STORE"
 * "TICKETMASTER SANTANDER TC CUOTA FIJA 2,77 %"     → "TICKETMASTER"
 */
function cleanInstallmentMerchant(desc: string): string {
  return desc
    .replace(/\s+\d+(?:,\d+)?\s*%/g, '')                                               // interest rate
    .replace(/\s+(?:SANTANDER\s+TC\s+CUOTA|[NS]\/?\s?CUOTAS?|CUOTA\s+FIJA)\b.*$/i, '') // cuota descriptor + tail
    .replace(/^\d{3,5}\s+/, '')                                                        // card/reference number
    .trim();
}

/**
 * Parse raw movement text pasted from a bank web portal OR copied from a
 * billed credit-card statement (estado de cuenta facturado).
 *
 * Portal format — date only on the first row of each day, rows inherit it:
 *   11/06/2026   PAYU *UBER TR   -$19.989
 *   SERVICIOS Y COM   -$3.750
 *
 * Billed statement format (Santander) — regular rows carry a "lugar de
 * operación" prefix before the date; installment rows don't, and end with
 * the cuota marker + monthly installment value:
 *   LAS CONDES 22/04/26 MERCADOPAGO*PRODUCTOSSANC $2.980
 *   12/02/26 3094 SPARTA CONCEPT STORE N/CUOTAS PRECIO 0,00 % $ 1.883.462 $ 1.883.462 04/12 $156.955
 *
 * Installment rows keep the ORIGINAL purchase date in the text, so they are
 * re-dated to the tracked month (`month`-01) and the purchase date moves into
 * the description. Informational 00/NN rows are skipped (not real charges).
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

    const moneyMatches = [...rest.matchAll(MONEY_RE)];
    if (moneyMatches.length === 0) continue;
    // Amount = last money token; description ends at the first one
    // (installment rows carry monto operación + monto total before it).
    const amountTok = moneyMatches[moneyMatches.length - 1];
    const firstTok  = moneyMatches[0];

    let description = rest
      .slice(0, firstTok.index)
      .replace(/[\t]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (!currentDate || !description) continue;
    if (SKIP_PATTERNS.some((re) => re.test(description))) continue;

    const sign = amountTok[1] || amountTok[2];
    const row: RawParsedRow = {
      date: currentDate,
      description,
      amount: parseChileanAmount(sign, amountTok[3]),
      explicitSign: sign === '-' || sign === '+',
    };

    // Installment row? — "NN/TT" sits between the last two money tokens.
    if (moneyMatches.length >= 2) {
      const prevTok = moneyMatches[moneyMatches.length - 2];
      const between = rest.slice(prevTok.index! + prevTok[0].length, amountTok.index);
      const cuota   = INSTALLMENT_RE.exec(between);
      if (cuota) {
        const num   = parseInt(cuota[1], 10);
        const total = parseInt(cuota[2], 10);
        if (num === 0) continue; // informational "compra en cuotas del período" — not a real charge yet

        const merchant = cleanInstallmentMerchant(description);
        row.merchant         = merchant;
        row.description      = `${merchant} (cuota ${cuota[1]}/${cuota[2]}${rowDateRaw ? ` · compra ${rowDateRaw}` : ''})`;
        row.installmentNum   = num;
        row.installmentTotal = total;
        // The charge belongs to the tracked month, not the original purchase date
        row.date = `${month}-01`;
      }
    }

    rows.push(row);
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
