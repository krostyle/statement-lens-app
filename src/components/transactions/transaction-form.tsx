'use client';

import { useForm, Controller, useWatch } from 'react-hook-form';
import { useState } from 'react';
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
import { formatDate } from '@/src/lib/utils';
import type { CategoryResponseDTO } from '@/src/application/dtos/category.dto';
import type { TransactionResponseDTO } from '@/src/application/dtos/transaction.dto';

const BANK_LABELS: Record<string, string> = {
  santander: 'Santander',
  falabella: 'Falabella',
  liderbci:  'LiderBCI',
};

// Radix Select forbids value="", so we use this sentinel for "any card"
// and convert it to "" at the API boundary.
const BANK_ANY = '__any__';

const editSchema = z.object({
  categoryId: z.string().uuid(),
  merchant: z.string().min(1, 'El comercio no puede estar vacío'),
  description: z.string().min(1, 'La descripción no puede estar vacía'),
  amount: z.number({ message: 'Ingresa un número válido' }),
  transactionType: z.enum(['expense', 'income', 'transfer']),
  saveMerchantRule: z.boolean(),
  saveMerchantRuleBank: z.string(), // BANK_ANY = any card, else specific bank key
  applyToInstallmentGroup: z.boolean(),
  installmentNum: z.number().int().positive().optional().nullable(),
  installmentTotal: z.number().int().positive().optional().nullable(),
});
type EditInput = z.infer<typeof editSchema>;

interface Props {
  categories: CategoryResponseDTO[];
  transaction?: TransactionResponseDTO | null;
  /** Raw bank key of the statement this transaction came from, e.g. "santander". Undefined if manual. */
  bank?: string;
  onSuccess: (updated?: TransactionResponseDTO) => void;
  onCancel: () => void;
}

