import type Database from 'better-sqlite3';

import {
  deriveStyleDisplayName,
  deriveStyleNarrative,
  type StyleNarrative
} from './style-knowledge';

export interface WorkListItem {
  workId: number;
  sourceWorkId: string;
  sourceUrl: string;
  promptRaw: string;
  imageLocalPath: string;
  imageUrl: string;
  ingestStatus: string;
  authorName: string;
  publishedAt: string;
  modelLabel: string;
  aspectRatio: string;
  styles: Array<{
    name: string;
    slug: string;
    status: string;
    isPrimary: boolean;
  }>;
}

export interface WorkDetail extends WorkListItem {
  progress: WorkIngestProgress;
  relatedWorks: WorkListItem[];
}

export interface WorkIngestProgress {
  stageKey: 'pending' | 'caching' | 'uploading' | 'analyzing' | 'done' | 'failed';
  stageLabel: string;
  percent: number;
  message: string;
  isTerminal: boolean;
  isSuccess: boolean;
}

export interface StyleListItem {
  slug: string;
  name: string;
  termType: string;
  status: string;
  shortDescription: string;
  workCount: number;
  heroImageUrl: string;
}

export interface StyleDetail {
  slug: string;
  name: string;
  termType: string;
  status: string;
  shortDescription: string;
  visualTraits: string;
  promptHints: string;
  narrative: StyleNarrative;
  heroWorkId: number | null;
  heroImageUrl: string;
  heroPrompt: string;
  aliases: Array<{
    name: string;
    source: string;
    confidence: number;
  }>;
  works: WorkListItem[];
}

function trimLeadingDot(pathValue: string): string {
  return pathValue.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/g, '');
}

function toPublicImageUrl(imageLocalPath: string, dataDir: string, cosUrl = ''): string {
  if (cosUrl) {
    return cosUrl;
  }

  if (!imageLocalPath) {
    return '';
  }

  const normalizedPath = trimLeadingDot(imageLocalPath);
  const normalizedDataDir = trimLeadingDot(dataDir);
  const relativePath = normalizedPath.startsWith(`${normalizedDataDir}/`)
    ? normalizedPath.slice(normalizedDataDir.length + 1)
    : normalizedPath.startsWith('data/')
      ? normalizedPath.slice('data/'.length)
      : normalizedPath;
  return `/media/${relativePath}`;
}

function mapWorkRows(
  rows: Array<{
    work_id: number;
    source_work_id: string;
    source_url: string;
    prompt_raw: string;
    image_local_path: string;
    cos_url: string;
    ingest_status: string;
    author_name: string;
    published_at: string;
    model_label: string;
    aspect_ratio: string;
    style_name: string | null;
    style_slug: string | null;
    style_status: string | null;
    is_primary: number | null;
  }>,
  dataDir: string
): WorkListItem[] {
  const works = new Map<number, WorkListItem>();

  for (const row of rows) {
    const current =
      works.get(row.work_id) ??
      {
        workId: row.work_id,
        sourceWorkId: row.source_work_id,
        sourceUrl: row.source_url,
        promptRaw: row.prompt_raw,
        imageLocalPath: row.image_local_path,
        imageUrl: toPublicImageUrl(row.image_local_path, dataDir, row.cos_url),
        ingestStatus: row.ingest_status,
        authorName: row.author_name,
        publishedAt: row.published_at,
        modelLabel: row.model_label,
        aspectRatio: row.aspect_ratio,
        styles: []
      };

    if (row.style_name && row.style_slug) {
      const alreadyLinked = current.styles.some((style) => style.slug === row.style_slug);
      if (!alreadyLinked) {
        current.styles.push({
          name: deriveStyleDisplayName(row.style_name),
          slug: row.style_slug,
          status: row.style_status ?? 'active',
          isPrimary: row.is_primary === 1
        });
      }
    }

    works.set(row.work_id, current);
  }

  return Array.from(works.values());
}

