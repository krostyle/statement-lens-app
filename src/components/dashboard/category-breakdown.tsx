'use client';

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { formatCurrency } from '@/src/lib/utils';

const COLORS = ['#f97316','#ef4444','#3b82f6','#22c55e','#a855f7','#ec4899','#6366f1','#f59e0b','#14b8a6','#0ea5e9','#84cc16','#6b7280'];

interface Props {
  metricsUrl: string;
}

export function CategoryBreakdown({ metricsUrl }: Props) {
  const [data, setData] = useState<{ categoryId: string; total: number; name?: string }[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(metricsUrl).then((r) => r.ok ? r.json() : Promise.reject(r.status)),
      fetch('/api/categories').then((r) => r.json()),
    ]).then(([metrics, categories]) => {
      const cats = Array.isArray(categories) ? categories : [];
      const catMap = new Map(cats.map((c: { id: string; name: string }) => [c.id, c.name]));
      setData(
        (metrics.topCategories ?? []).map((tc: { categoryId: string; total: number }) => ({
          ...tc,
          name: catMap.get(tc.categoryId) ?? tc.categoryId,
        }))
      );
    });
  }, [metricsUrl]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gasto por categoría</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={data} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => formatCurrency(Number(v))} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
