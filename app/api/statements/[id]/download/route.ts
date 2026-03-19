import { NextResponse } from 'next/server';
import { auth } from '@/src/infrastructure/auth/nextauth.config';
import { statementRepo, s3Service } from '@/src/infrastructure/container';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const statement = await statementRepo.findById(id);
  if (!statement) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (statement.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const presignedUrl = await s3Service.getSignedDownloadUrl(statement.s3Key, 300, statement.fileName);
  return NextResponse.redirect(presignedUrl);
}
