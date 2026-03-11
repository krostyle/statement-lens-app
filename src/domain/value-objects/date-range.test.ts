import { describe, it, expect } from 'vitest';
import { DateRange } from './date-range';

describe('DateRange', () => {
  it('throws when from is after to', () => {
    const later = new Date('2024-06-01');
    const earlier = new Date('2024-01-01');
    expect(() => new DateRange(later, earlier)).toThrow('"from" must be before or equal to "to"');
  });

  it('allows from equal to to', () => {
    const d = new Date('2024-01-01');
    expect(() => new DateRange(d, d)).not.toThrow();
  });

  it('currentMonth returns a range within the current month', () => {
    const range = DateRange.currentMonth();
    const now = new Date();
    expect(range.from.getMonth()).toBe(now.getMonth());
    expect(range.to.getMonth()).toBe(now.getMonth());
    expect(range.from.getDate()).toBe(1);
  });

  it('lastNMonths covers n months ending this month', () => {
    const range = DateRange.lastNMonths(3);
    const now = new Date();
    expect(range.to.getMonth()).toBe(now.getMonth());
    // from should be 2 months before current month's start
    const expectedFromMonth = (now.getMonth() - 2 + 12) % 12;
    expect(range.from.getMonth()).toBe(expectedFromMonth);
  });

  it('contains returns true for dates within range', () => {
    const range = new DateRange(new Date('2024-01-01'), new Date('2024-12-31'));
    expect(range.contains(new Date('2024-06-15'))).toBe(true);
  });

  it('contains returns false for dates outside range', () => {
    const range = new DateRange(new Date('2024-01-01'), new Date('2024-12-31'));
    expect(range.contains(new Date('2025-01-01'))).toBe(false);
  });
});
