import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { categoryRepo, merchantRuleRepo, snapshotRepo, budgetRepo } from '@/src/infrastructure/container';
import { normalizeMerchant } from '@/src/domain/entities/merchant-rule';
import { parseSantanderCheckingXlsx } from '@/src/infrastructure/parsers/santander-checking-xlsx';
import { parseSantanderCCText } from '@/src/infrastructure/parsers/santander-cc-text';
import type { SnapshotTransaction } from '@/src/domain/entities/snapshot';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function daysElapsed(month: string): number {
  const today = new Date();
  const [y, m] = month.split('-').map(Number);
  const isCurrentMonth = today.getFullYear() === y && today.getMonth() + 1 === m;
  if (!isCurrentMonth) return daysInMonth(month);
  return today.getDate();
}

function computeMetrics(
  allTxs: SnapshotTransaction[],
  budgetsByCategory: Map<string, number>,
  month: string,
) {
  const expenses = allTxs.filter((t) => t.transactionType === 'expense' && t.amount < 0);
  const income   = allTxs.filter((t) => t.transactionType === 'income'  && t.amount > 0);

  const totalExpenses = expenses.reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalIncome   = income.reduce((s, t) => s + t.amount, 0);

  const elapsed = daysElapsed(month);
  const total   = daysInMonth(month);
  const dailyAvg = elapsed > 0 ? totalExpenses / elapsed : 0;
  const projected = Math.round(dailyAvg * total);

  // By category
  const catTotals = new Map<string, { name: string; total: number }>();
  for (const t of expenses) {
    const entry = catTotals.get(t.categoryId) ?? { name: t.categoryName, total: 0 };
    entry.total += Math.abs(t.amount);
    catTotals.set(t.categoryId, entry);
  }
  const byCategory = Array.from(catTotals.entries())
    .map(([categoryId, { name, total }]) => {
      const budget = budgetsByCategory.get(categoryId) ?? null;
      return {
        categoryId,
        categoryName: name,
        total: Math.round(total),
        budget,
        pct: budget ? Math.min(Math.round((total / budget) * 100), 999) : null,
      };
    })
    .sort((a, b) => b.total - a.total);

  // Top merchants
  const merchantTotals = new Map<string, { total: number; count: number }>();
  for (const t of expenses) {
    const e = merchantTotals.get(t.merchant) ?? { total: 0, count: 0 };
    e.total += Math.abs(t.amount);
    e.count += 1;
    merchantTotals.set(t.merchant, e);
  }
  const topMerchants = Array.from(merchantTotals.entries())
    .map(([merchant, { total, count }]) => ({ merchant, total: Math.round(total), count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return {
    totalExpenses: Math.round(totalExpenses),
    totalIncome:   Math.round(totalIncome),
    dailyAverage:  Math.round(dailyAvg),
    projectedMonthTotal: projected,
    daysElapsed: elapsed,
    daysInMonth: total,
    byCategory,
    topMerchants,
  };
}

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
    const merchant = row.description;
    const pattern = normalizeMerchant(merchant);
    const categoryId =
      bankRuleMap.get(`${pattern}|santander`) ??
      wildcardRuleMap.get(pattern) ??
      defaultCategoryId;
    const categoryName = categoryNameMap.get(categoryId) ?? 'Otros';
    return {
      date: row.date,
      description: row.description,
      merchant,
      amount: row.amount,
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
    const formData = await request.formData();
    const month     = (formData.get('month') as string | null)?.trim();
    const checkingFile = formData.get('checkingFile') as File | null;
    const ccText    = (formData.get('ccText') as string | null)?.trim();

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'month requerido (YYYY-MM)' }, { status: 400 });
    }
    if (!checkingFile && !ccText) {
      return NextResponse.json({ error: 'Debes subir un archivo XLSX o pegar texto de tarjeta.' }, { status: 400 });
    }

    // Load categories and merchant rules
    const [categories, merchantRules, budgets] = await Promise.all([
      categoryRepo.findByUserId(userId),
      merchantRuleRepo.findByUserId(userId),
      budgetRepo.findByUserId(userId, month),
    ]);

    const categoryNameMap = new Map(categories.map((c) => [c.id, c.name]));
    const othersCategory  = categories.find((c) => c.name === 'Otros');
    const defaultCategoryId = othersCategory?.id ?? categories[0]?.id ?? '';

    const bankRuleMap     = new Map<string, string>();
    const wildcardRuleMap = new Map<string, string>();
    for (const rule of merchantRules) {
      rule.bank
        ? bankRuleMap.set(`${rule.merchantPattern}|${rule.bank}`, rule.categoryId)
        : wildcardRuleMap.set(rule.merchantPattern, rule.categoryId);
    }

    // Parse XLSX
    let newCheckingTxs: SnapshotTransaction[] | null = null;
    if (checkingFile && checkingFile.size > 0) {
      const buffer = Buffer.from(await checkingFile.arrayBuffer());
      const rows = parseSantanderCheckingXlsx(buffer);
      newCheckingTxs = categorizeTxs(rows, 'checking', bankRuleMap, wildcardRuleMap, categoryNameMap, defaultCategoryId);
    }

    // Parse CC text
    let newCCTxs: SnapshotTransaction[] | null = null;
    if (ccText) {
      const rows = parseSantanderCCText(ccText);
      const ccRows = rows.map((r) => ({ ...r, transactionType: 'expense' as const }));
      newCCTxs = categorizeTxs(ccRows, 'credit_card', bankRuleMap, wildcardRuleMap, categoryNameMap, defaultCategoryId);
    }

    // Merge with existing snapshot (keep the source not provided today)
    const existing = await snapshotRepo.findByUserAndMonth(userId, month);
    const finalCheckingTxs = newCheckingTxs ?? existing?.checkingTxs ?? null;
    const finalCCTxs       = newCCTxs       ?? existing?.ccTxs       ?? null;

    await snapshotRepo.upsert(userId, month, finalCheckingTxs, finalCCTxs);

    const allTxs = [...(finalCheckingTxs ?? []), ...(finalCCTxs ?? [])];
    const budgetMap = new Map(budgets.map((b) => [b.categoryId, b.monthlyAmount]));
    const metrics = computeMetrics(allTxs, budgetMap, month);

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

  const allTxs = [...(snapshot.checkingTxs ?? []), ...(snapshot.ccTxs ?? [])];
  const budgetMap = new Map(budgets.map((b) => [b.categoryId, b.monthlyAmount]));
  const metrics = computeMetrics(allTxs, budgetMap, month);

  return NextResponse.json({
    month,
    checkingTxs: snapshot.checkingTxs ?? [],
    ccTxs:       snapshot.ccTxs       ?? [],
    metrics,
  });
}
