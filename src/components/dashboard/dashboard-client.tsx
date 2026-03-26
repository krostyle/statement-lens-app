'use client';

import { useState } from 'react';
import { MonthPicker } from '@/src/components/ui/month-picker';
import { MetricsCards } from './metrics-cards';
import { CategoryBreakdown } from './category-breakdown';
import { MonthlyComparison } from './monthly-comparison';
import { SpendingChart } from './spending-chart';
import { AnalysisPanel } from './analysis-panel';
import { BudgetComparison } from './budget-comparison';
import { InstallmentsPanel } from './installments-panel';
import { CategoryTrends } from './category-trends';

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export function DashboardClient() {
  const [selectedMonth, setSelectedMonth] = useState('');

  const metricsUrl = selectedMonth ? `/api/metrics?month=${selectedMonth}` : '/api/metrics';

  const periodLabel = (() => {
    if (selectedMonth) {
      const [y, m] = selectedMonth.split('-');
      return `${MONTHS_ES[Number(m) - 1]} ${y} · todos los estados`;
    }
    const now = new Date();
    return `${MONTHS_ES[now.getMonth()]} ${now.getFullYear()} · mes actual`;
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Resumen de tus finanzas personales</p>
        </div>
        <MonthPicker value={selectedMonth} onChange={setSelectedMonth} placeholder="Mes actual" />
      </div>

      <MetricsCards metricsUrl={metricsUrl} />

      <BudgetComparison metricsUrl={metricsUrl} periodLabel={periodLabel} />

      <InstallmentsPanel />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CategoryBreakdown metricsUrl={metricsUrl} />
        <MonthlyComparison metricsUrl={metricsUrl} />
      </div>

      <SpendingChart metricsUrl={metricsUrl} />

      <CategoryTrends />

      <AnalysisPanel month={selectedMonth || undefined} />
    </div>
  );
}
