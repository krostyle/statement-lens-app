export class Money {
  constructor(
    public readonly amount: number,
    public readonly currency: string = 'CLP'
  ) {}

  isExpense(): boolean {
    return this.amount < 0;
  }

  isCredit(): boolean {
    return this.amount > 0;
  }

  abs(): Money {
    return new Money(Math.abs(this.amount), this.currency);
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error('Cannot add amounts with different currencies');
    }
    return new Money(this.amount + other.amount, this.currency);
  }

  format(): string {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: this.currency,
      minimumFractionDigits: 0,
    }).format(Math.abs(this.amount));
  }
}
