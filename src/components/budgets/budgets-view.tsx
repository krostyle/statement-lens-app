'use client';

import { useEffect, useState } from 'react';
import { Pencil, Trash2, Plus, Tag, Sparkles } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/src/components/ui/dialog';
import { formatCurrency } from '@/src/lib/utils';
import { Skeleton } from '@/src/components/ui/skeleton';
import type { CategoryResponseDTO } from '@/src/application/dtos/category.dto';
import type { BudgetResponseDTO } from '@/src/application/use-cases/budgets/list-budgets.use-case';
import { BudgetRecommendationDialog } from './budget-recommendation-dialog';

export function BudgetsView() {
  const [categories, setCategories] = useState<CategoryResponseDTO[]>([]);
  const [budgets, setBudgets] = useState<BudgetResponseDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [recommendOpen, setRecommendOpen] = useState(false);

  // Income state
  const [monthlyIncome, setMonthlyIncome] = useState<number | null>(null);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [incomeInput, setIncomeInput] = useState('');
  const [savingIncome, setSavingIncome] = useState(false);

  const load = async () => {
    setLoading(true);
    const [catRes, budRes, incRes] = await Promise.all([
      fetch('/api/categories'),
      fetch('/api/budgets'),
      fetch('/api/user/income'),
    ]);
    if (catRes.ok) setCategories(await catRes.json());
    if (budRes.ok) setBudgets(await budRes.json());
    if (incRes.ok) {
      const { monthlyIncome: inc } = await incRes.json();
      setMonthlyIncome(inc);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const budgetMap = new Map(budgets.map((b) => [b.categoryId, b]));
  const totalBudgeted = budgets.reduce((sum, b) => sum + b.monthlyAmount, 0);

  const formatThousands = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    return parseInt(digits, 10).toLocaleString('es-CL');
  };

  const openDialog = (categoryId: string) => {
    const existing = budgetMap.get(categoryId);
    setEditingCategoryId(categoryId);
    setAmount(existing ? formatThousands(String(existing.monthlyAmount)) : '');
    setError('');
    setOpen(true);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(formatThousands(e.target.value));
  };

  const handleSave = async () => {
    if (!editingCategoryId) return;
    const parsed = parseInt(amount.replace(/\./g, ''), 10);
    if (isNaN(parsed) || parsed <= 0) {
      setError('Ingresa un monto válido mayor a 0.');
      return;
    }
    setSaving(true);
    setError('');
    const res = await fetch(`/api/budgets/${editingCategoryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthlyAmount: parsed }),
    });
    setSaving(false);
    if (res.ok) {
      const updated = await res.json();
      setBudgets((prev) => {
        const exists = prev.some((b) => b.categoryId === editingCategoryId);
        return exists
          ? prev.map((b) => b.categoryId === editingCategoryId ? { ...b, monthlyAmount: updated.monthlyAmount } : b)
          : [...prev, updated];
      });
      setOpen(false);
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j?.error ?? 'Error al guardar.');
    }
  };

  const handleDelete = async (categoryId: string) => {
    const res = await fetch(`/api/budgets/${categoryId}`, { method: 'DELETE' });
    if (res.ok || res.status === 204) {
      setBudgets((prev) => prev.filter((b) => b.categoryId !== categoryId));
    }
    setDeleteTarget(null);
  };

  const openIncomeDialog = () => {
    setIncomeInput(monthlyIncome ? formatThousands(String(monthlyIncome)) : '');
    setIncomeOpen(true);
  };

  const handleSaveIncome = async () => {
    const parsed = parseInt(incomeInput.replace(/\./g, ''), 10);
    if (isNaN(parsed) || parsed <= 0) return;
    setSavingIncome(true);
    const res = await fetch('/api/user/income', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthlyIncome: parsed }),
    });
    setSavingIncome(false);
    if (res.ok) {
      const { monthlyIncome: inc } = await res.json();
      setMonthlyIncome(inc);
      setIncomeOpen(false);
    }
  };

  const editingCategoryName = editingCategoryId
    ? categories.find((c) => c.id === editingCategoryId)?.name
    : '';

  const budgetPct = monthlyIncome && monthlyIncome > 0
    ? Math.min((totalBudgeted / monthlyIncome) * 100, 100)
    : null;
  const isOverBudget = monthlyIncome ? totalBudgeted > monthlyIncome : false;

  return (
    <div className="space-y-4">
      {/* Income + AI row */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="text-sm text-zinc-500">Ingreso mensual:</div>
          {loading ? (
            <Skeleton className="h-5 w-28" />
          ) : monthlyIncome ? (
            <button
              onClick={openIncomeDialog}
              className="font-semibold text-zinc-900 hover:text-brand-600 transition-colors text-sm flex items-center gap-1"
            >
              {formatCurrency(monthlyIncome)}
              <Pencil className="h-3 w-3 text-zinc-400" />
            </button>
          ) : (
            <button
              onClick={openIncomeDialog}
              className="text-sm text-brand-600 hover:underline font-medium"
            >
              + Agregar ingreso
            </button>
          )}
        </div>
        <Button variant="outline" onClick={() => setRecommendOpen(true)}>
          <Sparkles className="h-4 w-4 mr-2" />
          Sugerir con IA
        </Button>
      </div>

      {/* Budget progress bar */}
      {monthlyIncome && totalBudgeted > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Presupuestado</span>
            <span className={isOverBudget ? 'text-red-600 font-semibold' : 'text-zinc-700 font-semibold'}>
              {formatCurrency(totalBudgeted)} / {formatCurrency(monthlyIncome)}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-zinc-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${isOverBudget ? 'bg-red-500' : budgetPct! > 80 ? 'bg-amber-400' : 'bg-brand-600'}`}
              style={{ width: `${budgetPct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-zinc-400">
            <span>
              {isOverBudget
                ? `Excedes tu ingreso por ${formatCurrency(totalBudgeted - monthlyIncome)}`
                : `Disponible para ahorro: ${formatCurrency(monthlyIncome - totalBudgeted)} (${Math.round(100 - budgetPct!)}%)`}
            </span>
            <span className="text-zinc-400">Meta: 20% ahorro</span>
          </div>
        </div>
      )}

      <BudgetRecommendationDialog
        open={recommendOpen}
        onClose={() => setRecommendOpen(false)}
        onApplied={() => { setRecommendOpen(false); load(); }}
      />

      {/* Income dialog */}
      <Dialog open={incomeOpen} onOpenChange={setIncomeOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Ingreso mensual neto</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="income-amount">Monto mensual (CLP)</Label>
              <Input
                id="income-amount"
                type="text"
                inputMode="numeric"
                placeholder="Ej. 1.200.000"
                value={incomeInput}
                onChange={(e) => setIncomeInput(formatThousands(e.target.value))}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveIncome()}
              />
            </div>
            <p className="text-xs text-zinc-400">
              Ingresa tu sueldo líquido mensual. Se usa para la regla 50/30/20 al generar sugerencias con IA.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIncomeOpen(false)} disabled={savingIncome}>
              Cancelar
            </Button>
            <Button onClick={handleSaveIncome} disabled={savingIncome}>
              {savingIncome ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar meta mensual</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600 py-2">
            ¿Estás seguro que deseas eliminar esta meta mensual? Esta acción no se puede deshacer.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteTarget && handleDelete(deleteTarget)}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {budgetMap.has(editingCategoryId ?? '')
                ? `Editar meta — ${editingCategoryName}`
                : `Agregar meta — ${editingCategoryName}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="budget-amount">Meta mensual (CLP)</Label>
              <Input
                id="budget-amount"
                type="text"
                inputMode="numeric"
                placeholder="Ej. 80.000"
                value={amount}
                onChange={handleAmountChange}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-xl border border-zinc-200 bg-white overflow-x-auto">
        <table className="w-full min-w-[400px] text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50">
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Categoría</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-500">Meta mensual</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-500">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={`skeleton-${i}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-7 w-7 rounded-md shrink-0" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                </td>
                <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-20 ml-auto" /></td>
                <td className="px-4 py-3"><Skeleton className="h-7 w-20 ml-auto" /></td>
              </tr>
            ))}
            {!loading && categories.map((c) => {
              const budget = budgetMap.get(c.id);
              return (
                <tr key={c.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-md bg-brand-50 flex items-center justify-center shrink-0">
                        <Tag className="h-3.5 w-3.5 text-brand-600" />
                      </div>
                      <span className="font-medium text-zinc-800">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {budget ? (
                      <span className="font-semibold text-zinc-900">
                        {formatCurrency(budget.monthlyAmount)}
                      </span>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {budget ? (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => openDialog(c.id)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(c.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        </>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => openDialog(c.id)}>
                          <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && categories.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-zinc-400">
                  Sin categorías. Crea categorías primero.
                </td>
              </tr>
            )}
          </tbody>
          {budgets.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-zinc-200 bg-zinc-50">
                <td className="px-4 py-3 font-semibold text-zinc-700">Total presupuestado</td>
                <td className="px-4 py-3 text-right font-bold text-zinc-900">
                  {formatCurrency(totalBudgeted)}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
