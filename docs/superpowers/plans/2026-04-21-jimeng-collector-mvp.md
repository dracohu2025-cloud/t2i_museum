# Jimeng Collector MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable `t2i_museum` ingestion loop so a logged-in Jimeng detail page can be collected into a local SQLite catalog with cached images and normalized style tags.

**Architecture:** Use a local-first monorepo with a thin Chrome MV3 extension, a local Node.js collector service, and SQLite-backed ingestion services. The extension only extracts raw fields from the Jimeng detail page and posts them to `localhost`; the collector owns persistence, image caching, online LLM analysis, alias normalization, and read APIs for quick verification.

**Tech Stack:** Node.js 22, npm workspaces, TypeScript, Fastify, better-sqlite3, Zod, Vitest, OpenAI SDK, Chrome Extension MV3, tsup

---

> 说明：本计划只覆盖 `Phase 1：可采集`，不包含完整 museum 展示站点。由于仓库 AGENTS 约束，本文档**不包含 git commit 步骤**。

## 文件结构与职责

### 根目录

- Create: `package.json`
  - npm workspace 根配置与统一脚本
- Create: `tsconfig.base.json`
  - TypeScript 公共编译选项
- Create: `.gitignore`
  - 忽略 `node_modules`、`dist`、`data/`、`.env`
- Create: `vitest.workspace.ts`
  - 多包测试入口
- Create: `README.md`
  - 本地开发启动说明

### 共享契约

- Create: `packages/contracts/package.json`
  - 共享 schema 包
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/src/collect.ts`
  - 插件与 collector 共用的采集 payload schema
- Create: `packages/contracts/src/style-analysis.ts`
  - LLM 结构化输出 schema
- Create: `packages/contracts/src/index.ts`
- Test: `packages/contracts/src/collect.test.ts`
- Test: `packages/contracts/src/style-analysis.test.ts`

### Collector 服务

- Create: `apps/collector/package.json`
- Create: `apps/collector/tsconfig.json`
- Create: `apps/collector/src/server.ts`
  - 服务启动入口
- Create: `apps/collector/src/app.ts`
  - Fastify app 组装
- Create: `apps/collector/src/config.ts`
  - 环境变量和路径配置
- Create: `apps/collector/src/db/client.ts`
  - SQLite 连接
- Create: `apps/collector/src/db/migrate.ts`
  - 启动时迁移
- Create: `apps/collector/src/db/migrations/001_init.sql`
  - 核心表结构
- Create: `apps/collector/src/routes/health.ts`
- Create: `apps/collector/src/routes/collect.ts`
- Create: `apps/collector/src/routes/works.ts`
  - 简单查看采集结果
- Create: `apps/collector/src/services/ingest-work.ts`
  - 编排完整入馆流程
- Create: `apps/collector/src/services/image-cache.ts`
  - 下载图片并写本地缓存
- Create: `apps/collector/src/services/style-analyzer.ts`
  - 调在线模型抽取风格词
- Create: `apps/collector/src/services/style-normalizer.ts`
  - alias 命中、canonical style 收口
- Create: `apps/collector/src/services/work-repository.ts`
  - works / styles / aliases / links 持久化
- Create: `apps/collector/src/services/catalog-query.ts`
  - 给 `/works` 读取聚合数据
- Create: `apps/collector/src/test/test-db.ts`
  - 测试用临时数据库工具
- Test: `apps/collector/src/routes/health.test.ts`
- Test: `apps/collector/src/routes/collect.test.ts`
- Test: `apps/collector/src/services/image-cache.test.ts`
- Test: `apps/collector/src/services/style-normalizer.test.ts`
- Test: `apps/collector/src/services/ingest-work.test.ts`
- Test: `apps/collector/src/routes/works.test.ts`

### Chrome 插件

- Create: `apps/extension/package.json`
- Create: `apps/extension/tsconfig.json`
- Create: `apps/extension/public/manifest.json`
  - MV3 manifest
- Create: `apps/extension/tsup.config.ts`
  - 构建 content/background
- Create: `apps/extension/src/content/index.ts`
  - 注入按钮与事件绑定
- Create: `apps/extension/src/content/dom-extract.ts`
  - 从即梦详情页提取 raw payload
- Create: `apps/extension/src/content/inject-button.ts`
  - 向动作区插入 `COLLECT` 按钮
- Create: `apps/extension/src/background/index.ts`
  - 本地 collector 通讯、错误回传
- Create: `apps/extension/src/shared/constants.ts`
  - Jimeng URL pattern、本地 API 地址
- Test: `apps/extension/src/content/dom-extract.test.ts`
- Test: `apps/extension/src/content/inject-button.test.ts`

### 计划外但预留的后续目录

- Reserved: `apps/museum`
  - 本计划不实现，只保留未来位置

---

### Task 1: 建立根工作区与共享 schema 包

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `vitest.workspace.ts`
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/src/collect.ts`
- Create: `packages/contracts/src/style-analysis.ts`
- Create: `packages/contracts/src/index.ts`
- Test: `packages/contracts/src/collect.test.ts`
- Test: `packages/contracts/src/style-analysis.test.ts`

