'use client';

import { useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowDownWideNarrow, ArrowUpNarrowWide, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Checkbox } from '@/src/components/ui/checkbox';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import {
  bankLabel,
  DIMENSION_LABELS,
  SOURCE_LABELS,
  type ReportDimension,
  type ReportFilters,
  type SortDir,
} from '@/src/domain/services/report.service';
import type { SnapshotTransaction } from '@/src/domain/entities/snapshot';
import {
  COLUMN_LABELS,
  countActiveFilters,
  DEFAULT_CONFIG,
  SECTION_LABELS,
  type ReportConfig,
  type SectionId,
  type TableColumn,
} from './report-config';

type Tab = 'content' | 'filters' | 'table' | 'document';

interface Props {
  config: ReportConfig;
  onChange: (next: ReportConfig) => void;
  banks: string[];
  sources: SnapshotTransaction['source'][];
  categories: { id: string; name: string }[];
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

const ALL_DIMENSIONS = Object.keys(DIMENSION_LABELS) as ReportDimension[];

export function ReportConfigPanel(props: Props) {
  const [tab, setTab] = useState<Tab>('content');
  const activeFilters = countActiveFilters(props.config.filters);
  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'content', label: 'Contenido' },
    { id: 'filters', label: 'Filtros', badge: activeFilters },
    { id: 'table', label: 'Tabla' },
    { id: 'document', label: 'Documento' },
  ];

  return (
    <div className="flex h-full flex-col rounded-xl border border-zinc-200 bg-white font-sans">
      <div role="tablist" aria-label="Configuración del reporte" className="grid grid-cols-4 gap-1 border-b border-zinc-200 p-1.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'relative rounded-md px-1 py-1.5 text-[12.5px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-brand-600',
              tab === t.id ? 'bg-navy-900 text-white' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
            )}
          >
            {t.label}
            {!!t.badge && (
              <span className={cn('ml-1 rounded-full px-1.5 text-[10.5px] tabular-nums', tab === t.id ? 'bg-white/20' : 'bg-brand-100 text-brand-700')}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {tab === 'content' && <ContentTab {...props} />}
        {tab === 'filters' && <FiltersTab {...props} />}
        {tab === 'table' && <TableTab {...props} />}
        {tab === 'document' && <DocumentTab {...props} />}
      </div>
    </div>
  );
}

// ─── Building blocks ──────────────────────────────────────────────────────────

function Group({ title, hint, children, action }: { title: string; hint?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <fieldset className="mb-5 last:mb-0">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <legend className="text-[13px] font-semibold text-zinc-900">{title}</legend>
        {action}
      </div>
      {hint && <p className="-mt-1 mb-2 text-[12px] leading-snug text-zinc-500">{hint}</p>}
      {children}
    </fieldset>
  );
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-[12.5px] transition-colors focus-visible:outline-2 focus-visible:outline-brand-600',
        selected ? 'border-brand-600 bg-brand-50 font-medium text-brand-700' : 'border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:text-zinc-900',
      )}
    >
      {children}
    </button>
  );
}

function Check({ id, checked, onChange, children }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 py-1 text-[13px] text-zinc-700">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} className="mt-0.5" />
      <span className="leading-snug">{children}</span>
    </label>
  );
}

