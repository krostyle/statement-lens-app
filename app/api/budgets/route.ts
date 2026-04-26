import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { listBudgetsUseCase } from '@/src/infrastructure/container';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const budgets = await listBudgetsUseCase.execute(userId);
  return NextResponse.json(budgets);
}
