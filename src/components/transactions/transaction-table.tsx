'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Pencil, Trash2, Plus, ChevronLeft, ChevronRight, Download, Tags, PenLine, Zap } from 'lucide-react';
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
  santander: 'Santander',
  falabella: 'Falabella',
  liderbci: 'LiderBCI',
};

// ─────────────────────────────────────────────────────────
// Merchant rules dialog
// ─────────────────────────────────────────────────────────

interface MerchantRuleRow {
  id: string;
  merchantPattern: string;
  categoryId: string;
}

function MerchantRulesDialog({
  categories,
  onClose,
}: {
  categories: CategoryResponseDTO[];
  onClose: () => void;
}) {
  const [rules, setRules] = useState<MerchantRuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  const loadRules = async () => {
    setLoading(true);
    const res = await fetch('/api/merchant-rules');
    const data = await res.json();
    setRules(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { loadRules(); }, []);

  const handleDelete = async (id: string) => {
    await fetch(`/api/merchant-rules/${id}`, { method: 'DELETE' });
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-brand-600" />
          Reglas de categorización automática
        </DialogTitle>
      </DialogHeader>

      <p className="text-sm text-zinc-500">
        Cuando subes un estado de cuenta, estas reglas asignan automáticamente la categoría a las transacciones que coincidan con el nombre del comercio.
      </p>

      {loading ? (
        <div className="space-y-2 py-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-4 w-40 rounded bg-zinc-100 animate-pulse" />
              <div className="h-4 w-24 rounded bg-zinc-100 animate-pulse" />
            </div>
          ))}
        </div>
      ) : rules.length === 0 ? (
        <p className="py-4 text-center text-sm text-zinc-400">
          Sin reglas configuradas. Al editar la categoría de una transacción, marca la opción de recordar para crear una regla.
        </p>
      ) : (
        <div className="rounded-lg border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-zinc-500">Comercio</th>
                <th className="px-4 py-2.5 text-left font-medium text-zinc-500">Categoría</th>
                <th className="px-4 py-2.5 w-10" />
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-b border-zinc-50 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-zinc-800 capitalize">{r.merchantPattern}</td>
                  <td className="px-4 py-2.5 text-zinc-600">{categoryMap.get(r.categoryId) ?? r.categoryId}</td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-zinc-400 hover:text-red-500 transition-colors"
                      title="Eliminar regla"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DialogFooter>
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
          <SelectContent>
            {categories.map((c) => (
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
  }, [search, selectedBank, selectedMonth, selectedCategoryId, selectedInstallment, page]);

  useEffect(() => { load(); }, [load]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [search, selectedBank, selectedMonth, selectedCategoryId, selectedInstallment]);

  // Clear selection when filters or page change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [search, selectedBank, selectedMonth, selectedCategoryId, selectedInstallment, page]);

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

  const applyBulk = async (update: { categoryId?: string; merchant?: string }) => {
    await fetch('/api/transactions/bulk', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [...selectedIds], update }),
    });
    clearSelection();
    setBulkDialog(null);
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
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedBank} onValueChange={setSelectedBank}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Todas las tarjetas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las tarjetas</SelectItem>
            <SelectItem value="santander">Santander</SelectItem>
            <SelectItem value="falabella">Falabella</SelectItem>
            <SelectItem value="liderbci">LiderBCI</SelectItem>
          </SelectContent>
        </Select>

        <MonthPicker
          value={selectedMonth}
          onChange={setSelectedMonth}
          placeholder="Todos los meses"
        />

        <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
          <SelectTrigger className="w-48">
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
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Tipo de pago" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="multi">En cuotas (2+)</SelectItem>
            <SelectItem value="single">Cuota única</SelectItem>
            <SelectItem value="false">Sin cuotas</SelectItem>
          </SelectContent>
        </Select>

        <Input
          placeholder="Buscar por comercio o descripción..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" onClick={() => setRulesOpen(true)} title="Reglas de categorización automática">
            <Zap className="h-4 w-4" /> Reglas
          </Button>
          <a href={`/api/transactions/export?${exportParams.toString()}`} download="transacciones.csv">
            <Button variant="outline" type="button">
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
          </a>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Nueva transacción
          </Button>
        </div>
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
          onApply={(categoryId) => applyBulk({ categoryId })}
          onClose={() => setBulkDialog(null)}
        />
      </Dialog>

      <Dialog open={bulkDialog === 'merchant'} onOpenChange={(v) => { if (!v) setBulkDialog(null); }}>
        <BulkMerchantDialog
          count={selectedIds.size}
          onApply={(merchant) => applyBulk({ merchant })}
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

      {/* Edit / create form */}
      <Dialog open={open} onOpenChange={setOpen}>
        <TransactionForm
          key={editing?.id ?? 'create'}
          categories={categories}
          transaction={editing}
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
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Fecha</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Comercio</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Categoría</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Tarjeta</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Cuotas</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-500">Monto</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={`skeleton-${i}`} className="border-b border-zinc-50">
                <td className="px-3 py-3"><Skeleton className="h-4 w-4" /></td>
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
                  <td className={`px-4 py-3 text-right font-semibold ${t.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {t.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(t.amount))}
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
                <td colSpan={8} className="px-4 py-8 text-center text-zinc-400">
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
