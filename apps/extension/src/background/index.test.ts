import { afterEach, describe, expect, it, vi } from 'vitest';

import { COLLECT_PREVIEW_RUNTIME_MESSAGE } from '../shared/constants';

type MessageListener = (
  message: unknown,
  sender: unknown,
  sendResponse: (response: unknown) => void
) => boolean | void;

describe('background runtime messaging', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete (globalThis as typeof globalThis & { chrome?: unknown }).chrome;
  });

  it('keeps the message channel open and responds through sendResponse', async () => {
    let listener: MessageListener | undefined;
    (globalThis as typeof globalThis & { chrome?: unknown }).chrome = {
      runtime: {
        onInstalled: { addListener: vi.fn() },
        onStartup: { addListener: vi.fn() },
        onMessage: {
          addListener: vi.fn((nextListener: MessageListener) => {
            listener = nextListener;
          })
        }
      },
      tabs: {},
      webNavigation: {},
      scripting: {}
    };

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ candidates: [] }), { status: 200 }))
    );

    await import('./index');

    const sendResponse = vi.fn();
    const keepAlive = listener?.(
      {
        type: COLLECT_PREVIEW_RUNTIME_MESSAGE,
        payload: {
          sourceSite: 'jimeng',
          sourceWorkId: 'preview-work'
        }
      },
      {},
      sendResponse
    );

    expect(keepAlive).toBe(true);
    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        ok: true,
        status: 200,
        data: { candidates: [] }
      });
    });
  });

  it('propagates collector preview errors at the top level', async () => {
    let listener: MessageListener | undefined;
    (globalThis as typeof globalThis & { chrome?: unknown }).chrome = {
      runtime: {
        onInstalled: { addListener: vi.fn() },
        onStartup: { addListener: vi.fn() },
        onMessage: {
          addListener: vi.fn((nextListener: MessageListener) => {
            listener = nextListener;
          })
        }
      },
      tabs: {},
      webNavigation: {},
      scripting: {}
    };

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'style_analyzer_unavailable' }), { status: 503 }))
    );

    await import('./index');

    const sendResponse = vi.fn();
    const keepAlive = listener?.(
      {
        type: COLLECT_PREVIEW_RUNTIME_MESSAGE,
        payload: {
          sourceSite: 'jimeng',
          sourceWorkId: 'preview-work'
        }
      },
      {},
      sendResponse
    );

    expect(keepAlive).toBe(true);
    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        ok: false,
        status: 503,
        data: { error: 'style_analyzer_unavailable' },
        error: 'style_analyzer_unavailable'
      });
    });
  });
});
