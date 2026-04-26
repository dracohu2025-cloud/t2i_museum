import { normalizeStyleTerm } from './style-normalizer';

export interface StyleNarrative {
  overview: string;
  lineage: string;
  characteristics: string;
}

interface StyleKnowledgeEntry extends StyleNarrative {
  aliases: string[];
  displayName?: string;
}

interface StyleNarrativeInput {
  name: string;
  termType: string;
  shortDescription: string;
  visualTraits: string;
}

const styleKnowledgeEntries: StyleKnowledgeEntry[] = [
  {
    aliases: ['Moebius (Jean Giraud)', 'Moebius', 'Jean Giraud', '墨比斯', '墨比乌斯'],
    overview:
      'Moebius 通常指法国漫画家 Jean Giraud 在科幻与奇想创作中使用的笔名，也指向一种以清晰线稿、平涂色块与异星想象力见长的法式科幻视觉。',
    lineage:
      '它建立在法国-比利时漫画的清线传统之上，同时吸收了 Jean Giraud 早期西部漫画训练、七十年代科幻杂志文化以及后续概念美术的发展，因此常被视为欧洲科幻视觉语言的重要源头之一。',
    characteristics:
      '常见特征是细而稳定的轮廓线、大面积平涂、巨构建筑或荒原尺度、异星服饰与机械细节并置，以及干净但不单薄的空间组织，画面往往兼具陌生感与诗意。'
  },
  {
    aliases: ['极繁主义', 'Maximalism', 'Maximalist'],
    overview:
      '极繁主义不是单一门类里的狭义流派名，而是一种与极简主义相对的审美取向，强调丰饶、堆叠、装饰、密度与视觉能量的持续外溢。',
    lineage:
      '它可以追溯到巴洛克式的装饰冲动，也在后现代平面设计、时尚造型、数字插画与幻想视觉里不断被重写；重点不是“多”本身，而是让细节、纹样、材质与色彩形成压倒性的整体节奏。',
    characteristics:
      '常见特征包括高密度细节、纹样反复、饰品叠加、强对比色彩、复杂材质与画面边缘信息充满，画面会有一种饱和、丰盛甚至略带眩晕的观感。'
  },
  {
    aliases: ['日本动漫', 'Japanese anime', 'anime'],
    overview:
      '“日本动漫”在这里更像一个宽泛的视觉总称，指向日本动画、漫画、游戏原画与角色产业长期塑造出来的角色造型与叙事美学。',
    lineage:
      '它承接了漫画分镜、赛璐珞动画、角色商品化与游戏立绘系统的共同演化，从手冢治虫以降的角色简化方法，到八九十年代动画工业与当代手游视觉，逐步形成今天常见的 anime 视觉语汇。',
    characteristics:
      '典型特征包括明确的人物轮廓、大而可读的五官设计、发型与服装符号化、情绪表演清晰，以及在二次元平面感与戏剧化光影之间寻找平衡。'
  },
  {
    aliases: ['动漫水彩', 'anime watercolor', 'anime watercolour', '动漫水彩风', '动漫水彩风格'],
    overview:
      '“动漫水彩”是一种把二次元角色造型与水彩媒介质感结合起来的视觉语言：人物轮廓和五官保持动漫式清晰可读，色彩与光影则借水彩的透明叠色、湿润晕染和纸面颗粒来获得柔和、轻盈的观感。',
    lineage:
      '它来自日本动画、漫画和游戏插画中的角色美术传统，同时吸收了水彩插画、绘本和同人插画里的透明色层处理。在数字绘画与 AIGC prompt 中，这个词通常用于降低纯赛璐珞或厚涂画面的硬度，让角色图带有手绘纸感和清新的空气感。',
    characteristics:
      '典型特征包括大而明亮的动漫眼睛、干净但略带手绘感的轮廓线、低饱和高明度配色、半透明肤色和发丝渐变、背景或服饰处的水痕晕开、纸纹颗粒，以及樱花、天空、校园或柔光场景中常见的轻盈氛围。'
  },
  {
    aliases: ['BJD', 'Ball-jointed doll', 'ball jointed doll', '球形关节人偶', '球关节人偶'],
    overview:
      'BJD 在图像生成语境里通常指“球形关节人偶”审美：人物被塑造成精致、脆弱、略带非现实感的人偶形象，强调树脂或瓷器般的皮肤、可展示的关节结构与高度装饰化造型。',
    lineage:
      '它来自球形关节人偶收藏、娃娃摄影、哥特与洛丽塔服饰文化，也常被数字插画和角色立绘吸收，用来把真人美型、玩偶质感和舞台化服装结合起来。',
    characteristics:
      '典型特征包括瓷白或树脂感皮肤、玻璃眼珠般的凝视、精修五官、明显或隐约可见的肩肘膝关节、华丽礼服与假发造型，以及介于真人肖像和精致人偶之间的冷感、静态和装饰性。'
  },
  {
    aliases: ['立绘', 'character illustration', 'full-body character portrait'],
    overview:
      '“立绘”本质上不是艺术史意义上的风格流派，而是一种角色展示范式，重点是把人物设定、服装、道具与气质一次性清晰交代出来。',
    lineage:
      '它主要来自游戏原画、视觉小说、卡牌与角色设定稿体系，服务于角色识别、商业展示与后续资产复用，因此比起叙事场面，它更强调角色本身的辨识度和信息完整性。',
    characteristics:
      '常见特征是单人或少量角色居中、全身或半身比例清楚、服装层次与配饰被完整展示、背景较克制，并通过姿态、表情与配色来集中传达人物设定。'
  },
  {
    aliases: ['动态的光影效果', 'dynamic lighting'],
    overview:
      '“动态的光影效果”更准确地说是一种视觉表现策略，而不是严格独立的艺术流派；它强调用流动的光源变化来提升画面的戏剧性和空间感。',
    lineage:
      '这类表达借用了电影摄影、动画特效、游戏实时渲染和商业人像的经验，把边缘光、体积光、反射高光与局部阴影组织成更有运动感的视觉节奏。',
    characteristics:
      '常见特征包括明显的明暗切分、发丝或轮廓处的高光、局部强反差、体积光穿透、光斑和反射细节，以及人物或主体仿佛被光线“雕刻”出来的立体感。'
  },
  {
    aliases: ['虚幻6渲染', 'Unreal Engine 6 render', 'Unreal 6 render', 'UE6 render'],
    overview:
      '在 AIGC prompt 语境里，“虚幻6渲染”通常不是严格的软件版本说明，而是一种借用 Unreal 系实时引擎印象词的说法，用来指向电影化、游戏概念图式的高拟真渲染质感。',
    lineage:
      '它承接了游戏引擎可视化、虚拟摄影、预告片级光照和 PBR 材质表达的视觉传统，强调“实时引擎感”而不是单纯的手绘笔触，因此常被用于描述偏次世代游戏宣传图的画面语言。',
    characteristics:
      '典型特征是强体积光与环境反射、材质高光清晰、镜头感较重、空间雾化和景深明显，以及人物或场景带有接近 CG 预渲染海报的精致工业质感。'
  },
  {
    aliases: ['3D国漫风格', '3D国漫', '国漫3D风格', '国漫3D'],
    overview:
      '“3D国漫风格”通常指国产三维动画、游戏 PV 和角色海报中常见的角色塑造方式：以东方题材和国风服饰为基础，同时借助高完成度的 CG 面部、发丝和材质表现来营造商业化人物魅力。',
    lineage:
      '它承接了国产网络动画、仙侠玄幻游戏宣传图、角色建模海报与影视级 CG 宣发的视觉传统，本质上是“国风题材 + 三维角色工业流程 + 商业角色包装”的复合产物。',
    characteristics:
      '常见特征包括精细发丝与皮肤质感、写实但被美型化的人物五官、层次丰富的古风服装与配饰、强角色中心构图，以及介于影视写实和二次元理想化之间的商业角色气质。'
  },
  {
    aliases: ['莫奈油画', '莫奈油画风', '莫奈油画风格', 'Monet oil painting'],
    overview:
      '“莫奈油画”在 AIGC prompt 里通常指向莫奈及印象派油画的观感借用：强调空气感、光色流动、松散笔触与高明度色彩，而不是对某一幅作品的机械复制。',
    lineage:
      '它建立在法国印象派的光色研究之上，承接了莫奈对自然光、季节色调和同一对象不同时刻观察的绘画传统，因此常被拿来描述带有朦胧光感、色块交融和户外空气感的图像语言。',
    characteristics:
      '常见特征包括柔和但不灰闷的高明度配色、松散短促的笔触、边缘略微溶解的形体、明显的光色层叠，以及画面像被空气和水汽轻轻笼罩的通透感。'
  },
  {
    aliases: ['watercolor gouache painting', '水彩水粉绘画', '水彩水粉画'],
    displayName: '水彩水粉绘画',
    overview:
      '“水彩水粉绘画”指向以水彩的透明流动和水粉的覆盖性、粉质感共同构成的绘画语言，常用于表现柔和光感、湿润层次与带颗粒的手绘质地。',
    lineage:
      '它来自传统水媒绘画的两条路径：水彩重视透明叠色、纸面留白和水痕扩散，水粉则更强调不透明覆盖、色块塑形和哑光质感。在当代插画和 AIGC prompt 中，两者经常被合并使用，用来描述轻盈但有实体颜料感的画面。',
    characteristics:
      '典型特征包括柔和边缘、半透明色层、低饱和但明亮的色彩、可见纸纹或颗粒、花瓣和皮肤等区域的湿润渐变，以及局部用较厚水粉压出形体和高光。'
  },
  {
    aliases: ['forest fairy-tale', 'forest fairy tale', '森林童话风'],
    displayName: '森林童话风',
    overview:
      '“森林童话风”是一种把自然林地、拟人角色、柔和幻想光线和童话叙事感结合起来的视觉风格，强调温柔、神秘和故事开场般的氛围。',
    lineage:
      '它与欧洲童话插画、绘本传统、奇幻电影美术和现代治愈系插画都有关系；在 AIGC 场景里通常用于指向带有森林精灵、动物伙伴、蘑菇、树洞、微光和柔软植物层次的幻想图像。',
    characteristics:
      '常见特征包括柔和林间光、浓密植物边框、低对比自然色、带故事感的小动物或人物、轻微梦幻雾气，以及介于儿童绘本和奇幻概念插画之间的温暖叙事气质。'
  },
  {
    aliases: ['丙烯插画', '丙烯画插画', '丙烯风格插画', 'acrylic illustration'],
    overview:
      '“丙烯插画”指向以丙烯颜料观感为核心的插画表达，通常强调较强覆盖力、可见笔触、厚薄叠加和颜料肌理，而不是单纯的线稿或透明水彩感。',
    lineage:
      '它来自丙烯绘画在现代插画、海报、角色图和装饰绘画中的应用。丙烯干燥快、覆盖力强，既能做平涂色块，也能堆出近似油画的厚重肌理，因此在数字绘画和 AIGC prompt 中常被用来描述“有颜料感但更利落”的画面。',
    characteristics:
      '典型特征包括不透明色层、明显刷痕或刮痕、较强色块塑形、局部厚涂肌理、边缘兼具柔化与堆叠感，以及花卉、皮肤或背景中可见的颜料涂抹质感。'
  },
  {
    aliases: ['手绘风格', '手绘画风', '手绘', 'hand-drawn style', 'hand drawn style'],
    overview:
      '“手绘风格”指向一种强调人工绘制痕迹的视觉语言，重点不是媒介本身，而是让线条、笔触、涂抹和局部不规则性保留“被人画出来”的感觉。',
    lineage:
      '它来自传统素描、漫画、插画和速写训练，也被数字绘画长期吸收。AIGC prompt 中使用“手绘风格”时，通常是在对抗过度光滑、过度摄影化或过度 3D 的图像倾向，希望画面更像插画师手工绘制。',
    characteristics:
      '常见特征包括可见笔触、凌乱但有控制的线条、边缘不完全机械平滑、局部纸感或颜料感、明暗处理带绘画性，以及人物和场景轮廓中保留手工修正的痕迹。'
  },
  {
    aliases: ['水彩', '水彩风', '水彩风格', 'watercolor', 'watercolour'],
    overview:
      '“水彩”是一种以水和透明颜料层叠形成画面的绘画媒介风格，强调轻盈、通透、湿润扩散和纸面呼吸感。',
    lineage:
      '它来自传统水媒绘画和旅行速写、植物图谱、插画绘本等实践，在现代插画中常被用于表达柔和光线、淡雅色彩和保留手工痕迹的画面气质。',
    characteristics:
      '典型特征包括透明叠色、边缘自然晕开、低覆盖度色层、纸纹可见、留白明显，以及花瓣、服饰或皮肤处柔和的湿润渐变。'
  },
  {
    aliases: ['水墨', '水墨风', '水墨风格', 'ink wash', 'Chinese ink wash'],
    overview:
      '“水墨”指向以墨色浓淡、笔触节奏和留白经营为核心的东方绘画语言，重点在气韵、虚实和线面关系，而不只是黑白配色。',
    lineage:
      '它来自中国传统笔墨体系，并在现代国风插画、概念设计和数字绘画中被重新组合，常用于让人物、服饰或背景获得更强的东方韵味和写意感。',
    characteristics:
      '常见特征包括墨色浓淡变化、留白、干湿笔触、线条的书写性、局部晕染和虚实对照，以及用较少色彩组织出层次和空间。'
  }
];

