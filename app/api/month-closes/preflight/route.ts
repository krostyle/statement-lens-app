import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { transactionRepo, budgetRepo, monthCloseRepo } from '@/src/infrastructure/container';

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month');
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'Formato de mes inválido' }, { status: 400 });
  }

  const [year, mm] = month.split('-').map(Number);
  const from = new Date(Date.UTC(year, mm - 1, 1));
  const to   = new Date(Date.UTC(year, mm, 0, 23, 59, 59, 999));

  const [txCount, budgets, alreadyClosed] = await Promise.all([
    transactionRepo.countByUserId(userId, { from, to }),
    budgetRepo.findByUserId(userId, month),
    monthCloseRepo.existsForMonth(userId, month),
  ]);

  return NextResponse.json({
    hasTransactions: txCount > 0,
    hasBudgets: budgets.length > 0,
    alreadyClosed,
    transactionCount: txCount,
    budgetCount: budgets.length,
  });
}
