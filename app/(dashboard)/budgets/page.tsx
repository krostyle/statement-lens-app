import { BudgetsView } from '@/src/components/budgets/budgets-view';

export default function PresupuestosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Presupuestos</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Define cuánto quieres gastar por categoría cada mes</p>
      </div>
      <BudgetsView />
    </div>
  );
}
