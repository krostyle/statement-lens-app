'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/src/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import type { CategoryResponseDTO } from '@/src/application/dtos/category.dto';

function translateApiError(raw: string | undefined): string {
  switch (raw) {
    case 'Category with this name already exists': return 'Ya existe una categoría con ese nombre.';
    case 'Category not found':                     return 'Categoría no encontrada.';
    case 'Forbidden':                              return 'No tienes permiso para realizar esta acción.';
    default:                                       return raw ?? 'Ocurrió un error inesperado.';
  }
}

const formSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(50),
  type: z.enum(['needs', 'wants']).nullable().optional(),
});
type FormInput = z.infer<typeof formSchema>;

interface Props {
  category?: CategoryResponseDTO | null;
  onSuccess: (category: CategoryResponseDTO) => void;
  onCancel: () => void;
}

export function CategoryForm({ category, onSuccess, onCancel }: Props) {
  const isEdit = !!category;
  const [serverError, setServerError] = useState('');

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: category
      ? { name: category.name, type: category.type ?? null }
      : { type: null },
  });

  const onSubmit = async (data: FormInput) => {
    setServerError('');
    const url = isEdit ? `/api/categories/${category!.id}` : '/api/categories';
    const method = isEdit ? 'PATCH' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, color: '#6b7280', type: data.type ?? null }),
      });

      if (res.ok) {
        const updated = await res.json();
        onSuccess(updated);
      } else {
        const json = await res.json().catch(() => ({}));
        setServerError(translateApiError(json?.error));
      }
    } catch {
      setServerError('Error de conexión. Intenta de nuevo.');
    }
  };

  return (
    <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nombre</Label>
            <Input placeholder="Ej: Alimentación" {...register('name')} />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ?? '__none__'}
                  onValueChange={(val) => field.onChange(val === '__none__' ? null : val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin definir" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin definir</SelectItem>
                    <SelectItem value="needs">Necesidad (50%)</SelectItem>
                    <SelectItem value="wants">Deseo (30%)</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-muted-foreground">
              Usado para la regla 50/30/20 en sugerencias de presupuesto con IA
            </p>
          </div>
          {serverError && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear categoría'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
