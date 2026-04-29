import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

import { buildApp } from '../app';

describe('GET /museum', () => {
  it('serves the museum shell page', async () => {
    const dataDir = './tmp/test-museum';
    fs.rmSync(dataDir, { recursive: true, force: true });

    const app = buildApp({ dataDir });
    const res = await app.inject({
      method: 'GET',
      url: '/museum'
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('Graphics Academy');
    expect(res.body).toContain('收集即梦图片样例，自动抽取绘画风格词');
    expect(res.body).toContain('/api/styles');
    expect(res.body).toContain('/api/works/');
    expect(res.body).toContain('work-delete-trigger');
    expect(res.body).toContain('id="anki-start-button"');
    expect(res.body).toContain('id="anki-practice-overlay"');
    expect(res.body).toContain('Anki 风格测试');
    expect(res.body).toContain('buildAnkiDeck');
    expect(res.body).toContain('/api/anki/cards');
    expect(res.body).toContain('/api/anki/reviews');
    expect(res.body).toContain('anki-card-shell');
    expect(res.body).toContain('excludeCardId');
    const inlineScript = res.body.match(/<script>([\s\S]*)<\/script>/)?.[1] ?? '';
    expect(() => new Function(inlineScript)).not.toThrow();

    const workRes = await app.inject({
      method: 'GET',
      url: '/museum/works/sample-work'
    });
    expect(workRes.statusCode).toBe(200);
    expect(workRes.headers['content-type']).toContain('text/html');

    await app.close();
  });
});
