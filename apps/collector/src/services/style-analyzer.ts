import {
  styleAnalysisResultSchema,
  type StyleAnalysisCandidate,
  type StyleAnalysisResult
} from '@t2i/contracts';

import { normalizeStyleTerm } from './style-normalizer';

export interface StyleAnalyzerMetadata {
  provider: string;
  model: string;
  promptVersion: string;
}

export interface StyleAnalyzer {
  analyzePrompt(input: { promptRaw: string }): Promise<StyleAnalysisResult>;
  describe?(): StyleAnalyzerMetadata;
}

interface OpenAIStyleAnalyzerOptions {
  apiKey: string;
  model: string;
  fallbackModel?: string;
  baseUrl: string;
  timeoutMs: number;
  promptVersion: string;
}

type RequestStrategy = 'tool_call' | 'json_object' | 'openrouter_json_prompt';

interface ChatCompletionRequestBody {
  model: string;
  messages: Array<{ role: 'system' | 'user'; content: string }>;
  temperature?: number;
  tools?: [typeof styleExtractionTool];
  tool_choice?:
    | 'auto'
    | {
        type: 'function';
        function: {
          name: 'extract_style_terms';
        };
      };
  response_format?:
    | {
        type: 'json_object';
      }
    | {
        type: 'json_schema';
        json_schema: {
          name: string;
          strict: boolean;
          schema: typeof styleAnalysisSchema;
        };
      };
  provider?: {
    require_parameters: boolean;
  };
  reasoning?: {
    effort: 'minimal';
    exclude: true;
  };
  max_tokens?: number;
  thinking?: {
    type: 'disabled';
  };
}

const styleAnalysisSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          rawTerm: {
            type: 'string',
            description: 'The original style-related term copied from the prompt.'
          },
          normalizedCandidate: {
            type: 'string',
            description: 'The canonical style name candidate after removing suffix noise.'
          },
          termType: {
            type: 'string',
            enum: [
              'artist_style',
              'movement_style',
              'aesthetic_style',
              'medium_rendering',
              'quality_modifier',
              'subject_content',
              'mood_atmosphere'
            ],
            description: 'The classification bucket for the extracted term.'
          },
          confidence: {
            type: 'number',
            description: 'A confidence score between 0 and 1.'
          },
          shouldBeStyleTag: {
            type: 'boolean',
            description: 'Whether this term should become a museum style tag.'
          },
          shortExplanation: {
            type: 'string',
            description: 'A concise explanation of why the term matters visually.'
          }
        },
        required: [
          'rawTerm',
          'normalizedCandidate',
          'termType',
          'confidence',
          'shouldBeStyleTag',
          'shortExplanation'
        ]
      }
    }
  },
  required: ['candidates']
} as const;

const styleExtractionTool = {
  type: 'function',
  function: {
    name: 'extract_style_terms',
    description:
      'Extract style-related terms from an image prompt and classify which ones should become museum style tags.',
    strict: true,
    parameters: styleAnalysisSchema
  }
} as const;

const styleAnalyzerSystemPrompt = [
  'You analyze Chinese and English image prompts for a personal t2i museum.',
  'Only extract style-related terms.',
  'Prefer artist styles, art movements, aesthetic styles, and high-value medium/rendering terms.',
  'Do not treat subject-plus-medium phrases as canonical styles. Examples: 蔷薇插画, 猫咪摄影, 樱花海报.',
  'When a phrase is mainly a subject plus a generic medium word, keep only the medium word if it is still useful.',
  'Do not promote generic quality words, subjects, or mood words into museum style tags unless they clearly name a visual style.',
  'Always keep confidence in the 0 to 1 range.'
].join(' ');

const styleAnalyzerJsonObjectPrompt = [
  styleAnalyzerSystemPrompt,
  'Return exactly one JSON object with this shape:',
  JSON.stringify(
    {
      candidates: [
        {
          rawTerm: 'string',
          normalizedCandidate: 'string',
          termType: 'artist_style',
          confidence: 0.9,
          shouldBeStyleTag: true,
          shortExplanation: 'string'
        }
      ]
    },
    null,
    2
  ),
  'The JSON object must be valid and parsable.',
  'If no style term qualifies, return {"candidates":[]}.'
].join('\n\n');

