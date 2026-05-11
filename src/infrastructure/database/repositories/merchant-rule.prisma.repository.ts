import type { IMerchantRuleRepository } from '@/src/domain/repositories/merchant-rule.repository';
import type { MerchantRule } from '@/src/domain/entities/merchant-rule';
import { prisma } from '../prisma.client';

export class MerchantRulePrismaRepository implements IMerchantRuleRepository {
  async findByUserId(userId: string): Promise<MerchantRule[]> {
    return prisma.merchantRule.findMany({
      where: { userId },
      orderBy: { merchantPattern: 'asc' },
    }) as Promise<MerchantRule[]>;
  }

  async findById(id: string): Promise<MerchantRule | null> {
    return prisma.merchantRule.findUnique({ where: { id } }) as Promise<MerchantRule | null>;
  }

  async upsert(userId: string, merchantPattern: string, bank: string, categoryId: string, transactionType?: string | null): Promise<MerchantRule> {
    // Use findFirst + update/create instead of Prisma's upsert() so we don't
    // depend on the composite unique index being recognised as a constraint
    // (the migration might have created it as a raw INDEX, not a CONSTRAINT).
    const existing = await prisma.merchantRule.findFirst({
      where: { userId, merchantPattern, bank },
    });

    if (existing) {
      return prisma.merchantRule.update({
        where: { id: existing.id },
        data: { categoryId, transactionType: transactionType ?? null },
      }) as Promise<MerchantRule>;
    }

    return prisma.merchantRule.create({
      data: { userId, merchantPattern, bank, categoryId, transactionType: transactionType ?? null },
    }) as Promise<MerchantRule>;
  }

  async delete(id: string, userId: string): Promise<void> {
    await prisma.merchantRule.deleteMany({ where: { id, userId } });
  }
}
