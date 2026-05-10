'use client';

import { useEffect, useState } from 'react';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/src/components/ui/dialog';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/src/components/ui/select';

interface MerchantRule {
  id: string;
  merchantPattern: string;
  bank: string;
  categoryId: string;
}

interface SimpleCategory { id: string; name: string; }

const BANKS = [
  { value: '',           label: 'Cualquier banco' },
  { value: 'santander',   label: 'Santander' },
  { value: 'falabella',   label: 'Falabella' },
  { value: 'bci',         label: 'BCI' },
  { value: 'bancoestado', label: 'BancoEstado' },
  { value: 'liderbci',    label: 'LiderBCI' },
];

const BANK_LABEL: Record<string, string> = Object.fromEntries(BANKS.map((b) => [b.value, b.label]));

// ─── Create / Edit dialog ──────────────────────────────────────────────────────

interface RuleDialogProps {
  rule: MerchantRule | null; // null = create
  categories: SimpleCategory[];
  onClose: () => void;
  onSaved: () => void;
}

function RuleDialog({ rule, categories, onClose, onSaved }: RuleDialogProps) {
  const isEdit = !!rule;
  const [merchant,   setMerchant]   = useState(rule?.merchantPattern ?? '');
  const [bank,       setBank]       = useState(rule?.bank ?? '');
  const [categoryId, setCategoryId] = useState(rule?.categoryId ?? '');
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  async function handleSubmit() {
    if (!merchant.trim() || !categoryId) {
      setError('Completa el comercio y la categoría');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/merchant-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchant: merchant.trim(), bank, categoryId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Error al guardar');
      }
      onSaved();
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
          <DialogTitle>{isEdit ? 'Editar regla' : 'Nueva regla'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="rule-merchant">Comercio (patrón)</Label>
            <Input
              id="rule-merchant"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="ej. payu *uber"
              disabled={isEdit}
            />
            {isEdit && (
              <p className="text-xs text-zinc-400">
                El patrón no puede cambiarse. Elimina y crea una nueva regla si necesitas modificarlo.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Banco</Label>
            <Select value={bank} onValueChange={setBank}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BANKS.map((b) => (
                  <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Categoría</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona categoría" />
              </SelectTrigger>
              <SelectContent>
                {[...categories].sort((a, b) => a.name.localeCompare(b.name, 'es')).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main view ─────────────────────────────────────────────────────────────────

export function RulesView() {
  const [rules,      setRules]      = useState<MerchantRule[]>([]);
  const [categories, setCategories] = useState<SimpleCategory[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [dialog,     setDialog]     = useState<{ rule: MerchantRule | null } | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  async function loadRules() {
    setLoading(true);
    try {
      const res = await fetch('/api/merchant-rules');
      setRules(res.ok ? await res.json() : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRules();
    fetch('/api/categories')
      .then((r) => r.ok ? r.json() : [])
      .then(setCategories)
      .catch(() => {});
  }, []);

  async function handleDelete(id: string) {
    await fetch(`/api/merchant-rules/${id}`, { method: 'DELETE' });
    setRules((prev) => prev.filter((r) => r.id !== id));
    setConfirmDel(null);
  }

  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-6">
      {loading ? (
        <p className="text-sm text-zinc-400">Cargando reglas…</p>
      ) : rules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 p-10 text-center text-zinc-400 text-sm">
          No hay reglas creadas. Crea una desde aquí o usa &ldquo;Guardar regla&rdquo; en la página de seguimiento.
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <div className="hidden md:grid grid-cols-[1fr_140px_1fr_96px] px-4 py-2 bg-zinc-50 border-b border-zinc-100 text-xs font-medium text-zinc-500 uppercase tracking-wide gap-4">
            <span>Comercio</span>
            <span>Banco</span>
            <span>Categoría</span>
            <span />
          </div>
          <div className="divide-y divide-zinc-100">
            {rules.map((rule) => (
              <div key={rule.id} className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_140px_1fr_96px] items-center px-4 py-3 gap-4">
                <div className="min-w-0">
                  <span className="text-sm font-mono text-zinc-800">{rule.merchantPattern}</span>
                  <div className="md:hidden flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-zinc-400">{BANK_LABEL[rule.bank] ?? 'Cualquier banco'}</span>
                    <span className="text-xs text-zinc-300">·</span>
                    <span className="text-xs text-zinc-500">{catMap.get(rule.categoryId) ?? '—'}</span>
                  </div>
                </div>
                <span className="hidden md:inline-block text-xs px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 w-fit">
                  {BANK_LABEL[rule.bank] ?? 'Cualquier banco'}
                </span>
                <span className="hidden md:block text-sm text-zinc-700">
                  {catMap.get(rule.categoryId) ?? rule.categoryId}
                </span>
                <div className="flex items-center gap-1 justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-zinc-400 hover:text-zinc-700"
                    onClick={() => setDialog({ rule })}
                    title="Editar"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {confirmDel === rule.id ? (
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        className="text-red-600 hover:underline font-medium"
                        onClick={() => handleDelete(rule.id)}
                      >
                        Eliminar
                      </button>
                      <button
                        className="text-zinc-400 hover:underline"
                        onClick={() => setConfirmDel(null)}
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-zinc-400 hover:text-red-500"
                      onClick={() => setConfirmDel(rule.id)}
                      title="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dialog */}
      {dialog !== null && (
        <RuleDialog
          rule={dialog.rule}
          categories={categories}
          onClose={() => { setDialog(null); setConfirmDel(null); }}
          onSaved={loadRules}
        />
      )}

      {/* FAB — always visible */}
      <div className="fixed bottom-6 right-6 md:static md:flex md:justify-end">
        <Button onClick={() => setDialog({ rule: null })}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva regla
        </Button>
      </div>
    </div>
  );
}
