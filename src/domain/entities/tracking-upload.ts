export interface TrackingUpload {
  id: string;
  userId: string;
  bank: string;
  accountType: string; // 'checking' | 'credit_card'
  month: string;       // YYYY-MM
  rowCount: number;
  uploadedAt: Date;
}
