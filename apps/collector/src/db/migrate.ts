import fs from 'node:fs';
import path from 'node:path';

import type Database from 'better-sqlite3';

export function runMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      executed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const migrationsDir = path.join(import.meta.dirname, 'migrations');
  const filenames = fs
    .readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith('.sql'))
    .sort((left, right) => left.localeCompare(right));

  for (const filename of filenames) {
    const alreadyExecuted = db
      .prepare('SELECT filename FROM schema_migrations WHERE filename = ? LIMIT 1')
      .get(filename) as { filename: string } | undefined;

    if (alreadyExecuted) {
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, filename), 'utf8');
    const transaction = db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (filename) VALUES (?)').run(filename);
    });

    transaction();
  }
}
