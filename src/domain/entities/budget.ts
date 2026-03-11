export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  monthlyAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateBudgetInput = Pick<Budget, 'userId' | 'categoryId' | 'monthlyAmount'>;
