import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { categoryRepo, merchantRuleRepo, snapshotRepo, pdfParser } from '@/src/infrastructure/container';
import { normalizeMerchant } from '@/src/domain/entities/merchant-rule';
import { parseSantanderCheckingXlsx } from '@/src/infrastructure/parsers/santander-checking-xlsx';
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

function computeMetrics(allTxs: SnapshotTransaction[], month: string) {
  const expenses = allTxs.filter((t) => t.transactionType === 'expense' && t.amount < 0);
  const income   = allTxs.filter((t) => t.transactionType === 'income'  && t.amount > 0);

  const totalExpenses = expenses.reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalIncome   = income.reduce((s, t) => s + t.amount, 0);

  const elapsed  = daysElapsed(month);
  const total    = daysInMonth(month);
  const dailyAvg = elapsed > 0 ? totalExpenses / elapsed : 0;
  const projected = Math.round(dailyAvg * total);

  // By merchant
  const merchantMap = new Map<string, { total: number; count: number; categoryName: string; sources: Set<string> }>();
  for (const t of expenses) {
    const e = merchantMap.get(t.merchant) ?? { total: 0, count: 0, categoryName: t.categoryName, sources: new Set<string>() };
    e.total += Math.abs(t.amount);
    e.count += 1;
    e.sources.add(t.source);
    merchantMap.set(t.merchant, e);
  }
  const byMerchant = Array.from(merchantMap.entries())
    .map(([merchant, { total, count, categoryName, sources }]) => ({
      merchant,
      total: Math.round(total),
      count,
      categoryName,
      source: sources.size > 1 ? 'mixed' : (Array.from(sources)[0] ?? 'credit_card') as 'checking' | 'credit_card' | 'mixed',
    }))
    .sort((a, b) => b.total - a.total);

  // By category (simple % of total)
  const catMap = new Map<string, { name: string; total: number }>();
  for (const t of expenses) {
    const e = catMap.get(t.categoryId) ?? { name: t.categoryName, total: 0 };
    e.total += Math.abs(t.amount);
    catMap.set(t.categoryId, e);
  }
  const byCategory = Array.from(catMap.values())
    .map(({ name, total }) => ({
      categoryName: name,
      total: Math.round(total),
      pct: totalExpenses > 0 ? Math.round((total / totalExpenses) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    totalExpenses:       Math.round(totalExpenses),
    totalIncome:         Math.round(totalIncome),
    dailyAverage:        Math.round(dailyAvg),
    projectedMonthTotal: projected,
    daysElapsed:         elapsed,
    daysInMonth:         total,
    byMerchant,
    byCategory,
  };
}

// ─── Auto-categorize checking rows ────────────────────────────────────────────

function categorizeCheckingTxs(
  rows: { date: string; description: string; amount: number; transactionType: 'expense' | 'income' | 'transfer' }[],
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
      date: row.date,
      description: row.description,
      merchant: row.description,
      amount: row.amount,
      transactionType: row.transactionType,
      categoryId,
      categoryName,
      source: 'checking' as const,
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

    const [categories, merchantRules] = await Promise.all([
      categoryRepo.findByUserId(userId),
      merchantRuleRepo.findByUserId(userId),
    ]);

    const categoryNameMap    = new Map(categories.map((c) => [c.id, c.name]));
    const defaultCategoryId  = categories.find((c) => c.name === 'Otros')?.id ?? categories[0]?.id ?? '';
    const bankRuleMap        = new Map<string, string>();
    const wildcardRuleMap    = new Map<string, string>();
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
      newCheckingTxs = categorizeCheckingTxs(rows, bankRuleMap, wildcardRuleMap, categoryNameMap, defaultCategoryId);
    }

    // Parse CC text with Claude (intelligent merchant cleaning + categorization)
    let newCCTxs: SnapshotTransaction[] | null = null;
    if (ccText) {
      const categoryNames = categories.map((c) => c.name);
      const parsed = await pdfParser.parseCCText(ccText, categoryNames, month);
      newCCTxs = parsed.map((r) => {
        const matchedCat = categories.find(
          (c) => c.name.toLowerCase() === r.suggestedCategory.toLowerCase(),
        );
        const categoryId   = matchedCat?.id   ?? defaultCategoryId;
        const categoryName = matchedCat?.name ?? 'Otros';
        return {
          date:            r.date,
          description:     r.description,
          merchant:        r.merchant,
          amount:          r.amount,
          transactionType: 'expense' as const,
          categoryId,
          categoryName,
          source:          'credit_card' as const,
        };
      });
    }

    // Merge with existing snapshot (keep the source not provided this time)
    const existing        = await snapshotRepo.findByUserAndMonth(userId, month);
    const finalCheckingTxs = newCheckingTxs ?? existing?.checkingTxs ?? null;
    const finalCCTxs       = newCCTxs       ?? existing?.ccTxs       ?? null;

    await snapshotRepo.upsert(userId, month, finalCheckingTxs, finalCCTxs);

    const allTxs  = [...(finalCheckingTxs ?? []), ...(finalCCTxs ?? [])];
    const metrics = computeMetrics(allTxs, month);

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

  const snapshot = await snapshotRepo.findByUserAndMonth(userId, month);
  if (!snapshot) return NextResponse.json(null);

  const allTxs  = [...(snapshot.checkingTxs ?? []), ...(snapshot.ccTxs ?? [])];
  const metrics = computeMetrics(allTxs, month);

  return NextResponse.json({
    month,
    checkingTxs: snapshot.checkingTxs ?? [],
    ccTxs:       snapshot.ccTxs       ?? [],
    metrics,
  });
}
