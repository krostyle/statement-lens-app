import { NextResponse } from 'next/server';
import { auth } from '@/src/infrastructure/auth/nextauth.config';
import { statementRepo, transactionRepo, s3Service } from '@/src/infrastructure/container';
import { processStatement } from '../../_process-statement';

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const statement = await statementRepo.findById(id);
  if (!statement) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (statement.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (statement.status === 'processing' || statement.status === 'pending') {
    return NextResponse.json({ error: 'El estado ya está siendo procesado.' }, { status: 409 });
  }

  // Delete existing transactions from previous (failed) attempt
  const existing = await transactionRepo.findByStatementId(id);
  await Promise.all(existing.map((t) => transactionRepo.delete(t.id)));

  // Download PDF from S3 and reprocess
  const buffer = await s3Service.download(statement.s3Key);
  processStatement(id, session.user.id, buffer, statement.bank).catch(console.error);

  return NextResponse.json({ message: 'Reprocesamiento iniciado.' });
}
