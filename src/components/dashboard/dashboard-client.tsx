'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/src/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { MonthPicker } from '@/src/components/ui/month-picker';
import { MetricsCards } from './metrics-cards';
import { CategoryBreakdown } from './category-breakdown';
import { MonthlyComparison } from './monthly-comparison';
import { SpendingChart } from './spending-chart';
import { AnalysisPanel } from './analysis-panel';
import { BudgetComparison } from './budget-comparison';
import { InstallmentsPanel } from './installments-panel';
import { CategoryTrends } from './category-trends';
import type { StatementResponseDTO } from '@/src/application/dtos/statement.dto';

type FilterMode = 'statement' | 'month';

export function DashboardClient() {
  const [statements, setStatements] = useState<StatementResponseDTO[]>([]);
  const [filterMode, setFilterMode] = useState<FilterMode>('statement');
  const [selectedStatementId, setSelectedStatementId] = useState('none');
  const [selectedMonth, setSelectedMonth] = useState('');

  useEffect(() => {
    fetch('/api/statements')
      .then((r) => r.json())
      .then((data) => setStatements(Array.isArray(data) ? data : []));
  }, []);

  const metricsUrl = (() => {
    if (filterMode === 'statement' && selectedStatementId !== 'none') {
      return `/api/metrics?statementId=${selectedStatementId}`;
    }
    if (filterMode === 'month' && selectedMonth) {
      return `/api/metrics?month=${selectedMonth}`;
    }
    return '/api/metrics';
  })();

  const analysisStatementId = filterMode === 'statement' && selectedStatementId !== 'none' ? selectedStatementId : undefined;
  const analysisMonth = filterMode === 'month' ? selectedMonth : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Resumen de tus finanzas personales</p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Segmented control */}
        <div className="flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 gap-0.5">
          <Button
            variant={filterMode === 'statement' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilterMode('statement')}
          >
            Estado de cuenta
          </Button>
          <Button
            variant={filterMode === 'month' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilterMode('month')}
          >
            Por mes
          </Button>
        </div>
        {filterMode === 'statement' && (
          <Select value={selectedStatementId} onValueChange={setSelectedStatementId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Seleccionar estado..." />
            </SelectTrigger>
            <SelectContent>
              {statements.map((s) => {
                const [year, month] = s.month.split('-');
                const label = `${s.bank} — ${month}-${year}`;
                return (
                  <SelectItem key={s.id} value={s.id}>
                    {label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        )}
        {filterMode === 'month' && (
          <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
        )}
      </div>

      <MetricsCards metricsUrl={metricsUrl} />

      <BudgetComparison metricsUrl={metricsUrl} />

      <InstallmentsPanel />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CategoryBreakdown metricsUrl={metricsUrl} />
        <MonthlyComparison metricsUrl={metricsUrl} />
      </div>

      <SpendingChart metricsUrl={metricsUrl} />

      <CategoryTrends />

      <AnalysisPanel statementId={analysisStatementId} month={analysisMonth} />
    </div>
  );
}
