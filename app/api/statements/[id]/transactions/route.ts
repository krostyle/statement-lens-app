import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { statementRepo, transactionRepo, categoryRepo } from '@/src/infrastructure/container';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const statement = await statementRepo.findById(id);
  if (!statement) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (statement.userId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [transactions, categories] = await Promise.all([
    transactionRepo.findByStatementId(id),
    categoryRepo.findByUserId(userId),
  ]);

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  const result = transactions.map((t) => ({
    id: t.id,
    date: t.date,
    merchant: t.merchant,
    description: t.description,
    amount: t.amount,
    currency: t.currency,
    category: categoryMap.get(t.categoryId) ?? 'Sin categoría',
    isInstallment: t.isInstallment,
    installmentNum: t.installmentNum,
    installmentTotal: t.installmentTotal,
  }));

  return NextResponse.json(result);
}
