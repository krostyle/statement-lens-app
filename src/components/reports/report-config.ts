import {
  DEFAULT_REPORT_FILTERS,
  type GroupSort,
  type ReportDimension,
  type ReportFilters,
  type SortDir,
  type TransactionSortBy,
} from '@/src/domain/services/report.service';

export type SectionId =
  | 'summary'
  | 'budget'
  | 'distribution'
  | 'budgetBars'
  | 'comparison'
  | 'trend'
  | 'expenses'
  | 'categories'
  | 'income'
  | 'transfers'
  | 'notes';

export const SECTION_LABELS: Record<SectionId, string> = {
  summary: 'Resumen',
  budget: 'Presupuesto total',
  distribution: 'Distribución del gasto',
  budgetBars: 'Gastado vs. presupuesto',
  comparison: 'Comparación con el mes anterior',
  trend: 'Tendencia de 6 meses',
  expenses: 'Gastos',
  categories: 'Detalle por categoría',
  income: 'Ingresos',
  transfers: 'Transferencias internas',
  notes: 'Notas',
};

export type TableColumn = 'date' | 'category' | 'bank' | 'count' | 'share';

export const COLUMN_LABELS: Record<TableColumn, string> = {
  date: 'Fecha',
  category: 'Categoría',
  bank: 'Banco y medio',
  count: 'Nº de compras',
  share: '% del gasto',
};

export interface ReportConfig {
  version: 1;
  sections: { id: SectionId; visible: boolean }[];
  filters: ReportFilters;
  table: {
    /** 0–2 nested dimensions; empty = flat list of movements. */
    groupBy: ReportDimension[];
    groupSort: GroupSort;
    txSort: { by: TransactionSortBy; dir: SortDir };
    showTransactions: boolean;
    columns: Record<TableColumn, boolean>;
    /** Top-level groups shown; the rest fold into one summary row. null = all. */
    limit: number | null;
  };
  distribution: { dimension: ReportDimension; chart: 'donut' | 'bars'; maxSlices: number };
  comparison: { dimension: ReportDimension };
  document: { title: string; notes: string; showFilterSummary: boolean };
}

export const DEFAULT_CONFIG: ReportConfig = {
  version: 1,
  sections: [
    { id: 'summary', visible: true },
    { id: 'budget', visible: true },
    { id: 'distribution', visible: true },
    { id: 'budgetBars', visible: true },
    { id: 'comparison', visible: true },
    { id: 'trend', visible: true },
    { id: 'expenses', visible: true },
    { id: 'categories', visible: false },
    { id: 'income', visible: true },
    { id: 'transfers', visible: false },
    { id: 'notes', visible: true },
  ],
  filters: DEFAULT_REPORT_FILTERS,
  table: {
    groupBy: ['category'],
    groupSort: { sortBy: 'total', dir: 'desc' },
    txSort: { by: 'date', dir: 'desc' },
    showTransactions: false,
    columns: { date: true, category: true, bank: true, count: true, share: true },
    limit: null,
  },
  distribution: { dimension: 'category', chart: 'donut', maxSlices: 7 },
  comparison: { dimension: 'category' },
  document: { title: '', notes: '', showFilterSummary: true },
};

const STORAGE_KEY = 'statement-lens:report-builder:v1';

/** Merges a stored config onto the defaults so new fields/sections survive old saves. */
function mergeConfig(stored: Partial<ReportConfig>): ReportConfig {
  const known = new Set(DEFAULT_CONFIG.sections.map((s) => s.id));
  const storedSections = (stored.sections ?? []).filter((s) => known.has(s.id));
  const missing = DEFAULT_CONFIG.sections.filter((d) => !storedSections.some((s) => s.id === d.id));
  return {
    ...DEFAULT_CONFIG,
    ...stored,
    version: 1,
    sections: [...storedSections, ...missing],
    filters: { ...DEFAULT_CONFIG.filters, ...stored.filters },
    table: {
      ...DEFAULT_CONFIG.table,
      ...stored.table,
      columns: { ...DEFAULT_CONFIG.table.columns, ...stored.table?.columns },
    },
    distribution: { ...DEFAULT_CONFIG.distribution, ...stored.distribution },
    comparison: { ...DEFAULT_CONFIG.comparison, ...stored.comparison },
    document: { ...DEFAULT_CONFIG.document, ...stored.document },
  };
}

export function loadConfig(): ReportConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<ReportConfig>;
    return parsed?.version === 1 ? mergeConfig(parsed) : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: ReportConfig): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Private mode / blocked storage — the builder still works, it just won't remember.
  }
}

export function countActiveFilters(f: ReportFilters): number {
  return (
    (f.banks.length > 0 ? 1 : 0) +
    (f.sources.length > 0 ? 1 : 0) +
    (f.categoryIds.length > 0 ? 1 : 0) +
    (f.search.trim() ? 1 : 0) +
    (f.minAmount > 0 ? 1 : 0) +
    (f.includeReturns ? 0 : 1) +
    (f.includeReimbursed ? 1 : 0)
  );
}
