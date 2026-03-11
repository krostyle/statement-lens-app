import { NextResponse } from 'next/server';
import { resetPasswordSchema } from '@/src/lib/validations/auth.schema';
import { resetPasswordUseCase } from '@/src/infrastructure/container';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    await resetPasswordUseCase.execute(parsed.data.token, parsed.data.password);
    return NextResponse.json({ message: 'Password updated successfully.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message.includes('Invalid or expired') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