const styleKnowledgeMap = new Map<string, StyleKnowledgeEntry>();

for (const entry of styleKnowledgeEntries) {
  for (const alias of entry.aliases) {
    styleKnowledgeMap.set(normalizeStyleTerm(alias), entry);
  }
}

function isLowValueOverview(text: string): boolean {
  const value = text.trim();
  return (
    /^(Refers to|Explicitly names|Explicit aesthetic|Describes |High-value )/i.test(value) ||
    /^Prompt 中显式点名的视觉风格词。?$/.test(value)
  );
}

function pickOverview(input: StyleNarrativeInput, entry?: StyleKnowledgeEntry): string {
  const manual = input.shortDescription.trim();
  if (manual && !isLowValueOverview(manual) && manual.length >= 26) {
    return manual;
  }

  if (entry?.overview) {
    return entry.overview;
  }

  return manual && !isLowValueOverview(manual)
    ? manual
    : `${input.name} 已进入当前词库，但它的核心定义仍待补充。`;
}

function pickLineage(input: StyleNarrativeInput, entry?: StyleKnowledgeEntry): string {
  if (entry?.lineage) {
    return entry.lineage;
  }

  const manual = input.shortDescription.trim();
  if (manual && !isLowValueOverview(manual)) {
    return manual;
  }

  if (input.termType === 'artist_style') {
    return '这里应补充该创作者或风格在漫画、插画、动画或设计史中的位置，以及它如何影响后续视觉表达。';
  }

  if (input.termType === 'movement_style') {
    return '这里应补充这种审美取向的来源、代表作品或代表媒介，以及它与相邻视觉流派之间的关系。';
  }

  return '这里应补充这种视觉语言的来源、应用语境和它在后续图像生产中的演化路径。';
}

function pickCharacteristics(input: StyleNarrativeInput, entry?: StyleKnowledgeEntry): string {
  const manual = input.visualTraits.trim();
  if (manual) {
    return manual;
  }

  if (entry?.characteristics) {
    return entry.characteristics;
  }

  return '这里应补充这种风格在构图、线条、色彩、材质和空间处理上的典型视觉特征。';
}

export function deriveStyleNarrative(input: StyleNarrativeInput): StyleNarrative {
  const entry = styleKnowledgeMap.get(normalizeStyleTerm(input.name));

  return {
    overview: pickOverview(input, entry),
    lineage: pickLineage(input, entry),
    characteristics: pickCharacteristics(input, entry)
  };
}

export function deriveStyleDisplayName(name: string): string {
  return styleKnowledgeMap.get(normalizeStyleTerm(name))?.displayName ?? name;
}

export function getCuratedStyleNarrative(name: string): StyleNarrative | undefined {
  const entry = styleKnowledgeMap.get(normalizeStyleTerm(name));
  if (!entry) {
    return undefined;
  }

  return {
    overview: entry.overview,
    lineage: entry.lineage,
    characteristics: entry.characteristics
  };
}
