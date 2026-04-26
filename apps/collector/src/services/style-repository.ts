import type Database from 'better-sqlite3';

import { cleanStyleDisplayName, createStyleSlug, normalizeStyleTerm } from './style-normalizer';

export interface EditableStyleRecord {
  id: number;
  slug: string;
  name: string;
  termType: string;
  status: string;
  shortDescription: string;
  visualTraits: string;
  promptHints: string;
  heroWorkId: number | null;
}

export interface StyleAliasRecord {
  name: string;
  source: string;
  confidence: number;
}

export class StyleConflictError extends Error {
  constructor(
    message: string,
    readonly code: 'slug_conflict' | 'alias_conflict' | 'hero_work_invalid'
  ) {
    super(message);
    this.name = 'StyleConflictError';
  }
}

const editableStatuses = new Set(['active', 'candidate', 'ignored']);

export class StyleRepository {
  constructor(private readonly db: Database.Database) {}

  getStyleBySlug(slug: string): EditableStyleRecord | undefined {
    return this.db
      .prepare(
        `
          SELECT
            id,
            slug,
            name,
            term_type AS termType,
            status,
            short_description AS shortDescription,
            visual_traits AS visualTraits,
            prompt_hints AS promptHints,
            hero_work_id AS heroWorkId
          FROM styles
          WHERE slug = ?
          LIMIT 1
        `
      )
      .get(slug) as EditableStyleRecord | undefined;
  }

  listAliases(styleId: number): StyleAliasRecord[] {
    return this.db
      .prepare(
        `
          SELECT
            alias_name AS name,
            source,
            confidence
          FROM style_aliases
          WHERE style_id = ?
          ORDER BY confidence DESC, alias_name ASC
        `
      )
      .all(styleId) as StyleAliasRecord[];
  }

  updateStyle(
    styleId: number,
    input: {
      name?: string;
      shortDescription?: string;
      visualTraits?: string;
      promptHints?: string;
      status?: string;
      heroWorkId?: number | null;
    }
  ) {
    const current = this.getStyleById(styleId);
    if (!current) {
      throw new Error('style_not_found');
    }

    const nextName =
      input.name === undefined ? current.name : cleanStyleDisplayName(input.name.trim());
    const nextSlug = nextName === current.name ? current.slug : createStyleSlug(nextName);
    const nextStatus =
      input.status === undefined ? current.status : input.status.trim().toLowerCase();

    if (!nextName) {
      throw new StyleConflictError('style_name_invalid', 'slug_conflict');
    }

    if (!editableStatuses.has(nextStatus)) {
      throw new Error('style_status_invalid');
    }

    const slugOwner = this.getStyleBySlug(nextSlug);
    if (slugOwner && slugOwner.id !== styleId) {
      throw new StyleConflictError('style_slug_conflict', 'slug_conflict');
    }

    if (input.heroWorkId !== undefined && input.heroWorkId !== null) {
      this.ensureHeroWorkBelongsToStyle(styleId, input.heroWorkId);
    }

    this.db
      .prepare(
        `
          UPDATE styles
          SET slug = ?,
              name = ?,
              status = ?,
              short_description = ?,
              visual_traits = ?,
              prompt_hints = ?,
              hero_work_id = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `
      )
      .run(
        nextSlug,
        nextName,
        nextStatus,
        input.shortDescription === undefined ? current.shortDescription : input.shortDescription.trim(),
        input.visualTraits === undefined ? current.visualTraits : input.visualTraits.trim(),
        input.promptHints === undefined ? current.promptHints : input.promptHints.trim(),
        input.heroWorkId === undefined ? current.heroWorkId : input.heroWorkId,
        styleId
      );

    if (nextName !== current.name) {
      this.ensureAlias(styleId, current.name, 'manual', 1);
      this.ensureAlias(styleId, nextName, 'manual', 1);
    }

    return this.getStyleById(styleId);
  }

  addAlias(styleId: number, aliasName: string) {
    const style = this.getStyleById(styleId);
    if (!style) {
      throw new Error('style_not_found');
    }

    const trimmedAlias = aliasName.trim();
    const aliasNorm = normalizeStyleTerm(trimmedAlias);
    if (!aliasNorm) {
      throw new Error('style_alias_invalid');
    }

    const owner = this.findStyleByNormalizedTerm(aliasNorm);
    if (owner && owner.id !== styleId) {
      throw new StyleConflictError('style_alias_conflict', 'alias_conflict');
    }

    this.ensureAlias(styleId, trimmedAlias, 'manual', 1);
    return this.listAliases(styleId);
  }

