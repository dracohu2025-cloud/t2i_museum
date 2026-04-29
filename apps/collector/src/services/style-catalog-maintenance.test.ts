import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

import { openDatabase } from '../db/client';
import { runMigrations } from '../db/migrate';
import { normalizeStyleCatalog } from './style-catalog-maintenance';

describe('normalizeStyleCatalog', () => {
  it('merges known aliases into one canonical style record', () => {
    const dataDir = './tmp/style-catalog-maintenance';
    fs.rmSync(dataDir, { recursive: true, force: true });

    const db = openDatabase(dataDir);
    runMigrations(db);

    db.prepare(
      `
        INSERT INTO works (
          source_site,
          source_work_id,
          source_url,
          prompt_raw,
          image_source_url,
          image_local_path,
          ingest_status
        ) VALUES ('jimeng', 'w1', 'https://example.com/w1', 'Moebius风格', 'https://example.com/a.webp', 'data/cache/originals/jimeng/w1.webp', 'done')
      `
    ).run();

    db.prepare(
      `
        INSERT INTO styles (slug, name, term_type, status, short_description)
        VALUES ('moebius', 'Moebius', 'artist_style', 'active', '')
      `
    ).run();
    db.prepare(
      `
        INSERT INTO styles (slug, name, term_type, status, short_description)
        VALUES ('moebius-jean-giraud', 'Moebius (Jean Giraud)', 'artist_style', 'active', '')
      `
    ).run();
    db.prepare(
      `
        INSERT INTO work_styles (work_id, style_id, evidence_text, confidence, is_primary, source)
        VALUES (1, 1, 'Moebius风格', 1, 1, 'llm')
      `
    ).run();

    normalizeStyleCatalog(db);

    const styles = db.prepare('SELECT name FROM styles ORDER BY id').all() as Array<{ name: string }>;
    const workStyles = db.prepare('SELECT COUNT(*) AS count FROM work_styles').get() as { count: number };

    expect(styles).toEqual([{ name: 'Moebius风格' }]);
    expect(workStyles.count).toBe(1);

    db.close();
  });

  it('preserves a known alias display name when prompt evidence uses a direct 风格 suffix', () => {
    const dataDir = './tmp/style-catalog-maintenance-style-suffix';
    fs.rmSync(dataDir, { recursive: true, force: true });

    const db = openDatabase(dataDir);
    runMigrations(db);

    db.prepare(
      `
        INSERT INTO works (
          source_site,
          source_work_id,
          source_url,
          prompt_raw,
          image_source_url,
          image_local_path,
          ingest_status
        ) VALUES ('jimeng', 'w1', 'https://example.com/w1', '动漫水彩风格，浅色背景', 'https://example.com/a.webp', 'data/cache/originals/jimeng/w1.webp', 'done')
      `
    ).run();

    db.prepare(
      `
        INSERT INTO styles (slug, name, term_type, status, short_description)
        VALUES ('动漫水彩', '动漫水彩', 'medium_rendering', 'active', '')
      `
    ).run();
    db.prepare(
      `
        INSERT INTO work_styles (work_id, style_id, evidence_text, confidence, is_primary, source)
        VALUES (1, 1, '动漫水彩风格', 1, 1, 'llm')
      `
    ).run();

    normalizeStyleCatalog(db);

    const styles = db.prepare('SELECT name, slug FROM styles ORDER BY id').all() as Array<{
      name: string;
      slug: string;
    }>;

    expect(styles).toEqual([
      {
        name: '动漫水彩风格',
        slug: '动漫水彩风格'
      }
    ]);

    db.close();
  });

  it('preserves a known alias display name when prompt evidence uses a direct 主义 suffix', () => {
    const dataDir = './tmp/style-catalog-maintenance-ism-suffix';
    fs.rmSync(dataDir, { recursive: true, force: true });

    const db = openDatabase(dataDir);
    runMigrations(db);

    db.prepare(
      `
        INSERT INTO works (
          source_site,
          source_work_id,
          source_url,
          prompt_raw,
          image_source_url,
          image_local_path,
          ingest_status
        ) VALUES ('jimeng', 'w1', 'https://example.com/w1', '极简主义构图，留白。', 'https://example.com/a.webp', 'data/cache/originals/jimeng/w1.webp', 'done')
      `
    ).run();

    db.prepare(
      `
        INSERT INTO styles (slug, name, term_type, status, short_description)
        VALUES ('极简', '极简', 'aesthetic_style', 'active', '')
      `
    ).run();
    db.prepare(
      `
        INSERT INTO work_styles (work_id, style_id, evidence_text, confidence, is_primary, source)
        VALUES (1, 1, '极简主义', 1, 1, 'llm')
      `
    ).run();

    normalizeStyleCatalog(db);

    const styles = db.prepare('SELECT name, slug FROM styles ORDER BY id').all() as Array<{
      name: string;
      slug: string;
    }>;

    expect(styles).toEqual([
      {
        name: '极简主义',
        slug: '极简主义'
      }
    ]);

    db.close();
  });
});
