'use server';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { categoryRepo, transactionRepo, merchantRuleRepo, budgetRepo, rawSnapshotParser, trackingUploadRepo } from '@/src/infrastructure/container';
import { normalizeMerchant } from '@/src/domain/entities/merchant-rule';
import { parseCsvSnapshot } from '@/src/infrastructure/parsers/snapshot-csv';
import { parseRawStatementText, parseSantanderPortalTab, parseSantanderPortalTabNoHeader, parseFalabellaPortalTab, toSnapshotRows } from '@/src/infrastructure/parsers/snapshot-raw';
import type { SnapshotRow } from '@/src/infrastructure/parsers/snapshot-raw';
import type { SnapshotTransaction } from '@/src/domain/entities/snapshot';
import type { CreateTransactionInput } from '@/src/domain/entities/transaction';
import { computeSnapshotMetrics } from '@/src/lib/snapshot-metrics';
import { txToSnapshot } from '@/src/lib/snapshot-utils';

// ─── Auto-categorize rows ─────────────────────────────────────────────────────

type RuleEntry = { categoryId: string; transactionType?: string | null };
type CategorizedRow = SnapshotRow & { hasRule: boolean; categoryId: string; categoryName: string };

function categorizeTxs(
  rows: SnapshotRow[],
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

    // Parse: CSV → Santander portal tab (with/without header) → Falabella portal tab → raw bank text → AI fallback
    let rawRows = parseCsvSnapshot(text, sourceType, bank);
    if (rawRows.length === 0) {
      const tabRows = parseSantanderPortalTab(text, month.slice(0, 4));
      if (tabRows.length > 0) rawRows = toSnapshotRows(tabRows, sourceType, bank);
    }
    if (rawRows.length === 0) {
      const noHeaderRows = parseSantanderPortalTabNoHeader(text, month.slice(0, 4));
      if (noHeaderRows.length > 0) rawRows = toSnapshotRows(noHeaderRows, sourceType, bank);
    }
    if (rawRows.length === 0) {
      const falRows = parseFalabellaPortalTab(text);
      if (falRows.length > 0) rawRows = toSnapshotRows(falRows, sourceType, bank);
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

    // Replace previous tracking data for this bank+sourceType+month only — other
    // months tracked for the same bank/account must stay untouched.
    // Delete the upload records first — FK cascade removes their transactions.
    // Also call deleteManyTracking to catch any legacy rows without a trackingUploadId.
    await Promise.all([
      trackingUploadRepo.deleteByMonth(userId, month, bank, sourceType),
      transactionRepo.deleteManyTracking(userId, month, bank, sourceType),
    ]);

    // Cross-month duplicate check: a pasted range can bleed into an adjacent
    // accounting month already tracked separately (e.g. re-pasting the portal
    // history overlaps days already saved under last month's upload). Duplicate
    // identity is (date + amount + description) — the accounting month must
    // never be part of the match, or rows legitimately belonging to another
    // month would never be recognized as already-saved.
    const existingTracking = await transactionRepo.findByUserId(userId, {
      bank, accountType: sourceType, origin: 'tracking',
    });
    const existingKeys = new Set(
      existingTracking.map((t) => `${t.date.toISOString().slice(0, 10)}|${t.amount}|${t.description}`),
    );
    const newRows = unique.filter((tx) => !existingKeys.has(`${tx.date}|${tx.amount}|${tx.description}`));

    // Create the upload record first to get its ID for linking
    const upload = await trackingUploadRepo.create({
      userId,
      bank,
      accountType: sourceType,
      month,
      rowCount: newRows.length,
    });

    // Persist as real Transaction records linked to this upload
    const inputs: CreateTransactionInput[] = newRows.map((tx) => ({
      userId,
      categoryId:       tx.categoryId,
      date:             new Date(`${tx.date}T12:00:00.000Z`),
      description:      tx.description,
      merchant:         tx.merchant,
      amount:           tx.amount,
      currency:         'CLP',
      bank,
      accountType:      sourceType,
      origin:           'tracking',
      accountingMonth:  month,
      trackingUploadId: upload.id,
      reviewStatus:     tx.hasRule ? 'auto' : 'pending',
      transactionType:  tx.transactionType,
      isInstallment:    (tx.installmentTotal ?? 1) > 1,
      installmentNum:   tx.installmentNum   ?? null,
      installmentTotal: tx.installmentTotal ?? null,
    }));

    await transactionRepo.createManyAndReturn(inputs);

    // Build response — show all tracking for the selected month
    const [allTracking, uploads] = await Promise.all([
      transactionRepo.findTrackingByMonth(userId, month),
      trackingUploadRepo.findByUserId(userId, month),
    ]);
    const allSnapshot = allTracking.map((tx) => txToSnapshot(tx, categoryNameMap));
    const checkingTxs = allSnapshot.filter((t) => t.source === 'checking');
    const ccTxs       = allSnapshot.filter((t) => t.source === 'credit_card');

    const budgetMap = new Map(budgets.map((b) => [b.categoryId, b.monthlyAmount]));
    const metrics   = computeSnapshotMetrics(allSnapshot, budgetMap, month);

    const skipped = categorized.length - newRows.length;
    return NextResponse.json({ month, checkingTxs, ccTxs, metrics, uploads, ...(skipped > 0 ? { duplicatesSkipped: skipped } : {}) });
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

  const [txs, categories, budgets, uploads] = await Promise.all([
    transactionRepo.findTrackingByMonth(userId, month),
    categoryRepo.findByUserId(userId),
    budgetRepo.findByUserId(userId, month),
    trackingUploadRepo.findByUserId(userId, month),
  ]);

  if (txs.length === 0 && uploads.length === 0) return NextResponse.json(null);

  const categoryNameMap = new Map(categories.map((c) => [c.id, c.name]));
  const allSnapshot     = txs.map((tx) => txToSnapshot(tx, categoryNameMap));
  const checkingTxs     = allSnapshot.filter((t) => t.source === 'checking');
  const ccTxs           = allSnapshot.filter((t) => t.source === 'credit_card');

  const budgetMap = new Map(budgets.map((b) => [b.categoryId, b.monthlyAmount]));
  const metrics   = computeSnapshotMetrics(allSnapshot, budgetMap, month);

  return NextResponse.json({ month, checkingTxs, ccTxs, metrics, uploads });
}
