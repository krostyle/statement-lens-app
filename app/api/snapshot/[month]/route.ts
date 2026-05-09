import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { snapshotRepo } from '@/src/infrastructure/container';
import type { SnapshotTransaction } from '@/src/domain/entities/snapshot';

export async function DELETE(_: Request, { params }: { params: Promise<{ month: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { month } = await params;
  await snapshotRepo.deleteByUserAndMonth(userId, month);
  return new NextResponse(null, { status: 204 });
}

/** Re-categorize all transactions for a given merchant in the snapshot. */
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

  const snapshot = await snapshotRepo.findByUserAndMonth(userId, month);
  if (!snapshot) return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });

  const remap = (txs: SnapshotTransaction[] | null): SnapshotTransaction[] | null => {
    if (!txs) return null;
    return txs.map((t) =>
      t.merchant === merchant ? { ...t, categoryId, categoryName } : t,
    );
  };

  await snapshotRepo.upsert(userId, month, remap(snapshot.checkingTxs), remap(snapshot.ccTxs));
  return NextResponse.json({ ok: true });
}