export function TransactionForm({ categories, transaction, bank, onSuccess, onCancel }: Props) {
  const isEdit = !!transaction;
  const sortedCategories = [...categories].sort((a, b) => a.name.localeCompare(b.name, 'es'));

  // Two-phase state for rule conflicts: transaction saved OK but rule failed
  const [ruleWarning, setRuleWarning] = useState<string | null>(null);
  const [savedTransaction, setSavedTransaction] = useState<TransactionResponseDTO | null>(null);

  // ── Edit form ────────────────────────────────────────────────────────────
  const editForm = useForm<EditInput>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      categoryId: transaction?.categoryId ?? '',
      merchant: transaction?.merchant ?? '',
      description: transaction?.description ?? '',
      amount: transaction?.amount ?? 0,
      transactionType: (transaction?.transactionType ?? 'expense') as 'expense' | 'income' | 'transfer',
      saveMerchantRule: false,
      saveMerchantRuleBank: bank ?? BANK_ANY, // pre-select the transaction's card
      applyToInstallmentGroup: false,
      installmentNum: transaction?.installmentNum ?? null,
      installmentTotal: transaction?.installmentTotal ?? null,
    },
  });

  // ── Create form ──────────────────────────────────────────────────────────
  const createForm = useForm<CreateTransactionInput, unknown, CreateTransactionOutput>({
    resolver: zodResolver(createTransactionSchema),
    defaultValues: { currency: 'CLP', isInstallment: false },
  });

  const {
    formState: { isSubmitting: editSubmitting, errors: editErrors },
    control: editControl,
    handleSubmit: editHandleSubmit,
    register: editRegister,
    setValue: editSetValue,
  } = editForm;

  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = createForm;

  // Watch fields that can trigger side-effect options
  const watchedCategoryId      = useWatch({ control: editControl, name: 'categoryId' });
  const watchedDescription     = useWatch({ control: editControl, name: 'description' });
  const watchedSaveRule        = useWatch({ control: editControl, name: 'saveMerchantRule' });
  const categoryChanged        = isEdit && watchedCategoryId  !== transaction?.categoryId;
  const descriptionChanged     = isEdit && watchedDescription !== transaction?.description;
  // Show the group-propagation checkbox when category OR description changed (for installments)
  const groupTrigger           = categoryChanged || descriptionChanged;

  const onEditSubmit = async (data: EditInput) => {
    const res = await fetch(`/api/transactions/${transaction!.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categoryId: data.categoryId,
        merchant: data.merchant,
        description: data.description,
        amount: data.amount,
        transactionType: data.transactionType,
        saveMerchantRule: data.saveMerchantRule,
        saveMerchantRuleBank: data.saveMerchantRule
          ? (data.saveMerchantRuleBank === BANK_ANY ? '' : data.saveMerchantRuleBank)
          : undefined,
        applyToInstallmentGroup: transaction?.isInstallment
          ? data.applyToInstallmentGroup
          : false,
        ...(transaction?.isInstallment && {
          installmentNum: data.installmentNum,
          installmentTotal: data.installmentTotal,
        }),
      }),
    });
    if (res.ok) {
      const body: TransactionResponseDTO & { ruleWarning?: string } = await res.json();
      if (body.ruleWarning) {
        // Transaction was saved but the merchant rule could not be persisted
        setSavedTransaction(body);
        setRuleWarning(body.ruleWarning);
      } else {
        onSuccess(body);
      }
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
                <div className="flex-1 space-y-1">
                  <p className="text-xs text-zinc-400 uppercase tracking-wide">Comercio</p>
                  <Input {...editRegister('merchant')} className="h-8 text-sm font-medium" />
                  {editErrors.merchant && (
                    <p className="text-xs text-destructive">{editErrors.merchant.message}</p>
                  )}
                </div>
                <div className="text-right space-y-1">
                  <p className="text-xs text-zinc-400 uppercase tracking-wide">Monto</p>
                  <Input
                    type="number"
                    step="1"
                    className="h-8 text-sm w-36 text-right"
                    {...editRegister('amount', { valueAsNumber: true })}
                  />
                  {editErrors.amount && (
                    <p className="text-xs text-destructive">{editErrors.amount.message}</p>
                  )}
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
              {transaction.isInstallment && (
                <div className="space-y-1">
                  <p className="text-xs text-zinc-400 uppercase tracking-wide">Cuotas</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 space-y-0.5">
                      <p className="text-[10px] text-zinc-400">N° cuota</p>
                      <Input
                        type="number"
                        min={1}
                        className="h-8 text-sm"
                        {...editRegister('installmentNum', { valueAsNumber: true })}
                      />
                      {editErrors.installmentNum && (
                        <p className="text-xs text-destructive">{editErrors.installmentNum.message}</p>
                      )}
                    </div>
                    <span className="text-zinc-400 mt-4">de</span>
                    <div className="flex-1 space-y-0.5">
                      <p className="text-[10px] text-zinc-400">Total cuotas</p>
                      <Input
                        type="number"
                        min={1}
                        className="h-8 text-sm"
                        {...editRegister('installmentTotal', { valueAsNumber: true })}
                      />
                      {editErrors.installmentTotal && (
                        <p className="text-xs text-destructive">{editErrors.installmentTotal.message}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                      <SelectContent position="popper">
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

              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Controller
                  name="transactionType"
                  control={editControl}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        <SelectItem value="expense">Gasto</SelectItem>
                        <SelectItem value="income">Ingreso</SelectItem>
                        <SelectItem value="transfer">Transferencia interna</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            {/* Side-effect options — always visible when editing */}
            <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 space-y-2.5">
              <p className="text-xs font-medium text-brand-700 uppercase tracking-wide">Automatización</p>

              {/* "Recordar" — always available, uses current category if unchanged */}
              <div className="space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-primary accent-primary"
                    {...editRegister('saveMerchantRule')}
                  />
                  <span className="text-sm text-zinc-700 leading-snug">
                    Recordar esta categoría para <span className="font-medium">«{transaction.merchant}»</span> en futuros estados de cuenta
                  </span>
                </label>

                {/* Bank scope selector — only visible when the checkbox is checked */}
                {watchedSaveRule && (
                  <div className="ml-6 flex items-center gap-2">
                    <span className="text-xs text-zinc-500 shrink-0">Aplicar a:</span>
                    <Controller
                      name="saveMerchantRuleBank"
                      control={editControl}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="h-7 text-xs flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent position="popper">
                            <SelectItem value={BANK_ANY}>Cualquier tarjeta</SelectItem>
                            {Object.entries(BANK_LABELS).map(([key, label]) => (
                              <SelectItem key={key} value={key}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                )}
              </div>

              {/* Propagate to installment group — always visible for installment transactions */}
              {transaction.isInstallment && (
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-primary accent-primary"
                    {...editRegister('applyToInstallmentGroup')}
                  />
                  <span className="text-sm text-zinc-700 leading-snug">
                    {groupTrigger
                      ? 'Aplicar cambios a todas las cuotas de este grupo'
                      : 'Aplicar categoría actual a todas las cuotas de este grupo'}
                    {transaction.installmentTotal && transaction.installmentNum
                      ? ` (${transaction.installmentTotal - transaction.installmentNum} cuotas restantes)`
                      : ''}
                  </span>
                </label>
              )}
            </div>
          </div>

          {ruleWarning && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 space-y-2">
              <p className="font-medium">Transacción guardada</p>
              <p className="text-amber-700">{ruleWarning}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-amber-300 text-amber-800 hover:bg-amber-100"
                onClick={() => onSuccess(savedTransaction ?? undefined)}
              >
                Cerrar
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={!!ruleWarning}>
              Cancelar
            </Button>
            <Button type="submit" disabled={editSubmitting || !!ruleWarning}>
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
                  <SelectContent position="popper">
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
