// Dependency injection container — returns pre-wired use-case instances

import { UserProfilePrismaRepository } from './database/repositories/user-profile.prisma.repository';
import { CategoryPrismaRepository } from './database/repositories/category.prisma.repository';
import { StatementPrismaRepository } from './database/repositories/statement.prisma.repository';
import { TransactionPrismaRepository } from './database/repositories/transaction.prisma.repository';
import { BudgetPrismaRepository } from './database/repositories/budget.prisma.repository';
import { MonthClosePrismaRepository } from './database/repositories/month-close.prisma.repository';
import { S3StorageService } from './storage/s3.storage.service';
import { PdfParserService } from './ai/pdf-parser.service';
import { FinancialAnalysisService } from './ai/financial-analysis.service';
import { BudgetRecommendationService } from './ai/budget-recommendation.service';
import { MonthCloseSuggestionsService } from './ai/month-close-suggestions.service';

import { CreateCategoryUseCase } from '@/src/application/use-cases/categories/create-category.use-case';
import { UpdateCategoryUseCase } from '@/src/application/use-cases/categories/update-category.use-case';
import { DeleteCategoryUseCase } from '@/src/application/use-cases/categories/delete-category.use-case';
import { ListCategoriesUseCase } from '@/src/application/use-cases/categories/list-categories.use-case';
import { CreateTransactionUseCase } from '@/src/application/use-cases/transactions/create-transaction.use-case';
import { UpdateTransactionUseCase } from '@/src/application/use-cases/transactions/update-transaction.use-case';
import { DeleteTransactionUseCase } from '@/src/application/use-cases/transactions/delete-transaction.use-case';
import { BulkUpdateTransactionsUseCase } from '@/src/application/use-cases/transactions/bulk-update-transactions.use-case';
import { ListTransactionsUseCase } from '@/src/application/use-cases/transactions/list-transactions.use-case';
import { ListStatementsUseCase } from '@/src/application/use-cases/statements/list-statements.use-case';
import { UpdateStatementUseCase } from '@/src/application/use-cases/statements/update-statement.use-case';
import { AnalyzeFinancesUseCase } from '@/src/application/use-cases/analysis/analyze-finances.use-case';
import { ListBudgetsUseCase } from '@/src/application/use-cases/budgets/list-budgets.use-case';
import { UpsertBudgetUseCase } from '@/src/application/use-cases/budgets/upsert-budget.use-case';
import { RecommendBudgetsUseCase } from '@/src/application/use-cases/budgets/recommend-budgets.use-case';
import { CreateMonthCloseUseCase } from '@/src/application/use-cases/month-closes/create-month-close.use-case';
import { GetMonthCloseUseCase } from '@/src/application/use-cases/month-closes/get-month-close.use-case';
import { ListMonthClosesUseCase } from '@/src/application/use-cases/month-closes/list-month-closes.use-case';

// Repositories
export const userProfileRepo = new UserProfilePrismaRepository();
const categoryRepo = new CategoryPrismaRepository();
const statementRepo = new StatementPrismaRepository();
const transactionRepo = new TransactionPrismaRepository();
export const budgetRepo = new BudgetPrismaRepository();
export const monthCloseRepo = new MonthClosePrismaRepository();

// Services
export const s3Service = new S3StorageService();
export const pdfParser = new PdfParserService();
export const financialAnalysisService = new FinancialAnalysisService();
const monthCloseSuggestionsService = new MonthCloseSuggestionsService();

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

export const listStatementsUseCase = new ListStatementsUseCase(statementRepo);
export const updateStatementUseCase = new UpdateStatementUseCase(statementRepo);
export const analyzeFinancesUseCase = new AnalyzeFinancesUseCase(transactionRepo, financialAnalysisService);

export const listBudgetsUseCase = new ListBudgetsUseCase(budgetRepo);
export const upsertBudgetUseCase = new UpsertBudgetUseCase(budgetRepo, categoryRepo);
export const budgetRecommendationService = new BudgetRecommendationService();
export const recommendBudgetsUseCase = new RecommendBudgetsUseCase(
  transactionRepo, categoryRepo, budgetRepo, userProfileRepo, budgetRecommendationService
);

export const createMonthCloseUseCase = new CreateMonthCloseUseCase(
  monthCloseRepo, budgetRepo, transactionRepo, categoryRepo, monthCloseSuggestionsService
);
export const getMonthCloseUseCase = new GetMonthCloseUseCase(
  monthCloseRepo, budgetRepo, transactionRepo, categoryRepo,
);
export const listMonthClosesUseCase = new ListMonthClosesUseCase(monthCloseRepo);

// Raw repos (needed in some API routes)
export { categoryRepo, statementRepo, transactionRepo };
