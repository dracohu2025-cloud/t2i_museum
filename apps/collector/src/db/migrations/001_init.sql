CREATE TABLE IF NOT EXISTS works (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_site TEXT NOT NULL,
  source_work_id TEXT NOT NULL,
  source_url TEXT NOT NULL,
  author_name TEXT NOT NULL DEFAULT '',
  published_at TEXT NOT NULL DEFAULT '',
  prompt_raw TEXT NOT NULL,
  model_label TEXT NOT NULL DEFAULT '',
  aspect_ratio TEXT NOT NULL DEFAULT '',
  image_source_url TEXT NOT NULL,
  image_local_path TEXT NOT NULL DEFAULT '',
  image_sha256 TEXT NOT NULL DEFAULT '',
  width INTEGER,
  height INTEGER,
  ingest_status TEXT NOT NULL DEFAULT 'pending',
  ingest_error TEXT NOT NULL DEFAULT '',
  collected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_site, source_work_id)
);

CREATE TABLE IF NOT EXISTS styles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  term_type TEXT NOT NULL DEFAULT 'aesthetic_style',
  status TEXT NOT NULL DEFAULT 'candidate',
  short_description TEXT NOT NULL DEFAULT '',
  visual_traits TEXT NOT NULL DEFAULT '',
  prompt_hints TEXT NOT NULL DEFAULT '',
  hero_work_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS style_aliases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  style_id INTEGER NOT NULL,
  alias_name TEXT NOT NULL,
  alias_norm TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'rule',
  confidence REAL NOT NULL DEFAULT 1,
  FOREIGN KEY(style_id) REFERENCES styles(id)
);

CREATE TABLE IF NOT EXISTS work_styles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  style_id INTEGER NOT NULL,
  evidence_text TEXT NOT NULL DEFAULT '',
  confidence REAL NOT NULL DEFAULT 1,
  is_primary INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'llm',
  FOREIGN KEY(work_id) REFERENCES works(id),
  FOREIGN KEY(style_id) REFERENCES styles(id)
);

CREATE TABLE IF NOT EXISTS analysis_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  provider TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  prompt_version TEXT NOT NULL DEFAULT '',
  raw_response TEXT NOT NULL DEFAULT '',
  parsed_result_json TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(work_id) REFERENCES works(id)
);
