import type { ITrackingUploadRepository } from '@/src/domain/repositories/tracking-upload.repository';
import type { TrackingUpload } from '@/src/domain/entities/tracking-upload';
import { prisma } from '../prisma.client';

export class TrackingUploadPrismaRepository implements ITrackingUploadRepository {
  async create(data: Omit<TrackingUpload, 'id' | 'uploadedAt' | 'isFinalized'>): Promise<TrackingUpload> {
    return prisma.trackingUpload.create({ data }) as Promise<TrackingUpload>;
  }

  async findByUserId(userId: string, month?: string): Promise<TrackingUpload[]> {
    return prisma.trackingUpload.findMany({
      where: { userId, ...(month ? { month } : {}) },
      orderBy: { uploadedAt: 'desc' },
    }) as Promise<TrackingUpload[]>;
  }

  async deleteById(id: string, userId: string): Promise<void> {
    await prisma.trackingUpload.deleteMany({ where: { id, userId } });
  }

  async setFinalized(id: string, userId: string, isFinalized: boolean): Promise<TrackingUpload> {
    return prisma.trackingUpload.update({
      where: { id, userId },
      data: { isFinalized },
    }) as Promise<TrackingUpload>;
  }

  async deleteByMonth(userId: string, month: string, bank?: string, accountType?: string): Promise<void> {
    await prisma.trackingUpload.deleteMany({
      where: {
        userId,
        month,
        ...(bank        ? { bank }        : {}),
        ...(accountType ? { accountType } : {}),
      },
    });
  }
}
