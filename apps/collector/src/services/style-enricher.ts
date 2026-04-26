import { z } from 'zod';

import { getCuratedStyleNarrative } from './style-knowledge';

export interface StyleEnricherMetadata {
  provider: string;
  model: string;
  promptVersion: string;
}

export interface StyleNarrativeDraft {
  shortDescription: string;
  visualTraits: string;
  promptHints: string;
}

export interface StyleEnricher {
  enrichStyle(input: {
    name: string;
    termType: string;
    evidencePrompts: string[];
  }): Promise<StyleNarrativeDraft>;
  describe?(): StyleEnricherMetadata;
}

interface OpenAIStyleEnricherOptions {
  apiKey: string;
  model: string;
  fallbackModel?: string;
  baseUrl: string;
  timeoutMs: number;
  promptVersion: string;
}

const styleNarrativeDraftSchema = z.object({
  shortDescription: z.string().min(12),
  visualTraits: z.string().min(12),
  promptHints: z.string().min(12)
});

const styleEnricherPrompt = [
  '你在维护一个个人 t2i museum 的风格词库。',
  '请为给定的风格关键词补充中文释义，面向后续阅读、检索和 prompt 分析。',
  '输出必须是一个合法 JSON object，且只能包含 shortDescription、visualTraits、promptHints 三个字段。',
  'shortDescription：解释这个风格词在图像生成语境中的核心含义，1-2 句。',
  'visualTraits：描述构图、线条、色彩、材质、空间、角色造型等典型视觉特征，1-3 句。',
  'promptHints：说明它通常来自什么视觉传统、适合怎样使用或和哪些邻近风格区分，1-3 句。',
  '不要写“待补充”“显式点名”“视觉风格词”这类占位话术。',
  '不要杜撰具体作者归属；如果词是媒介、品类或亚文化审美，就按该类型解释。'
].join('\n');

function stripMarkdownCodeFence(content: string): string {
  const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fencedMatch?.[1]?.trim() ?? content.trim();
}

function sliceLikelyJsonObject(content: string): string {
  const firstBrace = content.indexOf('{');
  const lastBrace = content.lastIndexOf('}');
  return firstBrace >= 0 && lastBrace > firstBrace ? content.slice(firstBrace, lastBrace + 1) : content;
}

function parseDraft(content: string): StyleNarrativeDraft {
  const jsonText = sliceLikelyJsonObject(stripMarkdownCodeFence(content));
  return styleNarrativeDraftSchema.parse(JSON.parse(jsonText));
}

function providerForBaseUrl(baseUrl: string): string {
  return baseUrl.includes('openrouter.ai') ? 'openrouter' : 'openai';
}

function excerptEvidencePrompt(prompt: string, styleName: string): string {
  const cleanPrompt = prompt.trim();
  if (cleanPrompt.length <= 700) {
    return cleanPrompt;
  }

  const index = cleanPrompt.indexOf(styleName);
  if (index < 0) {
    return `${cleanPrompt.slice(0, 700)}...`;
  }

  const start = Math.max(0, index - 220);
  const end = Math.min(cleanPrompt.length, index + styleName.length + 480);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < cleanPrompt.length ? '...' : '';
  return `${prefix}${cleanPrompt.slice(start, end)}${suffix}`;
}

function buildUserContent(input: {
  name: string;
  termType: string;
  evidencePrompts: string[];
}): string {
  const evidence = input.evidencePrompts
    .filter((prompt) => prompt.trim())
    .slice(0, 4)
    .map((prompt, index) => `${index + 1}. ${excerptEvidencePrompt(prompt, input.name)}`)
    .join('\n');

  return [
    `风格关键词：${input.name}`,
    `类型：${input.termType}`,
    evidence ? `相关 prompt 片段：\n${evidence}` : '相关 prompt 片段：暂无'
  ].join('\n\n');
}

function getCuratedDraft(name: string): StyleNarrativeDraft | undefined {
  const narrative = getCuratedStyleNarrative(name);
  if (!narrative) {
    return undefined;
  }

  return {
    shortDescription: narrative.overview,
    visualTraits: narrative.characteristics,
    promptHints: narrative.lineage
  };
}

class CuratedStyleEnricher implements StyleEnricher {
  async enrichStyle(input: {
    name: string;
    termType: string;
    evidencePrompts: string[];
  }): Promise<StyleNarrativeDraft> {
    const draft = getCuratedDraft(input.name);
    if (!draft) {
      throw new Error('curated style narrative unavailable');
    }

    return draft;
  }

  describe(): StyleEnricherMetadata {
    return {
      provider: 'local',
      model: 'curated-style-knowledge',
      promptVersion: 'style-narrative-curated'
    };
  }
}

export class OpenAIStyleEnricher implements StyleEnricher {
  private lastResolvedModel = '';

  constructor(private readonly options: OpenAIStyleEnricherOptions) {}

  describe(): StyleEnricherMetadata {
    return {
      provider: providerForBaseUrl(this.options.baseUrl),
      model: this.lastResolvedModel || this.options.model,
      promptVersion: `${this.options.promptVersion}-style-narrative`
    };
  }

  private async requestDraft(
    model: string,
    input: {
      name: string;
      termType: string;
      evidencePrompts: string[];
    }
  ): Promise<StyleNarrativeDraft> {
    const useJsonObject = !this.options.baseUrl.includes('openrouter.ai');
    const response = await fetch(`${this.options.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.options.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: styleEnricherPrompt
          },
          {
            role: 'user',
            content: buildUserContent(input)
          }
        ],
        temperature: 0.2,
        max_tokens: 700,
        ...(useJsonObject
          ? {
              response_format: {
                type: 'json_object'
              }
            }
          : {
              reasoning: {
                effort: 'minimal',
                exclude: true
              }
            })
      }),
      signal: AbortSignal.timeout(this.options.timeoutMs)
    });

    if (!response.ok) {
      throw new Error(`style enrichment request failed: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };
    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('style enrichment returned no content');
    }

    return parseDraft(content);
  }

  async enrichStyle(input: {
    name: string;
    termType: string;
    evidencePrompts: string[];
  }): Promise<StyleNarrativeDraft> {
    const curatedDraft = getCuratedDraft(input.name);
    if (curatedDraft) {
      return curatedDraft;
    }

    try {
      const draft = await this.requestDraft(this.options.model, input);
      this.lastResolvedModel = this.options.model;
      return draft;
    } catch (error) {
      if (
        this.options.fallbackModel &&
        this.options.fallbackModel !== this.options.model &&
        this.options.baseUrl.includes('openrouter.ai')
      ) {
        try {
          const draft = await this.requestDraft(this.options.fallbackModel, input);
          this.lastResolvedModel = this.options.fallbackModel;
          return draft;
        } catch {}
      }

      throw error;
    }
  }
}

export function createStyleEnricherFromConfig(config: {
  openAiApiKey: string;
  openAiModel: string;
  openAiFallbackModel: string;
  openAiBaseUrl: string;
  openAiTimeoutMs: number;
  stylePromptVersion: string;
}): StyleEnricher | undefined {
  if (!config.openAiApiKey) {
    return new CuratedStyleEnricher();
  }

  return new OpenAIStyleEnricher({
    apiKey: config.openAiApiKey,
    model: config.openAiModel,
    fallbackModel: config.openAiFallbackModel,
    baseUrl: config.openAiBaseUrl,
    timeoutMs: config.openAiTimeoutMs,
    promptVersion: config.stylePromptVersion
  });
}
