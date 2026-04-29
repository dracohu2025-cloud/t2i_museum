import type Database from 'better-sqlite3';

import type {
  CollectWorkPayload,
  StyleAnalysisResult,
  StyleTermType
} from '@t2i/contracts';

import type { CachedImageResult } from './image-cache';
import { createStyleSlug } from './style-normalizer';

export interface CreateWorkResult {
  status: 'accepted' | 'already_collected';
  workId: number;
  imageSourceChanged: boolean;
}

export interface WorkIngestSnapshot {
  id: number;
  imageSourceUrl: string;
  imageLocalPath: string;
  imageSha256: string;
  ingestStatus: string;
  uploadStatus: string;
  cosUrl: string;
  modelLabel: string;
  aspectRatio: string;
  styleCount: number;
  analysisRunCount: number;
}

export interface StyleRecord {
  id: number;
  name: string;
  termType: string;
}

export interface DeleteWorkResult {
  workId: number;
  sourceWorkId: string;
}

export class WorkRepository {
  constructor(private readonly db: Database.Database) {}

  getWorkIdBySourceWorkId(sourceWorkId: string): number | undefined {
    const work = this.db
      .prepare(
        `
          SELECT id
          FROM works
          WHERE source_work_id = ?
          LIMIT 1
        `
      )
      .get(sourceWorkId) as { id: number } | undefined;

    return work?.id;
  }

  createPendingWork(payload: CollectWorkPayload): CreateWorkResult {
    const existing = this.db
      .prepare(
        `
          SELECT id
            , image_source_url
          FROM works
          WHERE source_site = ? AND source_work_id = ?
        `
      )
      .get(payload.sourceSite, payload.sourceWorkId) as
      | { id: number; image_source_url: string }
      | undefined;

    if (existing) {
      const imageSourceChanged =
        Boolean(payload.imageSourceUrl) && existing.image_source_url !== payload.imageSourceUrl;
      this.refreshWorkMetadata(existing.id, payload);
      return {
        status: 'already_collected',
        workId: existing.id,
        imageSourceChanged
      };
    }

    const result = this.db
      .prepare(
        `
          INSERT INTO works (
            source_site,
            source_work_id,
            source_url,
            author_name,
            published_at,
            prompt_raw,
            model_label,
            aspect_ratio,
            image_source_url,
            ingest_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        `
      )
      .run(
        payload.sourceSite,
        payload.sourceWorkId,
        payload.sourceUrl,
        payload.authorName ?? '',
        payload.publishedAt ?? '',
        payload.promptRaw,
        payload.modelLabel ?? '',
        payload.aspectRatio ?? '',
        payload.imageSourceUrl
      );

    return {
      status: 'accepted',
      workId: Number(result.lastInsertRowid),
      imageSourceChanged: false
    };
  }

  refreshWorkMetadata(workId: number, payload: CollectWorkPayload) {
    this.db
      .prepare(
        `
          UPDATE works
          SET source_url = CASE
                WHEN ? <> '' THEN ?
                ELSE source_url
              END,
              author_name = CASE
                WHEN ? <> '' THEN ?
                ELSE author_name
              END,
              published_at = CASE
                WHEN ? <> '' THEN ?
                ELSE published_at
              END,
              prompt_raw = CASE
                WHEN ? <> '' THEN ?
                ELSE prompt_raw
              END,
              model_label = CASE
                WHEN ? <> '' THEN ?
                ELSE model_label
              END,
              aspect_ratio = CASE
                WHEN ? <> '' THEN ?
                ELSE aspect_ratio
              END,
              image_source_url = CASE
                WHEN ? <> '' THEN ?
                ELSE image_source_url
              END
          WHERE id = ?
        `
      )
      .run(
        payload.sourceUrl ?? '',
        payload.sourceUrl ?? '',
        payload.authorName ?? '',
        payload.authorName ?? '',
        payload.publishedAt ?? '',
        payload.publishedAt ?? '',
        payload.promptRaw ?? '',
        payload.promptRaw ?? '',
        payload.modelLabel ?? '',
        payload.modelLabel ?? '',
        payload.aspectRatio ?? '',
        payload.aspectRatio ?? '',
        payload.imageSourceUrl ?? '',
        payload.imageSourceUrl ?? '',
        workId
      );
  }

  updateCachedImage(workId: number, cachedImage: CachedImageResult) {
    this.db
      .prepare(
        `
          UPDATE works
          SET image_local_path = ?,
              image_sha256 = ?,
              width = ?,
              height = ?
          WHERE id = ?
        `
      )
      .run(
        cachedImage.localPath,
        cachedImage.sha256,
        cachedImage.width,
        cachedImage.height,
        workId
      );
  }

