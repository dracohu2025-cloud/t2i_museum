import Database from 'better-sqlite3';
import fs from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { buildApp } from '../app';
import type { StyleAnalyzer } from '../services/style-analyzer';

async function createImageServer() {
  const imageBuffer = await sharp({
    create: {
      width: 3,
      height: 4,
      channels: 3,
      background: { r: 180, g: 120, b: 10 }
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
    throw new Error('failed to bind image server');
  }

  return {
    server,
    imageUrl: `http://127.0.0.1:${address.port}/1.webp`
  };
}

async function waitForWorkStatus(
  dbPath: string,
  sourceSite: string,
  sourceWorkId: string,
  expectedStatus: string
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 5_000) {
    const db = new Database(dbPath, { readonly: true });
    const row = db
      .prepare(
        `
          SELECT ingest_status
          FROM works
          WHERE source_site = ? AND source_work_id = ?
        `
      )
      .get(sourceSite, sourceWorkId) as { ingest_status: string } | undefined;
    db.close();

    if (row?.ingest_status === expectedStatus) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(`timed out waiting for work ${sourceSite}/${sourceWorkId} to become ${expectedStatus}`);
}

describe('POST /api/collect', () => {
  it('stores the raw work as done after cache is persisted', async () => {
    const dataDir = './tmp/test-collect';
    fs.rmSync(dataDir, { recursive: true, force: true });
    const { server, imageUrl } = await createImageServer();

    const app = buildApp({ dataDir });
    const res = await app.inject({
      method: 'POST',
      url: '/api/collect',
      payload: {
        sourceSite: 'jimeng',
        sourceWorkId: 'w1',
        sourceUrl: 'https://jimeng.jianying.com/ai-tool/work-detail/w1?workDetailType=Image&itemType=9',
        promptRaw: 'Moebius (Jean Giraud)风格',
        imageSourceUrl: imageUrl
      }
    });

    expect(res.statusCode).toBe(202);
    expect(res.json().status).toBe('accepted');

    await waitForWorkStatus(path.join(dataDir, 'catalog.sqlite'), 'jimeng', 'w1', 'done');

    await app.close();

    const db = new Database(path.join(dataDir, 'catalog.sqlite'), { readonly: true });
    const row = db
      .prepare(
        `
          SELECT source_site, source_work_id, prompt_raw, ingest_status
          FROM works
          WHERE source_site = ? AND source_work_id = ?
        `
      )
      .get('jimeng', 'w1') as
      | {
          source_site: string;
          source_work_id: string;
          prompt_raw: string;
          ingest_status: string;
        }
      | undefined;

    expect(row).toEqual({
      source_site: 'jimeng',
      source_work_id: 'w1',
      prompt_raw: 'Moebius (Jean Giraud)风格',
      ingest_status: 'done'
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

  it('returns already_collected for duplicate sourceWorkId', async () => {
    const dataDir = './tmp/test-collect-duplicate';
    fs.rmSync(dataDir, { recursive: true, force: true });
    const { server, imageUrl } = await createImageServer();

    const app = buildApp({ dataDir });
    const payload = {
      sourceSite: 'jimeng',
      sourceWorkId: 'w1',
      sourceUrl: 'https://jimeng.jianying.com/ai-tool/work-detail/w1?workDetailType=Image&itemType=9',
      promptRaw: 'Moebius (Jean Giraud)风格',
      imageSourceUrl: imageUrl
    };

    const first = await app.inject({
      method: 'POST',
      url: '/api/collect',
      payload
    });
    const second = await app.inject({
      method: 'POST',
      url: '/api/collect',
      payload
    });

    expect(first.statusCode).toBe(202);
    expect(second.statusCode).toBe(200);
    expect(second.json().status).toBe('already_collected');

    await app.close();

    const db = new Database(path.join(dataDir, 'catalog.sqlite'), { readonly: true });
    const row = db.prepare('SELECT COUNT(*) AS count FROM works').get() as { count: number };
    expect(row.count).toBe(1);
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

  it('refreshes model metadata when an already collected work is collected again', async () => {
    const dataDir = './tmp/test-collect-duplicate-refresh';
    fs.rmSync(dataDir, { recursive: true, force: true });
    const { server, imageUrl } = await createImageServer();

    const app = buildApp({ dataDir });
    const sourceUrl =
      'https://jimeng.jianying.com/ai-tool/work-detail/w-model?workDetailType=Image&itemType=9';

    const first = await app.inject({
      method: 'POST',
      url: '/api/collect',
      payload: {
        sourceSite: 'jimeng',
        sourceWorkId: 'w-model',
        sourceUrl,
        promptRaw: 'Moebius (Jean Giraud)风格',
        imageSourceUrl: imageUrl
      }
    });

    expect(first.statusCode).toBe(202);
    await waitForWorkStatus(path.join(dataDir, 'catalog.sqlite'), 'jimeng', 'w-model', 'done');

    const second = await app.inject({
      method: 'POST',
      url: '/api/collect',
      payload: {
        sourceSite: 'jimeng',
        sourceWorkId: 'w-model',
        sourceUrl,
        promptRaw: 'Moebius (Jean Giraud)风格',
        imageSourceUrl: imageUrl,
        modelLabel: '图片4.6',
        aspectRatio: '9:16'
      }
    });

    expect(second.statusCode).toBe(200);
    expect(second.json().status).toBe('already_collected');

    await app.close();

    const db = new Database(path.join(dataDir, 'catalog.sqlite'), { readonly: true });
    const row = db
      .prepare(
        `
          SELECT model_label, aspect_ratio
          FROM works
          WHERE source_site = 'jimeng' AND source_work_id = 'w-model'
        `
      )
      .get() as { model_label: string; aspect_ratio: string } | undefined;
    expect(row).toEqual({
      model_label: '图片4.6',
      aspect_ratio: '9:16'
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

  it('previews style tags without storing the work', async () => {
    const dataDir = './tmp/test-collect-preview';
    fs.rmSync(dataDir, { recursive: true, force: true });
    const { server, imageUrl } = await createImageServer();
    const styleAnalyzer: StyleAnalyzer = {
      async analyzePrompt() {
        return {
          candidates: [
            {
              rawTerm: '动漫水彩',
              normalizedCandidate: '动漫水彩',
              termType: 'aesthetic_style',
              confidence: 0.9,
              shouldBeStyleTag: true,
              shortExplanation: 'prompt 中显式出现的风格词'
            }
          ]
        };
      }
    };

    const app = buildApp({ dataDir, styleAnalyzer });
    const res = await app.inject({
      method: 'POST',
      url: '/api/collect/preview',
      payload: {
        sourceSite: 'jimeng',
        sourceWorkId: 'w-preview',
        sourceUrl: 'https://jimeng.jianying.com/ai-tool/work-detail/w-preview?workDetailType=Image&itemType=9',
        promptRaw: '动漫水彩',
        imageSourceUrl: imageUrl
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().candidates).toEqual([
      expect.objectContaining({
        name: '动漫水彩',
        rawTerm: '动漫水彩',
        existsInCatalog: false
      })
    ]);

    await app.close();

    const db = new Database(path.join(dataDir, 'catalog.sqlite'), { readonly: true });
    const row = db.prepare('SELECT COUNT(*) AS count FROM works').get() as { count: number };
    expect(row.count).toBe(0);
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

  it('stores user-approved styles instead of re-running free extraction', async () => {
    const dataDir = './tmp/test-collect-approved-styles';
    fs.rmSync(dataDir, { recursive: true, force: true });
    const { server, imageUrl } = await createImageServer();

    const app = buildApp({ dataDir });
    const res = await app.inject({
      method: 'POST',
      url: '/api/collect',
      payload: {
        sourceSite: 'jimeng',
        sourceWorkId: 'w-approved',
        sourceUrl: 'https://jimeng.jianying.com/ai-tool/work-detail/w-approved?workDetailType=Image&itemType=9',
        promptRaw: '动漫水彩',
        imageSourceUrl: imageUrl,
        approvedStyles: [
          {
            name: '动漫水彩',
            termType: 'aesthetic_style'
          }
        ]
      }
    });

    expect(res.statusCode).toBe(202);
    await waitForWorkStatus(path.join(dataDir, 'catalog.sqlite'), 'jimeng', 'w-approved', 'done');
    await app.close();

    const db = new Database(path.join(dataDir, 'catalog.sqlite'), { readonly: true });
    const styles = db
      .prepare(
        `
          SELECT styles.name, work_styles.source
          FROM work_styles
          INNER JOIN styles ON styles.id = work_styles.style_id
        `
      )
      .all() as Array<{ name: string; source: string }>;
    expect(styles).toEqual([{ name: '动漫水彩', source: 'user' }]);
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
