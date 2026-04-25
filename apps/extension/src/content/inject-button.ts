export interface CollectButtonActionResult {
  nextStatus?: CollectButtonStatus;
  message?: string;
  progressVisible?: boolean;
  progressPercent?: number;
  progressLabel?: string;
  progressTone?: CollectProgressTone;
}

export interface InjectCollectButtonOptions {
  root: Document;
  onCollect: () => void | Promise<CollectButtonActionResult | void>;
  shouldInject?: () => boolean;
  bindingId?: string;
}

export interface ObserveCollectButtonOptions extends InjectCollectButtonOptions {
  observerRoot?: ParentNode;
}

export type CollectButtonStatus = 'idle' | 'collecting' | 'success' | 'error';
export type CollectProgressTone = 'idle' | 'active' | 'success' | 'error';

const CREATE_COOLDOWN_MS = 1500;
const lastCreateTimeByRoot = new WeakMap<Document, number>();

export interface CollectButtonState {
  status: CollectButtonStatus;
  message: string;
  resetTimer: number | null;
  progressVisible: boolean;
  progressPercent: number;
  progressLabel: string;
  progressTone: CollectProgressTone;
}

export function createCollectButtonState(): CollectButtonState {
  return {
    status: 'idle',
    message: '',
    resetTimer: null,
    progressVisible: false,
    progressPercent: 0,
    progressLabel: '',
    progressTone: 'idle'
  };
}

export function removeCollectUi(root: Document) {
  root.querySelectorAll('[data-t2i-museum-collect-panel]').forEach((el) => el.remove());
  root.querySelectorAll('[data-t2i-museum-collect]').forEach((el) => {
    if (el instanceof HTMLButtonElement) el.remove();
  });
}

function createFreshButton(root: Document): HTMLButtonElement {
  const button = root.createElement('button');
  button.type = 'button';
  button.dataset.t2iMuseumCollect = 'true';
  button.textContent = 'COLLECT';
  button.style.height = '40px';
  button.style.minWidth = '148px';
  button.style.padding = '0 22px';
  button.style.borderRadius = '999px';
  button.style.border = '1px solid rgba(34, 211, 238, 0.55)';
  button.style.background = 'rgba(8, 51, 68, 0.92)';
  button.style.color = '#ecfeff';
  button.style.fontSize = '14px';
  button.style.fontWeight = '600';
  button.style.cursor = 'pointer';
  button.style.transition = 'background 160ms ease, border-color 160ms ease';
  return button;
}

function ensureCollectPanel(root: Document, container: HTMLElement) {
  if (container.dataset.t2iMuseumCollectPanel === 'true') {
    return container;
  }

  const existing = root.querySelector('[data-t2i-museum-collect-panel]');
  if (existing instanceof HTMLDivElement) {
    return existing;
  }

  const panel = root.createElement('div');
  panel.dataset.t2iMuseumCollectPanel = 'true';
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  panel.style.alignItems = 'flex-start';
  panel.style.gap = '8px';
  panel.style.width = '100%';
  panel.style.marginTop = '12px';

  if (container.parentElement) {
    container.insertAdjacentElement('afterend', panel);
  } else {
    container.appendChild(panel);
  }

  return panel;
}

function findActionButtonsContainer(root: Document): HTMLElement | null {
  const classMatched = root.querySelector('[class*="action-buttons-wrapper"]');
  if (classMatched instanceof HTMLElement) {
    return classMatched;
  }

  const buttons = Array.from(root.querySelectorAll('button'));
  const nativeActionButton = buttons.find((button) => {
    const text = button.textContent?.replace(/\s+/g, '') ?? '';
    return text.includes('做同款') || text.includes('用作参考图');
  });

  const fallbackContainer =
    nativeActionButton?.closest('[class*="button"]')?.parentElement ??
    nativeActionButton?.parentElement;

  return fallbackContainer instanceof HTMLElement ? fallbackContainer : null;
}

function getPanelContainer(root: Document, existingButton?: HTMLButtonElement) {
  return findActionButtonsContainer(root) ?? existingButton?.parentElement ?? null;
}

