import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { cacheImageFromSource } from './image-cache';

describe('cacheImageFromSource', () => {
  it('downloads, hashes and stores a webp image', async () => {
    const cacheDir = './tmp/cache-image';
    fs.rmSync(cacheDir, { recursive: true, force: true });

    const imageBuffer = await sharp({
      create: {
        width: 2,
        height: 3,
        channels: 3,
        background: { r: 255, g: 200, b: 0 }
      }
    })
      .webp()
      .toBuffer();

    const server = createServer((_, res) => {
      res.writeHead(200, { 'content-type': 'image/webp' });
      res.end(imageBuffer);
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('failed to bind image test server');
    }

    const result = await cacheImageFromSource({
      sourceWorkId: 'w1',
      imageSourceUrl: `http://127.0.0.1:${address.port}/sample.webp`,
      cacheDir
    });

    expect(result.localPath.endsWith(path.join('jimeng', 'w1.webp'))).toBe(true);
    expect(result.sha256.length).toBe(64);
    expect(result.width).toBe(2);
    expect(result.height).toBe(3);
    expect(fs.existsSync(result.localPath)).toBe(true);

    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });

  it('retries transient download failures before giving up', async () => {
    const cacheDir = './tmp/cache-image-retry';
    fs.rmSync(cacheDir, { recursive: true, force: true });

    const imageBuffer = await sharp({
      create: {
        width: 4,
        height: 5,
        channels: 3,
        background: { r: 30, g: 120, b: 200 }
      }
    })
      .webp()
      .toBuffer();

    let requestCount = 0;
    const server = createServer((_, res) => {
      requestCount += 1;

      if (requestCount < 3) {
        res.destroy();
        return;
      }

      res.writeHead(200, { 'content-type': 'image/webp' });
      res.end(imageBuffer);
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('failed to bind retry image test server');
    }

    const result = await cacheImageFromSource({
      sourceWorkId: 'retry-work',
      imageSourceUrl: `http://127.0.0.1:${address.port}/retry.webp`,
      cacheDir
    });

    expect(requestCount).toBe(3);
    expect(result.localPath.endsWith(path.join('jimeng', 'retry-work.webp'))).toBe(true);
    expect(fs.existsSync(result.localPath)).toBe(true);

    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });
});
