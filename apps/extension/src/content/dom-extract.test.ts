// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { extractJimengDetailPayload } from './dom-extract';

describe('extractJimengDetailPayload', () => {
  it('extracts the work payload from a Jimeng detail page', () => {
    document.body.innerHTML = `
      <div class="detail-area-mylLyv">
        <div class="main-container-MeJEJY">
          <div class="author-row">
            <span>啦啦乌卡吧啦啦</span>
            <span>2026-04-15</span>
          </div>
          <div class="detail-info-n1sIVT">
            <div class="prompt-tip-_S_YjR">图片提示词</div>
            <div class="prompt-value-H7u3lm">
              <div class="prompt-value-text-cJL62n">
                <span class="prompt-value-container-lIP4pF">
                  <span>Moebius (Jean Giraud)风格绘画，极繁主义</span>
                </span>
              </div>
            </div>
            <div class="prompt-tags-Ixl0vJ">
              <span>图片 3.1</span>
              <span>9:16</span>
            </div>
          </div>
        </div>
      </div>
      <img
        class="image-eTuIBd"
        src="https://p26-dreamina-sign.byteimg.com/tos-cn-i-tb4s082cfz/a2d8e5.webp"
        width="936"
        height="1664"
      />
      <div class="action-buttons-wrapper-ibCKz2"></div>
    `;

    window.history.replaceState(
      {},
      '',
      '/ai-tool/work-detail/7628721210028723466?workDetailType=Image&itemType=9'
    );

    const result = extractJimengDetailPayload(document);

    expect(result.sourceWorkId).toBe('7628721210028723466');
    expect(result.promptRaw).toContain('Moebius (Jean Giraud)');
    expect(result.aspectRatio).toBe('9:16');
    expect(result.modelLabel).toBe('图片 3.1');
    expect(result.authorName).toBe('啦啦乌卡吧啦啦');
    expect(result.publishedAt).toBe('2026-04-15');
    expect(result.imageSourceUrl).toContain('byteimg.com');
  });

  it('extracts the model label when Jimeng renders it without a space', () => {
    document.body.innerHTML = `
      <div class="detail-info-n1sIVT">
        <div class="prompt-tip-_S_YjR">图片提示词</div>
        <div class="prompt-value-H7u3lm">
          <div class="prompt-value-text-cJL62n">
            <span class="prompt-value-container-lIP4pF">
              <span>测试 prompt</span>
            </span>
          </div>
        </div>
        <div class="prompt-tags-Ixl0vJ">
          <span>图片4.6</span>
          <span>9:16</span>
        </div>
      </div>
      <img src="https://p26-dreamina-sign.byteimg.com/tos-cn-i-tb4s082cfz/a2d8e5.webp" width="936" height="1664" />
    `;

    window.history.replaceState(
      {},
      '',
      '/ai-tool/work-detail/7600000000000000000?workDetailType=Image&itemType=9'
    );

    const result = extractJimengDetailPayload(document);

    expect(result.modelLabel).toBe('图片4.6');
    expect(result.aspectRatio).toBe('9:16');
  });

  it('prefers the visible image whose aspect ratio matches the work metadata', () => {
    document.body.innerHTML = `
      <div class="detail-info-n1sIVT">
        <div class="prompt-tip-_S_YjR">图片提示词</div>
        <div class="prompt-value-H7u3lm">
          <div class="prompt-value-text-cJL62n">
            <span class="prompt-value-container-lIP4pF">
              <span>极简实验性平面插画</span>
            </span>
          </div>
        </div>
        <div class="prompt-tags-Ixl0vJ">
          <span>图片4.6</span>
          <span>9:16</span>
        </div>
      </div>
      <img
        src="https://example.com/banner.webp"
        width="1080"
        height="455"
      />
      <img
        src="https://example.com/main-work.webp"
        width="936"
        height="1664"
      />
    `;

    window.history.replaceState(
      {},
      '',
      '/ai-tool/work-detail/7628726891544939827?workDetailType=Image&itemType=9'
    );

    const result = extractJimengDetailPayload(document);

    expect(result.imageSourceUrl).toBe('https://example.com/main-work.webp');
    expect(result.aspectRatio).toBe('9:16');
  });

  it('prefers the Jimeng detail player image over gallery covers', () => {
    document.body.innerHTML = `
      <div class="detail-info-n1sIVT">
        <div class="prompt-tip-_S_YjR">图片提示词</div>
        <div class="prompt-value-H7u3lm">
          <div class="prompt-value-text-cJL62n">
            <span class="prompt-value-container-lIP4pF">
              <span>简笔画，画面中心是一只绿色鹦鹉</span>
            </span>
          </div>
        </div>
        <div class="prompt-tags-Ixl0vJ">
          <span>图片 4.5</span>
          <span>2:3</span>
        </div>
      </div>
      <img
        class="cover-Qo4B2U"
        src="https://example.com/stale-feed-cover.webp"
        width="480"
        height="720"
      />
      <div class="image-player-KCJSe1">
        <img
          class="image-eTuIBd"
          src="https://example.com/current-detail-image.webp"
          width="1365"
          height="2048"
        />
      </div>
    `;

    window.history.replaceState(
      {},
      '',
      '/ai-tool/work-detail/7593295293941124361?workDetailType=Image&itemType=9'
    );

    const result = extractJimengDetailPayload(document);

    expect(result.imageSourceUrl).toBe('https://example.com/current-detail-image.webp');
  });

  it('does not fall back to Jimeng gallery covers before the detail image is ready', () => {
    document.body.innerHTML = `
      <div class="detail-info-n1sIVT">
        <div class="prompt-tip-_S_YjR">图片提示词</div>
        <div class="prompt-value-H7u3lm">
          <div class="prompt-value-text-cJL62n">
            <span class="prompt-value-container-lIP4pF">
              <span>等待详情主图加载</span>
            </span>
          </div>
        </div>
        <div class="prompt-tags-Ixl0vJ">
          <span>图片 4.5</span>
          <span>2:3</span>
        </div>
      </div>
      <img
        class="cover-Qo4B2U"
        src="https://example.com/stale-feed-cover.webp"
        width="480"
        height="720"
      />
    `;

    window.history.replaceState(
      {},
      '',
      '/ai-tool/work-detail/7593295293941124361?workDetailType=Image&itemType=9'
    );

    expect(() => extractJimengDetailPayload(document)).toThrow('failed to locate primary image');
  });
});
