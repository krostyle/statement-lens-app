import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color hex inválido').optional().default('#6b7280'),
  icon: z.string().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
