import type { IMerchantRuleRepository } from '@/src/domain/repositories/merchant-rule.repository';

export class DeleteMerchantRuleUseCase {
  constructor(private readonly merchantRuleRepo: IMerchantRuleRepository) {}

  async execute(id: string, userId: string): Promise<void> {
    const rule = await this.merchantRuleRepo.findById(id);
    if (!rule) throw new Error('Regla no encontrada');
    if (rule.userId !== userId) throw new Error('Forbidden');
    await this.merchantRuleRepo.delete(id, userId);
  }
}
