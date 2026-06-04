import { anthropicClient } from './anthropic.client';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface FinancialContext {
  monthlyIncome?: number;
  currentMonth: string;
  spendByCategory: { name: string; total: number; budget?: number }[];
  recentTransactions: { date: string; merchant: string; amount: number; category: string }[];
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
Usa montos en pesos chilenos (CLP). Hoy es: ${ctx.currentMonth}.`;

  if (ctx.monthlyIncome) {
    prompt += `\n\nIngreso mensual del usuario: $${ctx.monthlyIncome.toLocaleString('es-CL')} CLP`;
  }

  if (ctx.spendByCategory.length > 0) {
    prompt += '\n\nGasto por categoría (últimos 6 meses, neto):';
    for (const cat of ctx.spendByCategory) {
      const budgetStr = cat.budget
        ? ` (presupuesto mensual: $${cat.budget.toLocaleString('es-CL')})`
        : '';
      prompt += `\n- ${cat.name}: $${cat.total.toLocaleString('es-CL')}${budgetStr}`;
    }
  }

  if (ctx.recentTransactions.length > 0) {
    prompt += `\n\nÚltimas ${ctx.recentTransactions.length} transacciones de gastos (fecha | comercio | monto | categoría):`;
    for (const tx of ctx.recentTransactions) {
      prompt += `\n- ${tx.date} | ${tx.merchant} | $${tx.amount.toLocaleString('es-CL')} | ${tx.category}`;
    }
  }

  return prompt;
}