function ensureStatusNode(root: Document, container: HTMLElement) {
  const panel = ensureCollectPanel(root, container);
  const existing = root.querySelector('[data-t2i-museum-collect-status]');
  if (existing instanceof HTMLDivElement) {
    return existing;
  }

  const node = root.createElement('div');
  node.dataset.t2iMuseumCollectStatus = 'true';
  node.style.fontSize = '12px';
  node.style.lineHeight = '1.6';
  node.style.color = 'rgba(92, 110, 138, 0.92)';
  node.style.minHeight = '18px';
  node.style.maxWidth = '280px';
  panel.appendChild(node);
  return node;
}

function ensureProgressNode(root: Document, container: HTMLElement) {
  const panel = ensureCollectPanel(root, container);
  const existing = root.querySelector('[data-t2i-museum-collect-progress]');
  if (existing instanceof HTMLDivElement) {
    const existingLabel = existing.querySelector('[data-t2i-museum-collect-progress-label]');
    const existingBar = existing.querySelector('[data-t2i-museum-collect-progress-bar]');
    if (existingLabel instanceof HTMLDivElement && existingBar instanceof HTMLDivElement) {
      return {
        wrapper: existing,
        label: existingLabel,
        bar: existingBar
      };
    }
  }

  const wrapper = root.createElement('div');
  wrapper.dataset.t2iMuseumCollectProgress = 'true';
  wrapper.style.display = 'none';
  wrapper.style.flexDirection = 'column';
  wrapper.style.gap = '6px';
  wrapper.style.width = '280px';

  const label = root.createElement('div');
  label.dataset.t2iMuseumCollectProgressLabel = 'true';
  label.style.fontSize = '12px';
  label.style.fontWeight = '600';
  label.style.color = 'rgba(44, 62, 80, 0.86)';

  const track = root.createElement('div');
  track.style.width = '100%';
  track.style.height = '8px';
  track.style.borderRadius = '999px';
  track.style.background = 'rgba(148, 163, 184, 0.25)';
  track.style.overflow = 'hidden';

  const bar = root.createElement('div');
  bar.dataset.t2iMuseumCollectProgressBar = 'true';
  bar.style.width = '0%';
  bar.style.height = '100%';
  bar.style.borderRadius = '999px';
  bar.style.background = 'linear-gradient(90deg, rgba(14, 116, 144, 0.92), rgba(34, 211, 238, 0.92))';
  bar.style.transition = 'width 220ms ease, background 160ms ease';

  track.appendChild(bar);
  wrapper.appendChild(label);
  wrapper.appendChild(track);
  panel.appendChild(wrapper);

  return {
    wrapper,
    label,
    bar
  };
}

function applyProgressState(
  progressNode: { wrapper: HTMLDivElement; label: HTMLDivElement; bar: HTMLDivElement },
  state: CollectButtonState
) {
  if (!state.progressVisible) {
    progressNode.wrapper.style.display = 'none';
    progressNode.label.textContent = '';
    progressNode.bar.style.width = '0%';
    return;
  }

  progressNode.wrapper.style.display = 'flex';
  progressNode.label.textContent = state.progressLabel;
  progressNode.bar.style.width = `${Math.max(0, Math.min(100, state.progressPercent))}%`;

  if (state.progressTone === 'success') {
    progressNode.label.style.color = 'rgba(22, 101, 52, 0.92)';
    progressNode.bar.style.background =
      'linear-gradient(90deg, rgba(22, 101, 52, 0.92), rgba(74, 222, 128, 0.92))';
    return;
  }

  if (state.progressTone === 'error') {
    progressNode.label.style.color = 'rgba(185, 28, 28, 0.92)';
    progressNode.bar.style.background =
      'linear-gradient(90deg, rgba(127, 29, 29, 0.92), rgba(248, 113, 113, 0.92))';
    return;
  }

  progressNode.label.style.color =
    state.progressTone === 'active' ? 'rgba(30, 64, 175, 0.92)' : 'rgba(44, 62, 80, 0.86)';
  progressNode.bar.style.background =
    'linear-gradient(90deg, rgba(14, 116, 144, 0.92), rgba(34, 211, 238, 0.92))';
}

