import type { ITransactionRepository, TransactionSummary } from '@/src/domain/repositories/transaction.repository';
import type { Transaction, CreateTransactionInput } from '@/src/domain/entities/transaction';

/** In-memory ITransactionRepository for use-case unit tests. Filters are applied only where a test needs them. */
export function createMockTransactionRepo(existing: Transaction[] = []): ITransactionRepository {
  const store: Transaction[] = [...existing];
  let idCounter = 0;

  const byUser = (userId: string) => store.filter((t) => t.userId === userId);

  return {
    findById: async (id) => store.find((t) => t.id === id) ?? null,
    findByUserId: async (userId, filters) => {
      let rows = byUser(userId);
      if (filters?.categoryId) rows = rows.filter((t) => t.categoryId === filters.categoryId);
      if (filters?.reviewStatus) rows = rows.filter((t) => t.reviewStatus === filters.reviewStatus);
      if (filters?.transactionType) rows = rows.filter((t) => t.transactionType === filters.transactionType);
      if (typeof filters?.skip === 'number') rows = rows.slice(filters.skip);
      if (typeof filters?.take === 'number') rows = rows.slice(0, filters.take);
      return rows;
    },
    countByUserId: async (userId, filters) => {
      let rows = byUser(userId);
      if (filters?.categoryId) rows = rows.filter((t) => t.categoryId === filters.categoryId);
      return rows.length;
    },
    aggregateByUserId: async (userId): Promise<TransactionSummary> => {
      const rows = byUser(userId);
      const expenses = rows.filter((t) => t.amount < 0).reduce((sum, t) => sum + t.amount, 0);
      const income = rows.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
      return { expenses, income, count: rows.length };
    },
    findInstallmentGroup: async (userId, merchant, installmentTotal) =>
      byUser(userId).filter((t) => t.merchant === merchant && t.installmentTotal === installmentTotal),
    findTrackingByMonth: async (userId, month) =>
      byUser(userId).filter((t) => t.origin === 'tracking' && t.accountingMonth === month),
    findTrackingMonths: async (userId) =>
      Array.from(new Set(byUser(userId).filter((t) => t.origin === 'tracking').map((t) => t.accountingMonth))).sort().reverse(),
    create: async (data: CreateTransactionInput) => {
      const tx: Transaction = {
        id: `tx-${++idCounter}`,
        notes: null,
        bank: '',
        accountType: '',
        origin: 'manual',
        accountingMonth: '',
        reviewStatus: 'pending',
        transactionType: 'expense',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      store.push(tx);
      return tx;
    },
    createMany: async (data) => {
      data.forEach((d) =>
        store.push({
          id: `tx-${++idCounter}`,
          notes: null,
          bank: '',
          accountType: '',
          origin: 'manual',
          accountingMonth: '',
          reviewStatus: 'pending',
          transactionType: 'expense',
          createdAt: new Date(),
          updatedAt: new Date(),
          ...d,
        })
      );
    },
    createManyAndReturn: async (data) => {
      const inserted = data.map((d) => ({
        id: `tx-${++idCounter}`,
        notes: null,
        bank: '',
        accountType: '',
        origin: 'manual',
        accountingMonth: '',
        reviewStatus: 'pending' as const,
        transactionType: 'expense' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...d,
      }));
      store.push(...inserted);
      return inserted;
    },
    update: async (id, data) => {
      const tx = store.find((t) => t.id === id);
      if (!tx) throw new Error('Transaction not found');
      // Mirrors Prisma semantics: an explicit `undefined` means "don't touch this field".
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) (tx as unknown as Record<string, unknown>)[key] = value;
      }
      return tx;
    },
    updateMany: async (ids, userId, data) => {
      const rows = store.filter((t) => ids.includes(t.id) && t.userId === userId);
      const entries = Object.entries(data).filter(([, value]) => value !== undefined);
      rows.forEach((t) => entries.forEach(([key, value]) => {
        (t as unknown as Record<string, unknown>)[key] = value;
      }));
      return rows.length;
    },
    confirmAllPending: async (userId) => {
      const rows = byUser(userId).filter((t) => t.reviewStatus === 'pending');
      rows.forEach((t) => (t.reviewStatus = 'confirmed'));
      return rows.length;
    },
    delete: async (id) => {
      const idx = store.findIndex((t) => t.id === id);
      if (idx >= 0) store.splice(idx, 1);
    },
    deleteManyByIds: async (ids, userId) => {
      const before = store.length;
      const remaining = store.filter((t) => !(ids.includes(t.id) && t.userId === userId));
      store.length = 0;
      store.push(...remaining);
      return before - store.length;
    },
    deleteManyTracking: async (userId, month, bank, accountType) => {
      const remaining = store.filter((t) => {
        if (t.userId !== userId || t.origin !== 'tracking') return true;
        if (month && t.accountingMonth !== month) return true;
        if (bank && t.bank !== bank) return true;
        if (accountType && t.accountType !== accountType) return true;
        return false;
      });
      store.length = 0;
      store.push(...remaining);
    },
  };
}
