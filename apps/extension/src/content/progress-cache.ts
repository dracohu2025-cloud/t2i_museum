export interface CachedWorkProgress {
  stageKey: 'pending' | 'caching' | 'uploading' | 'analyzing' | 'done' | 'failed';
  stageLabel: string;
  percent: number;
  message: string;
  isTerminal: boolean;
  isSuccess: boolean;
}

const PROGRESS_CACHE_KEY_PREFIX = 't2i-museum-progress:';

function progressCacheKey(sourceWorkId: string) {
  return `${PROGRESS_CACHE_KEY_PREFIX}${sourceWorkId}`;
}

function isCachedWorkProgress(value: unknown): value is CachedWorkProgress {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.stageKey === 'string' &&
    typeof candidate.stageLabel === 'string' &&
    typeof candidate.percent === 'number' &&
    typeof candidate.message === 'string' &&
    typeof candidate.isTerminal === 'boolean' &&
    typeof candidate.isSuccess === 'boolean'
  );
}

export function loadCachedProgress(storage: Storage, sourceWorkId: string): CachedWorkProgress | null {
  if (!sourceWorkId) {
    return null;
  }

  try {
    const raw = storage.getItem(progressCacheKey(sourceWorkId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    return isCachedWorkProgress(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveCachedProgress(
  storage: Storage,
  sourceWorkId: string,
  progress: CachedWorkProgress
) {
  if (!sourceWorkId || !progress.isTerminal) {
    return;
  }

  storage.setItem(progressCacheKey(sourceWorkId), JSON.stringify(progress));
}