  mergeStyleInto(sourceStyleId: number, targetStyleId: number) {
    if (sourceStyleId === targetStyleId) {
      throw new Error('style_merge_same_target');
    }

    const source = this.getStyleById(sourceStyleId);
    const target = this.getStyleById(targetStyleId);

    if (!source || !target) {
      throw new Error('style_not_found');
    }

    const merge = this.db.transaction(() => {
      const sourceWorkStyles = this.db
        .prepare(
          `
            SELECT work_id, evidence_text, confidence, is_primary, source
            FROM work_styles
            WHERE style_id = ?
          `
        )
        .all(sourceStyleId) as Array<{
        work_id: number;
        evidence_text: string;
        confidence: number;
        is_primary: number;
        source: string;
      }>;

      for (const row of sourceWorkStyles) {
        const existing = this.db
          .prepare(
            `
              SELECT id, is_primary
              FROM work_styles
              WHERE work_id = ? AND style_id = ?
              LIMIT 1
            `
          )
          .get(row.work_id, targetStyleId) as { id: number; is_primary: number } | undefined;

        if (!existing) {
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
              row.work_id,
              targetStyleId,
              row.evidence_text,
              row.confidence,
              row.is_primary,
              row.source
            );
          continue;
        }

        if (existing.is_primary === 0 && row.is_primary === 1) {
          this.db
            .prepare(
              `
                UPDATE work_styles
                SET is_primary = 1,
                    confidence = MAX(confidence, ?)
                WHERE id = ?
              `
            )
            .run(row.confidence, existing.id);
        }
      }

      const sourceAliases = this.db
        .prepare(
          `
            SELECT alias_name, source, confidence
            FROM style_aliases
            WHERE style_id = ?
          `
        )
        .all(sourceStyleId) as Array<{
        alias_name: string;
        source: string;
        confidence: number;
      }>;

      this.ensureAlias(targetStyleId, source.name, 'manual', 1);
      for (const alias of sourceAliases) {
        this.ensureAlias(targetStyleId, alias.alias_name, alias.source, alias.confidence);
      }

      if (!target.heroWorkId && source.heroWorkId) {
        this.db
          .prepare(
            `
              UPDATE styles
              SET hero_work_id = ?,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `
          )
          .run(source.heroWorkId, targetStyleId);
      } else {
        this.db
          .prepare(
            `
              UPDATE styles
              SET updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `
          )
          .run(targetStyleId);
      }

      this.db.prepare('DELETE FROM work_styles WHERE style_id = ?').run(sourceStyleId);
      this.db.prepare('DELETE FROM style_aliases WHERE style_id = ?').run(sourceStyleId);
      this.db.prepare('DELETE FROM styles WHERE id = ?').run(sourceStyleId);
    });

    merge();
    return this.getStyleById(targetStyleId);
  }

  getStyleById(styleId: number): EditableStyleRecord | undefined {
    return this.db
      .prepare(
        `
          SELECT
            id,
            slug,
            name,
            term_type AS termType,
            status,
            short_description AS shortDescription,
            visual_traits AS visualTraits,
            prompt_hints AS promptHints,
            hero_work_id AS heroWorkId
          FROM styles
          WHERE id = ?
          LIMIT 1
        `
      )
      .get(styleId) as EditableStyleRecord | undefined;
  }

  private findStyleByNormalizedTerm(aliasNorm: string): { id: number; slug: string; name: string } | undefined {
    const aliasMatch = this.db
      .prepare(
        `
          SELECT styles.id, styles.slug, styles.name
          FROM style_aliases
          INNER JOIN styles ON styles.id = style_aliases.style_id
          WHERE style_aliases.alias_norm = ?
          LIMIT 1
        `
      )
      .get(aliasNorm) as { id: number; slug: string; name: string } | undefined;

    if (aliasMatch) {
      return aliasMatch;
    }

    const styles = this.db
      .prepare(
        `
          SELECT id, slug, name
          FROM styles
        `
      )
      .all() as Array<{ id: number; slug: string; name: string }>;

    return styles.find((style) => normalizeStyleTerm(style.name) === aliasNorm);
  }

  private ensureAlias(styleId: number, aliasName: string, source: string, confidence: number) {
    const aliasNorm = normalizeStyleTerm(aliasName);
    if (!aliasNorm) {
      return;
    }

    const existing = this.db
      .prepare(
        `
          SELECT id
          FROM style_aliases
          WHERE style_id = ? AND alias_norm = ?
          LIMIT 1
        `
      )
      .get(styleId, aliasNorm) as { id: number } | undefined;

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
      .run(styleId, aliasName, aliasNorm, source, confidence);
  }

  private ensureHeroWorkBelongsToStyle(styleId: number, workId: number) {
    const linked = this.db
      .prepare(
        `
          SELECT id
          FROM work_styles
          WHERE style_id = ? AND work_id = ?
          LIMIT 1
        `
      )
      .get(styleId, workId) as { id: number } | undefined;

    if (!linked) {
      throw new StyleConflictError('style_hero_work_invalid', 'hero_work_invalid');
    }
  }
}
