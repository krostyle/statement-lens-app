import type { Snapshot, SnapshotTransaction } from '@/src/domain/entities/snapshot';

export interface ISnapshotRepository {
  findByUserAndMonth(userId: string, month: string): Promise<Snapshot | null>;
  findAllMonthsByUserId(userId: string): Promise<string[]>;
  upsert(userId: string, month: string, checkingTxs: SnapshotTransaction[] | null, ccTxs: SnapshotTransaction[] | null): Promise<Snapshot>;
  deleteByUserAndMonth(userId: string, month: string): Promise<void>;
}
