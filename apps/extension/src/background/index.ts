import {
  COLLECT_RUNTIME_MESSAGE,
  COLLECT_PREVIEW_RUNTIME_MESSAGE,
  JIMENG_AI_TOOL_URL_PREFIX,
  LOCAL_COLLECT_API_URL,
  LOCAL_COLLECT_PREVIEW_API_URL,
  LOCAL_WORKS_API_URL,
  LOOKUP_WORK_PROGRESS_RUNTIME_MESSAGE,
  SYNC_JIMENG_ROUTE_RUNTIME_MESSAGE
} from '../shared/constants';

type RuntimeApi = {
  onInstalled?: {
    addListener: (listener: () => void) => void;
  };
  onStartup?: {
    addListener: (listener: () => void) => void;
  };
  onMessage?: {
    addListener: (
      listener: (
        message: unknown,
        sender: unknown,
        sendResponse: (response: unknown) => void
    ) => boolean | void
      ) => void;
  };
};

type TabsApi = {
  onUpdated?: {
    addListener: (
      listener: (
        tabId: number,
        changeInfo: { url?: string; status?: string },
        tab: { url?: string }
      ) => void
    ) => void;
  };
  onActivated?: {
    addListener: (listener: (activeInfo: { tabId: number }) => void) => void;
  };
  get?: (tabId: number) => Promise<{ url?: string }>;
  query?: (queryInfo: { url?: string | string[] }) => Promise<Array<{ id?: number; url?: string }>>;
  sendMessage?: (tabId: number, message: unknown) => Promise<unknown>;
};

type WebNavigationApi = {
  onHistoryStateUpdated?: {
    addListener: (
      listener: (details: { tabId: number; url?: string; frameId: number }) => void,
      filter?: { url?: Array<{ urlPrefix?: string }> }
    ) => void;
  };
  onCommitted?: {
    addListener: (
      listener: (details: { tabId: number; url?: string; frameId: number }) => void,
      filter?: { url?: Array<{ urlPrefix?: string }> }
    ) => void;
  };
  onCompleted?: {
    addListener: (
      listener: (details: { tabId: number; url?: string; frameId: number }) => void,
      filter?: { url?: Array<{ urlPrefix?: string }> }
    ) => void;
  };
};

type ScriptingApi = {
  executeScript?: (details: {
    target: { tabId: number };
    files: string[];
  }) => Promise<unknown>;
};

const chromeLike = (globalThis as typeof globalThis & {
  chrome?: {
    runtime?: RuntimeApi;
    tabs?: TabsApi;
    webNavigation?: WebNavigationApi;
    scripting?: ScriptingApi;
  };
}).chrome;

const runtimeApi = chromeLike?.runtime;
const tabsApi = chromeLike?.tabs;
const webNavigationApi = chromeLike?.webNavigation;
const scriptingApi = chromeLike?.scripting;

