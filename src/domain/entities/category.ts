export interface Category {
  id: string;
  userId: string;
  name: string;
  color: string;
  icon?: string | null;
  type?: 'needs' | 'wants' | null;
  isDefault: boolean;
  /** Spend in this category is always fully reimbursed (e.g. an additional card holder's
   *  purchases) — excluded from budget/spend totals, but still shown in category breakdowns. */
  excludeFromBudget: boolean;
  /** A committed, non-negotiable expense (e.g. rent) — purely a visual label, doesn't affect any calculation. */
  isFixed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateCategoryInput = Pick<Category, 'userId' | 'name' | 'color' | 'icon' | 'isDefault'> &
  Partial<Pick<Category, 'excludeFromBudget' | 'isFixed'>>;
export type UpdateCategoryInput = Partial<Pick<Category, 'name' | 'color' | 'icon' | 'type' | 'excludeFromBudget' | 'isFixed'>>;
