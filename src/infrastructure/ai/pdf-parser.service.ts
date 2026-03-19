import { anthropicClient } from './anthropic.client';

export interface ParsedTransaction {
  date: string;
  description: string;
  merchant: string;
  amount: number;
  currency: string;
  isInstallment: boolean;
  installmentNum: number | null;
  installmentTotal: number | null;
  suggestedCategory: string;
}

export class PdfParserService {
  async extractText(buffer: Buffer): Promise<string> {
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    return data.text;
  }

  async parseTransactions(
    rawText: string,
    bank: string,
    categories: string[]
  ): Promise<ParsedTransaction[]> {
    const categoriesList = categories.join(', ');

    const message = await anthropicClient.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      system: `You are a parser for Chilean credit card statements.
Extract ALL transactions and return ONLY a valid compact JSON array (no whitespace, no explanation, no markdown).
Each item: {"date":"ISO date","description":"raw text","merchant":"clean name","amount":number,"currency":"CLP","isInstallment":bool,"installmentNum":number|null,"installmentTotal":number|null,"suggestedCategory":"category"}
amount: negative=expense, positive=credit/payment.
CRITICAL for installments: amount must be the monthly installment amount (cuota del mes), NOT the total purchase price. When the statement shows a "Valor cuota" or "Cuota mensual" field, use that value. Example: "Cuota 3/12 - Valor cuota $50.000 - Total $600.000" → amount=-50000, installmentNum=3, installmentTotal=12. Never use the total accumulated amount for installment transactions.`,
      messages: [
        {
          role: 'user',
          content: `Bank: ${bank}\nCategories: ${categoriesList}\n\nStatement text:\n${rawText}`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response from Claude');

    const raw = content.text.trim();
    // Strip markdown code fences if Claude wraps the response (```json ... ```)
    const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    return JSON.parse(jsonText) as ParsedTransaction[];
  }
}
