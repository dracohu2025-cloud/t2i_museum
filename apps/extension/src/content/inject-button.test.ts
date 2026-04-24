// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createCollectButtonState,
  injectCollectButton,
  observeCollectButton
} from './inject-button';

describe('injectCollectButton', () => {
  afterEach(() => {
    try {
      vi.runOnlyPendingTimers();
    } catch {}
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('injects a single collect button into the action area', () => {
    document.body.innerHTML = `
      <div class="main-container-MeJEJY">
        <div class="action-buttons-wrapper-ibCKz2"></div>
      </div>
    `;

    const onCollect = vi.fn();

    injectCollectButton({
      root: document,
      onCollect
    });
    injectCollectButton({
      root: document,
      onCollect
    });

    const buttons = document.querySelectorAll('[data-t2i-museum-collect]');
    expect(buttons).toHaveLength(1);

    const button = buttons[0] as HTMLButtonElement;
    expect(button.textContent).toContain('COLLECT');
    expect(button.parentElement?.dataset.t2iMuseumCollectPanel).toBe('true');
    expect(
      document.querySelector('[class*="action-buttons-wrapper"]')?.nextElementSibling
    ).toBe(button.parentElement);
  });

  it('moves an existing collect button into the standalone panel', () => {
    document.body.innerHTML = `
      <div class="main-container-MeJEJY">
        <div class="action-buttons-wrapper-ibCKz2">
          <button data-t2i-museum-collect="true">COLLECT</button>
        </div>
      </div>
    `;

    const button = injectCollectButton({
      root: document,
      onCollect: vi.fn()
    });

    const nativeRow = document.querySelector('[class*="action-buttons-wrapper"]');
    const panel = document.querySelector('[data-t2i-museum-collect-panel]');

    expect(button).toBeInstanceOf(HTMLButtonElement);
    expect(panel).toBeInstanceOf(HTMLDivElement);
    expect(nativeRow?.nextElementSibling).toBe(panel);
    expect(button?.parentElement).toBe(panel);
    expect(panel?.querySelector('[data-t2i-museum-collect-status]')).toBeInstanceOf(HTMLDivElement);
  });

  it('rebinds an existing button when it was injected by an older content script instance', async () => {
    document.body.innerHTML = `
      <div class="main-container-MeJEJY">
        <div class="action-buttons-wrapper-ibCKz2">
          <button data-t2i-museum-collect="true" data-t2i-museum-binding-id="stale-binding">COLLECT</button>
        </div>
      </div>
    `;

    const staleHandler = vi.fn();
    const staleButton = document.querySelector('[data-t2i-museum-collect]') as HTMLButtonElement;
    staleButton.addEventListener('click', staleHandler);

    const onCollect = vi.fn(async () => ({ message: '已入馆，可继续收下一张。' }));

    const button = injectCollectButton({
      root: document,
      bindingId: 'fresh-binding',
      onCollect
    });

    button?.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(staleHandler).not.toHaveBeenCalled();
    expect(onCollect).toHaveBeenCalledTimes(1);
    expect(button?.dataset.t2iMuseumBindingId).toBe('fresh-binding');
  });

  it('injects the collect button after the action area appears later', async () => {
    document.body.innerHTML = `<main id="app"></main>`;

    const onCollect = vi.fn();
    const observer = observeCollectButton({
      root: document,
      onCollect
    });

    const lateContainer = document.createElement('div');
    lateContainer.className = 'action-buttons-wrapper-late';
    document.querySelector('#app')?.appendChild(lateContainer);

    await new Promise((resolve) => setTimeout(resolve, 0));

    const button = document.querySelector('[data-t2i-museum-collect]');
    expect(button).toBeInstanceOf(HTMLButtonElement);

    observer?.disconnect();
  });

  it('injects when the action area class is added after the node exists', async () => {
    document.body.innerHTML = `<main id="app"><div id="late"></div></main>`;

    const observer = observeCollectButton({
      root: document,
      onCollect: vi.fn()
    });

    document.querySelector('#late')?.setAttribute('class', 'action-buttons-wrapper-late');

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelector('[data-t2i-museum-collect]')).toBeInstanceOf(HTMLButtonElement);

    observer?.disconnect();
  });

  it('falls back to the native Jimeng action button row when class names are unavailable', () => {
    document.body.innerHTML = `
      <div>
        <div class="opaque-row">
          <button>做同款</button>
          <button>用作参考图</button>
        </div>
      </div>
    `;

    const button = injectCollectButton({
      root: document,
      onCollect: vi.fn()
    });

    expect(button).toBeInstanceOf(HTMLButtonElement);
    expect(document.querySelector('[data-t2i-museum-collect-panel]')).toBeInstanceOf(HTMLDivElement);
  });

  it('does not inject on non-detail routes when shouldInject returns false', () => {
    document.body.innerHTML = `
      <div class="action-buttons-wrapper-ibCKz2"></div>
    `;

    const button = injectCollectButton({
      root: document,
      shouldInject: () => false,
      onCollect: vi.fn()
    });

    expect(button).toBeNull();
    expect(document.querySelector('[data-t2i-museum-collect]')).toBeNull();
  });

  it('shows collecting and success feedback on click', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <div class="main-container-MeJEJY">
        <div class="action-buttons-wrapper-ibCKz2"></div>
      </div>
    `;

    let finishCollect: (() => void) | undefined;
    const onCollect = vi.fn(
      () =>
        new Promise<{ message: string }>((resolve) => {
          finishCollect = () => resolve({ message: '已入馆，可继续收下一张。' });
        })
    );

    const button = injectCollectButton({
      root: document,
      onCollect
    });

    expect(button).toBeInstanceOf(HTMLButtonElement);
    button?.click();

    expect(button?.textContent).toBe('COLLECTING...');
    expect(document.querySelector('[data-t2i-museum-collect-status]')?.textContent).toContain(
      '正在发送到本地 collector'
    );

    finishCollect?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(button?.textContent).toBe('COLLECTED');
    expect(document.querySelector('[data-t2i-museum-collect-status]')?.textContent).toContain(
      '已入馆'
    );
    const progress = document.querySelector('[data-t2i-museum-collect-progress]') as HTMLDivElement | null;
    expect(progress?.style.display).toBe('flex');
    expect(
      document.querySelector('[data-t2i-museum-collect-progress-label]')?.textContent
    ).not.toBe('');
  });

  it('shows retry feedback when collect fails', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <div class="main-container-MeJEJY">
        <div class="action-buttons-wrapper-ibCKz2"></div>
      </div>
    `;

    const onCollect = vi.fn(async () => {
      throw new Error('本地 collector 超时，请检查服务是否正在运行。');
    });

    const button = injectCollectButton({
      root: document,
      onCollect
    });

    button?.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(button?.textContent).toBe('RETRY');
    expect(document.querySelector('[data-t2i-museum-collect-status]')?.textContent).toContain(
      '本地 collector 超时'
    );
    expect(document.querySelector('[data-t2i-museum-collect-progress-label]')?.textContent).toBe(
      '请求失败'
    );
  });

  it('keeps a restored terminal progress bar visible for previously collected works', () => {
    document.body.innerHTML = `
      <div class="main-container-MeJEJY">
        <div class="action-buttons-wrapper-ibCKz2"></div>
      </div>
    `;

    const state = createCollectButtonState();
    state.status = 'success';
    state.message = '图片、标签与元数据已完成入馆。';
    state.progressVisible = true;
    state.progressPercent = 100;
    state.progressLabel = '入馆完成';
    state.progressTone = 'success';

    const button = injectCollectButton(
      {
        root: document,
        onCollect: vi.fn()
      },
      state
    );

    expect(button?.textContent).toBe('COLLECTED');
    expect(
      (document.querySelector('[data-t2i-museum-collect-progress]') as HTMLDivElement | null)?.style.display
    ).toBe('flex');
    expect(
      document.querySelector('[data-t2i-museum-collect-progress-label]')?.textContent
    ).toBe('入馆完成');
    expect(
      (document.querySelector('[data-t2i-museum-collect-progress-bar]') as HTMLDivElement | null)?.style.width
    ).toBe('100%');
  });
});
