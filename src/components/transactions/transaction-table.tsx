'use client';

import { useEffect, useState, useRef } from 'react';
import { Pencil, Trash2, Plus, ChevronLeft, ChevronRight, Download, Tags, PenLine, ShieldCheck, CheckCheck, Check, X, BookMarked, MoreHorizontal, Loader2, ArrowLeftRight, ArrowUpDown, ArrowUp, ArrowDown, Zap } from 'lucide-react';
import Link from 'next/link';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu';
import { DateRangeFilter } from '@/src/components/ui/date-range-filter';
import { formatCurrency, formatDate } from '@/src/lib/utils';
import { Skeleton } from '@/src/components/ui/skeleton';
import { TransactionForm } from './transaction-form';
import type { TransactionResponseDTO } from '@/src/application/dtos/transaction.dto';
import type { CategoryResponseDTO } from '@/src/application/dtos/category.dto';
import type { PaginatedTransactionsDTO, TransactionSummaryDTO } from '@/src/application/use-cases/transactions/list-transactions.use-case';

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
          {loading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
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
          {loading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          {loading ? 'Aplicando...' : `Aplicar a ${count} transacción${count !== 1 ? 'es' : ''}`}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function BulkTypeDialog({
  count,
  onApply,
  onClose,
}: {
  count: number;
  onApply: (transactionType: string) => Promise<void>;
  onClose: () => void;
}) {
  const [txType, setTxType] = useState('');
  const [loading, setLoading] = useState(false);

  const handleApply = async () => {
    if (!txType) return;
    setLoading(true);
    await onApply(txType);
    setLoading(false);
  };

  return (
    <DialogContent className="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>Cambiar tipo de transacción</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <p className="text-sm text-zinc-500">
          Se aplicará a <span className="font-semibold text-zinc-900">{count}</span> transacción{count !== 1 ? 'es' : ''} seleccionada{count !== 1 ? 's' : ''}.
        </p>
        <Select value={txType} onValueChange={setTxType}>
          <SelectTrigger>
            <SelectValue placeholder="Selecciona un tipo..." />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="expense">Gasto</SelectItem>
            <SelectItem value="income">Ingreso</SelectItem>
            <SelectItem value="transfer">Transferencia interna</SelectItem>
          </SelectContent>
        </Select>
        {txType === 'transfer' && (
          <p className="text-xs text-zinc-400">
            Las transferencias internas no suman al total de gastos ni ingresos — útil para pagos de tarjeta o traspasos entre cuentas propias.
          </p>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button onClick={handleApply} disabled={!txType || loading}>
          {loading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
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
  const [search, setSearch] = useState('');
  const [selectedBank, setSelectedBank] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [selectedInstallment, setSelectedInstallment] = useState('all');
  const [selectedReview, setSelectedReview] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionResponseDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TransactionResponseDTO | null>(null);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState<TransactionSummaryDTO | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Bulk selection ──────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDialog, setBulkDialog] = useState<'category' | 'merchant' | 'type' | null>(null);
  const [bulkApplying, setBulkApplying] = useState(false);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  // ── Confirm-all pending dialog ──────────────────────────
  const [confirmAllOpen, setConfirmAllOpen] = useState(false);
  const [confirmAllLoading, setConfirmAllLoading] = useState(false);

  // ── Bulk delete dialog ───────────────────────────────────
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Debounce search — avoids firing a request on every keystroke
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Refresh counter — incremented after mutations to force a reload
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch categories once on mount
  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []));
  }, []);

  // Load transactions — cancels stale in-flight request when deps change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSummary(null);

    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (selectedBank !== 'all') params.set('bank', selectedBank);
    if (dateFrom) params.set('from', `${dateFrom}T00:00:00.000Z`);
    if (dateTo)   params.set('to',   `${dateTo}T23:59:59.999Z`);
    if (selectedCategoryId !== 'all') params.set('categoryId', selectedCategoryId);
    if (selectedInstallment === 'multi') { params.set('isInstallment', 'true'); params.set('minInstallmentTotal', '2'); }
    else if (selectedInstallment === 'single') { params.set('isInstallment', 'true'); params.set('maxInstallmentTotal', '1'); }
    else if (selectedInstallment === 'false') params.set('isInstallment', 'false');
    if (selectedReview !== 'all') params.set('reviewStatus', selectedReview);
    if (selectedType !== 'all') params.set('transactionType', selectedType);
    params.set('sortBy', sortBy);
    params.set('sortDir', sortDir);
    params.set('page', String(page));

    fetch(`/api/transactions?${params.toString()}`)
      .then((r) => r.json())
      .then((data: PaginatedTransactionsDTO) => {
        if (cancelled) return;
        setTransactions(Array.isArray(data.data) ? data.data : []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
        setSummary(data.summary ?? null);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [debouncedSearch, selectedBank, dateFrom, dateTo, selectedCategoryId, selectedInstallment, selectedReview, selectedType, sortBy, sortDir, page, refreshKey]);

  // Reset page when non-page filters change
  useEffect(() => { setPage(1); }, [debouncedSearch, selectedBank, dateFrom, dateTo, selectedCategoryId, selectedInstallment, selectedReview, selectedType, sortBy, sortDir]);

  // Clear selection when filters or page change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [debouncedSearch, selectedBank, dateFrom, dateTo, selectedCategoryId, selectedInstallment, selectedReview, selectedType, page]);

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

  const getBankLabel = (bank?: string | null) => {
    if (!bank) return null;
    return BANK_LABELS[bank] ?? bank;
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
    setDeleteTarget(null);
    setRefreshKey((k) => k + 1);
  };

  const toggleSort = (col: 'date' | 'amount') => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
    setPage(1);
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

  const applyBulk = async (update: { categoryId?: string; merchant?: string; reviewStatus?: string; transactionType?: string }) => {
    setBulkApplying(true);
    await fetch('/api/transactions/bulk', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [...selectedIds], update }),
    });
    setBulkApplying(false);
    clearSelection();
    setBulkDialog(null);
    setRefreshKey((k) => k + 1);
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    await fetch('/api/transactions/bulk', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [...selectedIds] }),
    });
    setBulkDeleting(false);
    setBulkDeleteOpen(false);
    clearSelection();
    setRefreshKey((k) => k + 1);
  };

  const handleConfirmAll = async () => {
    setConfirmAllLoading(true);
    await fetch('/api/transactions/confirm-all', { method: 'PATCH' });
    setConfirmAllLoading(false);
    setConfirmAllOpen(false);
    setRefreshKey((k) => k + 1);
  };

  const exportParams = new URLSearchParams({
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(selectedBank && selectedBank !== 'all' ? { bank: selectedBank } : {}),
    ...(selectedCategoryId && selectedCategoryId !== 'all' ? { categoryId: selectedCategoryId } : {}),
    ...(dateFrom ? { from: `${dateFrom}T00:00:00.000Z` } : {}),
    ...(dateTo   ? { to:   `${dateTo}T23:59:59.999Z`   } : {}),
  });

  const hasSelection = selectedIds.size > 0;

  return (
    <div className="space-y-4">
      {/* ── Filters row ──
          Mobile  (< md): 2-column grid, search spans full width at bottom
          Desktop (≥ md): single flex row as before                       */}
      <div className="grid grid-cols-2 md:flex md:flex-wrap items-center gap-2">
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="w-full md:w-40">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            <SelectItem value="expense">Solo gastos</SelectItem>
            <SelectItem value="income">Solo ingresos</SelectItem>
            <SelectItem value="transfer">Transferencias internas</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedBank} onValueChange={setSelectedBank}>
          <SelectTrigger className="w-full md:w-40">
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

        <DateRangeFilter
          from={dateFrom}
          to={dateTo}
          onChange={(f, t) => { setDateFrom(f); setDateTo(t); }}
          className="w-full md:w-52"
        />

        <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
          <SelectTrigger className="w-full md:w-44">
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
          <SelectTrigger className="w-full md:w-36">
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
          <SelectTrigger className="w-full md:w-40">
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

        {/* Search spans both columns on mobile, grows in flex on desktop */}
        <Input
          placeholder="Buscar comercio o descripción..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="col-span-2 w-full md:flex-1 md:min-w-[160px]"
        />
      </div>

      {/* ── Action buttons row ── */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" asChild title="Gestionar reglas de categorización">
          <Link href="/rules">
            <BookMarked className="h-4 w-4" />
            <span className="hidden sm:inline">Reglas</span>
          </Link>
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
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-brand-50 border border-brand-200 rounded-lg text-sm">
          <span className="font-semibold text-brand-700 shrink-0">
            {selectedIds.size} seleccionada{selectedIds.size !== 1 ? 's' : ''}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="border-brand-300 text-brand-700 hover:bg-brand-100"
            disabled={bulkApplying}
            onClick={() => setBulkDialog('category')}
          >
            <Tags className="h-3.5 w-3.5 mr-1.5" />
            Categoría
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-brand-300 text-brand-700 hover:bg-brand-100"
            disabled={bulkApplying}
            onClick={() => setBulkDialog('merchant')}
          >
            <PenLine className="h-3.5 w-3.5 mr-1.5" />
            Comercio
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-brand-300 text-brand-700 hover:bg-brand-100"
            disabled={bulkApplying}
            onClick={() => setBulkDialog('type')}
          >
            <ArrowLeftRight className="h-3.5 w-3.5 mr-1.5" />
            Tipo
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-brand-300 text-brand-700 hover:bg-brand-100"
            disabled={bulkApplying}
            onClick={() => applyBulk({ reviewStatus: 'confirmed' })}
          >
            {bulkApplying
              ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              : <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
            }
            {bulkApplying ? 'Aplicando...' : 'Verificar'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-red-200 text-red-600 hover:bg-red-50 ml-auto"
            disabled={bulkApplying}
            onClick={() => setBulkDeleteOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Eliminar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-zinc-500 hover:text-zinc-700"
            disabled={bulkApplying}
            onClick={clearSelection}
          >
            Cancelar
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

      <Dialog open={bulkDialog === 'type'} onOpenChange={(v) => { if (!v) setBulkDialog(null); }}>
        <BulkTypeDialog
          count={selectedIds.size}
          onApply={(transactionType) => applyBulk({ transactionType })}
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

      {/* Bulk delete confirmation */}
      <Dialog open={bulkDeleteOpen} onOpenChange={(v) => { if (!v) setBulkDeleteOpen(false); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-4 w-4" />
              Eliminar transacciones
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600 py-2">
            ¿Estás seguro que deseas eliminar{' '}
            <span className="font-semibold text-zinc-900">{selectedIds.size}</span>{' '}
            transacción{selectedIds.size !== 1 ? 'es' : ''}? Esta acción no se puede deshacer.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)} disabled={bulkDeleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {bulkDeleting ? 'Eliminando...' : `Eliminar ${selectedIds.size}`}
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
          bank={editing?.bank || undefined}
          onSuccess={(updated) => {
            setOpen(false);
            if (updated) {
              setTransactions((prev) => prev.map((t) => t.id === updated.id ? updated : t));
            } else {
              setRefreshKey((k) => k + 1);
            }
          }}
          onCancel={() => setOpen(false)}
        />
      </Dialog>

      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* Gastos */}
        <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
          <p className="text-xs text-zinc-400 mb-1">Gastos</p>
          {loading || !summary
            ? <Skeleton className="h-5 w-28" />
            : <p className="text-base font-semibold text-red-600">
                -{formatCurrency(Math.abs(summary.expenses))}
              </p>
          }
        </div>
        {/* Ingresos */}
        <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
          <p className="text-xs text-zinc-400 mb-1">Ingresos</p>
          {loading || !summary
            ? <Skeleton className="h-5 w-28" />
            : <p className="text-base font-semibold text-emerald-600">
                +{formatCurrency(summary.income)}
              </p>
          }
        </div>
        {/* Neto */}
        <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
          <p className="text-xs text-zinc-400 mb-1">Neto</p>
          {loading || !summary
            ? <Skeleton className="h-5 w-28" />
            : (() => {
                const net = summary.income + summary.expenses; // expenses is negative
                return (
                  <p className={`text-base font-semibold ${net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {net >= 0 ? '+' : ''}{formatCurrency(net)}
                  </p>
                );
              })()
          }
        </div>
        {/* Transacciones */}
        <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
          <p className="text-xs text-zinc-400 mb-1">Transacciones</p>
          {loading || !summary
            ? <Skeleton className="h-5 w-16" />
            : <p className="text-base font-semibold text-zinc-700">
                {summary.count.toLocaleString('es-CL')}
              </p>
          }
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-100 bg-zinc-50">
            <tr>
              <th className="px-3 py-3 w-10">
                <input
                  ref={headerCheckboxRef}
                  type="checkbox"
                  className="h-4 w-4 rounded accent-brand-600 cursor-pointer"
                  onChange={toggleAll}
                  aria-label="Seleccionar todas las transacciones de esta página"
                />
              </th>
              <th className="px-2 py-3 w-6" title="Estado de revisión" />
              {/* Fecha — sortable, hidden below sm */}
              <th className="hidden sm:table-cell px-4 py-3 text-left font-medium text-zinc-500">
                <button
                  onClick={() => toggleSort('date')}
                  className="inline-flex items-center gap-1 hover:text-zinc-800 transition-colors"
                >
                  Fecha
                  {sortBy === 'date'
                    ? sortDir === 'desc'
                      ? <ArrowDown className="h-3.5 w-3.5 text-brand-600" />
                      : <ArrowUp className="h-3.5 w-3.5 text-brand-600" />
                    : <ArrowUpDown className="h-3.5 w-3.5 text-zinc-300" />
                  }
                </button>
              </th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Comercio</th>
              {/* Categoría, Cuenta, Cuotas — hidden below md */}
              <th className="hidden md:table-cell px-4 py-3 text-left font-medium text-zinc-500">Categoría</th>
              <th className="hidden md:table-cell px-4 py-3 text-left font-medium text-zinc-500">Cuenta</th>
              <th className="hidden md:table-cell px-4 py-3 text-left font-medium text-zinc-500">Cuotas</th>
              {/* Monto — sortable */}
              <th className="px-4 py-3 text-right font-medium text-zinc-500">
                <button
                  onClick={() => toggleSort('amount')}
                  className="inline-flex items-center gap-1 ml-auto hover:text-zinc-800 transition-colors"
                >
                  {sortBy === 'amount'
                    ? sortDir === 'desc'
                      ? <ArrowDown className="h-3.5 w-3.5 text-brand-600" />
                      : <ArrowUp className="h-3.5 w-3.5 text-brand-600" />
                    : <ArrowUpDown className="h-3.5 w-3.5 text-zinc-300" />
                  }
                  Monto
                </button>
              </th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={`skeleton-${i}`} className="border-b border-zinc-50">
                <td className="px-3 py-3"><Skeleton className="h-4 w-4" /></td>
                <td className="px-2 py-3"><Skeleton className="h-2.5 w-2.5 rounded-full" /></td>
                <td className="hidden sm:table-cell px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-36" /><Skeleton className="h-3 w-24 mt-1" /></td>
                <td className="hidden md:table-cell px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                <td className="hidden md:table-cell px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                <td className="hidden md:table-cell px-4 py-3"><Skeleton className="h-4 w-12" /></td>
                <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                <td className="px-3 py-3"><Skeleton className="h-4 w-10 ml-auto" /></td>
              </tr>
            ))}
            {!loading && transactions.map((t) => {
              const bankLabel = getBankLabel(t.bank);
              const isSelected = selectedIds.has(t.id);
              return (
                <tr
                  key={t.id}
                  className={`border-b border-zinc-50 cursor-pointer transition-colors ${isSelected ? 'bg-brand-50 hover:bg-brand-100' : 'hover:bg-zinc-50'}`}
                  onClick={() => toggleRow(t.id)}
                >
                  {/* Checkbox */}
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded accent-brand-600 cursor-pointer"
                      checked={isSelected}
                      onChange={() => toggleRow(t.id)}
                      aria-label={`Seleccionar ${t.merchant}`}
                    />
                  </td>
                  {/* Review dot */}
                  <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center">
                      <ReviewDot
                        status={t.reviewStatus as ReviewStatus}
                        onClick={t.reviewStatus === 'pending' ? () => confirmTransaction(t.id) : undefined}
                      />
                    </div>
                  </td>
                  {/* Fecha — hidden below sm */}
                  <td className="hidden sm:table-cell px-4 py-3 text-zinc-500 whitespace-nowrap">
                    {formatDate(t.date)}
                  </td>
                  {/* Comercio — always visible; packs hidden-column info below md */}
                  <td className="px-4 py-3 min-w-0 max-w-[180px] sm:max-w-xs md:max-w-none">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-medium text-zinc-900 truncate">{t.merchant}</p>
                      {t.reviewStatus === 'auto' && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-200 shrink-0">
                          <Zap className="h-2.5 w-2.5" />
                          Regla
                        </span>
                      )}
                    </div>
                    {t.description && (
                      <p className="text-xs text-zinc-400 truncate">{t.description}</p>
                    )}
                    {/* Sub-info — shown when columns are hidden (< md) */}
                    <div className="md:hidden mt-1 space-y-0.5">
                      {/* Date on its own line — only when date column is hidden (< sm) */}
                      <p className="sm:hidden text-xs text-zinc-400 leading-none">
                        {formatDate(t.date)}
                      </p>
                      {/* Badges always on their own consistent line */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="secondary" className="text-xs py-0 px-1.5 font-normal">
                          {getCategoryName(t.categoryId)}
                        </Badge>
                        {t.isInstallment && t.installmentNum != null && t.installmentTotal != null && (
                          <Badge variant="outline" className="text-xs py-0 px-1.5 font-normal">
                            {t.installmentNum}/{t.installmentTotal}
                          </Badge>
                        )}
                        {bankLabel && (
                          <span className="text-xs text-zinc-400 inline-flex items-center gap-1">
                            {bankLabel}
                            {t.accountType === 'credit_card' && (
                              <span className="text-[10px] font-semibold px-1 py-0.5 rounded bg-violet-100 text-violet-700">TC</span>
                            )}
                            {t.accountType === 'checking' && (
                              <span className="text-[10px] font-semibold px-1 py-0.5 rounded bg-sky-100 text-sky-700">CC</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  {/* Categoría — hidden below md */}
                  <td className="hidden md:table-cell px-4 py-3">
                    <Badge variant="secondary">{getCategoryName(t.categoryId)}</Badge>
                  </td>
                  {/* Cuenta — hidden below md */}
                  <td className="hidden md:table-cell px-4 py-3 whitespace-nowrap">
                    {bankLabel
                      ? <div className="flex items-center gap-1.5">
                          <span className="text-sm text-zinc-500">{bankLabel}</span>
                          {t.accountType === 'credit_card' && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">TC</span>
                          )}
                          {t.accountType === 'checking' && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-100 text-sky-700">CC</span>
                          )}
                        </div>
                      : <span className="text-zinc-300">—</span>
                    }
                  </td>
                  {/* Cuotas — hidden below md */}
                  <td className="hidden md:table-cell px-4 py-3">
                    {t.isInstallment && t.installmentNum != null && t.installmentTotal != null ? (
                      <Badge variant="outline" className="text-xs font-normal">
                        {t.installmentNum}/{t.installmentTotal}
                      </Badge>
                    ) : (
                      <span className="text-zinc-300">—</span>
                    )}
                  </td>
                  {/* Monto */}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {t.transactionType === 'income' && (
                      <span className="inline-block mr-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 align-middle">
                        Ingreso
                      </span>
                    )}
                    {t.transactionType === 'transfer' && (
                      <span className="inline-block mr-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-500 align-middle">
                        <span className="hidden sm:inline">Transf. interna</span>
                        <span className="sm:hidden">T.I.</span>
                      </span>
                    )}
                    <span className={`font-semibold ${
                      t.transactionType === 'transfer'
                        ? 'text-zinc-400'
                        : t.amount < 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {t.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(t.amount))}
                    </span>
                  </td>
                  {/* Actions */}
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    {/* Desktop: two icon buttons */}
                    <div className="hidden sm:flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteTarget(t)}>
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                    {/* Mobile: single ⋯ dropdown */}
                    <div className="sm:hidden flex items-center justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(t)}>
                            <Pencil className="h-3.5 w-3.5 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={() => setDeleteTarget(t)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
