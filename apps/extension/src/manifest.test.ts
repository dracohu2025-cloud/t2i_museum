import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('extension manifest', () => {
  it('loads the content script on all Jimeng pages so SPA detail navigation can be detected', () => {
    const manifest = JSON.parse(
      readFileSync(new URL('../public/manifest.json', import.meta.url), 'utf8')
    ) as {
      content_scripts?: Array<{ matches?: string[] }>;
    };

    expect(manifest.content_scripts?.[0]?.matches).toContain('https://jimeng.jianying.com/*');
  });
});
