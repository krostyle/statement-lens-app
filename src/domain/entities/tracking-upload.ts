export interface TrackingUpload {
  id: string;
  userId: string;
  bank: string;
  accountType: string; // 'checking' | 'credit_card'
  month: string;       // YYYY-MM
  rowCount: number;
  isFinalized: boolean;  // whether all data for this period has been fully loaded
  uploadedAt: Date;
}