function applyButtonState(
  button: HTMLButtonElement,
  statusNode: HTMLDivElement,
  progressNode: { wrapper: HTMLDivElement; label: HTMLDivElement; bar: HTMLDivElement },
  state: CollectButtonState
) {
  if (state.status === 'collecting') {
    button.disabled = true;
    button.textContent = 'COLLECTING...';
    button.style.background = 'rgba(8, 51, 68, 0.92)';
    button.style.borderColor = 'rgba(34, 211, 238, 0.55)';
    statusNode.textContent = state.message || '正在发送到本地 collector...';
    statusNode.style.color = 'rgba(60, 89, 128, 0.92)';
    applyProgressState(progressNode, state);
    return;
  }

  if (state.status === 'success') {
    button.disabled = false;
    button.textContent = 'COLLECTED';
    button.style.background = 'rgba(21, 78, 44, 0.92)';
    button.style.borderColor = 'rgba(74, 222, 128, 0.55)';
    statusNode.textContent = state.message || '已入馆';
    statusNode.style.color = 'rgba(22, 101, 52, 0.92)';
    applyProgressState(progressNode, state);
    return;
  }

  if (state.status === 'error') {
    button.disabled = false;
    button.textContent = 'RETRY';
    button.style.background = 'rgba(69, 10, 10, 0.92)';
    button.style.borderColor = 'rgba(248, 113, 113, 0.55)';
    statusNode.textContent = state.message || '采集失败，请重试';
    statusNode.style.color = 'rgba(185, 28, 28, 0.92)';
    applyProgressState(progressNode, state);
    return;
  }

  button.disabled = false;
  button.textContent = 'COLLECT';
  button.style.background = 'rgba(8, 51, 68, 0.92)';
  button.style.borderColor = 'rgba(34, 211, 238, 0.55)';
  statusNode.textContent = state.message;
  statusNode.style.color = 'rgba(236, 254, 255, 0.78)';
  applyProgressState(progressNode, state);
}

function setState(
  button: HTMLButtonElement,
  statusNode: HTMLDivElement,
  state: CollectButtonState,
  next: {
    status: CollectButtonStatus;
    message?: string;
    resetAfterMs?: number;
    progressVisible?: boolean;
    progressPercent?: number;
    progressLabel?: string;
    progressTone?: CollectProgressTone;
  }
) {
  if (state.resetTimer) {
    window.clearTimeout(state.resetTimer);
    state.resetTimer = null;
  }

  state.status = next.status;
  state.message = next.message ?? '';
  if (typeof next.progressVisible === 'boolean') {
    state.progressVisible = next.progressVisible;
  }
  if (typeof next.progressPercent === 'number') {
    state.progressPercent = next.progressPercent;
  }
  if (typeof next.progressLabel === 'string') {
    state.progressLabel = next.progressLabel;
  }
  if (typeof next.progressTone === 'string') {
    state.progressTone = next.progressTone;
  }
  const progressNode = ensureProgressNode(
    button.ownerDocument,
    button.parentElement instanceof HTMLElement ? button.parentElement : statusNode
  );
  applyButtonState(button, statusNode, progressNode, state);

  if (next.resetAfterMs) {
    state.resetTimer = window.setTimeout(() => {
      state.status = 'idle';
      state.message = '';
      state.resetTimer = null;
      state.progressVisible = false;
      state.progressPercent = 0;
      state.progressLabel = '';
      state.progressTone = 'idle';
      const progressNode = ensureProgressNode(
        button.ownerDocument,
        button.parentElement instanceof HTMLElement ? button.parentElement : statusNode
      );
      applyButtonState(button, statusNode, progressNode, state);
    }, next.resetAfterMs);
  }
}

