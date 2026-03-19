// Dependency injection container — returns pre-wired use-case instances

import { UserPrismaRepository } from './database/repositories/user.prisma.repository';
import { CategoryPrismaRepository } from './database/repositories/category.prisma.repository';
import { StatementPrismaRepository } from './database/repositories/statement.prisma.repository';
import { TransactionPrismaRepository } from './database/repositories/transaction.prisma.repository';
import { BudgetPrismaRepository } from './database/repositories/budget.prisma.repository';
import { NodemailerEmailService } from './email/email.service';
import { S3StorageService } from './storage/s3.storage.service';
import { PdfParserService } from './ai/pdf-parser.service';
import { FinancialAnalysisService } from './ai/financial-analysis.service';
import { BudgetRecommendationService } from './ai/budget-recommendation.service';

import { RegisterUseCase } from '@/src/application/use-cases/auth/register.use-case';
import { ForgotPasswordUseCase, ResetPasswordUseCase } from '@/src/application/use-cases/auth/recover-password.use-case';
import { CreateCategoryUseCase } from '@/src/application/use-cases/categories/create-category.use-case';
import { UpdateCategoryUseCase } from '@/src/application/use-cases/categories/update-category.use-case';
import { DeleteCategoryUseCase } from '@/src/application/use-cases/categories/delete-category.use-case';
import { ListCategoriesUseCase } from '@/src/application/use-cases/categories/list-categories.use-case';
import { CreateTransactionUseCase } from '@/src/application/use-cases/transactions/create-transaction.use-case';
import { UpdateTransactionUseCase } from '@/src/application/use-cases/transactions/update-transaction.use-case';
import { DeleteTransactionUseCase } from '@/src/application/use-cases/transactions/delete-transaction.use-case';
import { ListTransactionsUseCase } from '@/src/application/use-cases/transactions/list-transactions.use-case';
import { ListStatementsUseCase } from '@/src/application/use-cases/statements/list-statements.use-case';
import { UpdateStatementUseCase } from '@/src/application/use-cases/statements/update-statement.use-case';
import { AnalyzeFinancesUseCase } from '@/src/application/use-cases/analysis/analyze-finances.use-case';
import { ListBudgetsUseCase } from '@/src/application/use-cases/budgets/list-budgets.use-case';
import { UpsertBudgetUseCase } from '@/src/application/use-cases/budgets/upsert-budget.use-case';
import { RecommendBudgetsUseCase } from '@/src/application/use-cases/budgets/recommend-budgets.use-case';

// Repositories
const userRepo = new UserPrismaRepository();
const categoryRepo = new CategoryPrismaRepository();
const statementRepo = new StatementPrismaRepository();
const transactionRepo = new TransactionPrismaRepository();
export const budgetRepo = new BudgetPrismaRepository();

// Services
const emailService = new NodemailerEmailService();
export const s3Service = new S3StorageService();
export const pdfParser = new PdfParserService();
export const financialAnalysisService = new FinancialAnalysisService();

// Use cases
export const registerUseCase = new RegisterUseCase(userRepo, categoryRepo);
export const forgotPasswordUseCase = new ForgotPasswordUseCase(
  userRepo,
  emailService,
  process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
);
export const resetPasswordUseCase = new ResetPasswordUseCase(userRepo);

export const createCategoryUseCase = new CreateCategoryUseCase(categoryRepo);
export const updateCategoryUseCase = new UpdateCategoryUseCase(categoryRepo);
export const deleteCategoryUseCase = new DeleteCategoryUseCase(categoryRepo);
export const listCategoriesUseCase = new ListCategoriesUseCase(categoryRepo);

export const createTransactionUseCase = new CreateTransactionUseCase(transactionRepo, categoryRepo);
export const updateTransactionUseCase = new UpdateTransactionUseCase(transactionRepo);
export const deleteTransactionUseCase = new DeleteTransactionUseCase(transactionRepo);
export const listTransactionsUseCase = new ListTransactionsUseCase(transactionRepo);

export const listStatementsUseCase = new ListStatementsUseCase(statementRepo);
export const updateStatementUseCase = new UpdateStatementUseCase(statementRepo);
export const analyzeFinancesUseCase = new AnalyzeFinancesUseCase(transactionRepo, financialAnalysisService);

export const listBudgetsUseCase = new ListBudgetsUseCase(budgetRepo);
export const upsertBudgetUseCase = new UpsertBudgetUseCase(budgetRepo, categoryRepo);
export const budgetRecommendationService = new BudgetRecommendationService();
export const recommendBudgetsUseCase = new RecommendBudgetsUseCase(
  transactionRepo, categoryRepo, budgetRepo, budgetRecommendationService
);

// Raw repos (needed in some API routes)
export { userRepo, categoryRepo, statementRepo, transactionRepo };
