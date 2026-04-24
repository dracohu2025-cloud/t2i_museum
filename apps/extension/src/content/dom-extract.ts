import type { CollectWorkPayload } from '@t2i/contracts';

function textOf(element: Element | null | undefined): string {
  return element?.textContent?.trim() ?? '';
}

function parseAspectRatio(value: string): number | undefined {
  const match = value.match(/^(\d+):(\d+)$/);
  if (!match) {
    return undefined;
  }

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return undefined;
  }

  return width / height;
}

function findPrompt(root: Document): string {
  const selectors = [
    '.prompt-value-container-lIP4pF',
    '.prompt-value-text-cJL62n',
    '.prompt-value-H7u3lm'
  ];

  for (const selector of selectors) {
    const text = textOf(root.querySelector(selector));
    if (text) {
      return text;
    }
  }

  const promptLabel = Array.from(root.querySelectorAll('*')).find(
    (element) => textOf(element) === '图片提示词'
  );

  if (!promptLabel?.parentElement) {
    throw new Error('failed to locate prompt text');
  }

  const promptValue = Array.from(promptLabel.parentElement.children).find(
    (element) => element !== promptLabel && textOf(element)
  );

  const text = textOf(promptValue);
  if (!text) {
    throw new Error('failed to resolve prompt value');
  }

  return text;
}

function getImageMetrics(image: HTMLImageElement) {
  const width = image.naturalWidth || image.width || image.clientWidth || 0;
  const height = image.naturalHeight || image.height || image.clientHeight || 0;

  return {
    width,
    height,
    area: width * height,
    ratio: width > 0 && height > 0 ? width / height : 0
  };
}

function isVisibleImage(root: Document, image: HTMLImageElement) {
  const style = root.defaultView?.getComputedStyle(image);
  if (!style) {
    return true;
  }

  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

function isAspectRatioMatch(candidateRatio: number, expectedRatio: number) {
  if (candidateRatio <= 0 || expectedRatio <= 0) {
    return false;
  }

  return Math.abs(Math.log(candidateRatio / expectedRatio)) <= 0.4;
}

function findPrimaryImage(root: Document, expectedAspectRatio?: string): HTMLImageElement | undefined {
  const expectedRatio = parseAspectRatio(expectedAspectRatio ?? '');
  const candidates = Array.from(root.images)
    .filter((image) => {
      const src = image.currentSrc || image.src;
      if (!src || src.startsWith('data:') || !isVisibleImage(root, image)) {
        return false;
      }

      const metrics = getImageMetrics(image);
      return metrics.area > 0;
    })
    .map((image) => ({
      image,
      metrics: getImageMetrics(image)
    }));

  const ratioMatched = expectedRatio
    ? candidates.filter((candidate) => isAspectRatioMatch(candidate.metrics.ratio, expectedRatio))
    : [];

  const pool = ratioMatched.length > 0 ? ratioMatched : candidates;

  return pool
    .sort((left, right) => {
      if (expectedRatio) {
        const ratioDelta =
          Math.abs(left.metrics.ratio - expectedRatio) - Math.abs(right.metrics.ratio - expectedRatio);
        if (ratioDelta !== 0) {
          return ratioDelta;
        }
      }

      return right.metrics.area - left.metrics.area;
    })
    .map((candidate) => candidate.image)[0];
}

function findAuthorAndDate(root: Document) {
  const textNodes = Array.from(root.querySelectorAll('span,div,p'))
    .map((element) => textOf(element))
    .filter(Boolean);
  const dateIndex = textNodes.findIndex((value) => /^\d{4}-\d{2}-\d{2}$/.test(value));

  return {
    authorName: dateIndex > 0 ? textNodes[dateIndex - 1] : '',
    publishedAt: dateIndex >= 0 ? textNodes[dateIndex] : ''
  };
}

function findTagText(root: Document, matcher: (value: string) => boolean): string {
  const values = Array.from(root.querySelectorAll('.prompt-tags-Ixl0vJ span, .prompt-tags-Ixl0vJ div'))
    .map((element) => textOf(element))
    .filter(Boolean);

  return values.find(matcher) ?? '';
}

export function extractJimengDetailPayload(root: Document): CollectWorkPayload {
  const url = root.defaultView?.location.href ?? globalThis.location?.href ?? '';
  const workId = url.match(/\/work-detail\/([^/?]+)/)?.[1] ?? '';
  const { authorName, publishedAt } = findAuthorAndDate(root);
  const aspectRatio = findTagText(root, (value) => /^\d+:\d+$/.test(value));
  const image = findPrimaryImage(root, aspectRatio);

  return {
    sourceSite: 'jimeng',
    sourceWorkId: workId,
    sourceUrl: url,
    promptRaw: findPrompt(root),
    imageSourceUrl: image?.currentSrc || image?.src || '',
    authorName,
    publishedAt,
    modelLabel: findTagText(root, (value) => /^图片\s*\d+(?:\.\d+)?$/u.test(value)),
    aspectRatio,
    approvedStyles: []
  };
}
