export interface CreateCategoryDTO {
  name: string;
  color: string;
  icon?: string;
  excludeFromBudget?: boolean;
  isFixed?: boolean;
}

export interface UpdateCategoryDTO {
  name?: string;
  color?: string;
  icon?: string;
  type?: 'needs' | 'wants' | null;
  excludeFromBudget?: boolean;
  isFixed?: boolean;
}

export interface CategoryResponseDTO {
  id: string;
  userId: string;
  name: string;
  color: string;
  icon?: string | null;
  type?: 'needs' | 'wants' | null;
  isDefault: boolean;
  excludeFromBudget: boolean;
  isFixed: boolean;
}
