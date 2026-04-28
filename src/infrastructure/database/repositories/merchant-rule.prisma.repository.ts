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

  async upsert(userId: string, merchantPattern: string, bank: string, categoryId: string): Promise<MerchantRule> {
    return prisma.merchantRule.upsert({
      where: { userId_merchantPattern_bank: { userId, merchantPattern, bank } },
      update: { categoryId },
      create: { userId, merchantPattern, bank, categoryId },
    }) as Promise<MerchantRule>;
  }

  async delete(id: string, userId: string): Promise<void> {
    await prisma.merchantRule.deleteMany({ where: { id, userId } });
  }
}
