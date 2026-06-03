'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Button } from './button';
import { cn } from '@/src/lib/utils';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

interface Props {
  /** 'YYYY-MM-DD' or '' */
  from: string;
  /** 'YYYY-MM-DD' or '' */
  to: string;
  onChange: (from: string, to: string) => void;
  className?: string;
}

/** Last calendar day of a month as 'YYYY-MM-DD' */
function lastDay(year: number, month: number): string {
  return new Date(year, month + 1, 0).toISOString().split('T')[0];
}

/** Format 'YYYY-MM-DD' → 'D Mes' in Spanish */
function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** If from/to exactly covers a full calendar month, returns { year, month } (0-indexed), else null */
function detectMonth(from: string, to: string): { year: number; month: number } | null {
  if (!from || !to) return null;
  const [fy, fm, fd] = from.split('-').map(Number);
  if (fd !== 1) return null;
  if (to !== lastDay(fy, fm - 1)) return null;
  return { year: fy, month: fm - 1 };
}

export function DateRangeFilter({ from, to, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());

  const selectedMonth = detectMonth(from, to);

  const label = (() => {
    if (!from && !to) return 'Todas las fechas';
    if (selectedMonth) return `${MONTHS[selectedMonth.month]} ${selectedMonth.year}`;
    if (from && to) return `${fmtDate(from)} – ${fmtDate(to)}`;
    if (from) return `Desde ${fmtDate(from)}`;
    return `Hasta ${fmtDate(to)}`;
  })();

  const handleMonthSelect = (monthIndex: number) => {
    const f = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
    const t = lastDay(year, monthIndex);
    onChange(f, t);
    setOpen(false);
  };

  // When the user edits the range inputs, clear the month selection first
  const handleFromChange = (val: string) => onChange(val, selectedMonth ? '' : to);
  const handleToChange   = (val: string) => onChange(selectedMonth ? '' : from, val);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn('justify-start font-normal', !from && !to && 'text-zinc-400', className)}
        >
          {label}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-64 p-3" align="start">
        {/* ── Month selector ── */}
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Por mes</p>
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => setYear((y) => y - 1)} className="rounded p-1 hover:bg-zinc-100">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold">{year}</span>
          <button onClick={() => setYear((y) => y + 1)} className="rounded p-1 hover:bg-zinc-100">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {MONTHS.map((name, i) => {
            const isSelected = selectedMonth?.year === year && selectedMonth?.month === i;
            return (
              <button
                key={i}
                onClick={() => handleMonthSelect(i)}
                className={cn(
                  'rounded px-2 py-1.5 text-sm transition-colors hover:bg-zinc-100',
                  isSelected && 'bg-primary text-primary-foreground hover:bg-primary/90',
                )}
              >
                {name}
              </button>
            );
          })}
        </div>

        {/* ── Divider ── */}
        <div className="my-3 border-t border-zinc-100" />

        {/* ── Custom range ── */}
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Rango personalizado</p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 w-10 shrink-0">Desde</span>
            <input
              type="date"
              className="flex-1 h-7 rounded border border-zinc-200 bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
              value={selectedMonth ? '' : from}
              onChange={(e) => handleFromChange(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 w-10 shrink-0">Hasta</span>
            <input
              type="date"
              className="flex-1 h-7 rounded border border-zinc-200 bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
              value={selectedMonth ? '' : to}
              onChange={(e) => handleToChange(e.target.value)}
            />
          </div>
        </div>

        {(from || to) && (
          <button
            onClick={() => { onChange('', ''); setOpen(false); }}
            className="mt-3 w-full rounded px-2 py-1.5 text-xs text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
          >
            Limpiar selección
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
