'use client';

import { useState, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { ReportSlice } from '@/src/domain/services/report.service';
import { clp, clpCompact, monthShort, pct, STATUS } from './report-format';

// ─── Tooltip ──────────────────────────────────────────────────────────────────
// Charts print without hover, so every value a tooltip shows is also on the page
// (legend, tip label or axis row). The tooltip only adds precision on screen.

interface TipState { x: number; y: number; content: ReactNode }

/** Positions relative to the nearest [data-tip-root] ancestor of the hovered mark. */
function useTooltip() {
  const [tip, setTip] = useState<TipState | null>(null);
  const show = (e: React.MouseEvent, content: ReactNode) => {
    const box = (e.currentTarget as Element).closest('[data-tip-root]')?.getBoundingClientRect();
    if (!box) return;
    setTip({ x: e.clientX - box.left, y: e.clientY - box.top, content });
  };
  const hide = () => setTip(null);
  const node = tip && (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)] whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg print:hidden"
      style={{ left: tip.x, top: tip.y }}
    >
      {tip.content}
    </div>
  );
  return { show, hide, node };
}

function TipBody({ title, value, detail }: { title: string; value: string; detail?: string }) {
  return (
    <>
      <div className="font-medium">{title}</div>
      <div className="tabular-nums text-slate-300">
        {value}
        {detail && <span className="ml-1.5 text-slate-400">{detail}</span>}
      </div>
    </>
  );
}

// ─── Donut ────────────────────────────────────────────────────────────────────

