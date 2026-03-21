export interface CreateCategoryDTO {
  name: string;
  color: string;
  icon?: string;
}

export interface UpdateCategoryDTO {
  name?: string;
  color?: string;
  icon?: string;
  type?: 'needs' | 'wants' | null;
}

export interface CategoryResponseDTO {
  id: string;
  userId: string;
  name: string;
  color: string;
  icon?: string | null;
  type?: 'needs' | 'wants' | null;
  isDefault: boolean;
}