  markIngestStage(workId: number, ingestStatus: string) {
    this.db
      .prepare(
        `
          UPDATE works
          SET ingest_status = ?,
              ingest_error = ''
          WHERE id = ?
        `
      )
      .run(ingestStatus, workId);
  }

  markIngestDone(workId: number) {
    this.db
      .prepare(
        `
          UPDATE works
          SET ingest_status = 'done',
              ingest_error = ''
          WHERE id = ?
        `
      )
      .run(workId);
  }

  markIngestFailed(workId: number, ingestError: string) {
    this.db
      .prepare(
        `
          UPDATE works
          SET ingest_status = 'failed',
              ingest_error = ?
          WHERE id = ?
        `
      )
      .run(ingestError, workId);
  }

  getWorkIngestSnapshot(workId: number): WorkIngestSnapshot | undefined {
    return this.db
      .prepare(
        `
          SELECT
            works.id AS id,
            works.image_source_url AS imageSourceUrl,
            works.image_local_path AS imageLocalPath,
            works.image_sha256 AS imageSha256,
            works.ingest_status AS ingestStatus,
            works.upload_status AS uploadStatus,
            works.cos_url AS cosUrl,
            works.model_label AS modelLabel,
            works.aspect_ratio AS aspectRatio,
            COUNT(DISTINCT work_styles.id) AS styleCount,
            COUNT(DISTINCT analysis_runs.id) AS analysisRunCount
          FROM works
          LEFT JOIN work_styles ON work_styles.work_id = works.id
          LEFT JOIN analysis_runs ON analysis_runs.work_id = works.id
          WHERE works.id = ?
          GROUP BY
            works.id,
            works.image_source_url,
            works.image_local_path,
            works.image_sha256,
            works.ingest_status,
            works.upload_status,
            works.model_label,
            works.aspect_ratio,
            works.cos_url
        `
      )
      .get(workId) as WorkIngestSnapshot | undefined;
  }

  markUploadStarted(workId: number) {
    this.db
      .prepare(
        `
          UPDATE works
          SET upload_status = 'uploading',
              upload_error = ''
          WHERE id = ?
        `
      )
      .run(workId);
  }

  markUploadSucceeded(
    workId: number,
    upload: {
      key: string;
      url: string;
      etag: string;
    }
  ) {
    this.db
      .prepare(
        `
          UPDATE works
          SET cos_key = ?,
              cos_url = ?,
              cos_etag = ?,
              upload_status = 'uploaded',
              upload_error = '',
              uploaded_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `
      )
      .run(upload.key, upload.url, upload.etag, workId);
  }

  markUploadFailed(workId: number, uploadError: string) {
    this.db
      .prepare(
        `
          UPDATE works
          SET upload_status = 'failed',
              upload_error = ?
          WHERE id = ?
        `
      )
      .run(uploadError, workId);
  }

  findStyleByAliasNorm(aliasNorm: string): StyleRecord | undefined {
    return this.db
      .prepare(
        `
          SELECT styles.id, styles.name, styles.term_type as termType
          FROM style_aliases
          INNER JOIN styles ON styles.id = style_aliases.style_id
          WHERE style_aliases.alias_norm = ?
          LIMIT 1
        `
      )
      .get(aliasNorm) as StyleRecord | undefined;
  }

  findStyleByName(name: string): StyleRecord | undefined {
    return this.db
      .prepare(
        `
          SELECT id, name, term_type as termType
          FROM styles
          WHERE name = ?
          LIMIT 1
        `
      )
      .get(name) as StyleRecord | undefined;
  }

  createStyle(input: {
    name: string;
    termType: StyleTermType;
    shortDescription: string;
  }): StyleRecord {
    const result = this.db
      .prepare(
        `
          INSERT INTO styles (
            slug,
            name,
            term_type,
            status,
            short_description
          ) VALUES (?, ?, ?, 'active', ?)
        `
      )
      .run(createStyleSlug(input.name), input.name, input.termType, input.shortDescription);

    return {
      id: Number(result.lastInsertRowid),
      name: input.name,
      termType: input.termType
    };
  }

  promoteStyleDisplayName(input: {
    styleId: number;
    name: string;
    termType: StyleTermType;
    shortDescription: string;
  }): StyleRecord {
    const slug = createStyleSlug(input.name);
    const slugOwner = this.db
      .prepare(
        `
          SELECT id
          FROM styles
          WHERE slug = ?
          LIMIT 1
        `
      )
      .get(slug) as { id: number } | undefined;

    if (slugOwner && slugOwner.id !== input.styleId) {
      return this.db
        .prepare(
          `
            SELECT id, name, term_type as termType
            FROM styles
            WHERE id = ?
            LIMIT 1
          `
        )
        .get(input.styleId) as StyleRecord;
    }

    this.db
      .prepare(
        `
          UPDATE styles
          SET slug = ?,
              name = ?,
              term_type = ?,
              short_description = CASE
                WHEN short_description = '' THEN ?
                ELSE short_description
              END,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `
      )
      .run(slug, input.name, input.termType, input.shortDescription, input.styleId);

    return {
      id: input.styleId,
      name: input.name,
      termType: input.termType
    };
  }