function bindCollectClick(
  button: HTMLButtonElement,
  statusNode: HTMLDivElement,
  state: CollectButtonState,
  options: InjectCollectButtonOptions
) {
  const nextBindingId = options.bindingId ?? 'default';
  if (button.dataset.t2iMuseumBindingId === nextBindingId) {
    return;
  }

  button.dataset.t2iMuseumBindingId = nextBindingId;

  button.onclick = async () => {
    console.log('[t2i] button onclick fired, status:', state.status);
    if (state.status === 'collecting') {
      console.log('[t2i] already collecting, ignoring click');
      return;
    }

    setState(button, statusNode, state, {
      status: 'collecting',
      message: '正在发送到本地 collector...',
      progressVisible: true,
      progressPercent: 8,
      progressLabel: '请求已发送',
      progressTone: 'active'
    });

    try {
      console.log('[t2i] calling onCollect...');
      const result = await options.onCollect();
      console.log('[t2i] onCollect returned:', result);
      setState(button, statusNode, state, {
        status: result?.nextStatus ?? 'success',
        message: result?.message ?? '已入馆，可继续收下一张。',
        progressVisible: typeof result?.progressVisible === 'boolean' ? result.progressVisible : state.progressVisible,
        progressPercent: typeof result?.progressPercent === 'number' ? result.progressPercent : state.progressPercent,
        progressLabel: typeof result?.progressLabel === 'string' ? result.progressLabel : state.progressLabel,
        progressTone: typeof result?.progressTone === 'string' ? result.progressTone : state.progressTone
      });
    } catch (error) {
      console.error('[t2i] onCollect threw error:', error);
      setState(button, statusNode, state, {
        status: 'error',
        message: error instanceof Error ? error.message : '采集失败，请重试。',
        progressVisible: true,
        progressPercent: Math.max(8, state.progressPercent || 0),
        progressLabel: '请求失败',
        progressTone: 'error'
      });
    }
  };
}

