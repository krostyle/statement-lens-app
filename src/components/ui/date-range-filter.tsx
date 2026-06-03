'use client';

import { useState } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Button } from './button';
import { Calendar } from './calendar';
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

function parseLocal(iso: string): Date | undefined {
  if (!iso) return undefined;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function fmtShort(iso: string): string {
  if (!iso) return '';
  return format(parseLocal(iso)!, 'd MMM yyyy', { locale: es });
}

/** Detect if from/to exactly covers a full calendar month */
function detectMonth(from: string, to: string): { year: number; month: number } | null {
  if (!from || !to) return null;
  const f = parseLocal(from)!;
  const t = parseLocal(to)!;
  const first = startOfMonth(f);
  const last  = endOfMonth(f);
  if (
    f.getTime() === first.getTime() &&
    t.getTime() === last.getTime()
  ) {
    return { year: f.getFullYear(), month: f.getMonth() };
  }
  return null;
}

export function DateRangeFilter({ from, to, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());

  const selectedMonth = detectMonth(from, to);

  const label = (() => {
    if (!from && !to) return 'Todas las fechas';
    if (selectedMonth) return `${MONTHS[selectedMonth.month]} ${selectedMonth.year}`;
    if (from && to) return `${fmtShort(from)} – ${fmtShort(to)}`;
    if (from) return `Desde ${fmtShort(from)}`;
    return `Hasta ${fmtShort(to)}`;
  })();

  const handleMonthSelect = (monthIndex: number) => {
    const date = new Date(year, monthIndex, 1);
    onChange(
      format(startOfMonth(date), 'yyyy-MM-dd'),
      format(endOfMonth(date),   'yyyy-MM-dd'),
    );
    setOpen(false);
  };

  const handleRangeSelect = (range: DateRange | undefined) => {
    onChange(
      range?.from ? format(range.from, 'yyyy-MM-dd') : '',
      range?.to   ? format(range.to,   'yyyy-MM-dd') : '',
    );
  };

  const calendarSelected: DateRange = {
    from: parseLocal(from),
    to:   parseLocal(to),
  };

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

      <PopoverContent className="w-auto p-0" align="start">
        {/* ── Quick month selector ── */}
        <div className="px-3 pt-3 pb-2 border-b border-zinc-100">
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
          <div className="grid grid-cols-6 gap-1">
            {MONTHS.map((name, i) => {
              const isSelected = selectedMonth?.year === year && selectedMonth?.month === i;
              return (
                <button
                  key={i}
                  onClick={() => handleMonthSelect(i)}
                  className={cn(
                    'rounded px-1.5 py-1 text-xs transition-colors hover:bg-zinc-100',
                    isSelected && 'bg-primary text-primary-foreground hover:bg-primary/90',
                  )}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Calendar range picker ── */}
        <div className="p-1">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide px-2 pt-2 pb-1">Rango personalizado</p>
          <Calendar
            mode="range"
            selected={calendarSelected}
            onSelect={handleRangeSelect}
            locale={es}
            numberOfMonths={1}
          />
        </div>

        {(from || to) && (
          <div className="px-3 pb-3">
            <button
              onClick={() => { onChange('', ''); setOpen(false); }}
              className="w-full rounded px-2 py-1.5 text-xs text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
            >
              Limpiar selección
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
