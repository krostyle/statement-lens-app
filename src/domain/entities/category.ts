export interface Category {
  id: string;
  userId: string;
  name: string;
  color: string;
  icon?: string | null;
  type?: 'needs' | 'wants' | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateCategoryInput = Pick<Category, 'userId' | 'name' | 'color' | 'icon' | 'isDefault'>;
export type UpdateCategoryInput = Partial<Pick<Category, 'name' | 'color' | 'icon' | 'type'>>;
