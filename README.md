# t2i_museum

`t2i_museum` is a local-first collector and study workspace for AIGC text-to-image examples, with a focus on:

- collecting strong Jimeng image detail-page cases
- extracting style-related prompt vocabulary
- normalizing near-duplicate style terms into a growing local catalog

## Current MVP scope

The current implementation covers the first usable ingestion loop:

- Chrome extension for Jimeng `work-detail` pages
- local collector service with SQLite
- local image cache
- prompt style extraction and alias normalization
- `GET /api/works` for quick inspection

The full museum frontend is not implemented yet.
The collector now serves a built-in local museum viewer at `/museum`.

## Requirements

- Node.js 22+
- npm 10+
- Chrome with a logged-in Jimeng session
- An OpenAI-compatible key if you want online style analysis

## Install

```bash
npm install
```

## Collector setup

Create a local env file from the example:

```bash
cp apps/collector/.env.example apps/collector/.env
```

At minimum, set:

```bash
OPENAI_API_KEY=your_key_here
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=deepseek/deepseek-v4-flash
```

If you prefer naming the secret after the provider, the collector also accepts:

```bash
OPENROUTER_API_KEY=your_key_here
```

The service loads environment variables from the repo-root `.env` first, then `apps/collector/.env` as an override. This default example targets OpenRouter with `DeepSeek V4 Flash`. The collector now prefers structured JSON output for DeepSeek/OpenRouter requests and keeps a tool-calling fallback for other OpenAI-compatible providers.

Optional COS upload is also supported. The collector recognizes both the conventional `TENCENT_COS_*` variables and legacy aliases such as `COS_SecretId`, `COS_SecretKey`, `COS_Space_Name`, `COS_Domain_Name`, and `COS_Region`.

Example:

```bash
TENCENT_COS_SECRET_ID=your_secret_id
TENCENT_COS_SECRET_KEY=your_secret_key
TENCENT_COS_BUCKET=your-bucket-1250000000
TENCENT_COS_REGION=ap-singapore
TENCENT_COS_DOMAIN=https://your-bucket-1250000000.cos.ap-singapore.myqcloud.com
TENCENT_COS_PREFIX=t2i-museum
```

Start the collector:

```bash
npm run dev:collector
```

Health check:

```bash
curl http://127.0.0.1:4317/health
```

Expected:

```json
{"ok":true,"service":"collector"}
```

## Build the Chrome extension

```bash
npm run build -w @t2i/extension
```

The unpacked extension output is:

```bash
apps/extension/dist
```

Load it in Chrome:

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select `apps/extension/dist`

## Collect from Jimeng

1. Open a Jimeng image detail page:

   `https://jimeng.jianying.com/ai-tool/work-detail/<workId>?workDetailType=Image&itemType=9`

2. Confirm the collector service is running
3. Click `COLLECT`
4. Wait for the button text to change to `COLLECTED`

When COS is configured, the collector will still cache the original image locally first, then upload it to COS as a best-effort step. Upload failures are recorded but do not block the work from entering the local museum.

If the Chrome extension is temporarily unavailable on a Jimeng detail tab, you can use the CDP fallback collector instead:

```bash
npm run collect:cdp -- <targetIdPrefix>
```

The `<targetIdPrefix>` comes from your local Chrome CDP page list. This fallback extracts the current Jimeng detail payload from the live Chrome tab and posts it to the same local collector API.

## Inspect collected works

```bash
curl http://127.0.0.1:4317/api/works
```

Example response shape:

```json
{
  "items": [
    {
      "sourceWorkId": "7628721210028723466",
      "promptRaw": "Moebius (Jean Giraud)风格，极繁主义",
      "imageLocalPath": "./data/cache/originals/jimeng/7628721210028723466.webp",
      "ingestStatus": "pending",
      "styles": [
        {
          "name": "Moebius (Jean Giraud)",
          "isPrimary": true
        }
      ]
    }
  ]
}
```

## Open the local museum

With the collector running, open:

```bash
http://127.0.0.1:4317/museum
```

Useful companion endpoints:

```bash
curl http://127.0.0.1:4317/api/styles
curl http://127.0.0.1:4317/api/styles/<style-slug>
```

## Useful commands

Run all tests:

```bash
npm test
```

Type-check everything:

```bash
npm run typecheck
```

Build everything:

```bash
npm run build
```
