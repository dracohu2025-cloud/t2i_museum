import { extractJimengDetailPayload, hasLoadedJimengDetailImage } from './dom-extract';
import type { ApprovedStyleTag, CollectWorkPayload } from '@t2i/contracts';
import {
  type CollectButtonActionResult,
  createCollectButtonState,
  injectCollectButton,
  observeCollectButtonWithState,
  removeCollectUi
} from './inject-button';
import { loadCachedProgress, saveCachedProgress } from './progress-cache';
import {
  COLLECT_PREVIEW_RUNTIME_MESSAGE,
  COLLECT_RUNTIME_MESSAGE,
  JIMENG_DETAIL_PATH_SEGMENT,
  LOOKUP_STYLE_RUNTIME_MESSAGE,
  LOOKUP_WORK_PROGRESS_RUNTIME_MESSAGE,
  SYNC_JIMENG_ROUTE_RUNTIME_MESSAGE
} from '../shared/constants';

type ChromeLike = {
  runtime?: {
    lastError?: { message?: string };
    sendMessage?: (message: unknown, callback?: (response: unknown) => void) => void;
    onMessage?: {
      addListener: (
        listener: (
          message: unknown,
          sender: unknown,
          sendResponse: (response?: unknown) => void
        ) => boolean | void
      ) => void;
      removeListener?: (
        listener: (
          message: unknown,
          sender: unknown,
          sendResponse: (response?: unknown) => void
        ) => boolean | void
      ) => void;
    };
  };
};

type ContentRuntimeGlobal = typeof globalThis & {
  __t2iMuseumContentCleanup?: () => void;
  __t2iMuseumContentSync?: () => void;
};

interface WorkProgressPayload {
  stageKey: 'pending' | 'caching' | 'uploading' | 'analyzing' | 'done' | 'failed';
  stageLabel: string;
  percent: number;
  message: string;
  isTerminal: boolean;
  isSuccess: boolean;
}

interface WorkProgressLookup {
  exists: boolean;
  progress: WorkProgressPayload | null;
}

interface CollectRuntimeResponse {
  ok?: boolean;
  error?: string;
  message?: string;
  data?: {
    status?: string;
  };
}

interface StylePreviewCandidate {
  name: string;
  rawTerm: string;
  termType: ApprovedStyleTag['termType'];
  confidence: number;
  shortExplanation: string;
  existsInCatalog: boolean;
}

interface StylePreviewRuntimeResponse {
  ok?: boolean;
  status?: number;
  error?: string;
  data?: {
    candidates?: StylePreviewCandidate[];
    error?: string;
    message?: string;
  };
}

interface StyleReviewRow extends ApprovedStyleTag {
  originalTerm: string;
  existsInCatalog: boolean;
}