function deriveWorkIngestProgress(input: {
  ingestStatus: string;
  imageLocalPath: string;
  uploadStatus?: string;
  ingestError?: string;
}): WorkIngestProgress {
  switch (input.ingestStatus) {
    case 'caching':
      return {
        stageKey: 'caching',
        stageLabel: '正在缓存原图',
        percent: 32,
        message: '正在下载图片并保存到本地缓存。',
        isTerminal: false,
        isSuccess: false
      };
    case 'uploading':
      return {
        stageKey: 'uploading',
        stageLabel: '正在上传 COS',
        percent: 58,
        message: '本地缓存已完成，正在上传腾讯云 COS。',
        isTerminal: false,
        isSuccess: false
      };
    case 'analyzing':
      return {
        stageKey: 'analyzing',
        stageLabel: '正在分析风格',
        percent: 82,
        message: '正在分析 prompt 并整理风格标签。',
        isTerminal: false,
        isSuccess: false
      };
    case 'done':
      return {
        stageKey: 'done',
        stageLabel: '入馆完成',
        percent: 100,
        message: '图片、标签与元数据已完成入馆。',
        isTerminal: true,
        isSuccess: true
      };
    case 'failed':
      return {
        stageKey: 'failed',
        stageLabel: '处理失败',
        percent: input.imageLocalPath ? 82 : 32,
        message: input.ingestError || '入馆流程失败，请重试。',
        isTerminal: true,
        isSuccess: false
      };
    case 'pending':
    default:
      return {
        stageKey: 'pending',
        stageLabel: '已发送到 collector',
        percent: 12,
        message: 'collector 已接管任务，你现在可以切换或关闭当前页面。',
        isTerminal: false,
        isSuccess: false
      };
  }
}

export function listWorksWithStyles(db: Database.Database, dataDir: string): WorkListItem[] {
  const rows = db
    .prepare(
      `
        SELECT
          works.id AS work_id,
          works.source_work_id AS source_work_id,
          works.source_url AS source_url,
          works.prompt_raw AS prompt_raw,
          works.image_local_path AS image_local_path,
          works.cos_url AS cos_url,
          works.ingest_status AS ingest_status,
          works.author_name AS author_name,
          works.published_at AS published_at,
          works.model_label AS model_label,
          works.aspect_ratio AS aspect_ratio,
          styles.name AS style_name,
          styles.slug AS style_slug,
          styles.status AS style_status,
          work_styles.is_primary AS is_primary
        FROM works
        LEFT JOIN work_styles ON work_styles.work_id = works.id
        LEFT JOIN styles ON styles.id = work_styles.style_id
        ORDER BY works.id DESC, work_styles.is_primary DESC, styles.name ASC
      `
    )
    .all() as Array<{
      work_id: number;
      source_work_id: string;
      source_url: string;
      prompt_raw: string;
      image_local_path: string;
      cos_url: string;
      ingest_status: string;
      author_name: string;
      published_at: string;
      model_label: string;
      aspect_ratio: string;
      style_name: string | null;
      style_slug: string | null;
      style_status: string | null;
      is_primary: number | null;
    }>;

  return mapWorkRows(rows, dataDir);
}

function findHeroImagePath(
  db: Database.Database,
  styleId: number
): { path: string; prompt: string; cosUrl: string } {
  const explicitHero = db
    .prepare(
      `
        SELECT works.image_local_path AS path, works.prompt_raw AS prompt, works.cos_url AS cosUrl
        FROM styles
        INNER JOIN works ON works.id = styles.hero_work_id
        WHERE styles.id = ?
        LIMIT 1
      `
    )
    .get(styleId) as { path: string; prompt: string; cosUrl: string } | undefined;

  if (explicitHero?.path) {
    return explicitHero;
  }

  const linkedHero = db
    .prepare(
      `
        SELECT works.image_local_path AS path, works.prompt_raw AS prompt, works.cos_url AS cosUrl
        FROM work_styles
        INNER JOIN works ON works.id = work_styles.work_id
        WHERE work_styles.style_id = ?
        ORDER BY work_styles.is_primary DESC, work_styles.id ASC
        LIMIT 1
      `
    )
    .get(styleId) as { path: string; prompt: string; cosUrl: string } | undefined;

  return linkedHero ?? { path: '', prompt: '', cosUrl: '' };
}

