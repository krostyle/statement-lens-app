'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { formatCurrency } from '@/src/lib/utils';
import { Skeleton } from '@/src/components/ui/skeleton';
import type { BudgetResponseDTO } from '@/src/application/use-cases/budgets/list-budgets.use-case';
import type { CategoryResponseDTO } from '@/src/application/dtos/category.dto';

interface TopCategory {
  categoryId: string;
  total: number;
}

interface BudgetComparisonProps {
  metricsUrl: string;
  periodLabel?: string;
}

export function BudgetComparison({ metricsUrl, periodLabel }: BudgetComparisonProps) {
  const [budgets, setBudgets] = useState<BudgetResponseDTO[]>([]);
  const [topCategories, setTopCategories] = useState<TopCategory[]>([]);
  const [categories, setCategories] = useState<CategoryResponseDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/budgets').then((r) => r.json()),
      fetch(metricsUrl).then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
    ])
      .then(([b, m, c]) => {
        setBudgets(Array.isArray(b) ? b : []);
        setTopCategories(Array.isArray(m?.topCategories) ? m.topCategories : []);
        setCategories(Array.isArray(c) ? c : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [metricsUrl]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Presupuestos vs Gasto real</CardTitle>
          {periodLabel && <p className="text-xs text-zinc-400 mt-0.5">{periodLabel}</p>}
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 w-4 rounded-full shrink-0" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-20 shrink-0" />
              <Skeleton className="h-4 w-20 shrink-0" />
              <Skeleton className="h-4 w-24 shrink-0" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const spendMap = new Map(topCategories.map((c) => [c.categoryId, c]));
  const categoryNameMap = new Map(categories.map((c) => [c.id, c.name]));

  // Only show categories that have a budget defined AND have spending in the period
  const rows = budgets
    .filter((b) => spendMap.has(b.categoryId))
    .map((b) => {
      const spend = spendMap.get(b.categoryId)!;
      const diff = b.monthlyAmount - spend.total;
      const overBudget = spend.total > b.monthlyAmount;
      const name = categoryNameMap.get(b.categoryId) ?? b.categoryId;
      return { ...b, name, spent: spend.total, diff, overBudget };
    });

  if (budgets.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Presupuestos vs Gasto real</CardTitle>
          {periodLabel && <p className="text-xs text-zinc-400 mt-0.5">{periodLabel}</p>}
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-500">
            No tienes presupuestos definidos.{' '}
            <Link href="/budgets" className="text-brand-600 hover:underline font-medium">
              Define tus presupuestos
            </Link>{' '}
            para ver la comparativa aquí.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Presupuestos vs Gasto real</CardTitle>
          {periodLabel && <p className="text-xs text-zinc-400 mt-0.5">{periodLabel}</p>}
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-500">
            Ninguna categoría con presupuesto tiene gastos en el período seleccionado.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalMeta = rows.reduce((sum, r) => sum + r.monthlyAmount, 0);
  const totalGastado = rows.reduce((sum, r) => sum + r.spent, 0);
  const totalDiff = totalMeta - totalGastado;
  const totalOver = totalGastado > totalMeta;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Presupuestos vs Gasto real</CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <div className="min-w-[320px] divide-y divide-zinc-100">
          {rows.map((row) => (
            <div key={row.categoryId} className="flex items-center gap-3 px-4 py-3">
              <div className="shrink-0">
                {row.overBudget ? (
                  <XCircle className="h-4 w-4 text-red-500" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                )}
              </div>
              <span className="flex-1 text-sm font-medium text-zinc-800 truncate">{row.name}</span>
              <div className="flex items-center gap-3 sm:gap-6 text-sm shrink-0">
                <div className="text-right">
                  <p className="text-xs text-zinc-400">Meta</p>
                  <p className="font-medium text-zinc-700">{formatCurrency(row.monthlyAmount)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-zinc-400">Gastado</p>
                  <p className={`font-medium ${row.overBudget ? 'text-red-600' : 'text-zinc-700'}`}>
                    {formatCurrency(row.spent)}
                  </p>
                </div>
                <div className="text-right w-24">
                  <p className="text-xs text-zinc-400">Diferencia</p>
                  <p className={`font-semibold ${row.overBudget ? 'text-red-600' : 'text-emerald-600'}`}>
                    {row.overBudget ? '+' : '-'}{formatCurrency(Math.abs(row.diff))}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 px-4 py-3 border-t-2 border-zinc-200 bg-zinc-50">
          <div className="shrink-0 w-4" />
          <span className="flex-1 text-sm font-bold text-zinc-700">Total</span>
          <div className="flex items-center gap-3 sm:gap-6 text-sm shrink-0">
            <div className="text-right">
              <p className="font-bold text-zinc-900">{formatCurrency(totalMeta)}</p>
            </div>
            <div className="text-right">
              <p className={`font-bold ${totalOver ? 'text-red-600' : 'text-zinc-900'}`}>
                {formatCurrency(totalGastado)}
              </p>
            </div>
            <div className="text-right w-24">
              <p className={`font-bold ${totalOver ? 'text-red-600' : 'text-emerald-600'}`}>
                {totalOver ? '+' : '-'}{formatCurrency(Math.abs(totalDiff))}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
