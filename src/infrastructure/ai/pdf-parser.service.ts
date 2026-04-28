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
  transactionType: 'expense' | 'income';
}

// ─── Credit-card bank hints ────────────────────────────────────────────────────

function getCreditCardBankHints(bank: string): string {
  if (bank === 'santander') {
    return `\nSantander-specific rules:
- The section "INFORMACION COMPRAS EN CUOTAS EN EL PERIODO" lists purchases that *started* this month as informational entries with installmentNum=00 (e.g. "00/03"). These are NOT real charges — the first actual charge appears as cuota 01/03 in the next statement. SKIP all rows where the installment number is 00.`;
  }
  if (bank === 'liderbci') {
    return `\nLiderBCI-specific rules:
- Installment rows show 4 monetary values: [Monto Operación] [Monto Total] [NN/TT] [Valor Cuota Mensual]. Use ONLY the last value (Valor Cuota Mensual) as the amount. Example: "$ 399.990 $ 486.480 02/12 $ 40.540" → amount=-40540, installmentNum=2, installmentTotal=12.
- GLASS LIDER.CL entries are cashback/discount credits → amount must be POSITIVE (already shown as negative in the statement text).
- PAGO entries are payments → amount must be POSITIVE.
- Skip summary/totals lines (lines that only contain a subtotal like "$ 1.091.960" with no date or description).`;
  }
  return '';
}

// ─── Checking-account bank hints ──────────────────────────────────────────────

function getCheckingBankHints(bank: string): string {
  if (bank === 'santander') {
    return `\nSantander cuenta corriente rules:
- Rows prefixed "ABN" or "ABONO" are credits (income or returns) → positive amount.
- Rows prefixed "CRG" or "CARGO" are debits → negative amount.
- Rows prefixed "TRF" or "TRANSFERENCIA" sent to another account → negative amount (expense).
- Rows prefixed "TRF" or "TRANSFERENCIA" received from another account → positive amount (income if it appears to be salary or a transfer in).
- "COM" or "COMISION" rows are bank fees → negative amount, category "Comisiones".`;
  }
  if (bank === 'falabella') {
    return `\nFalabella cuenta corriente rules:
- "Abono" column values → positive amounts.
- "Cargo" column values → negative amounts.
- Transfers to Falabella credit card → negative, category "Pago Tarjeta Crédito".
- Salary / payroll deposits → positive, transactionType "income", category "Ingresos".`;
  }
  if (bank === 'bci') {
    return `\nBCI cuenta corriente rules:
- "Abono" (credit) column → positive amount.
- "Cargo" (debit) column → negative amount.
- Loan payments (cuota crédito) → negative, category "Pago Crédito".
- BCI credit card payments → negative, category "Pago Tarjeta Crédito".`;
  }
  if (bank === 'bancoestado') {
    return `\nBancoEstado / Cuenta RUT rules:
- "Abono" column → positive amount.
- "Cargo" column → negative amount.
- Bip!/metro recharges ("RECARGA BIP", "METRO") → negative, category "Transporte".
- Salary transfers → positive, transactionType "income", category "Ingresos".
- Comisiones / mantención → negative, category "Comisiones".`;
  }
  return '';
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
    categories: string[],
    statementType: 'credit_card' | 'checking' = 'credit_card',
  ): Promise<ParsedTransaction[]> {
    const categoriesList = categories.join(', ');

    const systemPrompt =
      statementType === 'checking'
        ? this.buildCheckingPrompt(bank)
        : this.buildCreditCardPrompt(bank);

    const message = await anthropicClient.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      system: systemPrompt,
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
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start === -1 || end === -1) {
      throw new Error(`Claude response missing JSON array. Response preview: ${raw.slice(0, 200)}`);
    }
    const parsed = JSON.parse(raw.slice(start, end + 1)) as ParsedTransaction[];

    // Ensure transactionType always has a valid value (defensive)
    return parsed.map((t) => ({
      ...t,
      transactionType: t.transactionType === 'income' ? 'income' : 'expense',
    }));
  }

  private buildCreditCardPrompt(bank: string): string {
    return `You are a parser for Chilean credit card statements.
Extract ALL transactions and return ONLY a valid compact JSON array (no whitespace, no explanation, no markdown).
Each item: {"date":"ISO date","description":"raw text","merchant":"clean name","amount":number,"currency":"CLP","isInstallment":bool,"installmentNum":number|null,"installmentTotal":number|null,"suggestedCategory":"category","transactionType":"expense"}
amount: negative=expense, positive=credit/return/payment (devolución).
transactionType: always "expense" for credit card statements (returns are positive-amount expenses).
CRITICAL for installments: amount must be the monthly installment amount (cuota del mes), NOT the total purchase price. When the statement shows a "Valor cuota" or "Cuota mensual" field, use that value. Example: "Cuota 3/12 - Valor cuota $50.000 - Total $600.000" → amount=-50000, installmentNum=3, installmentTotal=12. Never use the total accumulated amount for installment transactions.${getCreditCardBankHints(bank)}`;
  }

  private buildCheckingPrompt(bank: string): string {
    return `You are a parser for Chilean bank account (cuenta corriente / cuenta RUT / cuenta vista) statements.
Extract ALL movements and return ONLY a valid compact JSON array (no whitespace, no explanation, no markdown).
Each item: {"date":"ISO date","description":"raw text","merchant":"clean name","amount":number,"currency":"CLP","isInstallment":false,"installmentNum":null,"installmentTotal":null,"suggestedCategory":"category","transactionType":"expense"|"income"}

Amount rules:
- ALWAYS negative for outgoing money: debits, payments to credit cards, loan payments, transfers sent, bank fees
- ALWAYS positive for incoming money: salary, received transfers, refunds from services

transactionType rules:
- "income": salary/wages (sueldo, remuneración), received transfers that appear to be income, AFP/previsión returns
- "expense": everything else (payments, debits, fees, transfers sent, metro recharges, etc.)

Category suggestions (use the user's category list when possible):
- Credit card payments → "Pago Tarjeta Crédito"
- Consumer loan payments → "Pago Crédito"
- Outgoing transfers → "Transferencias"
- Metro / Bip recharges → "Transporte"
- Bank fees / commissions → "Comisiones"
- Salary / wages → "Ingresos"
- Received transfers (income) → "Ingresos"
- Supermarket / grocery → "Supermercado"
- Do NOT include account balance rows, opening/closing balance summaries, or section headers.${getCheckingBankHints(bank)}`;
  }
}
