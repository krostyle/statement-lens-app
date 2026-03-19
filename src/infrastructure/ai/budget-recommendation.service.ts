import { anthropicClient } from './anthropic.client';

export interface BudgetRecommendationItem {
  categoryId: string;
  recommendedAmount: number;
  reason: string;
  trend: 'over' | 'under' | 'none';
}

export class BudgetRecommendationService {
  async recommend(
    categories: { categoryId: string; name: string; avgSpend: number; currentBudget: number | null }[]
  ): Promise<BudgetRecommendationItem[]> {
    const input = categories
      .map((c) =>
        `${c.categoryId}|${c.name}|${Math.round(c.avgSpend)}|${c.currentBudget ?? 'null'}`
      )
      .join('\n');

    const message = await anthropicClient.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: `Eres un asesor financiero personal experto en finanzas chilenas.
Recibes categorías de gastos con su promedio mensual y presupuesto actual.
Devuelve SOLO un JSON array sin markdown ni texto adicional.

Reglas:
- Sobregastando (avgSpend > currentBudget): recomienda reducción gradual, máximo 20% bajo el promedio. trend="over"
- Bajo presupuesto (avgSpend < currentBudget): mantiene o reduce hasta 10%. trend="under"
- Sin presupuesto (currentBudget=null): sugiere 110% del promedio como punto de partida. trend="none"
- Redondea recommendedAmount a múltiplos de 1.000 CLP
- reason: máximo 80 caracteres, en español, específico y práctico

Formato de salida:
[{"categoryId":"...","recommendedAmount":number,"reason":"...","trend":"over"|"under"|"none"}]`,
      messages: [
        {
          role: 'user',
          content: `Formato de entrada: categoryId|nombre|avgSpendMensual|presupuestoActual

${input}`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response from Claude');

    const raw = content.text.trim();
    const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    return JSON.parse(jsonText) as BudgetRecommendationItem[];
  }
}
