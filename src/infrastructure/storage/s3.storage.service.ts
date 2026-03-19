import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, S3_BUCKET } from './s3.client';

export class S3StorageService {
  async upload(key: string, buffer: Buffer, contentType = 'application/pdf'): Promise<string> {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
    return `https://${S3_BUCKET}.s3.amazonaws.com/${key}`;
  }

  async delete(key: string): Promise<void> {
    await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
  }

  async download(key: string): Promise<Buffer> {
    const response = await s3Client.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async getSignedDownloadUrl(key: string, expiresIn = 3600, fileName?: string): Promise<string> {
    return getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        ...(fileName ? { ResponseContentDisposition: `attachment; filename="${fileName}"` } : {}),
      }),
      { expiresIn }
    );
  }
}
