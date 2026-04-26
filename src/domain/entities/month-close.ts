export interface CategorySummary {
  categoryId: string;
  categoryName: string;
  budgeted: number;
  spent: number;
  difference: number;    // positive = under budget, negative = over budget
  isOverBudget: boolean;
  percentUsed: number;   // 0-100+
}

export interface MonthClose {
  id: string;
  userId: string;
  month: string;           // "YYYY-MM"
  totalSpent: number;
  totalBudget: number;
  summary: CategorySummary[];
  aiSuggestions: string;
  notes: string | null;
  closedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateMonthCloseInput = Pick<
  MonthClose,
  'userId' | 'month' | 'totalSpent' | 'totalBudget' | 'summary' | 'aiSuggestions' | 'notes'
>;
