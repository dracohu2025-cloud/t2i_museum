import { afterEach, describe, expect, it, vi } from 'vitest';

import { OpenAIStyleAnalyzer } from './style-analyzer';

describe('OpenAIStyleAnalyzer', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses plain JSON prompting for OpenRouter requests', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));

      expect(body.model).toBe('deepseek/deepseek-v4-flash');
      expect(body.max_tokens).toBe(600);
      expect(body.temperature).toBe(0);
      expect(body.tools).toBeUndefined();
      expect(body.tool_choice).toBeUndefined();
      expect(body.response_format).toBeUndefined();
      expect(body.messages[0].role).toBe('system');

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  candidates: [
                    {
                      rawTerm: 'Moebius (Jean Giraud)风格',
                      normalizedCandidate: 'Moebius (Jean Giraud)',
                      termType: 'artist_style',
                      confidence: 0.97,
                      shouldBeStyleTag: true,
                      shortExplanation: '法式科幻漫画线稿与配色语言'
                    }
                  ]
                })
              }
            }
          ]
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      );
    });

    vi.stubGlobal('fetch', fetchMock);

    const analyzer = new OpenAIStyleAnalyzer({
      apiKey: 'test-key',
      model: 'deepseek/deepseek-v4-flash',
      baseUrl: 'https://openrouter.ai/api/v1',
      timeoutMs: 15000,
      promptVersion: 'v1'
    });

    const result = await analyzer.analyzePrompt({
      promptRaw: 'Moebius (Jean Giraud)风格，极繁主义'
    });

    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0]?.normalizedCandidate).toBe('Moebius (Jean Giraud)风格');
  });

  it('uses json_object mode for direct Kimi API calls', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));

      expect(body.model).toBe('kimi-k2.6');
      expect(body.response_format).toEqual({ type: 'json_object' });
      expect(body.thinking).toEqual({ type: 'disabled' });
      expect(body.tools).toBeUndefined();
      expect(body.tool_choice).toBeUndefined();
      expect(body.temperature).toBeUndefined();

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  candidates: []
                })
              }
            }
          ]
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      );
    });

    vi.stubGlobal('fetch', fetchMock);

    const analyzer = new OpenAIStyleAnalyzer({
      apiKey: 'test-key',
      model: 'kimi-k2.6',
      baseUrl: 'https://api.moonshot.ai/v1',
      timeoutMs: 15000,
      promptVersion: 'v1'
    });

    const result = await analyzer.analyzePrompt({
      promptRaw: '极繁主义'
    });

    expect(result.candidates).toEqual([
      expect.objectContaining({
        rawTerm: '极繁主义',
        normalizedCandidate: '极繁主义',
        termType: 'movement_style',
        shouldBeStyleTag: true
      })
    ]);
  });

  it('falls back to tool calling for generic OpenAI-compatible models', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));

      expect(body.model).toBe('some-provider/model-x');
      expect(body.temperature).toBe(0);
      expect(body.tools).toHaveLength(1);
      expect(body.tool_choice).toEqual({
        type: 'function',
        function: {
          name: 'extract_style_terms'
        }
      });
      expect(body.response_format).toBeUndefined();

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    function: {
                      arguments: JSON.stringify({
                        candidates: [
                          {
                            rawTerm: '极繁主义',
                            normalizedCandidate: '极繁主义',
                            termType: 'movement_style',
                            confidence: 0.88,
                            shouldBeStyleTag: true,
                            shortExplanation: '高密度细节与装饰堆叠'
                          }
                        ]
                      })
                    }
                  }
                ]
              }
            }
          ]
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      );
    });

    vi.stubGlobal('fetch', fetchMock);

    const analyzer = new OpenAIStyleAnalyzer({
      apiKey: 'test-key',
      model: 'some-provider/model-x',
      baseUrl: 'https://api.example.com/v1',
      timeoutMs: 15000,
      promptVersion: 'v1'
    });

    const result = await analyzer.analyzePrompt({
      promptRaw: '极繁主义'
    });

    expect(result.candidates[0]?.normalizedCandidate).toBe('极繁主义');
  });

  it('falls back to a secondary model after the primary request fails', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => {
        throw new Error('primary timeout');
      })
      .mockImplementationOnce(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body));

        expect(body.model).toBe('xiaomi/mimo-v2.5');

        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    candidates: [
                      {
                        rawTerm: 'Moebius (Jean Giraud)风格',
                        normalizedCandidate: 'Moebius (Jean Giraud)',
                        termType: 'artist_style',
                        confidence: 0.95,
                        shouldBeStyleTag: true,
                        shortExplanation: '法式科幻漫画线稿与色彩控制'
                      }
                    ]
                  })
                }
              }
            ]
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json'
            }
          }
        );
      });

    vi.stubGlobal('fetch', fetchMock);

    const analyzer = new OpenAIStyleAnalyzer({
      apiKey: 'test-key',
      model: 'deepseek/deepseek-v4-flash',
      fallbackModel: 'xiaomi/mimo-v2.5',
      baseUrl: 'https://openrouter.ai/api/v1',
      timeoutMs: 15000,
      promptVersion: 'v1'
    });

    const result = await analyzer.analyzePrompt({
      promptRaw: 'Moebius (Jean Giraud)风格'
    });

    expect(result.candidates[0]?.normalizedCandidate).toBe('Moebius (Jean Giraud)风格');
    expect(analyzer.describe().model).toBe('xiaomi/mimo-v2.5');
  });

  it('collapses subject-specific medium phrases to a generic medium tag', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  candidates: [
                    {
                      rawTerm: '蔷薇插画',
                      normalizedCandidate: '蔷薇插画',
                      termType: 'aesthetic_style',
                      confidence: 0.9,
                      shouldBeStyleTag: true,
                      shortExplanation: 'rose illustration'
                    }
                  ]
                })
              }
            }
          ]
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      );
    });

    vi.stubGlobal('fetch', fetchMock);

    const analyzer = new OpenAIStyleAnalyzer({
      apiKey: 'test-key',
      model: 'openai/gpt-5-mini',
      baseUrl: 'https://api.openai.com/v1',
      timeoutMs: 15000,
      promptVersion: 'v1'
    });

    const result = await analyzer.analyzePrompt({
      promptRaw: '蔷薇插画'
    });

    expect(result.candidates).toEqual([
      expect.objectContaining({
        rawTerm: '插画',
        normalizedCandidate: '插画',
        termType: 'medium_rendering',
        shouldBeStyleTag: true
      })
    ]);
  });

  it('preserves medium phrases when the prefix itself is a style descriptor', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  candidates: [
                    {
                      rawTerm: '水粉插画',
                      normalizedCandidate: '水粉插画',
                      termType: 'aesthetic_style',
                      confidence: 0.88,
                      shouldBeStyleTag: true,
                      shortExplanation: 'gouache illustration'
                    }
                  ]
                })
              }
            }
          ]
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      );
    });

    vi.stubGlobal('fetch', fetchMock);

    const analyzer = new OpenAIStyleAnalyzer({
      apiKey: 'test-key',
      model: 'openai/gpt-5-mini',
      baseUrl: 'https://api.openai.com/v1',
      timeoutMs: 15000,
      promptVersion: 'v1'
    });

    const result = await analyzer.analyzePrompt({
      promptRaw: '水粉插画'
    });

    expect(result.candidates).toEqual([
      expect.objectContaining({
        rawTerm: '水粉插画',
        normalizedCandidate: '水粉插画',
        shouldBeStyleTag: true
      })
    ]);
  });

  it('extracts acrylic illustration from prompt text when the model returns no usable tags', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: null
              }
            }
          ]
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      );
    });

    vi.stubGlobal('fetch', fetchMock);

    const analyzer = new OpenAIStyleAnalyzer({
      apiKey: 'test-key',
      model: 'deepseek/deepseek-v4-flash',
      baseUrl: 'https://openrouter.ai/api/v1',
      timeoutMs: 15000,
      promptVersion: 'v1'
    });

    const result = await analyzer.analyzePrompt({
      promptRaw: '自然光，颜料的涂抹感+肌理感，丙烯插画，微光，宿命感。'
    });

    expect(result.candidates).toEqual([
      expect.objectContaining({
        rawTerm: '丙烯插画',
        normalizedCandidate: '丙烯插画',
        shouldBeStyleTag: true
      })
    ]);
  });

  it('extracts hand-drawn style from comma-separated prompt context', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: null
              }
            }
          ]
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      );
    });

    vi.stubGlobal('fetch', fetchMock);

    const analyzer = new OpenAIStyleAnalyzer({
      apiKey: 'test-key',
      model: 'deepseek/deepseek-v4-flash',
      baseUrl: 'https://openrouter.ai/api/v1',
      timeoutMs: 15000,
      promptVersion: 'v1'
    });

    const result = await analyzer.analyzePrompt({
      promptRaw: '宣纸，朋克风，笔触冷硬，手绘风格，凌乱线条，漫画构图。'
    });

    expect(result.candidates).toContainEqual(
      expect.objectContaining({
        rawTerm: '手绘风格',
        normalizedCandidate: '手绘风格',
        shouldBeStyleTag: true
      })
    );
  });

  it('expands a model-generic medium term to the explicit 风格 phrase in the prompt', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  candidates: [
                    {
                      rawTerm: '插画',
                      normalizedCandidate: '插画',
                      termType: 'medium_rendering',
                      confidence: 0.9,
                      shouldBeStyleTag: true,
                      shortExplanation: 'prompt 中出现的媒介渲染词'
                    }
                  ]
                })
              }
            }
          ]
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      );
    });

    vi.stubGlobal('fetch', fetchMock);

    const analyzer = new OpenAIStyleAnalyzer({
      apiKey: 'test-key',
      model: 'openai/gpt-5-mini',
      baseUrl: 'https://api.openai.com/v1',
      timeoutMs: 15000,
      promptVersion: 'v1'
    });

    const result = await analyzer.analyzePrompt({
      promptRaw: '治愈系高清壁纸，插画风格，一只巨大的粉白色沙猫。'
    });

    expect(result.candidates).toContainEqual(
      expect.objectContaining({
        rawTerm: '插画风格',
        normalizedCandidate: '插画风格',
        termType: 'medium_rendering',
        shouldBeStyleTag: true
      })
    );
  });

  it('expands a model-short movement term to the explicit 主义 phrase in the prompt', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  candidates: [
                    {
                      rawTerm: '极简',
                      normalizedCandidate: '极简',
                      termType: 'aesthetic_style',
                      confidence: 0.9,
                      shouldBeStyleTag: true,
                      shortExplanation: 'prompt 中出现的美学词'
                    }
                  ]
                })
              }
            }
          ]
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      );
    });

    vi.stubGlobal('fetch', fetchMock);

    const analyzer = new OpenAIStyleAnalyzer({
      apiKey: 'test-key',
      model: 'openai/gpt-5-mini',
      baseUrl: 'https://api.openai.com/v1',
      timeoutMs: 15000,
      promptVersion: 'v1'
    });

    const result = await analyzer.analyzePrompt({
      promptRaw: '极简主义构图，留白，冷静的线条。'
    });

    expect(result.candidates).toContainEqual(
      expect.objectContaining({
        rawTerm: '极简主义',
        normalizedCandidate: '极简主义',
        termType: 'movement_style',
        shouldBeStyleTag: true
      })
    );
  });

  it('prefers original prompt terms and drops model-translated style tags', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  candidates: [
                    {
                      rawTerm: 'pink tones',
                      normalizedCandidate: 'pink tones',
                      termType: 'aesthetic_style',
                      confidence: 0.7,
                      shouldBeStyleTag: true,
                      shortExplanation: 'translated color palette'
                    },
                    {
                      rawTerm: 'ultra HD',
                      normalizedCandidate: 'ultra HD',
                      termType: 'aesthetic_style',
                      confidence: 0.6,
                      shouldBeStyleTag: true,
                      shortExplanation: 'translated quality term'
                    },
                    {
                      rawTerm: 'anime watercolor',
                      normalizedCandidate: 'anime watercolor',
                      termType: 'aesthetic_style',
                      confidence: 0.95,
                      shouldBeStyleTag: true,
                      shortExplanation: 'translated medium style'
                    }
                  ]
                })
              }
            }
          ]
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      );
    });

    vi.stubGlobal('fetch', fetchMock);

    const analyzer = new OpenAIStyleAnalyzer({
      apiKey: 'test-key',
      model: 'openai/gpt-5-mini',
      baseUrl: 'https://api.openai.com/v1',
      timeoutMs: 15000,
      promptVersion: 'v1'
    });

    const result = await analyzer.analyzePrompt({
      promptRaw: '校园，青春，朋友，天空和云，粉色调，超清，细腻，动漫水彩'
    });

    expect(result.candidates.map((candidate) => candidate.normalizedCandidate)).toEqual([
      '动漫水彩'
    ]);
  });

  it('supplements obvious medium tags such as oil painting when the model misses them', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  candidates: [
                    {
                      rawTerm: 'BJD',
                      normalizedCandidate: 'BJD',
                      termType: 'aesthetic_style',
                      confidence: 0.86,
                      shouldBeStyleTag: true,
                      shortExplanation: 'prompt 中显式出现的人偶审美风格'
                    },
                    {
                      rawTerm: '水墨',
                      normalizedCandidate: '水墨',
                      termType: 'medium_rendering',
                      confidence: 0.9,
                      shouldBeStyleTag: true,
                      shortExplanation: 'prompt 中显式出现的媒介渲染词'
                    }
                  ]
                })
              }
            }
          ]
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      );
    });

    vi.stubGlobal('fetch', fetchMock);

    const analyzer = new OpenAIStyleAnalyzer({
      apiKey: 'test-key',
      model: 'openai/gpt-5-mini',
      baseUrl: 'https://api.openai.com/v1',
      timeoutMs: 15000,
      promptVersion: 'v1'
    });

    const result = await analyzer.analyzePrompt({
      promptRaw: '油画重彩，色彩饱满，绝代美人，BJD风格美人，全身写真，水墨渲染。'
    });

    expect(result.candidates).toEqual([
      expect.objectContaining({
        normalizedCandidate: 'BJD风格'
      }),
      expect.objectContaining({
        normalizedCandidate: '水墨'
      }),
      expect.objectContaining({
        normalizedCandidate: '油画',
        termType: 'medium_rendering',
        shouldBeStyleTag: true
      })
    ]);
  });

  it('splits watercolor fused with ink wash into two medium style tags', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: null
              }
            }
          ]
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      );
    });

    vi.stubGlobal('fetch', fetchMock);

    const analyzer = new OpenAIStyleAnalyzer({
      apiKey: 'test-key',
      model: 'deepseek/deepseek-v4-flash',
      baseUrl: 'https://openrouter.ai/api/v1',
      timeoutMs: 15000,
      promptVersion: 'v1'
    });

    const result = await analyzer.analyzePrompt({
      promptRaw: '二次元萌系少女，极具想象力，水彩融合水墨，极具设计感服装。'
    });

    expect(result.candidates.map((candidate) => candidate.normalizedCandidate)).toEqual([
      '水彩',
      '水墨'
    ]);
  });

  it('preserves explicit composite style phrases like 日本动漫风格立绘', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  candidates: []
                })
              }
            }
          ]
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      );
    });

    vi.stubGlobal('fetch', fetchMock);

    const analyzer = new OpenAIStyleAnalyzer({
      apiKey: 'test-key',
      model: 'deepseek/deepseek-v4-flash',
      baseUrl: 'https://openrouter.ai/api/v1',
      timeoutMs: 15000,
      promptVersion: 'v1'
    });

    const result = await analyzer.analyzePrompt({
      promptRaw: '绘制一幅比例为1:1的日本动漫风格立绘，画中是一位有着甜美气质的长发女生。'
    });

    expect(result.candidates).toEqual([
      expect.objectContaining({
        rawTerm: '日本动漫风格立绘',
        normalizedCandidate: '日本动漫风格立绘',
        shouldBeStyleTag: true
      })
    ]);
  });

  it('prefers explicit prompt composite styles over model-generic English decomposition', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  candidates: [
                    {
                      rawTerm: 'Japanese anime style',
                      normalizedCandidate: 'Japanese anime style',
                      termType: 'aesthetic_style',
                      confidence: 0.95,
                      shouldBeStyleTag: true,
                      shortExplanation: 'anime look'
                    },
                    {
                      rawTerm: 'character standing portrait (full-body)',
                      normalizedCandidate: 'character standing portrait (full-body)',
                      termType: 'aesthetic_style',
                      confidence: 0.7,
                      shouldBeStyleTag: true,
                      shortExplanation: 'standing portrait'
                    },
                    {
                      rawTerm: 'dynamic lighting and shadow effects',
                      normalizedCandidate: 'dynamic lighting and shadow effects',
                      termType: 'aesthetic_style',
                      confidence: 0.7,
                      shouldBeStyleTag: true,
                      shortExplanation: 'lighting'
                    }
                  ]
                })
              }
            }
          ]
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      );
    });

    vi.stubGlobal('fetch', fetchMock);

    const analyzer = new OpenAIStyleAnalyzer({
      apiKey: 'test-key',
      model: 'openai/gpt-5-mini',
      baseUrl: 'https://api.openai.com/v1',
      timeoutMs: 15000,
      promptVersion: 'v1'
    });

    const result = await analyzer.analyzePrompt({
      promptRaw: '绘制一幅比例为1:1的日本动漫风格立绘，画中是一位有着甜美气质的长发女生。'
    });

    expect(result.candidates).toEqual([
      expect.objectContaining({
        rawTerm: '日本动漫风格立绘',
        normalizedCandidate: '日本动漫风格立绘',
        shouldBeStyleTag: true
      })
    ]);
  });

  it('recovers from malformed JSON content that includes raw newlines inside strings', async () => {
    const malformedContent = `{
  "candidates": [
    {
      "rawTerm": "3D国漫风格",
      "normalizedCandidate": "3D国漫风格",
      "termType": "aesthetic_style",
      "confidence": 0.93,
      "shouldBeStyleTag": true,
      "shortExplanation": "强调国产三维动画/游戏海报式人物塑造
与东方角色设计语汇"
    }
  ]
}`;

    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: malformedContent
              }
            }
          ]
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      );
    });

    vi.stubGlobal('fetch', fetchMock);

    const analyzer = new OpenAIStyleAnalyzer({
      apiKey: 'test-key',
      model: 'deepseek/deepseek-v4-flash',
      baseUrl: 'https://openrouter.ai/api/v1',
      timeoutMs: 15000,
      promptVersion: 'v1'
    });

    const result = await analyzer.analyzePrompt({
      promptRaw: '古风美男子，3D国漫风格'
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.normalizedCandidate).toBe('3D国漫风格');
    expect(result.candidates[0]?.shouldBeStyleTag).toBe(true);
  });

  it('falls back to heuristic extraction when model responses remain unusable', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: null
              },
              finish_reason: 'length'
            }
          ]
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      );
    });

    vi.stubGlobal('fetch', fetchMock);

    const analyzer = new OpenAIStyleAnalyzer({
      apiKey: 'test-key',
      model: 'deepseek/deepseek-v4-flash',
      baseUrl: 'https://openrouter.ai/api/v1',
      timeoutMs: 15000,
      promptVersion: 'v1'
    });

    const result = await analyzer.analyzePrompt({
      promptRaw: '古风角色，3D国漫风格，站立全身照'
    });

    expect(result.candidates).toEqual([
      expect.objectContaining({
        rawTerm: '3D国漫风格',
        normalizedCandidate: '3D国漫风格',
        termType: 'aesthetic_style',
        shouldBeStyleTag: true
      })
    ]);
  });

  it('cleans structural prefixes and drops low-value heuristic fragments', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: null
              }
            }
          ]
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      );
    });

    vi.stubGlobal('fetch', fetchMock);

    const analyzer = new OpenAIStyleAnalyzer({
      apiKey: 'test-key',
      model: 'deepseek/deepseek-v4-flash',
      baseUrl: 'https://openrouter.ai/api/v1',
      timeoutMs: 15000,
      promptVersion: 'v1'
    });

    const result = await analyzer.analyzePrompt({
      promptRaw:
        '背景是法式轻复古风格的庭院建筑，与整体风格统一。纯欲渲染，3D渲染。'
    });

    expect(result.candidates).toEqual([
      expect.objectContaining({
        rawTerm: '法式轻复古风格',
        normalizedCandidate: '法式轻复古风格',
        shouldBeStyleTag: true
      }),
      expect.objectContaining({
        rawTerm: '3D渲染',
        normalizedCandidate: '3D渲染',
        shouldBeStyleTag: true
      })
    ]);
  });

  it('keeps standalone 立绘 and rejects structural 穿着风格 fragments', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: null
              }
            }
          ]
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      );
    });

    vi.stubGlobal('fetch', fetchMock);

    const analyzer = new OpenAIStyleAnalyzer({
      apiKey: 'test-key',
      model: 'deepseek/deepseek-v4-flash',
      baseUrl: 'https://openrouter.ai/api/v1',
      timeoutMs: 15000,
      promptVersion: 'v1'
    });

    const result = await analyzer.analyzePrompt({
      promptRaw:
        '以小偶像为主题，立绘，面部特征精致，表情迷人，头发柔软而蓬松，穿着风格独特，以紫色为主。'
    });

    expect(result.candidates).toEqual([
      expect.objectContaining({
        rawTerm: '立绘',
        normalizedCandidate: '立绘',
        shouldBeStyleTag: true
      })
    ]);
  });

  it('collapses model portrait wording to 立绘 and drops fashion, color, and outline noise', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  candidates: [
                    {
                      rawTerm: 'Lolita',
                      normalizedCandidate: 'Lolita',
                      termType: 'aesthetic_style',
                      confidence: 0.95,
                      shouldBeStyleTag: true,
                      shortExplanation: 'fashion'
                    },
                    {
                      rawTerm: 'character standing portrait (立绘)',
                      normalizedCandidate: 'character standing portrait (立绘)',
                      termType: 'aesthetic_style',
                      confidence: 0.7,
                      shouldBeStyleTag: true,
                      shortExplanation: 'portrait'
                    },
                    {
                      rawTerm: 'purple color scheme',
                      normalizedCandidate: 'purple color scheme',
                      termType: 'aesthetic_style',
                      confidence: 0.5,
                      shouldBeStyleTag: true,
                      shortExplanation: 'color'
                    },
                    {
                      rawTerm: 'white outline/line-art outlining the character',
                      normalizedCandidate: 'white outline/line-art outlining the character',
                      termType: 'aesthetic_style',
                      confidence: 0.6,
                      shouldBeStyleTag: true,
                      shortExplanation: 'outline'
                    }
                  ]
                })
              }
            }
          ]
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      );
    });

    vi.stubGlobal('fetch', fetchMock);

    const analyzer = new OpenAIStyleAnalyzer({
      apiKey: 'test-key',
      model: 'openai/gpt-5-mini',
      baseUrl: 'https://api.openai.com/v1',
      timeoutMs: 15000,
      promptVersion: 'v1'
    });

    const result = await analyzer.analyzePrompt({
      promptRaw: '以小偶像为主题，立绘，洛丽塔，紫色，白色描线边描出人物轮廓。'
    });

    expect(result.candidates).toEqual([
      expect.objectContaining({
        rawTerm: '立绘',
        normalizedCandidate: '立绘',
        termType: 'medium_rendering',
        shouldBeStyleTag: true
      })
    ]);
  });

  it('splits composite style sentences into atomic tags and drops mood clauses', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: null
              }
            }
          ]
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      );
    });

    vi.stubGlobal('fetch', fetchMock);

    const analyzer = new OpenAIStyleAnalyzer({
      apiKey: 'test-key',
      model: 'deepseek/deepseek-v4-flash',
      baseUrl: 'https://openrouter.ai/api/v1',
      timeoutMs: 15000,
      promptVersion: 'v1'
    });

    const result = await analyzer.analyzePrompt({
      promptRaw:
        '超古风主义拼贴画具有超现实主义和CG网游动漫风的水粉插画风格，营造出阴郁病娇的风格场景。'
    });

    expect(result.candidates.map((candidate) => candidate.normalizedCandidate)).toEqual([
      '超古风主义',
      '超现实主义',
      'CG网游动漫风',
      '水粉插画风格'
    ]);
  });

  it('strips structural leading words from model style candidates and drops visual placeholders', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  candidates: [
                    {
                      rawTerm: '以动漫水彩',
                      normalizedCandidate: '以动漫水彩',
                      termType: 'aesthetic_style',
                      confidence: 0.9,
                      shouldBeStyleTag: true,
                      shortExplanation: 'style'
                    },
                    {
                      rawTerm: '为视觉',
                      normalizedCandidate: '为视觉',
                      termType: 'aesthetic_style',
                      confidence: 0.7,
                      shouldBeStyleTag: true,
                      shortExplanation: 'placeholder'
                    },
                    {
                      rawTerm: '将超现实主义',
                      normalizedCandidate: '将超现实主义',
                      termType: 'movement_style',
                      confidence: 0.9,
                      shouldBeStyleTag: true,
                      shortExplanation: 'movement'
                    }
                  ]
                })
              }
            }
          ]
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      );
    });

    vi.stubGlobal('fetch', fetchMock);

    const analyzer = new OpenAIStyleAnalyzer({
      apiKey: 'test-key',
      model: 'deepseek/deepseek-v4-flash',
      baseUrl: 'https://openrouter.ai/api/v1',
      timeoutMs: 15000,
      promptVersion: 'v1'
    });

    const result = await analyzer.analyzePrompt({
      promptRaw: '以动漫水彩为视觉基础，将超现实主义和CG网游动漫风融合。'
    });

    expect(result.candidates.map((candidate) => candidate.normalizedCandidate)).toEqual([
      '动漫水彩',
      '超现实主义',
      'CG网游动漫风'
    ]);
  });
});
