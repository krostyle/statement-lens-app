'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, Calendar, ArrowDownLeft, PiggyBank } from 'lucide-react';
import { formatCurrency } from '@/src/lib/utils';
import { Skeleton } from '@/src/components/ui/skeleton';
import type { MetricsFilterMode } from '@/src/adapters/presenters/metrics.presenter';

interface MetricsData {
  filterMode: MetricsFilterMode;
  currentMonthTotal: number;
  previousMonthTotal: number;
  percentChange: number;
  dailyAverage: number;
  totalIncome: number;
  savingsRate: number | null;
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

  const hasIncome = (metrics?.totalIncome ?? 0) > 0;
  // Base 4 cards; add 2 more if income data exists
  const totalCards = hasIncome ? 6 : 4;

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

  const isUp = metrics.percentChange > 0;
  const hasPrevious = metrics.previousMonthTotal > 0;

  // Grid columns: 4 by default, 3 if we have 6 cards (3×2 looks better than 6×1)
  const gridCols = totalCards === 6
    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';

  return (
    <div className={`grid gap-4 ${gridCols}`}>
      {/* Gasto este mes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-sm font-medium text-zinc-500">
            Gasto este mes
            <DollarSign className="h-4 w-4 text-zinc-400" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-zinc-900">{formatCurrency(metrics.currentMonthTotal)}</p>
          {hasPrevious && (
            <p className={`mt-1 flex items-center gap-1 text-xs ${isUp ? 'text-red-500' : 'text-green-500'}`}>
              {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(metrics.percentChange).toFixed(1)}% vs mes anterior
            </p>
          )}
        </CardContent>
      </Card>

      {/* Mes anterior */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-sm font-medium text-zinc-500">
            Mes anterior
            <DollarSign className="h-4 w-4 text-zinc-400" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-zinc-900">
            {hasPrevious ? formatCurrency(metrics.previousMonthTotal) : <span className="text-zinc-400 text-base">Sin datos</span>}
          </p>
        </CardContent>
      </Card>

      {/* Promedio diario */}
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

      {/* Top categoría */}
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

      {/* Ingresos del mes — only shown when checking account data exists */}
      {hasIncome && (
        <Card className="border-green-200 bg-green-50/40">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-sm font-medium text-green-700">
              Ingresos del mes
              <ArrowDownLeft className="h-4 w-4 text-green-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-700">{formatCurrency(metrics.totalIncome)}</p>
            <p className="mt-1 text-xs text-green-600">Desde cuenta corriente</p>
          </CardContent>
        </Card>
      )}

      {/* Tasa de ahorro — only shown when income exists */}
      {hasIncome && metrics.savingsRate !== null && (
        <Card className={metrics.savingsRate >= 0 ? 'border-green-200 bg-green-50/40' : 'border-red-200 bg-red-50/40'}>
          <CardHeader>
            <CardTitle className={`flex items-center justify-between text-sm font-medium ${metrics.savingsRate >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              Tasa de ahorro
              <PiggyBank className={`h-4 w-4 ${metrics.savingsRate >= 0 ? 'text-green-500' : 'text-red-400'}`} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${metrics.savingsRate >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              {metrics.savingsRate}%
            </p>
            <p className={`mt-1 text-xs ${metrics.savingsRate >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {metrics.savingsRate >= 0 ? 'del ingreso ahorrado' : 'sobre el ingreso gastado'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
