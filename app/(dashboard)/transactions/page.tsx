import { TransactionsView } from '@/src/components/transactions/transaction-table';

export default function TransactionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Transacciones</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Historial de movimientos financieros</p>
      </div>
      <TransactionsView />
    </div>
  );
}
