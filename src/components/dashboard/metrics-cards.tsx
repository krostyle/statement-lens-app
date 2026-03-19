'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, Calendar } from 'lucide-react';
import { formatCurrency } from '@/src/lib/utils';
import { Skeleton } from '@/src/components/ui/skeleton';
import type { MetricsFilterMode } from '@/src/adapters/presenters/metrics.presenter';

interface MetricsData {
  filterMode: MetricsFilterMode;
  currentMonthTotal: number;
  previousMonthTotal: number;
  percentChange: number;
  dailyAverage: number;
  topCategories: { categoryId: string; total: number }[];
}

interface Props {
  metricsUrl: string;
}

export function MetricsCards({ metricsUrl }: Props) {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(metricsUrl)
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then(setMetrics)
      .catch(() => setMetrics(null))
      .finally(() => setLoading(false));
  }, [metricsUrl]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-24 mb-2" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!metrics) return null;

  const isStatement = metrics.filterMode === 'statement';
  const isUp = metrics.percentChange > 0;

  const currentLabel = isStatement ? 'Gasto este estado' : 'Gasto este mes';
  const previousLabel = isStatement ? 'Estado anterior' : 'Mes anterior';
  const hasPrevious = metrics.previousMonthTotal > 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-sm font-medium text-zinc-500">
            {currentLabel}
            <DollarSign className="h-4 w-4 text-zinc-400" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-zinc-900">{formatCurrency(metrics.currentMonthTotal)}</p>
          {hasPrevious && (
            <p className={`mt-1 flex items-center gap-1 text-xs ${isUp ? 'text-red-500' : 'text-green-500'}`}>
              {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(metrics.percentChange).toFixed(1)}% vs {isStatement ? 'estado anterior' : 'mes anterior'}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-sm font-medium text-zinc-500">
            {previousLabel}
            <DollarSign className="h-4 w-4 text-zinc-400" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-zinc-900">
            {hasPrevious ? formatCurrency(metrics.previousMonthTotal) : <span className="text-zinc-400 text-base">Sin estado anterior</span>}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-sm font-medium text-zinc-500">
            Promedio diario
            <Calendar className="h-4 w-4 text-zinc-400" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-zinc-900">{formatCurrency(metrics.dailyAverage)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-sm font-medium text-zinc-500">
            Top categoría
            <TrendingUp className="h-4 w-4 text-zinc-400" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-zinc-900">
            {metrics.topCategories[0] ? formatCurrency(metrics.topCategories[0].total) : '$0'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
