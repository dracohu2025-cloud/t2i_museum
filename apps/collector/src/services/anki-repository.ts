import type Database from 'better-sqlite3';

import { toPublicImageUrl } from './catalog-query';

export interface AnkiCard {
  cardId: string;
  workId: number;
  sourceWorkId: string;
  promptRaw: string;
  imageUrl: string;
  modelLabel: string;
  aspectRatio: string;
  answer: {
    styleId: number;
    slug: string;
    name: string;
    termType: string;
  };
  review: {
    reviewCount: number;
    lapses: number;
    correctStreak: number;
    easeFactor: number;
    intervalDays: number;
    dueAt: string;
    lastReviewedAt: string;
    isDue: boolean;
  };
}

interface ReviewRow {
  work_id: number;
  source_work_id: string;
  prompt_raw: string;
  image_local_path: string;
  cos_url: string;
  model_label: string;
  aspect_ratio: string;
  style_id: number;
  style_slug: string;
  style_name: string;
  term_type: string;
  review_count: number | null;
  lapses: number | null;
  correct_streak: number | null;
  ease_factor: number | null;
  interval_days: number | null;
  due_at: string | null;
  last_reviewed_at: string | null;
}

function toSqliteTimestamp(date: Date) {
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function mapRowToCard(row: ReviewRow, dataDir: string, now = new Date()): AnkiCard {
  const dueAt = row.due_at ?? toSqliteTimestamp(now);
  return {
    cardId: `${row.work_id}:${row.style_id}`,
    workId: row.work_id,
    sourceWorkId: row.source_work_id,
    promptRaw: row.prompt_raw,
    imageUrl: toPublicImageUrl(row.image_local_path, dataDir, row.cos_url),
    modelLabel: row.model_label,
    aspectRatio: row.aspect_ratio,
    answer: {
      styleId: row.style_id,
      slug: row.style_slug,
      name: row.style_name,
      termType: row.term_type
    },
    review: {
      reviewCount: row.review_count ?? 0,
      lapses: row.lapses ?? 0,
      correctStreak: row.correct_streak ?? 0,
      easeFactor: row.ease_factor ?? 2.5,
      intervalDays: row.interval_days ?? 0,
      dueAt,
      lastReviewedAt: row.last_reviewed_at ?? '',
      isDue: !row.due_at || Date.parse(`${dueAt.replace(' ', 'T')}Z`) <= now.getTime()
    }
  };
}

function computeNextReview(input: {
  correct: boolean;
  reviewCount: number;
  lapses: number;
  correctStreak: number;
  easeFactor: number;
  intervalDays: number;
  now: Date;
}) {
  const reviewCount = input.reviewCount + 1;
  const easeFactor = input.correct
    ? Math.min(3, input.easeFactor + 0.05)
    : Math.max(1.3, input.easeFactor - 0.2);
  const lapses = input.correct ? input.lapses : input.lapses + 1;
  const correctStreak = input.correct ? input.correctStreak + 1 : 0;
  const intervalDays = input.correct
    ? input.intervalDays <= 0
      ? 1
      : input.intervalDays === 1
        ? 3
        : Math.max(1, Math.round(input.intervalDays * easeFactor))
    : 0;
  const dueAt = input.correct ? addDays(input.now, intervalDays) : input.now;

  return {
    reviewCount,
    lapses,
    correctStreak,
    easeFactor,
    intervalDays,
    dueAt: toSqliteTimestamp(dueAt),
    lastReviewedAt: toSqliteTimestamp(input.now)
  };
}

export class AnkiRepository {
  constructor(
    private readonly db: Database.Database,
    private readonly dataDir: string
  ) {}

  listCards(now = new Date()): AnkiCard[] {
    const rows = this.db
      .prepare(
        `
          SELECT
            works.id AS work_id,
            works.source_work_id AS source_work_id,
            works.prompt_raw AS prompt_raw,
            works.image_local_path AS image_local_path,
            works.cos_url AS cos_url,
            works.model_label AS model_label,
            works.aspect_ratio AS aspect_ratio,
            styles.id AS style_id,
            styles.slug AS style_slug,
            styles.name AS style_name,
            styles.term_type AS term_type,
            anki_reviews.review_count AS review_count,
            anki_reviews.lapses AS lapses,
            anki_reviews.correct_streak AS correct_streak,
            anki_reviews.ease_factor AS ease_factor,
            anki_reviews.interval_days AS interval_days,
            anki_reviews.due_at AS due_at,
            anki_reviews.last_reviewed_at AS last_reviewed_at
          FROM work_styles
          INNER JOIN works ON works.id = work_styles.work_id
          INNER JOIN styles ON styles.id = work_styles.style_id
          LEFT JOIN anki_reviews
            ON anki_reviews.work_id = works.id
           AND anki_reviews.style_id = styles.id
          WHERE works.ingest_status = 'done'
            AND works.image_local_path <> ''
            AND styles.status <> 'ignored'
          ORDER BY
            CASE
              WHEN anki_reviews.due_at IS NULL THEN 0
              WHEN anki_reviews.due_at <= CURRENT_TIMESTAMP THEN 0
              ELSE 1
            END ASC,
            COALESCE(anki_reviews.lapses, 0) DESC,
            COALESCE(anki_reviews.review_count, 0) ASC,
            works.id DESC
        `
      )
      .all() as ReviewRow[];

    return rows.map((row) => mapRowToCard(row, this.dataDir, now));
  }

  recordReview(input: {
    workId: number;
    styleSlug: string;
    correct: boolean;
    now?: Date;
  }): AnkiCard | null {
    const now = input.now ?? new Date();
    const row = this.db
      .prepare(
        `
          SELECT
            works.id AS work_id,
            works.source_work_id AS source_work_id,
            works.prompt_raw AS prompt_raw,
            works.image_local_path AS image_local_path,
            works.cos_url AS cos_url,
            works.model_label AS model_label,
            works.aspect_ratio AS aspect_ratio,
            styles.id AS style_id,
            styles.slug AS style_slug,
            styles.name AS style_name,
            styles.term_type AS term_type,
            anki_reviews.review_count AS review_count,
            anki_reviews.lapses AS lapses,
            anki_reviews.correct_streak AS correct_streak,
            anki_reviews.ease_factor AS ease_factor,
            anki_reviews.interval_days AS interval_days,
            anki_reviews.due_at AS due_at,
            anki_reviews.last_reviewed_at AS last_reviewed_at
          FROM work_styles
          INNER JOIN works ON works.id = work_styles.work_id
          INNER JOIN styles ON styles.id = work_styles.style_id
          LEFT JOIN anki_reviews
            ON anki_reviews.work_id = works.id
           AND anki_reviews.style_id = styles.id
          WHERE works.id = ?
            AND styles.slug = ?
            AND styles.status <> 'ignored'
          LIMIT 1
        `
      )
      .get(input.workId, input.styleSlug) as ReviewRow | undefined;

    if (!row) {
      return null;
    }

    const next = computeNextReview({
      correct: input.correct,
      reviewCount: row.review_count ?? 0,
      lapses: row.lapses ?? 0,
      correctStreak: row.correct_streak ?? 0,
      easeFactor: row.ease_factor ?? 2.5,
      intervalDays: row.interval_days ?? 0,
      now
    });

    this.db
      .prepare(
        `
          INSERT INTO anki_reviews (
            work_id,
            style_id,
            review_count,
            lapses,
            correct_streak,
            ease_factor,
            interval_days,
            due_at,
            last_reviewed_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(work_id, style_id) DO UPDATE SET
            review_count = excluded.review_count,
            lapses = excluded.lapses,
            correct_streak = excluded.correct_streak,
            ease_factor = excluded.ease_factor,
            interval_days = excluded.interval_days,
            due_at = excluded.due_at,
            last_reviewed_at = excluded.last_reviewed_at,
            updated_at = CURRENT_TIMESTAMP
        `
      )
      .run(
        row.work_id,
        row.style_id,
        next.reviewCount,
        next.lapses,
        next.correctStreak,
        next.easeFactor,
        next.intervalDays,
        next.dueAt,
        next.lastReviewedAt
      );

    return mapRowToCard(
      {
        ...row,
        review_count: next.reviewCount,
        lapses: next.lapses,
        correct_streak: next.correctStreak,
        ease_factor: next.easeFactor,
        interval_days: next.intervalDays,
        due_at: next.dueAt,
        last_reviewed_at: next.lastReviewedAt
      },
      this.dataDir,
      now
    );
  }
}