export function injectCollectButton(
  options: InjectCollectButtonOptions,
  state: CollectButtonState = createCollectButtonState()
): HTMLButtonElement | null {
  if (options.shouldInject && !options.shouldInject()) {
    removeCollectUi(options.root);
    return null;
  }

  const existing = options.root.querySelector('[data-t2i-museum-collect]');
  const hasExisting = existing instanceof HTMLButtonElement;
  console.log('[t2i] injectCollectButton called, existing:', hasExisting, 'status:', state.status);

  if (hasExisting) {
    const nextBindingId = options.bindingId ?? 'default';
    const stateKey = `${nextBindingId}|${state.status}|${state.message}|${state.progressVisible}|${state.progressPercent}|${state.progressLabel}|${state.progressTone}`;

    // Fast-path: if state hasn't changed and the button structure is intact, do nothing.
    if (existing.dataset.t2iMuseumLastState === stateKey) {
      const currentPanel = existing.closest('[data-t2i-museum-collect-panel]') as HTMLElement | null;
      if (currentPanel) {
        const hasStatus = currentPanel.querySelector('[data-t2i-museum-collect-status]') instanceof HTMLDivElement;
        const hasProgress = currentPanel.querySelector('[data-t2i-museum-collect-progress]') instanceof HTMLDivElement;
        if (hasStatus && hasProgress) {
          console.log('[t2i] fast-path: state unchanged, structure intact');
          return existing;
        }
      }
    }

    // Prefer the button's current panel to avoid jumping when the host page re-renders.
    const currentPanel = existing.closest('[data-t2i-museum-collect-panel]') as HTMLElement | null;

    let panel: HTMLElement | null = currentPanel;
    let statusNode: HTMLDivElement | null = null;
    let progressNode: ReturnType<typeof ensureProgressNode> | null = null;

    if (panel) {
      statusNode = panel.querySelector('[data-t2i-museum-collect-status]');
      const progressWrapper = panel.querySelector('[data-t2i-museum-collect-progress]');
      const progressLabel = progressWrapper?.querySelector('[data-t2i-museum-collect-progress-label]');
      const progressBar = progressWrapper?.querySelector('[data-t2i-museum-collect-progress-bar]');
      if (
        progressWrapper instanceof HTMLDivElement &&
        progressLabel instanceof HTMLDivElement &&
        progressBar instanceof HTMLDivElement
      ) {
        progressNode = { wrapper: progressWrapper, label: progressLabel, bar: progressBar };
      }
    }

    // If the structure is complete, update in-place without querying a new container.
    if (panel && statusNode instanceof HTMLDivElement && progressNode) {
      console.log('[t2i] in-place update: structure complete');
      applyButtonState(existing, statusNode, progressNode, state);
      bindCollectClick(existing, statusNode, state, options);
      existing.dataset.t2iMuseumLastState = stateKey;
      return existing;
    }

    // Fallback: re-locate container, move button, and clean up the old panel.
    console.log('[t2i] fallback: moving button to new container');
    const panelContainer = getPanelContainer(options.root, existing);
    panel = panelContainer instanceof HTMLElement ? ensureCollectPanel(options.root, panelContainer) : null;

    if (panel && existing.parentElement !== panel) {
      const oldPanel = existing.closest('[data-t2i-museum-collect-panel]');
      panel.prepend(existing);
      if (oldPanel instanceof HTMLElement && oldPanel !== panel) {
        oldPanel.remove();
      }
    }

    statusNode =
      options.root.querySelector('[data-t2i-museum-collect-status]') ??
      (panelContainer instanceof HTMLElement ? ensureStatusNode(options.root, panelContainer) : null);
    progressNode =
      panelContainer instanceof HTMLElement ? ensureProgressNode(options.root, panelContainer) : null;

    if (panel && statusNode instanceof HTMLDivElement && statusNode.parentElement !== panel) {
      panel.appendChild(statusNode);
    }
    if (panel && progressNode && progressNode.wrapper.parentElement !== panel) {
      panel.insertBefore(progressNode.wrapper, statusNode instanceof HTMLDivElement ? statusNode : null);
    }

    if (statusNode instanceof HTMLDivElement && progressNode) {
      applyButtonState(existing, statusNode, progressNode, state);
      bindCollectClick(existing, statusNode, state, options);
      existing.dataset.t2iMuseumLastState = stateKey;
    }

    return existing;
  }

  const now = Date.now();
  const lastCreateTime = lastCreateTimeByRoot.get(options.root) ?? 0;
  if (now - lastCreateTime < CREATE_COOLDOWN_MS) {
    console.log('[t2i] button missing but in cooldown, skipping recreate');
    return null;
  }

  const container = findActionButtonsContainer(options.root);
  if (!(container instanceof HTMLElement)) {
    return null;
  }
  const panel = ensureCollectPanel(options.root, container);

  const button = createFreshButton(options.root);

  const nextStatusNode = ensureStatusNode(options.root, container);
  const nextProgressNode = ensureProgressNode(options.root, container);
  if (nextProgressNode.wrapper.parentElement === panel) {
    panel.insertBefore(nextProgressNode.wrapper, nextStatusNode);
  }
  applyButtonState(button, nextStatusNode, nextProgressNode, state);

  panel.prepend(button);
  bindCollectClick(button, nextStatusNode, state, options);
  lastCreateTimeByRoot.set(options.root, Date.now());
  console.log('[t2i] button recreated after cooldown');
  return (
    options.root.querySelector('[data-t2i-museum-collect]') as HTMLButtonElement | null
  );
}

export function observeCollectButton(options: ObserveCollectButtonOptions): MutationObserver | null {
  return observeCollectButtonWithState(options, createCollectButtonState());
}

export function observeCollectButtonWithState(
  options: ObserveCollectButtonOptions,
  state: CollectButtonState
): MutationObserver | null {
  const observerRoot = options.observerRoot ?? options.root.documentElement ?? options.root.body;
  if (!(observerRoot instanceof Node)) {
    return null;
  }
  let syncTimer = 0;
  let mutating = false;
  const MIN_SYNC_INTERVAL_MS = 200;
  let lastSyncTime = 0;

  const sync = () => {
    if (syncTimer || mutating) {
      return;
    }

    const now = Date.now();
    const delay = Math.max(0, MIN_SYNC_INTERVAL_MS - (now - lastSyncTime));

    syncTimer = window.setTimeout(() => {
      syncTimer = 0;
      lastSyncTime = Date.now();
      mutating = true;
      injectCollectButton(options, state);
      mutating = false;
    }, delay);
  };

  const observer = new MutationObserver(() => {
    sync();
  });

  observer.observe(observerRoot, {
    childList: true,
    subtree: true
  });

  sync();
  return observer;
}
