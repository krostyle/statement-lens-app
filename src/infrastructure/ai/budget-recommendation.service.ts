import { anthropicClient } from './anthropic.client';

export interface BudgetRecommendationItem {
  categoryId: string;
  recommendedAmount: number;
  reason: string;
  trend: 'over' | 'under' | 'none';
}

export class BudgetRecommendationService {
  async recommend(
    categories: { categoryId: string; name: string; avgSpend: number; currentBudget: number | null }[],
    monthlyIncome: number | null
  ): Promise<BudgetRecommendationItem[]> {
    const input = categories
      .map((c) =>
        `${c.categoryId}|${c.name}|${Math.round(c.avgSpend)}|${c.currentBudget ?? 'null'}`
      )
      .join('\n');

    const incomeSection = monthlyIncome
      ? `Ingreso mensual del usuario: $${monthlyIncome.toLocaleString('es-CL')} CLP

Aplica la regla 50/30/20:
- Máximo 50% del ingreso ($${Math.round(monthlyIncome * 0.5).toLocaleString('es-CL')}) para NECESIDADES (alimentación, arriendo, transporte, salud, educación, servicios básicos)
- Máximo 30% del ingreso ($${Math.round(monthlyIncome * 0.3).toLocaleString('es-CL')}) para DESEOS (entretenimiento, restaurantes, ropa, suscripciones, viajes)
- 20% del ingreso ($${Math.round(monthlyIncome * 0.2).toLocaleString('es-CL')}) se reserva para AHORRO — no lo asignes a ninguna categoría
- La suma total de todos los presupuestos recomendados NO debe superar $${Math.round(monthlyIncome * 0.8).toLocaleString('es-CL')} CLP`
      : `No se proporcionó ingreso mensual. Aplica criterios de ahorro conservadores: el objetivo es reducir gastos y no incrementarlos.`;

    const message = await anthropicClient.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: `Eres un asesor financiero personal experto en finanzas chilenas. Tu objetivo principal es ayudar al usuario a AHORRAR e incrementar su capital, no solo a registrar sus gastos actuales.

${incomeSection}

Reglas para calcular recommendedAmount:
- Si el gasto promedio supera el presupuesto actual (sobregastando): recomienda reducir al menos 25% respecto al promedio, máximo hasta el presupuesto actual. trend="over"
- Si el gasto promedio está bajo el presupuesto actual: mantén o reduce hasta 15%. NUNCA subas el presupuesto. trend="under"
- Si no hay presupuesto actual: recomienda el 85% del promedio como techo máximo. trend="none"
- Redondea recommendedAmount a múltiplos de 1.000 CLP
- reason: máximo 80 caracteres, en español, específico (menciona montos o porcentajes concretos)
- Si hay ingreso definido, prioriza cumplir la regla 50/30/20 por sobre las reglas anteriores

Devuelve SOLO un JSON array sin markdown ni texto adicional:
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
