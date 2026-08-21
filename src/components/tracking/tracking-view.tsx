'use client';

import { useEffect, useState, useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Upload, Trash2, TrendingUp, TrendingDown, Minus, RefreshCw,
  ChevronDown, ChevronRight, Pencil, BookMarked, ExternalLink, X, Database,
  CheckCircle2, Circle,
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { MonthPicker } from '@/src/components/ui/month-picker';
import { Skeleton } from '@/src/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/src/components/ui/dialog';
import { Label } from '@/src/components/ui/label';
import { formatCurrency } from '@/src/lib/utils';
import type { SnapshotTransaction } from '@/src/domain/entities/snapshot';
import { SnapshotTxDialog, type TxUpdate } from './snapshot-tx-dialog';

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function normKey(s: string) { return s.toLowerCase().trim(); }

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

interface UploadRecord {
  id: string;
  bank: string;
  accountType: string;
  month: string;
  rowCount: number;
  isFinalized: boolean;
  uploadedAt: string;
}

interface SnapshotData {
  month: string;
  checkingTxs: SnapshotTransaction[];
  ccTxs: SnapshotTransaction[];
  metrics: Metrics;
  uploads: UploadRecord[];
}

const SOURCE_LABEL: Record<string, string> = {
  credit_card: 'TC',
  checking:    'CC',
  mixed:       'TC+CC',
};

const BANK_LABEL: Record<string, string> = {
  santander: 'Santander',
  falabella: 'Falabella',
};

const BANKS = [
  { value: 'santander', label: 'Santander' },
  { value: 'falabella', label: 'Falabella' },
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
  // Merchants the user has manually marked as "unassigned" this session
  const [unassignedMerchants, setUnassignedMerchants] = useState<Set<string>>(new Set());
  // Bank filter for the merchant list
  const [filterBank, setFilterBank] = useState<string | null>(null);
  // Per-transaction edit
  const [editingTx, setEditingTx] = useState<SnapshotTransaction | null>(null);

  const [totalBudget, setTotalBudget] = useState(0);

  // Merchant rules — keyed by normalized pattern (lowercase)
  const [savedRules, setSavedRules]   = useState<Set<string>>(new Set());
  const [savingRule, setSavingRule]   = useState<string | null>(null);

  // Delete-upload confirmation
  const [confirmDeleteUpload, setConfirmDeleteUpload] = useState<UploadRecord | null>(null);
  const [deletingUpload, setDeletingUpload]           = useState(false);

  // Upload dialog
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadMonth, setUploadMonth] = useState(currentMonth);
  const [bank, setBank]             = useState('santander');
  const [sourceType, setSourceType] = useState<'checking' | 'credit_card'>('credit_card');
  const [csvText, setCsvText]       = useState('');

  const openUpload = () => {
    setUploadMonth(month);
    setBank('santander');
    setSourceType('credit_card');
    setCsvText('');
    setError('');
    setUploadOpen(true);
  };

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

  useEffect(() => {
    load(month);
    setUnassignedMerchants(new Set());
    setFilterBank(null);
    fetch(`/api/budgets?month=${month}`)
      .then((r) => r.ok ? r.json() : [])
      .then((budgets: { monthlyAmount: number }[]) =>
        setTotalBudget(budgets.reduce((s, b) => s + b.monthlyAmount, 0))
      )
      .catch(() => {});
  }, [load, month]);

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.ok ? r.json() : [])
      .then((cats: SimpleCategory[]) =>
        setCategories([...cats].sort((a, b) => a.name.localeCompare(b.name, 'es')))
      )
      .catch(() => {});
  }, []);

  // Pre-populate savedRules from existing merchant rules so state persists across page loads
  useEffect(() => {
    fetch('/api/merchant-rules')
      .then((r) => r.ok ? r.json() : [])
      .then((rules: { merchantPattern: string }[]) =>
        setSavedRules(new Set(rules.map((r) => r.merchantPattern)))
      )
      .catch(() => {});
  }, []);

  const handleUpload = async () => {
    if (!csvText.trim()) {
      setError('Debes pegar los movimientos del banco.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('month', uploadMonth);
      fd.append('bank', bank);
      fd.append('sourceType', sourceType);
      fd.append('csvText', csvText.trim());

      const res  = await fetch('/api/snapshot', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? 'Error al procesar los datos.');
      } else {
        setMonth(uploadMonth);
        setData(json);
        setUploadOpen(false);
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
    setFilterBank(null);
  };

  const handleDeleteUpload = async () => {
    if (!confirmDeleteUpload) return;
    setDeletingUpload(true);
    await fetch(`/api/snapshot/uploads/${confirmDeleteUpload.id}`, { method: 'DELETE' });
    setConfirmDeleteUpload(null);
    setDeletingUpload(false);
    await load(month);
    setFilterBank(null);
  };

  const toggleFinalized = async (u: UploadRecord) => {
    const next = !u.isFinalized;
    setData((prev) => prev ? {
      ...prev,
      uploads: prev.uploads.map((r) => r.id === u.id ? { ...r, isFinalized: next } : r),
    } : null);
    await fetch(`/api/snapshot/uploads/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isFinalized: next }),
    });
  };

  const saveRule = async (merchant: string, bank: string, categoryId: string) => {
    const key = normKey(merchant);
    setSavingRule(key);
    try {
      await fetch('/api/merchant-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchant, bank, categoryId }),
      });
      setSavedRules((prev) => new Set([...prev, key]));
    } finally {
      setSavingRule(null);
    }
  };

  const handleSaveGroupRule = async (mer: MerchantMetric) => {
    const cat = categories.find((c) => c.name === mer.categoryName);
    if (!cat) return;
    await saveRule(mer.merchant, mer.banks[0] ?? 'santander', cat.id);
  };

  const handleSaveTxRule = async (tx: SnapshotTransaction) => {
    await saveRule(tx.merchant, tx.bank ?? 'santander', tx.categoryId);
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
      const updateArr = (txs: SnapshotTransaction[]) =>
        txs.map((t) => t.merchant === merchant ? { ...t, categoryId, categoryName: cat.name } : t);
      setData((prev) => prev ? {
        ...prev,
        metrics,
        checkingTxs: updateArr(prev.checkingTxs),
        ccTxs:       updateArr(prev.ccTxs),
      } : null);
    }
  };

  const handleTxSuccess = (metrics: Metrics, txUpdate: TxUpdate) => {
    setData((prev) => {
      if (!prev) return null;
      const updateArr = (txs: SnapshotTransaction[]) =>
        txs.map((t) => t.id === txUpdate.id ? { ...t, ...txUpdate } : t);
      return {
        ...prev,
        metrics,
        checkingTxs: updateArr(prev.checkingTxs),
        ccTxs:       updateArr(prev.ccTxs),
      };
    });
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
  const uploads  = data?.uploads ?? [];
  const monthPct = m ? Math.min(Math.round((m.daysElapsed / m.daysInMonth) * 100), 100) : 0;
  const budgetPct = totalBudget > 0 && m ? Math.round((m.totalExpenses / totalBudget) * 100) : null;

  const availableBanks: string[] = data
    ? [...new Set([...data.checkingTxs, ...data.ccTxs].map((t) => (t as { bank?: string }).bank ?? 'santander'))].sort()
    : [];
  const visibleMerchants = m
    ? (filterBank ? m.byMerchant.filter((mer) => mer.banks.includes(filterBank)) : m.byMerchant)
    : [];

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthPicker value={month} onChange={(v) => setMonth(v || currentMonth())} placeholder="Mes actual" />
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button size="sm" onClick={openUpload}>
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            {hasData ? 'Agregar cartola' : 'Subir cartola'}
          </Button>
          {hasData && (
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/snapshot/report?month=${month}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Ver reporte
              </a>
            </Button>
          )}
          {hasData && (
            <Button variant="destructive" size="sm" onClick={handleClear}>
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Limpiar todo
            </Button>
          )}
        </div>
      </div>

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={(v) => { if (!v) setUploadOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Subir cartola</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Mes contable</Label>
              <MonthPicker
                value={uploadMonth}
                onChange={(v) => setUploadMonth(v || currentMonth())}
                placeholder="Selecciona el mes..."
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Banco</Label>
                <Select value={bank} onValueChange={setBank}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BANKS.map((b) => (
                      <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de cuenta</Label>
                <Select value={sourceType} onValueChange={(v) => setSourceType(v as typeof sourceType)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit_card">Tarjeta de crédito</SelectItem>
                    <SelectItem value="checking">Cuenta corriente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Movimientos</Label>
              <textarea
                className="w-full h-40 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent placeholder:text-zinc-400"
                placeholder={"Pega los movimientos copiados desde el portal del banco.\n\nSantander TC / CC:\nFecha  Tipo  Detalle  Monto cargo  Monto abono\n25/07/2026  FASIL MARKET  -$19.190\n\nFalabella TC (Excel):\nFECHA  DESCRIPCION  TITULAR/ADICIONAL  MONTO  CUOTAS PENDIENTES  VALOR CUOTA\n19-07-2026  COMPRA UBER  Adicional  $5.513  0  $5.513"}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                autoFocus
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={uploading}>
              Cancelar
            </Button>
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading
                ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Procesando…</>
                : <><Upload className="h-4 w-4 mr-2" />Subir</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete upload confirmation */}
      <Dialog open={!!confirmDeleteUpload} onOpenChange={(v) => { if (!v) setConfirmDeleteUpload(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Eliminar cartola?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600">
            Se eliminarán las{' '}
            <span className="font-semibold">{confirmDeleteUpload?.rowCount} transacciones</span>{' '}
            de{' '}
            <span className="font-semibold">
              {confirmDeleteUpload ? (BANK_LABEL[confirmDeleteUpload.bank] ?? confirmDeleteUpload.bank) : ''}{' '}
              {confirmDeleteUpload?.accountType === 'credit_card' ? 'Tarjeta de Crédito' : 'Cuenta Corriente'}
            </span>.{' '}
            Esta acción no se puede deshacer.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteUpload(null)} disabled={deletingUpload}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteUpload} disabled={deletingUpload}>
              {deletingUpload
                ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Eliminando…</>
                : <><Trash2 className="h-4 w-4 mr-2" />Eliminar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload history */}
      {uploads.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <div className="px-4 py-2.5 border-b border-zinc-100 bg-zinc-50 flex items-center gap-2">
            <Database className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-xs font-semibold text-zinc-600">Cartolas cargadas</span>
          </div>
          <div className="divide-y divide-zinc-100">
            {uploads.map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-zinc-800">
                    {BANK_LABEL[u.bank] ?? u.bank}
                  </span>
                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500">
                    {u.accountType === 'credit_card' ? 'Tarjeta de Crédito' : 'Cuenta Corriente'}
                  </span>
                  <span className="ml-2 text-xs text-zinc-400">{u.rowCount} transacciones</span>
                </div>
                <span className="text-xs text-zinc-400 shrink-0">
                  {new Date(u.uploadedAt).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
                <button
                  onClick={() => toggleFinalized(u)}
                  className={`shrink-0 transition-colors ${u.isFinalized ? 'text-green-500 hover:text-green-600' : 'text-zinc-300 hover:text-zinc-500'}`}
                  title={u.isFinalized ? 'Cartola completa — haz clic para desmarcar' : 'Marcar cartola como completa'}
                >
                  {u.isFinalized
                    ? <CheckCircle2 className="h-4 w-4" />
                    : <Circle className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => setConfirmDeleteUpload(u)}
                  className="text-zinc-300 hover:text-red-500 transition-colors shrink-0"
                  title="Eliminar esta cartola y sus transacciones"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
            <SummaryCard label="Gastado" value={formatCurrency(m.totalExpenses)}
              icon={<TrendingDown className="h-4 w-4 text-red-500" />}
              sub={`Día ${m.daysElapsed} de ${m.daysInMonth}`} />
            <SummaryCard label="Ingresos" value={formatCurrency(m.totalIncome)}
              icon={<TrendingUp className="h-4 w-4 text-green-500" />}
              sub={m.totalIncome > 0 ? `+${formatCurrency(m.totalIncome - m.totalExpenses)} disponible` : '—'} />
            <SummaryCard label="Promedio diario" value={formatCurrency(m.dailyAverage)}
              icon={<Minus className="h-4 w-4 text-zinc-400" />}
              sub="Gasto por día" />
            <SummaryCard label="Proyección" value={formatCurrency(m.projectedMonthTotal)}
              icon={<TrendingUp className="h-4 w-4 text-amber-500" />}
              sub="Estimado fin de mes" />
          </div>

          {/* Progress bars */}
          <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-4">
            {/* Total spent — always visible */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <div>
                  <span className="text-zinc-700 font-medium">Total gastado</span>
                  {budgetPct !== null && (
                    <span className="ml-2 text-xs text-zinc-400">de {formatCurrency(totalBudget)} en presupuesto</span>
                  )}
                </div>
                <div className="text-right">
                  <span className="font-semibold text-zinc-900">{formatCurrency(m.totalExpenses)}</span>
                  {budgetPct !== null && (
                    <span className={`ml-1.5 text-xs font-medium ${budgetPct > 100 ? 'text-red-500' : budgetPct > 80 ? 'text-amber-500' : 'text-green-600'}`}>
                      ({budgetPct}%)
                    </span>
                  )}
                </div>
              </div>
              {budgetPct !== null ? (
                <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${budgetPct > 100 ? 'bg-red-500' : budgetPct > 80 ? 'bg-amber-400' : 'bg-brand-600'}`}
                    style={{ width: `${Math.min(budgetPct, 100)}%` }}
                  />
                </div>
              ) : (
                <p className="text-xs text-zinc-400">
                  Sin presupuesto definido — configúralo en{' '}
                  <Link href="/budgets" className="text-brand-600 hover:underline">Presupuestos</Link>
                </p>
              )}
            </div>

            {/* Month progress */}
            <div className="space-y-2 pt-2 border-t border-zinc-100">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Avance del mes</span>
                <span className="font-semibold text-zinc-700">
                  Día {m.daysElapsed} / {m.daysInMonth}
                  <span className="text-zinc-400 font-normal ml-1">({monthPct}%)</span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                <div className="h-full rounded-full bg-zinc-300 transition-all" style={{ width: `${monthPct}%` }} />
              </div>
            </div>
          </div>

          {/* By merchant — accordion */}
          {m.byMerchant.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-semibold text-zinc-700">Por comercio</h2>
                  {availableBanks.length > 1 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      <button
                        onClick={() => setFilterBank(null)}
                        className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                          filterBank === null
                            ? 'bg-brand-600 text-white border-brand-600'
                            : 'border-zinc-200 text-zinc-500 hover:border-zinc-400'
                        }`}
                      >
                        Todos
                      </button>
                      {availableBanks.map((b) => (
                        <button
                          key={b}
                          onClick={() => setFilterBank(filterBank === b ? null : b)}
                          className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                            filterBank === b
                              ? 'bg-brand-600 text-white border-brand-600'
                              : 'border-zinc-200 text-zinc-500 hover:border-zinc-400'
                          }`}
                        >
                          {BANK_LABEL[b] ?? b}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button variant="outline" size="sm" asChild title="Gestionar reglas de categorización">
                  <Link href="/rules">
                    <BookMarked className="h-4 w-4" />
                    <span>Reglas</span>
                  </Link>
                </Button>
              </div>
              <div className="divide-y divide-zinc-100">
                {visibleMerchants.length === 0 && (
                  <p className="text-sm text-zinc-400 px-4 py-6 text-center">Sin comercios para este banco.</p>
                )}
                {visibleMerchants.map((mer) => {
                  const isExpanded  = expandedMerchants.has(mer.merchant);
                  const txs         = isExpanded ? getMerchantTxs(mer.merchant) : [];
                  const ruleKey     = normKey(mer.merchant);
                  const ruleIsSaved = savedRules.has(ruleKey);

                  return (
                    <div key={mer.merchant}>
                      {/* Merchant header — entire row is clickable */}
                      <div
                        className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-zinc-50 transition-colors"
                        onClick={() => toggleMerchant(mer.merchant)}
                      >
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4 text-zinc-400 shrink-0" />
                          : <ChevronRight className="h-4 w-4 text-zinc-400 shrink-0" />}

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
                              value={
                                unassignedMerchants.has(mer.merchant) || !mer.categoryName
                                  ? '__unassigned__'
                                  : (categories.find((c) => c.name === mer.categoryName)?.id ?? '__unassigned__')
                              }
                              onValueChange={(value) => {
                                if (value === '__unassigned__') {
                                  setUnassignedMerchants((prev) => new Set([...prev, mer.merchant]));
                                } else {
                                  setUnassignedMerchants((prev) => { const next = new Set(prev); next.delete(mer.merchant); return next; });
                                  handleCategoryChange(mer.merchant, value);
                                }
                              }}
                            >
                              <SelectTrigger
                                onClick={(e) => e.stopPropagation()}
                                className="mt-0.5 h-5 text-xs text-zinc-400 border-none shadow-none px-0 gap-1 w-auto max-w-55 focus:ring-0"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent position="popper">
                                <SelectItem value="__unassigned__" className="text-xs text-zinc-400">Sin asignar</SelectItem>
                                {categories.map((c) => (
                                  <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <p className="text-xs text-zinc-400 mt-0.5">{mer.categoryName || 'Sin asignar'}</p>
                          )}
                        </div>

                        <span className="text-sm font-semibold text-zinc-900 shrink-0">{formatCurrency(mer.total)}</span>

                        {/* Bookmark — stop propagation so it doesn't toggle accordion */}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSaveGroupRule(mer); }}
                          disabled={savingRule === ruleKey || ruleIsSaved}
                          title={ruleIsSaved
                            ? `Regla activa: ${mer.merchant} → ${mer.categoryName}`
                            : `Guardar regla permanente para TODAS las transacciones futuras de "${mer.merchant}"`}
                          className={`text-xs shrink-0 px-2 py-1 rounded border transition-colors ${
                            ruleIsSaved
                              ? 'border-brand-600 text-brand-600 bg-brand-50 cursor-default'
                              : 'border-zinc-200 text-zinc-500 hover:border-brand-600 hover:text-brand-600'
                          }`}
                        >
                          {ruleIsSaved ? '✓ Regla activa' : 'Guardar regla'}
                        </button>
                      </div>

                      {/* Expanded transaction rows */}
                      {isExpanded && txs.length > 0 && (
                        <div className="bg-zinc-50 border-t border-zinc-100 divide-y divide-zinc-100">
                          {txs.map((tx) => {
                            const txRuleKey     = normKey(tx.merchant);
                            const txRuleIsSaved = savedRules.has(txRuleKey);
                            return (
                              <div key={tx.id ?? tx.date + tx.amount} className="px-4 py-2 pl-11">
                                {/* Top row: date · description · amount · edit */}
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-zinc-400 shrink-0 w-10">
                                    {tx.date.slice(5).replace('-', '/')}
                                  </span>
                                  <span className="text-xs text-zinc-600 flex-1 min-w-0 truncate">{tx.description}</span>
                                  <span className="text-xs font-semibold text-zinc-800 shrink-0">
                                    {formatCurrency(Math.abs(tx.amount))}
                                  </span>
                                  {tx.id && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 shrink-0 text-zinc-300 hover:text-zinc-600"
                                      onClick={() => setEditingTx(tx)}
                                      title="Editar categoría o tipo de esta transacción"
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                                {/* Bottom row: category badge · save rule */}
                                <div className="flex items-center gap-2 mt-0.5 ml-12">
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-500">
                                    {tx.categoryName}
                                  </span>
                                  {tx.id && (
                                    <button
                                      onClick={() => handleSaveTxRule(tx)}
                                      disabled={savingRule === txRuleKey || txRuleIsSaved}
                                      title={txRuleIsSaved
                                        ? `Regla activa: ${tx.merchant} → ${tx.categoryName}`
                                        : `Guardar regla para TODAS las futuras transacciones de "${tx.merchant}"`}
                                      className={`text-xs whitespace-nowrap ${
                                        txRuleIsSaved
                                          ? 'text-brand-600 cursor-default'
                                          : 'text-zinc-400 hover:text-brand-600'
                                      }`}
                                    >
                                      {txRuleIsSaved ? '✓ Regla activa' : 'Guardar regla'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
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
          Pega los movimientos del banco para ver el resumen del mes.
        </div>
      )}

      {/* Per-transaction edit dialog */}
      {editingTx && (
        <SnapshotTxDialog
          tx={editingTx}
          categories={categories}
          month={month}
          onSuccess={(metrics, txUpdate) => handleTxSuccess(metrics as Metrics, txUpdate)}
          onClose={() => setEditingTx(null)}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon, sub }: {
  label: string; value: string; icon: ReactNode; sub: string;
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
