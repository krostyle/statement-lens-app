import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { transactionRepo } from '@/src/infrastructure/container';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const months = await transactionRepo.findTrackingMonths(userId);
  return NextResponse.json({ months });
}
