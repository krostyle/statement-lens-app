import { z } from 'zod';

export const createTransactionSchema = z.object({
  categoryId: z.string().uuid(),
  date: z.string().datetime(),
  description: z.string().min(1),
  merchant: z.string().min(1),
  amount: z.number(),
  currency: z.string().default('CLP'),
  isInstallment: z.boolean().default(false),
  installmentNum: z.number().int().positive().optional().nullable(),
  installmentTotal: z.number().int().positive().optional().nullable(),
  statementId: z.string().uuid().optional().nullable(),
});

export const updateTransactionSchema = z.object({
  categoryId: z.string().uuid().optional(),
  merchant: z.string().min(1).optional(),
  amount: z.number().optional(),
  notes: z.string().optional().nullable(),
  date: z.string().datetime().optional(),
  description: z.string().min(1).optional(),
  // Side-effect flags — processed by the route handler, not persisted directly
  saveMerchantRule: z.boolean().optional(),
  saveMerchantRuleBank: z.string().optional(), // "" = any card; "santander" | "falabella" | "liderbci"
  applyToInstallmentGroup: z.boolean().optional(),
  // Explicit confirm (mark as reviewed without editing any field)
  confirm: z.boolean().optional(),
  // Manual type override (expense / income / transfer)
  transactionType: z.enum(['expense', 'income', 'transfer']).optional(),
  installmentNum: z.number().int().positive().optional().nullable(),
  installmentTotal: z.number().int().positive().optional().nullable(),
});

export type CreateTransactionInput = z.input<typeof createTransactionSchema>;
export type CreateTransactionOutput = z.output<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
