import { describe, it, expect, beforeEach } from 'vitest';
import { DeleteMerchantRuleUseCase } from './delete-merchant-rule.use-case';
import { createMockMerchantRuleRepo } from '@/src/test/mocks/merchant-rule-repository.mock';
import type { MerchantRule } from '@/src/domain/entities/merchant-rule';
import type { IMerchantRuleRepository } from '@/src/domain/repositories/merchant-rule.repository';

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

describe('DeleteMerchantRuleUseCase', () => {
  let repo: IMerchantRuleRepository;
  let useCase: DeleteMerchantRuleUseCase;

  beforeEach(() => {
    repo = createMockMerchantRuleRepo([makeRule()]);
    useCase = new DeleteMerchantRuleUseCase(repo);
  });

  it('deletes a rule owned by the user', async () => {
    await useCase.execute('rule-1', 'user-1');
    expect(await repo.findById('rule-1')).toBeNull();
  });

  it('throws when the rule does not exist', async () => {
    await expect(useCase.execute('rule-missing', 'user-1')).rejects.toThrow('Regla no encontrada');
  });

  it('throws Forbidden and does not delete when owned by another user', async () => {
    await expect(useCase.execute('rule-1', 'other-user')).rejects.toThrow('Forbidden');
    expect(await repo.findById('rule-1')).not.toBeNull();
  });
});