const styleAnalyzerOpenRouterPrompt = [
  'Extract style-related terms from an image prompt.',
  'Return exactly one valid JSON object and nothing else.',
  'Only include terms that appear in the prompt.',
  'Use shouldBeStyleTag=true for artist styles, art movements, aesthetic styles, and high-value medium/rendering terms.',
  'Use shouldBeStyleTag=false for generic quality words, subjects, and mood words unless they explicitly name a visual style.',
  'CRITICAL: rawTerm must be the exact span from the prompt. normalizedCandidate must be a clean style name with NO leading grammatical particles.',
  'Leading particles to strip from normalizedCandidate: 以、为、将、用、把、采用、呈现、带有、具有、以及、一种。',
  'Trailing noise to strip from normalizedCandidate: 为视觉风格、为视觉、作为视觉风格、作为主视觉、风格绘画。',
  'BAD examples: normalizedCandidate="以动漫水彩" (has leading 以), normalizedCandidate="为视觉" (is just grammatical filler), normalizedCandidate="将超现实主义" (has leading 将).',
  'GOOD examples: normalizedCandidate="动漫水彩", normalizedCandidate="超现实主义".',
  'If a candidate is only grammatical filler with no style meaning (e.g. "为视觉", "的风格"), set shouldBeStyleTag=false.',
  'If no style term qualifies, return {"candidates":[]}.',
  'JSON shape:',
  JSON.stringify({
    candidates: [
      {
        rawTerm: 'string',
        normalizedCandidate: 'string',
        termType: 'artist_style',
        confidence: 0.9,
        shouldBeStyleTag: true,
        shortExplanation: 'string'
      }
    ]
  })
].join('\n');

function isOpenRouterBaseUrl(baseUrl: string): boolean {
  return baseUrl.includes('openrouter.ai');
}

function isMoonshotBaseUrl(baseUrl: string): boolean {
  return baseUrl.includes('moonshot.ai') || baseUrl.includes('kimi.ai');
}

function isKimiModel(model: string): boolean {
  return model.startsWith('moonshotai/kimi-') || model.startsWith('kimi-');
}

function resolveRequestStrategy(options: OpenAIStyleAnalyzerOptions): RequestStrategy {
  if (isOpenRouterBaseUrl(options.baseUrl)) {
    return 'openrouter_json_prompt';
  }

  if (isMoonshotBaseUrl(options.baseUrl) || isKimiModel(options.model)) {
    return 'json_object';
  }

  return 'tool_call';
}

function buildMessages(strategy: RequestStrategy, promptRaw: string) {
  return [
    {
      role: 'system' as const,
      content:
        strategy === 'json_object'
          ? styleAnalyzerJsonObjectPrompt
          : strategy === 'openrouter_json_prompt'
            ? styleAnalyzerOpenRouterPrompt
            : styleAnalyzerSystemPrompt
    },
    {
      role: 'user' as const,
      content: `Prompt:\n${promptRaw}`
    }
  ];
}

function buildRequestBody(
  options: OpenAIStyleAnalyzerOptions,
  input: { promptRaw: string }
): ChatCompletionRequestBody {
  const strategy = resolveRequestStrategy(options);
  const body: ChatCompletionRequestBody = {
    model: options.model,
    messages: buildMessages(strategy, input.promptRaw)
  };

  if (strategy === 'tool_call') {
    body.temperature = 0;
    body.tools = [styleExtractionTool];
    body.tool_choice = {
      type: 'function',
      function: {
        name: 'extract_style_terms'
      }
    };
    return body;
  }

  if (strategy === 'openrouter_json_prompt') {
    body.temperature = 0;
    body.reasoning = {
      effort: 'minimal',
      exclude: true
    };
    body.max_tokens = 250;
    return body;
  }

  body.response_format = {
    type: 'json_object'
  };
  body.thinking = {
    type: 'disabled'
  };
  return body;
}

function stripMarkdownCodeFence(content: string): string {
  const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  return content.trim();
}

function sliceLikelyJsonObject(content: string): string {
  const firstBrace = content.indexOf('{');
  const lastBrace = content.lastIndexOf('}');

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return content.slice(firstBrace, lastBrace + 1);
  }

  return content;
}

