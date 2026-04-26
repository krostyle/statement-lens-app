import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { transactionRepo } from '@/src/infrastructure/container';
import { buildMetrics } from '@/src/adapters/presenters/metrics.presenter';
import type { Transaction } from '@/src/domain/entities/transaction';

function toMonthStr(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function prevMonthOf(monthStr: string) {
  const [y, m] = monthStr.split('-').map(Number);
  return toMonthStr(new Date(Date.UTC(y, m - 2, 1)));
}

function filterByMonth(txs: Transaction[], month: string) {
  return txs.filter((t) => toMonthStr(t.date) === month);
}

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const monthParam = searchParams.get('month');
  const now = new Date();

  if (monthParam) {
    // ── Month mode ───────────────────────────────────────────────────────
    const currentPeriod = monthParam;
    const previousPeriod = prevMonthOf(monthParam);
    const [y, m] = monthParam.split('-').map(Number);
    const sixMonthsAgo = new Date(Date.UTC(y, m - 6, 1));
    const allTxs = await transactionRepo.findByUserId(userId, { from: sixMonthsAgo });

    return NextResponse.json(
      buildMetrics({
        currentTxs: filterByMonth(allTxs, currentPeriod),
        previousTxs: filterByMonth(allTxs, previousPeriod),
        currentPeriod,
        scopeTxs: allTxs,
        filterMode: 'month',
      })
    );
  }

  // ── Default mode (last 6 months) ─────────────────────────────────────
  const currentPeriod = toMonthStr(now);
  const previousPeriod = prevMonthOf(currentPeriod);
  const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const allTxs = await transactionRepo.findByUserId(userId, { from: sixMonthsAgo });

  return NextResponse.json(
    buildMetrics({
      currentTxs: filterByMonth(allTxs, currentPeriod),
      previousTxs: filterByMonth(allTxs, previousPeriod),
      currentPeriod,
      scopeTxs: allTxs,
      filterMode: 'default',
    })
  );
}
