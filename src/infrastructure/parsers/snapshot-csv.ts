import type { SnapshotTransaction } from '@/src/domain/entities/snapshot';

/** Patterns that indicate an internal transfer (credit card payment, credit line, own-account). */
const TRANSFER_PATTERNS = [
  // Credit card payments
  /pago\s+tar/i,
  /pag\.?\s*tar/i,
  /pago\s+tarj/i,
  /\bpago\s+tc\b/i,
  /\bpag\.?\s*tc\b/i,
  // Credit line transfers (línea de crédito — draw and repayment)
  /linea\s+(de\s+)?cred/i,
  /l[íi]nea\s+cred/i,
  /uso\s+lin/i,
  /pago\s+lin/i,
  /\bl\s*de\s*cr/i,
  /cred\.?\s*hipot/i,
  // Own-account transfers
  /trf\s+a\s+yo\b/i,
  /transf\.?\s+a\s+yo\b/i,
  /a\s+mi\s+mismo/i,
  /\byo\s+cta\b/i,
  /transferencia\s+a\s+mi\b/i,
];

function classifyCheckingType(description: string, amount: number): 'expense' | 'income' | 'transfer' {
  if (TRANSFER_PATTERNS.some((re) => re.test(description))) return 'transfer';
  return amount >= 0 ? 'income' : 'expense';
}

/**
 * Parse a universal CSV snapshot file into SnapshotTransaction records.
 *
 * Expected format (header required):
 *   date,description,amount
 *   2026-05-08,DELIVERY DEL SO,31430
 *
 * Sign convention by source:
 *   credit_card — amounts in CSV are positive for expenses; parser negates them. All are 'expense'.
 *   checking    — amounts are signed in CSV (negative = debit, positive = credit).
 *                 transactionType inferred from description patterns.
 */
export function parseCsvSnapshot(
  text: string,
  source: 'checking' | 'credit_card',
  bank: string,
): Pick<SnapshotTransaction, 'id' | 'date' | 'description' | 'merchant' | 'amount' | 'transactionType' | 'source' | 'bank'>[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  // Find header row
  const headerIdx = lines.findIndex((l) => /date.*description.*amount/i.test(l));
  if (headerIdx === -1) return [];

  const dataLines = lines.slice(headerIdx + 1);
  const results: Pick<SnapshotTransaction, 'id' | 'date' | 'description' | 'merchant' | 'amount' | 'transactionType' | 'source' | 'bank'>[] = [];

  for (const line of dataLines) {
    // Split on first two commas only so description can contain commas
    const firstComma = line.indexOf(',');
    if (firstComma === -1) continue;
    const secondComma = line.indexOf(',', firstComma + 1);
    if (secondComma === -1) continue;

    const dateRaw   = line.slice(0, firstComma).trim();
    const desc      = line.slice(firstComma + 1, secondComma).trim();
    const amountRaw = line.slice(secondComma + 1).trim();

    if (!dateRaw || !desc || !amountRaw) continue;

    // Validate date format YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) continue;

    // Parse amount — strip currency symbols, spaces, thousands separators (dots in CLP)
    const cleaned = amountRaw.replace(/[$\s]/g, '').replace(/\./g, '').replace(',', '.');
    const rawValue = parseFloat(cleaned);
    if (isNaN(rawValue)) continue;

    let amount: number;
    let transactionType: 'expense' | 'income' | 'transfer';

    if (source === 'credit_card') {
      // CC: positive in file = expense; negate so stored amount is negative
      amount = -Math.abs(rawValue);
      transactionType = 'expense';
    } else {
      // Checking: sign is preserved; classify based on description patterns
      amount = rawValue;
      transactionType = classifyCheckingType(desc, amount);
    }

    results.push({
      id:              crypto.randomUUID(),
      date:            dateRaw,
      description:     desc,
      merchant:        desc,
      amount,
      transactionType,
      source,
      bank,
    });
  }

  return results;
}