- [ ] **Step 1: 创建根工作区配置**

创建根 `package.json`，定义 workspace：

```json
{
  "name": "t2i-museum",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -b packages/contracts apps/collector apps/extension",
    "build": "npm run build -w @t2i/collector && npm run build -w @t2i/extension"
  }
}
```

- [ ] **Step 2: 写共享 schema 的失败测试**

在 `packages/contracts/src/collect.test.ts` 中先写：

```ts
import { describe, expect, it } from 'vitest';
import { collectWorkPayloadSchema } from './collect';

describe('collectWorkPayloadSchema', () => {
  it('accepts a Jimeng detail payload', () => {
    const parsed = collectWorkPayloadSchema.parse({
      sourceSite: 'jimeng',
      sourceWorkId: '7628721210028723466',
      sourceUrl: 'https://jimeng.jianying.com/ai-tool/work-detail/7628721210028723466?workDetailType=Image&itemType=9',
      promptRaw: 'Moebius (Jean Giraud)风格绘画，极繁主义',
      imageSourceUrl: 'https://example.com/work.webp',
      authorName: '啦啦乌卡吧啦啦',
      publishedAt: '2026-04-15',
      modelLabel: '图片 3.1',
      aspectRatio: '9:16'
    });
    expect(parsed.sourceWorkId).toBe('7628721210028723466');
  });
});
```

在 `packages/contracts/src/style-analysis.test.ts` 中先写：

```ts
import { describe, expect, it } from 'vitest';
import { styleAnalysisResultSchema } from './style-analysis';

describe('styleAnalysisResultSchema', () => {
  it('accepts typed style candidates', () => {
    const parsed = styleAnalysisResultSchema.parse({
      candidates: [
        {
          rawTerm: 'Moebius (Jean Giraud)风格',
          normalizedCandidate: 'Moebius (Jean Giraud)',
          termType: 'artist_style',
          confidence: 0.96,
          shouldBeStyleTag: true,
          shortExplanation: '法式科幻漫画式线稿与色彩控制'
        }
      ]
    });
    expect(parsed.candidates[0].termType).toBe('artist_style');
  });
});
```

- [ ] **Step 3: 运行测试并确认当前失败**

Run: `npm run test -- packages/contracts/src/collect.test.ts packages/contracts/src/style-analysis.test.ts`

Expected: FAIL，提示找不到 schema 导出。

- [ ] **Step 4: 实现共享 schema**

在 `packages/contracts/src/collect.ts` 中定义：

```ts
import { z } from 'zod';

export const collectWorkPayloadSchema = z.object({
  sourceSite: z.literal('jimeng'),
  sourceWorkId: z.string().min(1),
  sourceUrl: z.string().url(),
  promptRaw: z.string().min(1),
  imageSourceUrl: z.string().url(),
  authorName: z.string().optional().default(''),
  publishedAt: z.string().optional().default(''),
  modelLabel: z.string().optional().default(''),
  aspectRatio: z.string().optional().default('')
});
```

在 `packages/contracts/src/style-analysis.ts` 中定义 LLM 输出约束：

