/**
 * Migrates all user data from the old Prisma User (UUID) to the new
 * UserProfile model (Clerk user ID).
 *
 * Usage:
 *   $env:DATABASE_URL="postgresql://..."; npx tsx scripts/migrate-userid-to-clerk.ts <clerk-user-id>
 *   $env:DATABASE_URL="postgresql://..."; npx tsx scripts/migrate-userid-to-clerk.ts <clerk-user-id> --apply
 *
 * Without --apply it runs as a dry-run and only prints what would change.
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const apply = process.argv.includes('--apply');
const clerkId = process.argv.find((a) => a.startsWith('user_'));

if (!clerkId) {
  console.error('❌  Pass the Clerk user ID as an argument: npx tsx scripts/migrate-userid-to-clerk.ts user_xxxx [--apply]');
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as Parameters<typeof PrismaClient>[0]);

async function main() {
  console.log(`\nClerk user ID : ${clerkId}`);
  console.log(`Mode          : ${apply ? '🔴 APPLY (writes to DB)' : '🟡 DRY-RUN (no changes)'}\n`);

  // Count rows that will be migrated
  const [statements, categories, transactions, budgets] = await Promise.all([
    prisma.statement.count(),
    prisma.category.count(),
    prisma.transaction.count(),
    prisma.budget.count(),
  ]);

  console.log(`Rows to migrate:`);
  console.log(`  Statements   : ${statements}`);
  console.log(`  Categories   : ${categories}`);
  console.log(`  Transactions : ${transactions}`);
  console.log(`  Budgets      : ${budgets}`);
  console.log('');

  if (!apply) {
    console.log('Run with --apply to execute the migration.');
    return;
  }

  // 1. Create UserProfile
  console.log('Creating UserProfile...');
  await prisma.$executeRawUnsafe(
    `INSERT INTO "UserProfile" ("clerkId") VALUES ($1) ON CONFLICT ("clerkId") DO NOTHING`,
    clerkId
  );

  // 2. Update all userId FK columns to the Clerk user ID
  console.log('Updating Statement.userId...');
  await prisma.$executeRawUnsafe(`UPDATE "Statement" SET "userId" = $1`, clerkId);

  console.log('Updating Category.userId...');
  await prisma.$executeRawUnsafe(`UPDATE "Category" SET "userId" = $1`, clerkId);

  console.log('Updating Transaction.userId...');
  await prisma.$executeRawUnsafe(`UPDATE "Transaction" SET "userId" = $1`, clerkId);

  console.log('Updating Budget.userId...');
  await prisma.$executeRawUnsafe(`UPDATE "Budget" SET "userId" = $1`, clerkId);

  // 3. Drop the old User table rows (cascade already handled FKs)
  console.log('Removing old User records...');
  await prisma.$executeRawUnsafe(`DELETE FROM "User"`);

  console.log('\n✅  Migration complete!');
}

main()
  .catch((e) => { console.error('❌ ', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
