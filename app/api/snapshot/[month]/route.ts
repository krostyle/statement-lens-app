import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { snapshotRepo } from '@/src/infrastructure/container';

export async function DELETE(_: Request, { params }: { params: Promise<{ month: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { month } = await params;
  await snapshotRepo.deleteByUserAndMonth(userId, month);
  return new NextResponse(null, { status: 204 });
}
