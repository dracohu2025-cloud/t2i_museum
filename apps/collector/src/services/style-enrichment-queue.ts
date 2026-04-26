import type Database from 'better-sqlite3';

import { StyleRepository, type EditableStyleRecord } from './style-repository';
import type { StyleEnricher } from './style-enricher';

interface StyleEvidencePromptRow {
  prompt_raw: string;
}

const lowValueDescriptionPatterns = [
  /^(Refers to|Explicitly names|Explicit aesthetic|Describes |High-value )/i,
  /^Prompt 中显式点名的视觉风格词。?$/u,
  /^prompt 中显式出现的风格词。?$/iu,
  /^用户确认的风格关键词。?$/u,
  /^用户在 museum 中二次编辑的风格关键词。?$/u,
  /核心定义仍待补充/u,
  /待补充/u
];

function isLowValueDescription(text: string): boolean {
  const value = text.trim();
  return value.length < 18 || lowValueDescriptionPatterns.some((pattern) => pattern.test(value));
}

export function needsStyleEnrichment(style: Pick<EditableStyleRecord, 'shortDescription' | 'visualTraits' | 'promptHints'>): boolean {
  return (
    isLowValueDescription(style.shortDescription) ||
    style.visualTraits.trim().length === 0 ||
    style.promptHints.trim().length === 0
  );
}

function collectEvidencePrompts(db: Database.Database, styleId: number): string[] {
  const rows = db
    .prepare(
      `
        SELECT DISTINCT works.prompt_raw
        FROM work_styles
        INNER JOIN works ON works.id = work_styles.work_id
        WHERE work_styles.style_id = ?
          AND works.prompt_raw <> ''
        ORDER BY work_styles.is_primary DESC, works.id DESC
        LIMIT 4
      `
    )
    .all(styleId) as StyleEvidencePromptRow[];

  return rows.map((row) => row.prompt_raw);
}

function listPendingStyleIds(db: Database.Database, limit: number): number[] {
  const repository = new StyleRepository(db);
  const rows = db
    .prepare(
      `
        SELECT styles.id
        FROM styles
        INNER JOIN work_styles ON work_styles.style_id = styles.id
        WHERE styles.status = 'active'
        GROUP BY styles.id
        ORDER BY MAX(work_styles.id) DESC
      `
    )
    .all() as Array<{ id: number }>;

  return rows
    .map((row) => repository.getStyleById(row.id))
    .filter((style): style is EditableStyleRecord => Boolean(style))
    .filter((style) => needsStyleEnrichment(style))
    .slice(0, limit)
    .map((style) => style.id);
}

export class StyleEnrichmentQueue {
  private readonly queuedStyleIds = new Set<number>();
  private readonly pendingStyleIds: number[] = [];
  private readonly tasks = new Set<Promise<void>>();
  private closed = false;

  constructor(
    private readonly db: Database.Database,
    private readonly enricher: StyleEnricher,
    private readonly logError: (error: unknown, styleId: number) => void = () => {}
  ) {}

  enqueueStyleIds(styleIds: number[]) {
    for (const styleId of new Set(styleIds)) {
      if (this.closed) {
        continue;
      }

      if (this.queuedStyleIds.has(styleId)) {
        const pendingIndex = this.pendingStyleIds.indexOf(styleId);
        if (pendingIndex > 0) {
          this.pendingStyleIds.splice(pendingIndex, 1);
          this.pendingStyleIds.unshift(styleId);
        }
        continue;
      }

      this.queuedStyleIds.add(styleId);
      this.pendingStyleIds.push(styleId);
    }

    this.ensureWorker();
  }

  enqueueMissingStyles(limit = 100) {
    this.enqueueStyleIds(listPendingStyleIds(this.db, limit));
  }

  async enrichStyleId(styleId: number): Promise<boolean> {
    await this.runSoon(styleId);
    const style = new StyleRepository(this.db).getStyleById(styleId);
    return Boolean(style && !needsStyleEnrichment(style));
  }

  async close() {
    this.closed = true;
    await Promise.allSettled([...this.tasks]);
  }

  private ensureWorker() {
    if (this.closed || this.tasks.size > 0 || this.pendingStyleIds.length === 0) {
      return;
    }

    const task = this.runLoop().finally(() => {
      this.tasks.delete(task);
      this.ensureWorker();
    });
    this.tasks.add(task);
  }

  private async runLoop() {
    while (!this.closed) {
      const styleId = this.pendingStyleIds.shift();
      if (styleId === undefined) {
        return;
      }

      try {
        await this.runSoon(styleId);
      } catch (error) {
        this.logError(error, styleId);
      } finally {
        this.queuedStyleIds.delete(styleId);
      }
    }
  }

  private async runSoon(styleId: number) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    if (this.closed) {
      return;
    }

    const repository = new StyleRepository(this.db);
    const style = repository.getStyleById(styleId);
    if (!style || !needsStyleEnrichment(style)) {
      return;
    }

    const draft = await this.enricher.enrichStyle({
      name: style.name,
      termType: style.termType,
      evidencePrompts: collectEvidencePrompts(this.db, styleId)
    });

    if (this.closed) {
      return;
    }

    const latest = repository.getStyleById(styleId);
    if (!latest || !needsStyleEnrichment(latest)) {
      return;
    }

    repository.updateStyle(styleId, {
      shortDescription: isLowValueDescription(latest.shortDescription)
        ? draft.shortDescription
        : undefined,
      visualTraits: latest.visualTraits.trim() ? undefined : draft.visualTraits,
      promptHints: latest.promptHints.trim() ? undefined : draft.promptHints
    });
  }
}
