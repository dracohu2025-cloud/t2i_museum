import { describe, expect, it } from 'vitest';

import { createStyleSlug, normalizeStyleTerm, resolveCanonicalStyle } from './style-normalizer';

describe('normalizeStyleTerm', () => {
  it('strips common style suffixes before alias lookup', () => {
    expect(normalizeStyleTerm('Moebius (Jean Giraud)风格绘画')).toBe('moebius (jean giraud)');
  });

  it('preserves medium nouns when terms end with 油画风', () => {
    expect(normalizeStyleTerm('莫奈油画风')).toBe('莫奈油画');
  });
});

describe('resolveCanonicalStyle', () => {
  it('maps Moebius aliases into the canonical artist style', () => {
    const resolved = resolveCanonicalStyle({
      rawTerm: 'Moebius (Jean Giraud)风格',
      normalizedCandidate: 'Moebius',
      termType: 'artist_style',
      shortExplanation: 'test'
    });

    expect(resolved.name).toBe('Moebius (Jean Giraud)风格');
    expect(resolved.termType).toBe('artist_style');
  });

  it('prefers the Chinese canonical movement name when the prompt uses it', () => {
    const resolved = resolveCanonicalStyle({
      rawTerm: '极繁主义',
      normalizedCandidate: 'Maximalism',
      termType: 'movement_style',
      shortExplanation: 'test'
    });

    expect(resolved.name).toBe('极繁主义');
    expect(resolved.termType).toBe('movement_style');
  });

  it('maps 莫奈油画 aliases into the canonical artist style', () => {
    const resolved = resolveCanonicalStyle({
      rawTerm: '莫奈油画风',
      normalizedCandidate: '莫奈油画风格',
      termType: 'aesthetic_style',
      shortExplanation: 'test'
    });

    expect(resolved.name).toBe('莫奈油画风格');
    expect(resolved.termType).toBe('artist_style');
  });

  it('maps acrylic illustration aliases into 丙烯插画', () => {
    const resolved = resolveCanonicalStyle({
      rawTerm: '丙烯画插画',
      normalizedCandidate: 'acrylic illustration',
      termType: 'aesthetic_style',
      shortExplanation: 'test'
    });

    expect(resolved.name).toBe('丙烯插画');
    expect(resolved.termType).toBe('medium_rendering');
  });

  it('maps hand-drawn aliases into 手绘风格', () => {
    const resolved = resolveCanonicalStyle({
      rawTerm: '手绘',
      normalizedCandidate: 'hand-drawn style',
      termType: 'aesthetic_style',
      shortExplanation: 'test'
    });

    expect(resolved.name).toBe('手绘风格');
    expect(resolved.termType).toBe('aesthetic_style');
  });

  it('maps watercolor and ink wash aliases into Chinese medium styles', () => {
    expect(
      resolveCanonicalStyle({
        rawTerm: 'watercolor',
        normalizedCandidate: 'watercolor',
        termType: 'aesthetic_style',
        shortExplanation: 'test'
      }).name
    ).toBe('水彩');

    expect(
      resolveCanonicalStyle({
        rawTerm: 'ink wash',
        normalizedCandidate: 'ink wash',
        termType: 'aesthetic_style',
        shortExplanation: 'test'
      }).name
    ).toBe('水墨');
  });

  it('preserves a directly attached 风格 suffix as the database display name', () => {
    const resolved = resolveCanonicalStyle({
      rawTerm: '动漫水彩风格',
      normalizedCandidate: '动漫水彩',
      termType: 'medium_rendering',
      shortExplanation: 'test'
    });

    expect(resolved.name).toBe('动漫水彩风格');
    expect(resolved.aliases).toContain('动漫水彩');
    expect(normalizeStyleTerm(resolved.name)).toBe(normalizeStyleTerm('动漫水彩'));
  });

  it('preserves 风格 in generated style slugs', () => {
    expect(createStyleSlug('动漫水彩风格')).toBe('动漫水彩风格');
  });
});
