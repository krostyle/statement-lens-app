import { describe, it, expect } from 'vitest';
import { Money } from './money';

describe('Money', () => {
  it('isExpense returns true for negative amounts', () => {
    expect(new Money(-100).isExpense()).toBe(true);
  });

  it('isExpense returns false for positive amounts', () => {
    expect(new Money(100).isExpense()).toBe(false);
  });

  it('isCredit returns true for positive amounts', () => {
    expect(new Money(500).isCredit()).toBe(true);
  });

  it('isCredit returns false for negative amounts', () => {
    expect(new Money(-500).isCredit()).toBe(false);
  });

  it('abs returns a new Money with absolute value', () => {
    const m = new Money(-200, 'CLP').abs();
    expect(m.amount).toBe(200);
    expect(m.currency).toBe('CLP');
  });

  it('add works with same currency', () => {
    const result = new Money(100, 'CLP').add(new Money(50, 'CLP'));
    expect(result.amount).toBe(150);
  });

  it('add throws with different currencies', () => {
    expect(() => new Money(100, 'CLP').add(new Money(50, 'USD'))).toThrow(
      'Cannot add amounts with different currencies'
    );
  });

  it('format returns formatted currency string', () => {
    const formatted = new Money(-10000, 'CLP').format();
    expect(formatted).toContain('10');
  });

  it('defaults currency to CLP', () => {
    expect(new Money(100).currency).toBe('CLP');
  });
});