function arc(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function donutSegment(cx: number, cy: number, R: number, r: number, a0: number, a1: number) {
  // A full circle can't be drawn as one arc — nudge the end so it renders.
  const end = a1 - a0 >= 360 ? a0 + 359.99 : a1;
  const large = end - a0 > 180 ? 1 : 0;
  const [x0, y0] = arc(cx, cy, R, a0);
  const [x1, y1] = arc(cx, cy, R, end);
  const [x2, y2] = arc(cx, cy, r, end);
  const [x3, y3] = arc(cx, cy, r, a0);
  return `M${x0} ${y0}A${R} ${R} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${r} ${r} 0 ${large} 0 ${x3} ${y3}Z`;
}

export function DonutChart({ slices, colorOf, total }: {
  slices: ReportSlice[];
  colorOf: (key: string) => string;
  total: number;
}) {
  const tip = useTooltip();
  const [active, setActive] = useState<string | null>(null);
  const starts = slices.map((_, i) => slices.slice(0, i).reduce((s, x) => s + x.share * 360, 0));

  return (
    <div data-tip-root className="relative grid grid-cols-[176px_1fr] items-center gap-8 max-sm:grid-cols-1">
      <svg viewBox="0 0 176 176" width={176} height={176} role="img" aria-label="Distribución del gasto">
        {slices.map((s, i) => {
          const a0 = starts[i];
          return (
            <path
              key={s.key}
              d={donutSegment(88, 88, 86, 56, a0, a0 + s.share * 360)}
              fill={colorOf(s.key)}
              stroke="#fff"
              strokeWidth={2}
              opacity={active && active !== s.key ? 0.35 : 1}
              onMouseMove={(e) => { setActive(s.key); tip.show(e, <TipBody title={s.label} value={clp(s.total)} detail={pct(s.share, 1)} />); }}
              onMouseLeave={() => { setActive(null); tip.hide(); }}
            />
          );
        })}
        <text x={88} y={82} textAnchor="middle" className="fill-slate-500 text-[10px]">Total</text>
        <text x={88} y={100} textAnchor="middle" className="fill-slate-900 text-[15px] font-semibold">{clpCompact(total)}</text>
      </svg>
      <ul className="space-y-1.5 text-[12.5px]">
        {slices.map((s) => (
          <li
            key={s.key}
            className={cn('grid grid-cols-[10px_1fr_auto_44px] items-center gap-2.5 transition-opacity', active && active !== s.key && 'opacity-40')}
            onMouseEnter={() => setActive(s.key)}
            onMouseLeave={() => setActive(null)}
          >
            <span className="size-2.5 rounded-[3px]" style={{ background: colorOf(s.key) }} />
            <span className="truncate text-slate-700">{s.label}</span>
            <span className="tabular-nums text-slate-900">{clp(s.total)}</span>
            <span className="text-right tabular-nums text-slate-500">{pct(s.share)}</span>
          </li>
        ))}
      </ul>
      {tip.node}
    </div>
  );
}

// ─── Horizontal bars (distribution, "barras" mode) ────────────────────────────

export function SliceBars({ slices, colorOf }: { slices: ReportSlice[]; colorOf: (key: string) => string }) {
  const tip = useTooltip();
  const max = Math.max(...slices.map((s) => s.total), 1);
  return (
    <div data-tip-root className="relative space-y-2">
      {slices.map((s) => (
        <div key={s.key} className="grid grid-cols-[150px_1fr] items-center gap-3 text-[12.5px] max-sm:grid-cols-[100px_1fr]">
          <span className="truncate text-right text-slate-700">{s.label}</span>
          <div
            className="flex items-center gap-2"
            onMouseMove={(e) => tip.show(e, <TipBody title={s.label} value={clp(s.total)} detail={pct(s.share, 1)} />)}
            onMouseLeave={tip.hide}
          >
            <div className="h-3.5 rounded-r-[4px]" style={{ width: `${(s.total / max) * 78}%`, minWidth: 3, background: colorOf(s.key) }} />
            <span className="whitespace-nowrap tabular-nums text-slate-900">
              {clp(s.total)} <span className="text-slate-500">{pct(s.share)}</span>
            </span>
          </div>
        </div>
      ))}
      {tip.node}
    </div>
  );
}

// ─── Spent vs. budget ─────────────────────────────────────────────────────────

export interface BudgetBarRow { key: string; label: string; total: number; budget: number }

export function BudgetBars({ rows }: { rows: BudgetBarRow[] }) {
  const tip = useTooltip();
  const max = Math.max(...rows.flatMap((r) => [r.total, r.budget]), 1);
  return (
    <div data-tip-root className="relative">
      <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-[11.5px] text-slate-500">
        <Key color="#cde2fb">Presupuesto</Key>
        <Key color="#2a78d6">Gastado</Key>
        <Key color={STATUS.critical}>Sobre el presupuesto</Key>
      </div>
      <div className="space-y-2.5">
        {rows.map((r) => {
          const over = r.total > r.budget;
          const w = (n: number) => `${(n / max) * 100}%`;
          return (
            <div key={r.key} className="grid grid-cols-[150px_1fr_150px] items-center gap-3 text-[12.5px] max-sm:grid-cols-[90px_1fr_110px]">
              <span className="truncate text-right text-slate-700">{r.label}</span>
              <div
                className="relative h-3.5"
                onMouseMove={(e) => tip.show(e, <TipBody title={r.label} value={`${clp(r.total)} de ${clp(r.budget)}`} detail={pct(r.total / r.budget)} />)}
                onMouseLeave={tip.hide}
              >
                <div className="absolute inset-y-0 left-0 rounded-r-[4px] bg-[#cde2fb]" style={{ width: w(r.budget) }} />
                <div className="absolute inset-y-0 left-0 rounded-r-[4px] bg-[#2a78d6]" style={{ width: w(Math.min(r.total, r.budget)) }} />
                {over && (
                  <div
                    className="absolute inset-y-0 rounded-r-[4px] border-l-2 border-white"
                    style={{ left: w(r.budget), width: w(r.total - r.budget), background: STATUS.critical }}
                  />
                )}
              </div>
              <div className="leading-tight tabular-nums">
                <div className={cn('flex items-center gap-1', over ? 'font-semibold text-[#b42318]' : 'text-slate-900')}>
                  {over && <AlertTriangle className="size-3" aria-label="Excedido" />}
                  {clp(r.total)}
                </div>
                <div className="text-[11px] text-slate-500">{pct(r.total / r.budget)} de {clpCompact(r.budget)}</div>
              </div>
            </div>
          );
        })}
      </div>
      {tip.node}
    </div>
  );
}

function Key({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-3.5 rounded-[3px]" style={{ background: color }} />
      {children}
    </span>
  );
}

// ─── 6-month trend (columns) ──────────────────────────────────────────────────

export function TrendColumns({ points, current }: { points: { month: string; total: number }[]; current: string }) {
  const tip = useTooltip();
  const max = Math.max(...points.map((p) => p.total), 1);
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const H = 150;

  return (
    <div data-tip-root className="relative">
      <div className="grid grid-cols-[48px_1fr] gap-2">
        <div className="relative text-right text-[10.5px] tabular-nums text-slate-400" style={{ height: H }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: H - (t / top) * H }}>{clpCompact(t)}</span>
          ))}
        </div>
        <div className="relative" style={{ height: H }}>
          {ticks.map((t) => (
            <div key={t} className={cn('absolute inset-x-0 h-px', t === 0 ? 'bg-slate-300' : 'bg-slate-100')} style={{ top: H - (t / top) * H }} />
          ))}
          <div className="absolute inset-0 flex items-end justify-around">
            {points.map((p) => (
              <div
                key={p.month}
                className="w-7 rounded-t-[4px]"
                style={{ height: Math.max((p.total / top) * H, 2), background: p.month === current ? '#1c5cab' : '#86b6ef' }}
                onMouseMove={(e) => tip.show(e, <TipBody title={monthShort(p.month) + ' ' + p.month.slice(0, 4)} value={clp(p.total)} />)}
                onMouseLeave={tip.hide}
              />
            ))}
          </div>
        </div>
        <div />
        <div className="flex justify-around pt-2 text-center text-[11px] leading-tight">
          {points.map((p) => (
            <div key={p.month} className={p.month === current ? 'font-semibold text-slate-900' : 'text-slate-500'}>
              <div>{monthShort(p.month)}</div>
              <div className="tabular-nums">{clpCompact(p.total)}</div>
            </div>
          ))}
        </div>
      </div>
      {tip.node}
    </div>
  );
}

function niceTicks(max: number): number[] {
  const rough = max / 3;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? rough;
  const ticks: number[] = [];
  for (let v = 0; v < max + step; v += step) ticks.push(v);
  return ticks;
}