const chromeLike = (globalThis as typeof globalThis & { chrome?: ChromeLike }).chrome;
const runtimeGlobal = globalThis as ContentRuntimeGlobal;
let routeObserver: MutationObserver | null = null;
let syncScheduled = false;
let syncTimer = 0;
let progressPollTimer = 0;
let currentRouteToken = 0;
let routeWatchTimer = 0;
let detailRetryTimer = 0;
let lastKnownUrl = '';
let lastFetchWorkProgressTime = 0;
let activeDetailWorkId = '';
const FETCH_WORK_PROGRESS_COOLDOWN_MS = 2000;
const contentBindingId = `binding-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const buttonState = createCollectButtonState();
let disposed = false;
let cleanupHandlers: Array<() => void> = [];
let requestRouteSync: (() => void) | undefined;

function addCleanup(handler: () => void) {
  cleanupHandlers.push(handler);
}

function isCurrentInstance() {
  return !disposed && runtimeGlobal.__t2iMuseumContentCleanup === cleanupCurrentInstance;
}

function cleanupCurrentInstance() {
  disposed = true;
  syncScheduled = false;
  requestRouteSync = undefined;
  if (syncTimer) {
    window.clearTimeout(syncTimer);
    syncTimer = 0;
  }
  if (routeObserver) {
    routeObserver.disconnect();
    routeObserver = null;
  }
  stopProgressPolling();
  stopRouteWatch();
  stopDetailRetry();

  for (const handler of cleanupHandlers.splice(0).reverse()) {
    try {
      handler();
    } catch {}
  }

  if (runtimeGlobal.__t2iMuseumContentCleanup === cleanupCurrentInstance) {
    delete runtimeGlobal.__t2iMuseumContentCleanup;
  }
  if (runtimeGlobal.__t2iMuseumContentSync === syncCurrentInstance) {
    delete runtimeGlobal.__t2iMuseumContentSync;
  }
}

function syncCurrentInstance() {
  if (!isCurrentInstance()) {
    return;
  }

  requestRouteSync?.();
}

function mapRuntimeError(message: string): string {
  if (/Extension context invalidated/i.test(message)) {
    return '扩展上下文已失效，请刷新即梦详情页后重试。若刚更新过插件，请再刷新一次该页面。';
  }

  return message;
}

async function postCollectPayload(payload: unknown) {
  if (chromeLike?.runtime?.sendMessage) {
    return await new Promise<{ message?: string; status?: string }>((resolve, reject) => {
      chromeLike.runtime?.sendMessage?.(
        {
          type: COLLECT_RUNTIME_MESSAGE,
          payload
        },
        (rawResponse) => {
          const response = (rawResponse ?? {}) as CollectRuntimeResponse;
          const lastError = chromeLike.runtime?.lastError;
          if (lastError?.message) {
            reject(new Error(mapRuntimeError(lastError.message)));
            return;
          }

          if (!response?.ok) {
            reject(new Error(response?.error ?? 'collector request failed'));
            return;
          }

          const status =
            typeof (response?.data as { status?: string } | undefined)?.status === 'string'
              ? (response?.data as { status?: string }).status
              : undefined;

          resolve({
            status,
            message:
              typeof response?.message === 'string'
                ? response.message
                : status === 'already_collected'
                  ? '这张图已存在于 museum，本次已尝试补处理。'
                  : '采集请求已发送，collector 已接管任务，你现在可以切换或关闭当前页面。'
          });
        }
      );
    });
  }

  throw new Error('扩展消息通道不可用，请在 chrome://extensions 刷新 t2i_museum Collector 后重试。');
}

async function previewCollectStyles(payload: CollectWorkPayload): Promise<StylePreviewCandidate[]> {
  if (!chromeLike?.runtime?.sendMessage) {
    throw new Error('扩展消息通道不可用，请在 chrome://extensions 刷新 t2i_museum Collector 后重试。');
  }

  return await new Promise<StylePreviewCandidate[]>((resolve, reject) => {
    chromeLike.runtime?.sendMessage?.(
      {
        type: COLLECT_PREVIEW_RUNTIME_MESSAGE,
        payload
      },
      (rawResponse) => {
        const response = (rawResponse ?? {}) as StylePreviewRuntimeResponse;
        const lastError = chromeLike.runtime?.lastError;
        if (lastError?.message) {
          reject(new Error(mapRuntimeError(lastError.message)));
          return;
        }

        if (!response?.ok) {
          const message = response?.error ?? response.data?.error ?? response.data?.message ?? '风格预分析失败';
          reject(new Error(message));
          return;
        }

        resolve(response.data?.candidates ?? []);
      }
    );
  });
}

function createReviewButton(root: Document, label: string, variant: 'primary' | 'ghost' | 'danger') {
  const button = root.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.style.height = '38px';
  button.style.borderRadius = '999px';
  button.style.border =
    variant === 'primary'
      ? '1px solid rgba(34, 211, 238, 0.72)'
      : variant === 'danger'
        ? '1px solid rgba(248, 113, 113, 0.48)'
        : '1px solid rgba(148, 163, 184, 0.32)';
  button.style.background =
    variant === 'primary'
      ? 'linear-gradient(135deg, rgba(8, 145, 178, 0.92), rgba(15, 118, 110, 0.92))'
      : variant === 'danger'
        ? 'rgba(69, 10, 10, 0.82)'
        : 'rgba(15, 23, 42, 0.78)';
  button.style.color = '#f8fafc';
  button.style.padding = '0 18px';
  button.style.fontSize = '13px';
  button.style.fontWeight = '700';
  button.style.cursor = 'pointer';
  isolateReviewControl(button);
  return button;
}

const reviewControlEventTypes = [
  'click',
  'dblclick',
  'mousedown',
  'mouseup',
  'pointerdown',
  'pointerup',
  'touchstart',
  'touchend',
  'keydown',
  'keypress',
  'keyup',
  'beforeinput',
  'input',
  'compositionstart',
  'compositionupdate',
  'compositionend'
] as const;

function isolateReviewControl(element: HTMLElement) {
  for (const eventType of reviewControlEventTypes) {
    element.addEventListener(eventType, (event) => event.stopPropagation());
  }
}

const styleLookupTimers = new Map<number, number>();

function lookupStyleTerm(term: string): Promise<{ exists: boolean; styleName: string | null; termType: string | null }> {
  if (!chromeLike?.runtime?.sendMessage) {
    return Promise.resolve({ exists: false, styleName: null, termType: null });
  }
  return new Promise((resolve) => {
    chromeLike.runtime?.sendMessage?.(
      { type: LOOKUP_STYLE_RUNTIME_MESSAGE, term },
      (response) => {
        if (chromeLike.runtime?.lastError?.message) {
          resolve({ exists: false, styleName: null, termType: null });
          return;
        }
        resolve((response ?? {}) as { exists: boolean; styleName: string | null; termType: string | null });
      }
    );
  });
}

function openStyleReviewDialog(
  root: Document,
  candidates: StylePreviewCandidate[],
  promptRaw: string,
  previewWarning = ''
): Promise<ApprovedStyleTag[] | null> {
  const existing = root.querySelector('[data-t2i-style-review-overlay]');
  existing?.remove();
  const existingFrame = root.querySelector('[data-t2i-style-review-frame]');
  existingFrame?.remove();

  const rows: StyleReviewRow[] = candidates.map((candidate) => ({
    name: candidate.name,
    termType: candidate.termType,
    shortExplanation: candidate.shortExplanation,
    originalTerm: candidate.rawTerm,
    existsInCatalog: candidate.existsInCatalog
  }));

  return new Promise((resolve) => {
    const frame = root.createElement('iframe');
    frame.dataset.t2iStyleReviewFrame = 'true';
    frame.title = 't2i_museum style review';
    frame.style.position = 'fixed';
    frame.style.inset = '0';
    frame.style.zIndex = '2147483647';
    frame.style.width = '100vw';
    frame.style.height = '100vh';
    frame.style.border = '0';
    frame.style.background = 'transparent';
    frame.style.colorScheme = 'dark';
    root.body.appendChild(frame);

    const frameDocument = frame.contentDocument;
    if (!frameDocument) {
      frame.remove();
      resolve(null);
      return;
    }

    frameDocument.open();
    frameDocument.write('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
    frameDocument.close();
    frameDocument.documentElement.style.margin = '0';
    frameDocument.documentElement.style.background = 'transparent';
    frameDocument.body.style.margin = '0';
    frameDocument.body.style.background = 'transparent';
    frameDocument.body.style.fontFamily =
      'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

    const overlay = frameDocument.createElement('div');
    overlay.dataset.t2iStyleReviewOverlay = 'true';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '2147483647';
    overlay.style.background = 'rgba(2, 6, 23, 0.72)';
    overlay.style.backdropFilter = 'blur(10px)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '24px';

    const panel = frameDocument.createElement('section');
    panel.style.width = 'min(1180px, 94vw)';
    panel.style.maxHeight = '86vh';
    panel.style.overflow = 'auto';
    panel.style.borderRadius = '28px';
    panel.style.border = '1px solid rgba(148, 163, 184, 0.24)';
    panel.style.background = 'linear-gradient(145deg, rgba(8, 13, 28, 0.98), rgba(12, 32, 45, 0.98))';
    panel.style.boxShadow = '0 28px 90px rgba(0, 0, 0, 0.48)';
    panel.style.color = '#f8fafc';
    panel.style.padding = '26px';

    const title = frameDocument.createElement('h2');
    title.textContent = '确认入馆风格关键词';
    title.style.margin = '0 0 8px';
    title.style.fontSize = '24px';
    title.style.lineHeight = '1.2';
    title.style.fontWeight = '800';

    const description = frameDocument.createElement('p');
    description.textContent = previewWarning
      ? `风格预分析失败：${previewWarning}。你仍可手动添加关键词后继续入馆。`
      : '每一行左侧都是可直接编辑的最终风格词。请在确认前把不准的词直接改掉，确认后才会保存图片、上传 COS 并写入 museum。';
    description.style.margin = '0 0 18px';
    description.style.color = 'rgba(203, 213, 225, 0.78)';
    description.style.fontSize = '13px';
    description.style.lineHeight = '1.7';

    const responsiveStyle = frameDocument.createElement('style');
    responsiveStyle.textContent = `
      @media (max-width: 900px) {
        [data-t2i-style-review-grid] {
          grid-template-columns: minmax(0, 1fr) !important;
        }

        [data-t2i-style-review-prompt] {
          max-height: 28vh !important;
        }

        [data-t2i-style-review-row] {
          grid-template-columns: minmax(0, 1fr) !important;
        }
      }
    `;
    frameDocument.head.appendChild(responsiveStyle);

    const contentGrid = frameDocument.createElement('div');
    contentGrid.dataset.t2iStyleReviewGrid = 'true';
    contentGrid.style.display = 'grid';
    contentGrid.style.gridTemplateColumns = 'minmax(300px, 0.82fr) minmax(420px, 1.18fr)';
    contentGrid.style.gap = '16px';
    contentGrid.style.alignItems = 'start';

    const promptPanel = frameDocument.createElement('aside');
    promptPanel.dataset.t2iStyleReviewPrompt = 'true';
    promptPanel.style.border = '1px solid rgba(148, 163, 184, 0.22)';
    promptPanel.style.borderRadius = '16px';
    promptPanel.style.background = 'rgba(2, 6, 23, 0.58)';
    promptPanel.style.padding = '14px';
    promptPanel.style.maxHeight = '54vh';
    promptPanel.style.overflow = 'auto';

    const promptLabel = frameDocument.createElement('div');
    promptLabel.textContent = '原始 Prompt';
    promptLabel.style.color = 'rgba(125, 211, 252, 0.92)';
    promptLabel.style.fontSize = '11px';
    promptLabel.style.fontWeight = '800';
    promptLabel.style.letterSpacing = '0.12em';
    promptLabel.style.marginBottom = '10px';

    const promptText = frameDocument.createElement('div');
    promptText.textContent = promptRaw || '未读取到原始 Prompt。';
    promptText.style.whiteSpace = 'pre-wrap';
    promptText.style.wordBreak = 'break-word';
    promptText.style.color = 'rgba(226, 232, 240, 0.92)';
    promptText.style.fontSize = '14px';
    promptText.style.lineHeight = '1.75';

    promptPanel.appendChild(promptLabel);
    promptPanel.appendChild(promptText);

    const keywordPanel = frameDocument.createElement('div');
    keywordPanel.style.display = 'flex';
    keywordPanel.style.flexDirection = 'column';
    keywordPanel.style.gap = '10px';
    keywordPanel.style.minWidth = '0';

    const list = frameDocument.createElement('div');
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '10px';

    const renderRows = () => {
      // Clear all pending debounced style lookups from the previous render
      // so stale callbacks don't target destroyed DOM nodes or shifted indices.
      for (const timerId of styleLookupTimers.values()) {
        window.clearTimeout(timerId);
      }
      styleLookupTimers.clear();
      list.innerHTML = '';

      if (rows.length === 0) {
        const empty = frameDocument.createElement('div');
        empty.textContent = '暂无风格关键词，请手动添加至少一个。';
        empty.style.padding = '16px';
        empty.style.border = '1px dashed rgba(148, 163, 184, 0.34)';
        empty.style.borderRadius = '16px';
        empty.style.color = 'rgba(203, 213, 225, 0.78)';
        list.appendChild(empty);
        return;
      }

      rows.forEach((row, index) => {
        const item = frameDocument.createElement('div');
        item.dataset.t2iStyleReviewRow = 'true';
        item.style.display = 'grid';
        item.style.gridTemplateColumns = 'minmax(0, 1fr) 150px auto';
        item.style.gap = '10px';
        item.style.alignItems = 'center';
        item.style.padding = '12px';
        item.style.border = '1px solid rgba(148, 163, 184, 0.22)';
        item.style.borderRadius = '16px';
        item.style.background = 'rgba(15, 23, 42, 0.74)';

        const field = frameDocument.createElement('div');
        field.style.display = 'flex';
        field.style.flexDirection = 'column';
        field.style.gap = '6px';

        const label = frameDocument.createElement('div');
        label.textContent = '风格词（可直接编辑）';
        label.style.color = 'rgba(125, 211, 252, 0.92)';
        label.style.fontSize = '11px';
        label.style.fontWeight = '800';
        label.style.letterSpacing = '0.12em';

        const input = frameDocument.createElement('input');
        input.type = 'text';
        input.value = row.name;
        input.placeholder = '例如：动漫水彩 / 水墨 / Moebius';
        input.style.height = '42px';
        input.style.borderRadius = '12px';
        input.style.border = '1px solid rgba(125, 211, 252, 0.52)';
        input.style.background = 'rgba(2, 6, 23, 0.84)';
        input.style.color = '#f8fafc';
        input.style.padding = '0 12px';
        input.style.fontSize = '16px';
        input.style.fontWeight = '700';
        input.style.pointerEvents = 'auto';
        input.style.userSelect = 'text';
        input.style.caretColor = '#22d3ee';
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.readOnly = false;
        input.disabled = false;
        input.title = '直接修改这里的文字，确认入馆时会保存修改后的风格词。';
        // NOTE: do NOT call isolateReviewControl(input) here.
        // The input is already inside an iframe (separate browsing context) so keyboard
        // events cannot bubble to the outer Jimeng page. Applying stopPropagation on
        // keydown/input/beforeinput can interfere with the browser\'s native text-input
        // processing in some Chrome builds.
        input.addEventListener('input', () => {
          rows[index] = {
            ...rows[index],
            name: input.value
          };

          // Debounced style catalog lookup:
          // when user finishes typing, check if the term already exists in the catalog.
          const existingTimer = styleLookupTimers.get(index);
          if (existingTimer !== undefined) {
            window.clearTimeout(existingTimer);
          }

          const timerId = window.setTimeout(() => {
            styleLookupTimers.delete(index);
            const trimmed = input.value.trim();
            if (!trimmed) {
              rows[index] = { ...rows[index], existsInCatalog: false };
              meta.textContent = '输入关键词...';
              return;
            }

            lookupStyleTerm(trimmed)
              .then((result) => {
                rows[index] = { ...rows[index], existsInCatalog: result.exists };
                meta.textContent = `原词：${trimmed}${result.exists ? ' · 词库已有' : ' · 新候选'}`;

                if (result.exists && result.termType && result.termType !== rows[index].termType) {
                  rows[index] = { ...rows[index], termType: result.termType as ApprovedStyleTag['termType'] };
                  const typeSelect = list.querySelector(`[data-style-review-type="${index}"]`) as HTMLSelectElement | null;
                  if (typeSelect) {
                    typeSelect.value = result.termType;
                  }
                }
              })
              .catch(() => {
                meta.textContent = `原词：${trimmed}`;
              });
          }, 600);

          styleLookupTimers.set(index, timerId);
        });

        const meta = frameDocument.createElement('div');
        meta.textContent = `原词：${row.originalTerm}${row.existsInCatalog ? ' · 词库已有' : ' · 新候选'}`;
        meta.style.color = 'rgba(148, 163, 184, 0.86)';
        meta.style.fontSize = '12px';

        field.appendChild(label);
        field.appendChild(input);
        field.appendChild(meta);

        const select = frameDocument.createElement('select');
        for (const [value, label] of [
          ['aesthetic_style', '审美风格'],
          ['medium_rendering', '媒介/渲染'],
          ['artist_style', '艺术家风格'],
          ['movement_style', '流派/主义'],
          ['quality_modifier', '质量修饰'],
          ['subject_content', '题材内容'],
          ['mood_atmosphere', '情绪氛围']
        ] as const) {
          const option = frameDocument.createElement('option');
          option.value = value;
          option.textContent = label;
          select.appendChild(option);
        }
        select.value = row.termType;
        select.style.height = '38px';
        select.style.borderRadius = '12px';
        select.style.border = '1px solid rgba(148, 163, 184, 0.28)';
        select.style.background = 'rgba(2, 6, 23, 0.72)';
        select.style.color = '#f8fafc';
        select.style.padding = '0 10px';
        select.dataset.styleReviewType = String(index);
        isolateReviewControl(select);
        select.addEventListener('change', () => {
          rows[index] = {
            ...rows[index],
            termType: select.value as ApprovedStyleTag['termType']
          };
        });

        const remove = createReviewButton(frameDocument, '删除', 'danger');
        remove.addEventListener('click', () => {
          rows.splice(index, 1);
          renderRows();
        });

        item.appendChild(field);
        item.appendChild(select);
        item.appendChild(remove);
        list.appendChild(item);
      });
    };

    const actions = frameDocument.createElement('div');
    actions.style.display = 'flex';
    actions.style.justifyContent = 'space-between';
    actions.style.gap = '12px';
    actions.style.marginTop = '18px';

    const add = createReviewButton(frameDocument, '添加关键词', 'ghost');
    add.addEventListener('click', () => {
      rows.push({
        name: '',
        termType: 'aesthetic_style',
        shortExplanation: '用户手动添加的风格关键词。',
        originalTerm: '手动添加',
        existsInCatalog: false
      });
      renderRows();
    });

    const rightActions = frameDocument.createElement('div');
    rightActions.style.display = 'flex';
    rightActions.style.gap = '10px';

    const cancel = createReviewButton(frameDocument, '取消', 'ghost');
    cancel.addEventListener('click', () => {
      frame.remove();
      resolve(null);
    });

    const confirm = createReviewButton(frameDocument, '确认入馆', 'primary');
    confirm.addEventListener('click', () => {
      const seenNames = new Set<string>();
      const approved = rows
        .map((row) => ({
          name: row.name.trim(),
          termType: row.termType,
          shortExplanation:
            row.name.trim() === row.originalTerm
              ? row.shortExplanation
              : `用户将原候选词“${row.originalTerm}”修订为“${row.name.trim()}”。`
        }))
        .filter((row) => {
          if (!row.name || seenNames.has(row.name)) {
            return false;
          }

          seenNames.add(row.name);
          return true;
        });

      if (approved.length === 0) {
        frame.contentWindow?.alert('请至少保留或添加一个风格关键词。');
        return;
      }

      frame.remove();
      resolve(approved);
    });

    rightActions.appendChild(cancel);
    rightActions.appendChild(confirm);
    actions.appendChild(add);
    actions.appendChild(rightActions);

    keywordPanel.appendChild(list);
    contentGrid.appendChild(promptPanel);
    contentGrid.appendChild(keywordPanel);

    panel.appendChild(title);
    panel.appendChild(description);
    panel.appendChild(contentGrid);
    panel.appendChild(actions);
    overlay.appendChild(panel);
    frameDocument.body.appendChild(overlay);
    renderRows();
  });
}

function currentWorkId() {
  return window.location.pathname.match(/\/work-detail\/([^/?]+)/)?.[1] ?? '';
}

async function fetchWorkProgress(sourceWorkId: string): Promise<WorkProgressLookup> {
  if (!sourceWorkId) {
    return {
      exists: false,
      progress: null
    };
  }

  if (chromeLike?.runtime?.sendMessage) {
    try {
      const response = await new Promise<{
        ok?: boolean;
        found?: boolean;
        error?: string;
        data?: { item?: { progress?: WorkProgressPayload } } | null;
      }>((resolve, reject) => {
        chromeLike.runtime?.sendMessage?.(
          {
            type: LOOKUP_WORK_PROGRESS_RUNTIME_MESSAGE,
            sourceWorkId
          },
          (nextResponse) => {
            const lastError = chromeLike.runtime?.lastError;
            if (lastError?.message) {
              reject(new Error(mapRuntimeError(lastError.message)));
              return;
            }

            resolve(nextResponse ?? {});
          }
        );
      });

      if (!response.ok && !response.found) {
        return {
          exists: false,
          progress: null
        };
      }

      return {
        exists: Boolean(response.found),
        progress: response.data?.item?.progress ?? null
      };
    } catch {
      return {
        exists: false,
        progress: null
      };
    }
  }

  return {
    exists: false,
    progress: null
  };
}

function stopProgressPolling() {
  if (progressPollTimer) {
    window.clearTimeout(progressPollTimer);
    progressPollTimer = 0;
  }
}

function stopRouteWatch() {
  if (routeWatchTimer) {
    window.clearInterval(routeWatchTimer);
    routeWatchTimer = 0;
  }
}

function waitForMainImage(root: Document, timeoutMs = 3000): Promise<void> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const check = () => {
      if (hasLoadedJimengDetailImage(root) || Date.now() - startTime >= timeoutMs) {
        resolve();
      } else {
        setTimeout(check, 200);
      }
    };
    check();
  });
}

function stopDetailRetry() {
  if (detailRetryTimer) {
    window.clearInterval(detailRetryTimer);
    detailRetryTimer = 0;
  }
}

function resetButtonState() {
  buttonState.status = 'idle';
  buttonState.message = '';
  buttonState.progressVisible = false;
  buttonState.progressPercent = 0;
  buttonState.progressLabel = '';
  buttonState.progressTone = 'idle';
}

function applyProgressToButton(progress: WorkProgressPayload | null, sourceWorkId = '') {
  if (!progress) {
    return;
  }

  buttonState.status = progress.isTerminal ? (progress.isSuccess ? 'success' : 'error') : 'collecting';
  buttonState.message = progress.message;
  buttonState.progressVisible = true;
  buttonState.progressPercent = progress.percent;
  buttonState.progressLabel = progress.stageLabel;
  buttonState.progressTone = progress.isTerminal ? (progress.isSuccess ? 'success' : 'error') : 'active';

  if (sourceWorkId && progress.isTerminal) {
    saveCachedProgress(window.localStorage, sourceWorkId, progress);
  }
}

function toCollectingActionResult(message: string): CollectButtonActionResult {
  return {
    nextStatus: 'collecting',
    message,
    progressVisible: true,
    progressPercent: 12,
    progressLabel: '已发送到 collector',
    progressTone: 'active'
  };
}

function bootstrap() {
  disposed = false;
  const isReinit = document.documentElement.dataset.t2iMuseumContentScript === 'ready';
  document.documentElement.dataset.t2iMuseumContentScript = 'ready';

  if (isReinit) {
    if (routeObserver) {
      routeObserver.disconnect();
      routeObserver = null;
    }
    stopProgressPolling();
    stopRouteWatch();
    resetButtonState();
    removeCollectUi(document);
  }

  lastKnownUrl = window.location.href;

  const options = {
    root: document,
    bindingId: contentBindingId,
    shouldInject: () => window.location.pathname.includes(JIMENG_DETAIL_PATH_SEGMENT),
    onCollect: async () => {
      await waitForMainImage(document);
      const payload = extractJimengDetailPayload(document);
      let previewWarning = '';
      let candidates: StylePreviewCandidate[] = [];
      try {
        candidates = await previewCollectStyles(payload);
      } catch (error) {
        previewWarning = error instanceof Error ? error.message : '风格预分析失败';
      }
      const approvedStyles = await openStyleReviewDialog(
        document,
        candidates,
        payload.promptRaw,
        previewWarning
      );
      if (!isCurrentInstance()) {
        return;
      }

      if (!approvedStyles) {
        const canceled: CollectButtonActionResult = {
          nextStatus: 'idle',
          message: '已取消入馆。',
          progressVisible: false,
          progressPercent: 0,
          progressLabel: '',
          progressTone: 'idle'
        };
        return canceled;
      }

      const result = await postCollectPayload({
        ...payload,
        approvedStyles
      });
      scheduleProgressPolling(payload.sourceWorkId, currentRouteToken, options);
      return toCollectingActionResult(
        result.message ?? '采集请求已发送，collector 已接管任务，你现在可以切换或关闭当前页面。'
      );
    }
  };

  const scheduleProgressPolling = (
    sourceWorkId: string,
    routeToken: number,
    nextOptions: typeof options
  ) => {
    stopProgressPolling();

    const poll = async () => {
      if (!isCurrentInstance()) {
        return;
      }

      const progressResult = await fetchWorkProgress(sourceWorkId);
      if (!isCurrentInstance() || routeToken !== currentRouteToken) {
        return;
      }

      const cachedProgress = loadCachedProgress(window.localStorage, sourceWorkId);

      if (!progressResult.exists) {
        if (cachedProgress) {
          applyProgressToButton(cachedProgress, sourceWorkId);
          injectCollectButton(nextOptions, buttonState);
          return;
        }

        buttonState.status = 'collecting';
        buttonState.message = 'collector 已接管任务，你现在可以切换或关闭当前页面。';
        buttonState.progressVisible = true;
        buttonState.progressPercent = Math.max(buttonState.progressPercent, 12);
        buttonState.progressLabel = buttonState.progressLabel || '已发送到 collector';
        buttonState.progressTone = 'active';
        injectCollectButton(nextOptions, buttonState);
        progressPollTimer = window.setTimeout(poll, 900);
        return;
      }

      applyProgressToButton(progressResult.progress ?? cachedProgress, sourceWorkId);
      injectCollectButton(nextOptions, buttonState);

      if (!(progressResult.progress ?? cachedProgress)?.isTerminal) {
        progressPollTimer = window.setTimeout(poll, 900);
      }
    };

    progressPollTimer = window.setTimeout(poll, 250);
  };

  const syncRoute = () => {
    if (!isCurrentInstance()) {
      return;
    }

    syncScheduled = false;
    const isDetailPage = window.location.pathname.includes(JIMENG_DETAIL_PATH_SEGMENT);
    const workId = currentWorkId();
    currentRouteToken += 1;
    const routeToken = currentRouteToken;

    if (!isDetailPage) {
      stopProgressPolling();
      stopDetailRetry();
      routeObserver?.disconnect();
      routeObserver = null;
      activeDetailWorkId = '';
      resetButtonState();
      removeCollectUi(document);
      return;
    }

    const workChanged = workId !== activeDetailWorkId;
    if (workChanged) {
      activeDetailWorkId = workId;
      stopProgressPolling();
      resetButtonState();
      lastFetchWorkProgressTime = 0;
    }

    if (!routeObserver) {
      routeObserver = observeCollectButtonWithState(options, buttonState);
    }

    injectCollectButton(options, buttonState);
    stopDetailRetry();
    let retryCount = 0;
    detailRetryTimer = window.setInterval(() => {
      retryCount += 1;
      const button = injectCollectButton(options, buttonState);
      if (button || retryCount >= 30 || !window.location.pathname.includes(JIMENG_DETAIL_PATH_SEGMENT)) {
        stopDetailRetry();
      }
    }, 500);

    const now = Date.now();
    if (now - lastFetchWorkProgressTime < FETCH_WORK_PROGRESS_COOLDOWN_MS) {
      return;
    }
    lastFetchWorkProgressTime = now;

    void fetchWorkProgress(workId).then((progressResult) => {
      if (!isCurrentInstance() || routeToken !== currentRouteToken) {
        return;
      }

      const cachedProgress = loadCachedProgress(window.localStorage, workId);
      if (cachedProgress) {
        applyProgressToButton(cachedProgress, workId);
        injectCollectButton(options, buttonState);
      }

      if (!progressResult.exists && !cachedProgress) {
        // Only reset if the user hasn't already clicked COLLECT on this page.
        if (buttonState.status === 'idle') {
          resetButtonState();
          injectCollectButton(options, buttonState);
        }
        return;
      }

      applyProgressToButton(progressResult.progress ?? cachedProgress, workId);
      injectCollectButton(options, buttonState);

      if (progressResult.exists && progressResult.progress && !progressResult.progress.isTerminal) {
        scheduleProgressPolling(workId, routeToken, options);
      }
    });
  };

  const scheduleSyncRoute = () => {
    if (!isCurrentInstance()) {
      return;
    }

    if (syncScheduled) {
      return;
    }

    syncScheduled = true;
    syncTimer = window.setTimeout(() => {
      syncTimer = 0;
      syncRoute();
    }, 0);
  };
  requestRouteSync = scheduleSyncRoute;

  const runtimeMessageListener = (message: unknown, _sender: unknown, sendResponse: (response?: unknown) => void) => {
    if (
      message &&
      typeof message === 'object' &&
      (message as { type?: string }).type === SYNC_JIMENG_ROUTE_RUNTIME_MESSAGE
    ) {
      scheduleSyncRoute();
      sendResponse?.({ ok: true });
      return;
    }
  };
  chromeLike?.runtime?.onMessage?.addListener(runtimeMessageListener);
  addCleanup(() => {
    chromeLike?.runtime?.onMessage?.removeListener?.(runtimeMessageListener);
  });

  const originalPushState = window.history.pushState.bind(window.history);
  const originalReplaceState = window.history.replaceState.bind(window.history);

  const patchedPushState = ((...args) => {
    const result = originalPushState(...args);
    scheduleSyncRoute();
    return result;
  }) as History['pushState'];
  const patchedReplaceState = ((...args) => {
    const result = originalReplaceState(...args);
    scheduleSyncRoute();
    return result;
  }) as History['replaceState'];

  window.history.pushState = patchedPushState;
  window.history.replaceState = patchedReplaceState;

  const handlePageHide = () => {
    stopRouteWatch();
    stopDetailRetry();
  };
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      scheduleSyncRoute();
    }
  };

  window.addEventListener('popstate', scheduleSyncRoute);
  window.addEventListener('pageshow', scheduleSyncRoute);
  window.addEventListener('hashchange', scheduleSyncRoute);
  window.addEventListener('pagehide', handlePageHide);
  window.addEventListener('focus', scheduleSyncRoute);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  addCleanup(() => {
    window.removeEventListener('popstate', scheduleSyncRoute);
    window.removeEventListener('pageshow', scheduleSyncRoute);
    window.removeEventListener('hashchange', scheduleSyncRoute);
    window.removeEventListener('pagehide', handlePageHide);
    window.removeEventListener('focus', scheduleSyncRoute);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    if (window.history.pushState === patchedPushState) {
      window.history.pushState = originalPushState as History['pushState'];
    }
    if (window.history.replaceState === patchedReplaceState) {
      window.history.replaceState = originalReplaceState as History['replaceState'];
    }
  });

  routeWatchTimer = window.setInterval(() => {
    if (!isCurrentInstance()) {
      return;
    }

    if (window.location.href === lastKnownUrl) {
      return;
    }

    lastKnownUrl = window.location.href;
    scheduleSyncRoute();
  }, 400);

  scheduleSyncRoute();
  window.setTimeout(scheduleSyncRoute, 150);
  window.setTimeout(scheduleSyncRoute, 500);
  window.setTimeout(scheduleSyncRoute, 1_200);
}

if (runtimeGlobal.__t2iMuseumContentSync) {
  try {
    runtimeGlobal.__t2iMuseumContentSync();
  } catch {
    // Previous instance's context was invalidated (e.g. by scripting.executeScript).
    // Clean up dead references and fall through to bootstrap fresh.
    delete runtimeGlobal.__t2iMuseumContentSync;
    delete runtimeGlobal.__t2iMuseumContentCleanup;
  }
}
if (!runtimeGlobal.__t2iMuseumContentSync) {
  runtimeGlobal.__t2iMuseumContentCleanup?.();
  runtimeGlobal.__t2iMuseumContentCleanup = cleanupCurrentInstance;
  runtimeGlobal.__t2iMuseumContentSync = syncCurrentInstance;
  bootstrap();
}
