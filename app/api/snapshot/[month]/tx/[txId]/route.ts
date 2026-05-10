import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { snapshotRepo, budgetRepo } from '@/src/infrastructure/container';
import { computeSnapshotMetrics } from '@/src/lib/snapshot-metrics';
import type { SnapshotTransaction } from '@/src/domain/entities/snapshot';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ month: string; txId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { month, txId } = await params;
  const { categoryId, categoryName, transactionType } = (await request.json()) as {
    categoryId: string;
    categoryName: string;
    transactionType: string;
  };

  if (!categoryId || !categoryName || !transactionType) {
    return NextResponse.json({ error: 'categoryId, categoryName and transactionType are required' }, { status: 400 });
  }

  const snapshot = await snapshotRepo.findByUserAndMonth(userId, month);
  if (!snapshot) return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });

  const updateTx = (txs: SnapshotTransaction[] | null): SnapshotTransaction[] | null => {
    if (!txs) return null;
    return txs.map((t) =>
      t.id === txId
        ? { ...t, categoryId, categoryName, transactionType: transactionType as SnapshotTransaction['transactionType'] }
        : t,
    );
  };

  const updatedChecking = updateTx(snapshot.checkingTxs);
  const updatedCC       = updateTx(snapshot.ccTxs);

  await snapshotRepo.upsert(userId, month, updatedChecking, updatedCC);

  const budgets   = await budgetRepo.findByUserId(userId, month);
  const allTxs    = [...(updatedChecking ?? []), ...(updatedCC ?? [])];
  const budgetMap = new Map(budgets.map((b) => [b.categoryId, b.monthlyAmount]));
  const metrics   = computeSnapshotMetrics(allTxs, budgetMap, month);

  return NextResponse.json({ metrics });
}
