import { describe, expect, it } from 'vitest';
import { collectWorkPayloadSchema } from './collect';

describe('collectWorkPayloadSchema', () => {
  it('accepts a Jimeng detail payload', () => {
    const parsed = collectWorkPayloadSchema.parse({
      sourceSite: 'jimeng',
      sourceWorkId: '7628721210028723466',
      sourceUrl: 'https://jimeng.jianying.com/ai-tool/work-detail/7628721210028723466?workDetailType=Image&itemType=9',
      promptRaw: 'Moebius (Jean Giraud)风格绘画，极繁主义',
      imageSourceUrl: 'https://example.com/work.webp',
      authorName: '啦啦乌卡吧啦啦',
      publishedAt: '2026-04-15',
      modelLabel: '图片 3.1',
      aspectRatio: '9:16'
    });

    expect(parsed.sourceWorkId).toBe('7628721210028723466');
  });

  it('accepts user-approved style tags', () => {
    const parsed = collectWorkPayloadSchema.parse({
      sourceSite: 'jimeng',
      sourceWorkId: '7628721210028723466',
      sourceUrl: 'https://jimeng.jianying.com/ai-tool/work-detail/7628721210028723466?workDetailType=Image&itemType=9',
      promptRaw: '动漫水彩',
      imageSourceUrl: 'https://example.com/work.webp',
      approvedStyles: [
        {
          name: '动漫水彩',
          termType: 'aesthetic_style'
        }
      ]
    });

    expect(parsed.approvedStyles[0]?.name).toBe('动漫水彩');
  });
});
