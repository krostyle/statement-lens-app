/**
 * fix-installment-dates.ts
 *
 * Fixes the `date` field of installment transactions so it reflects the
 * billing month of the statement they belong to, rather than the original
 * purchase date that banks encode on every cuota row.
 *
 * Only the `date` column is touched — description, amount, category,
 * merchant, notes and every other field are left exactly as they are.
 *
 * Usage:
 *   npx tsx scripts/fix-installment-dates.ts          # dry-run (preview)
 *   npx tsx scripts/fix-installment-dates.ts --apply  # commit changes to DB
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌  DATABASE_URL is not set. Set it before running this script.');
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });
const DRY_RUN = !process.argv.includes('--apply');

async function main() {
  console.log(`\n🔍 Mode: ${DRY_RUN ? 'DRY-RUN (no changes written)' : '✅ APPLY (writing to DB)'}\n`);

  // Fetch every installment transaction that belongs to a statement
  const txs = await prisma.transaction.findMany({
    where: {
      isInstallment: true,
      statementId: { not: null },
    },
    include: {
      statement: { select: { month: true, bank: true } },
    },
    orderBy: [{ statement: { month: 'asc' } }, { merchant: 'asc' }],
  });

  console.log(`Found ${txs.length} installment transactions\n`);

  let changed = 0;
  let alreadyCorrect = 0;

  for (const tx of txs) {
    const stmtMonth = tx.statement?.month; // e.g. "2026-01"
    if (!stmtMonth) continue;

    const [year, month] = stmtMonth.split('-').map(Number);
    // Canonical billing date: 1st of the statement month, UTC midnight
    const billingDate = new Date(Date.UTC(year, month - 1, 1));

    const currentDate = new Date(tx.date);
    const currentYM = `${currentDate.getUTCFullYear()}-${String(currentDate.getUTCMonth() + 1).padStart(2, '0')}`;

    if (currentYM === stmtMonth) {
      alreadyCorrect++;
      continue; // already correct, skip
    }

    console.log(
      `  [${tx.statement?.bank ?? '?'}] ${stmtMonth} | ${tx.merchant.padEnd(35)} ` +
      `cuota ${tx.installmentNum}/${tx.installmentTotal} | ` +
      `${currentDate.toISOString().slice(0, 10)} → ${billingDate.toISOString().slice(0, 10)}`
    );

    if (!DRY_RUN) {
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { date: billingDate },
      });
    }

    changed++;
  }

  console.log(`\n─────────────────────────────────────────`);
  console.log(`  Already correct : ${alreadyCorrect}`);
  console.log(`  To be updated   : ${changed}`);
  if (DRY_RUN && changed > 0) {
    console.log(`\n  Run with --apply to commit these changes.`);
  } else if (!DRY_RUN) {
    console.log(`\n  ✅ ${changed} transactions updated.`);
  }
  console.log();
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
