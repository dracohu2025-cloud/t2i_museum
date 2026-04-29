import { createServer } from 'node:http';
import fs from 'node:fs';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import type { StyleAnalyzer } from '../services/style-analyzer';
import type { StyleEnricher } from '../services/style-enricher';
import { buildApp } from '../app';

async function createImageServer() {
  const imageBuffer = await sharp({
    create: {
      width: 5,
      height: 6,
      channels: 3,
      background: { r: 80, g: 30, b: 140 }
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
    throw new Error('failed to bind styles image server');
  }

  return {
    server,
    imageUrl: `http://127.0.0.1:${address.port}/sample.webp`
  };
}

function createTestAnalyzer(): StyleAnalyzer {
  return {
    async analyzePrompt({ promptRaw }) {
      if (promptRaw.includes('Moebius')) {
        return {
          candidates: [
            {
              rawTerm: 'Moebius (Jean Giraud)风格',
              normalizedCandidate: 'Moebius',
              termType: 'artist_style',
              confidence: 0.95,
              shouldBeStyleTag: true,
              shortExplanation: '法式科幻漫画式线稿与色彩控制'
            }
          ]
        };
      }

      if (promptRaw.includes('Solarpunk sketch')) {
        return {
          candidates: [
            {
              rawTerm: 'Solarpunk sketch',
              normalizedCandidate: 'Solarpunk sketch',
              termType: 'aesthetic_style',
              confidence: 0.88,
              shouldBeStyleTag: true,
              shortExplanation: '明亮生态未来感'
            }
          ]
        };
      }

      return {
        candidates: [
          {
            rawTerm: 'Sunlit ecofuturism',
            normalizedCandidate: 'Sunlit ecofuturism',
            termType: 'aesthetic_style',
            confidence: 0.84,
            shouldBeStyleTag: true,
            shortExplanation: '带自然气息的未来主义'
          }
        ]
      };
    }
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

describe('GET /api/styles', () => {
  it('returns style summaries and detail pages for canonicalized styles', async () => {
    const dataDir = './tmp/test-styles';
    fs.rmSync(dataDir, { recursive: true, force: true });

    const { server, imageUrl } = await createImageServer();
    const app = buildApp({
      dataDir,
      styleAnalyzer: createTestAnalyzer()
    });

    await app.inject({
      method: 'POST',
      url: '/api/collect',
      payload: {
        sourceSite: 'jimeng',
        sourceWorkId: 'style-route',
        sourceUrl: 'https://jimeng.jianying.com/ai-tool/work-detail/style-route?workDetailType=Image&itemType=9',
        promptRaw: 'Moebius (Jean Giraud)风格',
        imageSourceUrl: imageUrl
      }
    });
    await waitForWorkDone(app, 'style-route');

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/styles'
    });
    const detailRes = await app.inject({
      method: 'GET',
      url: '/api/styles/moebius-jean-giraud风格'
    });

    expect(listRes.statusCode).toBe(200);
    expect(listRes.json()).toEqual({
      items: [
        expect.objectContaining({
          slug: 'moebius-jean-giraud风格',
          name: 'Moebius (Jean Giraud)风格',
          termType: 'artist_style',
          shortDescription: expect.any(String),
          workCount: 1,
          heroImageUrl: expect.stringContaining('/media/cache/originals/jimeng/style-route.webp')
        })
      ]
    });
    expect(detailRes.statusCode).toBe(200);
    expect(detailRes.json()).toEqual({
      item: expect.objectContaining({
        slug: 'moebius-jean-giraud风格',
        name: 'Moebius (Jean Giraud)风格',
        narrative: expect.objectContaining({
          overview: expect.stringContaining('Jean Giraud'),
          lineage: expect.stringContaining('法国-比利时漫画'),
          characteristics: expect.stringContaining('平涂')
        }),
        aliases: expect.arrayContaining([
          expect.objectContaining({
            name: 'Moebius (Jean Giraud)风格'
          })
        ]),
        works: [
          expect.objectContaining({
            workId: 1,
            sourceWorkId: 'style-route'
          })
        ]
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

  it('updates style metadata and allows adding aliases', async () => {
    const dataDir = './tmp/test-style-admin-update';
    fs.rmSync(dataDir, { recursive: true, force: true });

    const { server, imageUrl } = await createImageServer();
    const app = buildApp({
      dataDir,
      styleAnalyzer: createTestAnalyzer()
    });

    await app.inject({
      method: 'POST',
      url: '/api/collect',
      payload: {
        sourceSite: 'jimeng',
        sourceWorkId: 'style-update',
        sourceUrl: 'https://jimeng.jianying.com/ai-tool/work-detail/style-update?workDetailType=Image&itemType=9',
        promptRaw: 'Moebius (Jean Giraud)风格',
        imageSourceUrl: imageUrl
      }
    });
    await waitForWorkDone(app, 'style-update');

    const patchRes = await app.inject({
      method: 'PATCH',
      url: '/api/styles/moebius-jean-giraud风格',
      payload: {
        name: 'Moebius Atlas',
        status: 'active',
        shortDescription: '手工修订后的法式科幻漫画说明。',
        visualTraits: '辽阔留白、细线轮廓、平涂色块。',
        promptHints: '强调旷野尺度与轻薄线稿。',
        heroWorkId: 1
      }
    });

    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json()).toEqual({
      item: expect.objectContaining({
        slug: 'moebius-atlas',
        name: 'Moebius Atlas',
        heroWorkId: 1,
        shortDescription: '手工修订后的法式科幻漫画说明。',
        visualTraits: '辽阔留白、细线轮廓、平涂色块。',
        promptHints: '强调旷野尺度与轻薄线稿。',
        works: expect.arrayContaining([
          expect.objectContaining({
            styles: [
              expect.objectContaining({
                slug: 'moebius-atlas'
              })
            ]
          })
        ])
      })
    });

    const aliasRes = await app.inject({
      method: 'POST',
      url: '/api/styles/moebius-atlas/aliases',
      payload: {
        aliasName: 'Giraud desert line art'
      }
    });

    expect(aliasRes.statusCode).toBe(200);
    expect(aliasRes.json()).toEqual({
      item: expect.objectContaining({
        slug: 'moebius-atlas',
        aliases: expect.arrayContaining([
          expect.objectContaining({
            name: 'Giraud desert line art'
          })
        ])
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

  it('fills placeholder style narratives from the configured style enricher on detail load', async () => {
    const dataDir = './tmp/test-style-detail-enrichment';
    fs.rmSync(dataDir, { recursive: true, force: true });

    const { server, imageUrl } = await createImageServer();
    const styleEnricher: StyleEnricher = {
      async enrichStyle(input) {
        expect(input.name).toBe('二次元动漫');
        return {
          shortDescription:
            '二次元动漫是一种源自动画、漫画和游戏角色视觉的审美风格，强调平面化造型、清晰轮廓和富有情绪表达的角色设计。',
          visualTraits:
            '典型特征包括明亮大眼、符号化发型、干净线稿、高明度色彩、柔和赛璐珞式光影，以及强调角色姿态和表情的构图。',
          promptHints:
            '它适合角色立绘、头像、幻想插画和轻叙事场景，和写实摄影或厚重 3D 渲染相比，更重视线条、色块和角色可读性。'
        };
      }
    };
    const app = buildApp({
      dataDir,
      styleEnricher
    });

    await app.inject({
      method: 'POST',
      url: '/api/collect',
      payload: {
        sourceSite: 'jimeng',
        sourceWorkId: 'style-detail-enrichment',
        sourceUrl:
          'https://jimeng.jianying.com/ai-tool/work-detail/style-detail-enrichment?workDetailType=Image&itemType=9',
        promptRaw: '二次元动漫风格，精致角色立绘，明亮眼睛',
        imageSourceUrl: imageUrl,
        approvedStyles: [
          {
            name: '二次元动漫',
            termType: 'aesthetic_style'
          }
        ]
      }
    });
    await waitForWorkDone(app, 'style-detail-enrichment');

    const detailRes = await app.inject({
      method: 'GET',
      url: `/api/styles/${encodeURIComponent('二次元动漫')}`
    });

    expect(detailRes.statusCode).toBe(200);
    expect(detailRes.json()).toEqual({
      item: expect.objectContaining({
        slug: '二次元动漫',
        shortDescription: expect.stringContaining('动画、漫画和游戏'),
        visualTraits: expect.stringContaining('赛璐珞'),
        promptHints: expect.stringContaining('角色立绘'),
        narrative: expect.objectContaining({
          overview: expect.stringContaining('二次元动漫是一种')
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

  it('merges one style into another and consolidates works', async () => {
    const dataDir = './tmp/test-style-admin-merge';
    fs.rmSync(dataDir, { recursive: true, force: true });

    const { server, imageUrl } = await createImageServer();
    const app = buildApp({
      dataDir,
      styleAnalyzer: createTestAnalyzer()
    });

    await app.inject({
      method: 'POST',
      url: '/api/collect',
      payload: {
        sourceSite: 'jimeng',
        sourceWorkId: 'merge-a',
        sourceUrl: 'https://jimeng.jianying.com/ai-tool/work-detail/merge-a?workDetailType=Image&itemType=9',
        promptRaw: 'Solarpunk sketch',
        imageSourceUrl: imageUrl
      }
    });
    await waitForWorkDone(app, 'merge-a');
    await app.inject({
      method: 'POST',
      url: '/api/collect',
      payload: {
        sourceSite: 'jimeng',
        sourceWorkId: 'merge-b',
        sourceUrl: 'https://jimeng.jianying.com/ai-tool/work-detail/merge-b?workDetailType=Image&itemType=9',
        promptRaw: 'Sunlit ecofuturism',
        imageSourceUrl: imageUrl
      }
    });
    await waitForWorkDone(app, 'merge-b');

    const mergeRes = await app.inject({
      method: 'POST',
      url: '/api/styles/sunlit-ecofuturism/merge',
      payload: {
        targetSlug: 'solarpunk-sketch'
      }
    });

    expect(mergeRes.statusCode).toBe(200);
    expect(mergeRes.json()).toEqual({
      item: expect.objectContaining({
        slug: 'solarpunk-sketch',
        works: expect.arrayContaining([
          expect.objectContaining({ sourceWorkId: 'merge-a' }),
          expect.objectContaining({ sourceWorkId: 'merge-b' })
        ]),
        aliases: expect.arrayContaining([
          expect.objectContaining({
            name: 'Sunlit ecofuturism'
          })
        ])
      }),
      redirectedFrom: 'sunlit-ecofuturism'
    });

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/styles'
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json()).toEqual({
      items: [
        expect.objectContaining({
          slug: 'solarpunk-sketch',
          workCount: 2
        })
      ]
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
