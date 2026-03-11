'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { formatCurrency } from '@/src/lib/utils';

interface Merchant { merchant: string; total: number; count: number }

interface Props {
  metricsUrl: string;
}

export function SpendingChart({ metricsUrl }: Props) {
  const [merchants, setMerchants] = useState<Merchant[]>([]);

  useEffect(() => {
    fetch(metricsUrl)
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((m) => setMerchants(m.topMerchants ?? []))
      .catch(() => setMerchants([]));
  }, [metricsUrl]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top 10 comercios</CardTitle>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-left text-zinc-500">
              <th className="pb-2 font-medium">Comercio</th>
              <th className="pb-2 font-medium text-right">Transacciones</th>
              <th className="pb-2 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {merchants.map((m, i) => {
              const max = merchants[0]?.total ?? 1;
              const pct = Math.round((m.total / max) * 100);
              return (
                <tr key={i} className="border-b border-zinc-50 hover:bg-zinc-50">
                  <td className="py-2 text-zinc-900">
                    <span className="block">{m.merchant}</span>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-100">
                      <div
                        className="h-1.5 rounded-full bg-brand-600"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </td>
                  <td className="py-2 text-right text-zinc-500">×{m.count}</td>
                  <td className="py-2 text-right font-medium text-zinc-900">{formatCurrency(m.total)}</td>
                </tr>
              );
            })}
            {merchants.length === 0 && (
              <tr><td colSpan={3} className="py-4 text-center text-zinc-400">Sin datos</td></tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
