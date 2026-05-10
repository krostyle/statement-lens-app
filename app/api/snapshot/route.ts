import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { categoryRepo, merchantRuleRepo, snapshotRepo, budgetRepo } from '@/src/infrastructure/container';
import { normalizeMerchant } from '@/src/domain/entities/merchant-rule';
import { parseSantanderCheckingXlsx } from '@/src/infrastructure/parsers/santander-checking-xlsx';
import { parseSantanderCCCsv } from '@/src/infrastructure/parsers/santander-cc-csv';
import type { SnapshotTransaction } from '@/src/domain/entities/snapshot';
import { computeSnapshotMetrics } from '@/src/lib/snapshot-metrics';

// ─── Auto-categorize rows ─────────────────────────────────────────────────────

function categorizeTxs(
  rows: { date: string; description: string; amount: number; transactionType: 'expense' | 'income' | 'transfer' }[],
  source: 'checking' | 'credit_card',
  bankRuleMap: Map<string, string>,
  wildcardRuleMap: Map<string, string>,
  categoryNameMap: Map<string, string>,
  defaultCategoryId: string,
): SnapshotTransaction[] {
  return rows.map((row) => {
    const pattern = normalizeMerchant(row.description);
    const categoryId =
      bankRuleMap.get(`${pattern}|santander`) ??
      wildcardRuleMap.get(pattern) ??
      defaultCategoryId;
    const categoryName = categoryNameMap.get(categoryId) ?? 'Otros';
    return {
      date:            row.date,
      description:     row.description,
      merchant:        row.description,
      amount:          row.amount,
      transactionType: source === 'credit_card' ? 'expense' : row.transactionType,
      categoryId,
      categoryName,
      source,
    };
  });
}

// ─── POST — upload + parse + upsert ───────────────────────────────────────────

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData    = await request.formData();
    const month       = (formData.get('month') as string | null)?.trim();
    const checkingFile = formData.get('checkingFile') as File | null;
    const ccText      = (formData.get('ccText') as string | null)?.trim();

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'month requerido (YYYY-MM)' }, { status: 400 });
    }
    if (!checkingFile && !ccText) {
      return NextResponse.json({ error: 'Debes subir un archivo XLSX o pegar texto de tarjeta.' }, { status: 400 });
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

    // Parse checking XLSX (deterministic)
    let newCheckingTxs: SnapshotTransaction[] | null = null;
    if (checkingFile && checkingFile.size > 0) {
      const buffer = Buffer.from(await checkingFile.arrayBuffer());
      const rows = parseSantanderCheckingXlsx(buffer);
      newCheckingTxs = categorizeTxs(rows, 'checking', bankRuleMap, wildcardRuleMap, categoryNameMap, defaultCategoryId);
    }

    // Parse CC CSV (deterministic — both mobile Title Case and desktop UPPERCASE)
    let newCCTxs: SnapshotTransaction[] | null = null;
    if (ccText) {
      const rows = parseSantanderCCCsv(ccText);
      newCCTxs = categorizeTxs(
        rows.map((r) => ({ ...r, transactionType: 'expense' as const })),
        'credit_card',
        bankRuleMap,
        wildcardRuleMap,
        categoryNameMap,
        defaultCategoryId,
      );
    }

    // Merge with existing snapshot (keep the source not provided this time)
    const existing         = await snapshotRepo.findByUserAndMonth(userId, month);
    const finalCheckingTxs = newCheckingTxs ?? existing?.checkingTxs ?? null;
    const finalCCTxs       = newCCTxs       ?? existing?.ccTxs       ?? null;

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
