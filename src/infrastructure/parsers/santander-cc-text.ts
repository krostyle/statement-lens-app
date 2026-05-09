export interface RawCCRow {
  date: string;        // "YYYY-MM-DD"
  description: string;
  amount: number;      // negative = expense, positive = payment/credit
  skip?: boolean;      // true = row should be excluded (balance snapshot, card payment)
}

/**
 * Parses Santander credit card TSV text (copy-pasted from the bank website).
 *
 * Format per line (tab-separated):
 *   [DD/MM/YYYY] \t [empty] \t [description] \t [-$amount] \t [empty]
 *
 * The date only appears on the first row of each day; subsequent rows on the
 * same day have an empty first column — carry-forward the last seen date.
 */
export function parseSantanderCCText(text: string): RawCCRow[] {
  const rows: RawCCRow[] = [];
  let currentDate = '';

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const cols = line.split('\t').map((c) => c.trim());

    // Try to parse a date from the first column
    const maybeDate = cols[0] ?? '';
    const dateMatch = maybeDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (dateMatch) {
      const [, dd, mm, yyyy] = dateMatch;
      currentDate = `${yyyy}-${mm}-${dd}`;
    }

    if (!currentDate) continue; // skip rows before the first date

    // Find the description and amount columns — the amount cell contains "$"
    // Layout can be: [date?] [empty?] [description] [amount] [empty?]
    // We search all columns for the amount (contains "$") and take the one
    // immediately before it as description.
    let description = '';
    let amount: number | null = null;

    for (let i = 0; i < cols.length; i++) {
      const raw = cols[i];
      if (!raw.includes('$')) continue;

      // Parse Chilean amount: "-$31.430" or "$31.430" → integer
      const cleaned = raw.replace(/\$/g, '').replace(/\./g, '').replace(/\s/g, '');
      const parsed = parseInt(cleaned, 10);
      if (isNaN(parsed)) continue;

      amount = parsed;
      // Description is the last non-empty column before this one
      for (let j = i - 1; j >= 0; j--) {
        if (cols[j] && !/^\d{2}\/\d{2}\/\d{4}$/.test(cols[j])) {
          description = cols[j];
          break;
        }
      }
      break;
    }

    if (amount === null || !description) continue;

    const descUpper = description.toUpperCase();
    // "SALDO INICIAL" is a balance snapshot (not a transaction) — skip entirely.
    // "PAGO" is a credit card payment — also skip (already counted as a transfer
    // in the checking account statement; including it here would double-count).
    if (descUpper === 'SALDO INICIAL' || descUpper === 'PAGO') continue;

    rows.push({ date: currentDate, description, amount });
  }

  return rows;
}
