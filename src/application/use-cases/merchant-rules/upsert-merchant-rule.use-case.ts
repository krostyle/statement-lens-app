import type { IMerchantRuleRepository } from '@/src/domain/repositories/merchant-rule.repository';
import type { ICategoryRepository } from '@/src/domain/repositories/category.repository';
import type { MerchantRule } from '@/src/domain/entities/merchant-rule';
import { normalizeMerchant } from '@/src/domain/entities/merchant-rule';

export class UpsertMerchantRuleUseCase {
  constructor(
    private readonly merchantRuleRepo: IMerchantRuleRepository,
    private readonly categoryRepo: ICategoryRepository,
  ) {}

  async execute(userId: string, merchant: string, categoryId: string): Promise<MerchantRule> {
    // Validate that the category belongs to this user
    const categories = await this.categoryRepo.findByUserId(userId);
    if (!categories.some((c) => c.id === categoryId)) {
      throw new Error('Categoría no válida');
    }

    const pattern = normalizeMerchant(merchant);
    if (!pattern) throw new Error('El nombre del comercio no puede estar vacío');

    return this.merchantRuleRepo.upsert(userId, pattern, categoryId);
  }
}
