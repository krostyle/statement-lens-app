import { describe, it, expect } from 'vitest';
import { ListMerchantRulesUseCase } from './list-merchant-rules.use-case';
import { createMockMerchantRuleRepo } from '@/src/test/mocks/merchant-rule-repository.mock';
import type { MerchantRule } from '@/src/domain/entities/merchant-rule';

function makeRule(overrides: Partial<MerchantRule> = {}): MerchantRule {
  return {
    id: 'rule-1',
    userId: 'user-1',
    merchantPattern: 'lider',
    bank: '',
    categoryId: 'cat-1',
    transactionType: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('ListMerchantRulesUseCase', () => {
  it('returns only rules belonging to the user', async () => {
    const repo = createMockMerchantRuleRepo([
      makeRule({ id: 'r-1', userId: 'user-1' }),
      makeRule({ id: 'r-2', userId: 'other-user' }),
    ]);
    const useCase = new ListMerchantRulesUseCase(repo);

    const result = await useCase.execute('user-1');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('r-1');
  });
});
