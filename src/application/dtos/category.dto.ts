export interface CreateCategoryDTO {
  name: string;
  color: string;
  icon?: string;
}

export interface UpdateCategoryDTO {
  name?: string;
  color?: string;
  icon?: string;
}

export interface CategoryResponseDTO {
  id: string;
  userId: string;
  name: string;
  color: string;
  icon?: string | null;
  isDefault: boolean;
}
