import { anthropicClient } from './anthropic.client';
import type { RawParsedRow } from '@/src/infrastructure/parsers/snapshot-raw';

/**
 * AI fallback for the tracking (snapshot) paste flow: converts arbitrary
 * movement text — copied from any bank portal or app, in any layout — into
 * normalized rows. Used only when the deterministic parsers extract nothing.
 */
export class RawSnapshotParserService {
  async parse(
    rawText: string,
    source: 'checking' | 'credit_card',
    month: string, // "YYYY-MM" — anchors dates that lack a year
  ): Promise<RawParsedRow[]> {
    const year = month.split('-')[0];

    const sourceHint = source === 'credit_card'
      ? `This is a CREDIT CARD movement list: charges/purchases must be NEGATIVE; payments to the card (PAGO, ABONO) must be POSITIVE.`
      : `This is a CHECKING ACCOUNT movement list: debits/cargos must be NEGATIVE; credits/abonos (salary, received transfers) must be POSITIVE.`;

    const message = await anthropicClient.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      system: `You convert raw Chilean bank movement text (pasted from a web portal, app, or spreadsheet) into structured data.
Return ONLY a valid compact JSON array (no whitespace, no explanation, no markdown).
Each item: {"date":"YYYY-MM-DD","description":"merchant/description text","amount":number}

Rules:
- ${sourceHint}
- AMOUNTS: Chilean format uses periods as thousands separators — "$1.234.567" = 1234567. A comma is the decimal separator.
- Dates often appear only once per day; rows below inherit the last date seen.
- REFERENCE PERIOD: ${month}. If a date lacks a year, use ${year}.
- SKIP balance rows (SALDO INICIAL/FINAL/ANTERIOR), totals, subtotals, cupo lines, and table headers — they are not movements.
- Keep descriptions as-is (trimmed), do not translate or rewrite them.`,
      messages: [{ role: 'user', content: `Movement text:\n${rawText}` }],
    });

    const content = message.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response from Claude');

    const raw = content.text.trim();
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start === -1 || end === -1) {
      throw new Error(`Claude response missing JSON array. Response preview: ${raw.slice(0, 200)}`);
    }

    const parsed = JSON.parse(raw.slice(start, end + 1)) as { date: string; description: string; amount: number }[];

    return parsed
      .filter((r) => r && typeof r.amount === 'number' && /^\d{4}-\d{2}-\d{2}$/.test(r.date ?? '') && r.description)
      .map((r) => ({
        date: r.date,
        description: String(r.description).trim(),
        amount: r.amount,
        explicitSign: true, // the model already applied the sign convention
      }));
  }
}
