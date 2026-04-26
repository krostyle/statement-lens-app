import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { listBudgetsUseCase } from '@/src/infrastructure/container';

function currentMonth() {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') || currentMonth();

  const budgets = await listBudgetsUseCase.execute(userId, month);
  return NextResponse.json(budgets);
}
