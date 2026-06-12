import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { bulkUpdateTransactionsUseCase, transactionRepo } from '@/src/infrastructure/container';

const bulkUpdateSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'Selecciona al menos una transacción').max(500),
  update: z
    .object({
      categoryId:      z.string().uuid().optional(),
      merchant:        z.string().min(1).max(200).optional(),
      reviewStatus:    z.enum(['pending', 'auto', 'confirmed', 'manual']).optional(),
      transactionType: z.enum(['expense', 'income', 'transfer']).optional(),
    })
    .refine(
      (data) =>
        data.categoryId      !== undefined ||
        data.merchant        !== undefined ||
        data.reviewStatus    !== undefined ||
        data.transactionType !== undefined,
      { message: 'Se requiere al menos un campo a actualizar' },
    ),
});

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
});

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = bulkDeleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { ids } = parsed.data;
  const deleted = await transactionRepo.deleteManyByIds(ids, userId);
  return NextResponse.json({ deleted });
}

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = bulkUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { ids, update } = parsed.data;

  try {
    const updated = await bulkUpdateTransactionsUseCase.execute(userId, ids, update);
    return NextResponse.json({ updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al actualizar transacciones';
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
