import { anthropicClient } from './anthropic.client';

export interface BudgetClassification {
  categoryId: string;
  bucket: 'needs' | 'wants';
  reason: string;
}

export class BudgetRecommendationService {
  async classify(
    categories: {
      categoryId: string;
      name: string;
      avgSpend: number;
      currentBudget: number | null;
      type: 'needs' | 'wants' | null;
      sporadic: boolean;
      activeMonths: number;
    }[],
    monthlyIncome: number | null
  ): Promise<BudgetClassification[]> {
    const input = categories
      .map((c) => {
        const spendInfo = c.sporadic
          ? `gastoProm:${Math.round(c.avgSpend)} (esporádico, solo ${c.activeMonths} de 6 meses activo)`
          : `gastoProm:${Math.round(c.avgSpend)} (${c.activeMonths} de 6 meses activo)`;
        return `${c.categoryId}|${c.name}|${spendInfo}|presupuestoActual:${c.currentBudget ?? 'sin presupuesto'}|tipo:${c.type ?? 'undefined'}`;
      })
      .join('\n');

    const incomeContext = monthlyIncome
      ? `Ingreso mensual: $${monthlyIncome.toLocaleString('es-CL')} CLP. Se aplica regla 50/30/20.`
      : 'Sin ingreso definido. Objetivo: reducir gastos y ahorrar.';

    try {
      const message = await anthropicClient.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: `Eres un asesor financiero experto en finanzas chilenas. ${incomeContext}

Clasifica cada categoría y escribe una razón breve, concreta y orientada al ahorro.

Clasificación:
- needs: necesidades básicas (vivienda, supermercado, transporte, salud, educación, servicios básicos)
- wants: gastos discrecionales (restaurantes, entretención, ropa, viajes, suscripciones, tecnología, bar)

Regla sobre el campo tipo:
- Si tipo es 'needs' o 'wants': usa esa clasificación exacta.
- Si tipo es 'undefined': clasifica por nombre y contexto.

Regla sobre gastos esporádicos:
- Si el gasto es "esporádico" (pocos meses activos): la razón debe aclarar que el monto sugerido ya refleja amortización anual del gasto excepcional, y que en meses normales se puede gastar menos.

Regla sobre gastos altos sin presupuesto previo:
- Menciona el nivel de gasto promedio típico y por qué conviene establecer un límite.

Responde ÚNICAMENTE con un JSON array. Sin texto previo. Sin markdown. Sin explicaciones.
Ejemplo de formato: [{"categoryId":"abc","bucket":"wants","reason":"texto corto específico"}]`,
        messages: [
          {
            role: 'user',
            content: `Clasifica estas categorías:\n\n${input}`,
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
