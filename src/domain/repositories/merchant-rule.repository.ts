import type { MerchantRule } from '../entities/merchant-rule';

export interface IMerchantRuleRepository {
  findByUserId(userId: string): Promise<MerchantRule[]>;
  findById(id: string): Promise<MerchantRule | null>;
  upsert(userId: string, merchantPattern: string, bank: string, categoryId: string): Promise<MerchantRule>;
  delete(id: string, userId: string): Promise<void>;
}
