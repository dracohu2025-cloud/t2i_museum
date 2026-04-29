import { describe, expect, it } from 'vitest';

import {
  deriveStyleDisplayName,
  deriveStyleNarrative,
  getCuratedStyleNarrative
} from './style-knowledge';

describe('deriveStyleNarrative', () => {
  it('returns a richer narrative for Moebius style pages', () => {
    const narrative = deriveStyleNarrative({
      name: 'Moebius (Jean Giraud)',
      termType: 'artist_style',
      shortDescription: '法式科幻漫画线稿、平涂色块与辽阔想象力。',
      visualTraits: ''
    });

    expect(narrative.overview).toContain('Jean Giraud');
    expect(narrative.lineage).toContain('法国-比利时漫画');
    expect(narrative.characteristics).toContain('平涂');
  });

  it('prefers curated Chinese overview when the stored copy is a low-value English placeholder', () => {
    const narrative = deriveStyleNarrative({
      name: '日本动漫',
      termType: 'artist_style',
      shortDescription: 'Explicitly names the visual style (Japanese anime).',
      visualTraits: ''
    });

    expect(narrative.overview).toContain('日本动画');
    expect(narrative.lineage).toContain('手冢治虫');
  });

  it('prefers curated narrative for anime watercolor over Chinese placeholders', () => {
    const narrative = deriveStyleNarrative({
      name: '动漫水彩',
      termType: 'aesthetic_style',
      shortDescription: 'Prompt 中显式点名的视觉风格词。',
      visualTraits: ''
    });

    expect(narrative.overview).toContain('二次元角色造型');
    expect(narrative.lineage).toContain('水彩插画');
    expect(narrative.characteristics).toContain('水痕晕开');
  });

  it('returns curated narrative for BJD placeholders', () => {
    const narrative = deriveStyleNarrative({
      name: 'BJD',
      termType: 'aesthetic_style',
      shortDescription: 'Prompt 中显式点名的视觉风格词。',
      visualTraits: ''
    });

    expect(narrative.overview).toContain('球形关节人偶');
    expect(narrative.lineage).toContain('娃娃摄影');
    expect(narrative.characteristics).toContain('玻璃眼珠');
    expect(getCuratedStyleNarrative('BJD')?.overview).toContain('树脂');
  });

  it('does not treat Chinese extractor placeholders as complete copy', () => {
    const narrative = deriveStyleNarrative({
      name: '待补充风格',
      termType: 'aesthetic_style',
      shortDescription: 'Prompt 中显式点名的视觉风格词。',
      visualTraits: ''
    });

    expect(narrative.overview).toBe('待补充风格 已进入当前词库，但它的核心定义仍待补充。');
  });

  it('preserves manually curated overview and visual traits when they exist', () => {
    const narrative = deriveStyleNarrative({
      name: '极繁主义',
      termType: 'movement_style',
      shortDescription:
        '极繁主义在这里被人工修订为一种强调纹样堆叠、装饰密度与饱和视觉节奏的视觉立场，而不只是“元素很多”的表层描述。',
      visualTraits: '纹样反复、细节叠加、边缘信息密集。'
    });

    expect(narrative.overview).toBe(
      '极繁主义在这里被人工修订为一种强调纹样堆叠、装饰密度与饱和视觉节奏的视觉立场，而不只是“元素很多”的表层描述。'
    );
    expect(narrative.characteristics).toBe('纹样反复、细节叠加、边缘信息密集。');
  });

  it('returns Chinese display names and narrative for English style names', () => {
    const narrative = deriveStyleNarrative({
      name: 'watercolor gouache painting',
      termType: 'aesthetic_style',
      shortDescription:
        'High-value medium/rendering term naming watercolor and gouache painting techniques.',
      visualTraits: ''
    });

    expect(deriveStyleDisplayName('watercolor gouache painting')).toBe('水彩水粉绘画');
    expect(narrative.overview).toContain('水彩');
    expect(narrative.lineage).toContain('水媒绘画');
  });

  it('uses Chinese narrative for forest fairy-tale placeholders', () => {
    const narrative = deriveStyleNarrative({
      name: 'forest fairy-tale',
      termType: 'aesthetic_style',
      shortDescription:
        'Explicit aesthetic style referring to a fairy-tale/whimsical forest visual theme.',
      visualTraits: ''
    });

    expect(deriveStyleDisplayName('forest fairy-tale')).toBe('森林童话风');
    expect(narrative.overview).toContain('森林童话风');
  });

  it('returns curated narrative for acrylic illustration', () => {
    const narrative = deriveStyleNarrative({
      name: '丙烯插画',
      termType: 'medium_rendering',
      shortDescription: 'Explicitly names acrylic illustration.',
      visualTraits: ''
    });

    expect(narrative.overview).toContain('丙烯颜料');
    expect(narrative.characteristics).toContain('刷痕');
  });

  it('does not shorten database names that explicitly keep 风格', () => {
    expect(deriveStyleDisplayName('动漫水彩风格')).toBe('动漫水彩风格');
    expect(deriveStyleDisplayName('莫奈油画风格')).toBe('莫奈油画风格');
    expect(deriveStyleDisplayName('水彩风格')).toBe('水彩风格');
    expect(deriveStyleDisplayName('BJD风格')).toBe('BJD风格');
  });

  it('returns curated narrative for hand-drawn style', () => {
    const narrative = deriveStyleNarrative({
      name: '手绘风格',
      termType: 'aesthetic_style',
      shortDescription: 'Explicitly names hand-drawn style.',
      visualTraits: ''
    });

    expect(narrative.overview).toContain('人工绘制');
    expect(narrative.characteristics).toContain('凌乱但有控制的线条');
  });

  it('returns curated narratives for watercolor and ink wash', () => {
    const watercolor = deriveStyleNarrative({
      name: '水彩',
      termType: 'medium_rendering',
      shortDescription: 'Explicitly names watercolor.',
      visualTraits: ''
    });
    const inkWash = deriveStyleNarrative({
      name: '水墨',
      termType: 'medium_rendering',
      shortDescription: 'Explicitly names ink wash.',
      visualTraits: ''
    });

    expect(watercolor.overview).toContain('透明颜料');
    expect(inkWash.overview).toContain('墨色浓淡');
  });
});
