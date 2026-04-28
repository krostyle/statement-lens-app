import { pdfParser, statementRepo, categoryRepo, transactionRepo, merchantRuleRepo } from '@/src/infrastructure/container';
import { normalizeMerchant } from '@/src/domain/entities/merchant-rule';

/** Max time allowed for a single statement processing job (10 minutes). */
const PROCESSING_TIMEOUT_MS = 10 * 60 * 1000;

export async function processStatement(
  statementId: string,
  userId: string,
  buffer: Buffer,
  bank: string,
  month: string,   // "YYYY-MM" — used as the billing date for installment rows
  statementType: 'credit_card' | 'checking' = 'credit_card',
  userName?: string,
) {
  await statementRepo.updateStatus(statementId, 'processing');

  // Reject if processing takes longer than the allowed timeout
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error('Tiempo de procesamiento agotado. Intenta nuevamente.')),
      PROCESSING_TIMEOUT_MS,
    );
  });

  try {
    await Promise.race([doProcess(statementId, userId, buffer, bank, month, statementType, userName), timeoutPromise]);
    clearTimeout(timeoutHandle);
  } catch (err) {
    clearTimeout(timeoutHandle);
    const message = err instanceof Error ? err.message : 'Error desconocido';
    const clean = message.replace(/\{[\s\S]*\}/, '').trim() || message;
    console.error('Error processing statement:', err);
    await statementRepo.updateStatus(statementId, 'error', clean);
  }
}

/** Core processing logic — errors bubble up to processStatement's catch block. */
async function doProcess(
  statementId: string,
  userId: string,
  buffer: Buffer,
  bank: string,
  month: string,
  statementType: 'credit_card' | 'checking' = 'credit_card',
  userName?: string,
) {
  const rawText = await pdfParser.extractText(buffer);
  const categories = await categoryRepo.findByUserId(userId);
  const categoryNames = categories.map((c) => c.name);

  const parsed = (await pdfParser.parseTransactions(rawText, bank, categoryNames, statementType, userName)).filter((t) => {
    // Santander (and potentially other banks) include informational "cuota 00/N"
    // entries in the "INFORMACION COMPRAS EN CUOTAS EN EL PERIODO" section.
    // These are NOT real charges — the first actual charge is cuota 01/N in
    // the next statement. Discard any row where installmentNum is 0.
    if (t.isInstallment && t.installmentNum === 0) return false;
    return true;
  });

  const categoryMap = new Map(categories.map((c) => [c.name, c.id]));
  const othersCategory = categories.find((c) => c.name === 'Otros');
  const defaultCategoryId = othersCategory?.id ?? categories[0]?.id;

  // Load merchant rules for this user.
  // Build two maps: bank-specific rules take priority over wildcard ("") rules.
  const merchantRules = await merchantRuleRepo.findByUserId(userId);
  const bankRuleMap = new Map<string, string>();   // "pattern|bank"  → categoryId
  const wildcardRuleMap = new Map<string, string>(); // "pattern"       → categoryId
  for (const rule of merchantRules) {
    if (rule.bank) {
      bankRuleMap.set(`${rule.merchantPattern}|${rule.bank}`, rule.categoryId);
    } else {
      wildcardRuleMap.set(rule.merchantPattern, rule.categoryId);
    }
  }

  // For installment transactions, use the statement's billing month as the
  // effective date (1st of month, UTC). Banks typically store the original
  // purchase date on every cuota row, which would wrongly attribute the
  // spend to the purchase month instead of the actual billing month.
  const [y, m] = month.split('-').map(Number);
  const billingDate = new Date(Date.UTC(y, m - 1, 1));

  await transactionRepo.createMany(
    parsed.map((t) => {
      const pattern = normalizeMerchant(t.merchant);
      // Bank-specific rule takes priority; fall back to wildcard rule
      const ruleCategory =
        bankRuleMap.get(`${pattern}|${bank}`) ??
        wildcardRuleMap.get(pattern);
      const categoryId = ruleCategory
        ?? categoryMap.get(t.suggestedCategory)
        ?? defaultCategoryId
        ?? '';
      // 'auto' when a user-defined rule applied; 'pending' when AI suggested
      const reviewStatus = ruleCategory ? 'auto' : 'pending';
      return {
        userId,
        statementId,
        categoryId,
        reviewStatus,
        transactionType: (
          t.transactionType === 'income' ? 'income'
          : t.transactionType === 'transfer' ? 'transfer'
          : 'expense'
        ) as 'expense' | 'income' | 'transfer',
        date: t.isInstallment ? billingDate : new Date(t.date),
        description: t.description,
        merchant: t.merchant,
        amount: t.amount,
        currency: t.currency,
        isInstallment: t.isInstallment,
        installmentNum: t.installmentNum ?? null,
        installmentTotal: t.installmentTotal ?? null,
      };
    })
  );

  await statementRepo.updateStatus(statementId, 'done');
}
