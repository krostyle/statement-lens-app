import { NextResponse } from 'next/server';
import { auth } from '@/src/infrastructure/auth/nextauth.config';
import { recommendBudgetsUseCase } from '@/src/infrastructure/container';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const recommendations = await recommendBudgetsUseCase.execute(session.user.id);
  return NextResponse.json(recommendations);
}
