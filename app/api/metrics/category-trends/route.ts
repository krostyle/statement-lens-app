import { NextResponse } from 'next/server';
import { auth } from '@/src/infrastructure/auth/nextauth.config';
import { prisma } from '@/src/infrastructure/database/prisma.client';

function toMonthStr(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const now = new Date();
  const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));

  const transactions = await prisma.transaction.findMany({
    where: { userId, date: { gte: sixMonthsAgo }, amount: { lt: 0 } },
    include: { category: true },
    orderBy: { date: 'asc' },
  });

  // Aggregate spend by (category, month)
  const spendMap = new Map<string, Map<string, number>>(); // categoryName -> month -> total
  const monthsSet = new Set<string>();

  for (const tx of transactions) {
    const month = toMonthStr(tx.date);
    monthsSet.add(month);
    const catName = tx.category.name;
    if (!spendMap.has(catName)) spendMap.set(catName, new Map());
    const catMap = spendMap.get(catName)!;
    catMap.set(month, (catMap.get(month) ?? 0) + Math.abs(tx.amount));
  }

  const months = Array.from(monthsSet).sort();

  // Pick top 5 categories by total spend
  const categoryTotals = Array.from(spendMap.entries())
    .map(([name, monthMap]) => ({
      name,
      total: Array.from(monthMap.values()).reduce((s, v) => s + v, 0),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const series = categoryTotals.map(({ name }) => ({
    name,
    data: months.map((m) => Math.round(spendMap.get(name)?.get(m) ?? 0)),
  }));

  return NextResponse.json({ months, series });
}
