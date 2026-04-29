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

/**
 * Heuristic patterns for inferring the correct StyleTermType from a style term.
 * Each entry defines a regex pattern and maps matching terms to a term type.
 * Patterns are checked in order after canonical rule lookup, so the first match wins.
 */
interface TermTypePattern {
  pattern: RegExp;
  termType: StyleTermType;
  description: string;
}

const termTypePatterns: TermTypePattern[] = [
  // Artist names (individual or compound)
  { pattern: /^(?:莫奈|梵高|毕加索|达芬奇|拉斐尔|伦勃朗|米开朗基罗|丢勒|透纳|马蒂斯|塞尚|高更|雷诺阿|德加|蒙克|克里姆特|席勒|康定斯基|蒙德里安|达利|米罗|安迪沃霍尔|波洛克|沃霍尔|霍珀|弗里达|阿钦博尔多|东山魁夷|宫崎骏|新海誠|新海诚|葛饰北斋|葛飾北斎|歌川国芳|歌川廣重|歌川广重|喜多川歌麿|铃木春信|穆夏|慕夏|Moebius|Monet|Van Gogh|Picasso|Da Vinci|Rembrandt|Matisse|Cezanne|Gauguin|Degas|Munch|Klimt|Kandinsky|Mondrian|Dali|Warhol|Durer|Hokusai|Hiroshige|Utamaro|Mucha|Gustav Klimt)/iu, termType: 'artist_style', description: 'artist_name' },

  // Medium and rendering techniques
  { pattern: /(?:水彩|油画|水墨|水粉|丙烯|版画|素描|彩铅|马克笔|工笔|写意|油画棒|蜡笔|铅笔|钢笔|喷枪|水彩画|油彩|墨彩|国画|书法|壁画|漆画|岩彩|坦培拉|色粉|粉彩|粉画|拼贴|数码绘画|数字绘画|CG绘画|板绘|厚涂|赛璐璐|平涂|网点|漫符|勾线|描边|漫画|插画|3D|三维|渲染|建模|材质|光照|光影|写实|超写实|半写实|卡通渲染|三渲二|toon|cel shading|render)/iu, termType: 'medium_rendering', description: 'medium_rendering' },

  // Art movements and schools
  { pattern: /(?:主义|流派|印象派|后印象派|立体派|抽象派|野兽派|表现主义|超现实|未来主义|至上主义|构成主义|风格派|达达|波普|极简|极繁|巴洛克|洛可可|新艺术|装饰艺术|包豪斯|文艺复兴|古典主义|浪漫主义|写实主义|自然主义|象征主义|点彩|分色|分离派|De Stijl|Art Deco|Art Nouveau|Bauhaus|Renaissance|Baroque|Rococo|Impressionist|Expressionist|Surrealist|Pop Art|Minimalist)/iu, termType: 'movement_style', description: 'movement_style' },

  // Aesthetic styles (cultural, genre, visual styles)
  { pattern: /(?:国风|古风|中式|中国风|日式|和风|日系|韩式|韩风|欧美|美式|法式|北欧|森系|民族风|波西米亚|赛博朋克|蒸汽朋克|生物朋克|柴油朋克|废土|末世|末世废土|宫崎骏风|吉卜力|迪士尼|皮克斯|梦工厂|东方|西方|幻想|奇幻|魔幻|仙侠|武侠|水墨风|卡通|二次元|动漫|番剧|轻小说|galgame|乙女|少年漫|少女漫|Q版|萌系|可爱风|治愈系|暗黑风|暗黑|哥特|复古|怀旧|做旧|年代|昭和|平成|大正|昭和风|港风|民国|蒸汽波|Vaporwave|Synthwave|极简风|简约风|高级感|ins风|简约|北欧风|侘寂|wabi-sabi|波普风|涂鸦|街头|嘻哈|潮流|时尚|杂志|商业|广告|宣传|海报|扁平|UI|图标|拟物|material|玻璃拟态|毛玻璃)/iu, termType: 'aesthetic_style', description: 'aesthetic_style' },

  // Mood and atmosphere
  { pattern: /(?:氛围|情绪|气氛|意境|氛围感|唯美|治愈|梦幻|梦境|童话|浪漫|温馨|温暖|柔和|温柔|静谧|宁静|安详|空灵|通透|清冷|冷峻|阴郁|忧郁|压抑|沉重|神秘|诡异|诡异|诡异|恐怖|惊悚|黑暗|暗黑|阴沉|明亮|明媚|灿烂|热烈|活泼|轻快|愉悦|清新|清爽|淡雅|素雅|素净|纯净|纯洁|神圣|庄重|肃穆|悲壮|苍凉|苍茫|辽阔|壮阔|宏大|史诗|震撼|华丽|绚丽|斑斓|多彩|缤纷|极光|黄昏|夕阳|黎明|清晨|夜晚|夜景|月色|星空|星光|星夜|极夜)/iu, termType: 'mood_atmosphere', description: 'mood_atmosphere' },

  // Quality modifiers
  { pattern: /^(?:高画质|超清|高清|4k|8k|高清|精细|精致|细腻|逼真|真实|写实|超写实|高清渲染|高精度|高细节|高品质|顶级|杰作|大师级|专业|八星|最佳质量|最高画质|极佳|极致|巅峰|完美|无瑕|best quality|masterpiece|highres|ultra high res|high quality|professional|photorealistic|realistic)/iu, termType: 'quality_modifier', description: 'quality_modifier' },

  // Subject content (fallback - catch generic subjects)
  { pattern: /^(?:风景|山水|人物|肖像|人体|半身|全身|头像|胸像|动物|植物|花卉|食物|建筑|城市|街道|室内|静物|抽象|图案|纹理|材质|岩石|水景|瀑布|河流|湖泊|海洋|天空|云彩|火焰|闪电|龙|骑士|精灵|天使|恶魔|机甲|机器人|武器|剑|盾|魔法|法术|咒语)/iu, termType: 'subject_content', description: 'subject_content' },
];

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
  },
  {
    canonicalName: '日本动漫',
    aliases: ['日本动漫', 'Japanese anime', 'anime', '日式动漫', '日本动画', 'anime风格'],
    termType: 'aesthetic_style',
    shortDescription: '以日本动画为美学基础的视觉风格，包含平涂色彩、夸张表情与流畅动势。'
  },
  {
    canonicalName: '动漫水彩',
    aliases: ['动漫水彩', 'anime watercolor', 'anime watercolour', '动漫水彩风', '动漫水彩风格'],
    termType: 'medium_rendering',
    shortDescription: '融合日式动漫线稿与水彩渲染技巧的绘画风格。'
  },
  {
    canonicalName: 'BJD',
    aliases: ['BJD', 'Ball-jointed doll', 'ball jointed doll', '球形关节人偶', '球关节人偶', 'BJD风格'],
    termType: 'aesthetic_style',
    shortDescription: '以球形关节人偶为美学参照的视觉风格，常见于角色造型。'
  },
  {
    canonicalName: '立绘',
    aliases: ['立绘', 'character illustration', 'full-body character portrait', '立绘风格'],
    termType: 'aesthetic_style',
    shortDescription: '角色全身站立插画的表现形式，源自日式游戏与ACG文化。'
  },
  {
    canonicalName: '动态光影',
    aliases: ['动态的光影效果', 'dynamic lighting', '动态光影', '动态光影效果'],
    termType: 'mood_atmosphere',
    shortDescription: '强调动态变化的光影效果，营造沉浸式视觉氛围。'
  },
  {
    canonicalName: '森林童话',
    aliases: ['forest fairy-tale', 'forest fairy tale', '森林童话风', '森林童话'],
    termType: 'aesthetic_style',
    shortDescription: '以森林自然和童话意境为特征的审美风格。'
  },
  {
    canonicalName: '印象派',
    aliases: ['印象派', '印象主义', 'Impressionism', 'impressionist', '印象派风格'],
    termType: 'movement_style',
    shortDescription: '以光线变化和色彩感觉为核心的艺术流派，笔触松散而富有生气。'
  },
  {
    canonicalName: '浮世绘',
    aliases: ['浮世绘', '浮世绘风格', 'Ukiyo-e', 'ukiyo-e style'],
    termType: 'movement_style',
    shortDescription: '日本江户时代的版画艺术形式，以平面构图、鲜明色彩和装饰性线条为特征。'
  },
  {
    canonicalName: '赛博朋克',
    aliases: ['赛博朋克', '赛博', 'cyberpunk', 'Cyberpunk', '赛博朋克风'],
    termType: 'aesthetic_style',
    shortDescription: '以高科技、低生活为核心的反乌托邦科幻视觉风格。'
  },
  {
    canonicalName: '宫崎骏',
    aliases: ['宫崎骏', '宫崎骏风格', '宫崎骏风', '宫崎骏画风'],
    termType: 'artist_style',
    shortDescription: '日本动画大师宫崎骏的创作风格，以宏大飞行场景、自然生态与少女主角为标志。'
  },
  {
    canonicalName: '新海诚',
    aliases: ['新海诚', '新海誠', '新海诚风格', '新海诚画风', 'Makoto Shinkai'],
    termType: 'artist_style',
    shortDescription: '日本动画导演新海诚的视觉风格，以超写实背景、光影散射与情感氛围著称。'
  }
];

