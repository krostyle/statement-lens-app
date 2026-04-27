import type { IMerchantRuleRepository } from '@/src/domain/repositories/merchant-rule.repository';
import type { MerchantRule } from '@/src/domain/entities/merchant-rule';

export class ListMerchantRulesUseCase {
  constructor(private readonly merchantRuleRepo: IMerchantRuleRepository) {}

  async execute(userId: string): Promise<MerchantRule[]> {
    return this.merchantRuleRepo.findByUserId(userId);
  }
}
