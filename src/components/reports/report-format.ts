export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export function monthName(month: string): string {
  return MONTH_NAMES[Number(month.slice(5, 7)) - 1] ?? month;
}

export function formatMonth(month: string): string {
  return `${monthName(month)} ${month.slice(0, 4)}`;
}

export function monthShort(month: string): string {
  return monthName(month).slice(0, 3);
}

const clpFmt = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 });
const compactFmt = new Intl.NumberFormat('es-CL', { notation: 'compact', maximumFractionDigits: 1 });

export function clp(n: number): string {
  return clpFmt.format(Math.round(n));
}

/** $1,2 M / $350 mil — for axis labels and tight spots. */
export function clpCompact(n: number): string {
  return `$${compactFmt.format(Math.round(n))}`;
}

export function pct(share: number, digits = 0): string {
  return `${(share * 100).toFixed(digits).replace('.', ',')}%`;
}

export function signedPct(change: number): string {
  const rounded = Math.round(change * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1).replace('.', ',')}%`;
}

/** "2026-10-05" → "05/10" */
export function shortDate(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

export function cleanDesc(desc: string): string {
  return desc.replace(/\s*\(\d+\s+cuotas?\s+pendientes\)\s*$/i, '');
}

/**
 * Categorical slots — CVD-validated order from the dataviz reference palette. Seven slots;
 * anything past that folds into "Otros" (neutral), never a generated hue.
 */
export const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6'];
export const OTHER_COLOR = '#c3c2b7';

export const STATUS = {
  good: '#0ca30c',
  warning: '#fab219',
  critical: '#d03b3b',
  goodText: '#006300',
  criticalText: '#b42318',
};
