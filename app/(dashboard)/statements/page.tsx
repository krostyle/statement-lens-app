import { StatementsView } from '@/src/components/statements/statement-list';

export default function StatementsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Extractos bancarios</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Sube estados de cuenta (tarjeta) y cartolas (cuenta corriente / RUT)</p>
      </div>
      <StatementsView />
    </div>
  );
}
