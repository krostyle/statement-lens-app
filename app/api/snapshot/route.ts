'use server';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { categoryRepo, transactionRepo, merchantRuleRepo, budgetRepo, rawSnapshotParser } from '@/src/infrastructure/container';
import { normalizeMerchant } from '@/src/domain/entities/merchant-rule';
import { parseCsvSnapshot } from '@/src/infrastructure/parsers/snapshot-csv';
import { parseRawStatementText, parseSantanderPortalTab, toSnapshotRows } from '@/src/infrastructure/parsers/snapshot-raw';
import type { SnapshotTransaction } from '@/src/domain/entities/snapshot';
import type { CreateTransactionInput } from '@/src/domain/entities/transaction';
import { computeSnapshotMetrics } from '@/src/lib/snapshot-metrics';
import { txToSnapshot } from '@/src/lib/snapshot-utils';

// ─── Auto-categorize rows ─────────────────────────────────────────────────────

type RuleEntry = { categoryId: string; transactionType?: string | null };
type CategorizedRow = SnapshotTransaction & { hasRule: boolean };

function categorizeTxs(
  rows: Pick<SnapshotTransaction, 'id' | 'date' | 'description' | 'merchant' | 'amount' | 'transactionType' | 'source' | 'bank'>[],
  bankRuleMap: Map<string, RuleEntry>,
  wildcardRuleMap: Map<string, RuleEntry>,
  categoryNameMap: Map<string, string>,
  defaultCategoryId: string,
  bank: string,
): CategorizedRow[] {
  return rows.map((row) => {
    const pattern    = normalizeMerchant(row.description);
    const ruleEntry  = bankRuleMap.get(`${pattern}|${bank}`) ?? wildcardRuleMap.get(pattern);
    const categoryId = ruleEntry?.categoryId ?? defaultCategoryId;
    const categoryName = categoryNameMap.get(categoryId) ?? 'Otros';
    const transactionType = (ruleEntry?.transactionType as SnapshotTransaction['transactionType'] | undefined | null) ?? row.transactionType;
    return { ...row, categoryId, categoryName, transactionType, hasRule: !!ruleEntry };
  });
}

