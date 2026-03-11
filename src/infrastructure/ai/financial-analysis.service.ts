import { anthropicClient } from './anthropic.client';
import type { Transaction } from '@/src/domain/entities/transaction';

export interface FinancialAnalysisResult {
  summary: string;
  topOpportunities: { title: string; description: string; estimatedSaving?: number }[];
  unusualSpending: { merchant: string; amount: number; reason: string }[];
  tips: string[];
}

export class FinancialAnalysisService {
  async analyze(
    transactions: Transaction[],
    topCategories: { categoryId: string; name?: string; total: number }[],
    period: string
  ): Promise<FinancialAnalysisResult> {
    const txSummary = transactions
      .filter((t) => t.amount < 0)
      .map((t) => `${t.date.toISOString().slice(0, 10)},${t.merchant},${Math.abs(t.amount)}`)
      .join('\n');

    const catSummary = topCategories
      .map((c) => `${c.name ?? c.categoryId}: ${c.total}`)
      .join(', ');

    const message = await anthropicClient.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: `Eres un asesor financiero personal experto en finanzas chilenas.
Analiza los gastos y devuelve SOLO un JSON compacto sin markdown ni explicaciones con esta estructura exacta:
{"summary":"...","topOpportunities":[{"title":"...","description":"...","estimatedSaving":number}],"unusualSpending":[{"merchant":"...","amount":number,"reason":"..."}],"tips":["..."]}
Responde en español. Sé específico y práctico.`,
      messages: [
        {
          role: 'user',
          content: `Período: ${period}
Top categorías: ${catSummary}

Transacciones (fecha,comercio,monto CLP):
${txSummary}`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response from Claude');

    const raw = content.text.trim();
    const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    return JSON.parse(jsonText) as FinancialAnalysisResult;
  }
}
