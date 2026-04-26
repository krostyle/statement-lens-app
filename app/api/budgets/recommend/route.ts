import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { recommendBudgetsUseCase } from '@/src/infrastructure/container';

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const recommendations = await recommendBudgetsUseCase.execute(userId);
  return NextResponse.json(recommendations);
}