export function listStyles(db: Database.Database, dataDir: string): StyleListItem[] {
  const styles = db
    .prepare(
      `
        SELECT id, slug, name, term_type, status, short_description
        FROM styles
        ORDER BY name ASC
      `
    )
    .all() as Array<{
      id: number;
      slug: string;
      name: string;
      term_type: string;
      status: string;
      short_description: string;
    }>;

  return styles.map((style) => {
    const workCountRow = db
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM work_styles
          WHERE style_id = ?
        `
      )
      .get(style.id) as { count: number };
    const hero = findHeroImagePath(db, style.id);
    const narrative = deriveStyleNarrative({
      name: style.name,
      termType: style.term_type,
      shortDescription: style.short_description,
      visualTraits: ''
    });

    return {
      slug: style.slug,
      name: deriveStyleDisplayName(style.name),
      termType: style.term_type,
      status: style.status,
      shortDescription: narrative.overview,
      workCount: workCountRow.count,
      heroImageUrl: toPublicImageUrl(hero.path, dataDir, hero.cosUrl)
    };
  });
}

export function getStyleDetail(
  db: Database.Database,
  slug: string,
  dataDir: string
): StyleDetail | undefined {
  const style = db
    .prepare(
      `
        SELECT id, slug, name, term_type, status, short_description, visual_traits, prompt_hints, hero_work_id
        FROM styles
        WHERE slug = ?
        LIMIT 1
      `
    )
    .get(slug) as
    | {
        id: number;
        slug: string;
        name: string;
        term_type: string;
        status: string;
        short_description: string;
        visual_traits: string;
        prompt_hints: string;
        hero_work_id: number | null;
      }
    | undefined;

  if (!style) {
    return undefined;
  }

  const hero = findHeroImagePath(db, style.id);
  const narrative = deriveStyleNarrative({
    name: style.name,
    termType: style.term_type,
    shortDescription: style.short_description,
    visualTraits: style.visual_traits
  });
  const aliases = db
    .prepare(
      `
        SELECT alias_name AS name, source, confidence
        FROM style_aliases
        WHERE style_id = ?
        ORDER BY confidence DESC, alias_name ASC
      `
    )
    .all(style.id) as Array<{
    name: string;
    source: string;
    confidence: number;
  }>;
  const rows = db
    .prepare(
      `
        SELECT
          works.id AS work_id,
          works.source_work_id AS source_work_id,
          works.source_url AS source_url,
          works.prompt_raw AS prompt_raw,
          works.image_local_path AS image_local_path,
          works.cos_url AS cos_url,
          works.ingest_status AS ingest_status,
          works.author_name AS author_name,
          works.published_at AS published_at,
          works.model_label AS model_label,
          works.aspect_ratio AS aspect_ratio,
          linked_styles.name AS style_name,
          linked_styles.slug AS style_slug,
          linked_styles.status AS style_status,
          linked_work_styles.is_primary AS is_primary
        FROM work_styles AS seed
        INNER JOIN works ON works.id = seed.work_id
        LEFT JOIN work_styles AS linked_work_styles ON linked_work_styles.work_id = works.id
        LEFT JOIN styles AS linked_styles ON linked_styles.id = linked_work_styles.style_id
        WHERE seed.style_id = ?
        ORDER BY works.id DESC, linked_work_styles.is_primary DESC, linked_styles.name ASC
      `
    )
    .all(style.id) as Array<{
      work_id: number;
      source_work_id: string;
      source_url: string;
      prompt_raw: string;
      image_local_path: string;
      cos_url: string;
      ingest_status: string;
      author_name: string;
      published_at: string;
      model_label: string;
      aspect_ratio: string;
      style_name: string | null;
      style_slug: string | null;
      style_status: string | null;
      is_primary: number | null;
    }>;

  return {
    slug: style.slug,
    name: deriveStyleDisplayName(style.name),
    termType: style.term_type,
    status: style.status,
    shortDescription: narrative.overview,
    visualTraits: style.visual_traits,
    promptHints: style.prompt_hints,
    narrative,
    heroWorkId: style.hero_work_id,
    heroImageUrl: toPublicImageUrl(hero.path, dataDir, hero.cosUrl),
    heroPrompt: hero.prompt,
    aliases,
    works: mapWorkRows(rows, dataDir)
  };
}

export function getWorkDetail(
  db: Database.Database,
  sourceWorkId: string,
  dataDir: string
): WorkDetail | undefined {
  const rows = db
    .prepare(
      `
        SELECT
          works.id AS work_id,
          works.source_work_id AS source_work_id,
          works.source_url AS source_url,
          works.prompt_raw AS prompt_raw,
          works.image_local_path AS image_local_path,
          works.cos_url AS cos_url,
          works.ingest_status AS ingest_status,
          works.author_name AS author_name,
          works.published_at AS published_at,
          works.model_label AS model_label,
          works.aspect_ratio AS aspect_ratio,
          styles.name AS style_name,
          styles.slug AS style_slug,
          styles.status AS style_status,
          work_styles.is_primary AS is_primary
        FROM works
        LEFT JOIN work_styles ON work_styles.work_id = works.id
        LEFT JOIN styles ON styles.id = work_styles.style_id
        WHERE works.source_work_id = ?
        ORDER BY works.id DESC, work_styles.is_primary DESC, styles.name ASC
      `
    )
    .all(sourceWorkId) as Array<{
    work_id: number;
    source_work_id: string;
    source_url: string;
    prompt_raw: string;
    image_local_path: string;
    cos_url: string;
    ingest_status: string;
    author_name: string;
    published_at: string;
    model_label: string;
    aspect_ratio: string;
    style_name: string | null;
    style_slug: string | null;
    style_status: string | null;
    is_primary: number | null;
  }>;

  const [work] = mapWorkRows(rows, dataDir);
  if (!work) {
    return undefined;
  }

  const progressRow = db
    .prepare(
      `
        SELECT ingest_status, image_local_path, upload_status, ingest_error
        FROM works
        WHERE source_work_id = ?
        ORDER BY id DESC
        LIMIT 1
      `
    )
    .get(sourceWorkId) as
    | {
        ingest_status: string;
        image_local_path: string;
        upload_status: string;
        ingest_error: string;
      }
    | undefined;

  const relatedRows = db
    .prepare(
      `
        SELECT
          works.id AS work_id,
          works.source_work_id AS source_work_id,
          works.source_url AS source_url,
          works.prompt_raw AS prompt_raw,
          works.image_local_path AS image_local_path,
          works.cos_url AS cos_url,
          works.ingest_status AS ingest_status,
          works.author_name AS author_name,
          works.published_at AS published_at,
          works.model_label AS model_label,
          works.aspect_ratio AS aspect_ratio,
          linked_styles.name AS style_name,
          linked_styles.slug AS style_slug,
          linked_styles.status AS style_status,
          linked_work_styles.is_primary AS is_primary
        FROM work_styles AS seed
        INNER JOIN styles AS seed_styles
          ON seed_styles.id = seed.style_id
        INNER JOIN work_styles AS shared
          ON shared.style_id = seed.style_id AND shared.work_id != seed.work_id
        INNER JOIN works
          ON works.id = shared.work_id
        LEFT JOIN work_styles AS linked_work_styles
          ON linked_work_styles.work_id = works.id
        LEFT JOIN styles AS linked_styles
          ON linked_styles.id = linked_work_styles.style_id
        WHERE seed.work_id = ?
          AND seed_styles.status != 'ignored'
        ORDER BY works.id DESC, linked_work_styles.is_primary DESC, linked_styles.name ASC
      `
    )
    .all(work.workId) as Array<{
    work_id: number;
    source_work_id: string;
    source_url: string;
    prompt_raw: string;
    image_local_path: string;
    cos_url: string;
    ingest_status: string;
    author_name: string;
    published_at: string;
    model_label: string;
    aspect_ratio: string;
    style_name: string | null;
    style_slug: string | null;
    style_status: string | null;
    is_primary: number | null;
  }>;

  return {
    ...work,
    progress: deriveWorkIngestProgress({
      ingestStatus: progressRow?.ingest_status ?? work.ingestStatus,
      imageLocalPath: progressRow?.image_local_path ?? work.imageLocalPath,
      uploadStatus: progressRow?.upload_status ?? '',
      ingestError: progressRow?.ingest_error ?? ''
    }),
    relatedWorks: mapWorkRows(relatedRows, dataDir)
  };
}
