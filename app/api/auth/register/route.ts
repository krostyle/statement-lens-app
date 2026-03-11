import { NextResponse } from 'next/server';
import { registerApiSchema } from '@/src/lib/validations/auth.schema';
import { registerUseCase } from '@/src/infrastructure/container';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerApiSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const user = await registerUseCase.execute(parsed.data);
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message === 'Email already registered' ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
