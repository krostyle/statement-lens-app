'use client';

import { useEffect, useState } from 'react';
import { Pencil, Trash2, Plus, Tag } from 'lucide-react';
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
import type { CategoryResponseDTO } from '@/src/application/dtos/category.dto';
import type { BudgetResponseDTO } from '@/src/application/use-cases/budgets/list-budgets.use-case';

export function BudgetsView() {
  const [categories, setCategories] = useState<CategoryResponseDTO[]>([]);
  const [budgets, setBudgets] = useState<BudgetResponseDTO[]>([]);
  const [open, setOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const [catRes, budRes] = await Promise.all([
      fetch('/api/categories'),
      fetch('/api/budgets'),
    ]);
    if (catRes.ok) setCategories(await catRes.json());
    if (budRes.ok) setBudgets(await budRes.json());
  };

  useEffect(() => { load(); }, []);

  const budgetMap = new Map(budgets.map((b) => [b.categoryId, b]));

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
      setOpen(false);
      load();
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j?.error ?? 'Error al guardar.');
    }
  };

  const handleDelete = async (categoryId: string) => {
    if (!confirm('¿Eliminar esta meta mensual?')) return;
    const res = await fetch(`/api/budgets/${categoryId}`, { method: 'DELETE' });
    if (res.ok || res.status === 204) load();
  };

  const editingCategoryName = editingCategoryId
    ? categories.find((c) => c.id === editingCategoryId)?.name
    : '';

  return (
    <div className="space-y-4">
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

      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50">
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Categoría</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-500">Meta mensual</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-500">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {categories.map((c) => {
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
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
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
            {categories.length === 0 && (
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
                  {formatCurrency(budgets.reduce((sum, b) => sum + b.monthlyAmount, 0))}
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
