'use client';

import { useEffect, useState } from 'react';
import { DialogContent, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { formatCurrency, formatDate } from '@/src/lib/utils';
import { Badge } from '@/src/components/ui/badge';
import { Skeleton } from '@/src/components/ui/skeleton';
import type { StatementResponseDTO } from '@/src/application/dtos/statement.dto';

interface StatementTransaction {
  id: string;
  date: string;
  merchant: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  isInstallment: boolean;
  installmentNum: number | null;
  installmentTotal: number | null;
}

interface Props {
  statement: StatementResponseDTO;
}

export function StatementTransactions({ statement }: Props) {
  const [transactions, setTransactions] = useState<StatementTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/statements/${statement.id}/transactions`)
      .then((r) => r.json())
      .then((data) => setTransactions(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [statement.id]);

  const bankLabel = statement.bank.charAt(0).toUpperCase() + statement.bank.slice(1);

  return (
    <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
      <DialogHeader>
        <DialogTitle>
          {bankLabel} — {statement.month.includes('-') ? statement.month.split('-').reverse().join('-') : statement.month}
        </DialogTitle>
        <p className="text-sm text-zinc-500">{statement.fileName}</p>
      </DialogHeader>

      <div className="overflow-auto flex-1 rounded-lg border border-zinc-200">
        {loading ? (
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-b border-zinc-100 bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Fecha</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Comercio</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Categoría</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-500">Monto</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-zinc-50">
                  <td className="px-4 py-2.5"><Skeleton className="h-4 w-20" /></td>
                  <td className="px-4 py-2.5"><Skeleton className="h-4 w-36" /></td>
                  <td className="px-4 py-2.5"><Skeleton className="h-5 w-20 rounded-full" /></td>
                  <td className="px-4 py-2.5 text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : transactions.length === 0 ? (
          <div className="py-12 text-center text-sm text-zinc-400">Sin transacciones</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-b border-zinc-100 bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Fecha</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Comercio</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Categoría</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-500">Monto</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                  <td className="px-4 py-2.5 text-zinc-500">{formatDate(t.date)}</td>
                  <td className="px-4 py-2.5 text-zinc-900 font-medium">
                    {t.merchant}
                    {t.isInstallment && t.installmentNum && t.installmentTotal && (
                      <span className="ml-1.5 text-xs text-zinc-400">
                        ({t.installmentNum}/{t.installmentTotal})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant="secondary">{t.category}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium text-zinc-900">
                    {formatCurrency(t.amount, t.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-zinc-400 text-right">
        {transactions.length} transacción(es)
      </p>
    </DialogContent>
  );
}
