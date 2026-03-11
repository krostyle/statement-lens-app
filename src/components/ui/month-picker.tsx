'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Button } from './button';
import { cn } from '@/src/lib/utils';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

interface Props {
  value: string; // 'YYYY-MM' or ''
  onChange: (value: string) => void;
  placeholder?: string;
}

export function MonthPicker({ value, onChange, placeholder = 'Seleccionar mes...' }: Props) {
  const now = new Date();
  const [year, setYear] = useState(value ? Number(value.split('-')[0]) : now.getUTCFullYear());
  const [open, setOpen] = useState(false);

  const selectedYear = value ? Number(value.split('-')[0]) : null;
  const selectedMonth = value ? Number(value.split('-')[1]) - 1 : null; // 0-indexed

  const label = value
    ? `${MONTHS[Number(value.split('-')[1]) - 1]} ${value.split('-')[0]}`
    : placeholder;

  const handleSelect = (monthIndex: number) => {
    const m = String(monthIndex + 1).padStart(2, '0');
    onChange(`${year}-${m}`);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('w-44 justify-start font-normal', !value && 'text-zinc-400')}>
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start">
        {/* Year navigation */}
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={() => setYear((y) => y - 1)}
            className="rounded p-1 hover:bg-zinc-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold">{year}</span>
          <button
            onClick={() => setYear((y) => y + 1)}
            className="rounded p-1 hover:bg-zinc-100"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {/* Month grid */}
        <div className="grid grid-cols-3 gap-1">
          {MONTHS.map((name, i) => {
            const isSelected = selectedYear === year && selectedMonth === i;
            return (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                className={cn(
                  'rounded px-2 py-1.5 text-sm transition-colors hover:bg-zinc-100',
                  isSelected && 'bg-primary text-primary-foreground hover:bg-primary/90'
                )}
              >
                {name}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
