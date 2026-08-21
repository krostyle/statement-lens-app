'use server';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { trackingUploadRepo } from '@/src/infrastructure/container';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ uploadId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { uploadId } = await params;
  await trackingUploadRepo.deleteById(uploadId, userId);
  return new NextResponse(null, { status: 204 });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ uploadId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { uploadId } = await params;
  const { isFinalized } = await req.json() as { isFinalized: boolean };
  const updated = await trackingUploadRepo.setFinalized(uploadId, userId, isFinalized);
  return NextResponse.json(updated);
}
