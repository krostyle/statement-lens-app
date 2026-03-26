import { z } from 'zod';

export const updateStatementSchema = z.object({
  bank: z.enum(['santander', 'falabella', 'liderbci'], { message: 'Banco inválido.' }),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'El mes debe tener el formato YYYY-MM.'),
});
