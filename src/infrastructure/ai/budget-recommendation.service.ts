import { anthropicClient } from './anthropic.client';

export interface BudgetClassification {
  categoryId: string;
  bucket: 'needs' | 'wants';
  reason: string;
}

export class BudgetRecommendationService {
  async classify(
    categories: { categoryId: string; name: string; avgSpend: number; currentBudget: number | null }[],
    monthlyIncome: number | null
  ): Promise<BudgetClassification[]> {
    const input = categories
      .map((c) => `${c.categoryId}|${c.name}|${Math.round(c.avgSpend)}|${c.currentBudget ?? 'null'}`)
      .join('\n');

    const incomeContext = monthlyIncome
      ? `El ingreso mensual del usuario es $${monthlyIncome.toLocaleString('es-CL')} CLP. Se aplicará la regla 50/30/20: máx 50% para necesidades y máx 30% para deseos.`
      : 'No hay ingreso definido. El objetivo es reducir gastos y ahorrar.';

    const message = await anthropicClient.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: `Eres un asesor financiero experto en finanzas chilenas. Tu tarea es clasificar categorías de gasto y explicar brevemente la recomendación.

${incomeContext}

Clasificación:
- "needs": necesidades básicas (alimentación en casa, arriendo, transporte, salud, educación, servicios básicos, farmacia)
- "wants": deseos y gastos discrecionales (restaurantes, entretención, ropa, viajes, suscripciones, tecnología, bar)

Devuelve SOLO un JSON array sin markdown:
[{"categoryId":"...","bucket":"needs"|"wants","reason":"..."}]

reason: máximo 80 caracteres, en español, menciona el objetivo de ahorro concreto.`,
      messages: [
        {
          role: 'user',
          content: `Formato: categoryId|nombre|avgSpendMensual|presupuestoActual\n\n${input}`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response from Claude');

    const raw = content.text.trim();
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start === -1 || end === -1) throw new Error('No JSON array found in Claude response');
    return JSON.parse(raw.slice(start, end + 1)) as BudgetClassification[];
  }
}
