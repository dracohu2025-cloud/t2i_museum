import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';
import { type CollectWorkPayload } from '@t2i/contracts';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { openDatabase } from '../db/client';
import { runMigrations } from '../db/migrate';
import type { ImageUploader } from './image-uploader';
import type { StyleAnalyzer } from './style-analyzer';
import { WorkRepository } from './work-repository';
import { ingestWork } from './ingest-work';

describe('ingestWork', () => {
  it('creates a completed work and fills cached image fields', async () => {
    const dataDir = './tmp/ingest-work-success';
    fs.rmSync(dataDir, { recursive: true, force: true });

    const imageBuffer = await sharp({
      create: {
        width: 4,
        height: 5,
        channels: 3,
        background: { r: 20, g: 40, b: 200 }
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
      throw new Error('failed to bind ingest test server');
    }

    const payload: CollectWorkPayload = {
      sourceSite: 'jimeng',
      sourceWorkId: 'w1',
      sourceUrl: 'https://jimeng.jianying.com/ai-tool/work-detail/w1?workDetailType=Image&itemType=9',
      promptRaw: 'Moebius (Jean Giraud)风格',
      imageSourceUrl: `http://127.0.0.1:${address.port}/sample.webp`,
      authorName: '',
      publishedAt: '',
      modelLabel: '',
      aspectRatio: ''
    };

    const db = openDatabase(dataDir);
    runMigrations(db);
    const repository = new WorkRepository(db);

    await ingestWork({
      repository,
      cacheDir: path.join(dataDir, 'cache', 'originals'),
      payload
    });

    const row = db
      .prepare(
        `
          SELECT image_local_path, image_sha256, width, height, ingest_status
          FROM works
          WHERE source_site = ? AND source_work_id = ?
        `
      )
      .get('jimeng', 'w1') as
      | {
          image_local_path: string;
          image_sha256: string;
          width: number;
          height: number;
          ingest_status: string;
        }
      | undefined;

    expect(row).toBeDefined();
    expect(row?.image_local_path.endsWith(path.join('jimeng', 'w1.webp'))).toBe(true);
    expect(row?.image_sha256.length).toBe(64);
    expect(row?.width).toBe(4);
    expect(row?.height).toBe(5);
    expect(row?.ingest_status).toBe('done');

    db.close();

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

  it('keeps the work row and marks it failed when image download fails', async () => {
    const dataDir = './tmp/ingest-work-failed';
    fs.rmSync(dataDir, { recursive: true, force: true });

    const payload: CollectWorkPayload = {
      sourceSite: 'jimeng',
      sourceWorkId: 'failed-work',
      sourceUrl: 'https://jimeng.jianying.com/ai-tool/work-detail/failed-work?workDetailType=Image&itemType=9',
      promptRaw: '极繁主义',
      imageSourceUrl: 'http://127.0.0.1:9/missing.webp',
      authorName: '',
      publishedAt: '',
      modelLabel: '',
      aspectRatio: ''
    };

    const db = openDatabase(dataDir);
    runMigrations(db);
    const repository = new WorkRepository(db);

    await ingestWork({
      repository,
      cacheDir: path.join(dataDir, 'cache', 'originals'),
      payload
    });

    const row = db
      .prepare(
        `
          SELECT source_work_id, ingest_status, ingest_error
          FROM works
          WHERE source_site = ? AND source_work_id = ?
        `
      )
      .get('jimeng', 'failed-work') as
      | {
          source_work_id: string;
          ingest_status: string;
          ingest_error: string;
        }
      | undefined;

    expect(row?.source_work_id).toBe('failed-work');
    expect(row?.ingest_status).toBe('failed');
    expect(row?.ingest_error.length).toBeGreaterThan(0);

    db.close();
  });

  it('creates canonical styles, aliases and work_style links from analyzer output', async () => {
    const dataDir = './tmp/ingest-work-analyzed';
    fs.rmSync(dataDir, { recursive: true, force: true });

    const imageBuffer = await sharp({
      create: {
        width: 6,
        height: 7,
        channels: 3,
        background: { r: 12, g: 60, b: 140 }
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
      throw new Error('failed to bind analyze test server');
    }

    const analyzer: StyleAnalyzer = {
      async analyzePrompt() {
        return {
          candidates: [
            {
              rawTerm: 'Moebius (Jean Giraud)风格',
              normalizedCandidate: 'Moebius (Jean Giraud)',
              termType: 'artist_style',
              confidence: 0.96,
              shouldBeStyleTag: true,
              shortExplanation: '法式科幻漫画式线稿与色彩控制'
            },
            {
              rawTerm: '极繁主义',
              normalizedCandidate: '极繁主义',
              termType: 'movement_style',
              confidence: 0.88,
              shouldBeStyleTag: true,
              shortExplanation: '高密度细节与视觉堆叠'
            }
          ]
        };
      }
    };

    const payload: CollectWorkPayload = {
      sourceSite: 'jimeng',
      sourceWorkId: 'analyzed-work',
      sourceUrl: 'https://jimeng.jianying.com/ai-tool/work-detail/analyzed-work?workDetailType=Image&itemType=9',
      promptRaw: 'Moebius (Jean Giraud)风格，极繁主义',
      imageSourceUrl: `http://127.0.0.1:${address.port}/sample.webp`,
      authorName: '',
      publishedAt: '',
      modelLabel: '',
      aspectRatio: ''
    };

    const db = openDatabase(dataDir);
    runMigrations(db);
    const repository = new WorkRepository(db);

    await ingestWork({
      repository,
      cacheDir: path.join(dataDir, 'cache', 'originals'),
      payload,
      styleAnalyzer: analyzer
    });

    const styles = db
      .prepare(
        `
          SELECT name
          FROM styles
          ORDER BY name
        `
      )
      .all() as Array<{ name: string }>;
    const aliases = db.prepare('SELECT alias_name, alias_norm FROM style_aliases ORDER BY alias_name').all() as Array<{
      alias_name: string;
      alias_norm: string;
    }>;
    const links = db.prepare('SELECT COUNT(*) AS count FROM work_styles').get() as { count: number };
    const runs = db.prepare('SELECT status FROM analysis_runs').all() as Array<{ status: string }>;

    expect(styles).toEqual([
      { name: 'Moebius (Jean Giraud)' },
      { name: '极繁主义' }
    ]);
    expect(aliases.map((alias) => alias.alias_norm)).toEqual(
      expect.arrayContaining(['moebius (jean giraud)', '极繁主义'])
    );
    expect(links.count).toBe(2);
    expect(runs).toEqual([{ status: 'succeeded' }]);

    db.close();

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

  it('re-analyzes an already collected work when styles are still missing', async () => {
    const dataDir = './tmp/ingest-work-reanalyze';
    fs.rmSync(dataDir, { recursive: true, force: true });

    const imageBuffer = await sharp({
      create: {
        width: 8,
        height: 9,
        channels: 3,
        background: { r: 90, g: 30, b: 170 }
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
      throw new Error('failed to bind reanalyze test server');
    }

    const payload: CollectWorkPayload = {
      sourceSite: 'jimeng',
      sourceWorkId: 'reanalyze-work',
      sourceUrl:
        'https://jimeng.jianying.com/ai-tool/work-detail/reanalyze-work?workDetailType=Image&itemType=9',
      promptRaw: 'Moebius (Jean Giraud)风格，极繁主义',
      imageSourceUrl: `http://127.0.0.1:${address.port}/sample.webp`,
      authorName: '',
      publishedAt: '',
      modelLabel: '',
      aspectRatio: ''
    };

    const db = openDatabase(dataDir);
    runMigrations(db);
    const repository = new WorkRepository(db);

    await ingestWork({
      repository,
      cacheDir: path.join(dataDir, 'cache', 'originals'),
      payload
    });

    const analyzer: StyleAnalyzer = {
      async analyzePrompt() {
        return {
          candidates: [
            {
              rawTerm: 'Moebius (Jean Giraud)风格',
              normalizedCandidate: 'Moebius (Jean Giraud)',
              termType: 'artist_style',
              confidence: 0.96,
              shouldBeStyleTag: true,
              shortExplanation: '法式科幻漫画式线稿与色彩控制'
            }
          ]
        };
      }
    };

    const second = await ingestWork({
      repository,
      cacheDir: path.join(dataDir, 'cache', 'originals'),
      payload,
      styleAnalyzer: analyzer
    });

    const work = db
      .prepare(
        `
          SELECT ingest_status
          FROM works
          WHERE source_work_id = ?
        `
      )
      .get('reanalyze-work') as { ingest_status: string } | undefined;
    const styles = db.prepare('SELECT COUNT(*) AS count FROM work_styles').get() as { count: number };
    const runs = db.prepare('SELECT COUNT(*) AS count FROM analysis_runs').get() as { count: number };

    expect(second.status).toBe('already_collected');
    expect(work?.ingest_status).toBe('done');
    expect(styles.count).toBe(1);
    expect(runs.count).toBe(1);

    db.close();

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

  it('re-analyzes an already collected work after a previous analysis failure', async () => {
    const dataDir = './tmp/ingest-work-retry-failed-analysis';
    fs.rmSync(dataDir, { recursive: true, force: true });

    const imageBuffer = await sharp({
      create: {
        width: 7,
        height: 8,
        channels: 3,
        background: { r: 40, g: 80, b: 160 }
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
      throw new Error('failed to bind failed-analysis test server');
    }

    const payload: CollectWorkPayload = {
      sourceSite: 'jimeng',
      sourceWorkId: 'failed-analysis-work',
      sourceUrl:
        'https://jimeng.jianying.com/ai-tool/work-detail/failed-analysis-work?workDetailType=Image&itemType=9',
      promptRaw: '古风美男子，3D国漫风格',
      imageSourceUrl: `http://127.0.0.1:${address.port}/sample.webp`,
      authorName: '',
      publishedAt: '',
      modelLabel: '',
      aspectRatio: ''
    };

    const db = openDatabase(dataDir);
    runMigrations(db);
    const repository = new WorkRepository(db);

    const failingAnalyzer: StyleAnalyzer = {
      async analyzePrompt() {
        throw new Error('broken json');
      }
    };

    await ingestWork({
      repository,
      cacheDir: path.join(dataDir, 'cache', 'originals'),
      payload,
      styleAnalyzer: failingAnalyzer
    });

    const recoveryAnalyzer: StyleAnalyzer = {
      async analyzePrompt() {
        return {
          candidates: [
            {
              rawTerm: '3D国漫风格',
              normalizedCandidate: '3D国漫风格',
              termType: 'aesthetic_style',
              confidence: 0.94,
              shouldBeStyleTag: true,
              shortExplanation: '强调国产三维动画与国风角色塑造语汇'
            }
          ]
        };
      }
    };

    const second = await ingestWork({
      repository,
      cacheDir: path.join(dataDir, 'cache', 'originals'),
      payload,
      styleAnalyzer: recoveryAnalyzer
    });

    const work = db
      .prepare(
        `
          SELECT ingest_status
          FROM works
          WHERE source_work_id = ?
        `
      )
      .get('failed-analysis-work') as { ingest_status: string } | undefined;
    const styles = db.prepare('SELECT COUNT(*) AS count FROM work_styles').get() as { count: number };
    const runs = db
      .prepare('SELECT status FROM analysis_runs ORDER BY id')
      .all() as Array<{ status: string }>;

    expect(second.status).toBe('already_collected');
    expect(work?.ingest_status).toBe('done');
    expect(styles.count).toBe(1);
    expect(runs).toEqual([{ status: 'failed' }, { status: 'succeeded' }]);

    db.close();

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

  it('rebuilds the cached image when an already collected work receives a new image source url', async () => {
    const dataDir = './tmp/ingest-work-refresh-image';
    fs.rmSync(dataDir, { recursive: true, force: true });

    const wrongImageBuffer = await sharp({
      create: {
        width: 12,
        height: 5,
        channels: 3,
        background: { r: 140, g: 180, b: 240 }
      }
    })
      .webp()
      .toBuffer();

    const correctImageBuffer = await sharp({
      create: {
        width: 9,
        height: 16,
        channels: 3,
        background: { r: 200, g: 140, b: 80 }
      }
    })
      .webp()
      .toBuffer();

    const server = createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'image/webp' });
      if (req.url === '/correct.webp') {
        res.end(correctImageBuffer);
        return;
      }

      res.end(wrongImageBuffer);
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('failed to bind refresh-image test server');
    }

    const db = openDatabase(dataDir);
    runMigrations(db);
    const repository = new WorkRepository(db);

    const firstPayload: CollectWorkPayload = {
      sourceSite: 'jimeng',
      sourceWorkId: 'refresh-image-work',
      sourceUrl:
        'https://jimeng.jianying.com/ai-tool/work-detail/refresh-image-work?workDetailType=Image&itemType=9',
      promptRaw: '极简实验性平面插画',
      imageSourceUrl: `http://127.0.0.1:${address.port}/wrong.webp`,
      authorName: '',
      publishedAt: '',
      modelLabel: '图片4.6',
      aspectRatio: '9:16'
    };

    await ingestWork({
      repository,
      cacheDir: path.join(dataDir, 'cache', 'originals'),
      payload: firstPayload
    });

    const beforeRefresh = db
      .prepare(
        `
          SELECT image_sha256, width, height, image_source_url
          FROM works
          WHERE source_work_id = ?
        `
      )
      .get('refresh-image-work') as
      | {
          image_sha256: string;
          width: number;
          height: number;
          image_source_url: string;
        }
      | undefined;

    const second = await ingestWork({
      repository,
      cacheDir: path.join(dataDir, 'cache', 'originals'),
      payload: {
        ...firstPayload,
        imageSourceUrl: `http://127.0.0.1:${address.port}/correct.webp`
      }
    });

    const afterRefresh = db
      .prepare(
        `
          SELECT image_sha256, width, height, image_source_url
          FROM works
          WHERE source_work_id = ?
        `
      )
      .get('refresh-image-work') as
      | {
          image_sha256: string;
          width: number;
          height: number;
          image_source_url: string;
        }
      | undefined;

    expect(second.status).toBe('already_collected');
    expect(beforeRefresh?.image_source_url.endsWith('/wrong.webp')).toBe(true);
    expect(afterRefresh?.image_source_url.endsWith('/correct.webp')).toBe(true);
    expect(beforeRefresh?.image_sha256).not.toBe(afterRefresh?.image_sha256);
    expect(afterRefresh?.width).toBe(9);
    expect(afterRefresh?.height).toBe(16);

    db.close();

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

  it('uploads cached images to COS without blocking ingest success', async () => {
    const dataDir = './tmp/ingest-work-upload';
    fs.rmSync(dataDir, { recursive: true, force: true });

    const imageBuffer = await sharp({
      create: {
        width: 5,
        height: 5,
        channels: 3,
        background: { r: 44, g: 88, b: 166 }
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
      throw new Error('failed to bind upload test server');
    }

    const uploader: ImageUploader = {
      async uploadImage(input) {
        expect(input.sourceWorkId).toBe('upload-work');
        expect(input.localPath.endsWith(path.join('jimeng', 'upload-work.webp'))).toBe(true);
        return {
          key: 't2i-museum/originals/jimeng/upload-work.webp',
          url: 'https://example.cos.ap-singapore.myqcloud.com/t2i-museum/originals/jimeng/upload-work.webp',
          etag: 'etag-1'
        };
      }
    };

    const payload: CollectWorkPayload = {
      sourceSite: 'jimeng',
      sourceWorkId: 'upload-work',
      sourceUrl: 'https://jimeng.jianying.com/ai-tool/work-detail/upload-work?workDetailType=Image&itemType=9',
      promptRaw: '极繁主义',
      imageSourceUrl: `http://127.0.0.1:${address.port}/sample.webp`,
      authorName: '',
      publishedAt: '',
      modelLabel: '',
      aspectRatio: ''
    };

    const db = openDatabase(dataDir);
    runMigrations(db);
    const repository = new WorkRepository(db);

    await ingestWork({
      repository,
      cacheDir: path.join(dataDir, 'cache', 'originals'),
      payload,
      imageUploader: uploader
    });

    const row = db
      .prepare(
        `
          SELECT ingest_status, upload_status, cos_key, cos_url, cos_etag
          FROM works
          WHERE source_site = ? AND source_work_id = ?
        `
      )
      .get('jimeng', 'upload-work') as
      | {
          ingest_status: string;
          upload_status: string;
          cos_key: string;
          cos_url: string;
          cos_etag: string;
        }
      | undefined;

    expect(row).toEqual({
      ingest_status: 'done',
      upload_status: 'uploaded',
      cos_key: 't2i-museum/originals/jimeng/upload-work.webp',
      cos_url:
        'https://example.cos.ap-singapore.myqcloud.com/t2i-museum/originals/jimeng/upload-work.webp',
      cos_etag: 'etag-1'
    });

    db.close();

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
