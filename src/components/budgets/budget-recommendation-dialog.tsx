'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
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
import { formatCurrency } from '@/src/lib/utils';
import type { BudgetRecommendationDTO } from '@/src/application/use-cases/budgets/recommend-budgets.use-case';

interface RowState {
  checked: boolean;
  amount: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onApplied: () => void;
}

type Phase = 'loading' | 'review' | 'applying' | 'error' | 'empty';

function trendBadge(trend: BudgetRecommendationDTO['trend'], currentBudget: number | null) {
  if (trend === 'over') return <Badge className="bg-red-100 text-red-700 border-red-200">Sobrepasando</Badge>;
  if (trend === 'under') return <Badge className="bg-green-100 text-green-700 border-green-200">{formatCurrency(currentBudget!)}</Badge>;
  return <Badge className="bg-zinc-100 text-zinc-500 border-zinc-200">Sin presupuesto</Badge>;
}

function formatThousands(raw: string) {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return parseInt(digits, 10).toLocaleString('es-CL');
}

export function BudgetRecommendationDialog({ open, onClose, onApplied }: Props) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [recommendations, setRecommendations] = useState<BudgetRecommendationDTO[]>([]);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [errorMsg, setErrorMsg] = useState('');

  const fetchRecommendations = async () => {
    setPhase('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/budgets/recommend', { method: 'POST' });
      if (!res.ok) throw new Error('Error al obtener recomendaciones');
      const data: BudgetRecommendationDTO[] = await res.json();
      if (data.length === 0) {
        setPhase('empty');
        return;
      }
      setRecommendations(data);
      const initialRows: Record<string, RowState> = {};
      for (const item of data) {
        initialRows[item.categoryId] = {
          checked: true,
          amount: formatThousands(String(item.recommendedAmount)),
        };
      }
      setRows(initialRows);
      setPhase('review');
    } catch {
      setErrorMsg('No se pudieron cargar las recomendaciones. Intenta de nuevo.');
      setPhase('error');
    }
  };

  useEffect(() => {
    if (open) fetchRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggleRow = (categoryId: string) => {
    setRows((prev) => ({
      ...prev,
      [categoryId]: { ...prev[categoryId], checked: !prev[categoryId].checked },
    }));
  };

  const updateAmount = (categoryId: string, value: string) => {
    setRows((prev) => ({
      ...prev,
      [categoryId]: { ...prev[categoryId], amount: formatThousands(value) },
    }));
  };

  const selectedRows = Object.entries(rows).filter(([, r]) => r.checked);

  const handleApply = async () => {
    if (selectedRows.length === 0) return;
    setPhase('applying');
    try {
      const budgets = selectedRows.map(([categoryId, r]) => ({
        categoryId,
        monthlyAmount: parseInt(r.amount.replace(/\./g, ''), 10),
      }));
      const res = await fetch('/api/budgets/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budgets }),
      });
      if (!res.ok) throw new Error('Error al aplicar presupuestos');
      onApplied();
    } catch {
      setErrorMsg('Error al guardar los presupuestos. Intenta de nuevo.');
      setPhase('error');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sugerencias de presupuesto con IA</DialogTitle>
        </DialogHeader>

        {phase === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-12 text-zinc-500">
            <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
            <span className="text-sm">Analizando tus gastos con IA...</span>
          </div>
        )}

        {phase === 'applying' && (
          <div className="flex flex-col items-center gap-3 py-12 text-zinc-500">
            <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
            <span className="text-sm">Guardando presupuestos...</span>
          </div>
        )}

        {phase === 'error' && (
          <div className="py-8 text-center space-y-4">
            <p className="text-sm text-destructive">{errorMsg}</p>
            <Button variant="outline" onClick={fetchRecommendations}>Reintentar</Button>
          </div>
        )}

        {phase === 'empty' && (
          <div className="py-8 text-center text-sm text-zinc-500">
            Sin datos suficientes para generar recomendaciones. Registra gastos de al menos un mes primero.
          </div>
        )}

        {phase === 'review' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="px-3 py-2 text-left font-medium text-zinc-500 w-8"></th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-500">Categoría</th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-500">Gasto prom.</th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-500">Presupuesto actual</th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-500">Recomendado</th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-500">Razón</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {recommendations.map((item) => {
                  const row = rows[item.categoryId];
                  return (
                    <tr key={item.categoryId} className={row?.checked ? '' : 'opacity-40'}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={row?.checked ?? true}
                          onChange={() => toggleRow(item.categoryId)}
                          className="h-4 w-4 accent-brand-600"
                        />
                      </td>
                      <td className="px-3 py-2 font-medium text-zinc-800">{item.categoryName}</td>
                      <td className="px-3 py-2 text-right text-zinc-600">
                        {formatCurrency(item.avgMonthlySpend)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {item.trend === 'over' ? (
                          <Badge className="bg-red-100 text-red-700 border-red-200">
                            {formatCurrency(item.currentBudget!)}
                          </Badge>
                        ) : item.trend === 'under' ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200">
                            {formatCurrency(item.currentBudget!)}
                          </Badge>
                        ) : (
                          <Badge className="bg-zinc-100 text-zinc-500 border-zinc-200">—</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Input
                          type="text"
                          inputMode="numeric"
                          className="w-28 text-right h-8 text-sm ml-auto"
                          value={row?.amount ?? ''}
                          onChange={(e) => updateAmount(item.categoryId, e.target.value)}
                          disabled={!row?.checked}
                        />
                      </td>
                      <td className="px-3 py-2 text-zinc-500 max-w-[200px]">
                        <span className="text-xs leading-snug">{item.reason}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={phase === 'applying'}>
            Cancelar
          </Button>
          {phase === 'review' && (
            <Button onClick={handleApply} disabled={selectedRows.length === 0}>
              Aplicar seleccionadas ({selectedRows.length})
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