  ensureStyleAlias(input: {
    styleId: number;
    aliasName: string;
    aliasNorm: string;
    source: string;
    confidence: number;
  }) {
    const existing = this.db
      .prepare(
        `
          SELECT id
          FROM style_aliases
          WHERE style_id = ? AND alias_norm = ?
          LIMIT 1
        `
      )
      .get(input.styleId, input.aliasNorm) as { id: number } | undefined;

    if (existing) {
      return;
    }

    this.db
      .prepare(
        `
          INSERT INTO style_aliases (
            style_id,
            alias_name,
            alias_norm,
            source,
            confidence
          ) VALUES (?, ?, ?, ?, ?)
        `
      )
      .run(input.styleId, input.aliasName, input.aliasNorm, input.source, input.confidence);
  }

  linkWorkStyle(input: {
    workId: number;
    styleId: number;
    evidenceText: string;
    confidence: number;
    isPrimary: boolean;
    source: string;
  }) {
    const existing = this.db
      .prepare(
        `
          SELECT id
          FROM work_styles
          WHERE work_id = ? AND style_id = ?
          LIMIT 1
        `
      )
      .get(input.workId, input.styleId) as { id: number } | undefined;

    if (existing) {
      return;
    }

    this.db
      .prepare(
        `
          INSERT INTO work_styles (
            work_id,
            style_id,
            evidence_text,
            confidence,
            is_primary,
            source
          ) VALUES (?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        input.workId,
        input.styleId,
        input.evidenceText,
        input.confidence,
        input.isPrimary ? 1 : 0,
        input.source
      );
  }

  clearWorkStyles(workId: number) {
    this.db.prepare('DELETE FROM work_styles WHERE work_id = ?').run(workId);
  }

  recordAnalysisRun(input: {
    workId: number;
    provider: string;
    model: string;
    promptVersion: string;
    rawResponse: string;
    parsedResult: StyleAnalysisResult;
    status: string;
    errorMessage?: string;
  }) {
    this.db
      .prepare(
        `
          INSERT INTO analysis_runs (
            work_id,
            provider,
            model,
            prompt_version,
            raw_response,
            parsed_result_json,
            status,
            error_message
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        input.workId,
        input.provider,
        input.model,
        input.promptVersion,
        input.rawResponse,
        JSON.stringify(input.parsedResult),
        input.status,
        input.errorMessage ?? ''
      );
  }

  deleteWorkBySourceWorkId(sourceWorkId: string): DeleteWorkResult | undefined {
    const work = this.db
      .prepare(
        `
          SELECT id, source_work_id
          FROM works
          WHERE source_work_id = ?
          LIMIT 1
        `
      )
      .get(sourceWorkId) as { id: number; source_work_id: string } | undefined;

    if (!work) {
      return undefined;
    }

    const tx = this.db.transaction(() => {
      const styleIds = this.db
        .prepare(
          `
            SELECT DISTINCT style_id
            FROM work_styles
            WHERE work_id = ?
          `
        )
        .all(work.id) as Array<{ style_id: number }>;

      this.db.prepare('UPDATE styles SET hero_work_id = NULL WHERE hero_work_id = ?').run(work.id);
      this.db.prepare('DELETE FROM anki_reviews WHERE work_id = ?').run(work.id);
      this.db.prepare('DELETE FROM work_styles WHERE work_id = ?').run(work.id);
      this.db.prepare('DELETE FROM analysis_runs WHERE work_id = ?').run(work.id);
      this.db.prepare('DELETE FROM works WHERE id = ?').run(work.id);

      for (const styleId of styleIds.map((row) => row.style_id)) {
        const remainingLinks = this.db
          .prepare(
            `
              SELECT COUNT(*) AS count
              FROM work_styles
              WHERE style_id = ?
            `
          )
          .get(styleId) as { count: number };

        const styleStillUsedAsHero = this.db
          .prepare(
            `
              SELECT COUNT(*) AS count
              FROM styles
              WHERE id = ? AND hero_work_id IS NOT NULL
            `
          )
          .get(styleId) as { count: number };

        if (remainingLinks.count === 0 && styleStillUsedAsHero.count === 0) {
          this.db.prepare('DELETE FROM style_aliases WHERE style_id = ?').run(styleId);
          this.db.prepare('DELETE FROM styles WHERE id = ?').run(styleId);
        }
      }
    });

    tx();

    return {
      workId: work.id,
      sourceWorkId: work.source_work_id
    };
  }
}
