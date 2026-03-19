import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/src/infrastructure/auth/nextauth.config';
import { userRepo } from '@/src/infrastructure/container';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await userRepo.findById(session.user.id);
  return NextResponse.json({ monthlyIncome: user?.monthlyIncome ?? null });
}

const schema = z.object({
  monthlyIncome: z.number().positive().int(),
});

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Monto inválido' }, { status: 400 });
  }

  const user = await userRepo.updateIncome(session.user.id, parsed.data.monthlyIncome);
  return NextResponse.json({ monthlyIncome: user.monthlyIncome });
}
