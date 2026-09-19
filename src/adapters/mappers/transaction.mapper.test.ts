import { describe, it, expect } from 'vitest';
import { toTransactionDTO } from './transaction.mapper';
import type { Transaction } from '@/src/domain/entities/transaction';

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    userId: 'user-1',
    categoryId: 'cat-1',
    date: new Date('2024-03-15T00:00:00.000Z'),
    description: 'Supermercado',
    merchant: 'Lider',
    amount: -15000,
    currency: 'CLP',
    bank: 'santander',
    accountType: 'credit_card',
    isInstallment: false,
    installmentNum: null,
    installmentTotal: null,
    notes: null,
    reviewStatus: 'pending',
    transactionType: 'expense',
    origin: 'manual',
    accountingMonth: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('toTransactionDTO', () => {
  it('maps a domain Transaction to its response DTO, formatting the date as ISO', () => {
    const dto = toTransactionDTO(makeTransaction());

    expect(dto).toEqual({
      id: 'tx-1',
      userId: 'user-1',
      bank: 'santander',
      accountType: 'credit_card',
      categoryId: 'cat-1',
      date: '2024-03-15T00:00:00.000Z',
      description: 'Supermercado',
      merchant: 'Lider',
      amount: -15000,
      currency: 'CLP',
      isInstallment: false,
      installmentNum: null,
      installmentTotal: null,
      notes: null,
      reviewStatus: 'pending',
      transactionType: 'expense',
    });
  });

  it('defaults bank and accountType to empty string when falsy', () => {
    const dto = toTransactionDTO(makeTransaction({ bank: '', accountType: '' }));
    expect(dto.bank).toBe('');
    expect(dto.accountType).toBe('');
  });

  it('defaults transactionType to expense when missing', () => {
    const dto = toTransactionDTO(makeTransaction({ transactionType: undefined as unknown as Transaction['transactionType'] }));
    expect(dto.transactionType).toBe('expense');
  });
});
