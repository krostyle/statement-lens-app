import { MonthClosesView } from '@/src/components/month-closes/month-closes-view';

export default function CierreDeMesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Cierre de mes</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Análisis mensual de presupuestos y sugerencias IA</p>
      </div>
      <MonthClosesView />
    </div>
  );
}
