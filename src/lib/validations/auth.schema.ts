import { z } from 'zod';

const nameField = (label: string) =>
  z
    .string()
    .min(2, `${label} debe tener al menos 2 caracteres`)
    .max(50, `${label} debe tener máximo 50 caracteres`)
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/, `${label} solo puede contener letras`);

const registerBaseSchema = z.object({
  firstName: nameField('El nombre'),
  lastName: nameField('El apellido'),
  email: z.string().email('Email inválido'),
  password: z
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
    .regex(/[0-9]/, 'Debe contener al menos un número'),
});

export const registerSchema = registerBaseSchema
  .extend({
    confirmEmail: z.string().email('Email inválido'),
    confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
  })
  .superRefine((data, ctx) => {
    if (data.email !== data.confirmEmail) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Los emails no coinciden',
        path: ['confirmEmail'],
      });
    }
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Las contraseñas no coinciden',
        path: ['confirmPassword'],
      });
    }
  });

// Schema used by the API route (no confirm fields)
export const registerApiSchema = registerBaseSchema;

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type RegisterApiInput = z.infer<typeof registerApiSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