function readCollectorError(data: unknown, fallback: string): string {
  if (data && typeof data === 'object') {
    const error = (data as { error?: unknown }).error;
    if (typeof error === 'string' && error.trim()) {
      return error;
    }

    const message = (data as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return fallback;
}

async function ensureJimengContentScript(tabId: number, url = '') {
  console.log('[t2i-bg] ensureJimengContentScript called, tabId:', tabId, 'url:', url);
  if (!scriptingApi?.executeScript) {
    console.log('[t2i-bg] no scripting API');
    return;
  }

  if (!url.startsWith(JIMENG_AI_TOOL_URL_PREFIX)) {
    console.log('[t2i-bg] url does not match prefix');
    return;
  }

  try {
    console.log('[t2i-bg] executing content script...');
    await scriptingApi.executeScript({
      target: { tabId },
      files: ['content/index.global.js']
    });
    console.log('[t2i-bg] content script executed, sending sync message');
    await tabsApi?.sendMessage?.(tabId, {
      type: SYNC_JIMENG_ROUTE_RUNTIME_MESSAGE
    });
    console.log('[t2i-bg] sync message sent');
  } catch (err) {
    console.error('[t2i-bg] ensureJimengContentScript error:', err);
  }
}

async function ensureExistingJimengTabs() {
  if (!tabsApi?.query) {
    return;
  }

  try {
    const tabs = await tabsApi.query({
      url: `${JIMENG_AI_TOOL_URL_PREFIX}*`
    });

    await Promise.all(
      tabs.map((tab) => {
        if (typeof tab.id !== 'number') {
          return Promise.resolve();
        }

        return ensureJimengContentScript(tab.id, tab.url ?? '');
      })
    );
  } catch (err) {
    console.error('[t2i-bg] ensureExistingJimengTabs error:', err);
  }
}

function registerNavigationListener(
  listener?: {
    addListener: (
      callback: (details: { tabId: number; url?: string; frameId: number }) => void,
      filter?: { url?: Array<{ urlPrefix?: string }> }
    ) => void;
  }
) {
  listener?.addListener(
    (details) => {
      if (details.frameId !== 0) {
        return;
      }

      void ensureJimengContentScript(details.tabId, details.url ?? '');
    },
    {
      url: [{ urlPrefix: JIMENG_AI_TOOL_URL_PREFIX }]
    }
  );
}

tabsApi?.onUpdated?.addListener((tabId, changeInfo, tab) => {
  console.log('[t2i-bg] tabs.onUpdated', tabId, changeInfo);
  if (!changeInfo.url && changeInfo.status !== 'complete') {
    return;
  }

  void ensureJimengContentScript(tabId, changeInfo.url ?? tab.url ?? '');
});

tabsApi?.onActivated?.addListener((activeInfo) => {
  if (!tabsApi?.get) {
    return;
  }

  void tabsApi
    .get(activeInfo.tabId)
    .then((tab) => ensureJimengContentScript(activeInfo.tabId, tab.url ?? ''))
    .catch(() => {});
});

registerNavigationListener(webNavigationApi?.onCommitted);
registerNavigationListener(webNavigationApi?.onCompleted);
registerNavigationListener(webNavigationApi?.onHistoryStateUpdated);
runtimeApi?.onInstalled?.addListener(() => {
  void ensureExistingJimengTabs();
});
runtimeApi?.onStartup?.addListener(() => {
  void ensureExistingJimengTabs();
});
void ensureExistingJimengTabs();
console.log('[t2i-bg] background listeners registered');

runtimeApi?.onMessage?.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object') {
    return;
  }

  const messageType = (message as { type?: string }).type;

  if (messageType === LOOKUP_WORK_PROGRESS_RUNTIME_MESSAGE) {
    const sourceWorkId = (message as { sourceWorkId?: string }).sourceWorkId ?? '';
    console.log('[t2i-bg] lookup work progress:', sourceWorkId);

    void (async () => {
      try {
        const response = await fetch(`${LOCAL_WORKS_API_URL}/${encodeURIComponent(sourceWorkId)}`, {
          signal: AbortSignal.timeout(5_000)
        });

        if (response.status === 404) {
          sendResponse({
            ok: true,
            found: false,
            data: null
          });
          return;
        }

        const data = await response.json();
        sendResponse({
          ok: response.ok,
          found: response.ok,
          data
        });
      } catch (error) {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : 'work progress lookup failed'
        });
      }
    })();
    return true;
  }

  if (messageType === COLLECT_PREVIEW_RUNTIME_MESSAGE) {
    const payload = (message as { payload?: unknown }).payload;
    console.log('[t2i-bg] collect preview request');

    void (async () => {
      try {
        const response = await fetch(LOCAL_COLLECT_PREVIEW_API_URL, {
          method: 'POST',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(30_000)
        });
        const data = await response.json();

        sendResponse({
          ok: response.ok,
          status: response.status,
          data,
          error: response.ok ? undefined : readCollectorError(data, '风格预分析失败')
        });
      } catch (error) {
        const message =
          error instanceof Error && error.name === 'TimeoutError'
            ? '风格预分析超时，请检查 collector 或稍后重试。'
            : error instanceof Error && /fetch/i.test(error.message)
              ? '无法连接本地 collector，请确认 `npm run dev:collector` 正在运行。'
              : error instanceof Error
                ? error.message
                : '风格预分析失败';

        sendResponse({
          ok: false,
          error: message
        });
      }
    })();
    return true;
  }

  if (messageType !== COLLECT_RUNTIME_MESSAGE) {
    return;
  }

  const payload = (message as { payload?: unknown }).payload;
  console.log('[t2i-bg] collect request');

  void (async () => {
    try {
      const response = await fetch(LOCAL_COLLECT_API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000)
      });
      const data = await response.json();

      sendResponse({
        ok: response.ok,
        status: response.status,
        data,
        error: response.ok ? undefined : readCollectorError(data, 'collector 请求失败'),
        message:
          data?.status === 'already_collected'
            ? '这张图已存在于 museum，本次已尝试补处理。'
            : data?.status === 'accepted'
            ? '采集请求已发送，正在下载图片并分析风格。'
            : 'collector 已返回结果。'
      });
    } catch (error) {
      const message =
        error instanceof Error && error.name === 'TimeoutError'
          ? '本地 collector 超时，请检查服务是否正在运行。'
          : error instanceof Error && /fetch/i.test(error.message)
            ? '无法连接本地 collector，请确认 `npm run dev:collector` 正在运行。'
            : error instanceof Error
              ? error.message
              : 'collector 请求失败';

      sendResponse({
        ok: false,
        error: message
      });
    }
  })();
  return true;
});
