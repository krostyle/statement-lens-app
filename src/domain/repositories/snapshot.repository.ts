import type { Snapshot, SnapshotTransaction } from '@/src/domain/entities/snapshot';

export interface ISnapshotRepository {
  findByUserAndMonth(userId: string, month: string): Promise<Snapshot | null>;
  upsert(userId: string, month: string, checkingTxs: SnapshotTransaction[] | null, ccTxs: SnapshotTransaction[] | null): Promise<Snapshot>;
  deleteByUserAndMonth(userId: string, month: string): Promise<void>;
}
