'use client';

import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronRight, EyeOff, AlertTriangle } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { SnapshotTransaction } from '@/src/domain/entities/snapshot';
import type { ReportDataDTO } from '@/src/application/use-cases/reports/get-report-data.use-case';
import type { ReportModel } from '@/src/adapters/presenters/report.presenter';
import {
  bankLabel,
  DIMENSION_LABELS,
  groupExpenses,
  sliceByDimension,
  sortTransactions,
  type ReportGroup,
} from '@/src/domain/services/report.service';
import { SECTION_LABELS, type ReportConfig, type SectionId } from './report-config';
import { BudgetBars, DonutChart, SliceBars, TrendColumns } from './report-charts';
import {
  cleanDesc, clp, formatMonth, monthName, pct, shortDate, signedPct, STATUS,
} from './report-format';

export interface SheetProps {
  data: ReportDataDTO;
  model: ReportModel;
  config: ReportConfig;
  colorOf: (key: string) => string;
  filterSummary: string[];
  collapsed: Set<string>;
  onToggleGroup: (path: string) => void;
  onMoveSection: (id: SectionId, delta: -1 | 1) => void;
  onHideSection: (id: SectionId) => void;
}

export function ReportSheet(props: SheetProps) {
  const { data, model, config, filterSummary } = props;
  const visible = config.sections.filter((s) => s.visible);
  const generatedAt = new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
  const { daysElapsed, daysInMonth } = model.metrics;

  return (
    <article
      className="report-sheet mx-auto w-[794px] font-sans max-w-none bg-white px-14 pb-12 pt-10 text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_12px_32px_-12px_rgba(15,45,94,0.25)] print:w-auto print:p-0 print:shadow-none"
    >
      {/* Masthead */}
      <header className="border-b-[3px] border-navy-900 pb-5">
        <div className="flex items-baseline justify-between text-[11.5px] text-slate-500">
          <span className="font-medium text-navy-900">Statement Lens</span>
          <span>Generado el {generatedAt}</span>
        </div>
        <div className="mt-5 flex items-end justify-between gap-6">
          <div className="min-w-0">
            {config.document.title ? (
              <>
                <h1 className="text-[34px] font-semibold leading-[1.05] tracking-[-0.025em] text-balance">{config.document.title}</h1>
                <p className="mt-2 text-[13px] text-slate-500">Mes contable de {formatMonth(data.month).toLowerCase()}</p>
              </>
            ) : (
              <h1 className="text-[52px] font-semibold leading-none tracking-[-0.035em]">
                {monthName(data.month)} <span className="font-light text-slate-400">{data.month.slice(0, 4)}</span>
              </h1>
            )}
            <p className="mt-2 text-[12.5px] text-slate-500">
              {daysElapsed < daysInMonth ? `Día ${daysElapsed} de ${daysInMonth}, mes en curso` : `Mes cerrado, ${daysInMonth} días`}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[12px] text-slate-500">Gasto del mes</div>
            <div className="text-[30px] font-semibold leading-tight tracking-[-0.02em] tabular-nums">{clp(model.metrics.totalExpenses)}</div>
          </div>
        </div>
      </header>

      {config.document.showFilterSummary && filterSummary.length > 0 && (
        <p className="mt-4 rounded-md bg-brand-50 px-3 py-2 text-[12px] leading-relaxed text-navy-800">
          <span className="font-semibold">Filtros aplicados: </span>
          {filterSummary.join('; ')}.
        </p>
      )}

      <div className="mt-2">
        {visible.length === 0 && (
          <p className="py-16 text-center text-sm text-slate-400 print:hidden">
            Activa al menos una sección en el panel de contenido.
          </p>
        )}
        {visible.map((s, i) => (
          <SectionBlock
            key={s.id}
            id={s.id}
            isFirst={i === 0}
            isLast={i === visible.length - 1}
            {...props}
          />
        ))}
      </div>

      <footer className="mt-12 flex justify-between border-t border-slate-200 pt-3 text-[11px] text-slate-400">
        <span>Statement Lens</span>
        <span>{formatMonth(data.month)}</span>
      </footer>
    </article>
  );
}

