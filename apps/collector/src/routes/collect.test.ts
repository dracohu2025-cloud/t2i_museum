import Database from 'better-sqlite3';
import fs from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { buildApp } from '../app';
import type { StyleAnalyzer } from '../services/style-analyzer';
import type { StyleEnricher } from '../services/style-enricher';

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

async function waitForStyleNarrative(dbPath: string, styleName: string) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 5_000) {
    const db = new Database(dbPath, { readonly: true });
    const row = db
      .prepare(
        `
          SELECT short_description, visual_traits, prompt_hints
          FROM styles
          WHERE name = ?
          LIMIT 1
        `
      )
      .get(styleName) as
      | {
          short_description: string;
          visual_traits: string;
          prompt_hints: string;
        }
      | undefined;
    db.close();

    if (row?.visual_traits && row.prompt_hints) {
      return row;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(`timed out waiting for style ${styleName} narrative`);
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

  it('falls back to heuristic preview candidates when online analysis fails', async () => {
    const dataDir = './tmp/test-collect-preview-heuristic-fallback';
    fs.rmSync(dataDir, { recursive: true, force: true });
    const { server, imageUrl } = await createImageServer();
    const styleAnalyzer: StyleAnalyzer = {
      async analyzePrompt() {
        throw new Error('preview timeout');
      }
    };

    const app = buildApp({ dataDir, styleAnalyzer });
    const res = await app.inject({
      method: 'POST',
      url: '/api/collect/preview',
      payload: {
        sourceSite: 'jimeng',
        sourceWorkId: 'w-preview-fallback',
        sourceUrl:
          'https://jimeng.jianying.com/ai-tool/work-detail/w-preview-fallback?workDetailType=Image&itemType=9',
        promptRaw: '治愈系高清壁纸，插画风格，一只巨大的粉白色沙猫。',
        imageSourceUrl: imageUrl
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().candidates).toEqual([
      expect.objectContaining({
        name: '插画风格',
        rawTerm: '插画风格'
      })
    ]);

    await app.close();
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

  it('previews the explicit 风格 suffix even when the short form already exists in catalog', async () => {
    const dataDir = './tmp/test-collect-preview-style-suffix';
    fs.rmSync(dataDir, { recursive: true, force: true });
    const { server, imageUrl } = await createImageServer();
    const styleAnalyzer: StyleAnalyzer = {
      async analyzePrompt() {
        return {
          candidates: [
            {
              rawTerm: '插画风格',
              normalizedCandidate: '插画风格',
              termType: 'medium_rendering',
              confidence: 0.9,
              shouldBeStyleTag: true,
              shortExplanation: 'prompt 中显式出现的风格词'
            }
          ]
        };
      }
    };

    const app = buildApp({ dataDir, styleAnalyzer });
    app.collectorDb
      .prepare(
        `
          INSERT INTO styles (slug, name, term_type, status, short_description)
          VALUES ('插画', '插画', 'medium_rendering', 'active', '旧词库短名')
        `
      )
      .run();
    app.collectorDb
      .prepare(
        `
          INSERT INTO style_aliases (style_id, alias_name, alias_norm, source, confidence)
          VALUES (1, '插画', '插画', 'manual', 1)
        `
      )
      .run();

    const res = await app.inject({
      method: 'POST',
      url: '/api/collect/preview',
      payload: {
        sourceSite: 'jimeng',
        sourceWorkId: 'w-preview-style-suffix',
        sourceUrl:
          'https://jimeng.jianying.com/ai-tool/work-detail/w-preview-style-suffix?workDetailType=Image&itemType=9',
        promptRaw: '治愈系高清壁纸，插画风格，一只巨大的粉白色沙猫。',
        imageSourceUrl: imageUrl
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().candidates).toEqual([
      expect.objectContaining({
        name: '插画风格',
        rawTerm: '插画风格',
        existsInCatalog: true
      })
    ]);

    await app.close();
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

  it('previews the explicit 主义 suffix even when the short form already exists in catalog', async () => {
    const dataDir = './tmp/test-collect-preview-ism-suffix';
    fs.rmSync(dataDir, { recursive: true, force: true });
    const { server, imageUrl } = await createImageServer();
    const styleAnalyzer: StyleAnalyzer = {
      async analyzePrompt() {
        return {
          candidates: [
            {
              rawTerm: '极简主义',
              normalizedCandidate: '极简主义',
              termType: 'movement_style',
              confidence: 0.9,
              shouldBeStyleTag: true,
              shortExplanation: 'prompt 中显式出现的主义词'
            }
          ]
        };
      }
    };

    const app = buildApp({ dataDir, styleAnalyzer });
    app.collectorDb
      .prepare(
        `
          INSERT INTO styles (slug, name, term_type, status, short_description)
          VALUES ('极简', '极简', 'aesthetic_style', 'active', '旧词库短名')
        `
      )
      .run();
    app.collectorDb
      .prepare(
        `
          INSERT INTO style_aliases (style_id, alias_name, alias_norm, source, confidence)
          VALUES (1, '极简', '极简', 'manual', 1)
        `
      )
      .run();

    const res = await app.inject({
      method: 'POST',
      url: '/api/collect/preview',
      payload: {
        sourceSite: 'jimeng',
        sourceWorkId: 'w-preview-ism-suffix',
        sourceUrl:
          'https://jimeng.jianying.com/ai-tool/work-detail/w-preview-ism-suffix?workDetailType=Image&itemType=9',
        promptRaw: '极简主义构图，留白，冷静的线条。',
        imageSourceUrl: imageUrl
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().candidates).toEqual([
      expect.objectContaining({
        name: '极简主义',
        rawTerm: '极简主义',
        existsInCatalog: true
      })
    ]);

    await app.close();
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

  it('asynchronously enriches newly created style keywords with narrative fields', async () => {
    const dataDir = './tmp/test-collect-style-enrichment';
    fs.rmSync(dataDir, { recursive: true, force: true });
    const { server, imageUrl } = await createImageServer();
    const styleEnricher: StyleEnricher = {
      async enrichStyle(input) {
        expect(input.name).toBe('BJD');
        expect(input.evidencePrompts[0]).toContain('BJD');
        return {
          shortDescription:
            'BJD 在图像生成语境里通常指球形关节人偶式审美，强调人偶般精致、略带非现实感的人物质感。',
          visualTraits:
            '典型特征包括瓷白或树脂感皮肤、清晰可见的关节结构、精修五官、玻璃眼珠般的凝视，以及华丽服饰与舞台化姿态。',
          promptHints:
            '它常和洛丽塔、哥特、古典人像、娃娃摄影或精致立绘并用，需要和普通“美女人像”区分开人偶结构和材质感。'
        };
      }
    };

    const app = buildApp({ dataDir, styleEnricher });
    const dbPath = path.join(dataDir, 'catalog.sqlite');
    const res = await app.inject({
      method: 'POST',
      url: '/api/collect',
      payload: {
        sourceSite: 'jimeng',
        sourceWorkId: 'w-style-enrichment',
        sourceUrl:
          'https://jimeng.jianying.com/ai-tool/work-detail/w-style-enrichment?workDetailType=Image&itemType=9',
        promptRaw: 'BJD风格美人，全身写实，油画重彩',
        imageSourceUrl: imageUrl,
        approvedStyles: [
          {
            name: 'BJD',
            termType: 'aesthetic_style'
          }
        ]
      }
    });

    expect(res.statusCode).toBe(202);
    await waitForWorkStatus(dbPath, 'jimeng', 'w-style-enrichment', 'done');
    const style = await waitForStyleNarrative(dbPath, 'BJD');
    expect(style.short_description).toContain('球形关节人偶');
    expect(style.visual_traits).toContain('关节结构');
    expect(style.prompt_hints).toContain('娃娃摄影');

    await app.close();
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
