'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { formatCurrency } from '@/src/lib/utils';

interface TrendsData {
  months: string[];
  series: { name: string; data: number[] }[];
}

const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

const MONTH_LABELS: Record<string, string> = {
  '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
};

function shortMonth(m: string) {
  const [, month] = m.split('-');
  return MONTH_LABELS[month] ?? m;
}

export function CategoryTrends() {
  const [data, setData] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/metrics/category-trends')
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!data || data.months.length === 0 || data.series.length === 0) return null;

  // Transform into recharts format: [{month: 'Ene', Cat1: 100, Cat2: 200}, ...]
  const chartData = data.months.map((m, i) => {
    const point: Record<string, string | number> = { month: shortMonth(m) };
    for (const serie of data.series) {
      point[serie.name] = serie.data[i] ?? 0;
    }
    return point;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-zinc-900">Tendencias por categoría</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#71717a' }} />
            <YAxis
              tick={{ fontSize: 12, fill: '#71717a' }}
              tickFormatter={(v) => formatCurrency(v)}
              width={80}
            />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e4e4e7' }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {data.series.map((serie, i) => (
              <Line
                key={serie.name}
                type="monotone"
                dataKey={serie.name}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
