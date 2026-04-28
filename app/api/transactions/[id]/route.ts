import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { updateTransactionSchema } from '@/src/lib/validations/transaction.schema';
import {
  updateTransactionUseCase,
  deleteTransactionUseCase,
  upsertMerchantRuleUseCase,
  transactionRepo,
} from '@/src/infrastructure/container';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { saveMerchantRule, saveMerchantRuleBank, applyToInstallmentGroup, confirm, ...transactionData } = parsed.data;

    // confirm=true → mark as reviewed without changing any other field
    const dataToUpdate = confirm
      ? { reviewStatus: 'confirmed' as const }
      : transactionData;

    const transaction = await updateTransactionUseCase.execute(id, userId, dataToUpdate);

    // Side effect 1: save merchant rule so future PDF imports auto-categorize
    let ruleWarning: string | undefined;
    if (saveMerchantRule) {
      const categoryToRule = transactionData.categoryId ?? transaction.categoryId;
      try {
        const bank = saveMerchantRuleBank ?? ''; // '' = any card
        await upsertMerchantRuleUseCase.execute(userId, transaction.merchant, bank, categoryToRule);
      } catch (ruleErr) {
        console.error('[PATCH /api/transactions/:id] rule upsert failed', ruleErr);
        ruleWarning = 'No se pudo guardar la regla. Es posible que ya exista una regla conflictiva para este comercio.';
      }
    }

    // Side effect 2: propagate category and/or description to all installments in the same group.
    // If nothing changed in this edit, fall back to the transaction's current values so the user
    // can still sync siblings that arrived with a wrong category from a previous import.
    if (applyToInstallmentGroup && transaction.isInstallment && transaction.installmentTotal) {
      const groupUpdate: { categoryId?: string; description?: string } = {
        categoryId:  transactionData.categoryId  ?? transaction.categoryId,
        description: transactionData.description ?? transaction.description,
      };
      const group = await transactionRepo.findInstallmentGroup(
        userId,
        transaction.merchant,
        transaction.installmentTotal,
      );
      const siblingIds = group.filter((t) => t.id !== id).map((t) => t.id);
      if (siblingIds.length > 0) {
        await transactionRepo.updateMany(siblingIds, userId, groupUpdate);
      }
    }

    return NextResponse.json(ruleWarning ? { ...transaction, ruleWarning } : transaction);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    // Only surface known, safe error messages — hide all internal/DB details
    if (message === 'Forbidden')          return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    if (message === 'Transaction not found') return NextResponse.json({ error: 'Transacción no encontrada' }, { status: 404 });
    if (message === 'Categoría no válida')   return NextResponse.json({ error: message }, { status: 422 });
    console.error('[PATCH /api/transactions/:id]', error);
    return NextResponse.json({ error: 'Error al actualizar la transacción' }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    await deleteTransactionUseCase.execute(id, userId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'Forbidden')             return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    if (message === 'Transaction not found') return NextResponse.json({ error: 'Transacción no encontrada' }, { status: 404 });
    console.error('[DELETE /api/transactions/:id]', error);
    return NextResponse.json({ error: 'Error al eliminar la transacción' }, { status: 500 });
  }
}
