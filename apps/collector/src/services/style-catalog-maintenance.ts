import type Database from 'better-sqlite3';

import { canonicalStyleRules, createStyleSlug, normalizeStyleTerm } from './style-normalizer';

interface StyleRow {
  id: number;
  name: string;
  term_type: string;
  short_description: string;
  hero_work_id: number | null;
}

export function normalizeStyleCatalog(db: Database.Database) {
  const ensureAlias = db.transaction(
    (styleId: number, aliasName: string, source: string, confidence: number) => {
      const aliasNorm = normalizeStyleTerm(aliasName);
      const existing = db
        .prepare(
          `
            SELECT id
            FROM style_aliases
            WHERE style_id = ? AND alias_norm = ?
            LIMIT 1
          `
        )
        .get(styleId, aliasNorm) as { id: number } | undefined;

      if (existing || !aliasNorm) {
        return;
      }

      db.prepare(
        `
          INSERT INTO style_aliases (style_id, alias_name, alias_norm, source, confidence)
          VALUES (?, ?, ?, ?, ?)
        `
      ).run(styleId, aliasName, aliasNorm, source, confidence);
    }
  );

  const consolidate = db.transaction(() => {
    const allStyles = db
      .prepare(
        `
          SELECT id, name, term_type, short_description, hero_work_id
          FROM styles
          ORDER BY id ASC
        `
      )
      .all() as StyleRow[];

    for (const rule of canonicalStyleRules) {
      const matchedStyles = allStyles.filter((style) =>
        rule.aliases.some((alias) => normalizeStyleTerm(alias) === normalizeStyleTerm(style.name))
      );

      if (matchedStyles.length === 0) {
        continue;
      }

      const canonicalStyle =
        matchedStyles.find(
          (style) => normalizeStyleTerm(style.name) === normalizeStyleTerm(rule.canonicalName)
        ) ?? matchedStyles[0];

      db.prepare(
        `
          UPDATE styles
          SET slug = ?,
              name = ?,
              term_type = ?,
              short_description = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `
      ).run(
        createStyleSlug(rule.canonicalName),
        rule.canonicalName,
        rule.termType,
        canonicalStyle.short_description.trim() ? canonicalStyle.short_description : rule.shortDescription,
        canonicalStyle.id
      );

      for (const alias of new Set([rule.canonicalName, ...rule.aliases, ...matchedStyles.map((style) => style.name)])) {
        ensureAlias(canonicalStyle.id, alias, 'rule', 1);
      }

      for (const duplicate of matchedStyles.filter((style) => style.id !== canonicalStyle.id)) {
        const workStyleRows = db
          .prepare(
            `
              SELECT work_id, evidence_text, confidence, is_primary, source
              FROM work_styles
              WHERE style_id = ?
            `
          )
          .all(duplicate.id) as Array<{
          work_id: number;
          evidence_text: string;
          confidence: number;
          is_primary: number;
          source: string;
        }>;

        for (const row of workStyleRows) {
          const existing = db
            .prepare(
              `
                SELECT id
                FROM work_styles
                WHERE work_id = ? AND style_id = ?
                LIMIT 1
              `
            )
            .get(row.work_id, canonicalStyle.id) as { id: number } | undefined;

          if (!existing) {
            db.prepare(
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
            ).run(
              row.work_id,
              canonicalStyle.id,
              row.evidence_text,
              row.confidence,
              row.is_primary,
              row.source
            );
          }
        }

        const aliasRows = db
          .prepare(
            `
              SELECT alias_name, source, confidence
              FROM style_aliases
              WHERE style_id = ?
            `
          )
          .all(duplicate.id) as Array<{
          alias_name: string;
          source: string;
          confidence: number;
        }>;

        for (const row of aliasRows) {
          ensureAlias(canonicalStyle.id, row.alias_name, row.source, row.confidence);
        }

        if (!canonicalStyle.hero_work_id && duplicate.hero_work_id) {
          db.prepare('UPDATE styles SET hero_work_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
            duplicate.hero_work_id,
            canonicalStyle.id
          );
        }

        db.prepare('DELETE FROM work_styles WHERE style_id = ?').run(duplicate.id);
        db.prepare('DELETE FROM style_aliases WHERE style_id = ?').run(duplicate.id);
        db.prepare('DELETE FROM styles WHERE id = ?').run(duplicate.id);
      }
    }
  });

  consolidate();
}