// ─── POST — upload + parse + persist as Transaction records ───────────────────

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData   = await request.formData();
    const month      = (formData.get('month') as string | null)?.trim();
    const bank       = (formData.get('bank') as string | null)?.trim();
    const sourceType = (formData.get('sourceType') as string | null)?.trim() as 'checking' | 'credit_card' | null;
    const csvText    = (formData.get('csvText') as string | null)?.trim();
    const csvFile    = formData.get('csvFile') as File | null;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'month requerido (YYYY-MM)' }, { status: 400 });
    }
    if (!bank) {
      return NextResponse.json({ error: 'bank es requerido' }, { status: 400 });
    }
    if (!sourceType || !['checking', 'credit_card'].includes(sourceType)) {
      return NextResponse.json({ error: 'sourceType debe ser "checking" o "credit_card"' }, { status: 400 });
    }
    if (!csvText && (!csvFile || csvFile.size === 0)) {
      return NextResponse.json({ error: 'Debes pegar texto CSV o subir un archivo .csv' }, { status: 400 });
    }

    const [categories, merchantRules, budgets] = await Promise.all([
      categoryRepo.findByUserId(userId),
      merchantRuleRepo.findByUserId(userId),
      budgetRepo.findByUserId(userId, month),
    ]);

    const categoryNameMap   = new Map(categories.map((c) => [c.id, c.name]));
    const defaultCategoryId = categories.find((c) => c.name === 'Otros')?.id ?? categories[0]?.id ?? '';
    const bankRuleMap       = new Map<string, RuleEntry>();
    const wildcardRuleMap   = new Map<string, RuleEntry>();
    for (const rule of merchantRules) {
      const entry: RuleEntry = { categoryId: rule.categoryId, transactionType: rule.transactionType };
      rule.bank
        ? bankRuleMap.set(`${rule.merchantPattern}|${rule.bank}`, entry)
        : wildcardRuleMap.set(rule.merchantPattern, entry);
    }

    // Resolve text
    let text = csvText ?? '';
    if (!text && csvFile && csvFile.size > 0) text = await csvFile.text();

    // Parse: CSV → Santander portal tab → raw bank text → AI fallback
    let rawRows = parseCsvSnapshot(text, sourceType, bank);
    if (rawRows.length === 0) {
      const tabRows = parseSantanderPortalTab(text, month.slice(0, 4));
      if (tabRows.length > 0) rawRows = toSnapshotRows(tabRows, sourceType, bank);
    }
    if (rawRows.length === 0) {
      rawRows = toSnapshotRows(parseRawStatementText(text, month), sourceType, bank);
    }
    if (rawRows.length === 0) {
      rawRows = toSnapshotRows(await rawSnapshotParser.parse(text, sourceType, month), sourceType, bank);
    }
    if (rawRows.length === 0) {
      return NextResponse.json(
        { error: 'No se reconocieron movimientos en el texto. Revisa el formato e inténtalo de nuevo.' },
        { status: 400 },
      );
    }

    const categorized = categorizeTxs(rawRows, bankRuleMap, wildcardRuleMap, categoryNameMap, defaultCategoryId, bank);

    // Deduplicate within the uploaded batch by (date + amount + description).
    // Handles copy-paste noise where the same row appears twice in the pasted text.
    const seen = new Set<string>();
    const unique = categorized.filter((tx) => {
      const key = `${tx.date}|${tx.amount}|${tx.description}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Replace ALL previous tracking data for this bank+sourceType (no month filter).
    // This avoids cross-month duplicates: portal data often spans billing cycles
    // (e.g. May 25 – Jun 11 uploaded as "June"), and re-uploading must replace
    // the full prior copy regardless of which months its rows fall in.
    await transactionRepo.deleteManyTracking(userId, undefined, bank, sourceType);

    // Persist as real Transaction records
    const inputs: CreateTransactionInput[] = unique.map((tx) => ({
      userId,
      categoryId:      tx.categoryId,
      date:            new Date(`${tx.date}T12:00:00.000Z`),
      description:     tx.description,
      merchant:        tx.merchant,
      amount:          tx.amount,
      currency:        'CLP',
      bank,
      accountType:     sourceType,
      origin:          'tracking',
      accountingMonth: month,
      reviewStatus:    tx.hasRule ? 'auto' : 'pending',
      transactionType: tx.transactionType,
      isInstallment:   false,
      installmentNum:  null,
      installmentTotal: null,
    }));

    await transactionRepo.createManyAndReturn(inputs);

    // Build response — show all tracking for the selected month
    const allTracking = await transactionRepo.findTrackingByMonth(userId, month);
    const allSnapshot = allTracking.map((tx) => txToSnapshot(tx, categoryNameMap));
    const checkingTxs = allSnapshot.filter((t) => t.source === 'checking');
    const ccTxs       = allSnapshot.filter((t) => t.source === 'credit_card');

    const budgetMap = new Map(budgets.map((b) => [b.categoryId, b.monthlyAmount]));
    const metrics   = computeSnapshotMetrics(allSnapshot, budgetMap, month);

    const skipped = categorized.length - unique.length;
    return NextResponse.json({ month, checkingTxs, ccTxs, metrics, ...(skipped > 0 ? { duplicatesSkipped: skipped } : {}) });
  } catch (err) {
    console.error('[POST /api/snapshot]', err);
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── GET — fetch tracking transactions for a month ────────────────────────────

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7);

  const [txs, categories, budgets] = await Promise.all([
    transactionRepo.findTrackingByMonth(userId, month),
    categoryRepo.findByUserId(userId),
    budgetRepo.findByUserId(userId, month),
  ]);

  if (txs.length === 0) return NextResponse.json(null);

  const categoryNameMap = new Map(categories.map((c) => [c.id, c.name]));
  const allSnapshot     = txs.map((tx) => txToSnapshot(tx, categoryNameMap));
  const checkingTxs     = allSnapshot.filter((t) => t.source === 'checking');
  const ccTxs           = allSnapshot.filter((t) => t.source === 'credit_card');

  const budgetMap = new Map(budgets.map((b) => [b.categoryId, b.monthlyAmount]));
  const metrics   = computeSnapshotMetrics(allSnapshot, budgetMap, month);

  return NextResponse.json({ month, checkingTxs, ccTxs, metrics });
}
