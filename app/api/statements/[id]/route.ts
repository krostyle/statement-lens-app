import { NextResponse } from 'next/server';
import { auth } from '@/src/infrastructure/auth/nextauth.config';
import { statementRepo, s3Service, updateStatementUseCase } from '@/src/infrastructure/container';
import { updateStatementSchema } from '@/src/lib/validations/statement.schema';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const statement = await statementRepo.findById(id);
  if (!statement) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (statement.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  return NextResponse.json(statement);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const parsed = updateStatementSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const result = await updateStatementUseCase.execute(id, session.user.id, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    if (msg === 'Statement not found') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (msg === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (msg === 'DuplicateStatement')
      return NextResponse.json({ error: 'Ya existe un estado de cuenta de ese banco para ese mes.' }, { status: 409 });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const statement = await statementRepo.findById(id);
    if (!statement) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (statement.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await s3Service.delete(statement.s3Key);
    await statementRepo.delete(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
