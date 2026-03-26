import { NextResponse } from 'next/server';
import { auth } from '@/src/infrastructure/auth/nextauth.config';
import { createTransactionSchema } from '@/src/lib/validations/transaction.schema';
import { listTransactionsUseCase, createTransactionUseCase } from '@/src/infrastructure/container';

const PAGE_SIZE = 25;

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));

  const isInstallmentParam = searchParams.get('isInstallment');
  const result = await listTransactionsUseCase.execute(
    session.user.id,
    {
      categoryId: searchParams.get('categoryId') ?? undefined,
      statementId: searchParams.get('statementId') ?? undefined,
      bank: searchParams.get('bank') ?? undefined,
      from: searchParams.get('from') ?? undefined,
      to: searchParams.get('to') ?? undefined,
      search: searchParams.get('search') ?? undefined,
      isInstallment: isInstallmentParam === 'true' ? true : isInstallmentParam === 'false' ? false : undefined,
      minInstallmentTotal: searchParams.get('minInstallmentTotal') ? Number(searchParams.get('minInstallmentTotal')) : undefined,
      maxInstallmentTotal: searchParams.get('maxInstallmentTotal') ? Number(searchParams.get('maxInstallmentTotal')) : undefined,
    },
    page,
    PAGE_SIZE
  );

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const parsed = createTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const transaction = await createTransactionUseCase.execute(session.user.id, parsed.data);
    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
