import { NextResponse } from 'next/server';
import { auth } from '@/src/infrastructure/auth/nextauth.config';
import { prisma } from '@/src/infrastructure/database/prisma.client';
import type { Prisma } from '@prisma/client';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const { searchParams } = new URL(request.url);
  const statementId = searchParams.get('statementId');
  const month = searchParams.get('month');

  const bank = searchParams.get('bank');
  const where: Prisma.TransactionWhereInput = { userId, isInstallment: true };

  if (statementId) {
    where.statementId = statementId;
  } else if (month) {
    const [y, m] = month.split('-').map(Number);
    where.date = {
      gte: new Date(Date.UTC(y, m - 1, 1)),
      lt: new Date(Date.UTC(y, m, 1)),
    };
  }

  if (bank && ['santander', 'falabella', 'liderbci'].includes(bank)) {
    where.statement = { bank: bank as 'santander' | 'falabella' | 'liderbci' };
  }

  // Fetch matching installment transactions ordered most-recent first
  const txs = await prisma.transaction.findMany({
    where,
    include: { statement: true },
    orderBy: [{ date: 'desc' }, { installmentNum: 'desc' }],
  });

  // Deduplicate by merchant + installmentTotal + rounded amount.
  // This is robust against banks encoding "CUOTA X/Y" into the description.
  // Keep the first (most recent) row per plan.
  const map = new Map<string, typeof txs[number]>();
  for (const tx of txs) {
    if (tx.installmentNum === null || tx.installmentTotal === null) continue;
    const key = `${tx.statement?.bank ?? ''}||${tx.merchant}||${tx.installmentTotal}||${Math.round(Math.abs(tx.amount) / 100)}`;
    if (!map.has(key)) {
      map.set(key, tx);
    }
  }

  // Build result — exclude fully-paid plans (installmentNum === installmentTotal)
  const installments = Array.from(map.values())
    .filter((tx) => tx.installmentNum! < tx.installmentTotal!)
    .map((tx) => ({
      id: tx.id,
      merchant: tx.merchant,
      description: tx.description,
      bank: tx.statement?.bank ?? null,
      amount: Math.abs(tx.amount),
      installmentNum: tx.installmentNum!,
      installmentTotal: tx.installmentTotal!,
      remaining: (tx.installmentTotal! - tx.installmentNum!) * Math.abs(tx.amount),
      currency: tx.currency,
    }));

  const totalMonthly = installments.reduce((s, i) => s + i.amount, 0);
  const totalDebt = installments.reduce((s, i) => s + i.remaining, 0);

  return NextResponse.json({ installments, totalMonthly, totalDebt });
}
