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
  transactionType: 'expense' | 'income' | 'transfer';
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
- Rows prefixed "ABN" or "ABONO" are credits → positive amount.
- Rows prefixed "CRG" or "CARGO" are debits → negative amount.
- Rows prefixed "TRF ENVIADA" or "TRANSFERENCIA A" sent to another own account → transactionType "transfer", negative amount, category "Transferencia interna".
- Rows prefixed "TRF" or "TRANSFERENCIA" sent to an external third party → transactionType "expense", negative amount, category "Transferencias".
- Rows prefixed "TRF" or "TRANSFERENCIA" received (abono) → transactionType "income" if salary, otherwise "income", category "Ingresos".
- "PAGO TARJETA" or "PAG TAR" rows → transactionType "transfer", negative amount, category "Pago Tarjeta Crédito".
- "COM" or "COMISION" rows are bank fees → transactionType "expense", negative amount, category "Comisiones".`;
  }
  if (bank === 'falabella') {
    return `\nFalabella cuenta corriente rules:
- "Abono" column values → positive amounts.
- "Cargo" column values → negative amounts.
- Payments to Falabella credit card ("PAGO TARJETA", "PAG TC") → transactionType "transfer", negative amount, category "Pago Tarjeta Crédito".
- Transfers to own accounts at other banks → transactionType "transfer", negative amount, category "Transferencia interna".
- Salary / payroll deposits → transactionType "income", positive amount, category "Ingresos".`;
  }
  if (bank === 'bci') {
    return `\nBCI cuenta corriente rules:
- "Abono" (credit) column → positive amount.
- "Cargo" (debit) column → negative amount.
- Loan payments (cuota crédito, dividendo) → transactionType "expense", negative amount, category "Pago Crédito".
- BCI credit card payments ("PAGO TARJETA BCI") → transactionType "transfer", negative amount, category "Pago Tarjeta Crédito".
- Transfers to own accounts at other banks → transactionType "transfer", negative amount, category "Transferencia interna".`;
  }
  if (bank === 'bancoestado') {
    return `\nBancoEstado / Cuenta RUT rules:
- "Abono" column → positive amount.
- "Cargo" column → negative amount.
- Bip!/metro recharges ("RECARGA BIP", "METRO") → transactionType "expense", negative amount, category "Transporte".
- Salary transfers → transactionType "income", positive amount, category "Ingresos".
- Transfers to own accounts at other banks → transactionType "transfer", negative amount, category "Transferencia interna".
- Comisiones / mantención → transactionType "expense", negative amount, category "Comisiones".`;
  }
  return '';
}

export class PdfParserService {
  async extractText(buffer: Buffer): Promise<string> {
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    // pdf-parse sometimes converts table column-separator lines (|) into the
    // digit "1", which corrupts amounts (e.g. $234.567 → 1234.567).
    // Strip those artifacts before sending the text to Claude.
    return data.text
      .replace(/\|/g, ' ')          // pipe → space (column separators)
      .replace(/[ \t]{2,}/g, ' ')   // collapse repeated spaces/tabs
      .trim();
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
      transactionType: t.transactionType === 'income'
        ? 'income'
        : t.transactionType === 'transfer'
          ? 'transfer'
          : 'expense',
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
Each item: {"date":"ISO date","description":"raw text","merchant":"clean name","amount":number,"currency":"CLP","isInstallment":false,"installmentNum":null,"installmentTotal":null,"suggestedCategory":"category","transactionType":"expense"|"income"|"transfer"}

Amount rules:
- ALWAYS negative for outgoing money: debits, credit card payments, loan payments, transfers sent, bank fees
- ALWAYS positive for incoming money: salary, received transfers, service refunds

transactionType rules — THIS IS CRITICAL TO AVOID DOUBLE-COUNTING:
- "transfer": credit card payments (these expenses are already counted in the credit card statement), transfers sent to own accounts at other banks (e.g. paying BCI from Santander). These are INTERNAL MOVEMENTS, not real new expenses.
- "income": salary/wages (sueldo, remuneración), received transfers that represent real income, AFP/previsión returns
- "expense": real spending — loan payments, bank fees, metro/Bip recharges, supermarket purchases, any outgoing that is NOT a credit card payment or own-account transfer

Category suggestions (use the user's category list when possible):
- Credit card payments → "Pago Tarjeta Crédito" (transactionType: "transfer")
- Own-account transfers → "Transferencia interna" (transactionType: "transfer")
- Consumer loan payments → "Pago Crédito" (transactionType: "expense")
- Outgoing transfers to third parties → "Transferencias" (transactionType: "expense")
- Metro / Bip recharges → "Transporte" (transactionType: "expense")
- Bank fees / commissions → "Comisiones" (transactionType: "expense")
- Salary / wages → "Ingresos" (transactionType: "income")
- Received transfers (income) → "Ingresos" (transactionType: "income")
- Do NOT include account balance rows, opening/closing balance summaries, or section headers.${getCheckingBankHints(bank)}`;
  }
}
