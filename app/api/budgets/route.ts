import { NextResponse } from 'next/server';
import { auth } from '@/src/infrastructure/auth/nextauth.config';
import { listBudgetsUseCase } from '@/src/infrastructure/container';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const budgets = await listBudgetsUseCase.execute(session.user.id);
  return NextResponse.json(budgets);
}
