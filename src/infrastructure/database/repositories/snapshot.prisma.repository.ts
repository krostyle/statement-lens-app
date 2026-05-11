import type { ISnapshotRepository } from '@/src/domain/repositories/snapshot.repository';
import type { Snapshot, SnapshotTransaction } from '@/src/domain/entities/snapshot';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma.client';

export class SnapshotPrismaRepository implements ISnapshotRepository {
  async findByUserAndMonth(userId: string, month: string): Promise<Snapshot | null> {
    const s = await prisma.snapshot.findUnique({ where: { userId_month: { userId, month } } });
    if (!s) return null;
    return {
      ...s,
      checkingTxs: (s.checkingTxs as SnapshotTransaction[] | null),
      ccTxs:       (s.ccTxs       as SnapshotTransaction[] | null),
    };
  }

  async upsert(
    userId: string,
    month: string,
    checkingTxs: SnapshotTransaction[] | null,
    ccTxs: SnapshotTransaction[] | null,
  ): Promise<Snapshot> {
    // Nullable JSON fields in Prisma require Prisma.JsonNull (not plain null)
    const toJson = (v: SnapshotTransaction[] | null): Prisma.InputJsonValue | typeof Prisma.JsonNull =>
      v !== null ? (v as unknown as Prisma.InputJsonValue) : Prisma.JsonNull;

    const existing = await prisma.snapshot.findUnique({ where: { userId_month: { userId, month } } });
    const s = existing
      ? await prisma.snapshot.update({
          where: { id: existing.id },
          data: { checkingTxs: toJson(checkingTxs), ccTxs: toJson(ccTxs) },
        })
      : await prisma.snapshot.create({
          data: { userId, month, checkingTxs: toJson(checkingTxs), ccTxs: toJson(ccTxs) },
        });
    return {
      ...s,
      checkingTxs: (s.checkingTxs as SnapshotTransaction[] | null),
      ccTxs:       (s.ccTxs       as SnapshotTransaction[] | null),
    };
  }

  async findAllMonthsByUserId(userId: string): Promise<string[]> {
    const rows = await prisma.snapshot.findMany({
      where: { userId },
      select: { month: true },
      orderBy: { month: 'desc' },
    });
    return rows.map((r) => r.month);
  }

  async deleteByUserAndMonth(userId: string, month: string): Promise<void> {
    await prisma.snapshot.deleteMany({ where: { userId, month } });
  }
}
