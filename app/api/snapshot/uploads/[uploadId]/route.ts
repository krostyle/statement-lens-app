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
  // deleteById checks userId — cascade FK deletes all linked transactions
  await trackingUploadRepo.deleteById(uploadId, userId);
  return new NextResponse(null, { status: 204 });
}
