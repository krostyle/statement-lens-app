'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  createTransactionSchema,
  type CreateTransactionInput,
  type CreateTransactionOutput,
} from '@/src/lib/validations/transaction.schema';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/src/components/ui/dialog';
import { formatCurrency, formatDate } from '@/src/lib/utils';
import type { CategoryResponseDTO } from '@/src/application/dtos/category.dto';
import type { TransactionResponseDTO } from '@/src/application/dtos/transaction.dto';

const editSchema = z.object({
  categoryId: z.string().uuid(),
  description: z.string().min(1, 'La descripción no puede estar vacía'),
});
type EditInput = z.infer<typeof editSchema>;

interface Props {
  categories: CategoryResponseDTO[];
  transaction?: TransactionResponseDTO | null;
  onSuccess: (updated?: TransactionResponseDTO) => void;
  onCancel: () => void;
}

export function TransactionForm({ categories, transaction, onSuccess, onCancel }: Props) {
  const isEdit = !!transaction;
  const sortedCategories = [...categories].sort((a, b) => a.name.localeCompare(b.name, 'es'));

  // ── Edit form ────────────────────────────────────────────────────────────
  const editForm = useForm<EditInput>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      categoryId: transaction?.categoryId ?? '',
      description: transaction?.description ?? '',
    },
  });

  // ── Create form ──────────────────────────────────────────────────────────
  const createForm = useForm<CreateTransactionInput, unknown, CreateTransactionOutput>({
    resolver: zodResolver(createTransactionSchema),
    defaultValues: { currency: 'CLP', isInstallment: false },
  });

  const { formState: { isSubmitting: editSubmitting, errors: editErrors }, control: editControl, handleSubmit: editHandleSubmit, register: editRegister } = editForm;
  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = createForm;

  const onEditSubmit = async (data: EditInput) => {
    const res = await fetch(`/api/transactions/${transaction!.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId: data.categoryId, description: data.description }),
    });
    if (res.ok) {
      const updated: TransactionResponseDTO = await res.json();
      onSuccess(updated);
    } else {
      const body = await res.json().catch(() => ({}));
      editForm.setError('categoryId', { message: body?.error ?? 'Error al guardar' });
    }
  };

  const onCreateSubmit = async (data: CreateTransactionOutput) => {
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      onSuccess();
    } else {
      const body = await res.json().catch(() => ({}));
      createForm.setError('merchant', { message: body?.error ?? 'Error al crear' });
    }
  };

  if (isEdit && transaction) {
    return (
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <form onSubmit={editHandleSubmit(onEditSubmit)} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Editar transacción</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-zinc-400 uppercase tracking-wide">Comercio</p>
                  <p className="font-medium text-zinc-900">{transaction.merchant}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-zinc-400 uppercase tracking-wide">Monto</p>
                  <p className={`font-semibold ${transaction.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {transaction.amount < 0 ? '−' : '+'}{formatCurrency(Math.abs(transaction.amount), transaction.currency)}
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-zinc-400 uppercase tracking-wide">Descripción</p>
                <Input {...editRegister('description')} className="h-8 text-sm" />
                {editErrors.description && (
                  <p className="text-xs text-destructive">{editErrors.description.message}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-zinc-400 uppercase tracking-wide">Fecha</p>
                <p className="text-sm text-zinc-600">{formatDate(transaction.date)}</p>
              </div>
              {transaction.isInstallment && transaction.installmentNum && transaction.installmentTotal && (
                <div>
                  <p className="text-xs text-zinc-400 uppercase tracking-wide">Cuotas</p>
                  <p className="text-sm text-zinc-600">{transaction.installmentNum} de {transaction.installmentTotal}</p>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Controller
                name="categoryId"
                control={editControl}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar categoría..." />
                    </SelectTrigger>
                    <SelectContent>
                      {sortedCategories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {editErrors.categoryId && (
                <p className="text-xs text-destructive">{editErrors.categoryId.message}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={editSubmitting}>
              {editSubmitting ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    );
  }

  return (
    <DialogContent>
      <form onSubmit={handleSubmit(onCreateSubmit)} className="flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>Nueva transacción</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Comercio</Label>
            <Input placeholder="Ej: Jumbo" {...register('merchant')} />
            {errors.merchant && (
              <p className="text-xs text-destructive">{errors.merchant.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <Input placeholder="Descripción" {...register('description')} />
          </div>

          <div className="space-y-1.5">
            <Label>Monto (negativo = gasto)</Label>
            <Input type="number" step="1" {...register('amount', { valueAsNumber: true })} />
            {errors.amount && (
              <p className="text-xs text-destructive">{errors.amount.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Fecha</Label>
            <Input type="datetime-local" {...register('date')} />
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label>Categoría</Label>
            <Controller
              name="categoryId"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar categoría..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.categoryId && (
              <p className="text-xs text-destructive">{errors.categoryId.message}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Crear transacción'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
