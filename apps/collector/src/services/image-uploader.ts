import fs from 'node:fs';
import path from 'node:path';

import COS from 'cos-nodejs-sdk-v5';

import type { CollectorConfig } from '../config';

export interface UploadImageInput {
  sourceSite: string;
  sourceWorkId: string;
  localPath: string;
}

export interface UploadImageResult {
  key: string;
  url: string;
  etag: string;
}

export interface ImageUploader {
  uploadImage(input: UploadImageInput): Promise<UploadImageResult>;
}

interface CosImageUploaderOptions {
  secretId: string;
  secretKey: string;
  bucket: string;
  region: string;
  domain: string;
  prefix: string;
}

class CosImageUploader implements ImageUploader {
  private readonly cos: COS;

  constructor(private readonly options: CosImageUploaderOptions) {
    this.cos = new COS({
      SecretId: options.secretId,
      SecretKey: options.secretKey
    });
  }

  async uploadImage(input: UploadImageInput): Promise<UploadImageResult> {
    const key = buildCosObjectKey(this.options.prefix, input.sourceSite, input.sourceWorkId, input.localPath);
    const stats = fs.statSync(input.localPath);

    const result = await new Promise<{ ETag?: string }>((resolve, reject) => {
      this.cos.putObject(
        {
          Bucket: this.options.bucket,
          Region: this.options.region,
          Key: key,
          Body: fs.createReadStream(input.localPath),
          ContentLength: stats.size
        },
        (error, data) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(data ?? {});
        }
      );
    });

    return {
      key,
      url: buildCosObjectUrl(this.options.domain, this.options.bucket, this.options.region, key),
      etag: result.ETag ?? ''
    };
  }
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}

function buildCosObjectKey(prefix: string, sourceSite: string, sourceWorkId: string, localPath: string) {
  const normalizedPrefix = trimSlashes(prefix);
  const extension = path.extname(localPath) || '.webp';
  const baseSegments = [normalizedPrefix, 'originals', sourceSite, `${sourceWorkId}${extension}`].filter(Boolean);
  return baseSegments.join('/');
}

function buildCosObjectUrl(domain: string, bucket: string, region: string, key: string) {
  const normalizedKey = key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  if (domain) {
    return `${domain.replace(/\/+$/g, '')}/${normalizedKey}`;
  }

  return `https://${bucket}.cos.${region}.myqcloud.com/${normalizedKey}`;
}

export function createImageUploaderFromConfig(config: CollectorConfig): ImageUploader | undefined {
  if (!config.cosSecretId || !config.cosSecretKey || !config.cosBucket || !config.cosRegion) {
    return undefined;
  }

  return new CosImageUploader({
    secretId: config.cosSecretId,
    secretKey: config.cosSecretKey,
    bucket: config.cosBucket,
    region: config.cosRegion,
    domain: config.cosDomain,
    prefix: config.cosPrefix
  });
}
