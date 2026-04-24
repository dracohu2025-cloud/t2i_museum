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
    expect(res.body).toContain('t2i_museum');
    expect(res.body).toContain('/api/styles');
    expect(res.body).toContain('/api/works/');
    expect(res.body).toContain('work-delete-trigger');

    const workRes = await app.inject({
      method: 'GET',
      url: '/museum/works/sample-work'
    });
    expect(workRes.statusCode).toBe(200);
    expect(workRes.headers['content-type']).toContain('text/html');

    await app.close();
  });
});
