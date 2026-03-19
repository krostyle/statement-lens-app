import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/src/infrastructure/auth/nextauth.config';
import { upsertBudgetUseCase } from '@/src/infrastructure/container';

const schema = z.object({
  budgets: z
    .array(
      z.object({
        categoryId: z.string().min(1),
        monthlyAmount: z.number().positive(),
      })
    )
    .min(1),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const results = await Promise.all(
    parsed.data.budgets.map((b) =>
      upsertBudgetUseCase.execute(session.user.id, b.categoryId, b.monthlyAmount)
    )
  );

  return NextResponse.json(results);
}
