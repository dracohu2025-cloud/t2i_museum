CREATE TABLE IF NOT EXISTS anki_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  style_id INTEGER NOT NULL,
  review_count INTEGER NOT NULL DEFAULT 0,
  lapses INTEGER NOT NULL DEFAULT 0,
  correct_streak INTEGER NOT NULL DEFAULT 0,
  ease_factor REAL NOT NULL DEFAULT 2.5,
  interval_days INTEGER NOT NULL DEFAULT 0,
  due_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_reviewed_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(work_id, style_id),
  FOREIGN KEY(work_id) REFERENCES works(id),
  FOREIGN KEY(style_id) REFERENCES styles(id)
);

CREATE INDEX IF NOT EXISTS idx_anki_reviews_due_at ON anki_reviews(due_at);
CREATE INDEX IF NOT EXISTS idx_anki_reviews_work_style ON anki_reviews(work_id, style_id);
