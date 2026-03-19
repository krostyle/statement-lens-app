'use client';

import { useState } from 'react';
import { Button } from '@/src/components/ui/button';
import { Label } from '@/src/components/ui/label';
import { MonthPicker } from '@/src/components/ui/month-picker';
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
import type { StatementResponseDTO } from '@/src/application/dtos/statement.dto';

interface Props {
  statement: StatementResponseDTO;
  onSuccess: (updated: StatementResponseDTO) => void;
  onCancel: () => void;
}

export function StatementEditForm({ statement, onSuccess, onCancel }: Props) {
  const [bank, setBank] = useState(statement.bank);
  const [month, setMonth] = useState(statement.month);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    const res = await fetch(`/api/statements/${statement.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bank, month }),
    });

    setSaving(false);

    if (res.ok) {
      const updated: StatementResponseDTO = await res.json();
      onSuccess(updated);
    } else {
      const j = await res.json();
      setError(j.error ?? 'Error al guardar los cambios.');
    }
  };

  return (
    <DialogContent>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>Editar estado de cuenta</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Banco</Label>
            <Select value={bank} onValueChange={setBank}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="santander">Santander</SelectItem>
                <SelectItem value="falabella">Falabella</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Mes</Label>
            <MonthPicker value={month} onChange={setMonth} />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
