import type { IMerchantRuleRepository } from '@/src/domain/repositories/merchant-rule.repository';
import type { MerchantRule } from '@/src/domain/entities/merchant-rule';

/** In-memory IMerchantRuleRepository for use-case unit tests. */
export function createMockMerchantRuleRepo(existing: MerchantRule[] = []): IMerchantRuleRepository {
  const store: MerchantRule[] = [...existing];
  let idCounter = 0;

  return {
    findByUserId: async (userId) => store.filter((r) => r.userId === userId),
    findById: async (id) => store.find((r) => r.id === id) ?? null,
    upsert: async (userId, merchantPattern, bank, categoryId, transactionType = null) => {
      const found = store.find(
        (r) => r.userId === userId && r.merchantPattern === merchantPattern && r.bank === bank
      );
      if (found) {
        found.categoryId = categoryId;
        found.transactionType = transactionType;
        found.updatedAt = new Date();
        return found;
      }
      const rule: MerchantRule = {
        id: `rule-${++idCounter}`,
        userId,
        merchantPattern,
        bank,
        categoryId,
        transactionType,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.push(rule);
      return rule;
    },
    delete: async (id, userId) => {
      const idx = store.findIndex((r) => r.id === id && r.userId === userId);
      if (idx >= 0) store.splice(idx, 1);
    },
    bulkUpdateTransactionType: async (userId, ids, transactionType) => {
      const rows = store.filter((r) => r.userId === userId && ids.includes(r.id));
      rows.forEach((r) => (r.transactionType = transactionType));
      return rows;
    },
  };
}
