'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Pencil, Trash2, Plus, ChevronLeft, ChevronRight, Download, Tags, PenLine, Zap, ShieldCheck, CheckCheck, Check, X } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/src/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { MonthPicker } from '@/src/components/ui/month-picker';
import { formatCurrency, formatDate } from '@/src/lib/utils';
import { Skeleton } from '@/src/components/ui/skeleton';
import { TransactionForm } from './transaction-form';
import type { TransactionResponseDTO } from '@/src/application/dtos/transaction.dto';
import type { CategoryResponseDTO } from '@/src/application/dtos/category.dto';
import type { StatementResponseDTO } from '@/src/application/dtos/statement.dto';
import type { PaginatedTransactionsDTO } from '@/src/application/use-cases/transactions/list-transactions.use-case';

const BANK_LABELS: Record<string, string> = {
  santander:   'Santander',
  falabella:   'Falabella',
  liderbci:    'LiderBCI',
  bci:         'BCI',
  bancoestado: 'BancoEstado',
};

type ReviewStatus = 'pending' | 'auto' | 'confirmed' | 'manual';

const REVIEW_CONFIG: Record<ReviewStatus, { label: string; dot: string; title: string }> = {
  pending:   { label: 'Pendiente',  dot: 'bg-amber-400',  title: 'Sin revisar — categoría sugerida por IA' },
  auto:      { label: 'Automático', dot: 'bg-blue-400',   title: 'Categoría aplicada por regla de comercio' },
  confirmed: { label: 'Confirmado', dot: 'bg-emerald-500', title: 'Revisado y confirmado manualmente' },
  manual:    { label: 'Manual',     dot: 'bg-emerald-500', title: 'Editado manualmente' },
};

function ReviewDot({ status, onClick }: { status: ReviewStatus; onClick?: () => void }) {
  const cfg = REVIEW_CONFIG[status] ?? REVIEW_CONFIG.pending;
  return (
    <button
      type="button"
      title={onClick ? `${cfg.title} — click para confirmar` : cfg.title}
      onClick={onClick}
      className={`h-2.5 w-2.5 rounded-full flex-shrink-0 transition-transform ${cfg.dot} ${onClick && status === 'pending' ? 'cursor-pointer hover:scale-125' : 'cursor-default'}`}
    />
  );
}

// ─────────────────────────────────────────────────────────
// Merchant rules dialog
// ─────────────────────────────────────────────────────────

// Radix Select forbids value="", so we use this sentinel for "any card"
const BANK_ANY = '__any__';

interface MerchantRuleRow {
  id: string;
  merchantPattern: string;
  bank: string;
  categoryId: string;
}

type RuleDraft = { merchantPattern: string; bank: string; categoryId: string };

