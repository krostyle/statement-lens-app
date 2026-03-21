import { anthropicClient } from './anthropic.client';

export interface BudgetClassification {
  categoryId: string;
  bucket: 'needs' | 'wants';
  reason: string;
}

export class BudgetRecommendationService {
  async classify(
    categories: { categoryId: string; name: string; avgSpend: number; currentBudget: number | null; type: 'needs' | 'wants' | null }[],
    monthlyIncome: number | null
  ): Promise<BudgetClassification[]> {
    const input = categories
      .map((c) => `${c.categoryId}|${c.name}|${Math.round(c.avgSpend)}|${c.currentBudget ?? 'null'}|${c.type ?? 'undefined'}`)
      .join('\n');

    const incomeContext = monthlyIncome
      ? `Ingreso mensual: $${monthlyIncome.toLocaleString('es-CL')} CLP. Se aplica regla 50/30/20.`
      : 'Sin ingreso definido. Objetivo: reducir gastos y ahorrar.';

    try {
      const message = await anthropicClient.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: `Eres un asesor financiero experto en finanzas chilenas. ${incomeContext}

Clasifica cada categoría de gasto y escribe una razón breve orientada al ahorro.

Clasificación:
- needs: necesidades básicas (vivienda, alimentación en casa, transporte, salud, educación, servicios básicos)
- wants: gastos discrecionales (restaurantes, entretención, ropa, viajes, suscripciones, tecnología, bar)

Regla importante sobre el campo tipo:
- Si tipo es 'needs' o 'wants': DEBES usar esa clasificación exacta, solo escribe la razón.
- Si tipo es 'undefined': clasifica según el nombre de la categoría y el contexto de gasto.

Responde ÚNICAMENTE con un JSON array. Sin texto previo. Sin markdown. Sin explicaciones.
Ejemplo de formato: [{"categoryId":"abc","bucket":"needs","reason":"texto corto"}]`,
        messages: [
          {
            role: 'user',
            content: `Clasifica estas categorías (id|nombre|gastoMensualPromedio|presupuestoActual|tipo):\n\n${input}`,
          },
        ],
      });

      const content = message.content[0];
      if (content.type !== 'text') throw new Error('Unexpected response type');

      const raw = content.text.trim();
      const start = raw.indexOf('[');
      const end = raw.lastIndexOf(']');

      if (start === -1 || end === -1) {
        console.error('Claude response missing JSON array, using safe fallback. Response:', raw.slice(0, 300));
        return this.fallback(categories);
      }

      const parsed = JSON.parse(raw.slice(start, end + 1)) as BudgetClassification[];

      // Ensure every input category has a classification
      return categories.map((c) => {
        return parsed.find((p) => p.categoryId === c.categoryId) ?? {
          categoryId: c.categoryId,
          bucket: 'wants' as const,
          reason: 'Reducción conservadora para incrementar ahorro mensual.',
        };
      });
    } catch (err) {
      console.error('BudgetRecommendationService.classify failed, using safe fallback:', err);
      return this.fallback(categories);
    }
  }

  private fallback(
    categories: { categoryId: string }[]
  ): BudgetClassification[] {
    return categories.map((c) => ({
      categoryId: c.categoryId,
      bucket: 'wants' as const,
      reason: 'Reducción conservadora para incrementar ahorro mensual.',
    }));
  }
}