```ts
import { z } from 'zod';

export const styleTermTypeSchema = z.enum([
  'artist_style',
  'movement_style',
  'aesthetic_style',
  'medium_rendering',
  'quality_modifier',
  'subject_content',
  'mood_atmosphere'
]);
```

- [ ] **Step 5: 再次运行测试**

Run: `npm run test -- packages/contracts/src/collect.test.ts packages/contracts/src/style-analysis.test.ts`

Expected: PASS

- [ ] **Step 6: 运行类型检查**

Run: `npm run typecheck`

Expected: PASS

---

### Task 2: 建立 Collector 骨架与健康检查

**Files:**
- Create: `apps/collector/package.json`
- Create: `apps/collector/tsconfig.json`
- Create: `apps/collector/src/server.ts`
- Create: `apps/collector/src/app.ts`
- Create: `apps/collector/src/config.ts`
- Create: `apps/collector/src/routes/health.ts`
- Test: `apps/collector/src/routes/health.test.ts`

- [ ] **Step 1: 写健康检查失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app';

describe('GET /health', () => {
  it('returns collector status', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, service: 'collector' });
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm run test -- apps/collector/src/routes/health.test.ts`

Expected: FAIL，提示 `buildApp` 不存在。

- [ ] **Step 3: 搭建 collector 基础文件**

实现：

- `buildApp()`：注册 Fastify
- `config.ts`：默认 `PORT=4317`、`DATA_DIR=./data`
- `routes/health.ts`：注册 `/health`
- `server.ts`：实际监听端口

最小实现示例：

```ts
export function buildApp() {
  const app = Fastify();
  app.get('/health', async () => ({ ok: true, service: 'collector' }));
  return app;
}
```

- [ ] **Step 4: 再次运行健康检查测试**

Run: `npm run test -- apps/collector/src/routes/health.test.ts`

Expected: PASS

- [ ] **Step 5: 手动启动服务**

Run: `npm run dev -w @t2i/collector`

Expected: 日志显示监听 `http://127.0.0.1:4317`

---

### Task 3: 建立 SQLite 初始化与原始采集入库

**Files:**
- Create: `apps/collector/src/db/client.ts`
- Create: `apps/collector/src/db/migrate.ts`
- Create: `apps/collector/src/db/migrations/001_init.sql`
- Create: `apps/collector/src/routes/collect.ts`
- Create: `apps/collector/src/services/work-repository.ts`
- Create: `apps/collector/src/test/test-db.ts`
- Test: `apps/collector/src/routes/collect.test.ts`

- [ ] **Step 1: 写 `POST /api/collect` 的失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app';

describe('POST /api/collect', () => {
  it('stores the raw work as pending', async () => {
    const app = buildApp({ dataDir: './tmp/test-collect' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/collect',
      payload: {
        sourceSite: 'jimeng',
        sourceWorkId: 'w1',
        sourceUrl: 'https://jimeng.jianying.com/ai-tool/work-detail/w1?workDetailType=Image&itemType=9',
        promptRaw: 'Moebius (Jean Giraud)风格',
        imageSourceUrl: 'https://example.com/1.webp'
      }
    });

    expect(res.statusCode).toBe(202);
    expect(res.json().status).toBe('accepted');
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm run test -- apps/collector/src/routes/collect.test.ts`

Expected: FAIL，提示 `/api/collect` 未注册。

- [ ] **Step 3: 编写数据库迁移**

在 `001_init.sql` 中创建：

- `works`
- `styles`
- `style_aliases`
- `work_styles`
- `analysis_runs`

其中 `works` 至少包含：

```sql
source_site TEXT NOT NULL,
source_work_id TEXT NOT NULL,
prompt_raw TEXT NOT NULL,
image_source_url TEXT NOT NULL,
ingest_status TEXT NOT NULL DEFAULT 'pending',
UNIQUE(source_site, source_work_id)
```

- [ ] **Step 4: 实现 repository 与 `/api/collect` 的最小写入**

行为要求：

- 请求 schema 使用共享 `collectWorkPayloadSchema`
- 命中已存在作品时返回 `already_collected`
- 新作品先写入 `pending`
- 先不接图片下载和 LLM

- [ ] **Step 5: 再次运行测试**

Run: `npm run test -- apps/collector/src/routes/collect.test.ts`

Expected: PASS

- [ ] **Step 6: 增加幂等测试**

补一条测试：

```ts
it('returns already_collected for duplicate sourceWorkId', async () => {
  // 连续 POST 两次同样 payload
});
```

Expected: 第二次返回 `200` 且 `status = already_collected`

---

### Task 4: 实现图片下载与本地缓存

**Files:**
- Create: `apps/collector/src/services/image-cache.ts`
- Modify: `apps/collector/src/services/ingest-work.ts`
- Modify: `apps/collector/src/services/work-repository.ts`
- Test: `apps/collector/src/services/image-cache.test.ts`
- Test: `apps/collector/src/services/ingest-work.test.ts`

- [ ] **Step 1: 写图片缓存服务失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { cacheImageFromSource } from './image-cache';

describe('cacheImageFromSource', () => {
  it('downloads, hashes and stores a webp image', async () => {
    const result = await cacheImageFromSource({
      sourceWorkId: 'w1',
      imageSourceUrl: 'http://127.0.0.1:9999/sample.webp',
      cacheDir: './tmp/cache'
    });

    expect(result.localPath.endsWith('w1.webp')).toBe(true);
    expect(result.sha256.length).toBe(64);
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm run test -- apps/collector/src/services/image-cache.test.ts`

Expected: FAIL，提示 `cacheImageFromSource` 不存在。

- [ ] **Step 3: 实现最小图片缓存服务**

要求：

- 使用 `fetch` 下载二进制
- 按 `data/cache/originals/jimeng/<workId>.webp` 保存
- 用 Node `crypto` 计算 SHA256
- 返回宽高信息（可用 `sharp().metadata()`）

- [ ] **Step 4: 在 `ingest-work` 中接入图片缓存**

入馆编排应更新：

1. 写原始记录
2. 调 `cacheImageFromSource`
3. 回填 `image_local_path`、`image_sha256`、`width`、`height`

- [ ] **Step 5: 运行对应测试**

Run: `npm run test -- apps/collector/src/services/image-cache.test.ts apps/collector/src/services/ingest-work.test.ts`

Expected: PASS

- [ ] **Step 6: 增加失败路径测试**

补一条测试验证下载失败时：

- `works` 仍然保留
- `ingest_status` 被标记为 `failed`

---

### Task 5: 实现在线模型风格分析与 alias 归一化

**Files:**
- Create: `apps/collector/src/services/style-analyzer.ts`
- Create: `apps/collector/src/services/style-normalizer.ts`
- Modify: `apps/collector/src/services/ingest-work.ts`
- Modify: `apps/collector/src/services/work-repository.ts`
- Create: `apps/collector/.env.example`
- Test: `apps/collector/src/services/style-normalizer.test.ts`
- Test: `apps/collector/src/services/ingest-work.test.ts`

- [ ] **Step 1: 写风格归一化失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { normalizeStyleTerm } from './style-normalizer';

describe('normalizeStyleTerm', () => {
  it('strips common style suffixes before alias lookup', () => {
    expect(normalizeStyleTerm('Moebius (Jean Giraud)风格绘画')).toBe('moebius (jean giraud)');
  });
});
```

- [ ] **Step 2: 写入馆分析失败测试**

```ts
it('creates canonical styles, aliases and work_style links', async () => {
  // mock analyzer returns Moebius (Jean Giraud)风格 + 极繁主义
  // assert styles/style_aliases/work_styles rows are written
});
```

- [ ] **Step 3: 运行测试并确认失败**

Run: `npm run test -- apps/collector/src/services/style-normalizer.test.ts apps/collector/src/services/ingest-work.test.ts`

Expected: FAIL

- [ ] **Step 4: 实现本地标准化逻辑**

规则至少包含：

- 去掉 `风格`、`风格绘画`、`画风`、`style`
- 统一大小写
- 统一全角/半角括号
- 去首尾空白

- [ ] **Step 5: 实现在线分析客户端**

在 `style-analyzer.ts` 中封装：

```ts
export interface StyleAnalyzer {
  analyzePrompt(input: { promptRaw: string }): Promise<StyleAnalysisResult>;
}
```

默认实现走 OpenAI SDK，必须：

- 指定 JSON schema 风格输出
- 返回共享 `styleAnalysisResultSchema`
- 所有 provider 配置来自环境变量

- [ ] **Step 6: 在 `ingest-work` 中写入 styles / aliases / links**

流程要求：

- 先分析
- 再按 alias 命中或新建 canonical style
- 再写 `work_styles`
- 再写 `analysis_runs`

- [ ] **Step 7: 运行测试**

Run: `npm run test -- apps/collector/src/services/style-normalizer.test.ts apps/collector/src/services/ingest-work.test.ts`

Expected: PASS

- [ ] **Step 8: 补充低风险说明**

在 `.env.example` 中至少提供：

```bash
COLLECTOR_PORT=4317
COLLECTOR_DATA_DIR=./data
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-mini
```

---

### Task 6: 实现即梦详情页 Chrome 插件 MVP

**Files:**
- Create: `apps/extension/package.json`
- Create: `apps/extension/tsconfig.json`
- Create: `apps/extension/public/manifest.json`
- Create: `apps/extension/tsup.config.ts`
- Create: `apps/extension/src/content/index.ts`
- Create: `apps/extension/src/content/dom-extract.ts`
- Create: `apps/extension/src/content/inject-button.ts`
- Create: `apps/extension/src/background/index.ts`
- Create: `apps/extension/src/shared/constants.ts`
- Test: `apps/extension/src/content/dom-extract.test.ts`
- Test: `apps/extension/src/content/inject-button.test.ts`

- [ ] **Step 1: 写 DOM 提取失败测试**

用保存的 fixture HTML 断言可提取：

```ts
expect(result.sourceWorkId).toBe('7628721210028723466');
expect(result.promptRaw).toContain('Moebius (Jean Giraud)');
expect(result.aspectRatio).toBe('9:16');
```

- [ ] **Step 2: 写按钮注入失败测试**

```ts
expect(document.querySelector('[data-t2i-museum-collect]')).not.toBeNull();
```

并断言重复执行注入函数不会生成第二个按钮。

- [ ] **Step 3: 运行测试并确认失败**

Run: `npm run test -- apps/extension/src/content/dom-extract.test.ts apps/extension/src/content/inject-button.test.ts`

Expected: FAIL

- [ ] **Step 4: 实现 DOM 提取器**

基于已勘察锚点，优先围绕：

- `prompt-tip-*`
- `prompt-value-*`
- `action-buttons-wrapper-*`
- 主图大尺寸 `img`

实现 `extractJimengDetailPayload(document)`。

- [ ] **Step 5: 实现按钮注入**

要求：

- 仅在 `work-detail` 页面运行
- 挂载到动作区
- 视觉上与现有按钮同排，不破坏布局
- 请求进行中显示 `COLLECTING...`
- 成功后显示 `COLLECTED`

- [ ] **Step 6: 实现 background 通讯**

内容脚本把 payload 发送给 background，background 再 `fetch('http://127.0.0.1:4317/api/collect')`。

这样可以把未来权限和错误处理集中在 background。

- [ ] **Step 7: 运行扩展测试**

Run: `npm run test -- apps/extension/src/content/dom-extract.test.ts apps/extension/src/content/inject-button.test.ts`

Expected: PASS

- [ ] **Step 8: 本地手动装载插件**

Run: `npm run build -w @t2i/extension`

Expected: 生成可在 Chrome `Load unpacked` 加载的 `dist/`

---

### Task 7: 暴露结果查看接口并完成端到端验证

**Files:**
- Modify: `apps/collector/src/routes/works.ts`
- Create: `apps/collector/src/routes/works.test.ts`
- Modify: `README.md`

- [ ] **Step 1: 写结果查看接口失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app';

describe('GET /api/works', () => {
  it('returns works with resolved styles', async () => {
    const app = buildApp({ dataDir: './tmp/test-works' });
    const res = await app.inject({ method: 'GET', url: '/api/works' });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().items)).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm run test -- apps/collector/src/routes/works.test.ts`

Expected: FAIL，提示路由未实现。

- [ ] **Step 3: 实现查询接口**

`GET /api/works` 返回：

```json
{
  "items": [
    {
      "sourceWorkId": "7628721210028723466",
      "promptRaw": "...",
      "imageLocalPath": "...",
      "styles": [
        { "name": "Moebius (Jean Giraud)", "isPrimary": true },
        { "name": "极繁主义", "isPrimary": false }
      ]
    }
  ]
}
```

- [ ] **Step 4: 实现最小端到端测试**

在 `ingest-work.test.ts` 中补一条：

- mock 图片下载
- mock LLM 输出
- 调 `/api/collect`
- 再调 `/api/works`
- 断言作品、style、alias 都已经联通

- [ ] **Step 5: 运行 collector 全量测试**

Run: `npm run test -- apps/collector/src/routes/health.test.ts apps/collector/src/routes/collect.test.ts apps/collector/src/services/image-cache.test.ts apps/collector/src/services/style-normalizer.test.ts apps/collector/src/services/ingest-work.test.ts apps/collector/src/routes/works.test.ts`

Expected: PASS

- [ ] **Step 6: 更新 README**

写清楚：

- 如何安装依赖
- 如何启动 collector
- 如何构建并加载插件
- 如何在即梦详情页点击 `COLLECT`
- 如何访问 `/api/works` 查看结果

---

### Task 8: 手工验收清单

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 启动 collector**

Run: `npm run dev -w @t2i/collector`

Expected: `/health` 返回 `{ "ok": true, "service": "collector" }`

- [ ] **Step 2: 构建并加载扩展**

Run: `npm run build -w @t2i/extension`

Expected: Chrome 可以成功 `Load unpacked`

- [ ] **Step 3: 在真实即梦详情页点击 `COLLECT`**

Expected:

- 页面出现 `COLLECT`
- 点击后状态进入 `COLLECTING...`
- 成功后显示 `COLLECTED`

- [ ] **Step 4: 检查本地缓存**

Run: `find ./data/cache/originals -type f | head`

Expected: 出现以 `workId.webp` 命名的文件

- [ ] **Step 5: 检查 catalog API**

Run: `curl http://127.0.0.1:4317/api/works`

Expected: 返回包含 `promptRaw`、`imageLocalPath`、`styles` 的 JSON

- [ ] **Step 6: 检查数据库状态**

Run: `sqlite3 ./data/catalog.sqlite '.tables'`

Expected: 至少包含 `works styles style_aliases work_styles analysis_runs`

---

## 额外实现说明

### 1. 不提前做的内容

以下内容明确不进入本计划：

- museum React/Vue 前端
- style hero 背景自动挑选
- 低置信度人工审核台
- 历史重跑 reindex 命令
- 列表页采集
- 多来源站点支持

### 2. LLM 提示词约束

实现时必须强制模型输出结构化 JSON，字段至少包含：

- `rawTerm`
- `normalizedCandidate`
- `termType`
- `confidence`
- `shouldBeStyleTag`
- `shortExplanation`

### 3. 错误处理边界

Collector 必须区分：

- 输入无效：直接拒绝
- 图片下载失败：保留原始 work，状态失败
- LLM 分析失败：保留原始 work，写 `analysis_runs`
- 重复点击：返回 `already_collected`

### 4. 未来扩展点

为了后续支持更多来源站点，当前实现要保留两个可替换边界：

- `extractJimengDetailPayload()`：页面适配层
- `StyleAnalyzer` 接口：模型提供商适配层

---

## 交付标准

完成本计划后，应达到以下可验证状态：

1. Chrome 插件能在 Jimeng `work-detail` 页注入 `COLLECT`
2. 点击一次后能把当前作品写入本地 SQLite
3. 主图被下载到本地缓存目录
4. 在线模型能生成风格词并写入 `styles / style_aliases / work_styles`
5. `/api/works` 能返回带 style 聚合结果的作品列表
6. 全部单元/集成测试通过
