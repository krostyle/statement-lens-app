import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { deleteMerchantRuleUseCase } from '@/src/infrastructure/container';

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    await deleteMerchantRuleUseCase.execute(id, userId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al eliminar la regla';
    const status = message === 'Forbidden' ? 403 : message === 'Regla no encontrada' ? 404 : 422;
    return NextResponse.json({ error: message }, { status });
  }
}
