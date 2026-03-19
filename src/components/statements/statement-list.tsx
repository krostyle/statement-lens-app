'use client';

import { useEffect, useRef, useState } from 'react';
import { Trash2, RefreshCw, Upload, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/src/components/ui/dialog';
import { UploadDropzone } from './upload-dropzone';
import { StatementTransactions } from './statement-transactions';
import { formatDate } from '@/src/lib/utils';
import type { StatementResponseDTO } from '@/src/application/dtos/statement.dto';

const statusLabel: Record<string, string> = {
  done: 'Procesado',
  error: 'Error',
  processing: 'Procesando',
  pending: 'Pendiente',
};

const statusVariant = (s: string) => {
  if (s === 'done') return 'success';
  if (s === 'error') return 'destructive';
  if (s === 'processing') return 'warning';
  return 'secondary';
};

/** Indeterminate progress for pending/processing — uses createdAt so elapsed time survives navigation */
function ProcessingStatus({ status, createdAt }: { status: string; createdAt: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(createdAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [createdAt]);

  const fmt = elapsed < 60
    ? `${elapsed}s`
    : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;

  return (
    <div className="flex flex-col gap-1.5 w-40">
      <div className="flex items-center justify-between gap-2">
        <Badge variant={statusVariant(status)} className="flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          {statusLabel[status]}
        </Badge>
        <span className="text-xs text-zinc-400 tabular-nums">{fmt}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
        <div
          className="h-full w-1/3 rounded-full bg-primary/70"
          style={{ animation: 'progress-slide 1.4s ease-in-out infinite' }}
        />
      </div>
    </div>
  );
}

export function StatementsView() {
  const [statements, setStatements] = useState<StatementResponseDTO[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<StatementResponseDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StatementResponseDTO | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    const res = await fetch('/api/statements');
    const data = await res.json();
    const list: StatementResponseDTO[] = Array.isArray(data) ? data : [];
    setStatements(list);
    return list;
  };

  const startPolling = () => {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(async () => {
      const list = await load();
      const stillActive = list.some((s) => s.status === 'pending' || s.status === 'processing');
      if (!stillActive) stopPolling();
    }, 3000);
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  useEffect(() => {
    load().then((list) => {
      const hasActive = list.some((s) => s.status === 'pending' || s.status === 'processing');
      if (hasActive) startPolling();
    });
    return () => stopPolling();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUploadSuccess = async () => {
    setOpen(false);
    await load();
    startPolling();
  };

  const handleReprocess = async (id: string) => {
    await fetch(`/api/statements/${id}/reprocess`, { method: 'POST' });
    await load();
    startPolling();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/statements/${id}`, { method: 'DELETE' });
    setDeleteTarget(null);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{statements.length} estado(s) de cuenta</p>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={load}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Upload className="h-4 w-4" /> Subir estado de cuenta
          </Button>
        </div>
      </div>

      {/* Upload dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <UploadDropzone
          onSuccess={handleUploadSuccess}
          onCancel={() => setOpen(false)}
        />
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar estado de cuenta</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600 py-2">
            ¿Estás seguro que deseas eliminar «{deleteTarget?.fileName}»? Se eliminarán también todas sus transacciones. Esta acción no se puede deshacer.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteTarget && handleDelete(deleteTarget.id)}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transactions detail dialog */}
      <Dialog open={!!selected} onOpenChange={(v) => { if (!v) setSelected(null); }}>
        {selected && <StatementTransactions statement={selected} />}
      </Dialog>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-zinc-100 bg-zinc-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Archivo</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Banco</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Mes</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Estado</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Subido</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {statements.map((s) => (
              <tr key={s.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                <td
                  className={`px-4 py-3 font-medium text-zinc-900 ${s.status === 'done' ? 'cursor-pointer hover:text-primary' : ''}`}
                  onClick={() => s.status === 'done' && setSelected(s)}
                >
                  {s.fileName}
                </td>
                <td className="px-4 py-3 capitalize text-zinc-600">{s.bank}</td>
                <td className="px-4 py-3 text-zinc-600">
                  {s.month.includes('-') ? s.month.split('-').reverse().join('-') : s.month}
                </td>
                <td className="px-4 py-3">
                  {s.status === 'pending' || s.status === 'processing' ? (
                    <ProcessingStatus status={s.status} createdAt={s.createdAt} />
                  ) : (
                    <div className="flex flex-col gap-1">
                      <Badge variant={statusVariant(s.status)}>
                        {statusLabel[s.status] ?? s.status}
                      </Badge>
                      {s.status === 'error' && (
                        <span className="text-xs text-zinc-400 max-w-xs">
                          {s.errorMessage ?? 'No se pudo procesar el PDF.'}
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-500">{formatDate(s.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    {s.status === 'error' && (
                      <Button variant="ghost" size="icon" title="Reintentar procesamiento" onClick={() => handleReprocess(s.id)}>
                        <RotateCcw className="h-3.5 w-3.5 text-brand-600" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(s)}>
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {statements.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-400">
                  Sin estados de cuenta
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
