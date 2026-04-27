import { auth } from '@clerk/nextjs/server';
import { monthCloseRepo, transactionRepo, budgetRepo, categoryRepo } from '@/src/infrastructure/container';
import { prisma } from '@/src/infrastructure/database/prisma.client';
import { netSpendByCategory } from '@/src/domain/services/transaction.service';
import type { MonthClose, CategorySummary } from '@/src/domain/entities/month-close';
import type { Transaction } from '@/src/domain/entities/transaction';

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

function fDateLong(d: Date): string {
  return d.toLocaleDateString('es-CL', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Converts **bold** markdown to <strong> tags (inline only). */
function mdToHtml(text: string): string {
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => `<p>${esc(line).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')}</p>`)
    .join('');
}

// ─── HTML generator ───────────────────────────────────────────────────────────

function generateReportHtml(
  mc: MonthClose,
  transactions: Transaction[],
  previousClose: MonthClose | null,
  /** statementId → bank name (card label) */
  statementBankMap: Map<string, string>,
): string {
  const diff = mc.totalBudget - mc.totalSpent;
  const isOver = mc.totalSpent > mc.totalBudget;
  const pct = mc.totalBudget > 0 ? Math.round((mc.totalSpent / mc.totalBudget) * 100) : 0;
  const overCount = mc.summary.filter((s) => s.isOverBudget).length;

  // Group transactions by categoryId
  const txByCategory = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (t.amount === 0) continue;
    const arr = txByCategory.get(t.categoryId) ?? [];
    arr.push(t);
    txByCategory.set(t.categoryId, arr);
  }

  // ── Comparison section ───────────────────────────────────────────────────
  let comparisonHtml = '';
  if (previousClose) {
    const spentChange =
      previousClose.totalSpent > 0
        ? ((mc.totalSpent - previousClose.totalSpent) / previousClose.totalSpent) * 100
        : null;

    const categoryChanges = mc.summary
      .map((s) => {
        const prev = previousClose.summary.find((p) => p.categoryId === s.categoryId);
        if (!prev || prev.spent === 0) return null;
        const change = ((s.spent - prev.spent) / prev.spent) * 100;
        return { categoryName: s.categoryName, spent: s.spent, prevSpent: prev.spent, change };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
      .slice(0, 6);

    const changeTag = (change: number) => {
      const cls = change > 2 ? 'tag-red' : change < -2 ? 'tag-green' : 'tag-neutral';
      return `<span class="tag ${cls}">${change > 0 ? '+' : ''}${change.toFixed(1)}%</span>`;
    };

    const catChangesHtml = categoryChanges
      .map(
        (c) => `
      <div class="cmp-row">
        <span class="cmp-name">${esc(c.categoryName)}</span>
        <div class="cmp-right">
          <span class="cmp-vals">${clp(c.prevSpent)} → ${clp(c.spent)}</span>
          ${changeTag(c.change)}
        </div>
      </div>`,
      )
      .join('');

    comparisonHtml = `
    <div class="section">
      <div class="section-title">Comparativa vs. ${esc(formatMonth(previousClose.month))}</div>
      <div class="cmp-box">
        ${
          spentChange !== null
            ? `<div class="cmp-row cmp-total">
            <span class="cmp-name"><strong>Gasto total</strong></span>
            <div class="cmp-right">
              <span class="cmp-vals">${clp(previousClose.totalSpent)} → ${clp(mc.totalSpent)}</span>
              ${changeTag(spentChange)}
            </div>
          </div>`
            : ''
        }
        ${catChangesHtml}
      </div>
    </div>`;
  }

  // ── Categories + transactions ─────────────────────────────────────────────
  const categoriesHtml = mc.summary
    .map((s: CategorySummary) => {
      const catTxs = (txByCategory.get(s.categoryId) ?? []).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );

      const txRowsHtml = catTxs
        .map((t) => {
          const isReturn = t.amount > 0;
          const amountCell = isReturn
            ? `<span class="text-green">-${clp(t.amount)}</span>`
            : clp(Math.abs(t.amount));

          // Bank / card label from the linked statement
          const bank = t.statementId ? (statementBankMap.get(t.statementId) ?? null) : null;

          // Installment label: "Cuota X/Y"
          const installmentLabel =
            t.isInstallment && t.installmentNum && t.installmentTotal
              ? `Cuota ${t.installmentNum}/${t.installmentTotal}`
              : null;

          // Combine into a single meta line, only when there's something to show
          const metaParts = [bank, installmentLabel].filter((x): x is string => !!x);
          const metaHtml = metaParts.length > 0
            ? `<span class="tx-meta">${metaParts.map(esc).join(' · ')}</span>`
            : '';

          const merchantCell = isReturn
            ? `${esc(t.merchant)} <span class="return-badge">devolución</span>${metaHtml}`
            : `${esc(t.merchant)}${metaHtml}`;

          return `
          <tr class="tx-row">
            <td class="tx-date">${fDate(new Date(t.date))}</td>
            <td class="tx-merchant">${merchantCell}</td>
            <td class="tx-amount">${amountCell}</td>
            <td colspan="3"></td>
          </tr>`;
        })
        .join('');

      const diffCell = s.isOverBudget
        ? `<span class="text-red">+${clp(Math.abs(s.difference))}</span>`
        : `<span class="text-green">-${clp(Math.abs(s.difference))}</span>`;

      const statusBadge = s.isOverBudget
        ? `<span class="badge badge-red">Excedido</span>`
        : `<span class="badge badge-green">OK</span>`;

      const txSubheaderHtml =
        catTxs.length > 0
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
    })
    .join('');

  const notesHtml = mc.notes
    ? `<div class="section">
        <div class="section-title">Notas personales</div>
        <div class="notes-box">${esc(mc.notes)}</div>
      </div>`
    : '';

  const generatedDate = new Date().toLocaleDateString('es-CL', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  // ── Full HTML document ────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cierre ${esc(formatMonth(mc.month))} — Statement Lens</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
      color: #18181b; background: #fff; font-size: 14px; line-height: 1.5;
    }
    .page { max-width: 860px; margin: 0 auto; padding: 28px 36px 40px; }

    /* ── Action bar ── */
    .action-bar {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 24px; padding: 10px 14px;
      background: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 8px;
    }
    .btn {
      padding: 7px 14px; border-radius: 6px; border: 1px solid #d4d4d8;
      background: #fff; cursor: pointer; font-size: 13px; font-family: inherit;
      color: #18181b; text-decoration: none; display: inline-flex; align-items: center; gap: 6px;
    }
    .btn-primary { background: #1e40af; color: #fff; border-color: #1e40af; font-weight: 600; }

    /* ── Header ── */
    .header { border-bottom: 3px solid #1e40af; padding-bottom: 16px; margin-bottom: 28px; }
    .header-brand { font-size: 10px; font-weight: 700; color: #6b7280; letter-spacing: .1em; text-transform: uppercase; margin-bottom: 5px; }
    .header-title { font-size: 24px; font-weight: 800; color: #0f172a; margin-bottom: 3px; }
    .header-meta { font-size: 12px; color: #6b7280; }
    .header-sub { font-size: 13px; color: #374151; margin-top: 6px; }

    /* ── Section ── */
    .section { margin-bottom: 28px; }
    .section-title {
      font-size: 10px; font-weight: 800; color: #6b7280; letter-spacing: .1em;
      text-transform: uppercase; margin-bottom: 12px;
      padding-bottom: 6px; border-bottom: 1px solid #e5e7eb;
    }

    /* ── Metrics grid ── */
    .metrics-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; }
    .metric-card { padding: 14px 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fafafa; }
    .metric-card.card-red { border-color: #fca5a5; background: #fef2f2; }
    .metric-card.card-green { border-color: #86efac; background: #f0fdf4; }
    .metric-label { font-size: 11px; color: #6b7280; margin-bottom: 5px; font-weight: 500; }
    .metric-value { font-size: 17px; font-weight: 800; color: #0f172a; }

    /* ── Comparison ── */
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

    /* ── Category table ── */
    .cat-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .cat-table-head th {
      font-size: 10px; font-weight: 700; color: #6b7280;
      text-transform: uppercase; letter-spacing: .06em;
      padding: 8px 10px; background: #f4f4f5;
      border-top: 1px solid #e5e7eb; border-bottom: 2px solid #d1d5db;
      text-align: right;
    }
    .cat-table-head th:first-child { text-align: left; }

    .cat-row { background: #f9fafb; }
    .cat-row td { padding: 10px 10px; border-top: 1px solid #d1d5db; font-weight: 600; font-size: 13px; color: #111827; }
    .cat-name { text-align: left !important; }

    .tx-subhead td {
      font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase;
      letter-spacing: .06em; padding: 5px 10px 3px 28px; background: #fafafa;
    }
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

    .return-badge {
      display: inline-block; padding: 1px 5px; border-radius: 3px;
      font-size: 9px; font-weight: 700; background: #dcfce7; color: #166534;
      margin-left: 5px; vertical-align: middle;
    }

    .text-red { color: #dc2626; }
    .text-green { color: #16a34a; }

    /* ── AI box ── */
    .ai-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 18px; }
    .ai-box p { font-size: 13px; color: #1e3a5f; line-height: 1.8; margin-bottom: 8px; }
    .ai-box p:last-child { margin-bottom: 0; }
    .ai-box strong { color: #1e40af; }

    /* ── Notes ── */
    .notes-box {
      background: #fafafa; border: 1px solid #e5e7eb; border-radius: 8px;
      padding: 16px; font-size: 13px; color: #374151; line-height: 1.8;
      white-space: pre-wrap;
    }

    /* ── Footer ── */
    .report-footer {
      margin-top: 40px; padding-top: 12px; border-top: 1px solid #e5e7eb;
      display: flex; justify-content: space-between;
      font-size: 11px; color: #9ca3af;
    }

    /* ── Print ── */
    @media print {
      .action-bar { display: none !important; }
      .page { padding: 0 16px; max-width: 100%; }
      body { font-size: 12px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .metrics-grid { grid-template-columns: repeat(4, 1fr); }
      .section { page-break-inside: avoid; }
      .cat-group { page-break-inside: avoid; }
      .header { page-break-after: avoid; }
    }
  </style>
</head>
<body>
  <div class="page">

    <!-- Action bar (hidden on print) -->
    <div class="action-bar">
      <button class="btn" onclick="history.back()">← Volver</button>
      <button class="btn btn-primary" onclick="window.print()">🖨&nbsp; Imprimir / Guardar como PDF</button>
    </div>

    <!-- Header -->
    <div class="header">
      <div class="header-brand">Statement Lens · Reporte de cierre</div>
      <div class="header-title">Cierre de mes — ${esc(formatMonth(mc.month))}</div>
      <div class="header-meta">Cerrado el ${esc(fDateLong(new Date(mc.closedAt)))}</div>
      <div class="header-sub">
        ${
          overCount > 0
            ? `<span class="text-red" style="font-weight:600">${overCount} categoría${overCount > 1 ? 's' : ''} excedida${overCount > 1 ? 's' : ''}</span>`
            : `<span class="text-green" style="font-weight:600">Todas las categorías dentro del presupuesto</span>`
        }
        &nbsp;·&nbsp; ${mc.summary.length} categorías analizadas
      </div>
    </div>

    <!-- Key metrics -->
    <div class="section">
      <div class="section-title">Resumen general</div>
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Total gastado</div>
          <div class="metric-value">${clp(mc.totalSpent)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Presupuesto total</div>
          <div class="metric-value">${clp(mc.totalBudget)}</div>
        </div>
        <div class="metric-card ${isOver ? 'card-red' : 'card-green'}">
          <div class="metric-label">${isOver ? 'Excedido en' : 'Ahorrado'}</div>
          <div class="metric-value ${isOver ? 'text-red' : 'text-green'}">${clp(Math.abs(diff))}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">% del presupuesto usado</div>
          <div class="metric-value ${pct > 100 ? 'text-red' : ''}">${pct}%</div>
        </div>
      </div>
    </div>

    ${comparisonHtml}

    <!-- Category breakdown with transactions -->
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

    <!-- AI suggestions -->
    <div class="section">
      <div class="section-title">Sugerencias IA para el próximo mes</div>
      <div class="ai-box">${mdToHtml(mc.aiSuggestions)}</div>
    </div>

    ${notesHtml}

    <div class="report-footer">
      <span>Statement Lens</span>
      <span>Generado el ${esc(generatedDate)}</span>
    </div>

  </div>
</body>
</html>`;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return new Response('No autorizado', { status: 401 });

  const { id } = await params;

  const [mc, allCloses] = await Promise.all([
    monthCloseRepo.findById(id, userId),
    monthCloseRepo.findByUserId(userId),
  ]);

  if (!mc) return new Response('No encontrado', { status: 404 });

  // Date range for the closed month
  const [y, m] = mc.month.split('-').map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));

  // Fetch everything needed in parallel
  const [transactions, budgets, categories] = await Promise.all([
    transactionRepo.findByUserId(userId, { from, to }),
    budgetRepo.findByUserId(userId, mc.month),
    categoryRepo.findByUserId(userId),
  ]);

  // ── Recompute summary from live data ────────────────────────────────────
  // Reflects category re-assignments, edits and new transactions automatically.
  const catNameMap = new Map(categories.map((c) => [c.id, c.name]));
  const spendMap = netSpendByCategory(transactions);

  const liveSummary: CategorySummary[] = budgets.map((b) => {
    const spent = spendMap.get(b.categoryId) ?? 0;
    const difference = b.monthlyAmount - spent;
    const isOverBudget = spent > b.monthlyAmount;
    const percentUsed =
      b.monthlyAmount > 0 ? Math.round((spent / b.monthlyAmount) * 100) : 0;
    return {
      categoryId: b.categoryId,
      categoryName: catNameMap.get(b.categoryId) ?? b.categoryId,
      budgeted: b.monthlyAmount,
      spent,
      difference,
      isOverBudget,
      percentUsed,
    };
  });

  const liveTotalSpent = liveSummary.reduce((sum, s) => sum + s.spent, 0);
  const liveTotalBudget = liveSummary.reduce((sum, s) => sum + s.budgeted, 0);

  // Merge live numbers into mc; keep aiSuggestions, notes, closedAt from snapshot
  const enrichedMc: MonthClose = {
    ...mc,
    summary: liveSummary,
    totalSpent: liveTotalSpent,
    totalBudget: liveTotalBudget,
  };

  // Bank / card name per statementId
  const statementIds = [...new Set(
    transactions.map((t) => t.statementId).filter((sid): sid is string => !!sid),
  )];
  const statements = statementIds.length > 0
    ? await prisma.statement.findMany({
        where: { id: { in: statementIds }, userId },
        select: { id: true, bank: true },
      })
    : [];
  const statementBankMap = new Map(statements.map((s) => [s.id, s.bank]));

  // Previous close (calendar month immediately before)
  const previousClose = allCloses.find((c) => c.month === prevMonthStr(mc.month)) ?? null;

  const html = generateReportHtml(enrichedMc, transactions, previousClose, statementBankMap);

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
