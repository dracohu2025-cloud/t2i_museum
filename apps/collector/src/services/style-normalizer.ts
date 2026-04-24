import type { StyleTermType } from '@t2i/contracts';

export interface CanonicalStyleRule {
  canonicalName: string;
  aliases: string[];
  termType: StyleTermType;
  shortDescription: string;
}

export interface ResolvedCanonicalStyle {
  name: string;
  aliases: string[];
  termType: StyleTermType;
  shortDescription: string;
}

export const canonicalStyleRules: CanonicalStyleRule[] = [
  {
    canonicalName: 'Moebius (Jean Giraud)',
    aliases: [
      'Moebius',
      'Moebius风格',
      'Moebius (Jean Giraud)',
      'Moebius (Jean Giraud)风格',
      'Moebius (Jean Giraud)风格绘画',
      'Jean Giraud',
      'Jean Giraud style',
      '墨比斯',
      '墨比乌斯'
    ],
    termType: 'artist_style',
    shortDescription: '法式科幻漫画线稿、平涂色块与辽阔想象力。'
  },
  {
    canonicalName: '极繁主义',
    aliases: ['极繁主义', 'Maximalism', 'Maximalist', 'Maximalist style'],
    termType: 'movement_style',
    shortDescription: '高密度细节、装饰堆叠与视觉饱和感。'
  },
  {
    canonicalName: '虚幻6渲染',
    aliases: [
      '虚幻6渲染',
      '虚幻 6 渲染',
      'Unreal Engine 6 render',
      'Unreal 6 render',
      'UE6 render',
      'UE6'
    ],
    termType: 'medium_rendering',
    shortDescription: '以 Unreal Engine 6 为特征的实时渲染质感与光照表达。'
  },
  {
    canonicalName: '3D国漫风格',
    aliases: ['3D国漫风格', '3D国漫', '国漫3D风格', '国漫3D'],
    termType: 'aesthetic_style',
    shortDescription: '国产三维角色海报式造型、东方叙事语汇与商业角色美术的结合。'
  },
  {
    canonicalName: '莫奈油画',
    aliases: ['莫奈油画', '莫奈油画风', '莫奈油画风格', 'Monet oil painting', '莫奈油'],
    termType: 'artist_style',
    shortDescription: '借莫奈式印象派油画的松散笔触、空气感与高明度色彩层次。'
  },
  {
    canonicalName: '丙烯插画',
    aliases: ['丙烯插画', '丙烯画插画', '丙烯风格插画', 'acrylic illustration'],
    termType: 'medium_rendering',
    shortDescription: '以丙烯颜料式覆盖、肌理和较强色块塑形为核心的插画表达。'
  },
  {
    canonicalName: '手绘风格',
    aliases: ['手绘风格', '手绘画风', '手绘', 'hand-drawn style', 'hand drawn style'],
    termType: 'aesthetic_style',
    shortDescription: '强调人工绘制痕迹、笔触线条和非机械化手感的视觉风格。'
  },
  {
    canonicalName: '水彩',
    aliases: ['水彩', '水彩风', '水彩风格', 'watercolor', 'watercolour'],
    termType: 'medium_rendering',
    shortDescription: '以透明水媒、湿润渐变和轻盈色层为核心的绘画媒介风格。'
  },
  {
    canonicalName: '水墨',
    aliases: ['水墨', '水墨风', '水墨风格', 'ink wash', 'Chinese ink wash'],
    termType: 'medium_rendering',
    shortDescription: '以墨色浓淡、留白、线面关系和东方笔墨气韵为核心的绘画风格。'
  }
];

function stripStyleSuffix(term: string): string {
  return term
    .trim()
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/\s+/g, ' ')
    .replace(/(油画|水彩|水粉|版画|水墨)风\s*$/u, '$1')
    .replace(/(风格绘画|风格|画风|style)\s*$/iu, '')
    .replace(/[，,。.;；:：]+$/g, '')
    .trim();
}

function containsChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

function isAsciiOnly(text: string): boolean {
  return /^[\x00-\x7f]+$/.test(text);
}

export function cleanStyleDisplayName(term: string): string {
  return stripStyleSuffix(term);
}

export function normalizeStyleTerm(term: string): string {
  return cleanStyleDisplayName(term).toLowerCase();
}

/**
 * Strip leading Chinese grammatical particles and trailing noise from a style term.
 * Used as the final sanitization gate before sending candidates to the extension preview UI.
 */
export function sanitizePreviewTerm(term: string): string {
  if (!term) return term;

  let cleaned = stripStyleSuffix(term.trim());

  // Strip leading grammatical particles (one or more passes)
  const leadingPattern =
    /^(?:以|为|将|用|把|向|采用|呈现|带有|具有|属于|一种|一套|使用|以及)\s*/u;
  let prev = '';
  while (prev !== cleaned) {
    prev = cleaned;
    cleaned = cleaned.replace(leadingPattern, '').trim();
  }

  // Strip leading possessive/modifier particle
  cleaned = cleaned.replace(/^(?:的|之)\s*/u, '').trim();

  // Strip trailing visual-noise suffixes that add no style meaning
  cleaned = cleaned
    .replace(/(?:为视觉风格|为视觉|作为视觉风格|作为视觉|作为主视觉|为主视觉)$/u, '')
    .trim();

  return cleaned || term.trim();
}

export function createStyleSlug(name: string): string {
  const base = normalizeStyleTerm(name)
    .replace(/[^a-z0-9\u4e00-\u9fff\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

  return base || 'style';
}

function findCanonicalStyleRule(term: string): CanonicalStyleRule | undefined {
  const normalized = normalizeStyleTerm(term);

  return canonicalStyleRules.find((rule) =>
    rule.aliases.some((alias) => normalizeStyleTerm(alias) === normalized)
  );
}

function chooseDisplayName(rawTerm: string, normalizedCandidate: string): string {
  const rawDisplay = cleanStyleDisplayName(rawTerm);
  const candidateDisplay = cleanStyleDisplayName(normalizedCandidate);

  if (!candidateDisplay) {
    return rawDisplay;
  }

  if (!rawDisplay) {
    return candidateDisplay;
  }

  if (containsChinese(rawDisplay) && isAsciiOnly(candidateDisplay)) {
    return rawDisplay;
  }

  if (rawDisplay.includes('(') && !candidateDisplay.includes('(')) {
    return rawDisplay;
  }

  if (rawDisplay.length >= candidateDisplay.length + 4) {
    return rawDisplay;
  }

  return candidateDisplay;
}

export function resolveCanonicalStyle(input: {
  rawTerm: string;
  normalizedCandidate: string;
  termType: StyleTermType;
  shortExplanation: string;
}): ResolvedCanonicalStyle {
  const matchedRule =
    findCanonicalStyleRule(input.rawTerm) ?? findCanonicalStyleRule(input.normalizedCandidate);

  if (matchedRule) {
    return {
      name: matchedRule.canonicalName,
      aliases: Array.from(
        new Set([input.rawTerm, input.normalizedCandidate, matchedRule.canonicalName, ...matchedRule.aliases])
      ).filter(Boolean),
      termType: matchedRule.termType,
      shortDescription: matchedRule.shortDescription
    };
  }

  const chosenName = chooseDisplayName(input.rawTerm, input.normalizedCandidate);

  return {
    name: chosenName,
    aliases: Array.from(new Set([input.rawTerm, input.normalizedCandidate, chosenName])).filter(Boolean),
    termType: input.termType,
    shortDescription: input.shortExplanation
  };
}
