'use client';

import { useState, useRef } from 'react';
import { Upload } from 'lucide-react';
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

interface Props {
  onSuccess: () => void;
  onCancel: () => void;
}

const CREDIT_CARD_BANKS = [
  { value: 'santander', label: 'Santander' },
  { value: 'falabella', label: 'Falabella' },
  { value: 'liderbci',  label: 'LiderBCI' },
];

const CHECKING_BANKS = [
  { value: 'santander',   label: 'Santander' },
  { value: 'falabella',   label: 'Falabella' },
  { value: 'bci',         label: 'BCI' },
  { value: 'bancoestado', label: 'BancoEstado / Cuenta RUT' },
];

export function UploadDropzone({ onSuccess, onCancel }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [statementType, setStatementType] = useState<'credit_card' | 'checking'>('credit_card');
  const [bank, setBank] = useState('santander');
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const bankOptions = statementType === 'checking' ? CHECKING_BANKS : CREDIT_CARD_BANKS;

  const handleTypeChange = (type: 'credit_card' | 'checking') => {
    setStatementType(type);
    // Reset bank to first option of the new type
    const options = type === 'checking' ? CHECKING_BANKS : CREDIT_CARD_BANKS;
    setBank(options[0].value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setError('');

    if (file.type !== 'application/pdf') {
      setError('Solo se aceptan archivos PDF.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('El archivo no puede superar los 10 MB.');
      return;
    }
    if (!month) {
      setError('Selecciona un mes.');
      return;
    }

    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('bank', bank);
    formData.append('month', month);
    formData.append('statementType', statementType);

    const res = await fetch('/api/statements', { method: 'POST', body: formData });
    setUploading(false);
    if (res.ok) {
      onSuccess();
    } else {
      const j = await res.json();
      setError(j.error ?? 'Error al subir el archivo');
    }
  };

  return (
    <DialogContent>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>Subir extracto bancario</DialogTitle>
        </DialogHeader>

        <div
          className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 text-center cursor-pointer hover:border-primary transition-colors"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {file ? file.name : 'Haz clic para seleccionar un PDF'}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        {/* Tipo de documento */}
        <div className="space-y-1.5">
          <Label>¿Qué tipo de documento es?</Label>
          <Select value={statementType} onValueChange={(v) => handleTypeChange(v as 'credit_card' | 'checking')}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="credit_card">Estado de cuenta — Tarjeta de crédito</SelectItem>
              <SelectItem value="checking">Cartola — Cuenta corriente / Cuenta RUT</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Banco</Label>
            <Select value={bank} onValueChange={setBank}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {bankOptions.map((b) => (
                  <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                ))}
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
          <Button type="submit" disabled={!file || uploading}>
            {uploading ? 'Subiendo...' : `Subir ${statementType === 'checking' ? 'cartola' : 'estado de cuenta'}`}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
