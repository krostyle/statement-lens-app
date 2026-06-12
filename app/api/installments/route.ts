import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/src/infrastructure/database/prisma.client';
import type { Prisma } from '@prisma/client';

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month');

  const bank = searchParams.get('bank');
  const where: Prisma.TransactionWhereInput = { userId, isInstallment: true };

  if (month) {
    const [y, m] = month.split('-').map(Number);
    where.date = {
      gte: new Date(Date.UTC(y, m - 1, 1)),
      lt: new Date(Date.UTC(y, m, 1)),
    };
  }

  if (bank) {
    where.bank = bank;
  }

  // Fetch all installment transactions for the user.
  // Sort by date DESC so the most recently billed row always wins the dedup
  // map. Since every installment row carries the billing-month date (1st of
  // the tracked month) rather than the original purchase date, "most recent
  // date" == "most recently billed". This correctly handles the case where a
  // paid plan (last billed in e.g. Dec 2025) and a new active plan share the
  // same key: the active plan's more recent billing date wins, so the paid
  // plan never shadows it.
  const txs = await prisma.transaction.findMany({
    where,
    orderBy: [{ date: 'desc' }, { installmentNum: 'desc' }],
  });

  // Deduplicate: one entry per installment plan.
  // Key = bank + installmentTotal + rounded monthly amount.
  // Merchant name is intentionally excluded: banks often print slightly different
  // descriptions for the same plan across months (e.g. "Paris Puente Alto" → "Paris",
  // or case changes). The combination of bank + total installments + monthly amount
  // is specific enough to identify a single plan in personal finance.
  // The most-recently-billed row arrives first (sorted above) and wins the map.
  const map = new Map<string, typeof txs[number]>();
  for (const tx of txs) {
    if (tx.installmentNum === null || tx.installmentTotal === null) continue;
    const key = `${tx.bank}||${tx.installmentTotal}||${Math.round(Math.abs(tx.amount) / 100)}`;
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
      bank: tx.bank || null,
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
