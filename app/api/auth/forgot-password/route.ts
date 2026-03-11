import { NextResponse } from 'next/server';
import { forgotPasswordSchema } from '@/src/lib/validations/auth.schema';
import { forgotPasswordUseCase } from '@/src/infrastructure/container';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    await forgotPasswordUseCase.execute(parsed.data.email);
    return NextResponse.json({ message: 'If that email exists, a reset link was sent.' });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
