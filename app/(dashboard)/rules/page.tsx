import { RulesView } from '@/src/components/rules/rules-view';

export const metadata = { title: 'Reglas de comercio — Statement Lens' };

export default function RulesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Reglas de comercio</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Asocia comercios a categorías para que se clasifiquen automáticamente al subir tus movimientos.
        </p>
      </div>
      <RulesView />
    </div>
  );
}
