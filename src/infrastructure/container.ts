// Dependency injection container — returns pre-wired use-case instances

import { UserProfilePrismaRepository } from './database/repositories/user-profile.prisma.repository';
import { CategoryPrismaRepository } from './database/repositories/category.prisma.repository';
import { TransactionPrismaRepository } from './database/repositories/transaction.prisma.repository';
import { BudgetPrismaRepository } from './database/repositories/budget.prisma.repository';
import { MerchantRulePrismaRepository } from './database/repositories/merchant-rule.prisma.repository';
import { SnapshotPrismaRepository } from './database/repositories/snapshot.prisma.repository';
import { RawSnapshotParserService } from './ai/raw-snapshot-parser.service';
import { FinancialAnalysisService } from './ai/financial-analysis.service';
import { FinancialChatService } from './ai/financial-chat.service';

import { CreateCategoryUseCase } from '@/src/application/use-cases/categories/create-category.use-case';
import { UpdateCategoryUseCase } from '@/src/application/use-cases/categories/update-category.use-case';
import { DeleteCategoryUseCase } from '@/src/application/use-cases/categories/delete-category.use-case';
import { ListCategoriesUseCase } from '@/src/application/use-cases/categories/list-categories.use-case';
import { CreateTransactionUseCase } from '@/src/application/use-cases/transactions/create-transaction.use-case';
import { UpdateTransactionUseCase } from '@/src/application/use-cases/transactions/update-transaction.use-case';
import { DeleteTransactionUseCase } from '@/src/application/use-cases/transactions/delete-transaction.use-case';
import { BulkUpdateTransactionsUseCase } from '@/src/application/use-cases/transactions/bulk-update-transactions.use-case';
import { ListTransactionsUseCase } from '@/src/application/use-cases/transactions/list-transactions.use-case';
import { AnalyzeFinancesUseCase } from '@/src/application/use-cases/analysis/analyze-finances.use-case';
import { ListBudgetsUseCase } from '@/src/application/use-cases/budgets/list-budgets.use-case';
import { UpsertBudgetUseCase } from '@/src/application/use-cases/budgets/upsert-budget.use-case';
import { RecommendBudgetsUseCase } from '@/src/application/use-cases/budgets/recommend-budgets.use-case';
import { ListMerchantRulesUseCase } from '@/src/application/use-cases/merchant-rules/list-merchant-rules.use-case';
import { UpsertMerchantRuleUseCase } from '@/src/application/use-cases/merchant-rules/upsert-merchant-rule.use-case';
import { DeleteMerchantRuleUseCase } from '@/src/application/use-cases/merchant-rules/delete-merchant-rule.use-case';
import { FinancialChatUseCase } from '@/src/application/use-cases/chat/financial-chat.use-case';

// Repositories
export const userProfileRepo = new UserProfilePrismaRepository();
const categoryRepo = new CategoryPrismaRepository();
const transactionRepo = new TransactionPrismaRepository();
export const budgetRepo = new BudgetPrismaRepository();
export const merchantRuleRepo = new MerchantRulePrismaRepository();
export const snapshotRepo = new SnapshotPrismaRepository();

// Services
export const rawSnapshotParser = new RawSnapshotParserService();
export const financialAnalysisService = new FinancialAnalysisService();
export const financialChatService = new FinancialChatService();

// Use cases
export const createCategoryUseCase = new CreateCategoryUseCase(categoryRepo);
export const updateCategoryUseCase = new UpdateCategoryUseCase(categoryRepo);
export const deleteCategoryUseCase = new DeleteCategoryUseCase(categoryRepo);
export const listCategoriesUseCase = new ListCategoriesUseCase(categoryRepo);

export const createTransactionUseCase = new CreateTransactionUseCase(transactionRepo, categoryRepo);
export const updateTransactionUseCase = new UpdateTransactionUseCase(transactionRepo);
export const deleteTransactionUseCase = new DeleteTransactionUseCase(transactionRepo);
export const bulkUpdateTransactionsUseCase = new BulkUpdateTransactionsUseCase(transactionRepo, categoryRepo);
export const listTransactionsUseCase = new ListTransactionsUseCase(transactionRepo);

export const analyzeFinancesUseCase = new AnalyzeFinancesUseCase(transactionRepo, financialAnalysisService);

export const listBudgetsUseCase = new ListBudgetsUseCase(budgetRepo);
export const upsertBudgetUseCase = new UpsertBudgetUseCase(budgetRepo, categoryRepo);
export const recommendBudgetsUseCase = new RecommendBudgetsUseCase(
  transactionRepo, categoryRepo, budgetRepo, userProfileRepo
);

export const listMerchantRulesUseCase = new ListMerchantRulesUseCase(merchantRuleRepo);
export const upsertMerchantRuleUseCase = new UpsertMerchantRuleUseCase(merchantRuleRepo, categoryRepo);
export const deleteMerchantRuleUseCase = new DeleteMerchantRuleUseCase(merchantRuleRepo);

export const financialChatUseCase = new FinancialChatUseCase(
  transactionRepo, categoryRepo, budgetRepo, userProfileRepo, snapshotRepo, financialChatService
);

// Raw repos (needed in some API routes)
export { categoryRepo, transactionRepo };
