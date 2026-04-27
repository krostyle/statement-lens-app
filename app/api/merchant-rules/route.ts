import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { listMerchantRulesUseCase, upsertMerchantRuleUseCase } from '@/src/infrastructure/container';

const upsertSchema = z.object({
  merchant: z.string().min(1).max(200),
  categoryId: z.string().uuid(),
});

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rules = await listMerchantRulesUseCase.execute(userId);
  return NextResponse.json(rules);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const rule = await upsertMerchantRuleUseCase.execute(userId, parsed.data.merchant, parsed.data.categoryId);
    return NextResponse.json(rule, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message === 'Categoría no válida') return NextResponse.json({ error: message }, { status: 422 });
    console.error('[POST /api/merchant-rules]', err);
    return NextResponse.json({ error: 'Error al guardar la regla' }, { status: 500 });
  }
}
