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
});

export type CreateTransactionInput = z.input<typeof createTransactionSchema>;
export type CreateTransactionOutput = z.output<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
