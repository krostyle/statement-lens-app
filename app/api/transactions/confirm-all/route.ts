import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { transactionRepo } from '@/src/infrastructure/container';

/**
 * PATCH /api/transactions/confirm-all
 *
 * Marks every transaction with reviewStatus='pending' as 'confirmed'
 * for the authenticated user.
 * Returns { confirmed: number }
 */
export async function PATCH() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const confirmed = await transactionRepo.confirmAllPending(userId);
    return NextResponse.json({ confirmed });
  } catch (err) {
    console.error('[confirm-all] unexpected error', err);
    return NextResponse.json({ error: 'Error al confirmar transacciones' }, { status: 500 });
  }
}
