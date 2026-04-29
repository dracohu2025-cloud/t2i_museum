import { createServer } from 'node:http';
import fs from 'node:fs';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { buildApp } from '../app';
import type { StyleAnalyzer } from '../services/style-analyzer';

async function createImageServer() {
  const imageBuffer = await sharp({
    create: {
      width: 6,
      height: 6,
      channels: 3,
      background: { r: 30, g: 90, b: 160 }
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
    throw new Error('failed to bind anki image server');
  }

  return {
    server,
    imageUrl: `http://127.0.0.1:${address.port}/sample.webp`
  };
}

async function waitForWorkDone(app: ReturnType<typeof buildApp>, sourceWorkId: string) {
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

describe('Anki review API', () => {
  it('returns reviewable cards and updates spaced repetition state', async () => {
    const dataDir = './tmp/test-anki-reviews';
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
              confidence: 0.95,
              shouldBeStyleTag: true,
              shortExplanation: '测试用插画风格'
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
        sourceWorkId: 'anki-work',
        sourceUrl: 'https://jimeng.jianying.com/ai-tool/work-detail/anki-work?workDetailType=Image&itemType=9',
        promptRaw: '治愈系高清壁纸，插画风格，一只巨大的粉白色沙猫。',
        imageSourceUrl: imageUrl
      }
    });
    await waitForWorkDone(app, 'anki-work');

    const cardsRes = await app.inject({
      method: 'GET',
      url: '/api/anki/cards'
    });
    expect(cardsRes.statusCode).toBe(200);
    const cardsPayload = cardsRes.json() as {
      items: Array<{
        workId: number;
        sourceWorkId: string;
        answer: { slug: string; name: string };
        review: { reviewCount: number; isDue: boolean };
      }>;
    };
    expect(cardsPayload.items).toEqual([
      expect.objectContaining({
        sourceWorkId: 'anki-work',
        answer: expect.objectContaining({
          name: '插画风格'
        }),
        review: expect.objectContaining({
          reviewCount: 0,
          isDue: true
        })
      })
    ]);

    const card = cardsPayload.items[0]!;
    const wrongRes = await app.inject({
      method: 'POST',
      url: '/api/anki/reviews',
      payload: {
        workId: card.workId,
        styleSlug: card.answer.slug,
        correct: false
      }
    });
    expect(wrongRes.statusCode).toBe(200);
    expect(wrongRes.json()).toEqual({
      item: expect.objectContaining({
        review: expect.objectContaining({
          reviewCount: 1,
          lapses: 1,
          correctStreak: 0,
          intervalDays: 0,
          isDue: true
        })
      })
    });

    const correctRes = await app.inject({
      method: 'POST',
      url: '/api/anki/reviews',
      payload: {
        workId: card.workId,
        styleSlug: card.answer.slug,
        correct: true
      }
    });
    expect(correctRes.statusCode).toBe(200);
    expect(correctRes.json()).toEqual({
      item: expect.objectContaining({
        review: expect.objectContaining({
          reviewCount: 2,
          lapses: 1,
          correctStreak: 1,
          intervalDays: 1,
          isDue: false
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
});
