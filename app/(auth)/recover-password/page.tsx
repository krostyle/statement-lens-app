'use client';

import { useState, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { forgotPasswordSchema, resetPasswordSchema, type ForgotPasswordInput, type ResetPasswordInput } from '@/src/lib/validations/auth.schema';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';

function RecoverPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const forgotForm = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });
  const resetForm = useForm<ResetPasswordInput & { token: string }>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token: token ?? '' },
  });

  const onForgot = async (data: ForgotPasswordInput) => {
    setLoading(true);
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    setLoading(false);
    if (res.ok) setMessage('Si ese email existe, recibirás un enlace para restablecer tu contraseña.');
    else setError('Error al enviar el email.');
  };

  const onReset = async (data: ResetPasswordInput & { token: string }) => {
    setLoading(true);
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password: data.password }),
    });
    setLoading(false);
    if (res.ok) router.push('/login?reset=1');
    else setError('Token inválido o expirado.');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-900">
          {token ? 'Nueva contraseña' : 'Recuperar contraseña'}
        </h1>

        {message && <p className="text-sm text-green-600">{message}</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}

        {!token ? (
          <form onSubmit={forgotForm.handleSubmit(onForgot)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="tu@email.com" {...forgotForm.register('email')} />
              {forgotForm.formState.errors.email && (
                <p className="text-xs text-red-500">{forgotForm.formState.errors.email.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar enlace'}
            </Button>
          </form>
        ) : (
          <form onSubmit={resetForm.handleSubmit(onReset)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">Nueva contraseña</Label>
              <Input id="password" type="password" placeholder="Mínimo 8 caracteres" {...resetForm.register('password')} />
              {resetForm.formState.errors.password && (
                <p className="text-xs text-red-500">{resetForm.formState.errors.password.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar contraseña'}
            </Button>
          </form>
        )}

        <Link href="/login" className="block text-center text-sm text-zinc-500 hover:text-zinc-900">
          Volver al login
        </Link>
      </div>
    </div>
  );
}

export default function RecoverPasswordPage() {
  return (
    <Suspense>
      <RecoverPasswordContent />
    </Suspense>
  );
}
