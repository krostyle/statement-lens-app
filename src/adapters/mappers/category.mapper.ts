import type { Category } from '@/src/domain/entities/category';
import type { CategoryResponseDTO } from '@/src/application/dtos/category.dto';

export function toCategoryDTO(c: Category): CategoryResponseDTO {
  return {
    id: c.id,
    userId: c.userId,
    name: c.name,
    color: c.color,
    icon: c.icon,
    isDefault: c.isDefault,
  };
}
