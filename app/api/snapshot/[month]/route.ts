import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { transactionRepo, categoryRepo, budgetRepo, trackingUploadRepo } from '@/src/infrastructure/container';
import { computeSnapshotMetrics } from '@/src/lib/snapshot-metrics';
import { txToSnapshot } from '@/src/lib/snapshot-utils';

export async function DELETE(request: Request, { params }: { params: Promise<{ month: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { month } = await params;
  const { searchParams } = new URL(request.url);
  const bank        = searchParams.get('bank') ?? undefined;
  const accountType = (searchParams.get('source') as 'checking' | 'credit_card' | null) ?? undefined;

  // Delete upload records (cascade removes linked transactions) + any legacy unlinked rows
  await Promise.all([
    trackingUploadRepo.deleteByMonth(userId, month, bank, accountType),
    transactionRepo.deleteManyTracking(userId, month, bank, accountType),
  ]);
  return new NextResponse(null, { status: 204 });
}

/** Re-categorize all tracking transactions for a merchant in a month and return updated metrics. */
export async function PATCH(request: Request, { params }: { params: Promise<{ month: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { month } = await params;
  const { merchant, categoryId, categoryName } = (await request.json()) as {
    merchant: string;
    categoryId: string;
    categoryName: string;
  };

  if (!merchant || !categoryId || !categoryName) {
    return NextResponse.json({ error: 'merchant, categoryId and categoryName are required' }, { status: 400 });
  }

  // Find all tracking transactions for this merchant+month
  const allTracking = await transactionRepo.findTrackingByMonth(userId, month);
  const toUpdate    = allTracking.filter((t) => t.merchant === merchant);

  if (toUpdate.length > 0) {
    await transactionRepo.updateMany(
      toUpdate.map((t) => t.id),
      userId,
      { categoryId },
    );
  }

  // Re-fetch to build fresh metrics
  const [updated, categories, budgets] = await Promise.all([
    transactionRepo.findTrackingByMonth(userId, month),
    categoryRepo.findByUserId(userId),
    budgetRepo.findByUserId(userId, month),
  ]);

  const categoryNameMap = new Map(categories.map((c) => [c.id, c.name]));
  const allSnapshot     = updated.map((tx) => txToSnapshot(tx, categoryNameMap));
  const budgetMap       = new Map(budgets.map((b) => [b.categoryId, b.monthlyAmount]));
  const metrics         = computeSnapshotMetrics(allSnapshot, budgetMap, month);

  return NextResponse.json({ metrics });
}
