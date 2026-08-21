import type { TrackingUpload } from '../entities/tracking-upload';

export interface ITrackingUploadRepository {
  create(data: Omit<TrackingUpload, 'id' | 'uploadedAt' | 'isFinalized'>): Promise<TrackingUpload>;
  findByUserId(userId: string, month?: string): Promise<TrackingUpload[]>;
  deleteById(id: string, userId: string): Promise<void>;
  setFinalized(id: string, userId: string, isFinalized: boolean): Promise<TrackingUpload>;
  /** Replaces tracking for a single accounting month — never touches other months. */
  deleteByMonth(userId: string, month: string, bank?: string, accountType?: string): Promise<void>;
}
