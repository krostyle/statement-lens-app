import { CategoriesView } from '@/src/components/categories/category-list';

export default function CategoriesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Categorías</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Administra tus categorías de gasto</p>
      </div>
      <CategoriesView />
    </div>
  );
}
