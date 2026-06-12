import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { transactionRepo, categoryRepo, budgetRepo } from '@/src/infrastructure/container';
import { computeSnapshotMetrics } from '@/src/lib/snapshot-metrics';
import { txToSnapshot } from '@/src/lib/snapshot-utils';

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

  // Verify the transaction belongs to this user and is a tracking transaction
  const tx = await transactionRepo.findById(txId);
  if (!tx || tx.userId !== userId || tx.origin !== 'tracking') {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
  }

  await transactionRepo.update(txId, {
    categoryId,
    transactionType: transactionType as 'expense' | 'income' | 'transfer',
  });

  const [allTracking, categories, budgets] = await Promise.all([
    transactionRepo.findTrackingByMonth(userId, month),
    categoryRepo.findByUserId(userId),
    budgetRepo.findByUserId(userId, month),
  ]);

  const categoryNameMap = new Map(categories.map((c) => [c.id, c.name]));
  const allSnapshot     = allTracking.map((t) => txToSnapshot(t, categoryNameMap));
  const budgetMap       = new Map(budgets.map((b) => [b.categoryId, b.monthlyAmount]));
  const metrics         = computeSnapshotMetrics(allSnapshot, budgetMap, month);

  return NextResponse.json({ metrics });
}
