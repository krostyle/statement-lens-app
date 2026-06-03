import { auth } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { financialChatUseCase } from '@/src/infrastructure/container';

const bodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() }))
    .min(1),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return new Response('Bad request', { status: 400 });

  try {
    const stream = await financialChatUseCase.execute(userId, parsed.data.messages);
    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (err) {
    console.error('[chat] error:', err);
    return new Response('Internal server error', { status: 500 });
  }
}
