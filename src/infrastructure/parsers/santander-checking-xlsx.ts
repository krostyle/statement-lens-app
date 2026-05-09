import { read, utils } from 'xlsx';

export interface RawCheckingRow {
  date: string;        // "YYYY-MM-DD"
  description: string;
  amount: number;      // negative = cargo/debit, positive = abono/credit
  transactionType: 'expense' | 'income' | 'transfer';
}

/** Patterns that indicate an internal transfer (not a real expense). */
const TRANSFER_PATTERNS = [
  /pago\s+tar/i,
  /pag\.?\s*tar/i,
  /pago\s+tarj/i,
  /trf\s+a\s+yo\b/i,
  /transf\.?\s+a\s+yo\b/i,
  /a\s+mi\s+mismo/i,
  /\byo\s+cta\b/i,
  /transferencia\s+a\s+mi\b/i,
];

function classifyType(detalle: string, amount: number): RawCheckingRow['transactionType'] {
  if (TRANSFER_PATTERNS.some((re) => re.test(detalle))) return 'transfer';
  return amount >= 0 ? 'income' : 'expense';
}

/** Parse a Chilean numeric string — "$ 7.000" or "7.000" → 7000 */
function parseCLP(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const str = String(raw).replace(/\$/g, '').replace(/\s/g, '').replace(/\./g, '');
  const n = parseFloat(str.replace(',', '.'));
  return isNaN(n) ? null : n;
}

/** Parse a Santander cuenta corriente XLSX export. */
export function parseSantanderCheckingXlsx(buffer: Buffer): RawCheckingRow[] {
  const wb = read(buffer, { type: 'buffer', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows = utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });

  // Locate the header row — it contains "Fecha" in one of its cells
  let headerIdx = -1;
  let colFecha = -1;
  let colDetalle = -1;
  let colCargo = -1;
  let colAbono = -1;

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i] as unknown[];
    const lower = row.map((c) => String(c).toLowerCase().trim());
    const fechaCol = lower.findIndex((c) => c === 'fecha');
    if (fechaCol !== -1) {
      headerIdx = i;
      colFecha   = fechaCol;
      colDetalle = lower.findIndex((c) => c === 'detalle');
      colCargo   = lower.findIndex((c) => c.includes('cargo'));
      colAbono   = lower.findIndex((c) => c.includes('abono'));
      break;
    }
  }

  if (headerIdx === -1) return [];

  const rows: RawCheckingRow[] = [];

  for (let i = headerIdx + 1; i < rawRows.length; i++) {
    const row = rawRows[i] as unknown[];

    // Date cell — xlsx may return a Date object or a string "DD-MM-YYYY"
    const rawDate = row[colFecha];
    let dateStr = '';
    if (rawDate instanceof Date) {
      const yyyy = rawDate.getFullYear();
      const mm   = String(rawDate.getMonth() + 1).padStart(2, '0');
      const dd   = String(rawDate.getDate()).padStart(2, '0');
      dateStr = `${yyyy}-${mm}-${dd}`;
    } else {
      const s = String(rawDate ?? '').trim();
      // "DD-MM-YYYY" → "YYYY-MM-DD"
      const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
      if (m) dateStr = `${m[3]}-${m[2]}-${m[1]}`;
    }
    if (!dateStr) continue;

    const detalle = String(colDetalle >= 0 ? (row[colDetalle] ?? '') : '').trim();
    if (!detalle) continue;

    const cargo  = colCargo  >= 0 ? parseCLP(row[colCargo])  : null;
    const abono  = colAbono  >= 0 ? parseCLP(row[colAbono])  : null;

    // Skip rows with no monetary movement (e.g., opening balance lines)
    if ((cargo === null || cargo === 0) && (abono === null || abono === 0)) continue;

    // Net amount: abono positive, cargo negative
    const amount = (abono && abono > 0) ? abono : -(cargo ?? 0);

    rows.push({
      date: dateStr,
      description: detalle,
      amount,
      transactionType: classifyType(detalle, amount),
    });
  }

  return rows;
}
