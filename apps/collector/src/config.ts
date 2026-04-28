export interface CollectorConfig {
  host: string;
  port: number;
  dataDir: string;
  openAiApiKey: string;
  openAiModel: string;
  openAiFallbackModel: string;
  openAiBaseUrl: string;
  openAiTimeoutMs: number;
  stylePromptVersion: string;
  cosSecretId: string;
  cosSecretKey: string;
  cosBucket: string;
  cosRegion: string;
  cosDomain: string;
  cosPrefix: string;
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => typeof value === 'string' && value.length > 0);
}

function normalizeCosRegion(region: string): string {
  if (!region) {
    return '';
  }

  const trimmedRegion = region.trim();
  return trimmedRegion.startsWith('ap-') ? trimmedRegion : `ap-${trimmedRegion}`;
}

export function resolveConfig(overrides: Partial<CollectorConfig> = {}): CollectorConfig {
  const openAiModel =
    firstNonEmpty(overrides.openAiModel, process.env.OPENAI_MODEL) ?? 'gpt-5-mini';
  const openAiBaseUrl =
    firstNonEmpty(overrides.openAiBaseUrl, process.env.OPENAI_BASE_URL) ??
    'https://api.openai.com/v1';
  const defaultFallbackModel =
    openAiBaseUrl.includes('openrouter.ai') && openAiModel.startsWith('deepseek/deepseek-')
      ? 'xiaomi/mimo-v2.5'
      : '';
  const cosRegion = normalizeCosRegion(
    firstNonEmpty(
      overrides.cosRegion,
      process.env.TENCENT_COS_REGION,
      process.env.COS_REGION,
      process.env.COS_Region
    ) ?? ''
  );

  return {
    host: overrides.host ?? process.env.COLLECTOR_HOST ?? '127.0.0.1',
    port: overrides.port ?? Number(process.env.COLLECTOR_PORT ?? 4317),
    dataDir: overrides.dataDir ?? process.env.COLLECTOR_DATA_DIR ?? './data',
    openAiApiKey: firstNonEmpty(
      overrides.openAiApiKey,
      process.env.OPENAI_API_KEY,
      process.env.OPENROUTER_API_KEY
    ) ?? '',
    openAiModel,
    openAiFallbackModel:
      firstNonEmpty(overrides.openAiFallbackModel, process.env.OPENAI_FALLBACK_MODEL) ??
      defaultFallbackModel,
    openAiBaseUrl,
    openAiTimeoutMs: overrides.openAiTimeoutMs ?? Number(process.env.OPENAI_TIMEOUT_MS ?? 30000),
    stylePromptVersion:
      firstNonEmpty(overrides.stylePromptVersion, process.env.STYLE_PROMPT_VERSION) ?? 'v1',
    cosSecretId:
      firstNonEmpty(
        overrides.cosSecretId,
        process.env.TENCENT_COS_SECRET_ID,
        process.env.COS_SECRET_ID,
        process.env.COS_SecretId
      ) ?? '',
    cosSecretKey:
      firstNonEmpty(
        overrides.cosSecretKey,
        process.env.TENCENT_COS_SECRET_KEY,
        process.env.COS_SECRET_KEY,
        process.env.COS_SecretKey
      ) ?? '',
    cosBucket:
      firstNonEmpty(
        overrides.cosBucket,
        process.env.TENCENT_COS_BUCKET,
        process.env.COS_BUCKET,
        process.env.COS_Space_Name
      ) ?? '',
    cosRegion,
    cosDomain:
      firstNonEmpty(
        overrides.cosDomain,
        process.env.TENCENT_COS_DOMAIN,
        process.env.COS_DOMAIN,
        process.env.COS_Domain_Name
      ) ?? '',
    cosPrefix:
      firstNonEmpty(
        overrides.cosPrefix,
        process.env.TENCENT_COS_PREFIX,
        process.env.COS_PREFIX
      ) ?? 't2i-museum'
  };
}
