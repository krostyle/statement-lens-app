import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createCategorySchema } from '@/src/lib/validations/category.schema';
import { listCategoriesUseCase, createCategoryUseCase } from '@/src/infrastructure/container';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const categories = await listCategoriesUseCase.execute(userId);
  return NextResponse.json(categories);
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const parsed = createCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const category = await createCategoryUseCase.execute(userId, parsed.data);
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
