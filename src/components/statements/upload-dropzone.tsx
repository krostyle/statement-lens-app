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

export function UploadDropzone({ onSuccess, onCancel }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [bank, setBank] = useState('santander');
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

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

    const monthISO = month;

    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('bank', bank);
    formData.append('month', monthISO);

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
          <DialogTitle>Subir estado de cuenta</DialogTitle>
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
                <SelectItem value="liderbci">LiderBCI</SelectItem>
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
            {uploading ? 'Subiendo...' : 'Subir y procesar'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
