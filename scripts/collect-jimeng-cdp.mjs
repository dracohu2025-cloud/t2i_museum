#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const [target] = process.argv.slice(2);

if (!target) {
  console.error('Usage: node scripts/collect-jimeng-cdp.mjs <targetIdPrefix>');
  process.exit(1);
}

const cdpScript =
  process.env.CDP_HELPER_SCRIPT ??
  '/Users/dracohu/.agents/skills/chrome-cdp/scripts/cdp.mjs';
const collectApiUrl = process.env.COLLECT_API_URL ?? 'http://127.0.0.1:4317/api/collect';

const extractExpression = `(() => {
  const textOf = (element) => element?.textContent?.trim?.() ?? '';
  const findPrompt = () => {
    const selectors = [
      '.prompt-value-container-lIP4pF',
      '.prompt-value-text-cJL62n',
      '.prompt-value-H7u3lm'
    ];

    for (const selector of selectors) {
      const value = textOf(document.querySelector(selector));
      if (value) {
        return value;
      }
    }

    const promptLabel = Array.from(document.querySelectorAll('*')).find(
      (element) => textOf(element) === '图片提示词'
    );

    if (!promptLabel?.parentElement) {
      throw new Error('failed to locate prompt text');
    }

    const promptValue = Array.from(promptLabel.parentElement.children).find(
      (element) => element !== promptLabel && textOf(element)
    );

    const value = textOf(promptValue);
    if (!value) {
      throw new Error('failed to resolve prompt value');
    }

    return value;
  };

  const findLargestImage = () =>
    Array.from(document.images)
      .filter((image) => {
        const src = image.currentSrc || image.src;
        return Boolean(src) && !src.startsWith('data:');
      })
      .sort((left, right) => {
        const leftArea = (left.naturalWidth || left.width) * (left.naturalHeight || left.height);
        const rightArea = (right.naturalWidth || right.width) * (right.naturalHeight || right.height);
        return rightArea - leftArea;
      })[0];

  const findAuthorAndDate = () => {
    const textNodes = Array.from(document.querySelectorAll('span,div,p'))
      .map((element) => textOf(element))
      .filter(Boolean);
    const dateIndex = textNodes.findIndex((value) => /^\\d{4}-\\d{2}-\\d{2}$/.test(value));

    return {
      authorName: dateIndex > 0 ? textNodes[dateIndex - 1] : '',
      publishedAt: dateIndex >= 0 ? textNodes[dateIndex] : ''
    };
  };

  const findTagText = (matcherSource) => {
    const matcher = new RegExp(matcherSource);
    const values = Array.from(document.querySelectorAll('.prompt-tags-Ixl0vJ span, .prompt-tags-Ixl0vJ div'))
      .map((element) => textOf(element))
      .filter(Boolean);

    return values.find((value) => matcher.test(value)) ?? '';
  };

  const url = location.href;
  const workId = url.match(/\\/work-detail\\/([^/?]+)/)?.[1] ?? '';
  const image = findLargestImage();
  const meta = findAuthorAndDate();

  return {
    sourceSite: 'jimeng',
    sourceWorkId: workId,
    sourceUrl: url,
    promptRaw: findPrompt(),
    imageSourceUrl: image?.currentSrc || image?.src || '',
    authorName: meta.authorName,
    publishedAt: meta.publishedAt,
    modelLabel: findTagText('^图片 '),
    aspectRatio: findTagText('^\\\\d+:\\\\d+$')
  };
})()`;

async function main() {
  const { stdout } = await execFileAsync(cdpScript, ['eval', target, extractExpression], {
    maxBuffer: 1024 * 1024 * 4
  });

  const payload = JSON.parse(stdout.trim());
  const response = await fetch(collectApiUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const body = await response.text();
  if (!response.ok) {
    console.error(body);
    process.exit(1);
  }

  console.log(body);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
