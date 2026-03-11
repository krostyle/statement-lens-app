import type { Category } from '../entities/category';

export interface DefaultCategoryDefinition {
  name: string;
  color: string;
  icon: string;
}

export const DEFAULT_CATEGORIES: DefaultCategoryDefinition[] = [
  { name: 'Alimentación', color: '#f97316', icon: 'ShoppingCart' },
  { name: 'Restaurantes', color: '#ef4444', icon: 'UtensilsCrossed' },
  { name: 'Transporte', color: '#3b82f6', icon: 'Car' },
  { name: 'Salud', color: '#22c55e', icon: 'Heart' },
  { name: 'Entretenimiento', color: '#a855f7', icon: 'Tv' },
  { name: 'Suscripciones', color: '#ec4899', icon: 'RefreshCw' },
  { name: 'Tecnología', color: '#6366f1', icon: 'Laptop' },
  { name: 'Vestuario', color: '#f59e0b', icon: 'Shirt' },
  { name: 'Hogar', color: '#14b8a6', icon: 'Home' },
  { name: 'Educación', color: '#0ea5e9', icon: 'BookOpen' },
  { name: 'Viajes', color: '#84cc16', icon: 'Plane' },
  { name: 'Otros', color: '#6b7280', icon: 'MoreHorizontal' },
];

export function getCategoryNames(categories: Category[]): string[] {
  return categories.map((c) => c.name);
}
