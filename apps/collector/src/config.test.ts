import { afterEach, describe, expect, it } from 'vitest';

import { resolveConfig } from './config';

const originalEnv = { ...process.env };

describe('resolveConfig', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('accepts OPENROUTER_API_KEY as an OPENAI-compatible key alias and maps COS env aliases', () => {
    process.env.OPENAI_API_KEY = '';
    process.env.OPENROUTER_API_KEY = 'router-key';
    process.env.OPENAI_MODEL = 'deepseek/deepseek-v4-flash';
    process.env.OPENAI_BASE_URL = 'https://openrouter.ai/api/v1';
    process.env.COS_SecretId = 'cos-id';
    process.env.COS_SecretKey = 'cos-key';
    process.env.COS_Space_Name = 'museum-1250000000';
    process.env.COS_Domain_Name = 'https://museum-1250000000.cos.ap-singapore.myqcloud.com';
    process.env.COS_Region = 'singapore';

    const config = resolveConfig();

    expect(config.openAiApiKey).toBe('router-key');
    expect(config.openAiModel).toBe('deepseek/deepseek-v4-flash');
    expect(config.openAiFallbackModel).toBe('xiaomi/mimo-v2.5');
    expect(config.openAiBaseUrl).toBe('https://openrouter.ai/api/v1');
    expect(config.cosSecretId).toBe('cos-id');
    expect(config.cosSecretKey).toBe('cos-key');
    expect(config.cosBucket).toBe('museum-1250000000');
    expect(config.cosDomain).toBe('https://museum-1250000000.cos.ap-singapore.myqcloud.com');
    expect(config.cosRegion).toBe('ap-singapore');
  });
});
