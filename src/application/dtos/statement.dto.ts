export interface UploadStatementDTO {
  bank: 'santander' | 'falabella';
  month: string;
  fileName: string;
  fileBuffer: Buffer;
}

export interface StatementResponseDTO {
  id: string;
  userId: string;
  bank: string;
  month: string;
  fileName: string;
  s3Url: string;
  status: string;
  errorMessage?: string | null;
  createdAt: string;
}