// ─── Section frame ────────────────────────────────────────────────────────────

function SectionFrame({
  id, title, aside, isFirst, isLast, onMoveSection, onHideSection, children, keepTogether = false,
}: {
  id: SectionId; title: string; aside?: ReactNode; isFirst: boolean; isLast: boolean;
  onMoveSection: SheetProps['onMoveSection']; onHideSection: SheetProps['onHideSection'];
  children: ReactNode; keepTogether?: boolean;
}) {
  return (
    <section className={cn('group/section relative -mx-4 mt-6 rounded-lg px-4 py-3 transition-shadow hover:ring-1 hover:ring-brand-200 print:mx-0 print:px-0 print:ring-0', keepTogether && 'break-inside-avoid')}>
      <div className="absolute -top-3.5 right-3 hidden items-center gap-0.5 rounded-md border border-slate-200 bg-white p-0.5 shadow-sm group-hover/section:flex group-focus-within/section:flex print:hidden">
        <ToolButton label="Subir sección" disabled={isFirst} onClick={() => onMoveSection(id, -1)}><ArrowUp className="size-3.5" /></ToolButton>
        <ToolButton label="Bajar sección" disabled={isLast} onClick={() => onMoveSection(id, 1)}><ArrowDown className="size-3.5" /></ToolButton>
        <ToolButton label="Ocultar sección" onClick={() => onHideSection(id)}><EyeOff className="size-3.5" /></ToolButton>
      </div>
      <div className="mb-3.5 flex items-baseline justify-between gap-4 border-b border-slate-200 pb-2">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
        {aside && <div className="text-right text-[12px] text-slate-500">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

function ToolButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-3 text-[12.5px] text-slate-400">{children}</p>;
}

// ─── Sections ─────────────────────────────────────────────────────────────────

function SectionBlock(props: SheetProps & { id: SectionId; isFirst: boolean; isLast: boolean }) {
  const { id, model, config, data, colorOf } = props;
  const frame = (children: ReactNode, aside?: ReactNode, keepTogether = true) => (
    <SectionFrame
      id={id}
      title={SECTION_LABELS[id]}
      aside={aside}
      isFirst={props.isFirst}
      isLast={props.isLast}
      onMoveSection={props.onMoveSection}
      onHideSection={props.onHideSection}
      keepTogether={keepTogether}
    >
      {children}
    </SectionFrame>
  );
  const { metrics } = model;

  switch (id) {
    case 'summary':
      return frame(
        <>
          <div className="grid grid-cols-4 divide-x divide-slate-200 max-sm:grid-cols-2">
            <Stat label="Total gastado" value={clp(metrics.totalExpenses)} note={model.comparison ? `${signedPct(model.comparison.change)} vs. ${monthName(model.comparison.prevMonth).toLowerCase()}` : 'Sin transferencias internas'} tone={model.comparison ? (model.comparison.change > 2 ? 'bad' : model.comparison.change < -2 ? 'good' : undefined) : undefined} />
            <Stat label="Ingresos" value={clp(metrics.totalIncome)} note="Sueldos y abonos" />
            <Stat label="Promedio diario" value={clp(metrics.dailyAverage)} note="Por día transcurrido" />
            <Stat label="Proyección al cierre" value={clp(metrics.projectedMonthTotal)} note={model.channelFiltered ? 'Según el ritmo de gasto' : 'Incluye fijos pendientes'} />
          </div>
          {model.savingsRate6m && (
            <div className="mt-4 flex items-center justify-between gap-6 rounded-md bg-slate-50 px-4 py-3">
              <p className="max-w-[52ch] text-[12.5px] leading-snug text-slate-600">
                <span className="font-medium text-slate-900">Tasa de ahorro de los últimos {model.savingsRate6m.months} {model.savingsRate6m.months === 1 ? 'mes' : 'meses'}.</span>{' '}
                De cada $100 que ingresaron, quedaron ${Math.max(0, model.savingsRate6m.rate)}. Es más confiable que la tasa de un solo mes, porque el sueldo suele llegar un mes y gastarse al siguiente.
              </p>
              <span className="text-[26px] font-semibold tabular-nums" style={{ color: model.savingsRate6m.rate >= 0 ? STATUS.goodText : STATUS.criticalText }}>
                {model.savingsRate6m.rate}%
              </span>
            </div>
          )}
        </>,
      );

    case 'budget': {
      const b = model.budget;
      if (model.channelFiltered) return frame(<Empty>El presupuesto total no se divide por banco ni medio de pago. Quita esos filtros para ver cuánto queda disponible.</Empty>);
      if (!b) return frame(<Empty>No hay presupuesto configurado para este mes{config.filters.categoryIds.length ? ' en las categorías seleccionadas' : ''}.</Empty>);
      const color = b.pct > 100 ? STATUS.critical : b.pct > 80 ? STATUS.warning : '#2a78d6';
      return frame(
        <>
          <div className="flex items-baseline justify-between text-[13px]">
            <span><span className="font-semibold tabular-nums">{clp(b.projected)}</span> <span className="text-slate-500">proyectado de {clp(b.total)}</span></span>
            <span className="text-[20px] font-semibold tabular-nums">{b.pct}%</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#cde2fb]">
            <div className="h-full rounded-full" style={{ width: `${Math.min(b.pct, 100)}%`, background: color }} />
          </div>
          <div className="mt-2 flex justify-between text-[12px]">
            <span className="text-slate-500">Gastado hasta hoy: {clp(b.spent)}</span>
            {b.available >= 0
              ? <span className="font-medium" style={{ color: STATUS.goodText }}>Disponible para gastos no fijos: {clp(b.available)}</span>
              : <span className="inline-flex items-center gap-1 font-medium" style={{ color: STATUS.criticalText }}><AlertTriangle className="size-3.5" />{clp(-b.available)} sobre el presupuesto</span>}
          </div>
        </>,
      );
    }

    case 'distribution': {
      const { dimension, chart, maxSlices } = config.distribution;
      const slices = sliceByDimension(model.current, dimension, model.ctx, maxSlices);
      const total = slices.reduce((s, x) => s + x.total, 0);
      return frame(
        slices.length === 0
          ? <Empty>Sin gastos para los filtros elegidos.</Empty>
          : chart === 'donut'
            ? <DonutChart slices={slices} colorOf={colorOf} total={total} />
            : <SliceBars slices={slices} colorOf={colorOf} />,
        `Por ${DIMENSION_LABELS[dimension].toLowerCase()}`,
      );
    }

    case 'budgetBars': {
      const rows = model.categoryRows
        .filter((c) => c.budget !== null && !model.excludedIds.has(c.categoryId))
        .map((c) => ({ key: c.categoryId, label: c.categoryName || 'Sin asignar', total: c.total, budget: c.budget as number }));
      return frame(rows.length ? <BudgetBars rows={rows} /> : <Empty>Ninguna categoría con gasto tiene presupuesto este mes.</Empty>);
    }

    case 'comparison': {
      const c = model.comparison;
      if (!c) return frame(<Empty>El mes anterior no tiene gastos registrados para comparar.</Empty>);
      return frame(
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-left text-[11.5px] text-slate-500">
              <th className="pb-2 font-medium">{DIMENSION_LABELS[config.comparison.dimension]}</th>
              <th className="pb-2 text-right font-medium">{monthName(c.prevMonth)}</th>
              <th className="pb-2 text-right font-medium">{monthName(data.month)}</th>
              <th className="w-20 pb-2 text-right font-medium">Cambio</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            <tr className="border-y border-slate-200 bg-slate-50 font-semibold">
              <td className="py-2 pl-2">Gasto total</td>
              <td className="py-2 text-right">{clp(c.prevTotal)}</td>
              <td className="py-2 text-right">{clp(c.total)}</td>
              <td className="py-2 pr-2 text-right"><Change value={c.change} /></td>
            </tr>
            {c.rows.map((r) => (
              <tr key={r.key} className="border-b border-slate-100">
                <td className="py-1.5 pl-2 text-slate-700">{r.label}</td>
                <td className="py-1.5 text-right text-slate-500">{clp(r.prev)}</td>
                <td className="py-1.5 text-right">{clp(r.current)}</td>
                <td className="py-1.5 pr-2 text-right"><Change value={r.change} /></td>
              </tr>
            ))}
          </tbody>
        </table>,
        `vs. ${formatMonth(c.prevMonth).toLowerCase()}, mayores cambios primero`,
      );
    }

    case 'trend':
      return frame(
        model.trend.length < 2
          ? <Empty>Se necesitan al menos dos meses con gastos para mostrar la tendencia.</Empty>
          : <TrendColumns points={model.trend} current={data.month} />,
      );

    case 'expenses':
      return frame(<ExpensesTable {...props} />, expensesAside(config), false);

    case 'categories':
      return frame(
        model.categoryRows.length === 0 ? <Empty>Sin gastos para los filtros elegidos.</Empty> : (
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-[11.5px] text-slate-500">
                <th className="pb-2 text-left font-medium">Categoría</th>
                <th className="pb-2 text-right font-medium">Presupuesto</th>
                <th className="pb-2 text-right font-medium">Gastado</th>
                <th className="pb-2 text-right font-medium">% del gasto</th>
                <th className="pb-2 text-right font-medium">% presup.</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {model.categoryRows.map((c) => (
                <tr key={c.categoryId} className="break-inside-avoid border-t border-slate-100">
                  <td className="py-2">
                    <span className="font-medium">{c.categoryName || 'Sin asignar'}</span>
                    {c.isFixed && <Badge className="bg-amber-50 text-amber-800">Fijo</Badge>}
                    {c.isOver && <Badge className="bg-red-50 text-[#b42318]">Excedido</Badge>}
                  </td>
                  <td className="py-2 text-right text-slate-500">{c.budget ? clp(c.budget) : '—'}</td>
                  <td className="py-2 text-right">{clp(c.total)}</td>
                  <td className="py-2 text-right text-slate-500">{c.pctOfTotal}%</td>
                  <td className={cn('py-2 text-right', c.isOver ? 'font-semibold text-[#b42318]' : 'text-slate-500')}>{c.pctOfBudget !== null ? `${c.pctOfBudget}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ),
        undefined,
        false,
      );

    case 'income':
      return frame(
        model.income.length === 0 ? <Empty>Sin ingresos para los filtros elegidos.</Empty> : (
          <>
            <MovementTable rows={sortTransactions(model.income, 'date', 'asc')} positive />
            {model.savingsRateMonth !== null && (
              <p className="mt-3 text-[12px] text-slate-500">
                Tasa de ahorro de este mes: <span className="font-semibold tabular-nums text-slate-900">{model.savingsRateMonth}%</span>
              </p>
            )}
          </>
        ),
        <span className="tabular-nums">Total {clp(model.metrics.totalIncome)}</span>,
        false,
      );

    case 'transfers': {
      const moved = model.transfers.reduce((s, t) => s + Math.abs(t.amount), 0);
      return frame(
        model.transfers.length === 0 ? <Empty>Sin transferencias internas este mes.</Empty> : (
          <>
            <p className="mb-3 max-w-[70ch] text-[12px] text-slate-500">Pagos de tarjeta y traspasos entre cuentas propias. No se suman al gasto.</p>
            <MovementTable rows={sortTransactions(model.transfers, 'date', 'asc')} muted />
          </>
        ),
        <span className="tabular-nums">Total movido {clp(moved)}</span>,
        false,
      );
    }

    case 'notes':
      return config.document.notes.trim()
        ? frame(<p className="max-w-[72ch] whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">{config.document.notes}</p>)
        : (
          <p className="mt-6 rounded-lg border border-dashed border-slate-200 px-4 py-3 text-[12px] text-slate-400 print:hidden">
            Notas: escribe un comentario en la pestaña Documento del panel para incluirlo en el reporte.
          </p>
        );
  }
}

function Stat({ label, value, note, tone }: { label: string; value: string; note: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="px-4 first:pl-0 max-sm:py-2">
      <div className="text-[12px] text-slate-500">{label}</div>
      <div className="mt-1 text-[19px] font-semibold tracking-[-0.01em] tabular-nums">{value}</div>
      <div className="mt-0.5 text-[11.5px]" style={{ color: tone === 'bad' ? STATUS.criticalText : tone === 'good' ? STATUS.goodText : '#64748b' }}>{note}</div>
    </div>
  );
}

function Change({ value }: { value: number }) {
  const cls = value > 2 ? 'bg-red-50 text-[#b42318]' : value < -2 ? 'bg-green-50 text-[#006300]' : 'bg-slate-100 text-slate-600';
  return <span className={cn('inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold', cls)}>{signedPct(value)}</span>;
}

function Badge({ className, children }: { className: string; children: ReactNode }) {
  return <span className={cn('ml-2 rounded px-1.5 py-px text-[10.5px] font-semibold align-[1px]', className)}>{children}</span>;
}

// ─── Movement tables ──────────────────────────────────────────────────────────

function metaOf(t: SnapshotTransaction) {
  const src = t.source === 'credit_card' ? 'TC' : 'CC';
  return `${bankLabel(t.bank)}, ${src}`;
}

function MovementTable({ rows, positive, muted }: { rows: SnapshotTransaction[]; positive?: boolean; muted?: boolean }) {
  return (
    <table className="w-full text-[12.5px]">
      <tbody className="tabular-nums">
        {rows.map((t) => (
          <tr key={t.id} className="break-inside-avoid border-b border-slate-100">
            <td className="w-14 py-1.5 text-slate-400">{shortDate(t.date)}</td>
            <td className="py-1.5 text-slate-700">{cleanDesc(t.description)}</td>
            <td className="py-1.5 text-[11.5px] text-slate-400">{metaOf(t)}</td>
            <td className={cn('py-1.5 text-right', positive && 'font-semibold text-[#006300]', muted && 'text-slate-400')}>
              {positive ? '+' : ''}{clp(Math.abs(t.amount))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function expensesAside(config: ReportConfig) {
  const g = config.table.groupBy;
  if (g.length === 0) return 'Lista de movimientos';
  return `Agrupado por ${g.map((d) => DIMENSION_LABELS[d].toLowerCase()).join(' y luego por ')}`;
}

function ExpensesTable({ model, config, collapsed, onToggleGroup }: SheetProps) {
  const { table } = config;
  const cols = table.columns;
  const expenses = model.expenses;
  if (expenses.length === 0) return <Empty>Sin gastos para los filtros elegidos.</Empty>;

  // Flat list
  if (table.groupBy.length === 0) {
    const rows = sortTransactions(expenses, table.txSort.by, table.txSort.dir);
    const total = -rows.reduce((s, t) => s + t.amount, 0);
    return (
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="text-left text-[11.5px] text-slate-500">
            {cols.date && <th className="w-14 pb-2 font-medium">Fecha</th>}
            <th className="pb-2 font-medium">Comercio</th>
            {cols.category && <th className="pb-2 font-medium">Categoría</th>}
            {cols.bank && <th className="pb-2 font-medium">Banco</th>}
            <th className="pb-2 text-right font-medium">Monto</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((t) => <TxRow key={t.id} t={t} cols={cols} />)}
        </tbody>
        <TotalFoot label={`${rows.length} movimientos`} total={total} span={1 + Number(cols.date) + Number(cols.category) + Number(cols.bank)} />
      </table>
    );
  }

  const groups = groupExpenses(expenses, table.groupBy, table.groupSort, model.ctx);
  const shown = table.limit ? groups.slice(0, table.limit) : groups;
  const hidden = groups.slice(shown.length);
  const total = groups.reduce((s, g) => s + g.total, 0);
  const extraCols = Number(cols.count) + Number(cols.share);

  return (
    <table className="w-full text-[12.5px]">
      <thead>
        <tr className="text-left text-[11.5px] text-slate-500">
          <th className="pb-2 font-medium">{DIMENSION_LABELS[table.groupBy[0]]}{table.groupBy[1] ? ` y ${DIMENSION_LABELS[table.groupBy[1]].toLowerCase()}` : ''}</th>
          {cols.count && <th className="w-16 pb-2 text-right font-medium">Compras</th>}
          {cols.share && <th className="w-32 pb-2 pl-4 font-medium">% del gasto</th>}
          <th className="w-28 pb-2 text-right font-medium">Total</th>
        </tr>
      </thead>
      <tbody className="tabular-nums">
        {shown.map((g) => (
          <GroupRows key={g.key} group={g} depth={0} path={g.key} {...{ config, collapsed, onToggleGroup }} />
        ))}
        {hidden.length > 0 && (
          <tr className="border-b border-slate-100 text-slate-500">
            <td className="py-2 pl-6 italic">{hidden.length} {hidden.length === 1 ? 'grupo más' : 'grupos más'}</td>
            {cols.count && <td className="py-2 text-right">{hidden.reduce((s, g) => s + g.count, 0)}</td>}
            {cols.share && <td className="py-2 pl-4"><ShareBar share={total > 0 ? hidden.reduce((s, g) => s + g.total, 0) / total : 0} /></td>}
            <td className="py-2 text-right">{clp(hidden.reduce((s, g) => s + g.total, 0))}</td>
          </tr>
        )}
      </tbody>
      <TotalFoot label={`${groups.length} ${groups.length === 1 ? 'grupo' : 'grupos'}`} total={total} span={1 + extraCols} />
    </table>
  );
}

function GroupRows({ group, depth, path, config, collapsed, onToggleGroup }: {
  group: ReportGroup; depth: number; path: string;
  config: ReportConfig; collapsed: Set<string>; onToggleGroup: (p: string) => void;
}) {
  const { table } = config;
  const cols = table.columns;
  const hasChildren = group.children.length > 0;
  const showTxs = !hasChildren && table.showTransactions;
  const expandable = hasChildren || showTxs;
  const isOpen = expandable && !collapsed.has(path);
  const extraCols = Number(cols.count) + Number(cols.share);

  return (
    <>
      <tr className={cn('break-inside-avoid border-b', depth === 0 ? 'border-slate-200' : 'border-slate-100')}>
        <td className="py-2" style={{ paddingLeft: depth * 20 }}>
          {expandable ? (
            <button
              type="button"
              onClick={() => onToggleGroup(path)}
              aria-expanded={isOpen}
              className="group/toggle inline-flex items-center gap-1 rounded text-left focus-visible:outline-2 focus-visible:outline-brand-600"
            >
              <ChevronRight className={cn('size-3.5 shrink-0 text-slate-400 transition-transform group-hover/toggle:text-slate-700', isOpen && 'rotate-90', 'print:hidden')} />
              <span className={cn(depth === 0 ? 'font-semibold' : 'font-medium text-slate-800')}>{group.label}</span>
            </button>
          ) : (
            <span className={cn('pl-[18px] print:pl-0', depth === 0 ? 'font-semibold' : 'text-slate-800')}>{group.label}</span>
          )}
        </td>
        {cols.count && <td className="py-2 text-right text-slate-500">{group.count}</td>}
        {cols.share && <td className="py-2 pl-4"><ShareBar share={group.share} /></td>}
        <td className={cn('py-2 text-right', depth === 0 && 'font-semibold')}>{clp(group.total)}</td>
      </tr>
      {isOpen && hasChildren && group.children.map((c) => (
        <GroupRows key={c.key} group={c} depth={depth + 1} path={`${path}/${c.key}`} {...{ config, collapsed, onToggleGroup }} />
      ))}
      {isOpen && showTxs && sortTransactions(group.transactions, table.txSort.by, table.txSort.dir).map((t) => (
        <tr key={t.id} className="break-inside-avoid border-b border-slate-50 text-[12px] text-slate-600">
          <td className="py-1" style={{ paddingLeft: (depth + 1) * 20 }} colSpan={1 + extraCols}>
            <span className="inline-flex flex-wrap items-baseline gap-x-3">
              {cols.date && <span className="w-10 text-slate-400">{shortDate(t.date)}</span>}
              <span>{cleanDesc(t.description)}</span>
              {t.amount > 0 && <ReturnBadge />}
              {cols.category && table.groupBy[0] !== 'category' && table.groupBy[1] !== 'category' && <span className="text-slate-400">{t.categoryName || 'Sin asignar'}</span>}
              {cols.bank && <span className="text-[11px] text-slate-400">{metaOf(t)}</span>}
            </span>
          </td>
          <td className={cn('py-1 text-right', t.amount > 0 && 'text-[#006300]')}>{t.amount > 0 ? '−' : ''}{clp(Math.abs(t.amount))}</td>
        </tr>
      ))}
    </>
  );
}

function TxRow({ t, cols }: { t: SnapshotTransaction; cols: ReportConfig['table']['columns'] }) {
  const isReturn = t.amount > 0;
  return (
    <tr className="break-inside-avoid border-b border-slate-100">
      {cols.date && <td className="py-1.5 text-slate-400">{shortDate(t.date)}</td>}
      <td className="py-1.5 text-slate-800">{cleanDesc(t.description)}{isReturn && <ReturnBadge />}</td>
      {cols.category && <td className="py-1.5 text-slate-500">{t.categoryName || 'Sin asignar'}</td>}
      {cols.bank && <td className="py-1.5 text-[11.5px] text-slate-400">{metaOf(t)}</td>}
      <td className={cn('py-1.5 text-right', isReturn && 'text-[#006300]')}>{isReturn ? '−' : ''}{clp(Math.abs(t.amount))}</td>
    </tr>
  );
}

function ReturnBadge() {
  return <span className="ml-1.5 rounded bg-green-50 px-1.5 py-px text-[10px] font-semibold text-[#006300]">devolución</span>;
}

function ShareBar({ share }: { share: number }) {
  const clamped = Math.max(0, Math.min(share, 1));
  return (
    <span className="flex items-center gap-2">
      <span className="relative h-1.5 w-16 rounded-full bg-slate-100">
        <span className="absolute inset-y-0 left-0 rounded-full bg-[#2a78d6]" style={{ width: `${clamped * 100}%` }} />
      </span>
      <span className="text-[11.5px] text-slate-500">{pct(share)}</span>
    </span>
  );
}

function TotalFoot({ label, total, span }: { label: string; total: number; span: number }) {
  return (
    // A <tbody>, not <tfoot>: browsers repeat a tfoot at the bottom of every printed page.
    <tbody>
      <tr className="break-inside-avoid border-t-2 border-slate-300 font-semibold tabular-nums">
        <td className="pt-2 text-slate-500 font-normal" colSpan={span}>{label}</td>
        <td className="pt-2 text-right">{clp(total)}</td>
      </tr>
    </tbody>
  );
}

