import { createServer } from 'node:http';
import fs from 'node:fs';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import type { StyleAnalyzer } from '../services/style-analyzer';
import { buildApp } from '../app';
import type { ImageUploader } from '../services/image-uploader';

async function createImageServer() {
  const imageBuffer = await sharp({
    create: {
      width: 5,
      height: 6,
      channels: 3,
      background: { r: 120, g: 10, b: 90 }
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
    throw new Error('failed to bind works image server');
  }

  return {
    server,
    imageUrl: `http://127.0.0.1:${address.port}/sample.webp`
  };
}

async function waitForWorkDone(
  app: ReturnType<typeof buildApp>,
  sourceWorkId: string
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 5_000) {
    const response = await app.inject({
      method: 'GET',
      url: `/api/works/${sourceWorkId}`
    });

    if (response.statusCode === 200) {
      const detail = response.json() as {
        item?: {
          progress?: {
            isTerminal?: boolean;
            isSuccess?: boolean;
          };
        };
      };

      if (detail.item?.progress?.isTerminal && detail.item.progress.isSuccess) {
        return;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(`timed out waiting for ${sourceWorkId} to finish ingest`);
}

describe('GET /api/works', () => {
  it('returns works with resolved styles and work detail payloads', async () => {
    const dataDir = './tmp/test-works';
    fs.rmSync(dataDir, { recursive: true, force: true });

    const { server, imageUrl } = await createImageServer();
    const styleAnalyzer: StyleAnalyzer = {
      async analyzePrompt() {
        return {
          candidates: [
            {
              rawTerm: 'Moebius (Jean Giraud)风格',
              normalizedCandidate: 'Moebius (Jean Giraud)',
              termType: 'artist_style',
              confidence: 0.95,
              shouldBeStyleTag: true,
              shortExplanation: '法式科幻漫画式线稿与色彩控制'
            }
          ]
        };
      }
    };
    const imageUploader: ImageUploader = {
      async uploadImage() {
        return {
          key: 't2i-museum/originals/jimeng/works-route.webp',
          url: 'https://example.cos.ap-singapore.myqcloud.com/t2i-museum/originals/jimeng/works-route.webp',
          etag: 'etag-works-route'
        };
      }
    };

    const app = buildApp({
      dataDir,
      styleAnalyzer,
      imageUploader
    });

    await app.inject({
      method: 'POST',
      url: '/api/collect',
      payload: {
        sourceSite: 'jimeng',
        sourceWorkId: 'works-route',
        sourceUrl: 'https://jimeng.jianying.com/ai-tool/work-detail/works-route?workDetailType=Image&itemType=9',
        promptRaw: 'Moebius (Jean Giraud)风格',
        imageSourceUrl: imageUrl
      }
    });
    await waitForWorkDone(app, 'works-route');
    await app.inject({
      method: 'POST',
      url: '/api/collect',
      payload: {
        sourceSite: 'jimeng',
        sourceWorkId: 'works-route-2',
        sourceUrl:
          'https://jimeng.jianying.com/ai-tool/work-detail/works-route-2?workDetailType=Image&itemType=9',
        promptRaw: 'Moebius (Jean Giraud)风格 第二张',
        imageSourceUrl: imageUrl
      }
    });
    await waitForWorkDone(app, 'works-route-2');

    const res = await app.inject({
      method: 'GET',
      url: '/api/works'
    });
    const detailRes = await app.inject({
      method: 'GET',
      url: '/api/works/works-route'
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      items: expect.arrayContaining([
        expect.objectContaining({
          sourceWorkId: 'works-route',
          sourceUrl:
            'https://jimeng.jianying.com/ai-tool/work-detail/works-route?workDetailType=Image&itemType=9',
          promptRaw: 'Moebius (Jean Giraud)风格',
          imageLocalPath: expect.stringContaining('works-route.webp'),
          imageUrl:
            'https://example.cos.ap-singapore.myqcloud.com/t2i-museum/originals/jimeng/works-route.webp',
          ingestStatus: 'done',
          styles: [
            {
              name: 'Moebius (Jean Giraud)',
              slug: 'moebius-jean-giraud',
              status: 'active',
              isPrimary: true
            }
          ]
        })
      ])
    });
    expect(detailRes.statusCode).toBe(200);
    expect(detailRes.json()).toEqual({
      item: expect.objectContaining({
        sourceWorkId: 'works-route',
        imageUrl:
          'https://example.cos.ap-singapore.myqcloud.com/t2i-museum/originals/jimeng/works-route.webp',
        styles: [
          {
            name: 'Moebius (Jean Giraud)',
            slug: 'moebius-jean-giraud',
            status: 'active',
            isPrimary: true
          }
        ],
        relatedWorks: [
          expect.objectContaining({
            sourceWorkId: 'works-route-2'
          })
        ],
        progress: expect.objectContaining({
          stageKey: 'done',
          percent: 100,
          isSuccess: true
        })
      })
    });

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

  it('deletes a work and its derived relations from the catalog', async () => {
    const dataDir = './tmp/test-works-delete';
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
              confidence: 0.92,
              shouldBeStyleTag: true,
              shortExplanation: '强调删繁就简的视觉秩序'
            }
          ]
        };
      }
    };

    const app = buildApp({
      dataDir,
      styleAnalyzer
    });

    await app.inject({
      method: 'POST',
      url: '/api/collect',
      payload: {
        sourceSite: 'jimeng',
        sourceWorkId: 'delete-work',
        sourceUrl: 'https://jimeng.jianying.com/ai-tool/work-detail/delete-work?workDetailType=Image&itemType=9',
        promptRaw: '极简主义',
        imageSourceUrl: imageUrl
      }
    });
    await waitForWorkDone(app, 'delete-work');

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: '/api/works/delete-work'
    });
    const detailRes = await app.inject({
      method: 'GET',
      url: '/api/works/delete-work'
    });
    const stylesRes = await app.inject({
      method: 'GET',
      url: '/api/styles'
    });

    expect(deleteRes.statusCode).toBe(200);
    expect(deleteRes.json()).toEqual({
      status: 'deleted',
      item: {
        workId: expect.any(Number),
        sourceWorkId: 'delete-work'
      }
    });
    expect(detailRes.statusCode).toBe(404);
    expect(stylesRes.json()).toEqual({
      items: []
    });

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
