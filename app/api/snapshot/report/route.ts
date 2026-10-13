import { auth } from '@clerk/nextjs/server';
import { transactionRepo, categoryRepo, budgetRepo } from '@/src/infrastructure/container';
import { computeSnapshotMetrics } from '@/src/lib/snapshot-metrics';
import { txToSnapshot } from '@/src/lib/snapshot-utils';
import { getExcludedCategoryIds } from '@/src/domain/services/category.service';
import { groupByMonth, calculateTotalIncome, calculateTotalExpenses } from '@/src/domain/services/transaction.service';
import type { MonthlySpend } from '@/src/domain/services/transaction.service';
import type { SnapshotTransaction } from '@/src/domain/entities/snapshot';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES: Record<string, string> = {
  '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
  '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
  '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre',
};

const BANK_LABELS: Record<string, string> = {
  santander: 'Santander', falabella: 'Falabella',
  bci: 'BCI', bancoestado: 'BancoEstado', liderbci: 'LiderBCI',
};

const SOURCE_LABELS: Record<string, string> = {
  credit_card: 'TC', checking: 'CC', mixed: 'TC+CC',
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
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n);
}

function esc(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function cleanDesc(desc: string): string {
  return desc.replace(/\s*\(\d+\s+cuotas?\s+pendientes\)\s*$/i, '');
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

function donutPath(cx: number, cy: number, outerR: number, innerR: number, startDeg: number, endDeg: number): string {
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

function generateDonutChart(items: { categoryName: string; total: number }[]): string {
  const data = [...items].filter((s) => s.total > 0).sort((a, b) => b.total - a.total);
  if (data.length === 0) return '<p style="font-size:12px;color:#9ca3af;text-align:center;padding:40px 0;">Sin gastos registrados</p>';
  const total = data.reduce((s, c) => s + c.total, 0);
  const cx = 100, cy = 100, outerR = 82, innerR = 52;
  let deg = 0;
  const paths = data.map((s, i) => {
    const sweep = (s.total / total) * 360;
    let pathD: string;
    if (data.length === 1) {
      const top  = polarToCartesian(cx, cy, outerR, 0);
      const bot  = polarToCartesian(cx, cy, outerR, 180);
      const iTop = polarToCartesian(cx, cy, innerR, 0);
      const iBot = polarToCartesian(cx, cy, innerR, 180);
      const f = (n: number) => n.toFixed(2);
      pathD = [`M ${f(top.x)} ${f(top.y)}`, `A ${outerR} ${outerR} 0 1 1 ${f(bot.x)} ${f(bot.y)}`,
        `A ${outerR} ${outerR} 0 1 1 ${f(top.x)} ${f(top.y)}`,
        `M ${f(iTop.x)} ${f(iTop.y)}`, `A ${innerR} ${innerR} 0 1 0 ${f(iBot.x)} ${f(iBot.y)}`,
        `A ${innerR} ${innerR} 0 1 0 ${f(iTop.x)} ${f(iTop.y)}`, 'Z'].join(' ');
    } else {
      pathD = donutPath(cx, cy, outerR, innerR, deg, deg + sweep);
    }
    deg += sweep;
    return `<path d="${pathD}" fill="${CHART_COLORS[i % CHART_COLORS.length]}" stroke="white" stroke-width="2"/>`;
  }).join('');
  const centerLabel = `
    <text x="${cx}" y="${cy - 9}" text-anchor="middle" font-size="9" fill="#6b7280" font-family="system-ui,sans-serif">Gasto total</text>
    <text x="${cx}" y="${cy + 7}" text-anchor="middle" font-size="11.5" font-weight="700" fill="#0f172a" font-family="system-ui,sans-serif">${esc(clp(total))}</text>`;
  const legend = data.slice(0, 10).map((s, i) => {
    const color = CHART_COLORS[i % CHART_COLORS.length];
    const pct = ((s.total / total) * 100).toFixed(0);
    const name = s.categoryName.length > 22 ? `${s.categoryName.slice(0, 20)}…` : s.categoryName;
    return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
      <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${color};flex-shrink:0;"></span>
      <span style="font-size:10.5px;color:#374151;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(name || 'Sin asignar')}</span>
      <span style="font-size:10.5px;font-weight:600;color:#6b7280;flex-shrink:0;">${pct}%</span>
    </div>`;
  }).join('');
  return `<svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">${paths}${centerLabel}</svg>
    <div style="margin-top:10px;">${legend}</div>`;
}

function generateBarChart(items: { categoryName: string; total: number; budget: number | null; pctOfBudget: number | null }[]): string {
  const data = items.filter((c) => c.budget !== null).sort((a, b) => b.total - a.total);
  if (data.length === 0) return '<p style="font-size:12px;color:#9ca3af;">Sin presupuesto configurado para este mes.</p>';
  const maxVal = Math.max(...data.flatMap((c) => [c.budget ?? 0, c.total]));
  const legend = `<div style="display:flex;flex-wrap:wrap;gap:14px;margin-bottom:14px;font-size:10px;color:#6b7280;">
    <span style="display:flex;align-items:center;gap:5px;"><span style="display:inline-block;width:12px;height:10px;border-radius:2px;background:#e5e7eb;"></span>Presupuesto</span>
    <span style="display:flex;align-items:center;gap:5px;"><span style="display:inline-block;width:12px;height:10px;border-radius:2px;background:#3b82f6;"></span>Gastado (dentro)</span>
    <span style="display:flex;align-items:center;gap:5px;"><span style="display:inline-block;width:12px;height:10px;border-radius:2px;background:#f97316;"></span>Gastado (excedida)</span>
    <span style="display:flex;align-items:center;gap:5px;"><span style="display:inline-block;width:12px;height:10px;border-radius:2px;background:#ef4444;"></span>Excedente</span>
  </div>`;
  const bars = data.map((c) => {
    const budget = c.budget ?? 0;
    const isOver = c.total > budget;
    const budgetPct = maxVal > 0 ? (budget / maxVal) * 100 : 0;
    const withinPct = maxVal > 0 ? (Math.min(c.total, budget) / maxVal) * 100 : 0;
    const overflowPct = isOver && maxVal > 0 ? ((Math.min(c.total, maxVal) - budget) / maxVal) * 100 : 0;
    const spentColor = isOver ? '#f97316' : '#3b82f6';
    const name = c.categoryName.length > 20 ? `${c.categoryName.slice(0, 18)}…` : c.categoryName;
    const pct = c.pctOfBudget ?? 0;
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px;">
      <div style="width:115px;text-align:right;font-size:11px;color:#374151;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${esc(c.categoryName)}">${esc(name || 'Sin asignar')}</div>
      <div style="flex:1;position:relative;height:16px;border-radius:3px;background:#f3f4f6;min-width:0;">
        <div style="position:absolute;inset:0;width:${budgetPct.toFixed(1)}%;background:#e5e7eb;border-radius:3px;"></div>
        <div style="position:absolute;inset:0;width:${withinPct.toFixed(1)}%;background:${spentColor};border-radius:3px;"></div>
        ${isOver ? `<div style="position:absolute;top:0;bottom:0;left:${budgetPct.toFixed(1)}%;width:${overflowPct.toFixed(1)}%;background:#ef4444;border-radius:0 3px 3px 0;"></div>` : ''}
      </div>
      <div style="width:125px;flex-shrink:0;line-height:1.3;">
        <div style="font-size:11px;font-weight:${isOver ? '700' : '500'};color:${isOver ? '#dc2626' : '#18181b'};">${esc(clp(c.total))}</div>
        <div style="font-size:9.5px;color:#9ca3af;">${pct}% de ${esc(clp(budget))}</div>
      </div>
    </div>`;
  }).join('');
  return `<div style="padding-top:2px;">${legend}${bars}</div>`;
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

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month');
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return new Response('Missing or invalid month parameter', { status: 400 });
  }

  const [txs, categories, budgets] = await Promise.all([
    transactionRepo.findTrackingByMonth(userId, month),
    categoryRepo.findByUserId(userId),
    budgetRepo.findByUserId(userId, month),
  ]);

  if (txs.length === 0) return new Response('No tracking data for this month', { status: 404 });

  const categoryNameMap   = new Map(categories.map((c) => [c.id, c.name]));
  const excludedCategoryIds = getExcludedCategoryIds(categories);
  const allTxs: SnapshotTransaction[] = txs.map((tx) => txToSnapshot(tx, categoryNameMap));
  const budgetsByCategory = new Map(budgets.map((b) => [b.categoryId, b.monthlyAmount]));

  const metrics = computeSnapshotMetrics(allTxs, budgetsByCategory, month, excludedCategoryIds);
  // Excluded categories' budgets are left out too, so budgetPct stays comparable to totalExpenses.
  const totalBudget = budgets
    .filter((b) => !excludedCategoryIds.has(b.categoryId))
    .reduce((s, b) => s + b.monthlyAmount, 0);

  const income    = allTxs.filter((t) => t.transactionType === 'income'  && t.amount > 0);
  const transfers = allTxs.filter((t) => t.transactionType === 'transfer');

  const budgetPct   = totalBudget > 0 ? Math.round((metrics.totalExpenses / totalBudget) * 100) : null;
  const monthPct    = Math.min(Math.round((metrics.daysElapsed / metrics.daysInMonth) * 100), 100);
  const generatedAt = new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });

  // ── Comparison vs. previous month ────────────────────────────────────────────
  const prevMonth = prevMonthStr(month);
  const prevTxs = await transactionRepo.findTrackingByMonth(userId, prevMonth);
  let comparisonHtml = '';
  if (prevTxs.length > 0) {
    const prevAllTxs = prevTxs.map((tx) => txToSnapshot(tx, categoryNameMap));
    const prevMetrics = computeSnapshotMetrics(prevAllTxs, new Map(), prevMonth, excludedCategoryIds);
    if (prevMetrics.totalExpenses > 0) {
      const spentChange = ((metrics.totalExpenses - prevMetrics.totalExpenses) / prevMetrics.totalExpenses) * 100;

      const changeTag = (change: number) => {
        const cls = change > 2 ? 'tag-red' : change < -2 ? 'tag-green' : 'tag-neutral';
        return `<span class="tag ${cls}">${change > 0 ? '+' : ''}${change.toFixed(1)}%</span>`;
      };

      const categoryChanges = metrics.byCategory
        .map((c) => {
          const prev = prevMetrics.byCategory.find((p) => p.categoryId === c.categoryId);
          if (!prev || prev.total === 0) return null;
          const change = ((c.total - prev.total) / prev.total) * 100;
          return { categoryName: c.categoryName, total: c.total, prevTotal: prev.total, change };
        })
        .filter((c): c is NonNullable<typeof c> => c !== null)
        .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
        .slice(0, 6);

      const catChangesHtml = categoryChanges.map((c) => `
        <div class="cmp-row">
          <span class="cmp-name">${esc(c.categoryName || 'Sin asignar')}</span>
          <div class="cmp-right">
            <span class="cmp-vals">${clp(c.prevTotal)} → ${clp(c.total)}</span>
            ${changeTag(c.change)}
          </div>
        </div>`).join('');

      comparisonHtml = `
      <div class="section">
        <div class="section-title">Comparativa vs. ${esc(formatMonth(prevMonth))}</div>
        <div class="cmp-box">
          <div class="cmp-row cmp-total">
            <span class="cmp-name"><strong>Gasto total</strong></span>
            <div class="cmp-right">
              <span class="cmp-vals">${clp(prevMetrics.totalExpenses)} → ${clp(metrics.totalExpenses)}</span>
              ${changeTag(spentChange)}
            </div>
          </div>
          ${catChangesHtml}
        </div>
      </div>`;
    }
  }

  // ── 6-month trend + rolling savings rate ─────────────────────────────────────
  const [trendY, trendM] = month.split('-').map(Number);
  const trendFrom = new Date(Date.UTC(trendY, trendM - 7, 1));
  const trendTo   = new Date(Date.UTC(trendY, trendM, 0, 23, 59, 59, 999));
  const trendTxs  = await transactionRepo.findByUserId(userId, { origin: 'tracking', from: trendFrom, to: trendTo });
  const trend     = groupByMonth(trendTxs, excludedCategoryIds);

  const rolling6mIncome   = calculateTotalIncome(trendTxs);
  const rolling6mExpenses = calculateTotalExpenses(trendTxs, excludedCategoryIds);
  const rolling6mMonths   = trend.length;
  const savingsRate6m: number | null = rolling6mIncome > 0
    ? Math.round((1 - rolling6mExpenses / rolling6mIncome) * 100)
    : null;

  // ── Donut + bar charts ────────────────────────────────────────────────────────
  // Excluded categories (fully reimbursed) stay in the per-category detail section below for
  // full visibility, but are left out of these "your real spending" charts to match the headline totals.
  const chartCategories = metrics.byCategory.filter((c) => !excludedCategoryIds.has(c.categoryId));
  const donutHtml = generateDonutChart(chartCategories);
  const barHtml = generateBarChart(chartCategories);

  // ── Budget bar ───────────────────────────────────────────────────────────────
  const budgetBarHtml = budgetPct !== null ? (() => {
    const color = budgetPct > 100 ? '#ef4444' : budgetPct > 80 ? '#f97316' : '#3b82f6';
    const capped = Math.min(budgetPct, 100);
    return `
    <div class="section">
      <div class="section-title">Presupuesto total</div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
        <span style="font-size:13px;color:#374151;">
          <strong>${esc(clp(metrics.totalExpenses))}</strong>
          <span style="color:#9ca3af;font-size:11px;margin-left:4px;">de ${esc(clp(totalBudget))} presupuestado</span>
        </span>
        <span style="font-size:16px;font-weight:800;color:${color};">${budgetPct}%</span>
      </div>
      <div style="height:10px;border-radius:5px;background:#f3f4f6;overflow:hidden;">
        <div style="height:100%;width:${capped}%;background:${color};border-radius:5px;transition:width .3s;"></div>
      </div>
    </div>`;
  })() : '';

  // ── Income section ───────────────────────────────────────────────────────────
  const incomeHtml = income.length > 0 ? (() => {
    const savingsRate = metrics.totalIncome > 0
      ? Math.round((1 - metrics.totalExpenses / metrics.totalIncome) * 100) : null;
    const rows = [...income].sort((a, b) => a.date.localeCompare(b.date)).map((t) => {
      const bankLabel = BANK_LABELS[t.bank ?? ''] ?? t.bank ?? '';
      return `<tr class="tx-row">
        <td class="tx-date">${t.date.slice(5).replace('-', '/')}</td>
        <td class="tx-merchant">${esc(cleanDesc(t.description))}<span class="tx-meta">${esc(bankLabel)} · ${SOURCE_LABELS[t.source] ?? t.source}</span></td>
        <td class="tx-amount" style="color:#16a34a;font-weight:700;">+${esc(clp(t.amount))}</td>
      </tr>`;
    }).join('');
    return `
    <div class="section">
      <div class="section-title">Ingresos del mes</div>
      <div class="metrics-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px;">
        <div class="metric-card card-green">
          <div class="metric-label">Total ingresos</div>
          <div class="metric-value text-green">+${esc(clp(metrics.totalIncome))}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Total gastos</div>
          <div class="metric-value">${esc(clp(metrics.totalExpenses))}</div>
        </div>
        ${savingsRate !== null ? `<div class="metric-card ${savingsRate >= 0 ? 'card-green' : 'card-red'}">
          <div class="metric-label">Tasa de ahorro</div>
          <div class="metric-value ${savingsRate >= 0 ? 'text-green' : 'text-red'}">${savingsRate}%</div>
        </div>` : ''}
      </div>
      <table class="cat-table" style="font-size:12px;">
        <thead class="cat-table-head">
          <tr>
            <th style="text-align:left;width:60px">Fecha</th>
            <th style="text-align:left">Descripción</th>
            <th style="text-align:right">Monto</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  })() : '';

  // ── Merchant table ───────────────────────────────────────────────────────────
  const merchantRows = metrics.byMerchant.map((m) => {
    const banks = m.banks.map((b) => BANK_LABELS[b] ?? b).join(', ');
    const name = m.merchant.length > 30 ? `${m.merchant.slice(0, 28)}…` : m.merchant;
    return `<tr class="tx-row">
      <td style="padding:6px 10px;font-size:12px;color:#374151;">${esc(name)}</td>
      <td style="padding:6px 10px;font-size:11px;color:#6b7280;text-align:center;">${esc(banks)}</td>
      <td style="padding:6px 10px;font-size:11px;color:#6b7280;text-align:center;">${esc(SOURCE_LABELS[m.source] ?? m.source)}</td>
      <td style="padding:6px 10px;font-size:12px;color:#374151;">${esc(m.categoryName || 'Sin asignar')}</td>
      <td style="padding:6px 10px;font-size:12px;color:#6b7280;text-align:center;">${m.count}</td>
      <td style="padding:6px 10px;font-size:12px;font-weight:600;color:#18181b;text-align:right;">${esc(clp(m.total))}</td>
    </tr>`;
  }).join('');

  const merchantHtml = metrics.byMerchant.length > 0 ? `
  <div class="section">
    <div class="section-title">Por comercio</div>
    <table class="cat-table" style="font-size:12px;">
      <thead class="cat-table-head">
        <tr>
          <th style="text-align:left;">Comercio</th>
          <th style="text-align:center;">Banco</th>
          <th style="text-align:center;">Fuente</th>
          <th style="text-align:left;">Categoría</th>
          <th style="text-align:center;">Nº</th>
          <th style="text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>${merchantRows}</tbody>
    </table>
  </div>` : '';

  // ── Category detail ──────────────────────────────────────────────────────────
  // One flat table, one header — transaction-level detail lives in "Por comercio" below,
  // so this table stays scannable even with a long list of categories.
  const categoriesHtml = metrics.byCategory.map((cat) => {
    const budgeted = cat.budget ?? 0;
    const isOver = budgeted > 0 && cat.total > budgeted;
    const statusBadge = budgeted > 0
      ? (isOver ? `<span class="badge badge-red">Excedido</span>` : `<span class="badge badge-green">OK</span>`)
      : '';
    return `<tr class="cat-row">
      <td class="cat-name">${statusBadge}${esc(cat.categoryName || 'Sin asignar')}</td>
      <td class="num">${budgeted > 0 ? esc(clp(budgeted)) : '—'}</td>
      <td class="num">${esc(clp(cat.total))}</td>
      <td class="num">${cat.pctOfTotal}%</td>
      <td class="num ${isOver ? 'text-red' : ''}">${cat.pctOfBudget !== null ? `${cat.pctOfBudget}%` : '—'}</td>
    </tr>`;
  }).join('');

  // ── Transfers section ────────────────────────────────────────────────────────
  const transfersHtml = transfers.length > 0 ? (() => {
    const totalMoved = transfers.reduce((s, t) => s + Math.abs(t.amount), 0);
    const rows = [...transfers].sort((a, b) => a.date.localeCompare(b.date)).map((t) => {
      const bankLabel = BANK_LABELS[t.bank ?? ''] ?? t.bank ?? '';
      return `<tr class="tx-row">
        <td class="tx-date">${t.date.slice(5).replace('-', '/')}</td>
        <td class="tx-merchant">${esc(cleanDesc(t.description))}<span class="tx-meta">${esc(bankLabel)} · ${SOURCE_LABELS[t.source] ?? t.source}</span></td>
        <td class="tx-amount" style="color:#9ca3af;">${esc(clp(Math.abs(t.amount)))}</td>
      </tr>`;
    }).join('');
    return `
    <div class="section">
      <div class="section-title">Transferencias internas · excluidas del gasto</div>
      <p style="font-size:12px;color:#6b7280;margin-bottom:12px;">
        Pagos de tarjeta y traspasos entre cuentas propias. No se incluyen en el total de gastos.
        Total movido: <strong>${esc(clp(totalMoved))}</strong>.
      </p>
      <table class="cat-table" style="font-size:12px;">
        <thead class="cat-table-head">
          <tr>
            <th style="text-align:left;width:60px">Fecha</th>
            <th style="text-align:left">Descripción</th>
            <th style="text-align:right;color:#9ca3af;">Monto</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  })() : '';

  // ── HTML ─────────────────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mes contable ${esc(formatMonth(month))} — Statement Lens</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; color: #18181b; background: #fff; font-size: 14px; line-height: 1.5; font-variant-numeric: tabular-nums; }
    .page { max-width: 860px; margin: 0 auto; padding: 28px 36px 40px; }
    .action-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding: 10px 14px; background: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 8px; }
    .btn { padding: 7px 14px; border-radius: 6px; border: 1px solid #d4d4d8; background: #fff; cursor: pointer; font-size: 13px; font-family: inherit; color: #18181b; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }
    .btn-primary { background: #1e40af; color: #fff; border-color: #1e40af; font-weight: 600; }
    .header { border-bottom: 3px solid #1e40af; padding-bottom: 16px; margin-bottom: 28px; }
    .header-brand { font-size: 10px; font-weight: 700; color: #6b7280; letter-spacing: .1em; text-transform: uppercase; margin-bottom: 5px; }
    .header-title { font-size: 24px; font-weight: 800; color: #0f172a; margin-bottom: 3px; }
    .header-meta { font-size: 12px; color: #6b7280; }
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
    .cat-row td { padding: 10px; border-top: 1px solid #e5e7eb; font-size: 13px; color: #111827; }
    .cat-row:nth-child(even) { background: #fafafa; }
    .cat-name { text-align: left !important; font-weight: 600; }
    .tx-row td { padding: 4px 10px; border-bottom: 1px solid #f3f4f6; }
    .tx-date { padding-left: 28px !important; width: 60px; white-space: nowrap; color: #9ca3af; font-size: 12px; }
    .tx-merchant { color: #374151; font-size: 12px; }
    .tx-meta { display: block; font-size: 10px; color: #9ca3af; margin-top: 1px; font-weight: 500; }
    .tx-amount { text-align: right; white-space: nowrap; font-size: 12px; color: #374151; padding-right: 10px !important; }
    .num { text-align: right; color: #374151; }
    .pct { font-size: 12px; color: #6b7280; }
    .badge { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 800; margin-right: 5px; }
    .badge-red { background: #fee2e2; color: #991b1b; }
    .badge-green { background: #dcfce7; color: #166534; }
    .text-red { color: #dc2626; }
    .text-green { color: #16a34a; }
    .report-footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 11px; color: #9ca3af; }
    @media print {
      .action-bar { display: none !important; }
      .page { padding: 0 16px; max-width: 100%; }
      body { font-size: 12px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .metrics-grid { grid-template-columns: repeat(4, 1fr); page-break-inside: avoid; }
      .cat-row { page-break-inside: avoid; }
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
      <div class="header-brand">Statement Lens · Reporte de mes contable</div>
      <div class="header-title">Mes contable — ${esc(formatMonth(month))}</div>
      <div class="header-meta">Generado el ${esc(generatedAt)} · Día ${metrics.daysElapsed} de ${metrics.daysInMonth} (${monthPct}% del mes)</div>
    </div>

    <!-- Resumen -->
    <div class="section">
      <div class="section-title">Resumen</div>
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Total gastado</div>
          <div class="metric-value">${esc(clp(metrics.totalExpenses))}</div>
          <div class="metric-desc">Gastos reales del mes (sin transferencias internas)</div>
        </div>
        <div class="metric-card card-green">
          <div class="metric-label">Ingresos</div>
          <div class="metric-value text-green">+${esc(clp(metrics.totalIncome))}</div>
          <div class="metric-desc">Sueldos y abonos recibidos</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Promedio diario</div>
          <div class="metric-value">${esc(clp(metrics.dailyAverage))}</div>
          <div class="metric-desc">Gasto por día transcurrido</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Proyección</div>
          <div class="metric-value">${esc(clp(metrics.projectedMonthTotal))}</div>
          <div class="metric-desc">Estimado al cierre del mes</div>
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

    ${budgetBarHtml}
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

    ${merchantHtml}

    <!-- Detalle por categoría -->
    <div class="section">
      <div class="section-title">Detalle por categoría</div>
      <table class="cat-table">
        <thead class="cat-table-head">
          <tr>
            <th style="text-align:left;">Categoría</th>
            <th>Presupuesto</th>
            <th>Gastado</th>
            <th>% del gasto</th>
            <th>% presup.</th>
          </tr>
        </thead>
        <tbody>${categoriesHtml}</tbody>
      </table>
    </div>

    ${transfersHtml}

    <div class="report-footer">
      <span>Statement Lens · Reporte de seguimiento</span>
      <span>${esc(formatMonth(month))} · ${esc(generatedAt)}</span>
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
