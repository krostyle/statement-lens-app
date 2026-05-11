'use client';

import { useEffect, useState } from 'react';
import { FileText, ExternalLink, BarChart2 } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Skeleton } from '@/src/components/ui/skeleton';

const MONTH_NAMES: Record<string, string> = {
  '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
  '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
  '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre',
};

function formatMonth(month: string) {
  const [y, m] = month.split('-');
  return `${MONTH_NAMES[m] ?? m} ${y}`;
}

function MonthList({
  months,
  loading,
  emptyText,
  href,
  icon,
}: {
  months: string[];
  loading: boolean;
  emptyText: string;
  href: (m: string) => string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
      {loading && (
        <div className="divide-y divide-zinc-100">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-4">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-8 w-28" />
            </div>
          ))}
        </div>
      )}
      {!loading && months.length === 0 && (
        <div className="px-5 py-10 text-center text-zinc-400 text-sm">{emptyText}</div>
      )}
      {!loading && months.length > 0 && (
        <div className="divide-y divide-zinc-100">
          {months.map((month) => (
            <div key={month} className="flex items-center justify-between px-5 py-4 hover:bg-zinc-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                  {icon}
                </div>
                <div>
                  <p className="font-semibold text-zinc-900 text-sm">{formatMonth(month)}</p>
                  <p className="text-xs text-zinc-400">{month}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => window.open(href(month), '_blank')}>
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Ver reporte
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ReportsView() {
  const [months, setMonths] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [snapshotMonths, setSnapshotMonths] = useState<string[]>([]);
  const [snapshotLoading, setSnapshotLoading] = useState(true);

  useEffect(() => {
    fetch('/api/reports/months')
      .then((r) => r.json())
      .then((d) => setMonths(d.months ?? []))
      .finally(() => setLoading(false));
    fetch('/api/snapshot/months')
      .then((r) => r.json())
      .then((d) => setSnapshotMonths(d.months ?? []))
      .finally(() => setSnapshotLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-700 mb-1">Transacciones</h2>
          <p className="text-sm text-zinc-500">
            Reporte detallado con gastos, presupuesto, cuotas activas y tendencia de los últimos meses.
          </p>
        </div>
        <MonthList
          months={months}
          loading={loading}
          emptyText="No hay transacciones registradas aún. Sube un extracto para comenzar."
          href={(m) => `/api/reports?month=${m}`}
          icon={<FileText className="h-4 w-4 text-brand-600" />}
        />
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-700 mb-1">Seguimiento</h2>
          <p className="text-sm text-zinc-500">
            Reportes generados desde cartolas CSV subidas en la página de seguimiento.
          </p>
        </div>
        <MonthList
          months={snapshotMonths}
          loading={snapshotLoading}
          emptyText="No hay cartolas de seguimiento cargadas aún."
          href={(m) => `/api/snapshot/report?month=${m}`}
          icon={<BarChart2 className="h-4 w-4 text-brand-600" />}
        />
      </div>
    </div>
  );
}
