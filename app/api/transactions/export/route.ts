import { auth } from '@/src/infrastructure/auth/nextauth.config';
import { prisma } from '@/src/infrastructure/database/prisma.client';
import type { Prisma } from '@prisma/client';

function escapeCsv(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const userId = session.user.id;

  const where: Prisma.TransactionWhereInput = { userId };

  const categoryId = searchParams.get('categoryId');
  if (categoryId) where.categoryId = categoryId;

  const statementId = searchParams.get('statementId');
  if (statementId) where.statementId = statementId;

  const from = searchParams.get('from');
  const to = searchParams.get('to');
  if (from || to) {
    where.date = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const search = searchParams.get('search');
  if (search) {
    where.OR = [
      { merchant: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const transactions = await prisma.transaction.findMany({
    where,
    include: { category: true },
    orderBy: { date: 'desc' },
  });

  const header = ['fecha', 'descripcion', 'comercio', 'categoria', 'monto', 'moneda', 'cuota_num', 'cuota_total'];
  const rows = transactions.map((t) => [
    escapeCsv(t.date.toISOString().slice(0, 10)),
    escapeCsv(t.description),
    escapeCsv(t.merchant),
    escapeCsv(t.category.name),
    escapeCsv(t.amount),
    escapeCsv(t.currency),
    escapeCsv(t.installmentNum),
    escapeCsv(t.installmentTotal),
  ]);

  const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="transacciones.csv"',
    },
  });
}
