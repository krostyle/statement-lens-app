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

// Leading date: "11/06/2026", "11-06-2026", "11/06" (year optional)
const DATE_RE = /^(\d{1,2})[/\-](\d{1,2})(?:[/\-](\d{2,4}))?\b/;
// Chilean money token: "-$19.989", "+$2.332.942", "$ 3.750", "-$1.234,56"
const MONEY_RE = /([-+]?)\s*\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?)/g;

function toIsoDate(day: string, monthNum: string, year: string | undefined, fallbackYear: string): string {
  const y = year ? (year.length === 2 ? `20${year}` : year) : fallbackYear;
  return `${y}-${monthNum.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function parseChileanAmount(sign: string, num: string): number {
  const value = parseFloat(num.replace(/\./g, '').replace(',', '.'));
  return sign === '-' ? -value : value;
}

/**
 * Parse raw movement text pasted directly from a bank web portal.
 *
 * Handles the typical copy-paste shape where the date appears only on the
 * first row of each day and following rows inherit it:
 *
 *   11/06/2026   PAYU *UBER TR   -$19.989
 *   SERVICIOS Y COM   -$3.750
 *   PAGO      +$2.332.942
 *
 * Returns [] when the text doesn't look like this format (caller can then
 * fall back to the AI parser).
 */
export function parseRawStatementText(text: string, month: string): RawParsedRow[] {
  const fallbackYear = month.slice(0, 4);
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const rows: RawParsedRow[] = [];
  let currentDate: string | null = null;

  for (const line of lines) {
    let rest = line;

    const dateMatch = DATE_RE.exec(rest);
    if (dateMatch) {
      currentDate = toIsoDate(dateMatch[1], dateMatch[2], dateMatch[3], fallbackYear);
      rest = rest.slice(dateMatch[0].length);
    }

    // Amount = last money token on the line (descriptions may contain digits)
    const moneyMatches = [...rest.matchAll(MONEY_RE)];
    if (moneyMatches.length === 0) continue;
    const money = moneyMatches[moneyMatches.length - 1];

    const description = rest
      .slice(0, money.index)
      .replace(/[\t]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (!currentDate || !description) continue;
    if (SKIP_PATTERNS.some((re) => re.test(description))) continue;

    rows.push({
      date: currentDate,
      description,
      amount: parseChileanAmount(money[1], money[2]),
      explicitSign: money[1] === '-' || money[1] === '+',
    });
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
      merchant: row.description,
      amount,
      transactionType,
      source,
      bank,
    };
  });
}
