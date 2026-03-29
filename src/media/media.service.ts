import { Injectable } from '@nestjs/common'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { ConfigService } from '@nestjs/config'
import { randomUUID } from 'crypto'

@Injectable()
export class MediaService {
  private s3: S3Client
  private bucket: string

  constructor(private cfg: ConfigService) {
    this.bucket = cfg.get('MINIO_BUCKET', 'blog-media')
    this.s3 = new S3Client({
      endpoint: cfg.get('MINIO_ENDPOINT', 'http://minio:9000'),
      region: 'us-east-1',
      credentials: {
        accessKeyId: cfg.get('MINIO_ACCESS_KEY', 'minioadmin'),
        secretAccessKey: cfg.get('MINIO_SECRET_KEY', 'minioadmin'),
      },
      forcePathStyle: true,
    })
  }

  async upload(buffer: Buffer, mimetype: string): Promise<string> {
    const key = `${randomUUID()}.${mimetype.split('/')[1]}`
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
      }),
    )
    const endpoint = this.cfg.get('MINIO_PUBLIC_ENDPOINT', 'http://localhost:9000')
    return `${endpoint}/${this.bucket}/${key}`
  }
}
