import { NextResponse } from 'next/server';
import { auth } from '@/src/infrastructure/auth/nextauth.config';
import { listStatementsUseCase, s3Service, statementRepo } from '@/src/infrastructure/container';
import { processStatement } from './_process-statement';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const statements = await listStatementsUseCase.execute(session.user.id);
  return NextResponse.json(statements);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const bank = formData.get('bank') as string | null;
    const month = formData.get('month') as string | null;

    if (!file || !bank || !month) {
      return NextResponse.json({ error: 'Missing required fields: file, bank, month' }, { status: 400 });
    }
    if (!['santander', 'falabella'].includes(bank)) {
      return NextResponse.json({ error: 'Invalid bank. Use santander or falabella' }, { status: 400 });
    }

    const existing = await statementRepo.findByUserId(session.user.id);
    const duplicate = existing.find((s) => s.bank === bank && s.month === month);
    if (duplicate) {
      return NextResponse.json(
        { error: `Ya existe un estado de cuenta de ${bank} para el mes ${month}.` },
        { status: 409 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const statementId = crypto.randomUUID();
    const s3Key = `${session.user.id}/${statementId}/${file.name}`;
    const s3Url = await s3Service.upload(s3Key, buffer);

    const statement = await statementRepo.create({
      userId: session.user.id,
      bank: bank as 'santander' | 'falabella',
      month,
      fileName: file.name,
      s3Key,
      s3Url,
    });

    // Process asynchronously (fire and forget)
    processStatement(statement.id, session.user.id, buffer, bank).catch(console.error);

    return NextResponse.json({
      id: statement.id,
      status: statement.status,
      message: 'Statement uploaded. Processing started.',
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
