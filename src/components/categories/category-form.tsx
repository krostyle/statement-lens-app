'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/src/components/ui/dialog';
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
});
type FormInput = z.infer<typeof formSchema>;

interface Props {
  category?: CategoryResponseDTO | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function CategoryForm({ category, onSuccess, onCancel }: Props) {
  const isEdit = !!category;
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: category ? { name: category.name } : {},
  });

  const onSubmit = async (data: FormInput) => {
    setServerError('');
    const url = isEdit ? `/api/categories/${category!.id}` : '/api/categories';
    const method = isEdit ? 'PATCH' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, color: '#6b7280' }),
      });

      if (res.ok) {
        onSuccess();
      } else {
        const json = await res.json().catch(() => ({}));
        setServerError(translateApiError(json?.error));
      }
    } catch {
      setServerError('Error de conexión. Intenta de nuevo.');
    }
  };

  return (
    <DialogContent>
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
