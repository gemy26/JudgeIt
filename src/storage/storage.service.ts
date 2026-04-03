import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService {
  private logger: Logger;
  private client;
  constructor(private config: ConfigService) {
    this.logger = new Logger(StorageService.name, { timestamp: true });
    this.client = new S3Client({
      region: this.config.get<string>('S3_REGION')!,
      credentials: {
        accessKeyId: this.config.get<string>('S3_ACCESS_KEY_ID')!,
        secretAccessKey: this.config.get<string>('S3_SECRET_ACCESS_KEY')!,
      },
    });
  }

  private async listObjectKeys(
    bucket: string,
    prefix: string,
  ): Promise<string[]> {
    const input = {
      Bucket: bucket,
      Prefix: prefix,
    };
    const command = new ListObjectsV2Command(input);
    const response = await this.client.send(command);
    const objectsKeys = (response.Contents ?? []).map((data) => data.Key);
    return objectsKeys;
  }

  async fetchObjectContents(
    bucket: string,
    prefix: string,
  ): Promise<{ key: string; content: string }[]> {
    const keys = (await this.listObjectKeys(bucket, prefix)).filter(
      (key) => !key.endsWith('/'),
    );
    const objectsData = await Promise.all(
      keys.map(async (key) => {
        const data = await this.client.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: key,
          }),
        );
        const content = await data.Body.transformToString();
        return { key, content };
      }),
    );
    return objectsData;
  }
}
