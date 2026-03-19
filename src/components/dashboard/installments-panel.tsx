'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { formatCurrency } from '@/src/lib/utils';
import { Skeleton } from '@/src/components/ui/skeleton';

interface Installment {
  id: string;
  merchant: string;
  description: string;
  bank: string | null;
  amount: number;
  installmentNum: number;
  installmentTotal: number;
  remaining: number;
  currency: string;
}

interface InstallmentsData {
  installments: Installment[];
  totalMonthly: number;
  totalDebt: number;
}

interface Props {
  statementId?: string;
  month?: string;
}

export function InstallmentsPanel({ statementId, month }: Props) {
  const [data, setData] = useState<InstallmentsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statementId) params.set('statementId', statementId);
    else if (month) params.set('month', month);

    fetch(`/api/installments?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [statementId, month]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-zinc-900">Cuotas activas</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[120px] w-full" />
        </CardContent>
      </Card>
    );
  }
  if (!data || !Array.isArray(data.installments) || data.installments.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-zinc-900">Cuotas activas</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Compra</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Banco / Tarjeta</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-500">Cuota mensual</th>
                <th className="px-4 py-3 text-center font-medium text-zinc-500">Progreso</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-500">Deuda restante</th>
              </tr>
            </thead>
            <tbody>
              {data.installments.map((inst) => {
                const pct = Math.round((inst.installmentNum / inst.installmentTotal) * 100);
                return (
                  <tr key={inst.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-900">{inst.merchant}</p>
                      <p className="text-xs text-zinc-400">{inst.description}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600 capitalize">
                      {inst.bank?.toLowerCase() ?? <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-zinc-900">
                      {formatCurrency(inst.amount, inst.currency)}/mes
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs text-zinc-500">
                          Cuota {inst.installmentNum} de {inst.installmentTotal}
                        </span>
                        <div className="h-1.5 w-full max-w-[100px] rounded-full bg-zinc-100">
                          <div
                            className="h-1.5 rounded-full bg-[var(--primary)]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-red-600 font-medium">
                      {formatCurrency(inst.remaining, inst.currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-zinc-200 bg-zinc-50">
              <tr>
                <td colSpan={2} className="px-4 py-3 font-semibold text-zinc-700">Totales</td>
                <td className="px-4 py-3 text-right font-bold text-zinc-900">
                  {formatCurrency(data.totalMonthly)}/mes
                </td>
                <td />
                <td className="px-4 py-3 text-right font-bold text-red-600">
                  {formatCurrency(data.totalDebt)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
