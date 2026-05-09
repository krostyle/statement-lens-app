'use client';

import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { Upload, Trash2, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { MonthPicker } from '@/src/components/ui/month-picker';
import { Skeleton } from '@/src/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { formatCurrency } from '@/src/lib/utils';

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

interface Category { id: string; name: string; }

interface MerchantMetric {
  merchant: string;
  total: number;
  count: number;
  categoryName: string;
  source: 'checking' | 'credit_card' | 'mixed';
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
  checkingTxs: unknown[];
  ccTxs: unknown[];
  metrics: Metrics;
}

const SOURCE_LABEL: Record<string, string> = {
  credit_card: 'TC',
  checking:    'CC',
  mixed:       'TC+CC',
};

export function TrackingView() {
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState<SnapshotData | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const [checkingFile, setCheckingFile] = useState<File | null>(null);
  const [ccText, setCCText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (m: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/snapshot?month=${m}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        setData(null);
      }
    } catch {
      setData(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(month); }, [load, month]);

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.ok ? r.json() : [])
      .then((cats: Category[]) => setCategories(cats))
      .catch(() => {});
  }, []);

  const handleUpload = async () => {
    if (!checkingFile && !ccText.trim()) {
      setError('Debes subir tus movimientos en Excel (.xlsx) o pegar texto de tarjeta.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('month', month);
      if (checkingFile) fd.append('checkingFile', checkingFile);
      if (ccText.trim()) fd.append('ccText', ccText.trim());

      const res = await fetch('/api/snapshot', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? 'Error al procesar los datos.');
      } else {
        setData(json);
        setCheckingFile(null);
        setCCText('');
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
  };

  const handleCategoryChange = async (merchant: string, categoryId: string) => {
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return;
    await fetch(`/api/snapshot/${month}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchant, categoryId, categoryName: cat.name }),
    });
    load(month);
  };

  const m = data?.metrics;
  const hasData = !!data && (data.checkingTxs.length > 0 || data.ccTxs.length > 0);
  const monthPct = m ? Math.min(Math.round((m.daysElapsed / m.daysInMonth) * 100), 100) : 0;

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
              {data!.checkingTxs.length} movimientos · {data!.ccTxs.length} tarjeta
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* XLSX upload */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-zinc-600">Últimos movimientos (.xlsx)</p>
            <label className="flex flex-col items-center justify-center gap-2 h-24 rounded-lg border-2 border-dashed border-zinc-200 hover:border-brand-400 cursor-pointer transition-colors bg-zinc-50 hover:bg-brand-50 text-zinc-400 hover:text-brand-600">
              <Upload className="h-5 w-5" />
              <span className="text-xs">{checkingFile ? checkingFile.name : 'Seleccionar archivo Excel (.xlsx)'}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => setCheckingFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {data?.checkingTxs && data.checkingTxs.length > 0 && !checkingFile && (
              <p className="text-xs text-green-600">✓ {data.checkingTxs.length} movimientos cargados</p>
            )}
          </div>

          {/* CC text paste */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-zinc-600">Tarjeta de crédito (pegar texto)</p>
            <textarea
              className="w-full h-24 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent placeholder:text-zinc-400"
              placeholder={"date,description,amount\n2026-05-08,DELIVERY DEL SO,31430\n2026-05-08,PAYU *UBER TR,2077"}
              value={ccText}
              onChange={(e) => setCCText(e.target.value)}
            />
            {data?.ccTxs && data.ccTxs.length > 0 && !ccText && (
              <p className="text-xs text-green-600">✓ {data.ccTxs.length} transacciones cargadas</p>
            )}
          </div>
        </div>

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

          {/* Month progress */}
          <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Avance del mes</span>
              <span className="font-semibold text-zinc-700">Día {m.daysElapsed} / {m.daysInMonth} ({monthPct}%)</span>
            </div>
            <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
              <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${monthPct}%` }} />
            </div>
          </div>

          {/* By merchant */}
          {m.byMerchant.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50">
                <h2 className="text-sm font-semibold text-zinc-700">Por comercio</h2>
              </div>
              <div className="divide-y divide-zinc-100">
                {m.byMerchant.map((mer) => (
                  <div key={mer.merchant} className="px-4 py-3 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-zinc-800 truncate max-w-[200px]">{mer.merchant}</span>
                        <span className="text-xs text-zinc-400 shrink-0">{mer.count}×</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 shrink-0">
                          {SOURCE_LABEL[mer.source] ?? mer.source}
                        </span>
                      </div>
                      {categories.length > 0 ? (
                        <Select
                          value={categories.find((c) => c.name === mer.categoryName)?.id ?? ''}
                          onValueChange={(value) => handleCategoryChange(mer.merchant, value)}
                        >
                          <SelectTrigger className="mt-0.5 h-5 text-xs text-zinc-400 border-none shadow-none px-0 gap-1 w-auto max-w-[220px] focus:ring-0">
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
                  </div>
                ))}
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
                          className={`h-full rounded-full transition-all ${cat.pctOfBudget! > 100 ? 'bg-red-500' : cat.pctOfBudget! > 80 ? 'bg-amber-400' : 'bg-brand-500'}`}
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
          Sube tus últimos movimientos en Excel (.xlsx) o pega el texto de tu tarjeta para ver el resumen del mes.
        </div>
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
