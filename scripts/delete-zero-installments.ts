/**
 * delete-zero-installments.ts
 *
 * Finds and deletes installment transactions where installmentNum = 0.
 * These are Santander "INFORMACION COMPRAS EN CUOTAS EN EL PERIODO"
 * informational entries that were incorrectly saved as real transactions.
 *
 * Usage:
 *   npx tsx scripts/delete-zero-installments.ts          # dry-run (safe)
 *   npx tsx scripts/delete-zero-installments.ts --apply  # delete for real
 */

import { PrismaClient } from '@prisma/client';

const apply = process.argv.includes('--apply');
const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });

async function main() {
  const rows = await prisma.transaction.findMany({
    where: { isInstallment: true, installmentNum: 0 },
    include: { statement: true },
    orderBy: [{ date: 'asc' }],
  });

  if (rows.length === 0) {
    console.log('✅ No se encontraron transacciones con installmentNum = 0.');
    return;
  }

  console.log(`${apply ? '🗑️  Eliminando' : '🔍 Dry-run —'} ${rows.length} transacción(es) con installmentNum = 0:\n`);

  for (const tx of rows) {
    const bank = tx.statement?.bank ?? 'sin banco';
    const month = tx.statement?.month ?? '????-??';
    console.log(
      `  [${bank}] ${month} | ${tx.merchant.padEnd(40)} | ${tx.description.slice(0, 60)}`
    );
  }

  if (!apply) {
    console.log('\n⚠️  Modo dry-run. Usa --apply para eliminarlas.');
    return;
  }

  const ids = rows.map((r) => r.id);
  const { count } = await prisma.transaction.deleteMany({ where: { id: { in: ids } } });
  console.log(`\n✅ ${count} transacción(es) eliminada(s).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
