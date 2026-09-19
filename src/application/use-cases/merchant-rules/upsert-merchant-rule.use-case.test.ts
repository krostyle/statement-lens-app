import { describe, it, expect } from 'vitest';
import { UpsertMerchantRuleUseCase } from './upsert-merchant-rule.use-case';
import { createMockMerchantRuleRepo } from '@/src/test/mocks/merchant-rule-repository.mock';
import { createMockCategoryRepo } from '@/src/test/mocks/category-repository.mock';
import type { Category } from '@/src/domain/entities/category';

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-1',
    userId: 'user-1',
    name: 'Alimentación',
    color: '#f97316',
    icon: 'ShoppingCart',
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('UpsertMerchantRuleUseCase', () => {
  it('creates a rule with a normalized (lowercase, trimmed) merchant pattern', async () => {
    const useCase = new UpsertMerchantRuleUseCase(
      createMockMerchantRuleRepo(),
      createMockCategoryRepo([makeCategory()])
    );

    const rule = await useCase.execute('user-1', '  Lider  ', '', 'cat-1');

    expect(rule.merchantPattern).toBe('lider');
    expect(rule.categoryId).toBe('cat-1');
    expect(rule.transactionType).toBeNull();
  });

  it('throws when the category does not belong to the user', async () => {
    const useCase = new UpsertMerchantRuleUseCase(
      createMockMerchantRuleRepo(),
      createMockCategoryRepo([makeCategory({ userId: 'other-user' })])
    );

    await expect(useCase.execute('user-1', 'Lider', '', 'cat-1')).rejects.toThrow('Categoría no válida');
  });

  it('throws when the merchant name is empty after normalization', async () => {
    const useCase = new UpsertMerchantRuleUseCase(
      createMockMerchantRuleRepo(),
      createMockCategoryRepo([makeCategory()])
    );

    await expect(useCase.execute('user-1', '   ', '', 'cat-1')).rejects.toThrow(
      'El nombre del comercio no puede estar vacío'
    );
  });

  it('updates the category of an existing rule for the same merchant+bank instead of duplicating it', async () => {
    const repo = createMockMerchantRuleRepo();
    const catRepo = createMockCategoryRepo([
      makeCategory({ id: 'cat-1' }),
      makeCategory({ id: 'cat-2', name: 'Transporte' }),
    ]);
    const useCase = new UpsertMerchantRuleUseCase(repo, catRepo);

    await useCase.execute('user-1', 'Lider', '', 'cat-1');
    await useCase.execute('user-1', 'lider', '', 'cat-2');

    const rules = await repo.findByUserId('user-1');
    expect(rules).toHaveLength(1);
    expect(rules[0].categoryId).toBe('cat-2');
  });
});
