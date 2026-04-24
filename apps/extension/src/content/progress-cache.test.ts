// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { loadCachedProgress, saveCachedProgress } from './progress-cache';

describe('progress-cache', () => {
  it('persists and restores terminal progress', () => {
    const storage = window.localStorage;
    storage.clear();

    saveCachedProgress(storage, 'work-1', {
      stageKey: 'done',
      stageLabel: '入馆完成',
      percent: 100,
      message: '图片、标签与元数据已完成入馆。',
      isTerminal: true,
      isSuccess: true
    });

    expect(loadCachedProgress(storage, 'work-1')).toEqual({
      stageKey: 'done',
      stageLabel: '入馆完成',
      percent: 100,
      message: '图片、标签与元数据已完成入馆。',
      isTerminal: true,
      isSuccess: true
    });
  });

  it('ignores non-terminal progress when saving', () => {
    const storage = window.localStorage;
    storage.clear();

    saveCachedProgress(storage, 'work-2', {
      stageKey: 'analyzing',
      stageLabel: '正在分析风格',
      percent: 82,
      message: '正在分析 prompt 并整理风格标签。',
      isTerminal: false,
      isSuccess: false
    });

    expect(loadCachedProgress(storage, 'work-2')).toBeNull();
  });
});
