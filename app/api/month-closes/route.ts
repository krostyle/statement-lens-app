import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { createMonthCloseUseCase, listMonthClosesUseCase } from '@/src/infrastructure/container';

const createSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Formato de mes inválido (YYYY-MM)'),
});

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const closes = await listMonthClosesUseCase.execute(userId);
  return NextResponse.json(closes);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const monthClose = await createMonthCloseUseCase.execute(userId, parsed.data.month);
    return NextResponse.json(monthClose, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al cerrar el mes';
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
