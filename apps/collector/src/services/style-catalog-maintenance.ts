import type Database from 'better-sqlite3';

import {
  canonicalStyleRules,
  cleanStyleDisplayName,
  createStyleSlug,
  normalizeStyleTerm
} from './style-normalizer';

interface StyleRow {
  id: number;
  name: string;
  term_type: string;
  short_description: string;
  hero_work_id: number | null;
}

function findDirectStyleSuffixName(db: Database.Database, matchedStyles: StyleRow[]): string {
  const existingName = matchedStyles
    .map((style) => cleanStyleDisplayName(style.name))
    .find(
      (name) =>
        (name.length > '风格'.length && name.endsWith('风格')) ||
        (name.length > '主义'.length && name.endsWith('主义'))
    );
  if (existingName) {
    return existingName;
  }

  for (const style of matchedStyles) {
    const rows = db
      .prepare(
        `
          SELECT work_styles.evidence_text AS evidenceText,
                 works.prompt_raw AS promptRaw
          FROM work_styles
          LEFT JOIN works ON works.id = work_styles.work_id
          WHERE work_styles.style_id = ?
        `
      )
      .all(style.id) as Array<{
      evidenceText: string;
      promptRaw: string;
    }>;

    for (const row of rows) {
      const evidence = cleanStyleDisplayName(row.evidenceText);
      if (
        (evidence.length > '风格'.length && evidence.endsWith('风格')) ||
        (evidence.length > '主义'.length && evidence.endsWith('主义'))
      ) {
        return evidence;
      }

      const baseName = cleanStyleDisplayName(style.name);
      if (baseName && !baseName.endsWith('风格') && row.promptRaw.includes(`${baseName}风格`)) {
        return `${baseName}风格`;
      }
      if (baseName && !baseName.endsWith('主义') && row.promptRaw.includes(`${baseName}主义`)) {
        return `${baseName}主义`;
      }
    }
  }

  return '';
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

      const displayName = findDirectStyleSuffixName(db, matchedStyles) || rule.canonicalName;

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
        createStyleSlug(displayName),
        displayName,
        rule.termType,
        canonicalStyle.short_description.trim() ? canonicalStyle.short_description : rule.shortDescription,
        canonicalStyle.id
      );

      for (const alias of new Set([displayName, rule.canonicalName, ...rule.aliases, ...matchedStyles.map((style) => style.name)])) {
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

    const currentStyles = db
      .prepare(
        `
          SELECT id, name, term_type, short_description, hero_work_id
          FROM styles
          ORDER BY id ASC
        `
      )
      .all() as StyleRow[];

    for (const style of currentStyles) {
      if (/(?:风格|主义)$/u.test(cleanStyleDisplayName(style.name))) {
        continue;
      }

      const displayName = findDirectStyleSuffixName(db, [style]);
      if (!displayName || normalizeStyleTerm(displayName) !== normalizeStyleTerm(style.name)) {
        continue;
      }

      const nextSlug = createStyleSlug(displayName);
      const owner = db
        .prepare(
          `
            SELECT id
            FROM styles
            WHERE slug = ?
            LIMIT 1
          `
        )
        .get(nextSlug) as { id: number } | undefined;

      if (owner && owner.id !== style.id) {
        continue;
      }

      db.prepare(
        `
          UPDATE styles
          SET slug = ?,
              name = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `
      ).run(nextSlug, displayName, style.id);

      ensureAlias(style.id, style.name, 'maintenance', 1);
      ensureAlias(style.id, displayName, 'maintenance', 1);
    }
  });

  consolidate();
}
