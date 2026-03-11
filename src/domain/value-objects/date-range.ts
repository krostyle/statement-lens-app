export class DateRange {
  constructor(
    public readonly from: Date,
    public readonly to: Date
  ) {
    if (from > to) {
      throw new Error('DateRange: "from" must be before or equal to "to"');
    }
  }

  static currentMonth(): DateRange {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return new DateRange(from, to);
  }

  static lastNMonths(n: number): DateRange {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - n + 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return new DateRange(from, to);
  }

  contains(date: Date): boolean {
    return date >= this.from && date <= this.to;
  }
}
