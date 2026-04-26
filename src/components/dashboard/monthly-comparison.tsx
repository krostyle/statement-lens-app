'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { formatCurrency } from '@/src/lib/utils';
import { Skeleton } from '@/src/components/ui/skeleton';

interface Props {
  metricsUrl: string;
}

export function MonthlyComparison({ metricsUrl }: Props) {
  const [data, setData] = useState<{ month: string; total: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(metricsUrl)
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((m) => setData(m.monthlyTrend ?? []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [metricsUrl]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Comparativa mensual</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[240px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comparativa mensual</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 12 }} width={80} />
            <Tooltip formatter={(v) => formatCurrency(Number(v))} />
            <Bar dataKey="total" fill="#18181b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
