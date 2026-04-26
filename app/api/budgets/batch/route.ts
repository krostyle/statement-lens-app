import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { upsertBudgetUseCase } from '@/src/infrastructure/container';

const schema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
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
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const results = await Promise.all(
    parsed.data.budgets.map((b) =>
      upsertBudgetUseCase.execute(userId, b.categoryId, b.monthlyAmount, parsed.data.month)
    )
  );

  return NextResponse.json(results);
}
