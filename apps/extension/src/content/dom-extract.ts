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

const DETAIL_IMAGE_SELECTORS = [
  '.image-player-KCJSe1 img',
  '.image-player-container-V9ZRXE img',
  '.image-player-content-Ml9sbe img',
  '.image-left-content-myH1iF img',
  '.preview-area-QscVpt img',
  '.lv-modal img.image-eTuIBd',
  'img.image-eTuIBd'
].join(',');

function hasUsableImageSource(image: HTMLImageElement) {
  return Boolean(getImageSource(image));
}

function isVisibleImage(root: Document, image: HTMLImageElement) {
  const style = root.defaultView?.getComputedStyle(image);
  if (!style) {
    return true;
  }

  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

function isViewportIntersecting(root: Document, image: HTMLImageElement) {
  const rect = image.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return true;
  }

  const viewportWidth = root.defaultView?.innerWidth ?? root.documentElement.clientWidth;
  const viewportHeight = root.defaultView?.innerHeight ?? root.documentElement.clientHeight;
  if (!viewportWidth || !viewportHeight) {
    return true;
  }

  return rect.bottom > 0 && rect.right > 0 && rect.top < viewportHeight && rect.left < viewportWidth;
}

function isAspectRatioMatch(candidateRatio: number, expectedRatio: number) {
  if (candidateRatio <= 0 || expectedRatio <= 0) {
    return false;
  }

  const ratio = candidateRatio / expectedRatio;
  return ratio >= 0.9 && ratio <= 1.1;
}

function readFirstSrcsetUrl(srcset: string | null) {
  return srcset
    ?.split(',')
    .map((item) => item.trim().split(/\s+/)[0])
    .find(Boolean) ?? '';
}

function getImageSource(image: HTMLImageElement) {
  const directSource =
    image.currentSrc ||
    image.src ||
    image.getAttribute('src') ||
    readFirstSrcsetUrl(image.getAttribute('srcset'));

  if (directSource && !directSource.startsWith('data:')) {
    return directSource;
  }

  const lazySource =
    image.getAttribute('data-src') ||
    image.getAttribute('data-original') ||
    image.getAttribute('data-url') ||
    image.getAttribute('data-image-url') ||
    readFirstSrcsetUrl(image.closest('picture')?.querySelector('source')?.getAttribute('srcset') ?? null);

  return lazySource && !lazySource.startsWith('data:') ? lazySource : '';
}

function findPromptElement(root: Document): Element | null {
  const selectors = [
    '.prompt-value-container-lIP4pF',
    '.prompt-value-text-cJL62n',
    '.prompt-value-H7u3lm'
  ];

  for (const selector of selectors) {
    const el = root.querySelector(selector);
    if (el) {
      return el;
    }
  }

  return Array.from(root.querySelectorAll('*')).find(
    (element) => textOf(element) === '图片提示词'
  ) ?? null;
}

function isLikelyThumbnail(src: string): boolean {
  return /thumbnail|thumb[^b]|\bsmall\b|preview|mini|icon|avatar|\b\d{2,3}x\d{2,3}\b/i.test(src);
}

function isGalleryCoverImage(image: HTMLImageElement) {
  return /\bcover-/i.test(String(image.className));
}

function getDetailImages(root: Document) {
  return Array.from(root.querySelectorAll<HTMLImageElement>(DETAIL_IMAGE_SELECTORS));
}

export function hasLoadedJimengDetailImage(root: Document) {
  return getDetailImages(root).some((image) => {
    const metrics = getImageMetrics(image);
    const source = getImageSource(image);
    return (
      Boolean(source) &&
      isVisibleImage(root, image) &&
      isViewportIntersecting(root, image) &&
      (metrics.width >= 300 || !isLikelyThumbnail(source)) &&
      (metrics.height >= 300 || !isLikelyThumbnail(source))
    );
  });
}

function findPrimaryImage(root: Document, expectedAspectRatio?: string): HTMLImageElement | undefined {
  const expectedRatio = parseAspectRatio(expectedAspectRatio ?? '');

  const buildCandidates = (images: HTMLImageElement[], options: { allowUnmeasured?: boolean } = {}) =>
    images
      .filter((image) => hasUsableImageSource(image) && isVisibleImage(root, image))
      .map((image) => ({
        image,
        source: getImageSource(image),
        metrics: getImageMetrics(image),
        isLoaded: image.naturalWidth > 0
      }))
      .filter((c) => {
        if (c.metrics.width >= 80 && c.metrics.height >= 80) {
          return true;
        }

        return Boolean(options.allowUnmeasured && c.source && !isLikelyThumbnail(c.source));
      });

  const chooseWinner = (nextCandidates: ReturnType<typeof buildCandidates>) => {
    let candidates = nextCandidates;
    if (expectedRatio) {
      const ratioMatched = candidates.filter((c) => isAspectRatioMatch(c.metrics.ratio, expectedRatio));
      if (ratioMatched.length > 0) {
        candidates = ratioMatched;
      }
    }

    return candidates.sort((left, right) => right.metrics.area - left.metrics.area)[0];
  };

  const detailWinner = chooseWinner(
    buildCandidates(
      getDetailImages(root).filter((image) => !isGalleryCoverImage(image) && isViewportIntersecting(root, image)),
      { allowUnmeasured: true }
    )
  );
  if (detailWinner) {
    return detailWinner.image;
  }

  let candidates = buildCandidates(Array.from(root.images))
    .filter((image) => {
      const src = image.source;
      return !isLikelyThumbnail(src) && !isGalleryCoverImage(image.image) && isViewportIntersecting(root, image.image);
    });

  const promptEl = findPromptElement(root);
  if (promptEl) {
    const promptRect = promptEl.getBoundingClientRect();
    const abovePrompt = candidates.filter((c) => {
      const rect = c.image.getBoundingClientRect();
      return rect.bottom < promptRect.top + 20;
    });
    if (abovePrompt.length > 0) {
      candidates = abovePrompt;
    }
  }

  return chooseWinner(candidates)?.image;
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
  const imageSourceUrl = image ? getImageSource(image) : '';

  if (!imageSourceUrl) {
    throw new Error(
      'failed to locate primary image: no suitable image found on the detail page'
    );
  }

  return {
    sourceSite: 'jimeng',
    sourceWorkId: workId,
    sourceUrl: url,
    promptRaw: findPrompt(root),
    imageSourceUrl,
    authorName,
    publishedAt,
    modelLabel: findTagText(root, (value) => /^图片\s*\d+(?:\.\d+)?$/u.test(value)),
    aspectRatio,
    approvedStyles: []
  };
}
