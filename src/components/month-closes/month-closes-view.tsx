'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Loader2, CalendarCheck, Trash2, ChevronRight,
  CheckCircle2, XCircle, Plus, TrendingUp, TrendingDown, Minus, FileText,
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/src/components/ui/dialog';
import { MonthPicker } from '@/src/components/ui/month-picker';
import { Skeleton } from '@/src/components/ui/skeleton';
import { formatCurrency } from '@/src/lib/utils';
import type { MonthClose, CategorySummary } from '@/src/domain/entities/month-close';

const MONTH_NAMES: Record<string, string> = {
  '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
  '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
  '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre',
};

function formatMonth(month: string) {
  const [y, m] = month.split('-');
  return `${MONTH_NAMES[m] ?? m} ${y}`;
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function prevMonthStr(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────
// Simple inline markdown renderer (handles **bold** and line breaks)
// ─────────────────────────────────────────────────────────
function MarkdownText({ text }: { text: string }) {
  return (
    <div className="space-y-1.5">
      {text.split('\n').filter(Boolean).map((line, i) => {
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i} className="text-sm text-zinc-700 leading-relaxed">
            {parts.map((part, j) =>
              part.startsWith('**') && part.endsWith('**')
                ? <strong key={j} className="font-semibold text-zinc-900">{part.slice(2, -2)}</strong>
                : <span key={j}>{part}</span>
            )}
          </p>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Detail dialog
// ─────────────────────────────────────────────────────────
function MonthCloseDetail({
  mc,
  previousClose,
  onClose,
  onDeleted,
}: {
  mc: MonthClose;
  previousClose: MonthClose | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [notes, setNotes] = useState(mc.notes ?? '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const pct = mc.totalBudget > 0 ? Math.round((mc.totalSpent / mc.totalBudget) * 100) : 0;
  const overCategories = mc.summary.filter((s: CategorySummary) => s.isOverBudget);
  const underCategories = mc.summary.filter((s: CategorySummary) => !s.isOverBudget);
  const diff = mc.totalBudget - mc.totalSpent;
  const isOver = mc.totalSpent > mc.totalBudget;

  // Comparison with previous close
  const hasPrev = previousClose !== null;
  const spentChange = hasPrev && previousClose!.totalSpent > 0
    ? ((mc.totalSpent - previousClose!.totalSpent) / previousClose!.totalSpent) * 100
    : null;

  // Category changes vs previous close
  const categoryChanges = hasPrev
    ? mc.summary.map((s) => {
        const prev = previousClose!.summary.find((p) => p.categoryId === s.categoryId);
        if (!prev || prev.spent === 0) return null;
        const change = ((s.spent - prev.spent) / prev.spent) * 100;
        return { categoryName: s.categoryName, spent: s.spent, prevSpent: prev.spent, change };
      }).filter((c): c is NonNullable<typeof c> => c !== null)
        .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
        .slice(0, 4)
    : [];

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    await fetch(`/api/month-closes/${mc.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: notes || null }),
    });
    setSavingNotes(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    await fetch(`/api/month-closes/${mc.id}`, { method: 'DELETE' });
    setDeleting(false);
    onDeleted();
  };

  return (
    <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-brand-600" />
          Cierre de {formatMonth(mc.month)}
        </DialogTitle>
      </DialogHeader>

      {/* Key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500 mb-0.5">Total gastado</p>
          <p className="font-bold text-zinc-900 text-sm">{formatCurrency(mc.totalSpent)}</p>
        </div>
        <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500 mb-0.5">Presupuesto</p>
          <p className="font-bold text-zinc-900 text-sm">{formatCurrency(mc.totalBudget)}</p>
        </div>
        <div className={`rounded-lg border p-3 ${isOver ? 'border-red-100 bg-red-50' : 'border-emerald-100 bg-emerald-50'}`}>
          <p className="text-xs text-zinc-500 mb-0.5">{isOver ? 'Excedido en' : 'Ahorrado'}</p>
          <p className={`font-bold text-sm ${isOver ? 'text-red-600' : 'text-emerald-600'}`}>
            {formatCurrency(Math.abs(diff))}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500 mb-0.5">% del presupuesto</p>
          <p className={`font-bold text-sm ${pct > 100 ? 'text-red-600' : 'text-zinc-900'}`}>{pct}%</p>
        </div>
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap gap-2">
        {overCategories.length > 0 && (
          <Badge className="bg-red-100 text-red-700 border-red-200">
            <XCircle className="h-3 w-3 mr-1" />
            {overCategories.length} categoría{overCategories.length > 1 ? 's' : ''} excedida{overCategories.length > 1 ? 's' : ''}
          </Badge>
        )}
        {underCategories.length > 0 && (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {underCategories.length} dentro del presupuesto
          </Badge>
        )}
      </div>

      {/* Comparison with previous close */}
      {hasPrev && (
        <div>
          <p className="text-sm font-semibold text-zinc-700 mb-2">
            Vs. {formatMonth(previousClose!.month)} (cierre anterior)
          </p>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 space-y-2">
            {/* Total change */}
            {spentChange !== null && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-600 font-medium">Gasto total</span>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 text-xs">{formatCurrency(previousClose!.totalSpent)} → {formatCurrency(mc.totalSpent)}</span>
                  <span className={`flex items-center gap-0.5 font-semibold text-xs px-1.5 py-0.5 rounded-full ${
                    spentChange > 0 ? 'bg-red-100 text-red-700' : spentChange < 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-600'
                  }`}>
                    {spentChange > 0 ? <TrendingUp className="h-3 w-3" /> : spentChange < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                    {spentChange > 0 ? '+' : ''}{spentChange.toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
            {/* Category changes */}
            {categoryChanges.length > 0 && (
              <div className="pt-1 border-t border-zinc-200 space-y-1.5">
                {categoryChanges.map((c) => (
                  <div key={c.categoryName} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-600 truncate max-w-[120px]">{c.categoryName}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-zinc-400">{formatCurrency(c.prevSpent)} → {formatCurrency(c.spent)}</span>
                      <span className={`flex items-center gap-0.5 font-medium px-1 py-0.5 rounded-full ${
                        c.change > 5 ? 'bg-red-100 text-red-600' : c.change < -5 ? 'bg-emerald-100 text-emerald-600' : 'bg-zinc-100 text-zinc-500'
                      }`}>
                        {c.change > 0 ? '+' : ''}{c.change.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Category breakdown */}
      <div>
        <p className="text-sm font-semibold text-zinc-700 mb-2">Desglose por categoría</p>
        <div className="rounded-xl border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="px-3 py-2 text-left font-medium text-zinc-500 w-5"></th>
                <th className="px-3 py-2 text-left font-medium text-zinc-500">Categoría</th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">Presupuesto</th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">Gastado</th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">Diferencia</th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">Uso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {mc.summary.map((s: CategorySummary) => (
                <tr key={s.categoryId} className="hover:bg-zinc-50">
                  <td className="px-3 py-2">
                    {s.isOverBudget
                      ? <XCircle className="h-3.5 w-3.5 text-red-500" />
                      : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                  </td>
                  <td className="px-3 py-2 font-medium text-zinc-800">{s.categoryName}</td>
                  <td className="px-3 py-2 text-right text-zinc-600">{formatCurrency(s.budgeted)}</td>
                  <td className={`px-3 py-2 text-right font-medium ${s.isOverBudget ? 'text-red-600' : 'text-zinc-900'}`}>
                    {formatCurrency(s.spent)}
                  </td>
                  <td className={`px-3 py-2 text-right font-semibold ${s.isOverBudget ? 'text-red-600' : 'text-emerald-600'}`}>
                    {s.isOverBudget ? '+' : '-'}{formatCurrency(Math.abs(s.difference))}
                  </td>
                  <td className="px-3 py-2 text-right text-zinc-500">{s.percentUsed}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI suggestions */}
      <div>
        <p className="text-sm font-semibold text-zinc-700 mb-2">Sugerencias IA para el próximo mes</p>
        <div className="rounded-xl border border-brand-100 bg-brand-50 p-4">
          <MarkdownText text={mc.aiSuggestions} />
        </div>
      </div>

      {/* Notes */}
      <div>
        <p className="text-sm font-semibold text-zinc-700 mb-2">Notas personales</p>
        <textarea
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-600 resize-none"
          rows={3}
          placeholder="Agrega notas sobre este mes..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <Button size="sm" variant="outline" className="mt-2" onClick={handleSaveNotes} disabled={savingNotes}>
          {savingNotes ? 'Guardando...' : 'Guardar notas'}
        </Button>
      </div>

      <DialogFooter className="flex justify-between items-center">
        {confirmDelete ? (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <span>¿Eliminar este cierre?</span>
            <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Eliminando...' : 'Confirmar'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50"
            onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4 mr-1" /> Eliminar cierre
          </Button>
        )}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/api/month-closes/${mc.id}/report`, '_blank')}
          >
            <FileText className="h-4 w-4 mr-1.5" />
            Ver reporte PDF
          </Button>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </div>
      </DialogFooter>
    </DialogContent>
  );
}

// ─────────────────────────────────────────────────────────
// Requirement row helper
// ─────────────────────────────────────────────────────────
function Requirement({ label, status }: { label: string; status: 'loading' | 'ok' | 'fail' }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {status === 'loading' && <Loader2 className="h-4 w-4 animate-spin text-zinc-400 shrink-0" />}
      {status === 'ok'      && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
      {status === 'fail'    && <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
      <span className={status === 'fail' ? 'text-red-600' : 'text-zinc-600'}>{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Create dialog
// ─────────────────────────────────────────────────────────
interface Preflight {
  checking: boolean;
  hasTransactions: boolean | null;
  hasBudgets: boolean | null;
  alreadyClosed: boolean | null;
  transactionCount: number;
  budgetCount: number;
}

function CreateMonthCloseDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (mc: MonthClose) => void;
}) {
  const [month, setMonth] = useState(currentMonth);
  const [phase, setPhase] = useState<'select' | 'loading' | 'error'>('select');
  const [errorMsg, setErrorMsg] = useState('');
  const [preflight, setPreflight] = useState<Preflight>({
    checking: false,
    hasTransactions: null,
    hasBudgets: null,
    alreadyClosed: null,
    transactionCount: 0,
    budgetCount: 0,
  });

  // Check requirements whenever month changes
  useEffect(() => {
    if (!month) return;
    setPreflight((p) => ({ ...p, checking: true }));
    fetch(`/api/month-closes/preflight?month=${month}`)
      .then((r) => r.json())
      .then((d) => setPreflight({ checking: false, ...d }))
      .catch(() => setPreflight((p) => ({ ...p, checking: false })));
  }, [month]);

  const canClose =
    !preflight.checking &&
    preflight.hasTransactions === true &&
    preflight.hasBudgets === true &&
    preflight.alreadyClosed === false;

  const handleCreate = async () => {
    if (!canClose) return;
    setPhase('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/month-closes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? 'Error al cerrar el mes');
      }
      const mc: MonthClose = await res.json();
      onCreated(mc);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error inesperado');
      setPhase('error');
    }
  };

  return (
    <DialogContent className="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>Cerrar mes</DialogTitle>
      </DialogHeader>

      {phase === 'select' && (
        <>
          <div className="space-y-4 py-2">
            <p className="text-sm text-zinc-500">
              Selecciona el mes a cerrar. Se generará un resumen de presupuestos y sugerencias con IA.
            </p>
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-zinc-700">Mes a cerrar</p>
              <MonthPicker value={month} onChange={(v) => setMonth(v || currentMonth())} />
            </div>

            {/* Requirements checklist */}
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 space-y-2">
              <p className="text-xs font-medium text-zinc-500 mb-1">Requisitos</p>
              <Requirement
                label={
                  preflight.checking ? 'Verificando transacciones…'
                  : preflight.hasTransactions
                    ? `${preflight.transactionCount} transacciones en el mes`
                    : 'Sin transacciones en este mes'
                }
                status={preflight.checking ? 'loading' : preflight.hasTransactions ? 'ok' : 'fail'}
              />
              <Requirement
                label={
                  preflight.checking ? 'Verificando presupuestos…'
                  : preflight.hasBudgets
                    ? `${preflight.budgetCount} presupuesto${preflight.budgetCount !== 1 ? 's' : ''} definido${preflight.budgetCount !== 1 ? 's' : ''}`
                    : 'No hay presupuestos para este mes'
                }
                status={preflight.checking ? 'loading' : preflight.hasBudgets ? 'ok' : 'fail'}
              />
              <Requirement
                label={
                  preflight.checking ? 'Verificando cierre previo…'
                  : preflight.alreadyClosed === false
                    ? 'Mes sin cerrar'
                    : 'Este mes ya fue cerrado'
                }
                status={preflight.checking ? 'loading' : preflight.alreadyClosed === false ? 'ok' : 'fail'}
              />
              {!preflight.checking && preflight.hasBudgets === false && (
                <p className="text-xs text-zinc-400 pt-1">
                  Ve a <Link href="/budgets" className="font-medium text-brand-600 hover:underline">Presupuestos</Link> y define metas para este mes primero.
                </p>
              )}
            </div>

            <p className="text-xs text-zinc-400">
              ✦ La IA analizará el mes y generará sugerencias. Puede tardar unos segundos.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!canClose}>
              Cerrar mes
            </Button>
          </DialogFooter>
        </>
      )}

      {phase === 'loading' && (
        <>
          <div className="flex flex-col items-center gap-3 py-10 text-zinc-500">
            <Loader2 className="h-7 w-7 animate-spin text-brand-600" />
            <p className="text-sm text-center">
              Generando resumen y sugerencias con IA…<br />
              <span className="text-xs text-zinc-400">Esto puede tardar unos segundos</span>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
          </DialogFooter>
        </>
      )}

      {phase === 'error' && (
        <div className="space-y-4 py-2">
          <p className="text-sm text-red-600">{errorMsg}</p>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => setPhase('select')}>Reintentar</Button>
          </DialogFooter>
        </div>
      )}
    </DialogContent>
  );
}

// ─────────────────────────────────────────────────────────
// Main view
// ─────────────────────────────────────────────────────────
export function MonthClosesView() {
  const [closes, setCloses] = useState<MonthClose[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<MonthClose | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/month-closes');
    if (res.ok) setCloses(await res.json());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreated = (mc: MonthClose) => {
    setCloses((prev) => [mc, ...prev]);
    setCreateOpen(false);
    setSelected(mc);
  };

  const handleDeleted = () => {
    if (selected) setCloses((prev) => prev.filter((c) => c.id !== selected.id));
    setSelected(null);
  };

  // Find the close for the calendar month before the selected one
  const previousClose = selected
    ? closes.find((c) => c.month === prevMonthStr(selected.month)) ?? null
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          Historial de meses cerrados con análisis de presupuestos y sugerencias IA.
        </p>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Cerrar mes
        </Button>
      </div>

      {/* Create dialog — conditionally rendered so state resets on each open */}
      <Dialog open={createOpen} onOpenChange={(v) => { if (!v) setCreateOpen(false); }}>
        {createOpen && (
          <CreateMonthCloseDialog
            onClose={() => setCreateOpen(false)}
            onCreated={handleCreated}
          />
        )}
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(v) => { if (!v) setSelected(null); }}>
        {selected && (
          <MonthCloseDetail
            mc={selected}
            previousClose={previousClose}
            onClose={() => setSelected(null)}
            onDeleted={handleDeleted}
          />
        )}
      </Dialog>

      {/* List */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      )}

      {!loading && closes.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <CalendarCheck className="h-10 w-10 text-zinc-300" />
            <p className="text-zinc-500 text-sm">Aún no has cerrado ningún mes.</p>
            <p className="text-zinc-400 text-xs max-w-xs">
              Cierra un mes para ver el cumplimiento de presupuestos, métricas clave
              y recibir sugerencias IA para el próximo mes.
            </p>
            <Button className="mt-2" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Cerrar primer mes
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && closes.length > 0 && (
        <div className="space-y-3">
          {closes.map((mc) => {
            const pct = mc.totalBudget > 0 ? Math.round((mc.totalSpent / mc.totalBudget) * 100) : 0;
            const isOver = mc.totalSpent > mc.totalBudget;
            const overCount = mc.summary.filter((s: CategorySummary) => s.isOverBudget).length;
            const diff = Math.abs(mc.totalBudget - mc.totalSpent);
            // Comparison badge for list cards
            const prev = closes.find((c) => c.month === prevMonthStr(mc.month));
            const listChange = prev && prev.totalSpent > 0
              ? ((mc.totalSpent - prev.totalSpent) / prev.totalSpent) * 100
              : null;

            return (
              <Card
                key={mc.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelected(mc)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CalendarCheck className="h-4 w-4 text-brand-600" />
                      {formatMonth(mc.month)}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {listChange !== null && (
                        <span className={`text-xs font-medium flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${
                          listChange > 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
                        }`}>
                          {listChange > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {listChange > 0 ? '+' : ''}{listChange.toFixed(0)}% vs anterior
                        </span>
                      )}
                      {isOver ? (
                        <Badge className="bg-red-100 text-red-700 border-red-200">
                          <XCircle className="h-3 w-3 mr-1" />
                          Excedido
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Dentro del presupuesto
                        </Badge>
                      )}
                      <ChevronRight className="h-4 w-4 text-zinc-400" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm mb-3">
                    <span className="text-zinc-500">
                      Gastado: <span className="font-semibold text-zinc-900">{formatCurrency(mc.totalSpent)}</span>
                    </span>
                    <span className="text-zinc-500">
                      Presupuesto: <span className="font-semibold text-zinc-900">{formatCurrency(mc.totalBudget)}</span>
                    </span>
                    <span className={isOver ? 'text-red-600 font-medium' : 'text-emerald-600 font-medium'}>
                      {isOver ? `+${formatCurrency(diff)} excedido` : `-${formatCurrency(diff)} ahorrado`}
                    </span>
                    {overCount > 0 && (
                      <span className="text-zinc-400 text-xs">
                        {overCount} categoría{overCount > 1 ? 's' : ''} excedida{overCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-zinc-400">
                      <span>{pct}% del presupuesto usado</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isOver ? 'bg-red-500' : pct > 80 ? 'bg-amber-400' : 'bg-brand-600'}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
