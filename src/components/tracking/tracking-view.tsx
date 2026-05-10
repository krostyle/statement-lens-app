'use client';

import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import {
  Upload, Trash2, TrendingUp, TrendingDown, Minus, RefreshCw,
  Bookmark, ChevronDown, ChevronRight, Pencil,
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { MonthPicker } from '@/src/components/ui/month-picker';
import { Skeleton } from '@/src/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { formatCurrency } from '@/src/lib/utils';
import type { SnapshotTransaction } from '@/src/domain/entities/snapshot';
import { SnapshotTxDialog } from './snapshot-tx-dialog';

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

interface SimpleCategory { id: string; name: string; }

interface MerchantMetric {
  merchant: string;
  total: number;
  count: number;
  categoryName: string;
  source: 'checking' | 'credit_card' | 'mixed';
  banks: string[];
}

interface CategoryMetric {
  categoryId: string;
  categoryName: string;
  total: number;
  pctOfTotal: number;
  budget: number | null;
  pctOfBudget: number | null;
}

interface Metrics {
  totalExpenses: number;
  totalIncome: number;
  dailyAverage: number;
  projectedMonthTotal: number;
  daysElapsed: number;
  daysInMonth: number;
  byMerchant: MerchantMetric[];
  byCategory: CategoryMetric[];
}

interface SnapshotData {
  month: string;
  checkingTxs: SnapshotTransaction[];
  ccTxs: SnapshotTransaction[];
  metrics: Metrics;
}

const SOURCE_LABEL: Record<string, string> = {
  credit_card: 'TC',
  checking:    'CC',
  mixed:       'TC+CC',
};

const BANK_LABEL: Record<string, string> = {
  santander:   'Santander',
  falabella:   'Falabella',
  bci:         'BCI',
  bancoestado: 'BancoEstado',
  liderbci:    'LiderBCI',
};

const BANKS = [
  { value: 'santander',   label: 'Santander' },
  { value: 'falabella',   label: 'Falabella' },
  { value: 'bci',         label: 'BCI' },
  { value: 'bancoestado', label: 'BancoEstado' },
  { value: 'liderbci',    label: 'LiderBCI' },
];

export function TrackingView() {
  const [month, setMonth]       = useState(currentMonth);
  const [data, setData]         = useState<SnapshotData | null>(null);
  const [categories, setCategories] = useState<SimpleCategory[]>([]);
  const [loading, setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError]       = useState('');

  // Accordion
  const [expandedMerchants, setExpandedMerchants] = useState<Set<string>>(new Set());
  // Per-transaction edit
  const [editingTx, setEditingTx] = useState<SnapshotTransaction | null>(null);

  // Merchant rules
  const [savedRules, setSavedRules]   = useState<Set<string>>(new Set());
  const [savingRule, setSavingRule]   = useState<string | null>(null);

  // Upload form
  const [bank, setBank]               = useState('santander');
  const [sourceType, setSourceType]   = useState<'checking' | 'credit_card'>('credit_card');
  const [csvInputMode, setCsvInputMode] = useState<'text' | 'file'>('text');
  const [csvText, setCsvText]         = useState('');
  const [csvFile, setCsvFile]         = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (m: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/snapshot?month=${m}`);
      setData(res.ok ? await res.json() : null);
    } catch {
      setData(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(month); }, [load, month]);

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.ok ? r.json() : [])
      .then((cats: SimpleCategory[]) =>
        setCategories([...cats].sort((a, b) => a.name.localeCompare(b.name, 'es')))
      )
      .catch(() => {});
  }, []);

  const handleUpload = async () => {
    const hasText = csvInputMode === 'text' && csvText.trim();
    const hasFile = csvInputMode === 'file' && csvFile;
    if (!hasText && !hasFile) {
      setError('Debes pegar texto CSV o seleccionar un archivo .csv.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('month', month);
      fd.append('bank', bank);
      fd.append('sourceType', sourceType);
      if (hasText) fd.append('csvText', csvText.trim());
      if (hasFile && csvFile) fd.append('csvFile', csvFile);

      const res  = await fetch('/api/snapshot', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? 'Error al procesar los datos.');
      } else {
        setData(json);
        setCsvText('');
        setCsvFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } catch {
      setError('Error de red al subir los datos.');
    }
    setUploading(false);
  };

  const handleClear = async () => {
    await fetch(`/api/snapshot/${month}`, { method: 'DELETE' });
    setData(null);
    setExpandedMerchants(new Set());
  };

  const handleSaveRule = async (mer: MerchantMetric) => {
    const cat = categories.find((c) => c.name === mer.categoryName);
    if (!cat) return;
    setSavingRule(mer.merchant);
    try {
      await fetch('/api/merchant-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchant: mer.merchant, bank: mer.banks[0] ?? 'santander', categoryId: cat.id }),
      });
      setSavedRules((prev) => new Set([...prev, mer.merchant]));
    } finally {
      setSavingRule(null);
    }
  };

  const handleCategoryChange = async (merchant: string, categoryId: string) => {
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return;
    const res = await fetch(`/api/snapshot/${month}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchant, categoryId, categoryName: cat.name }),
    });
    if (res.ok) {
      const { metrics } = await res.json();
      setData((prev) => prev ? { ...prev, metrics } : null);
    }
  };

  const toggleMerchant = (merchant: string) => {
    setExpandedMerchants((prev) => {
      const next = new Set(prev);
      if (next.has(merchant)) next.delete(merchant); else next.add(merchant);
      return next;
    });
  };

  const getMerchantTxs = (merchant: string): SnapshotTransaction[] => {
    if (!data) return [];
    return [...data.checkingTxs, ...data.ccTxs]
      .filter((t) => t.merchant === merchant && t.transactionType === 'expense' && t.amount < 0)
      .sort((a, b) => b.date.localeCompare(a.date));
  };

  const m        = data?.metrics;
  const hasData  = !!data && (data.checkingTxs.length > 0 || data.ccTxs.length > 0);
  const monthPct = m ? Math.min(Math.round((m.daysElapsed / m.daysInMonth) * 100), 100) : 0;
  const totalBudget = m ? m.byCategory.reduce((s, c) => s + (c.budget ?? 0), 0) : 0;
  const budgetPct   = totalBudget > 0 && m ? Math.round((m.totalExpenses / totalBudget) * 100) : null;

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthPicker value={month} onChange={(v) => setMonth(v || currentMonth())} placeholder="Mes actual" />
        {hasData && (
          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={handleClear}>
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Limpiar datos
          </Button>
        )}
      </div>

      {/* Upload section */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-700">Subir datos del mes</h2>
          {hasData && (
            <span className="text-xs text-zinc-400">
              {data!.checkingTxs.length + data!.ccTxs.length} transacciones cargadas
            </span>
          )}
        </div>

        {/* Bank + source type selectors */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium text-zinc-600">Banco</p>
            <Select value={bank} onValueChange={setBank}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BANKS.map((b) => (
                  <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-zinc-600">Tipo</p>
            <Select value={sourceType} onValueChange={(v) => setSourceType(v as typeof sourceType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="credit_card">Tarjeta de Crédito</SelectItem>
                <SelectItem value="checking">Cuenta Corriente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Text / file toggle */}
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="csvInputMode"
              value="text"
              checked={csvInputMode === 'text'}
              onChange={() => setCsvInputMode('text')}
              className="accent-brand-600"
            />
            Pegar texto CSV
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="csvInputMode"
              value="file"
              checked={csvInputMode === 'file'}
              onChange={() => setCsvInputMode('file')}
              className="accent-brand-600"
            />
            Subir archivo .csv
          </label>
        </div>

        {/* CSV input */}
        {csvInputMode === 'text' ? (
          <textarea
            className="w-full h-24 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent placeholder:text-zinc-400"
            placeholder={"date,description,amount\n2026-05-08,DELIVERY DEL SO,31430\n2026-05-08,PAYU *UBER TR,2077"}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
          />
        ) : (
          <label className="flex flex-col items-center justify-center gap-2 h-24 rounded-lg border-2 border-dashed border-zinc-200 hover:border-brand-600 cursor-pointer transition-colors bg-zinc-50 hover:bg-brand-50 text-zinc-400 hover:text-brand-600">
            <Upload className="h-5 w-5" />
            <span className="text-xs">{csvFile ? csvFile.name : 'Seleccionar archivo (.csv)'}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
            />
          </label>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button onClick={handleUpload} disabled={uploading} className="w-full sm:w-auto">
          {uploading ? (
            <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Procesando...</>
          ) : (
            <><RefreshCw className="h-4 w-4 mr-2" /> {hasData ? 'Actualizar datos' : 'Analizar'}</>
          )}
        </Button>
      </div>

      {/* Metrics */}
      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      )}

      {!loading && hasData && m && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard
              label="Gastado"
              value={formatCurrency(m.totalExpenses)}
              icon={<TrendingDown className="h-4 w-4 text-red-500" />}
              sub={`Día ${m.daysElapsed} de ${m.daysInMonth}`}
            />
            <SummaryCard
              label="Ingresos"
              value={formatCurrency(m.totalIncome)}
              icon={<TrendingUp className="h-4 w-4 text-green-500" />}
              sub={m.totalIncome > 0 ? `+${formatCurrency(m.totalIncome - m.totalExpenses)} disponible` : '—'}
            />
            <SummaryCard
              label="Promedio diario"
              value={formatCurrency(m.dailyAverage)}
              icon={<Minus className="h-4 w-4 text-zinc-400" />}
              sub="Gasto por día"
            />
            <SummaryCard
              label="Proyección"
              value={formatCurrency(m.projectedMonthTotal)}
              icon={<TrendingUp className="h-4 w-4 text-amber-500" />}
              sub="Estimado fin de mes"
            />
          </div>

          {/* Progress bars */}
          <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Avance del mes</span>
                <span className="font-semibold text-zinc-700">
                  Día {m.daysElapsed} / {m.daysInMonth} ({monthPct}%)
                </span>
              </div>
              <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${monthPct}%` }} />
              </div>
            </div>

            {budgetPct !== null && (
              <div className="space-y-2 pt-2 border-t border-zinc-100">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">vs Presupuesto</span>
                  <span className="font-semibold text-zinc-700">
                    {formatCurrency(m.totalExpenses)}
                    <span className="text-zinc-400 font-normal"> / {formatCurrency(totalBudget)}</span>
                    <span className={`ml-1.5 text-xs font-medium ${budgetPct > 100 ? 'text-red-500' : budgetPct > 80 ? 'text-amber-500' : 'text-green-600'}`}>
                      ({budgetPct}%)
                    </span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${budgetPct > 100 ? 'bg-red-500' : budgetPct > 80 ? 'bg-amber-400' : 'bg-brand-600'}`}
                    style={{ width: `${Math.min(budgetPct, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* By merchant — accordion */}
          {m.byMerchant.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50">
                <h2 className="text-sm font-semibold text-zinc-700">Por comercio</h2>
              </div>
              <div className="divide-y divide-zinc-100">
                {m.byMerchant.map((mer) => {
                  const isExpanded = expandedMerchants.has(mer.merchant);
                  const txs        = isExpanded ? getMerchantTxs(mer.merchant) : [];

                  return (
                    <div key={mer.merchant}>
                      {/* Merchant header row */}
                      <div className="px-4 py-3 flex items-center gap-3">
                        {/* Expand toggle */}
                        <button
                          onClick={() => toggleMerchant(mer.merchant)}
                          className="shrink-0 text-zinc-400 hover:text-zinc-600"
                          aria-label={isExpanded ? 'Contraer' : 'Expandir'}
                        >
                          {isExpanded
                            ? <ChevronDown className="h-4 w-4" />
                            : <ChevronRight className="h-4 w-4" />}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-zinc-800">{mer.merchant}</span>
                            <span className="text-xs text-zinc-400 shrink-0">{mer.count}×</span>
                            {mer.banks.map((b) => (
                              <span key={b} className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 shrink-0">
                                {BANK_LABEL[b] ?? b}
                              </span>
                            ))}
                            <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 shrink-0">
                              {SOURCE_LABEL[mer.source] ?? mer.source}
                            </span>
                          </div>
                          {categories.length > 0 ? (
                            <Select
                              value={categories.find((c) => c.name === mer.categoryName)?.id ?? ''}
                              onValueChange={(value) => handleCategoryChange(mer.merchant, value)}
                            >
                              <SelectTrigger className="mt-0.5 h-5 text-xs text-zinc-400 border-none shadow-none px-0 gap-1 w-auto max-w-55 focus:ring-0">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map((c) => (
                                  <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <p className="text-xs text-zinc-400 mt-0.5">{mer.categoryName}</p>
                          )}
                        </div>

                        <span className="text-sm font-semibold text-zinc-900 shrink-0">{formatCurrency(mer.total)}</span>

                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-7 w-7 shrink-0 ${savedRules.has(mer.merchant) ? 'text-brand-600' : 'text-zinc-300 hover:text-zinc-500'}`}
                          onClick={() => handleSaveRule(mer)}
                          disabled={savingRule === mer.merchant}
                          title="Guardar como regla de comercio"
                        >
                          <Bookmark className="h-3.5 w-3.5" fill={savedRules.has(mer.merchant) ? 'currentColor' : 'none'} />
                        </Button>
                      </div>

                      {/* Expanded transaction rows */}
                      {isExpanded && txs.length > 0 && (
                        <div className="bg-zinc-50 border-t border-zinc-100 divide-y divide-zinc-100">
                          {txs.map((tx) => (
                            <div key={tx.id ?? tx.date + tx.amount} className="px-4 py-2 flex items-center gap-3 pl-11">
                              <span className="text-xs text-zinc-400 shrink-0 w-12">
                                {tx.date.slice(5).replace('-', '/')}
                              </span>
                              <span className="text-xs text-zinc-600 flex-1 min-w-0">{tx.description}</span>
                              <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-500 shrink-0">
                                {tx.categoryName}
                              </span>
                              <span className="text-xs font-semibold text-zinc-800 shrink-0">
                                {formatCurrency(Math.abs(tx.amount))}
                              </span>
                              {tx.id && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 shrink-0 text-zinc-300 hover:text-zinc-600"
                                  onClick={() => setEditingTx(tx)}
                                  title="Editar transacción"
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* By category */}
          {m.byCategory.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-700">Por categoría</h2>
                <span className="text-xs text-zinc-400">% del total gastado</span>
              </div>
              <div className="divide-y divide-zinc-100">
                {m.byCategory.map((cat) => (
                  <div key={cat.categoryId} className="px-4 py-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-zinc-800 truncate">{cat.categoryName}</span>
                      <div className="text-right shrink-0">
                        <span className="text-sm font-semibold text-zinc-900">{formatCurrency(cat.total)}</span>
                        {cat.budget && (
                          <span className="text-xs text-zinc-400 ml-1">/ {formatCurrency(cat.budget)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <span>{cat.pctOfTotal}% del total</span>
                      {cat.pctOfBudget !== null && (
                        <span className={`font-medium ${cat.pctOfBudget > 100 ? 'text-red-500' : cat.pctOfBudget > 80 ? 'text-amber-500' : 'text-green-600'}`}>
                          · {cat.pctOfBudget}% del presupuesto
                        </span>
                      )}
                    </div>
                    {cat.budget && (
                      <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${cat.pctOfBudget! > 100 ? 'bg-red-500' : cat.pctOfBudget! > 80 ? 'bg-amber-400' : 'bg-brand-600'}`}
                          style={{ width: `${Math.min(cat.pctOfBudget!, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!loading && !hasData && (
        <div className="rounded-xl border border-dashed border-zinc-200 p-10 text-center text-zinc-400 text-sm">
          Sube tus movimientos en formato CSV para ver el resumen del mes.
        </div>
      )}

      {/* Per-transaction edit dialog */}
      {editingTx && (
        <SnapshotTxDialog
          tx={editingTx}
          categories={categories}
          month={month}
          onSuccess={(metrics) => setData((prev) => prev ? { ...prev, metrics: metrics as Metrics } : null)}
          onClose={() => setEditingTx(null)}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon, sub }: {
  label: string;
  value: string;
  icon: ReactNode;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500">{label}</span>
        {icon}
      </div>
      <p className="text-lg font-bold text-zinc-900 leading-tight">{value}</p>
      <p className="text-xs text-zinc-400">{sub}</p>
    </div>
  );
}