function DimensionSelect({ value, onChange, allowNone, exclude = [], label }: {
  value: ReportDimension | 'none'; onChange: (v: ReportDimension | 'none') => void;
  allowNone?: string; exclude?: ReportDimension[]; label: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ReportDimension | 'none')}>
      <SelectTrigger aria-label={label} className="h-8 w-full text-[13px]"><SelectValue /></SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value="none">{allowNone}</SelectItem>}
        {ALL_DIMENSIONS.filter((d) => !exclude.includes(d)).map((d) => (
          <SelectItem key={d} value={d}>{DIMENSION_LABELS[d]}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function DirToggle({ dir, onChange }: { dir: SortDir; onChange: (d: SortDir) => void }) {
  const desc = dir === 'desc';
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 shrink-0 px-2"
      aria-label={desc ? 'Orden descendente, cambiar a ascendente' : 'Orden ascendente, cambiar a descendente'}
      title={desc ? 'Mayor a menor' : 'Menor a mayor'}
      onClick={() => onChange(desc ? 'asc' : 'desc')}
    >
      {desc ? <ArrowDownWideNarrow className="size-4" /> : <ArrowUpNarrowWide className="size-4" />}
    </Button>
  );
}

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function ContentTab({ config, onChange }: Props) {
  const move = (index: number, delta: -1 | 1) => {
    const sections = [...config.sections];
    const [s] = sections.splice(index, 1);
    sections.splice(index + delta, 0, s);
    onChange({ ...config, sections });
  };
  const setVisible = (id: SectionId, visible: boolean) =>
    onChange({ ...config, sections: config.sections.map((s) => (s.id === id ? { ...s, visible } : s)) });

  return (
    <>
      <Group title="Secciones" hint="Marca lo que quieres imprimir y ordénalo. También puedes mover u ocultar secciones pasando el mouse sobre la hoja.">
        <ol className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
          {config.sections.map((s, i) => (
            <li key={s.id} className={cn('px-2.5 py-1.5', !s.visible && 'bg-zinc-50')}>
              <div className="flex items-center gap-2">
                <Checkbox id={`sec-${s.id}`} checked={s.visible} onCheckedChange={(v) => setVisible(s.id, v === true)} />
                <label htmlFor={`sec-${s.id}`} className={cn('flex-1 cursor-pointer text-[13px]', s.visible ? 'text-zinc-900' : 'text-zinc-400')}>
                  {SECTION_LABELS[s.id]}
                </label>
                <button type="button" aria-label={`Subir ${SECTION_LABELS[s.id]}`} disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-25 disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-brand-600">
                  <ArrowUp className="size-3.5" />
                </button>
                <button type="button" aria-label={`Bajar ${SECTION_LABELS[s.id]}`} disabled={i === config.sections.length - 1} onClick={() => move(i, 1)} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-25 disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-brand-600">
                  <ArrowDown className="size-3.5" />
                </button>
              </div>
              {s.visible && s.id === 'distribution' && (
                <div className="mb-1 ml-6 mt-2 space-y-2">
                  <DimensionSelect label="Distribuir por" value={config.distribution.dimension} onChange={(d) => onChange({ ...config, distribution: { ...config.distribution, dimension: d as ReportDimension } })} />
                  <div className="flex gap-1.5">
                    <Chip selected={config.distribution.chart === 'donut'} onClick={() => onChange({ ...config, distribution: { ...config.distribution, chart: 'donut' } })}>Dona</Chip>
                    <Chip selected={config.distribution.chart === 'bars'} onClick={() => onChange({ ...config, distribution: { ...config.distribution, chart: 'bars' } })}>Barras</Chip>
                    <Select value={String(config.distribution.maxSlices)} onValueChange={(v) => onChange({ ...config, distribution: { ...config.distribution, maxSlices: Number(v) } })}>
                      <SelectTrigger aria-label="Cantidad de elementos" className="ml-auto h-8 w-[104px] text-[12.5px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[4, 5, 6, 7].map((n) => <SelectItem key={n} value={String(n)}>Top {n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              {s.visible && s.id === 'comparison' && (
                <div className="mb-1 ml-6 mt-2">
                  <DimensionSelect label="Comparar por" value={config.comparison.dimension} onChange={(d) => onChange({ ...config, comparison: { dimension: d as ReportDimension } })} />
                </div>
              )}
            </li>
          ))}
        </ol>
      </Group>
    </>
  );
}

function FiltersTab({ config, onChange, banks, sources, categories }: Props) {
  const f = config.filters;
  const set = (patch: Partial<ReportFilters>) => onChange({ ...config, filters: { ...f, ...patch } });
  const [catQuery, setCatQuery] = useState('');
  const visibleCats = categories.filter((c) => c.name.toLowerCase().includes(catQuery.toLowerCase()));

  return (
    <>
      <p className="mb-4 rounded-md bg-zinc-50 px-3 py-2 text-[12px] leading-snug text-zinc-500">
        Los filtros se aplican a todo el reporte, incluida la comparación y la tendencia. Sin selección se incluye todo.
      </p>

      {banks.length > 1 && (
        <Group title="Banco">
          <div className="flex flex-wrap gap-1.5">
            {banks.map((b) => <Chip key={b} selected={f.banks.includes(b)} onClick={() => set({ banks: toggle(f.banks, b) })}>{bankLabel(b)}</Chip>)}
          </div>
        </Group>
      )}

      {sources.length > 1 && (
        <Group title="Medio de pago">
          <div className="flex flex-wrap gap-1.5">
            {sources.map((s) => <Chip key={s} selected={f.sources.includes(s)} onClick={() => set({ sources: toggle(f.sources, s) })}>{SOURCE_LABELS[s]}</Chip>)}
          </div>
        </Group>
      )}

      <Group title="Buscar comercio">
        <Input value={f.search} onChange={(e) => set({ search: e.target.value })} placeholder="Ej: uber, lider, farmacia" className="h-8 text-[13px]" />
      </Group>

      <Group title="Monto mínimo" hint="Oculta compras pequeñas.">
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          step={1000}
          value={f.minAmount || ''}
          onChange={(e) => set({ minAmount: Math.max(0, Number(e.target.value) || 0) })}
          placeholder="Sin mínimo"
          className="h-8 text-[13px]"
        />
      </Group>

      <Group
        title="Categorías"
        action={f.categoryIds.length > 0 && <button type="button" className="text-[12px] text-brand-700 hover:underline" onClick={() => set({ categoryIds: [] })}>Todas</button>}
      >
        {categories.length > 8 && (
          <Input value={catQuery} onChange={(e) => setCatQuery(e.target.value)} placeholder="Buscar categoría" className="mb-2 h-8 text-[13px]" />
        )}
        <div className="max-h-56 overflow-y-auto rounded-lg border border-zinc-200 px-2.5 py-1">
          {visibleCats.map((c) => (
            <Check key={c.id} id={`cat-${c.id}`} checked={f.categoryIds.includes(c.id)} onChange={() => set({ categoryIds: toggle(f.categoryIds, c.id) })}>{c.name}</Check>
          ))}
          {visibleCats.length === 0 && <p className="py-2 text-[12px] text-zinc-400">Ninguna categoría coincide.</p>}
        </div>
      </Group>

      <Group title="Opciones">
        <Check id="f-returns" checked={f.includeReturns} onChange={(v) => set({ includeReturns: v })}>
          Descontar devoluciones del gasto
        </Check>
        <Check id="f-reimbursed" checked={f.includeReimbursed} onChange={(v) => set({ includeReimbursed: v })}>
          Incluir categorías reembolsables (por ejemplo, tarjeta adicional)
        </Check>
      </Group>

      <Button type="button" variant="outline" size="sm" className="w-full" disabled={countActiveFilters(f) === 0} onClick={() => onChange({ ...config, filters: DEFAULT_CONFIG.filters })}>
        Quitar filtros
      </Button>
    </>
  );
}

function TableTab({ config, onChange, onExpandAll, onCollapseAll }: Props) {
  const t = config.table;
  const set = (patch: Partial<ReportConfig['table']>) => onChange({ ...config, table: { ...t, ...patch } });
  const [first, second] = t.groupBy;

  return (
    <>
      <Group title="Agrupar gastos" hint="Elige hasta dos niveles. Haz clic en un grupo de la hoja para abrirlo o cerrarlo.">
        <div className="space-y-2">
          <DimensionSelect
            label="Agrupar por"
            value={first ?? 'none'}
            allowNone="Sin agrupar (lista de movimientos)"
            onChange={(d) => set({ groupBy: d === 'none' ? [] : [d, ...(second && second !== d ? [second] : [])] })}
          />
          {first && (
            <DimensionSelect
              label="Luego por"
              value={second ?? 'none'}
              allowNone="Sin segundo nivel"
              exclude={[first]}
              onChange={(d) => set({ groupBy: d === 'none' ? [first] : [first, d] })}
            />
          )}
        </div>
        {first && (
          <div className="mt-2 flex gap-2">
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[12px]" onClick={onExpandAll}><ChevronsUpDown className="mr-1 size-3.5" />Expandir todo</Button>
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[12px]" onClick={onCollapseAll}><ChevronsDownUp className="mr-1 size-3.5" />Colapsar todo</Button>
          </div>
        )}
      </Group>

      {first && (
        <Group title="Ordenar grupos por">
          <div className="flex gap-2">
            <Select value={t.groupSort.sortBy} onValueChange={(v) => set({ groupSort: { ...t.groupSort, sortBy: v as ReportConfig['table']['groupSort']['sortBy'] } })}>
              <SelectTrigger aria-label="Ordenar grupos por" className="h-8 flex-1 text-[13px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="total">Monto total</SelectItem>
                <SelectItem value="count">Cantidad de compras</SelectItem>
                <SelectItem value="label">Nombre</SelectItem>
              </SelectContent>
            </Select>
            <DirToggle dir={t.groupSort.dir} onChange={(dir) => set({ groupSort: { ...t.groupSort, dir } })} />
          </div>
          <Select value={t.limit ? String(t.limit) : 'all'} onValueChange={(v) => set({ limit: v === 'all' ? null : Number(v) })}>
            <SelectTrigger aria-label="Grupos a mostrar" className="mt-2 h-8 w-full text-[13px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Mostrar todos los grupos</SelectItem>
              {[5, 10, 15, 20].map((n) => <SelectItem key={n} value={String(n)}>Solo los primeros {n}</SelectItem>)}
            </SelectContent>
          </Select>
        </Group>
      )}

      {first && (
        <Group title="Movimientos">
          <Check id="t-showtx" checked={t.showTransactions} onChange={(v) => set({ showTransactions: v })}>
            Mostrar cada movimiento dentro de su grupo
          </Check>
        </Group>
      )}

      {(!first || t.showTransactions) && (
        <Group title="Ordenar movimientos por">
          <div className="flex gap-2">
            <Select value={t.txSort.by} onValueChange={(v) => set({ txSort: { ...t.txSort, by: v as ReportConfig['table']['txSort']['by'] } })}>
              <SelectTrigger aria-label="Ordenar movimientos por" className="h-8 flex-1 text-[13px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Fecha</SelectItem>
                <SelectItem value="amount">Monto</SelectItem>
                <SelectItem value="merchant">Comercio</SelectItem>
              </SelectContent>
            </Select>
            <DirToggle dir={t.txSort.dir} onChange={(dir) => set({ txSort: { ...t.txSort, dir } })} />
          </div>
        </Group>
      )}

      <Group title="Columnas">
        {(Object.keys(COLUMN_LABELS) as TableColumn[])
          .filter((c) => first || (c !== 'count' && c !== 'share'))
          .map((c) => (
            <Check key={c} id={`col-${c}`} checked={t.columns[c]} onChange={(v) => set({ columns: { ...t.columns, [c]: v } })}>
              {COLUMN_LABELS[c]}
            </Check>
          ))}
      </Group>
    </>
  );
}

function DocumentTab({ config, onChange }: Props) {
  const d = config.document;
  const set = (patch: Partial<ReportConfig['document']>) => onChange({ ...config, document: { ...d, ...patch } });
  return (
    <>
      <Group title="Título" hint="Si lo dejas vacío se usa el nombre del mes.">
        <Input value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder="Ej: Gastos compartidos de octubre" maxLength={80} className="h-8 text-[13px]" />
      </Group>
      <Group title="Notas" hint="Aparecen en la sección Notas del reporte.">
        <textarea
          value={d.notes}
          onChange={(e) => set({ notes: e.target.value })}
          rows={6}
          maxLength={2000}
          placeholder="Ej: Este mes hubo gastos extra por el viaje a Pucón."
          className="w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-[13px] shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </Group>
      <Group title="Encabezado">
        <Check id="d-filters" checked={d.showFilterSummary} onChange={(v) => set({ showFilterSummary: v })}>
          Indicar en el reporte qué filtros se aplicaron
        </Check>
      </Group>
    </>
  );
}
