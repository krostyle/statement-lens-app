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

    const { saveMerchantRule, applyToInstallmentGroup, ...transactionData } = parsed.data;

    const transaction = await updateTransactionUseCase.execute(id, userId, transactionData);

    // Side effect 1: save merchant rule so future PDF imports auto-categorize
    if (saveMerchantRule && transactionData.categoryId) {
      await upsertMerchantRuleUseCase.execute(userId, transaction.merchant, transactionData.categoryId);
    }

    // Side effect 2: propagate category to all installments in the same group
    if (applyToInstallmentGroup && transaction.isInstallment && transactionData.categoryId && transaction.installmentTotal) {
      const group = await transactionRepo.findInstallmentGroup(
        userId,
        transaction.merchant,
        transaction.installmentTotal,
      );
      const siblingIds = group.filter((t) => t.id !== id).map((t) => t.id);
      if (siblingIds.length > 0) {
        await transactionRepo.updateMany(siblingIds, userId, { categoryId: transactionData.categoryId });
      }
    }

    return NextResponse.json(transaction);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message === 'Forbidden' ? 403 : message === 'Transaction not found' ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
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
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message === 'Forbidden' ? 403 : message === 'Transaction not found' ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
