import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/src/infrastructure/database/prisma.client';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const txs = await prisma.transaction.findMany({
    where: { userId },
    select: { date: true, accountingMonth: true },
  });

  const monthSet = new Set<string>();
  for (const tx of txs) {
    const m = tx.accountingMonth || `${tx.date.getUTCFullYear()}-${String(tx.date.getUTCMonth() + 1).padStart(2, '0')}`;
    monthSet.add(m);
  }

  const months = Array.from(monthSet).sort((a, b) => b.localeCompare(a));
  return NextResponse.json({ months });
}