function MerchantRulesDialog({
  categories,
  onClose,
}: {
  categories: CategoryResponseDTO[];
  onClose: () => void;
}) {
  const [rules, setRules]         = useState<MerchantRuleRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [draft, setDraft]         = useState<RuleDraft>({ merchantPattern: '', bank: '', categoryId: '' });
  const [saving, setSaving]       = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const categoryMap     = new Map(categories.map((c) => [c.id, c.name]));
  const sortedCategories = [...categories].sort((a, b) => a.name.localeCompare(b.name, 'es'));

  const loadRules = async () => {
    setLoading(true);
    const res = await fetch('/api/merchant-rules');
    const data = await res.json();
    setRules(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { loadRules(); }, []);

  const startEdit = (rule: MerchantRuleRow) => {
    setSaveError(null);
    setEditingId(rule.id);
    setDraft({ merchantPattern: rule.merchantPattern, bank: rule.bank || BANK_ANY, categoryId: rule.categoryId });
  };

  const startNew = () => {
    setSaveError(null);
    setEditingId('new');
    setDraft({ merchantPattern: '', bank: BANK_ANY, categoryId: '' });
  };

  const cancelEdit = () => { setSaveError(null); setEditingId(null); };

  const handleSave = async (originalRule?: MerchantRuleRow) => {
    if (!draft.merchantPattern.trim() || !draft.categoryId) return;
    setSaving(true);
    setSaveError(null);

    // Convert UI sentinel back to the empty string the API expects
    const bankToSave = draft.bank === BANK_ANY ? '' : draft.bank;

    // POST upsert with the new values (creates or updates by merchant+bank key)
    const res = await fetch('/api/merchant-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchant: draft.merchantPattern.trim(), bank: bankToSave, categoryId: draft.categoryId }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setSaveError(body?.error ? JSON.stringify(body.error) : 'Ya existe una regla con el mismo comercio y tarjeta.');
      setSaving(false);
      return;
    }

    // If editing and the key (merchant or bank) changed, remove the old record
    if (originalRule) {
      const oldPattern = originalRule.merchantPattern;
      const newPattern = draft.merchantPattern.trim().toLowerCase();
      if (oldPattern !== newPattern || originalRule.bank !== bankToSave) {
        await fetch(`/api/merchant-rules/${originalRule.id}`, { method: 'DELETE' });
      }
    }

    setSaving(false);
    setEditingId(null);
    loadRules();
  };

  const handleDelete = async (id: string) => {
    // Optimistic: remove instantly, restore if the request fails
    setDeletingId(id);
    const snapshot = rules;
    setRules((prev) => prev.filter((r) => r.id !== id));
    const res = await fetch(`/api/merchant-rules/${id}`, { method: 'DELETE' });
    if (!res.ok) setRules(snapshot);
    setDeletingId(null);
  };

  // Shared inline-edit row — spans all 4 columns, stacks on mobile
  const EditRow = ({ original }: { original?: MerchantRuleRow }) => (
    <tr className="border-b border-brand-100 bg-brand-50">
      <td colSpan={4} className="px-3 py-3">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
          <Input
            value={draft.merchantPattern}
            onChange={(e) => setDraft((d) => ({ ...d, merchantPattern: e.target.value }))}
            placeholder="Comercio"
            className="h-8 text-xs"
            autoFocus={!original}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(original); if (e.key === 'Escape') cancelEdit(); }}
          />
          <Select value={draft.bank} onValueChange={(v) => setDraft((d) => ({ ...d, bank: v }))}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Cualquier tarjeta" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value={BANK_ANY}>Cualquier tarjeta</SelectItem>
              {Object.entries(BANK_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={draft.categoryId} onValueChange={(v) => setDraft((d) => ({ ...d, categoryId: v }))}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Categoría..." />
            </SelectTrigger>
            <SelectContent position="popper">
              {sortedCategories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1 justify-end">
            <button
              onClick={() => handleSave(original)}
              disabled={saving || !draft.merchantPattern.trim() || !draft.categoryId}
              className="text-emerald-600 hover:text-emerald-700 disabled:opacity-40 transition-colors"
              title="Guardar"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={cancelEdit}
              className="text-zinc-400 hover:text-zinc-600 transition-colors"
              title="Cancelar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </td>
    </tr>
  );

  return (
    <DialogContent className="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-brand-600" />
          Reglas de categorización automática
        </DialogTitle>
      </DialogHeader>

      <p className="text-sm text-zinc-500">
        Al subir un estado de cuenta, estas reglas asignan la categoría automáticamente según el comercio y la tarjeta.
      </p>

      <div className="rounded-lg border border-zinc-200 overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-4 w-36 rounded bg-zinc-100 animate-pulse" />
                <div className="h-4 w-24 rounded bg-zinc-100 animate-pulse" />
                <div className="h-4 w-24 rounded bg-zinc-100 animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Fixed column headers */}
            <table className="w-full text-sm table-fixed">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-zinc-500">Comercio</th>
                  <th className="px-4 py-2.5 text-left font-medium text-zinc-500">Tarjeta</th>
                  <th className="px-4 py-2.5 text-left font-medium text-zinc-500">Categoría</th>
                  <th className="px-4 py-2.5 w-16" />
                </tr>
              </thead>
            </table>
            {/* Scrollable rows — max 45% of viewport so dialog stays compact */}
            <div className="max-h-[45vh] overflow-y-auto">
              <table className="w-full text-sm table-fixed">
                <colgroup>
                  <col /><col /><col /><col className="w-16" />
                </colgroup>
              <tbody>
              {rules.length === 0 && editingId !== 'new' && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-zinc-400">
                    Sin reglas. Crea una aquí o edita una transacción y marca «Recordar».
                  </td>
                </tr>
              )}

              {rules.map((r) =>
                editingId === r.id ? (
                  <EditRow key={r.id} original={r} />
                ) : (
                  <tr
                    key={r.id}
                    className={`border-b border-zinc-50 last:border-0 transition-all ${deletingId === r.id ? 'opacity-40 pointer-events-none' : 'hover:bg-zinc-50'}`}
                  >
                    <td className="px-4 py-2.5 font-medium text-zinc-800 capitalize">{r.merchantPattern}</td>
                    <td className="px-4 py-2.5 text-xs text-zinc-500">
                      {r.bank ? (BANK_LABELS[r.bank] ?? r.bank) : <span className="text-zinc-300">Cualquier tarjeta</span>}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-600">{categoryMap.get(r.categoryId) ?? r.categoryId}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => startEdit(r)}
                          disabled={editingId !== null || deletingId !== null}
                          className="text-zinc-400 hover:text-brand-600 disabled:opacity-30 transition-colors"
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          disabled={editingId !== null || deletingId !== null}
                          className="text-zinc-400 hover:text-red-500 disabled:opacity-30 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}

              {editingId === 'new' && <EditRow />}
            </tbody>
            </table>
            </div>
          </>
        )}
      </div>

      {saveError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {saveError}
        </p>
      )}

      <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2">
        <Button
          variant="outline"
          onClick={startNew}
          disabled={editingId !== null || loading}
          className="sm:mr-auto"
        >
          <Plus className="h-4 w-4" />
          Nueva regla
        </Button>
        <Button variant="outline" onClick={onClose}>Cerrar</Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ─────────────────────────────────────────────────────────
// Bulk dialogs
// ─────────────────────────────────────────────────────────

function BulkCategoryDialog({
  count,
  categories,
  onApply,
  onClose,
}: {
  count: number;
  categories: CategoryResponseDTO[];
  onApply: (categoryId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [categoryId, setCategoryId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleApply = async () => {
    if (!categoryId) return;
    setLoading(true);
    await onApply(categoryId);
    setLoading(false);
  };

  return (
    <DialogContent className="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>Cambiar categoría</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <p className="text-sm text-zinc-500">
          Se aplicará a <span className="font-semibold text-zinc-900">{count}</span> transacción{count !== 1 ? 'es' : ''} seleccionada{count !== 1 ? 's' : ''}.
        </p>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecciona una categoría..." />
          </SelectTrigger>
          <SelectContent position="popper">
            {[...categories].sort((a, b) => a.name.localeCompare(b.name, 'es')).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleApply} disabled={!categoryId || loading}>
          {loading ? 'Aplicando...' : `Aplicar a ${count} transacción${count !== 1 ? 'es' : ''}`}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function BulkMerchantDialog({
  count,
  onApply,
  onClose,
}: {
  count: number;
  onApply: (merchant: string) => Promise<void>;
  onClose: () => void;
}) {
  const [merchant, setMerchant] = useState('');
  const [loading, setLoading] = useState(false);

  const handleApply = async () => {
    if (!merchant.trim()) return;
    setLoading(true);
    await onApply(merchant.trim());
    setLoading(false);
  };

  return (
    <DialogContent className="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>Cambiar nombre de comercio</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <p className="text-sm text-zinc-500">
          Se aplicará a <span className="font-semibold text-zinc-900">{count}</span> transacción{count !== 1 ? 'es' : ''} seleccionada{count !== 1 ? 's' : ''}.
        </p>
        <Input
          placeholder="Nuevo nombre de comercio..."
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          maxLength={200}
          onKeyDown={(e) => { if (e.key === 'Enter') handleApply(); }}
          autoFocus
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleApply} disabled={!merchant.trim() || loading}>
          {loading ? 'Aplicando...' : `Aplicar a ${count} transacción${count !== 1 ? 'es' : ''}`}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ─────────────────────────────────────────────────────────
// Main view
// ─────────────────────────────────────────────────────────

export function TransactionsView() {
  const [transactions, setTransactions] = useState<TransactionResponseDTO[]>([]);
  const [categories, setCategories] = useState<CategoryResponseDTO[]>([]);
  const [statements, setStatements] = useState<StatementResponseDTO[]>([]);
  const [search, setSearch] = useState('');
  const [selectedBank, setSelectedBank] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [selectedInstallment, setSelectedInstallment] = useState('all');
  const [selectedReview, setSelectedReview] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionResponseDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TransactionResponseDTO | null>(null);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // ── Bulk selection ──────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDialog, setBulkDialog] = useState<'category' | 'merchant' | null>(null);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  // ── Merchant rules dialog ───────────────────────────────
  const [rulesOpen, setRulesOpen] = useState(false);

  // ── Confirm-all pending dialog ──────────────────────────
  const [confirmAllOpen, setConfirmAllOpen] = useState(false);
  const [confirmAllLoading, setConfirmAllLoading] = useState(false);

  // Map statementId → bank for display in table rows
  const statementBankMap = new Map(statements.map((s) => [s.id, s.bank]));

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (selectedBank && selectedBank !== 'all') params.set('bank', selectedBank);
    if (selectedMonth) {
      const [y, m] = selectedMonth.split('-').map(Number);
      params.set('from', new Date(Date.UTC(y, m - 1, 1)).toISOString());
      params.set('to', new Date(Date.UTC(y, m, 1) - 1).toISOString());
    }
    if (selectedCategoryId && selectedCategoryId !== 'all') params.set('categoryId', selectedCategoryId);
    if (selectedInstallment === 'multi') { params.set('isInstallment', 'true'); params.set('minInstallmentTotal', '2'); }
    else if (selectedInstallment === 'single') { params.set('isInstallment', 'true'); params.set('maxInstallmentTotal', '1'); }
    else if (selectedInstallment === 'false') params.set('isInstallment', 'false');
    if (selectedReview !== 'all') params.set('reviewStatus', selectedReview);
    if (selectedType !== 'all') params.set('transactionType', selectedType);
    params.set('page', String(page));

    const [txRes, catRes] = await Promise.all([
      fetch(`/api/transactions?${params.toString()}`),
      fetch('/api/categories'),
    ]);
    const txData: PaginatedTransactionsDTO = await txRes.json();
    const catData = await catRes.json();

    setTransactions(Array.isArray(txData.data) ? txData.data : []);
    setTotal(txData.total ?? 0);
    setTotalPages(txData.totalPages ?? 1);
    setCategories(Array.isArray(catData) ? catData : []);
    setLoading(false);
  }, [search, selectedBank, selectedMonth, selectedCategoryId, selectedInstallment, selectedReview, selectedType, page]);

  useEffect(() => { load(); }, [load]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [search, selectedBank, selectedMonth, selectedCategoryId, selectedInstallment, selectedReview, selectedType]);

  // Clear selection when filters or page change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [search, selectedBank, selectedMonth, selectedCategoryId, selectedInstallment, selectedReview, selectedType, page]);

  useEffect(() => {
    fetch('/api/statements')
      .then((r) => r.json())
      .then((data) => setStatements(Array.isArray(data) ? data : []));
  }, []);

  // Keep header checkbox in sync (checked / indeterminate)
  useEffect(() => {
    const el = headerCheckboxRef.current;
    if (!el || transactions.length === 0) return;
    const allSelected = transactions.every((t) => selectedIds.has(t.id));
    const someSelected = transactions.some((t) => selectedIds.has(t.id));
    el.checked = allSelected;
    el.indeterminate = someSelected && !allSelected;
  }, [selectedIds, transactions]);

  const getCategoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? id;

  const getBankLabel = (statementId?: string | null) => {
    if (!statementId) return null;
    const bank = statementBankMap.get(statementId);
    return bank ? (BANK_LABELS[bank] ?? bank) : null;
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
    setDeleteTarget(null);
    load();
  };

  const openCreate = () => { setEditing(null); setOpen(true); };
  const openEdit = (t: TransactionResponseDTO) => { setEditing(t); setOpen(true); };

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const allSelected = transactions.every((t) => selectedIds.has(t.id));
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        transactions.forEach((t) => next.delete(t.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        transactions.forEach((t) => next.add(t.id));
        return next;
      });
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const confirmTransaction = async (id: string) => {
    await fetch(`/api/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true }),
    });
    setTransactions((prev) =>
      prev.map((t) => t.id === id ? { ...t, reviewStatus: 'confirmed' as const } : t)
    );
  };

  const applyBulk = async (update: { categoryId?: string; merchant?: string; reviewStatus?: string }) => {
    await fetch('/api/transactions/bulk', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [...selectedIds], update }),
    });
    clearSelection();
    setBulkDialog(null);
    load();
  };

  const handleConfirmAll = async () => {
    setConfirmAllLoading(true);
    await fetch('/api/transactions/confirm-all', { method: 'PATCH' });
    setConfirmAllLoading(false);
    setConfirmAllOpen(false);
    load();
  };

  const exportParams = new URLSearchParams({
    ...(search ? { search } : {}),
    ...(selectedBank && selectedBank !== 'all' ? { bank: selectedBank } : {}),
    ...(selectedCategoryId && selectedCategoryId !== 'all' ? { categoryId: selectedCategoryId } : {}),
    ...(selectedMonth ? (() => {
      const [y, m] = selectedMonth.split('-').map(Number);
      return {
        from: new Date(Date.UTC(y, m - 1, 1)).toISOString(),
        to: new Date(Date.UTC(y, m, 1) - 1).toISOString(),
      };
    })() : {}),
  });

  const hasSelection = selectedIds.size > 0;

  return (
    <div className="space-y-4">
      {/* ── Filters row ── */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Gastos e ingresos</SelectItem>
            <SelectItem value="expense">Solo gastos</SelectItem>
            <SelectItem value="income">Solo ingresos</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedBank} onValueChange={setSelectedBank}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Todas las cuentas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las cuentas</SelectItem>
            <SelectItem value="santander">Santander</SelectItem>
            <SelectItem value="falabella">Falabella</SelectItem>
            <SelectItem value="liderbci">LiderBCI</SelectItem>
            <SelectItem value="bci">BCI</SelectItem>
            <SelectItem value="bancoestado">BancoEstado</SelectItem>
          </SelectContent>
        </Select>

        <MonthPicker
          value={selectedMonth}
          onChange={setSelectedMonth}
          placeholder="Todos los meses"
        />

        <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Todas las categorías" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedInstallment} onValueChange={setSelectedInstallment}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Tipo de pago" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="multi">En cuotas (2+)</SelectItem>
            <SelectItem value="single">Cuota única</SelectItem>
            <SelectItem value="false">Sin cuotas</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedReview} onValueChange={setSelectedReview}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Revisión" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las revisiones</SelectItem>
            <SelectItem value="pending">⚪ Sin revisar</SelectItem>
            <SelectItem value="auto">🔵 Automáticas</SelectItem>
            <SelectItem value="confirmed">✅ Confirmadas</SelectItem>
            <SelectItem value="manual">✅ Editadas</SelectItem>
          </SelectContent>
        </Select>

        <Input
          placeholder="Buscar comercio o descripción..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[160px]"
        />
      </div>

      {/* ── Action buttons row ── */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" onClick={() => setRulesOpen(true)} title="Reglas de categorización automática">
          <Zap className="h-4 w-4" />
          <span className="hidden sm:inline">Reglas</span>
        </Button>
        <Button
          variant="outline"
          onClick={() => setConfirmAllOpen(true)}
          title="Marcar todas las transacciones pendientes como verificadas"
        >
          <CheckCheck className="h-4 w-4" />
          <span className="hidden sm:inline">Verificar historial</span>
        </Button>
        <a href={`/api/transactions/export?${exportParams.toString()}`} download="transacciones.csv">
          <Button variant="outline" type="button" title="Exportar CSV">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </Button>
        </a>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nueva transacción</span>
        </Button>
      </div>

      {/* Bulk action bar */}
      {hasSelection && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-brand-50 border border-brand-200 rounded-lg text-sm">
          <span className="font-semibold text-brand-700">
            {selectedIds.size} seleccionada{selectedIds.size !== 1 ? 's' : ''}
          </span>
          <div className="h-4 w-px bg-brand-200" />
          <Button
            size="sm"
            variant="outline"
            className="border-brand-300 text-brand-700 hover:bg-brand-100"
            onClick={() => setBulkDialog('category')}
          >
            <Tags className="h-3.5 w-3.5 mr-1.5" />
            Cambiar categoría
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-brand-300 text-brand-700 hover:bg-brand-100"
            onClick={() => setBulkDialog('merchant')}
          >
            <PenLine className="h-3.5 w-3.5 mr-1.5" />
            Cambiar nombre de comercio
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-brand-300 text-brand-700 hover:bg-brand-100"
            onClick={() => applyBulk({ reviewStatus: 'confirmed' })}
          >
            <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
            Verificar seleccionadas
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto text-zinc-500 hover:text-zinc-700"
            onClick={clearSelection}
          >
            Cancelar selección
          </Button>
        </div>
      )}

      {/* Bulk dialogs */}
      <Dialog open={bulkDialog === 'category'} onOpenChange={(v) => { if (!v) setBulkDialog(null); }}>
        <BulkCategoryDialog
          count={selectedIds.size}
          categories={categories}
          onApply={(categoryId) => applyBulk({ categoryId, reviewStatus: 'confirmed' })}
          onClose={() => setBulkDialog(null)}
        />
      </Dialog>

      <Dialog open={bulkDialog === 'merchant'} onOpenChange={(v) => { if (!v) setBulkDialog(null); }}>
        <BulkMerchantDialog
          count={selectedIds.size}
          onApply={(merchant) => applyBulk({ merchant, reviewStatus: 'confirmed' })}
          onClose={() => setBulkDialog(null)}
        />
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar transacción</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600 py-2">
            ¿Estás seguro que deseas eliminar «{deleteTarget?.merchant}»? Esta acción no se puede deshacer.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteTarget && handleDelete(deleteTarget.id)}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merchant rules dialog */}
      <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
        <MerchantRulesDialog categories={categories} onClose={() => setRulesOpen(false)} />
      </Dialog>

      {/* Confirm-all pending dialog */}
      <Dialog open={confirmAllOpen} onOpenChange={(v) => { if (!v) setConfirmAllOpen(false); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCheck className="h-4 w-4 text-emerald-600" />
              Verificar historial completo
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600 py-2">
            Todas las transacciones con estado <span className="font-semibold text-amber-600">Sin revisar</span> se
            marcarán como <span className="font-semibold text-emerald-600">Confirmadas</span>.
          </p>
          <p className="text-xs text-zinc-400">
            Esto aplica a todo tu historial, sin importar los filtros activos.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAllOpen(false)} disabled={confirmAllLoading}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmAll} disabled={confirmAllLoading}>
              {confirmAllLoading ? 'Verificando...' : 'Confirmar todo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit / create form */}
      <Dialog open={open} onOpenChange={setOpen}>
        <TransactionForm
          key={editing?.id ?? 'create'}
          categories={categories}
          transaction={editing}
          bank={editing?.statementId ? statementBankMap.get(editing.statementId) : undefined}
          onSuccess={(updated) => {
            setOpen(false);
            if (updated) {
              setTransactions((prev) => prev.map((t) => t.id === updated.id ? updated : t));
            } else {
              load();
            }
          }}
          onCancel={() => setOpen(false)}
        />
      </Dialog>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="border-b border-zinc-100 bg-zinc-50">
            <tr>
              {/* Select-all checkbox */}
              <th className="px-3 py-3 w-10">
                <input
                  ref={headerCheckboxRef}
                  type="checkbox"
                  className="h-4 w-4 rounded accent-brand-600 cursor-pointer"
                  onChange={toggleAll}
                  aria-label="Seleccionar todas las transacciones de esta página"
                />
              </th>
              <th className="px-3 py-3 w-6" title="Estado de revisión" />
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Fecha</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Comercio</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Categoría</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Cuenta/Tarjeta</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Cuotas</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-500">Monto</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={`skeleton-${i}`} className="border-b border-zinc-50">
                <td className="px-3 py-3"><Skeleton className="h-4 w-4" /></td>
                <td className="px-3 py-3"><Skeleton className="h-2.5 w-2.5 rounded-full" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-10 ml-auto" /></td>
              </tr>
            ))}
            {!loading && transactions.map((t) => {
              const bankLabel = getBankLabel(t.statementId);
              const isSelected = selectedIds.has(t.id);
              return (
                <tr
                  key={t.id}
                  className={`border-b border-zinc-50 cursor-pointer transition-colors ${isSelected ? 'bg-brand-50 hover:bg-brand-100' : 'hover:bg-zinc-50'}`}
                  onClick={() => toggleRow(t.id)}
                >
                  {/* Row checkbox */}
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded accent-brand-600 cursor-pointer"
                      checked={isSelected}
                      onChange={() => toggleRow(t.id)}
                      aria-label={`Seleccionar ${t.merchant}`}
                    />
                  </td>
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center">
                      <ReviewDot
                        status={t.reviewStatus as ReviewStatus}
                        onClick={t.reviewStatus === 'pending' ? () => confirmTransaction(t.id) : undefined}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{formatDate(t.date)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-900">{t.merchant}</p>
                    <p className="text-xs text-zinc-400">{t.description}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">{getCategoryName(t.categoryId)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-500">
                    {bankLabel ?? <span className="text-zinc-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {t.isInstallment && t.installmentNum != null && t.installmentTotal != null ? (
                      <Badge variant="outline" className="text-xs font-normal">
                        {t.installmentNum}/{t.installmentTotal}
                      </Badge>
                    ) : (
                      <span className="text-zinc-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {t.transactionType === 'income' && (
                      <span className="inline-block mr-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 align-middle">Ingreso</span>
                    )}
                    <span className={`font-semibold ${t.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {t.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(t.amount))}
                    </span>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(t)}>
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && transactions.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-zinc-400">
                  Sin transacciones
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-zinc-500">
          <span>
            {total} transacciones — página {page} de {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...');
                acc.push(p);
                return acc;
              }, [])
              .map((item, i) =>
                item === '...' ? (
                  <span key={`ellipsis-${i}`} className="px-2">…</span>
                ) : (
                  <Button
                    key={item}
                    variant={item === page ? 'default' : 'outline'}
                    size="icon"
                    onClick={() => setPage(item as number)}
                  >
                    {item}
                  </Button>
                )
              )}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage((p) => p + 1)}
              disabled={page === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
