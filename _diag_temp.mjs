import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const miAmorcito = await prisma.category.findFirst({ where: { name: 'Mi Amorcito' } });
  console.log('--- Mi Amorcito category ---');
  console.log(miAmorcito ? { id: miAmorcito.id, userId: miAmorcito.userId, excludeFromBudget: miAmorcito.excludeFromBudget, isFixed: miAmorcito.isFixed } : 'NOT FOUND');

  if (!miAmorcito) { await prisma.$disconnect(); return; }

  const falabellaTxs = await prisma.transaction.findMany({
    where: { bank: 'falabella', origin: 'tracking' },
    orderBy: [{ accountingMonth: 'asc' }, { date: 'asc' }],
    select: { id: true, date: true, description: true, amount: true, accountingMonth: true, categoryId: true, isInstallment: true, installmentTotal: true },
  });
  console.log(`\nTotal falabella tracking txs: ${falabellaTxs.length}`);

  const byMonthCat = {};
  for (const t of falabellaTxs) {
    byMonthCat[t.accountingMonth] ??= { total: 0, miAmorcito: 0 };
    byMonthCat[t.accountingMonth].total++;
    if (t.categoryId === miAmorcito.id) byMonthCat[t.accountingMonth].miAmorcito++;
  }
  console.log('\n--- Falabella txs per accountingMonth: total vs Mi Amorcito ---');
  for (const [month, c] of Object.entries(byMonthCat).sort()) {
    console.log(`${month}: total=${c.total} miAmorcito=${c.miAmorcito}`);
  }

  const groups = {};
  for (const t of falabellaTxs) {
    if (!t.isInstallment) continue;
    const key = `${t.description}|${t.amount}`;
    groups[key] ??= new Set();
    groups[key].add(t.accountingMonth);
  }
  console.log('\n--- Installment groups (description|amount) -> months present ---');
  for (const [key, months] of Object.entries(groups)) {
    const sorted = [...months].sort();
    console.log(`${key} -> [${sorted.join(', ')}]`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
