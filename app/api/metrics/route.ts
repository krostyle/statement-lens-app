import { NextResponse } from 'next/server';
import { auth } from '@/src/infrastructure/auth/nextauth.config';
import { transactionRepo, statementRepo } from '@/src/infrastructure/container';
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
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const statementId = searchParams.get('statementId');
  const monthParam = searchParams.get('month');
  const userId = session.user.id;
  const now = new Date();

  if (statementId) {
    // ── Statement mode ───────────────────────────────────────────────────
    const stmt = await statementRepo.findById(statementId);
    if (!stmt || stmt.userId !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Find previous statement from the same bank (ordered by month asc)
    const allStatements = await statementRepo.findByUserId(userId);
    const bankStatements = allStatements
      .filter((s) => s.bank === stmt.bank)
      .sort((a, b) => a.month.localeCompare(b.month));
    const idx = bankStatements.findIndex((s) => s.id === statementId);
    const prevStmt = idx > 0 ? bankStatements[idx - 1] : null;

    // Load transactions by statementId — no date re-filtering, gets the real total
    const [currentTxs, previousTxs] = await Promise.all([
      transactionRepo.findByUserId(userId, { statementId }),
      prevStmt
        ? transactionRepo.findByUserId(userId, { statementId: prevStmt.id })
        : Promise.resolve([]),
    ]);

    return NextResponse.json(
      buildMetrics({
        currentTxs,
        previousTxs,
        currentPeriod: stmt.month,
        previousPeriod: prevStmt?.month ?? '',
        scopeTxs: currentTxs, // categories/merchants scoped to current statement
        filterMode: 'statement',
      })
    );
  }

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
        previousPeriod,
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
      previousPeriod,
      scopeTxs: allTxs,
      filterMode: 'default',
    })
  );
}
