import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';

export interface CacheImageFromSourceInput {
  sourceWorkId: string;
  imageSourceUrl: string;
  cacheDir: string;
}

export interface CachedImageResult {
  localPath: string;
  sha256: string;
  width: number;
  height: number;
}

const IMAGE_FETCH_ATTEMPTS = 3;
const IMAGE_FETCH_TIMEOUT_MS = 12_000;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function downloadImageBuffer(imageSourceUrl: string): Promise<Buffer> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= IMAGE_FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(imageSourceUrl, {
        headers: {
          accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          referer: 'https://jimeng.jianying.com/',
          'user-agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
        },
        signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS)
      });

      if (!response.ok) {
        throw new Error(`failed to download image: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      lastError = error;

      if (attempt < IMAGE_FETCH_ATTEMPTS) {
        await wait(250 * attempt);
        continue;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('failed to download image');
}

export async function cacheImageFromSource(
  input: CacheImageFromSourceInput
): Promise<CachedImageResult> {
  const buffer = await downloadImageBuffer(input.imageSourceUrl);
  const metadata = await sharp(buffer).metadata();
  const targetDir = path.join(input.cacheDir, 'jimeng');
  const localPath = path.join(targetDir, `${input.sourceWorkId}.webp`);
  const sha256 = createHash('sha256').update(buffer).digest('hex');

  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(localPath, buffer);

  return {
    localPath,
    sha256,
    width: metadata.width ?? 0,
    height: metadata.height ?? 0
  };
}
