export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  month: string; // "YYYY-MM"
  monthlyAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateBudgetInput = Pick<Budget, 'userId' | 'categoryId' | 'month' | 'monthlyAmount'>;