function stripLookupSuffix(term: string): string {
  return term
    .trim()
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/\s+/g, ' ')
    .replace(/\s+风格\s*$/u, '风格')
    .replace(/\s+主义\s*$/u, '主义')
    .replace(/(油画|水彩|水粉|版画|水墨)风\s*$/u, '$1')
    .replace(/(风格绘画|风格|主义|画风|style)\s*$/iu, '')
    .replace(/[，,。.;；:：]+$/g, '')
    .trim();
}

function stripDisplayNoise(term: string): string {
  return term
    .trim()
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/\s+/g, ' ')
    .replace(/\s+风格\s*$/u, '风格')
    .replace(/\s+主义\s*$/u, '主义')
    .replace(/风格绘画\s*$/u, '风格')
    .replace(/(油画|水彩|水粉|版画|水墨)风\s*$/u, '$1')
    .replace(/(画风|style)\s*$/iu, '')
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
  return stripDisplayNoise(term);
}

export function normalizeStyleTerm(term: string): string {
  return stripLookupSuffix(term).toLowerCase();
}

/**
 * Strip leading Chinese grammatical particles and trailing noise from a style term.
 * Used as the final sanitization gate before sending candidates to the extension preview UI.
 */
export function sanitizePreviewTerm(term: string): string {
  if (!term) return term;

  let cleaned = stripDisplayNoise(term.trim());

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
  const base = cleanStyleDisplayName(name)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

  return base || 'style';
}

