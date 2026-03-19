'use client';

import { useEffect, useState, useCallback } from 'react';
import { Pencil, Trash2, Plus, ChevronLeft, ChevronRight, Download } from 'lucide-react';
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
import { formatCurrency, formatDate } from '@/src/lib/utils';
import { TransactionForm } from './transaction-form';
import type { TransactionResponseDTO } from '@/src/application/dtos/transaction.dto';
import type { CategoryResponseDTO } from '@/src/application/dtos/category.dto';
import type { StatementResponseDTO } from '@/src/application/dtos/statement.dto';
import type { PaginatedTransactionsDTO } from '@/src/application/use-cases/transactions/list-transactions.use-case';

export function TransactionsView() {
  const [transactions, setTransactions] = useState<TransactionResponseDTO[]>([]);
  const [categories, setCategories] = useState<CategoryResponseDTO[]>([]);
  const [statements, setStatements] = useState<StatementResponseDTO[]>([]);
  const [search, setSearch] = useState('');
  const [selectedStatementId, setSelectedStatementId] = useState('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionResponseDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TransactionResponseDTO | null>(null);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (selectedStatementId && selectedStatementId !== 'all') params.set('statementId', selectedStatementId);
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
  }, [search, selectedStatementId, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, selectedStatementId]);

  useEffect(() => {
    fetch('/api/statements')
      .then((r) => r.json())
      .then((data) => setStatements(Array.isArray(data) ? data : []));
  }, []);

  const getCategoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? id;

  const handleDelete = async (id: string) => {
    await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
    setDeleteTarget(null);
    load();
  };

  const openCreate = () => { setEditing(null); setOpen(true); };
  const openEdit = (t: TransactionResponseDTO) => { setEditing(t); setOpen(true); };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedStatementId} onValueChange={setSelectedStatementId}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Todos los estados..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {statements.map((s) => {
              const [year, month] = s.month.split('-');
              return (
                <SelectItem key={s.id} value={s.id}>
                  {s.bank} — {month}-{year}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        <Input
          placeholder="Buscar por comercio o descripción..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <div className="ml-auto flex items-center gap-2">
          <a
            href={`/api/transactions/export?${new URLSearchParams({
              ...(search ? { search } : {}),
              ...(selectedStatementId && selectedStatementId !== 'all' ? { statementId: selectedStatementId } : {}),
            }).toString()}`}
            download="transacciones.csv"
          >
            <Button variant="outline" type="button">
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
          </a>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Nueva transacción
          </Button>
        </div>
      </div>

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

      <Dialog open={open} onOpenChange={setOpen}>
        <TransactionForm
          categories={categories}
          transaction={editing}
          onSuccess={() => { setOpen(false); load(); }}
          onCancel={() => setOpen(false)}
        />
      </Dialog>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="border-b border-zinc-100 bg-zinc-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Fecha</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Comercio</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Categoría</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-500">Monto</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                <td className="px-4 py-3 text-zinc-500">{formatDate(t.date)}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-zinc-900">{t.merchant}</p>
                  <p className="text-xs text-zinc-400">{t.description}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="secondary">{getCategoryName(t.categoryId)}</Badge>
                </td>
                <td className={`px-4 py-3 text-right font-semibold ${t.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {t.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(t.amount))}
                </td>
                <td className="px-4 py-3">
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
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
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
