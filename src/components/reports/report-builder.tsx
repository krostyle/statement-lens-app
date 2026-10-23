'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Printer, RotateCcw } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Skeleton } from '@/src/components/ui/skeleton';
import type { ReportDataDTO } from '@/src/application/use-cases/reports/get-report-data.use-case';
import { buildReportModel, type ReportModel } from '@/src/adapters/presenters/report.presenter';
import {
  bankLabel,
  DEFAULT_REPORT_FILTERS,
  filterReportTransactions,
  groupExpenses,
  OTHER_SLICE_KEY,
  sliceByDimension,
  SOURCE_LABELS,
  type ReportGroup,
} from '@/src/domain/services/report.service';
import { DEFAULT_CONFIG, loadConfig, saveConfig, type ReportConfig, type SectionId } from './report-config';
import { ReportConfigPanel } from './report-config-panel';
import { ReportSheet } from './report-sheet';
import { clp, formatMonth, OTHER_COLOR, SERIES_COLORS } from './report-format';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: ReportDataDTO };

export function ReportBuilder({ month }: { month: string }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [months, setMonths] = useState<string[]>([]);
  // Lazy read is hydration-safe here: nothing that depends on config renders until the
  // report data arrives client-side.
  const [config, setConfig] = useState<ReportConfig>(loadConfig);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    // The page keys this component by month, so a month change remounts it in 'loading'.
    let cancelled = false;
    fetch(`/api/snapshot/report?month=${month}`)
      .then(async (r) => {
        if (cancelled) return;
        if (r.status === 404) return setState({ status: 'error', message: `No hay movimientos de seguimiento cargados para ${formatMonth(month).toLowerCase()}.` });
        if (!r.ok) return setState({ status: 'error', message: 'No se pudo cargar el reporte. Recarga la página para intentarlo de nuevo.' });
        setState({ status: 'ready', data: await r.json() });
      })
      .catch(() => !cancelled && setState({ status: 'error', message: 'No se pudo conectar con el servidor. Revisa tu conexión y recarga la página.' }));
    return () => { cancelled = true; };
  }, [month]);

  useEffect(() => {
    fetch('/api/snapshot/months').then((r) => r.json()).then((d) => setMonths(d.months ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    saveConfig(config);
  }, [config]);

  // The browser uses the page title as the default PDF file name.
  useEffect(() => {
    const previous = document.title;
    document.title = `Reporte ${formatMonth(month)} — Statement Lens`;
    return () => { document.title = previous; };
  }, [month]);

  const data = state.status === 'ready' ? state.data : null;

  const filters = config.filters;
  const comparisonDimension = config.comparison.dimension;
  const distribution = config.distribution;
  const includeReimbursed = filters.includeReimbursed;
  const model = useMemo(
    () => (data ? buildReportModel(data, filters, { comparisonDimension }) : null),
    [data, filters, comparisonDimension],
  );

  const colorMap = useMemo(
    () => (data && model ? buildColorMap(data, model, distribution, includeReimbursed) : new Map<string, string>()),
    [data, model, distribution, includeReimbursed],
  );
  const colorOf = (key: string) => colorMap.get(key) ?? OTHER_COLOR;

  const filterSummary = useMemo(() => {
    if (!data) return [];
    const f = filters;
    const out: string[] = [];
    if (f.banks.length) out.push(`banco ${f.banks.map(bankLabel).join(', ')}`);
    if (f.sources.length) out.push(f.sources.map((s) => SOURCE_LABELS[s].toLowerCase()).join(' y '));
    if (f.categoryIds.length) {
      const names = f.categoryIds.map((id) => data.categories.find((c) => c.id === id)?.name).filter(Boolean);
      out.push(names.length > 4 ? `${names.length} categorías` : `categorías ${names.join(', ')}`);
    }
    if (f.search.trim()) out.push(`comercios que contienen “${f.search.trim()}”`);
    if (f.minAmount > 0) out.push(`compras desde ${clp(f.minAmount)}`);
    if (!f.includeReturns) out.push('sin descontar devoluciones');
    if (f.includeReimbursed) out.push('incluye categorías reembolsables');
    return out;
  }, [data, filters]);

  const options = useMemo(() => {
    const txs = data?.transactionsByMonth[data.month] ?? [];
    const usedCats = new Set(txs.filter((t) => t.transactionType === 'expense').map((t) => t.categoryId));
    return {
      banks: Array.from(new Set(txs.map((t) => t.bank))).sort(),
      sources: Array.from(new Set(txs.map((t) => t.source))).sort(),
      categories: (data?.categories ?? [])
        .filter((c) => usedCats.has(c.id) || filters.categoryIds.includes(c.id))
        .map((c) => ({ id: c.id, name: c.name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    };
  }, [data, filters.categoryIds]);

  const moveSection = useCallback((id: SectionId, delta: -1 | 1) => {
    setConfig((c) => {
      // Move relative to the visible neighbours — hidden sections in between don't count.
      const visibleIds = c.sections.filter((s) => s.visible).map((s) => s.id);
      const target = visibleIds[visibleIds.indexOf(id) + delta];
      if (!target) return c;
      const sections = [...c.sections];
      const from = sections.findIndex((s) => s.id === id);
      const [moved] = sections.splice(from, 1);
      const to = sections.findIndex((s) => s.id === target);
      sections.splice(delta === 1 ? to + 1 : to, 0, moved);
      return { ...c, sections };
    });
  }, []);

  const hideSection = useCallback((id: SectionId) => {
    setConfig((c) => ({ ...c, sections: c.sections.map((s) => (s.id === id ? { ...s, visible: false } : s)) }));
  }, []);

  const toggleGroup = useCallback((path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const collapseAll = () => {
    if (!model) return;
    const paths: string[] = [];
    const walk = (groups: ReportGroup[], prefix: string) => {
      for (const g of groups) {
        const path = prefix ? `${prefix}/${g.key}` : g.key;
        paths.push(path);
        walk(g.children, path);
      }
    };
    walk(groupExpenses(model.expenses, config.table.groupBy, config.table.groupSort, model.ctx), '');
    setCollapsed(new Set(paths));
  };

  const idx = months.indexOf(month);
  const older = idx >= 0 ? months[idx + 1] : undefined;
  const newer = idx > 0 ? months[idx - 1] : undefined;

  return (
    <div className="-m-6 min-h-[calc(100svh-3rem)] bg-[#e9edf3] md:-m-8 print:m-0 print:min-h-0 print:bg-white">
      {/* Toolbar */}
      <div className="sticky top-12 z-20 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-zinc-200 bg-white/95 px-4 py-2.5 backdrop-blur md:px-6 print:hidden">
        <Link href="/reports" className="inline-flex items-center gap-1 text-[13px] text-zinc-500 hover:text-zinc-900">
          <ChevronLeft className="size-4" />Reportes
        </Link>
        <div className="flex items-center gap-1">
          <MonthNav href={older && `/reports/${older}`} label="Mes anterior"><ChevronLeft className="size-4" /></MonthNav>
          <span className="min-w-36 text-center text-[14px] font-semibold text-zinc-900">{formatMonth(month)}</span>
          <MonthNav href={newer && `/reports/${newer}`} label="Mes siguiente"><ChevronRight className="size-4" /></MonthNav>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setConfig(DEFAULT_CONFIG); setCollapsed(new Set()); }}
            title="Vuelve a las secciones, filtros y agrupación por defecto"
          >
            <RotateCcw className="mr-1.5 size-3.5" />Restablecer
          </Button>
          <Button size="sm" onClick={() => window.print()} disabled={!model}>
            <Printer className="mr-1.5 size-4" />Imprimir o guardar PDF
          </Button>
        </div>
      </div>

      {state.status === 'error' && (
        <div className="mx-auto mt-16 max-w-md rounded-xl border border-zinc-200 bg-white px-6 py-8 text-center">
          <p className="text-[14px] text-zinc-700">{state.message}</p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href="/tracking">Ir a Seguimiento</Link>
          </Button>
        </div>
      )}

      {state.status === 'loading' && <BuilderSkeleton />}

      {data && model && (
        <div className="gap-6 p-4 md:p-6 lg:grid lg:grid-cols-[320px_minmax(0,1fr)] print:block print:p-0">
          {/* self-start: a grid item stretches to the row height by default, which makes sticky a
              no-op. Top offset = app header (3rem) + builder toolbar (~3.3rem) + breathing room. */}
          <aside className="mb-6 lg:sticky lg:top-[7.5rem] lg:mb-0 lg:h-[calc(100svh-8.5rem)] lg:self-start print:hidden">
            <ReportConfigPanel
              config={config}
              onChange={setConfig}
              banks={options.banks}
              sources={options.sources}
              categories={options.categories}
              onExpandAll={() => setCollapsed(new Set())}
              onCollapseAll={collapseAll}
            />
          </aside>
          <div className="overflow-x-auto pb-12 print:overflow-visible print:pb-0">
            <ReportSheet
              data={data}
              model={model}
              config={config}
              colorOf={colorOf}
              filterSummary={filterSummary}
              collapsed={collapsed}
              onToggleGroup={toggleGroup}
              onMoveSection={moveSection}
              onHideSection={hideSection}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Color follows the entity, never its rank among the filtered survivors: slots are assigned
 * from the unfiltered month ranking, so narrowing a filter never repaints the remaining slices.
 */
function buildColorMap(
  data: ReportDataDTO,
  model: ReportModel,
  distribution: ReportConfig['distribution'],
  includeReimbursed: boolean,
): Map<string, string> {
  const { dimension, maxSlices } = distribution;
  const base = filterReportTransactions(
    data.transactionsByMonth[data.month] ?? [],
    { ...DEFAULT_REPORT_FILTERS, includeReimbursed },
    model.ctx,
  );
  const ranking = groupExpenses(base, [dimension], { sortBy: 'total', dir: 'desc' }, model.ctx).map((g) => g.key);
  const visible = sliceByDimension(model.current, dimension, model.ctx, maxSlices).map((s) => s.key);
  const map = new Map<string, string>();
  for (const key of visible) {
    const rank = ranking.indexOf(key);
    if (rank >= 0 && rank < SERIES_COLORS.length) map.set(key, SERIES_COLORS[rank]);
  }
  const free = SERIES_COLORS.filter((c) => ![...map.values()].includes(c));
  for (const key of visible) {
    if (key !== OTHER_SLICE_KEY && !map.has(key)) map.set(key, free.shift() ?? OTHER_COLOR);
  }
  return map;
}

function MonthNav({ href, label, children }: { href?: string; label: string; children: React.ReactNode }) {
  if (!href) {
    return <span aria-hidden className="rounded-md p-1.5 text-zinc-300">{children}</span>;
  }
  return (
    <Link href={href} aria-label={label} title={label} className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900">
      {children}
    </Link>
  );
}

function BuilderSkeleton() {
  return (
    <div className="gap-6 p-4 md:p-6 lg:grid lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="mb-6 space-y-3 rounded-xl border border-zinc-200 bg-white p-4">
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
      </div>
      <div className="mx-auto w-[794px] max-w-full space-y-6 bg-white px-14 py-10">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-px w-full" />
        <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
