export interface RawCCRow {
  date: string;        // "YYYY-MM-DD"
  description: string;
  amount: number;      // negative = expense
}

/**
 * Parses Santander credit card CSV exported from the app or web.
 *
 * Expected format (header required):
 *   date,description,amount
 *   2026-05-08,DELIVERY DEL SO,31430
 *
 * Amount is always a positive integer in the file; we negate it (expense).
 * Description field may be Title Case (mobile) or UPPERCASE (desktop) — both accepted.
 */
export function parseSantanderCCCsv(text: string): RawCCRow[] {
  const rows: RawCCRow[] = [];

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    // Skip the header row
    if (/^date[,;]/i.test(line)) continue;

    // Split on comma — amount is the last field, description is everything in between
    const parts = line.split(',');
    if (parts.length < 3) continue;

    const date       = parts[0].trim();
    const amountStr  = parts[parts.length - 1].trim();
    const description = parts.slice(1, parts.length - 1).join(',').trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (!description) continue;

    const parsed = parseInt(amountStr.replace(/[^\d]/g, ''), 10);
    if (isNaN(parsed) || parsed === 0) continue;

    rows.push({ date, description, amount: -Math.abs(parsed) });
  }

  return rows;
}
