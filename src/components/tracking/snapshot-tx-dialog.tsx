'use client';

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/src/components/ui/select';
import type { SnapshotTransaction } from '@/src/domain/entities/snapshot';
import { formatCurrency } from '@/src/lib/utils';

interface SimpleCategory { id: string; name: string; }

interface SnapshotMetrics {
  totalExpenses: number;
  totalIncome: number;
  dailyAverage: number;
  projectedMonthTotal: number;
  daysElapsed: number;
  daysInMonth: number;
  byMerchant: unknown[];
  byCategory: unknown[];
}

export interface TxUpdate {
  id: string;
  categoryId: string;
  categoryName: string;
  transactionType: SnapshotTransaction['transactionType'];
}

interface Props {
  tx: SnapshotTransaction;
  categories: SimpleCategory[];
  month: string;
  onSuccess: (metrics: SnapshotMetrics, txUpdate: TxUpdate) => void;
  onClose: () => void;
}

export function SnapshotTxDialog({ tx, categories, month, onSuccess, onClose }: Props) {
  const [categoryId, setCategoryId] = useState(tx.categoryId);
  const [txType, setTxType]         = useState(tx.transactionType);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const selectedCategory = categories.find((c) => c.id === categoryId);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const categoryName = selectedCategory?.name ?? tx.categoryName;
      const res = await fetch(`/api/snapshot/${month}/tx/${tx.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId, categoryName, transactionType: txType }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Error al guardar');
      }
      const { metrics } = await res.json();
      onSuccess(metrics, { id: tx.id, categoryId, categoryName, transactionType: txType });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar transacción</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <span className="text-slate-500">Fecha</span>
            <span>{tx.date}</span>
            <span className="text-slate-500">Descripción</span>
            <span className="wrap-break-word">{tx.description}</span>
            <span className="text-slate-500">Monto</span>
            <span className={tx.amount < 0 ? 'text-red-600' : 'text-green-600'}>
              {formatCurrency(Math.abs(tx.amount))}
            </span>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Categoría</label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona categoría" />
              </SelectTrigger>
              <SelectContent>
                {[...categories].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Tipo</label>
            <Select value={txType} onValueChange={(v) => setTxType(v as typeof txType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Gasto</SelectItem>
                <SelectItem value="income">Ingreso</SelectItem>
                <SelectItem value="transfer">Transferencia</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
