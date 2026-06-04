import { anthropicClient } from './anthropic.client';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface SnapshotCategoryMetric {
  categoryName: string;
  spent: number;
  budget: number | null;
  remaining: number | null;
  pctOfBudget: number | null;
}

export interface CurrentMonthSnapshot {
  totalExpenses: number;
  totalIncome: number;
  daysElapsed: number;
  daysInMonth: number;
  projectedMonthTotal: number;
  byCategory: SnapshotCategoryMetric[];
  recentTransactions: { date: string; merchant: string; amount: number; category: string }[];
}

export interface FinancialContext {
  monthlyIncome?: number;
  currentMonth: string;
  spendByCategory: { name: string; total: number; budget?: number }[];
  recentTransactions: { date: string; merchant: string; amount: number; category: string }[];
  currentMonthSnapshot?: CurrentMonthSnapshot;
}

export class FinancialChatService {
  streamChat(messages: ChatMessage[], context: FinancialContext): ReadableStream<Uint8Array> {
    const systemPrompt = buildSystemPrompt(context);
    const encoder = new TextEncoder();

    const stream = anthropicClient.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    return new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });
  }
}

function buildSystemPrompt(ctx: FinancialContext): string {
  let prompt = `Eres un asesor financiero personal integrado en Statement Lens, app de finanzas personales chilena.
Tienes acceso a los datos financieros reales del usuario. Responde siempre en español, de forma concisa y directa.
Usa montos en pesos chilenos (CLP). Hoy es: ${ctx.currentMonth}.

Cuando el usuario pregunta si PUEDE hacer un gasto (ej: "¿puedo comprar X?", "¿me alcanza para Y?"):
1. Revisa cuánto ha gastado este mes vs su presupuesto por categoría relevante.
2. Revisa el presupuesto restante disponible.
3. Considera la proyección al fin de mes.
4. Da una respuesta directa: SÍ/NO/CON CUIDADO, con el fundamento numérico.`;

  if (ctx.monthlyIncome) {
    prompt += `\n\nIngreso mensual del usuario: $${ctx.monthlyIncome.toLocaleString('es-CL')} CLP`;
  }

  const snap = ctx.currentMonthSnapshot;
  if (snap) {
    const pctMonth = snap.daysInMonth > 0 ? Math.round((snap.daysElapsed / snap.daysInMonth) * 100) : 0;
    prompt += `\n\n## SEGUIMIENTO MES ACTUAL (${ctx.currentMonth})`;
    prompt += `\nDías transcurridos: ${snap.daysElapsed} de ${snap.daysInMonth} (${pctMonth}% del mes)`;
    prompt += `\nGasto real acumulado: $${snap.totalExpenses.toLocaleString('es-CL')} CLP`;
    if (snap.totalIncome > 0) {
      prompt += `\nIngresos registrados este mes: $${snap.totalIncome.toLocaleString('es-CL')} CLP`;
    }
    prompt += `\nProyección al fin de mes: $${snap.projectedMonthTotal.toLocaleString('es-CL')} CLP`;

    if (ctx.monthlyIncome && snap.projectedMonthTotal > 0) {
      const surplus = ctx.monthlyIncome - snap.projectedMonthTotal;
      prompt += `\nSuperávit/déficit proyectado: $${surplus.toLocaleString('es-CL')} CLP`;
    }

    if (snap.byCategory.length > 0) {
      prompt += '\n\nGasto por categoría este mes (gastado / presupuesto → restante):';
      for (const cat of snap.byCategory) {
        if (cat.budget !== null) {
          const pct = cat.pctOfBudget !== null ? ` [${cat.pctOfBudget}% usado]` : '';
          const rem = cat.remaining !== null
            ? (cat.remaining >= 0
                ? ` → $${cat.remaining.toLocaleString('es-CL')} restante`
                : ` → EXCEDIDO por $${Math.abs(cat.remaining).toLocaleString('es-CL')}`)
            : '';
          prompt += `\n- ${cat.categoryName}: $${cat.spent.toLocaleString('es-CL')} / $${cat.budget.toLocaleString('es-CL')}${pct}${rem}`;
        } else {
          prompt += `\n- ${cat.categoryName}: $${cat.spent.toLocaleString('es-CL')} (sin presupuesto)`;
        }
      }
    }

    if (snap.recentTransactions.length > 0) {
      prompt += `\n\nÚltimas transacciones del mes en seguimiento (fecha | comercio | monto | categoría):`;
      for (const tx of snap.recentTransactions) {
        prompt += `\n- ${tx.date} | ${tx.merchant} | $${tx.amount.toLocaleString('es-CL')} | ${tx.category}`;
      }
    }
  }

  if (ctx.spendByCategory.length > 0) {
    prompt += '\n\n## HISTORIAL (últimos 6 meses, gasto neto por categoría):';
    for (const cat of ctx.spendByCategory) {
      const budgetStr = cat.budget
        ? ` (presupuesto mensual: $${cat.budget.toLocaleString('es-CL')})`
        : '';
      prompt += `\n- ${cat.name}: $${cat.total.toLocaleString('es-CL')}${budgetStr}`;
    }
  }

  if (!snap && ctx.recentTransactions.length > 0) {
    prompt += `\n\nÚltimas ${ctx.recentTransactions.length} transacciones de gastos (fecha | comercio | monto | categoría):`;
    for (const tx of ctx.recentTransactions) {
      prompt += `\n- ${tx.date} | ${tx.merchant} | $${tx.amount.toLocaleString('es-CL')} | ${tx.category}`;
    }
  }

  return prompt;
}
