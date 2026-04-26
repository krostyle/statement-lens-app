import { anthropicClient } from './anthropic.client';
import type { CategorySummary } from '@/src/domain/entities/month-close';

const MONTH_NAMES: Record<string, string> = {
  '01': 'enero', '02': 'febrero', '03': 'marzo', '04': 'abril',
  '05': 'mayo', '06': 'junio', '07': 'julio', '08': 'agosto',
  '09': 'septiembre', '10': 'octubre', '11': 'noviembre', '12': 'diciembre',
};

function formatCLP(n: number) {
  return `$${Math.round(n).toLocaleString('es-CL')}`;
}

export class MonthCloseSuggestionsService {
  async generate(
    month: string,
    totalSpent: number,
    totalBudget: number,
    summary: CategorySummary[],
  ): Promise<string> {
    const [year, mm] = month.split('-');
    const monthLabel = `${MONTH_NAMES[mm] ?? mm} ${year}`;
    const pct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
    const overCategories = summary.filter((c) => c.isOverBudget);
    const underCategories = summary.filter((c) => !c.isOverBudget);

    const breakdown = summary
      .sort((a, b) => b.spent - a.spent)
      .map((c) => {
        const status = c.isOverBudget
          ? `excedido en ${formatCLP(Math.abs(c.difference))} (${c.percentUsed}% del presupuesto)`
          : `dentro del presupuesto, ${formatCLP(c.difference)} de margen (${c.percentUsed}% usado)`;
        return `- ${c.categoryName}: gastado ${formatCLP(c.spent)} / presupuesto ${formatCLP(c.budgeted)} → ${status}`;
      })
      .join('\n');

    const message = await anthropicClient.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: `Eres un asesor financiero personal experto en finanzas chilenas.
Analiza el cierre de mes y genera sugerencias específicas, accionables y concretas para mejorar el próximo mes.
Usa viñetas (•). Responde SOLO las sugerencias, sin introducción ni conclusión. En español. Máximo 6 sugerencias.
Sé directo, específico con los montos, y práctico.`,
      messages: [
        {
          role: 'user',
          content: `Cierre del mes de ${monthLabel}:
Total gastado: ${formatCLP(totalSpent)} / Presupuesto total: ${formatCLP(totalBudget)} (${pct}% del presupuesto)
${overCategories.length} categoría(s) excedieron el presupuesto, ${underCategories.length} dentro del presupuesto.

Desglose por categoría:
${breakdown}

Genera sugerencias para mejorar el mes próximo.`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response from Claude');
    return content.text.trim();
  }
}
