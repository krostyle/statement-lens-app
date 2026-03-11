import { pdfParser, statementRepo, categoryRepo, transactionRepo } from '@/src/infrastructure/container';

export async function processStatement(
  statementId: string,
  userId: string,
  buffer: Buffer,
  bank: string
) {
  await statementRepo.updateStatus(statementId, 'processing');
  try {
    const rawText = await pdfParser.extractText(buffer);
    const categories = await categoryRepo.findByUserId(userId);
    const categoryNames = categories.map((c) => c.name);

    const parsed = await pdfParser.parseTransactions(rawText, bank, categoryNames);

    const categoryMap = new Map(categories.map((c) => [c.name, c.id]));
    const othersCategory = categories.find((c) => c.name === 'Otros');
    const defaultCategoryId = othersCategory?.id ?? categories[0]?.id;

    await transactionRepo.createMany(
      parsed.map((t) => ({
        userId,
        statementId,
        categoryId: categoryMap.get(t.suggestedCategory) ?? defaultCategoryId ?? '',
        date: new Date(t.date),
        description: t.description,
        merchant: t.merchant,
        amount: t.amount,
        currency: t.currency,
        isInstallment: t.isInstallment,
        installmentNum: t.installmentNum ?? null,
        installmentTotal: t.installmentTotal ?? null,
      }))
    );

    await statementRepo.updateStatus(statementId, 'done');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    // Extract clean message: strip JSON bodies from Anthropic/AWS errors
    const clean = message.replace(/\{[\s\S]*\}/, '').trim() || message;
    console.error('Error processing statement:', err);
    await statementRepo.updateStatus(statementId, 'error', clean);
  }
}