function stripTrailingCommas(content: string): string {
  return content.replace(/,\s*([}\]])/g, '$1');
}

function escapeControlCharactersInsideStrings(content: string): string {
  let result = '';
  let inString = false;
  let escaped = false;

  for (const char of content) {
    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      result += char;
      escaped = true;
      continue;
    }

    if (char === '"') {
      result += char;
      inString = !inString;
      continue;
    }

    if (inString) {
      if (char === '\n') {
        result += '\\n';
        continue;
      }

      if (char === '\r') {
        result += '\\r';
        continue;
      }

      if (char === '\t') {
        result += '\\t';
        continue;
      }
    }

    result += char;
  }

  return result;
}

function parseJsonWithRecovery(content: string): StyleAnalysisResult {
  const trimmed = content.trim();
  const recoveryCandidates = [
    trimmed,
    stripMarkdownCodeFence(trimmed),
    sliceLikelyJsonObject(stripMarkdownCodeFence(trimmed)),
    stripTrailingCommas(sliceLikelyJsonObject(stripMarkdownCodeFence(trimmed))),
    escapeControlCharactersInsideStrings(
      stripTrailingCommas(sliceLikelyJsonObject(stripMarkdownCodeFence(trimmed)))
    )
  ];

  let lastError: unknown;

  for (const candidate of recoveryCandidates) {
    if (!candidate) {
      continue;
    }

    try {
      return styleAnalysisResultSchema.parse(JSON.parse(candidate));
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('failed to parse style analysis JSON');
}

function parseStructuredContent(content: unknown): StyleAnalysisResult | undefined {
  if (typeof content !== 'string' || content.trim().length === 0) {
    return undefined;
  }

  return parseJsonWithRecovery(content);
}

function parseToolArguments(toolArguments: unknown): StyleAnalysisResult | undefined {
  if (typeof toolArguments !== 'string' || toolArguments.trim().length === 0) {
    return undefined;
  }

  return parseJsonWithRecovery(toolArguments);
}

function classifyHeuristicTerm(term: string): StyleAnalysisCandidate['termType'] {
  if (/^(?:插画|立绘|海报|摄影|写真|油画|水彩|水粉|水墨|版画|丙烯|厚涂)$/u.test(term)) {
    return 'medium_rendering';
  }

  if (/主义$/u.test(term)) {
    return 'movement_style';
  }

  if (/(?:渲染|render)$/iu.test(term)) {
    return 'medium_rendering';
  }

  return 'aesthetic_style';
}

const compositeStyleSplitPattern = /(?:具有|带有|采用|通过|以及|和|与|并且|兼具|融合|结合|混合|搭配|配合)/u;
const atomicStylePattern =
  /([A-Za-z0-9\u4e00-\u9fff()（）·_\-\s]{0,18}?(?:动漫风格立绘|国漫风格立绘|日本动漫风格立绘|风格立绘|动漫风格|国漫风格|水彩插画风格|水粉插画风格|油画插画风格|丙烯插画风格|版画插画风格|水彩插画|水粉插画|油画插画|丙烯插画|版画插画|主义|动漫风|国漫风|日漫风|美漫风|网游动漫风|插画风格|插画|拼贴画|油画|水彩|水粉|水墨|版画|丙烯|厚涂|立绘|渲染|风格|画风))/gu;
const genericMediumSuffixes = ['插画', '摄影', '海报', '写真'] as const;
const styleDescriptorPrefixPattern =
  /(?:日本动漫|日本|日式|中式|新中式|中国风|中国|水彩|水粉|油画|丙烯|版画|黑白|极简|极繁|古风|国风|法式|日系|韩系|美式|欧式|哥特|赛博|蒸汽波|复古|动漫|二次元|国漫|日漫|美漫|写实|半写实|手绘|卡通|儿童|绘本|像素|低多边形|抽象|超现实|拼贴|厚涂|薄涂|立绘|CG|3D|2D|Q版|梦幻|童话)/u;

function sanitizeHeuristicTerm(term: string): string {
  let cleaned = term
    .trim()
    .replace(/[“”"'`]/g, '')
    .replace(/[，,。.;；:：]+$/g, '')
    .trim();

  const leadingPattern =
    /^(?:背景是|背景为|场景是|场景为|整体是|整体为|与整体|和整体|跟整体|适配|搭配|采用|呈现|带有|具有|属于|一种|一套|一个|一名|一位|和(?=[A-Za-z0-9])|以|为|将|用|使用)\s*/u;

  while (leadingPattern.test(cleaned)) {
    cleaned = cleaned.replace(leadingPattern, '').trim();
  }

  cleaned = cleaned.replace(/^(?:的|之)\s*/u, '').trim();

  cleaned = cleaned
    .replace(/(?:为视觉风格|为视觉|作为视觉风格|作为视觉|作为主视觉|为主视觉)$/u, '')
    .trim();

  const descriptorMatch = cleaned.match(styleDescriptorPrefixPattern);
  if (descriptorMatch && typeof descriptorMatch.index === 'number' && descriptorMatch.index > 0) {
    const prefixNoise = cleaned.slice(0, descriptorMatch.index);
    if (/[0-9:：]/u.test(prefixNoise) || /(?:绘制|比例|一幅|画中|的是?)$/u.test(prefixNoise) || /的$/u.test(prefixNoise)) {
      cleaned = cleaned.slice(descriptorMatch.index).trim();
    }
  }

  return cleaned;
}

function isAllowedRenderHeuristicTerm(term: string): boolean {
  return /^(?:3D|2D|CG|C4D|OC|Octane|Arnold|PBR|UE\d*|虚幻\d*|Unreal(?:\s*Engine)?\s*\d*|写实|半写实|赛璐璐|手绘|厚涂|半厚涂)\s*(?:渲染|render)$/iu.test(
    term
  );
}

function isLowValueHeuristicTerm(term: string): boolean {
  const compact = term.replace(/\s+/g, '');
  const stripped = compact.replace(/(?:风格|画风)$/u, '');
  const lower = term.trim().toLowerCase();

  if (stripped.length < 2) {
    return true;
  }

  if (
    /(?:color scheme|outline\/line-art|line-art outlining|outlining the character|white outline)/i.test(
      term
    )
  ) {
    return true;
  }

  if (
    new Set([
      '风格',
      '画风',
      '渲染',
      '视觉',
      '为视觉',
      '视觉风格',
      '主视觉',
      '整体',
      '整体风格',
      '与整体',
      '与整体风格',
      '背景',
      '背景风格',
      '穿着风格',
      '拼贴画',
      '洛丽塔',
      'lolita'
    ]).has(compact)
  ) {
    return true;
  }

  if (/^(?:lolita|lolita fashion|purple color scheme)$/i.test(lower)) {
    return true;
  }

  if (/^(?:与|和|及|并|跟)/u.test(compact)) {
    return true;
  }

  if (compact.includes('的')) {
    return true;
  }

  if (/(?:营造出|具有|带有|通过|场景|氛围|朦胧|病娇)$/u.test(compact)) {
    return true;
  }

  if (/(?:统一|呼应|适配|元素|建筑|气质)$/u.test(stripped)) {
    return true;
  }

  if (/(?:渲染|render)$/iu.test(compact) && !isAllowedRenderHeuristicTerm(term)) {
    return true;
  }

  return false;
}

function isCompoundMediumStylePhrase(term: string): boolean {
  const compact = term.replace(/\s+/g, '');
  return (
    styleDescriptorPrefixPattern.test(compact) &&
    /(?:插画|插画风格|绘画|绘画风格)$/u.test(compact)
  );
}

function normalizeHeuristicTerm(term: string): string {
  return term.trim();
}

function collapseSubjectSpecificMediumTerm(term: string): {
  normalized: string;
  termType: StyleAnalysisCandidate['termType'];
  shortExplanation: string;
} | null {
  const sanitized = sanitizeHeuristicTerm(term);
  if (!sanitized || /[\s()（）·_\-]/u.test(sanitized)) {
    return null;
  }

  for (const suffix of genericMediumSuffixes) {
    if (!sanitized.endsWith(suffix)) {
      continue;
    }

    const prefix = sanitized.slice(0, -suffix.length).trim();
    if (!prefix) {
      return null;
    }

    if (styleDescriptorPrefixPattern.test(prefix)) {
      return null;
    }

    if (/^(?:风格|画风|主义|渲染)$/u.test(prefix)) {
      return null;
    }

    return {
      normalized: suffix,
      termType: 'medium_rendering',
      shortExplanation: `${suffix}作为媒介是有效标签，但前缀更像题材对象，不应单独升格为风格。`
    };
  }

  return null;
}

function collapseExplicitPortraitTerm(term: string): {
  normalized: string;
  termType: StyleAnalysisCandidate['termType'];
  shortExplanation: string;
} | null {
  const sanitized = sanitizeHeuristicTerm(term);
  if (isDominantPromptCompositeStyle(sanitized)) {
    return null;
  }

  if (!/(?:立绘|standing portrait|character illustration|character standing portrait|full-body character portrait)/iu.test(sanitized)) {
    return null;
  }

  return {
    normalized: '立绘',
    termType: 'medium_rendering',
    shortExplanation: '立绘作为角色展示范式是当前 prompt 中最明确的风格/媒介标签。'
  };
}

function extractAtomicStyleTerms(term: string): string[] {
  const sanitized = sanitizeHeuristicTerm(term);
  if (!sanitized) {
    return [];
  }

  const results: string[] = [];
  const seen = new Set<string>();

  if (isCompoundMediumStylePhrase(sanitized)) {
    return isLowValueHeuristicTerm(sanitized) ? [] : [sanitized];
  }

  const directMatches = [...sanitized.matchAll(atomicStylePattern)]
    .map((match) => sanitizeHeuristicTerm(match[1] ?? ''))
    .filter(Boolean);

  if (!compositeStyleSplitPattern.test(sanitized) && directMatches.length < 2) {
    if (directMatches.length === 1 && directMatches[0] !== sanitized && /[，,。.;；:：]/u.test(sanitized)) {
      return isLowValueHeuristicTerm(directMatches[0]) ? [] : [directMatches[0]];
    }

    return isLowValueHeuristicTerm(sanitized) ? [] : [sanitizeHeuristicTerm(sanitized)];
  }

  const segments = sanitized
    .split(compositeStyleSplitPattern)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const pushTerm = (value: string) => {
    const normalized = normalizeHeuristicTerm(value);
    if (!normalized || isLowValueHeuristicTerm(normalized)) {
      return;
    }

    const dedupeKey = normalized.toLowerCase();
    if (seen.has(dedupeKey)) {
      return;
    }

    seen.add(dedupeKey);
    results.push(normalized);
  };

  for (const segment of segments) {
    let matched = false;

    for (const match of segment.matchAll(atomicStylePattern)) {
      const atomic = sanitizeHeuristicTerm(match[1] ?? '');
      if (!atomic) {
        continue;
      }

      matched = true;
      pushTerm(atomic);
    }

    if (!matched) {
      pushTerm(segment);
    }
  }

  return results;
}

function refineStyleAnalysisResult(result: StyleAnalysisResult): StyleAnalysisResult {
  const candidates: StyleAnalysisCandidate[] = [];
  const seen = new Set<string>();

  for (const candidate of result.candidates) {
    if (!candidate.shouldBeStyleTag) {
      continue;
    }

    const rawCandidate = sanitizeHeuristicTerm(candidate.rawTerm || candidate.normalizedCandidate);
    const normalizedCandidate = sanitizeHeuristicTerm(candidate.normalizedCandidate);
    const atomicTerms = extractAtomicStyleTerms(rawCandidate || normalizedCandidate);
    const shouldPreserveModelNormalized =
      atomicTerms.length === 1 &&
      rawCandidate.length > 0 &&
      normalizedCandidate.length > 0 &&
      atomicTerms[0] === rawCandidate;
    const terms = atomicTerms.length > 0 ? atomicTerms : [normalizedCandidate];

    for (const term of terms) {
      const normalized = shouldPreserveModelNormalized
        ? normalizedCandidate
        : normalizeHeuristicTerm(term);
      if (!normalized || isLowValueHeuristicTerm(normalized)) {
        continue;
      }

      const collapsedMedium = collapseSubjectSpecificMediumTerm(normalized);
      const collapsedPortrait = collapseExplicitPortraitTerm(collapsedMedium?.normalized ?? normalized);
      const finalTerm = collapsedPortrait?.normalized ?? collapsedMedium?.normalized ?? normalized;
      const finalTermType =
        collapsedPortrait?.termType ?? collapsedMedium?.termType ?? classifyHeuristicTerm(finalTerm);
      const finalExplanation =
        collapsedPortrait?.shortExplanation ?? collapsedMedium?.shortExplanation ?? candidate.shortExplanation;

      const dedupeKey = finalTerm.toLowerCase();
      if (seen.has(dedupeKey)) {
        continue;
      }

      seen.add(dedupeKey);
      candidates.push({
        rawTerm: finalTerm,
        normalizedCandidate: finalTerm,
        termType: finalTermType,
        confidence: candidate.confidence,
        shouldBeStyleTag: true,
        shortExplanation: finalExplanation
      });
    }
  }

  return { candidates };
}

function isDominantPromptCompositeStyle(term: string): boolean {
  return /(?:日本动漫风格立绘|国漫风格立绘|动漫风格立绘|风格立绘)$/u.test(
    sanitizeHeuristicTerm(term)
  );
}

function applyPromptAnchoredOverrides(
  result: StyleAnalysisResult,
  promptRaw: string
): StyleAnalysisResult {
  const anchoredResult = extractHeuristicStyleCandidates(promptRaw);
  if (anchoredResult.candidates.length === 0) {
    return filterModelCandidatesByPrompt(result, promptRaw);
  }

  if (
    anchoredResult.candidates.some((candidate) =>
      isDominantPromptCompositeStyle(candidate.normalizedCandidate || candidate.rawTerm)
    )
  ) {
    return anchoredResult;
  }

  const promptAnchored = filterModelCandidatesByPrompt(result, promptRaw);
  if (promptAnchored.candidates.length === 0) {
    return anchoredResult;
  }

  // Merge: use filtered model candidates as the authoritative base, then supplement with
  // heuristic terms that the model missed entirely (not already covered in the model output).
  // Use normalizeStyleTerm for dedup so suffix variants like '风格' don't create duplicates.
  const seenNorms = new Set<string>(
    promptAnchored.candidates.map((c) => normalizeStyleTerm(c.normalizedCandidate))
  );
  const supplement = anchoredResult.candidates.filter(
    (c) => !seenNorms.has(normalizeStyleTerm(c.normalizedCandidate))
  );
  return { candidates: [...promptAnchored.candidates, ...supplement] };
}


function filterModelCandidatesByPrompt(
  result: StyleAnalysisResult,
  promptRaw: string
): StyleAnalysisResult {
  const normalizedPrompt = promptRaw.toLowerCase();

  return {
    candidates: result.candidates.filter((candidate) => {
      const rawTerm = candidate.rawTerm.trim().toLowerCase();
      const normalizedCandidate = candidate.normalizedCandidate.trim().toLowerCase();

      return (
        rawTerm.length > 0 &&
        normalizedPrompt.includes(rawTerm)
      ) || (
        normalizedCandidate.length > 0 &&
        normalizedPrompt.includes(normalizedCandidate)
      );
    })
  };
}

function extractHeuristicStyleCandidates(promptRaw: string): StyleAnalysisResult {
  const matches = promptRaw.match(
    /([A-Za-z0-9\u4e00-\u9fff()（）·_\-\s]{0,28}?(?:动漫风格立绘|国漫风格立绘|日本动漫风格立绘|风格立绘|动漫风格|国漫风格|网游动漫风|水彩插画风格|水粉插画风格|油画插画风格|丙烯插画风格|版画插画风格|水彩插画|水粉插画|油画插画|丙烯插画|版画插画|插画风格|插画|风格|画风|主义|渲染|油画|水彩|水粉|水墨|版画|丙烯|厚涂|立绘))/gu
  );

  const candidates: StyleAnalysisCandidate[] = [];

  for (const match of matches ?? []) {
    for (const rawTerm of extractAtomicStyleTerms(match)) {
      candidates.push({
        rawTerm,
        normalizedCandidate: normalizeHeuristicTerm(rawTerm),
        termType: classifyHeuristicTerm(rawTerm),
        confidence: 0.78,
        shouldBeStyleTag: true,
        shortExplanation: 'Prompt 中显式点名的视觉风格词。'
      });
    }
  }

  return refineStyleAnalysisResult({ candidates });
}

export class OpenAIStyleAnalyzer implements StyleAnalyzer {
  private lastResolvedModel = '';

  constructor(private readonly options: OpenAIStyleAnalyzerOptions) {}

  describe(): StyleAnalyzerMetadata {
    return {
      provider: isOpenRouterBaseUrl(this.options.baseUrl) ? 'openrouter' : 'openai',
      model: this.lastResolvedModel ?? this.options.model,
      promptVersion: this.options.promptVersion
    };
  }

  private async requestAnalysis(
    model: string,
    input: { promptRaw: string }
  ): Promise<StyleAnalysisResult> {
    const response = await fetch(`${this.options.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.options.apiKey}`
      },
      body: JSON.stringify(
        buildRequestBody(
          {
            ...this.options,
            model
          },
          input
        )
      ),
      signal: AbortSignal.timeout(this.options.timeoutMs)
    });

    if (!response.ok) {
      throw new Error(`style analysis request failed: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
          tool_calls?: Array<{
            function?: {
              arguments?: string;
            };
          }>;
        };
      }>;
    };

    const contentResult = parseStructuredContent(payload.choices?.[0]?.message?.content);
    if (contentResult) {
      return contentResult;
    }

    const toolResult = parseToolArguments(
      payload.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments
    );
    if (toolResult) {
      return toolResult;
    }

    throw new Error('style analysis returned no structured result');
  }

  async analyzePrompt(input: { promptRaw: string }): Promise<StyleAnalysisResult> {
    try {
      const result = applyPromptAnchoredOverrides(
        refineStyleAnalysisResult(await this.requestAnalysis(this.options.model, input)),
        input.promptRaw
      );
      if (result.candidates.length === 0) {
        const heuristicResult = extractHeuristicStyleCandidates(input.promptRaw);
        if (heuristicResult.candidates.length > 0) {
          this.lastResolvedModel = `${this.options.model}#heuristic`;
          return heuristicResult;
        }
      }
      this.lastResolvedModel = this.options.model;
      return result;
    } catch (error) {
      if (
        this.options.fallbackModel &&
        this.options.fallbackModel !== this.options.model &&
        isOpenRouterBaseUrl(this.options.baseUrl)
      ) {
        try {
          const fallbackResult = applyPromptAnchoredOverrides(
            refineStyleAnalysisResult(await this.requestAnalysis(this.options.fallbackModel, input)),
            input.promptRaw
          );
          if (fallbackResult.candidates.length === 0) {
            const heuristicResult = extractHeuristicStyleCandidates(input.promptRaw);
            if (heuristicResult.candidates.length > 0) {
              this.lastResolvedModel = `${this.options.fallbackModel}#heuristic`;
              return heuristicResult;
            }
          }
          this.lastResolvedModel = this.options.fallbackModel;
          return fallbackResult;
        } catch {}
      }

      const heuristicResult = extractHeuristicStyleCandidates(input.promptRaw);
      if (heuristicResult.candidates.length > 0) {
        this.lastResolvedModel = `${this.options.model}#heuristic`;
        return heuristicResult;
      }

      throw error;
    }
  }
}

export function createStyleAnalyzerFromConfig(config: {
  openAiApiKey: string;
  openAiModel: string;
  openAiFallbackModel: string;
  openAiBaseUrl: string;
  openAiTimeoutMs: number;
  stylePromptVersion: string;
}): StyleAnalyzer | undefined {
  if (!config.openAiApiKey) {
    return undefined;
  }

  return new OpenAIStyleAnalyzer({
    apiKey: config.openAiApiKey,
    model: config.openAiModel,
    fallbackModel: config.openAiFallbackModel,
    baseUrl: config.openAiBaseUrl,
    timeoutMs: config.openAiTimeoutMs,
    promptVersion: config.stylePromptVersion
  });
}
