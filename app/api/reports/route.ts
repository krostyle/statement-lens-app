import { auth } from '@clerk/nextjs/server';
import { transactionRepo, budgetRepo, categoryRepo } from '@/src/infrastructure/container';
import { prisma } from '@/src/infrastructure/database/prisma.client';
import {
  netSpendByCategory,
  calculateTotalIncome,
  calculateTotalExpenses,
  groupByMonth,
} from '@/src/domain/services/transaction.service';
import type { Transaction } from '@/src/domain/entities/transaction';
import type { MonthlySpend } from '@/src/domain/services/transaction.service';

// ─── Local types ──────────────────────────────────────────────────────────────

interface CategorySummary {
  categoryId: string;
  categoryName: string;
  budgeted: number;
  spent: number;
  difference: number;
  isOverBudget: boolean;
  percentUsed: number;
}

interface PrevSnapshot {
  month: string;
  totalSpent: number;
  summary: Array<{ categoryId: string; categoryName: string; spent: number }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES: Record<string, string> = {
  '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
  '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
  '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre',
};

function formatMonth(month: string): string {
  const [y, m] = month.split('-');
  return `${MONTH_NAMES[m] ?? m} ${y}`;
}

function prevMonthStr(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function clp(n: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(n);
}

function fDate(d: Date): string {
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Chart generators ─────────────────────────────────────────────────────────

const CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899',
  '#14b8a6', '#6366f1', '#a855f7', '#22c55e',
];

function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutPath(
  cx: number, cy: number,
  outerR: number, innerR: number,
  startDeg: number, endDeg: number,
): string {
  const o1 = polarToCartesian(cx, cy, outerR, startDeg);
  const o2 = polarToCartesian(cx, cy, outerR, endDeg);
  const i1 = polarToCartesian(cx, cy, innerR, endDeg);
  const i2 = polarToCartesian(cx, cy, innerR, startDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  const f = (n: number) => n.toFixed(2);
  return [
    `M ${f(o1.x)} ${f(o1.y)}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${f(o2.x)} ${f(o2.y)}`,
    `L ${f(i1.x)} ${f(i1.y)}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${f(i2.x)} ${f(i2.y)}`,
    'Z',
  ].join(' ');
}

function generateDonutChart(summary: CategorySummary[]): string {
  const data = summary.filter((s) => s.spent > 0).sort((a, b) => b.spent - a.spent);
  if (data.length === 0) {
    return '<p style="font-size:12px;color:#9ca3af;text-align:center;padding:40px 0;">Sin gastos registrados</p>';
  }
  const total = data.reduce((sum, s) => sum + s.spent, 0);
  const cx = 100, cy = 100, outerR = 82, innerR = 52;
  let deg = 0;
  const paths = data.map((s, i) => {
    const sweep = (s.spent / total) * 360;
    let pathD: string;
    if (data.length === 1) {
      const top = polarToCartesian(cx, cy, outerR, 0);
      const bot = polarToCartesian(cx, cy, outerR, 180);
      const iTop = polarToCartesian(cx, cy, innerR, 0);
      const iBot = polarToCartesian(cx, cy, innerR, 180);
      const f = (n: number) => n.toFixed(2);
      pathD = [
        `M ${f(top.x)} ${f(top.y)}`,
        `A ${outerR} ${outerR} 0 1 1 ${f(bot.x)} ${f(bot.y)}`,
        `A ${outerR} ${outerR} 0 1 1 ${f(top.x)} ${f(top.y)}`,
        `M ${f(iTop.x)} ${f(iTop.y)}`,
        `A ${innerR} ${innerR} 0 1 0 ${f(iBot.x)} ${f(iBot.y)}`,
        `A ${innerR} ${innerR} 0 1 0 ${f(iTop.x)} ${f(iTop.y)}`,
        'Z',
      ].join(' ');
    } else {
      pathD = donutPath(cx, cy, outerR, innerR, deg, deg + sweep);
    }
    deg += sweep;
    return `<path d="${pathD}" fill="${CHART_COLORS[i % CHART_COLORS.length]}" stroke="white" stroke-width="2"/>`;
  }).join('');
  const centerLabel = `
    <text x="${cx}" y="${cy - 9}" text-anchor="middle" font-size="9" fill="#6b7280" font-family="system-ui,sans-serif">Gasto total</text>
    <text x="${cx}" y="${cy + 7}" text-anchor="middle" font-size="11.5" font-weight="700" fill="#0f172a" font-family="system-ui,sans-serif">${esc(clp(total))}</text>
  `;
  const legend = data.slice(0, 10).map((s, i) => {
    const color = CHART_COLORS[i % CHART_COLORS.length];
    const pct = ((s.spent / total) * 100).toFixed(0);
    const name = s.categoryName.length > 22 ? `${s.categoryName.slice(0, 20)}…` : s.categoryName;
    return `
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
        <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${color};flex-shrink:0;"></span>
        <span style="font-size:10.5px;color:#374151;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(name)}</span>
        <span style="font-size:10.5px;font-weight:600;color:#6b7280;flex-shrink:0;">${pct}%</span>
      </div>`;
  }).join('');
  return `
    <svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      ${paths}${centerLabel}
    </svg>
    <div style="margin-top:10px;">${legend}</div>`;
}

function generateBarChart(summary: CategorySummary[]): string {
  const data = [...summary].sort((a, b) => b.spent - a.spent);
  if (data.length === 0) return '';
  const maxVal = Math.max(...data.flatMap((s) => [s.budgeted, s.spent]));
  const legend = `
    <div style="display:flex;flex-wrap:wrap;gap:14px;margin-bottom:14px;font-size:10px;color:#6b7280;">
      <span style="display:flex;align-items:center;gap:5px;"><span style="display:inline-block;width:12px;height:10px;border-radius:2px;background:#e5e7eb;"></span>Presupuesto</span>
      <span style="display:flex;align-items:center;gap:5px;"><span style="display:inline-block;width:12px;height:10px;border-radius:2px;background:#3b82f6;"></span>Gastado (dentro del presupuesto)</span>
      <span style="display:flex;align-items:center;gap:5px;"><span style="display:inline-block;width:12px;height:10px;border-radius:2px;background:#f97316;"></span>Gastado (categoría excedida)</span>
      <span style="display:flex;align-items:center;gap:5px;"><span style="display:inline-block;width:12px;height:10px;border-radius:2px;background:#ef4444;"></span>Excedente</span>
    </div>`;
  const bars = data.map((s) => {
    const budgetPct   = maxVal > 0 ? (s.budgeted / maxVal) * 100 : 0;
    const spentCapped = Math.min(s.spent, maxVal);
    const withinPct   = maxVal > 0 ? (Math.min(spentCapped, s.budgeted) / maxVal) * 100 : 0;
    const overflowPct = s.isOverBudget && maxVal > 0 ? ((spentCapped - s.budgeted) / maxVal) * 100 : 0;
    const spentColor  = s.isOverBudget ? '#f97316' : '#3b82f6';
    const name = s.categoryName.length > 20 ? `${s.categoryName.slice(0, 18)}…` : s.categoryName;
    return `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px;">
        <div style="width:115px;text-align:right;font-size:11px;color:#374151;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${esc(s.categoryName)}">${esc(name)}</div>
        <div style="flex:1;position:relative;height:16px;border-radius:3px;background:#f3f4f6;min-width:0;">
          <div style="position:absolute;inset:0;width:${budgetPct.toFixed(1)}%;background:#e5e7eb;border-radius:3px;"></div>
          <div style="position:absolute;inset:0;width:${withinPct.toFixed(1)}%;background:${spentColor};border-radius:3px;"></div>
          ${s.isOverBudget ? `<div style="position:absolute;top:0;bottom:0;left:${budgetPct.toFixed(1)}%;width:${overflowPct.toFixed(1)}%;background:#ef4444;border-radius:0 3px 3px 0;"></div>` : ''}
        </div>
        <div style="width:125px;flex-shrink:0;line-height:1.3;">
          <div style="font-size:11px;font-weight:${s.isOverBudget ? '700' : '500'};color:${s.isOverBudget ? '#dc2626' : '#18181b'};">${esc(clp(s.spent))}</div>
          <div style="font-size:9.5px;color:#9ca3af;">${s.percentUsed}% de ${esc(clp(s.budgeted))}</div>
        </div>
      </div>`;
  }).join('');
  return `<div style="padding-top:2px;">${legend}${bars}</div>`;
}

// ─── Installments section ─────────────────────────────────────────────────────

interface ActiveInstallment {
  merchant: string;
  bank: string | null;
  amount: number;
  installmentNum: number;
  installmentTotal: number;
  remaining: number;
}

const BANK_LABELS: Record<string, string> = {
  santander: 'Santander',
  falabella: 'Falabella',
  liderbci: 'LiderBCI',
  bci: 'BCI',
  bancoestado: 'BancoEstado',
};

function generateInstallmentsSection(
  items: ActiveInstallment[],
  totalMonthly: number,
  totalDebt: number,
): string {
  if (items.length === 0) return '';
  const sorted = [...items].sort((a, b) => b.remaining - a.remaining);
  const rows = sorted.map((i) => {
    const bankLabel = i.bank ? (BANK_LABELS[i.bank] ?? i.bank) : '—';
    const name = i.merchant.length > 28 ? `${i.merchant.slice(0, 26)}…` : i.merchant;
    return `
      <tr class="tx-row">
        <td class="tx-merchant" style="padding-left:10px;">${esc(name)}</td>
        <td style="font-size:12px;color:#6b7280;text-align:center;">${esc(bankLabel)}</td>
        <td style="font-size:12px;color:#374151;text-align:center;">${i.installmentNum}/${i.installmentTotal}</td>
        <td style="font-size:12px;font-weight:600;color:#18181b;text-align:right;padding-right:10px;">${clp(i.amount)}</td>
        <td style="font-size:12px;color:#374151;text-align:right;padding-right:10px;">${clp(i.remaining)}</td>
      </tr>`;
  }).join('');
  return `
  <div class="section">
    <div class="section-title">Cuotas activas</div>
    <p style="font-size:12px;color:#6b7280;margin-bottom:12px;">
      Compras que pagaste en cuotas y que aún tienen cuotas pendientes. <strong>Cuota mensual</strong> es lo que te descuenta la tarjeta cada mes. <strong>Cuotas pendientes × cuota mensual</strong> = lo que todavía debes pagar en total.
    </p>
    <table class="cat-table" style="font-size:12px;">
      <thead class="cat-table-head">
        <tr>
          <th style="text-align:left;">Comercio</th>
          <th style="text-align:center;">Tarjeta</th>
          <th style="text-align:center;" title="Cuota actual / Total de cuotas">Progreso</th>
          <th style="text-align:right;" title="Lo que te descuenta la tarjeta cada mes">Cuota mensual</th>
          <th style="text-align:right;" title="Total de cuotas que aún faltan por pagar">Cuotas pendientes × cuota</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="background:#f9fafb;border-top:2px solid #d1d5db;">
          <td colspan="3" style="padding:8px 10px;font-size:12px;font-weight:700;color:#374151;">Total</td>
          <td style="padding:8px 10px;font-size:12px;font-weight:700;color:#18181b;text-align:right;">${clp(totalMonthly)}</td>
          <td style="padding:8px 10px;font-size:12px;font-weight:700;color:#dc2626;text-align:right;">${clp(totalDebt)}</td>
        </tr>
      </tfoot>
    </table>
  </div>`;
}

// ─── Trend section ────────────────────────────────────────────────────────────

function generateTrendSection(trend: MonthlySpend[], reportMonth: string): string {
  if (trend.length < 2) return '';
  const maxVal = Math.max(...trend.map((t) => t.total));
  const bars = trend.map((t) => {
    const isReport = t.month === reportMonth;
    const pct = maxVal > 0 ? (t.total / maxVal) * 100 : 0;
    const [y, m] = t.month.split('-');
    const label = `${MONTH_NAMES[m] ?? m} ${y}`;
    const barColor  = isReport ? '#1e40af' : '#93c5fd';
    const textColor = isReport ? '#1e40af' : '#6b7280';
    const fontWeight = isReport ? '700' : '500';
    return `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:9px;">
        <div style="width:90px;text-align:right;font-size:11px;color:${textColor};font-weight:${fontWeight};flex-shrink:0;white-space:nowrap;">${esc(label)}</div>
        <div style="flex:1;position:relative;height:18px;border-radius:3px;background:#f3f4f6;min-width:0;">
          <div style="position:absolute;inset:0;width:${pct.toFixed(1)}%;background:${barColor};border-radius:3px;min-width:4px;"></div>
          <div style="position:absolute;inset:0;display:flex;align-items:center;padding-left:${Math.min(pct, 60).toFixed(1)}%;pointer-events:none;">
            <span style="font-size:10px;font-weight:600;color:${pct > 35 ? '#fff' : textColor};padding-left:5px;white-space:nowrap;">${esc(clp(t.total))}</span>
          </div>
        </div>
      </div>`;
  }).join('');
  return `
  <div class="section">
    <div class="section-title">Tendencia de gastos (últimos ${trend.length} meses)</div>
    <div style="padding-top:4px;">${bars}</div>
  </div>`;
}

// ─── HTML generator ───────────────────────────────────────────────────────────

function generateReportHtml(
  month: string,
  totalSpent: number,
  totalBudget: number,
  summary: CategorySummary[],
  transactions: Transaction[],
  prevSnapshot: PrevSnapshot | null,
  activeInstallments: ActiveInstallment[],
  totalMonthlyInstallments: number,
  totalDebtInstallments: number,
  trend: MonthlySpend[],
  savingsRate6m: number | null,
  rolling6mMonths: number,
): string {
  const diff = totalBudget - totalSpent;
  const isOver = totalSpent > totalBudget;
  const pct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
  const overCount = summary.filter((s) => s.isOverBudget).length;
  const pendingCount = transactions.filter(
    (t) => t.amount < 0 && (t as Transaction & { reviewStatus?: string }).reviewStatus === 'pending',
  ).length;

  // Group transactions by categoryId
  const txByCategory = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (t.amount === 0) continue;
    const arr = txByCategory.get(t.categoryId) ?? [];
    arr.push(t);
    txByCategory.set(t.categoryId, arr);
  }

  // ── Comparison section ────────────────────────────────────────────────────
  let comparisonHtml = '';
  if (prevSnapshot && prevSnapshot.totalSpent > 0) {
    const spentChange = prevSnapshot.totalSpent > 0
      ? ((totalSpent - prevSnapshot.totalSpent) / prevSnapshot.totalSpent) * 100
      : null;

    const changeTag = (change: number) => {
      const cls = change > 2 ? 'tag-red' : change < -2 ? 'tag-green' : 'tag-neutral';
      return `<span class="tag ${cls}">${change > 0 ? '+' : ''}${change.toFixed(1)}%</span>`;
    };

    const categoryChanges = summary
      .map((s) => {
        const prev = prevSnapshot.summary.find((p) => p.categoryId === s.categoryId);
        if (!prev || prev.spent === 0) return null;
        const change = ((s.spent - prev.spent) / prev.spent) * 100;
        return { categoryName: s.categoryName, spent: s.spent, prevSpent: prev.spent, change };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
      .slice(0, 6);

    const catChangesHtml = categoryChanges.map((c) => `
      <div class="cmp-row">
        <span class="cmp-name">${esc(c.categoryName)}</span>
        <div class="cmp-right">
          <span class="cmp-vals">${clp(c.prevSpent)} → ${clp(c.spent)}</span>
          ${changeTag(c.change)}
        </div>
      </div>`).join('');

    comparisonHtml = `
    <div class="section">
      <div class="section-title">Comparativa vs. ${esc(formatMonth(prevSnapshot.month))}</div>
      <div class="cmp-box">
        ${spentChange !== null ? `<div class="cmp-row cmp-total">
            <span class="cmp-name"><strong>Gasto total</strong></span>
            <div class="cmp-right">
              <span class="cmp-vals">${clp(prevSnapshot.totalSpent)} → ${clp(totalSpent)}</span>
              ${changeTag(spentChange)}
            </div>
          </div>` : ''}
        ${catChangesHtml}
      </div>
    </div>`;
  }

  // ── Categories + transactions ─────────────────────────────────────────────
  const categoriesHtml = summary.map((s: CategorySummary) => {
    const catTxs = (txByCategory.get(s.categoryId) ?? []).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const txRowsHtml = catTxs.map((t) => {
      const isReturn = t.amount > 0;
      const amountCell = isReturn
        ? `<span class="text-green">-${clp(t.amount)}</span>`
        : clp(Math.abs(t.amount));
      const bank = t.bank || null;
      const installmentLabel = t.isInstallment && t.installmentNum && t.installmentTotal
        ? `Cuota ${t.installmentNum}/${t.installmentTotal}` : null;
      const metaParts = [bank, installmentLabel].filter((x): x is string => !!x);
      const metaHtml = metaParts.length > 0
        ? `<span class="tx-meta">${metaParts.map(esc).join(' · ')}</span>` : '';
      const isPending = (t as Transaction & { reviewStatus?: string }).reviewStatus === 'pending';
      const pendingBadge = isPending
        ? `<span style="display:inline-block;padding:1px 5px;border-radius:3px;font-size:9px;font-weight:700;background:#fef3c7;color:#92400e;margin-left:5px;vertical-align:middle;">sin revisar</span>`
        : '';
      const merchantCell = isReturn
        ? `${esc(t.merchant)} <span class="return-badge">devolución</span>${pendingBadge}${metaHtml}`
        : `${esc(t.merchant)}${pendingBadge}${metaHtml}`;
      return `
          <tr class="tx-row">
            <td class="tx-date">${fDate(new Date(t.date))}</td>
            <td class="tx-merchant">${merchantCell}</td>
            <td class="tx-amount">${amountCell}</td>
            <td colspan="3"></td>
          </tr>`;
    }).join('');

    const diffCell = s.isOverBudget
      ? `<span class="text-red">+${clp(Math.abs(s.difference))}</span>`
      : `<span class="text-green">-${clp(Math.abs(s.difference))}</span>`;
    const statusBadge = s.isOverBudget
      ? `<span class="badge badge-red">Excedido</span>`
      : `<span class="badge badge-green">OK</span>`;
    const txSubheaderHtml = catTxs.length > 0
      ? `<tr class="tx-subhead">
          <td class="tx-date">Fecha</td>
          <td class="tx-merchant">Comercio</td>
          <td class="tx-amount">Monto</td>
          <td colspan="3"></td>
        </tr>${txRowsHtml}`
      : `<tr><td colspan="6" class="tx-empty">Sin transacciones registradas en este período</td></tr>`;

    return `
      <tbody class="cat-group">
        <tr class="cat-row">
          <td colspan="2" class="cat-name">${statusBadge}${esc(s.categoryName)}</td>
          <td class="num">${clp(s.budgeted)}</td>
          <td class="num">${clp(s.spent)}</td>
          <td class="num">${diffCell}</td>
          <td class="num pct ${s.isOverBudget ? 'text-red' : ''}">${s.percentUsed}%</td>
        </tr>
        ${txSubheaderHtml}
      </tbody>`;
  }).join('');

  // ── Charts ────────────────────────────────────────────────────────────────
  const donutHtml = generateDonutChart(summary);
  const barHtml   = generateBarChart(summary);

  // ── Income section ────────────────────────────────────────────────────────
  const incomeTxs = transactions
    .filter((t) => (t as Transaction & { transactionType?: string }).transactionType === 'income' && t.amount > 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const totalIncome = calculateTotalIncome(transactions);
  const savingsRateVal = totalIncome > 0 ? Math.round((1 - totalSpent / totalIncome) * 100) : null;

  const incomeHtml = totalIncome > 0 ? (() => {
    const incomeRowsHtml = incomeTxs.map((t) => {
      const bank = t.bank || null;
      const metaHtml = bank ? `<span class="tx-meta">${esc(bank)}</span>` : '';
      return `
        <tr class="tx-row">
          <td class="tx-date">${fDate(new Date(t.date))}</td>
          <td class="tx-merchant">${esc(t.merchant)}${metaHtml}</td>
          <td class="tx-amount" style="color:#16a34a;font-weight:700;">+${clp(t.amount)}</td>
        </tr>`;
    }).join('');
    const srCard = savingsRateVal !== null
      ? `<div class="metric-card ${savingsRateVal >= 0 ? 'card-green' : 'card-red'}">
          <div class="metric-label">Tasa de ahorro (este mes)</div>
          <div class="metric-value ${savingsRateVal >= 0 ? 'text-green' : 'text-red'}">${savingsRateVal}%</div>
          <div class="metric-desc">De cada $100 que ingresaste este mes, ahorraste $${Math.max(0, savingsRateVal)}. Puede variar por desfase salarial.</div>
        </div>` : '';
    return `
    <div class="section">
      <div class="section-title">Ingresos del mes</div>
      <div class="metrics-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px;">
        <div class="metric-card card-green">
          <div class="metric-label">Total ingresos</div>
          <div class="metric-value text-green">+${clp(totalIncome)}</div>
          <div class="metric-desc">Sueldos y transferencias recibidas registradas este mes</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Total gastos</div>
          <div class="metric-value">${clp(totalSpent)}</div>
          <div class="metric-desc">Solo gastos reales — pagos de tarjeta y traspasos propios no se cuentan</div>
        </div>
        ${srCard}
      </div>
      <table class="cat-table" style="font-size:12px;">
        <thead class="cat-table-head">
          <tr>
            <th style="text-align:left;width:70px">Fecha</th>
            <th style="text-align:left">Descripción</th>
            <th style="text-align:right">Monto</th>
          </tr>
        </thead>
        <tbody>${incomeRowsHtml}</tbody>
      </table>
    </div>`;
  })() : '';

  // ── Internal transfers ────────────────────────────────────────────────────
  const transferTxs = transactions
    .filter((t) => (t as Transaction & { transactionType?: string }).transactionType === 'transfer')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const internalTransfersHtml = transferTxs.length > 0 ? (() => {
    const totalTransfers = transferTxs.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const rowsHtml = transferTxs.map((t) => {
      const bank = t.bank || null;
      const metaHtml = bank ? `<span class="tx-meta">${esc(bank)}</span>` : '';
      return `
        <tr class="tx-row">
          <td class="tx-date">${fDate(new Date(t.date))}</td>
          <td class="tx-merchant">${esc(t.merchant)}${metaHtml}</td>
          <td class="tx-amount" style="color:#9ca3af;">${clp(Math.abs(t.amount))}</td>
        </tr>`;
    }).join('');
    return `
    <div class="section">
      <div class="section-title">Transferencias internas · excluidas del gasto</div>
      <p style="font-size:12px;color:#6b7280;margin-bottom:12px;">
        Pagos de tarjeta de crédito y traspasos entre cuentas propias. <strong>No se incluyen en el total de gastos</strong> porque el gasto real ya está contabilizado en el estado de cuenta de la tarjeta.
        Total movido: <strong>${clp(totalTransfers)}</strong>.
      </p>
      <table class="cat-table" style="font-size:12px;">
        <thead class="cat-table-head">
          <tr>
            <th style="text-align:left;width:70px">Fecha</th>
            <th style="text-align:left">Descripción</th>
            <th style="text-align:right;color:#9ca3af;">Monto</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>`;
  })() : '';

  const generatedDate = new Date().toLocaleDateString('es-CL', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reporte ${esc(formatMonth(month))} — Statement Lens</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; color: #18181b; background: #fff; font-size: 14px; line-height: 1.5; }
    .page { max-width: 860px; margin: 0 auto; padding: 28px 36px 40px; }
    .action-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding: 10px 14px; background: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 8px; }
    .btn { padding: 7px 14px; border-radius: 6px; border: 1px solid #d4d4d8; background: #fff; cursor: pointer; font-size: 13px; font-family: inherit; color: #18181b; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }
    .btn-primary { background: #1e40af; color: #fff; border-color: #1e40af; font-weight: 600; }
    .header { border-bottom: 3px solid #1e40af; padding-bottom: 16px; margin-bottom: 28px; }
    .header-brand { font-size: 10px; font-weight: 700; color: #6b7280; letter-spacing: .1em; text-transform: uppercase; margin-bottom: 5px; }
    .header-title { font-size: 24px; font-weight: 800; color: #0f172a; margin-bottom: 3px; }
    .header-meta { font-size: 12px; color: #6b7280; }
    .header-sub { font-size: 13px; color: #374151; margin-top: 6px; }
    .section { margin-bottom: 28px; }
    .section-title { font-size: 10px; font-weight: 800; color: #6b7280; letter-spacing: .1em; text-transform: uppercase; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #e5e7eb; }
    .metrics-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; }
    .metric-card { padding: 14px 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fafafa; }
    .metric-card.card-red { border-color: #fca5a5; background: #fef2f2; }
    .metric-card.card-green { border-color: #86efac; background: #f0fdf4; }
    .metric-label { font-size: 11px; color: #6b7280; margin-bottom: 5px; font-weight: 500; }
    .metric-value { font-size: 17px; font-weight: 800; color: #0f172a; }
    .metric-desc { font-size: 10px; color: #9ca3af; margin-top: 4px; line-height: 1.4; }
    .cmp-box { border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
    .cmp-row { display: flex; justify-content: space-between; align-items: center; padding: 9px 14px; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
    .cmp-row:last-child { border-bottom: none; }
    .cmp-total { background: #f9fafb; }
    .cmp-name { color: #374151; }
    .cmp-right { display: flex; align-items: center; gap: 10px; }
    .cmp-vals { font-size: 12px; color: #9ca3af; }
    .tag { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 700; }
    .tag-red { background: #fee2e2; color: #991b1b; }
    .tag-green { background: #dcfce7; color: #166534; }
    .tag-neutral { background: #f3f4f6; color: #6b7280; }
    .cat-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .cat-table-head th { font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: .06em; padding: 8px 10px; background: #f4f4f5; border-top: 1px solid #e5e7eb; border-bottom: 2px solid #d1d5db; text-align: right; }
    .cat-table-head th:first-child { text-align: left; }
    .cat-row { background: #f9fafb; }
    .cat-row td { padding: 10px 10px; border-top: 1px solid #d1d5db; font-weight: 600; font-size: 13px; color: #111827; }
    .cat-name { text-align: left !important; }
    .tx-subhead td { font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: .06em; padding: 5px 10px 3px 28px; background: #fafafa; }
    .tx-subhead .tx-amount { text-align: right; padding-right: 10px; }
    .tx-row td { padding: 4px 10px; border-bottom: 1px solid #f3f4f6; }
    .tx-date { padding-left: 28px !important; width: 72px; white-space: nowrap; color: #9ca3af; font-size: 12px; }
    .tx-merchant { color: #374151; font-size: 12px; }
    .tx-meta { display: block; font-size: 10px; color: #9ca3af; margin-top: 1px; font-weight: 500; }
    .tx-amount { text-align: right; white-space: nowrap; font-size: 12px; color: #374151; padding-right: 10px !important; }
    .tx-empty { padding: 8px 10px 8px 28px !important; font-size: 12px; color: #9ca3af; font-style: italic; border-bottom: 1px solid #e5e7eb; }
    .num { text-align: right; color: #374151; }
    .pct { font-size: 12px; color: #6b7280; }
    .badge { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 800; margin-right: 5px; }
    .badge-red { background: #fee2e2; color: #991b1b; }
    .badge-green { background: #dcfce7; color: #166534; }
    .return-badge { display: inline-block; padding: 1px 5px; border-radius: 3px; font-size: 9px; font-weight: 700; background: #dcfce7; color: #166534; margin-left: 5px; vertical-align: middle; }
    .text-red { color: #dc2626; }
    .text-green { color: #16a34a; }
    .report-footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 11px; color: #9ca3af; }
    @media print {
      .action-bar { display: none !important; }
      .page { padding: 0 16px; max-width: 100%; }
      body { font-size: 12px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .metrics-grid { grid-template-columns: repeat(4, 1fr); page-break-inside: avoid; }
      .section-title { page-break-after: avoid; }
      .cat-group { page-break-inside: avoid; }
      .header { page-break-after: avoid; }
    }
  </style>
</head>
<body>
  <div class="page">

    <div class="action-bar">
      <button class="btn" onclick="window.close()">✕ Cerrar pestaña</button>
      <button class="btn btn-primary" onclick="window.print()">🖨&nbsp; Imprimir / Guardar como PDF</button>
    </div>

    <div class="header">
      <div class="header-brand">Statement Lens · Reporte mensual</div>
      <div class="header-title">Reporte — ${esc(formatMonth(month))}</div>
      <div class="header-meta">Generado el ${esc(generatedDate)}</div>
      <div class="header-sub">
        ${overCount > 0
          ? `<span class="text-red" style="font-weight:600">${overCount} categoría${overCount > 1 ? 's' : ''} excedida${overCount > 1 ? 's' : ''}</span>`
          : `<span class="text-green" style="font-weight:600">Todas las categorías dentro del presupuesto</span>`}
        &nbsp;·&nbsp; ${summary.length} categorías analizadas
        ${pendingCount > 0 ? `&nbsp;·&nbsp; <span style="color:#d97706;font-weight:600">⚪ ${pendingCount} transacción${pendingCount !== 1 ? 'es' : ''} sin revisar</span>` : ''}
      </div>
    </div>

    <!-- Resumen general -->
    <div class="section">
      <div class="section-title">Resumen general</div>
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Total gastado</div>
          <div class="metric-value">${clp(totalSpent)}</div>
          <div class="metric-desc">Suma de todos tus gastos reales del mes</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Presupuesto total</div>
          <div class="metric-value">${clp(totalBudget)}</div>
          <div class="metric-desc">Límite de gasto que tú mismo definiste para el mes</div>
        </div>
        <div class="metric-card ${isOver ? 'card-red' : 'card-green'}">
          <div class="metric-label">${isOver ? 'Te pasaste en' : 'Bajo presupuesto'}</div>
          <div class="metric-value ${isOver ? 'text-red' : 'text-green'}">${clp(Math.abs(diff))}</div>
          <div class="metric-desc">${isOver ? 'Gastaste más de lo planeado este mes' : 'Gastaste menos de lo que habías planeado'}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">% del presupuesto usado</div>
          <div class="metric-value ${pct > 100 ? 'text-red' : ''}">${pct}%</div>
          <div class="metric-desc">De cada $100 presupuestados, usaste $${pct > 100 ? '100+' : pct}</div>
        </div>
      </div>
      ${savingsRate6m !== null ? `
      <div style="margin-top:12px;padding:12px 14px;border-radius:8px;background:#f0fdf4;border:1px solid #86efac;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
        <div>
          <div style="font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px;">Tasa de ahorro · promedio de los últimos ${rolling6mMonths} ${rolling6mMonths === 1 ? 'mes' : 'meses'}</div>
          <div style="font-size:11px;color:#4b7c5e;">De cada $100 que ganaste, ahorraste $${Math.max(0, savingsRate6m)} en promedio — más confiable que la tasa mensual porque el sueldo suele llegar un mes y gastarse al siguiente</div>
        </div>
        <span style="font-size:22px;font-weight:800;color:${savingsRate6m >= 0 ? '#166534' : '#dc2626'};flex-shrink:0;">${savingsRate6m}%</span>
      </div>` : ''}
    </div>

    ${incomeHtml}

    <!-- Análisis visual -->
    <div class="section">
      <div class="section-title">Análisis visual</div>
      <div style="display:grid;grid-template-columns:220px 1fr;gap:32px;align-items:start;">
        <div>
          <div style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px;">Distribución del gasto</div>
          ${donutHtml}
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;margin-bottom:14px;">Gastado vs. Presupuesto</div>
          ${barHtml}
        </div>
      </div>
    </div>

    ${comparisonHtml}

    ${generateTrendSection(trend, month)}

    <!-- Desglose por categoría -->
    <div class="section">
      <div class="section-title">Desglose por categoría con transacciones</div>
      <table class="cat-table">
        <thead class="cat-table-head">
          <tr>
            <th colspan="2" style="text-align:left">Categoría</th>
            <th>Presupuesto</th>
            <th>Gastado</th>
            <th>Diferencia</th>
            <th>Uso</th>
          </tr>
        </thead>
        ${categoriesHtml}
      </table>
    </div>

    ${internalTransfersHtml}

    ${generateInstallmentsSection(activeInstallments, totalMonthlyInstallments, totalDebtInstallments)}

    <div class="report-footer">
      <span>Statement Lens</span>
      <span>Generado el ${esc(generatedDate)}</span>
    </div>

  </div>
</body>
</html>`;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response('No autorizado', { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month');
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return new Response('Parámetro month requerido (YYYY-MM)', { status: 400 });
  }

  const [y, m] = month.split('-').map(Number);
  const to = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));

  const [transactions, budgets, categories] = await Promise.all([
    transactionRepo.findByUserId(userId, { accountingMonth: month }),
    budgetRepo.findByUserId(userId, month),
    categoryRepo.findByUserId(userId),
  ]);

  const catNameMap = new Map(categories.map((c) => [c.id, c.name]));
  const spendMap   = netSpendByCategory(transactions);

  const summary: CategorySummary[] = budgets.map((b) => {
    const spent      = spendMap.get(b.categoryId) ?? 0;
    const difference = b.monthlyAmount - spent;
    const isOverBudget = spent > b.monthlyAmount;
    const percentUsed  = b.monthlyAmount > 0 ? Math.round((spent / b.monthlyAmount) * 100) : 0;
    return {
      categoryId:   b.categoryId,
      categoryName: catNameMap.get(b.categoryId) ?? b.categoryId,
      budgeted:     b.monthlyAmount,
      spent,
      difference,
      isOverBudget,
      percentUsed,
    };
  });

  const totalSpent  = summary.reduce((s, c) => s + c.spent, 0);
  const totalBudget = summary.reduce((s, c) => s + c.budgeted, 0);

  // Previous month — for comparison section
  const prevMonth = prevMonthStr(month);
  const [prevTxs, prevBudgets] = await Promise.all([
    transactionRepo.findByUserId(userId, { accountingMonth: prevMonth }),
    budgetRepo.findByUserId(userId, prevMonth),
  ]);
  let prevSnapshot: PrevSnapshot | null = null;
  if (prevTxs.length > 0) {
    const prevSpendMap = netSpendByCategory(prevTxs);
    prevSnapshot = {
      month: prevMonth,
      totalSpent: Array.from(prevSpendMap.values()).reduce((s, v) => s + v, 0),
      summary: prevBudgets.map((b) => ({
        categoryId:   b.categoryId,
        categoryName: catNameMap.get(b.categoryId) ?? b.categoryId,
        spent:        prevSpendMap.get(b.categoryId) ?? 0,
      })),
    };
  }

  // Active installments
  const installmentTxs = await prisma.transaction.findMany({
    where: { userId, isInstallment: true },
    orderBy: [{ date: 'desc' }, { installmentNum: 'desc' }],
  });
  const instMap = new Map<string, typeof installmentTxs[number]>();
  for (const tx of installmentTxs) {
    if (tx.installmentNum === null || tx.installmentTotal === null) continue;
    const key = `${tx.bank}||${tx.installmentTotal}||${Math.round(Math.abs(tx.amount) / 100)}`;
    if (!instMap.has(key)) instMap.set(key, tx);
  }
  const activeInstallments: ActiveInstallment[] = Array.from(instMap.values())
    .filter((tx) => tx.installmentNum! < tx.installmentTotal!)
    .map((tx) => ({
      merchant:        tx.merchant,
      bank:            tx.bank || null,
      amount:          Math.abs(tx.amount),
      installmentNum:  tx.installmentNum!,
      installmentTotal: tx.installmentTotal!,
      remaining:       (tx.installmentTotal! - tx.installmentNum!) * Math.abs(tx.amount),
    }));
  const totalMonthlyInstallments = activeInstallments.reduce((s, i) => s + i.amount, 0);
  const totalDebtInstallments    = activeInstallments.reduce((s, i) => s + i.remaining, 0);

  // 6-month trend + rolling savings rate
  const trendFrom = new Date(Date.UTC(y, m - 7, 1));
  const trendTxs  = await transactionRepo.findByUserId(userId, { from: trendFrom, to });
  const trend     = groupByMonth(trendTxs);

  const rolling6mIncome   = calculateTotalIncome(trendTxs);
  const rolling6mExpenses = calculateTotalExpenses(trendTxs);
  const rolling6mMonths   = trend.length;
  const savingsRate6m: number | null = rolling6mIncome > 0
    ? Math.round((1 - rolling6mExpenses / rolling6mIncome) * 100)
    : null;

  const html = generateReportHtml(
    month, totalSpent, totalBudget, summary,
    transactions, prevSnapshot,
    activeInstallments, totalMonthlyInstallments, totalDebtInstallments,
    trend, savingsRate6m, rolling6mMonths,
  );

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
