import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/src/infrastructure/auth/nextauth.config';
import { upsertBudgetUseCase, budgetRepo } from '@/src/infrastructure/container';

const patchSchema = z.object({
  monthlyAmount: z.number().positive(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ categoryId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { categoryId } = await params;
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const budget = await upsertBudgetUseCase.execute(session.user.id, categoryId, parsed.data.monthlyAmount);
    return NextResponse.json(budget);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ categoryId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { categoryId } = await params;
    await budgetRepo.delete(session.user.id, categoryId);
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
  }
}
