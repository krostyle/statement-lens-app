import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { categoryRepo, merchantRuleRepo, snapshotRepo, budgetRepo } from '@/src/infrastructure/container';
import { normalizeMerchant } from '@/src/domain/entities/merchant-rule';
import { parseCsvSnapshot } from '@/src/infrastructure/parsers/snapshot-csv';
import type { SnapshotTransaction } from '@/src/domain/entities/snapshot';
import { computeSnapshotMetrics } from '@/src/lib/snapshot-metrics';

// ─── Auto-categorize rows ─────────────────────────────────────────────────────

function categorizeTxs(
  rows: Pick<SnapshotTransaction, 'id' | 'date' | 'description' | 'merchant' | 'amount' | 'transactionType' | 'source' | 'bank'>[],
  bankRuleMap: Map<string, string>,
  wildcardRuleMap: Map<string, string>,
  categoryNameMap: Map<string, string>,
  defaultCategoryId: string,
  bank: string,
): SnapshotTransaction[] {
  return rows.map((row) => {
    const pattern = normalizeMerchant(row.description);
    const categoryId =
      bankRuleMap.get(`${pattern}|${bank}`) ??
      wildcardRuleMap.get(pattern) ??
      defaultCategoryId;
    const categoryName = categoryNameMap.get(categoryId) ?? 'Otros';
    return { ...row, categoryId, categoryName };
  });
}

// ─── POST — upload + parse + upsert ───────────────────────────────────────────

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
    const bankRuleMap       = new Map<string, string>();
    const wildcardRuleMap   = new Map<string, string>();
    for (const rule of merchantRules) {
      rule.bank
        ? bankRuleMap.set(`${rule.merchantPattern}|${rule.bank}`, rule.categoryId)
        : wildcardRuleMap.set(rule.merchantPattern, rule.categoryId);
    }

    // Resolve CSV text
    let text = csvText ?? '';
    if (!text && csvFile && csvFile.size > 0) {
      text = await csvFile.text();
    }

    // Parse CSV
    const rawRows = parseCsvSnapshot(text, sourceType, bank);
    const newTxs  = categorizeTxs(rawRows, bankRuleMap, wildcardRuleMap, categoryNameMap, defaultCategoryId, bank);

    // Merge: replace existing rows of same bank+source, keep others
    const existing = await snapshotRepo.findByUserAndMonth(userId, month);

    const mergeArray = (
      existing: SnapshotTransaction[] | null,
      incoming: SnapshotTransaction[],
    ): SnapshotTransaction[] => {
      const kept = (existing ?? []).filter(
        (t) => !((t.bank || 'santander') === bank && t.source === sourceType),
      );
      return [...kept, ...incoming];
    };

    const finalCheckingTxs = sourceType === 'checking'
      ? mergeArray(existing?.checkingTxs ?? null, newTxs)
      : (existing?.checkingTxs ?? null);

    const finalCCTxs = sourceType === 'credit_card'
      ? mergeArray(existing?.ccTxs ?? null, newTxs)
      : (existing?.ccTxs ?? null);

    await snapshotRepo.upsert(userId, month, finalCheckingTxs, finalCCTxs);

    const allTxs    = [...(finalCheckingTxs ?? []), ...(finalCCTxs ?? [])];
    const budgetMap = new Map(budgets.map((b) => [b.categoryId, b.monthlyAmount]));
    const metrics   = computeSnapshotMetrics(allTxs, budgetMap, month);

    return NextResponse.json({
      month,
      checkingTxs: finalCheckingTxs ?? [],
      ccTxs:       finalCCTxs       ?? [],
      metrics,
    });
  } catch (err) {
    console.error('[POST /api/snapshot]', err);
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── GET — fetch existing snapshot + metrics ──────────────────────────────────

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7);

  const [snapshot, budgets] = await Promise.all([
    snapshotRepo.findByUserAndMonth(userId, month),
    budgetRepo.findByUserId(userId, month),
  ]);

  if (!snapshot) return NextResponse.json(null);

  const allTxs    = [...(snapshot.checkingTxs ?? []), ...(snapshot.ccTxs ?? [])];
  const budgetMap = new Map(budgets.map((b) => [b.categoryId, b.monthlyAmount]));
  const metrics   = computeSnapshotMetrics(allTxs, budgetMap, month);

  return NextResponse.json({
    month,
    checkingTxs: snapshot.checkingTxs ?? [],
    ccTxs:       snapshot.ccTxs       ?? [],
    metrics,
  });
}