/**
 * Resolve the most appropriate StyleTermType for a given term using:
 * 1. Canonical style rules (exact alias matches)
 * 2. Heuristic pattern matching (regex patterns for artists, media, movements, etc.)
 * Falls back to the original LLM-provided type.
 */
export function resolveTermType(term: string, originalType: StyleTermType): StyleTermType {
  const normalized = normalizeStyleTerm(term);
  if (!normalized) return originalType;

  // 1. Check canonical style rules
  const canonical = findCanonicalStyleRule(term);
  if (canonical) return canonical.termType;

  // 2. Check heuristic patterns
  for (const pattern of termTypePatterns) {
    // Test against the original term (preserves case and formatting)
    if (pattern.pattern.test(term)) {
      return pattern.termType;
    }
  }

  // 3. Fall back to original type
  return originalType;
}

function findCanonicalStyleRule(term: string): CanonicalStyleRule | undefined {
  const normalized = normalizeStyleTerm(term);

  return canonicalStyleRules.find((rule) =>
    rule.aliases.some((alias) => normalizeStyleTerm(alias) === normalized)
  );
}

function hasSemanticSuffix(term: string): boolean {
  return /(?:风格|主义)$/u.test(term);
}

function directStyleSuffixName(rawTerm: string): string {
  const displayName = cleanStyleDisplayName(rawTerm);
  if (
    (displayName.length > '风格'.length && displayName.endsWith('风格')) ||
    (displayName.length > '主义'.length && displayName.endsWith('主义'))
  ) {
    return displayName;
  }

  return '';
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

  if (
    !hasSemanticSuffix(rawDisplay) &&
    hasSemanticSuffix(candidateDisplay) &&
    normalizeStyleTerm(rawDisplay) === normalizeStyleTerm(candidateDisplay)
  ) {
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
  const directStyleName = directStyleSuffixName(input.rawTerm);

  if (directStyleName) {
    return {
      name: directStyleName,
      aliases: Array.from(
        new Set([
          input.rawTerm,
          input.normalizedCandidate,
          directStyleName,
          matchedRule?.canonicalName ?? '',
          ...(matchedRule?.aliases ?? [])
        ])
      ).filter(Boolean),
      termType: matchedRule?.termType ?? resolveTermType(directStyleName, input.termType),
      shortDescription: matchedRule?.shortDescription ?? input.shortExplanation
    };
  }

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
  const resolvedType = resolveTermType(chosenName, input.termType);

  return {
    name: chosenName,
    aliases: Array.from(new Set([input.rawTerm, input.normalizedCandidate, chosenName])).filter(Boolean),
    termType: resolvedType,
    shortDescription: input.shortExplanation
  };
}
