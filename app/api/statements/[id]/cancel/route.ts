import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { statementRepo } from '@/src/infrastructure/container';

/**
 * POST /api/statements/:id/cancel
 * Force-resets a stuck pending/processing statement to 'error' so the
 * user can trigger a reprocess. Safe to call at any time; does nothing
 * if the statement is already in a terminal state (done / error).
 */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const statement = await statementRepo.findById(id);
  if (!statement) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (statement.userId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (statement.status !== 'pending' && statement.status !== 'processing') {
    return NextResponse.json({ error: 'Solo se pueden cancelar estados pendientes o en proceso.' }, { status: 409 });
  }

  const updated = await statementRepo.updateStatus(id, 'error', 'Cancelado por el usuario.');
  return NextResponse.json(updated);
}
