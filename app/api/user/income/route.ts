import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { userProfileRepo } from '@/src/infrastructure/container';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await userProfileRepo.ensureExists(userId);
  const profile = await userProfileRepo.findById(userId);
  return NextResponse.json({ monthlyIncome: profile?.monthlyIncome ?? null });
}

const schema = z.object({
  monthlyIncome: z.number().positive().int(),
});

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Monto inválido' }, { status: 400 });
  }

  const profile = await userProfileRepo.updateIncome(userId, parsed.data.monthlyIncome);
  return NextResponse.json({ monthlyIncome: profile.monthlyIncome });
}
