import { StatementsView } from '@/src/components/statements/statement-list';

export default function StatementsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Estados de cuenta</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Sube y consulta tus estados de cuenta</p>
      </div>
      <StatementsView />
    </div>
  );
}
