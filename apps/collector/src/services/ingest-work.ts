import type {
  ApprovedStyleTag,
  CollectWorkPayload,
  StyleAnalysisCandidate,
  StyleAnalysisResult
} from '@t2i/contracts';

import { cacheImageFromSource } from './image-cache';
import type { ImageUploader } from './image-uploader';
import type { StyleAnalyzer } from './style-analyzer';
import { normalizeStyleTerm, resolveCanonicalStyle } from './style-normalizer';
import { type CreateWorkResult, WorkRepository } from './work-repository';

export interface IngestWorkInput {
  repository: WorkRepository;
  cacheDir: string;
  payload: CollectWorkPayload;
  styleAnalyzer?: StyleAnalyzer;
  imageUploader?: ImageUploader;
}

export interface StartedIngestWork extends CreateWorkResult {
  run: () => Promise<void>;
}

export function startIngestWork(input: IngestWorkInput): StartedIngestWork {
  const created = input.repository.createPendingWork(input.payload);

  return {
    ...created,
    run: async () => {
      await continueIngestWork(input, created);
    }
  };
}

export async function ingestWork(input: IngestWorkInput): Promise<CreateWorkResult> {
  const started = startIngestWork(input);
  await started.run();
  return {
    status: started.status,
    workId: started.workId,
    imageSourceChanged: started.imageSourceChanged
  };
}

async function continueIngestWork(input: IngestWorkInput, created: CreateWorkResult): Promise<void> {
  const approvedStyles = input.payload.approvedStyles ?? [];
  const hasApprovedStyles = approvedStyles.length > 0;

  if (created.status === 'already_collected') {
    const existing = input.repository.getWorkIngestSnapshot(created.workId);
    if (!existing) {
      return;
    }

    const shouldRebuildImageCache = !existing.imageLocalPath || created.imageSourceChanged;
    const shouldAnalyze = hasApprovedStyles || (Boolean(input.styleAnalyzer) && existing.styleCount === 0);
    const shouldUpload =
      Boolean(input.imageUploader) &&
      (Boolean(existing.imageLocalPath) || shouldRebuildImageCache) &&
      (existing.uploadStatus !== 'uploaded' || shouldRebuildImageCache);

    if (!shouldRebuildImageCache && !shouldAnalyze && !shouldUpload) {
      return;
    }
  }

  try {
    const existing = input.repository.getWorkIngestSnapshot(created.workId);
    const shouldRebuildImageCache = !existing?.imageLocalPath || created.imageSourceChanged;

    if (shouldRebuildImageCache) {
      input.repository.markIngestStage(created.workId, 'caching');
      const cachedImage = await cacheImageFromSource({
        sourceWorkId: input.payload.sourceWorkId,
        imageSourceUrl: input.payload.imageSourceUrl,
        cacheDir: input.cacheDir
      });

      input.repository.updateCachedImage(created.workId, cachedImage);
    }

    const current = input.repository.getWorkIngestSnapshot(created.workId);
    const shouldAnalyze = hasApprovedStyles || (Boolean(input.styleAnalyzer) && current?.styleCount === 0);
    const shouldUpload =
      Boolean(input.imageUploader) &&
      Boolean(current?.imageLocalPath) &&
      (current?.uploadStatus !== 'uploaded' || shouldRebuildImageCache);

    if (input.imageUploader && shouldUpload && current?.imageLocalPath) {
      try {
        input.repository.markIngestStage(created.workId, 'uploading');
        input.repository.markUploadStarted(created.workId);
        const upload = await input.imageUploader.uploadImage({
          sourceSite: input.payload.sourceSite,
          sourceWorkId: input.payload.sourceWorkId,
          localPath: current.imageLocalPath
        });
        input.repository.markUploadSucceeded(created.workId, upload);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown upload error';
        input.repository.markUploadFailed(created.workId, message);
      }
    }

    if (shouldAnalyze) {
      try {
        input.repository.markIngestStage(created.workId, 'analyzing');
        const analysis = hasApprovedStyles
          ? {
              candidates: approvedStyles.map(styleTagToCandidate)
            }
          : await input.styleAnalyzer!.analyzePrompt({
              promptRaw: input.payload.promptRaw
            });
        const metadata = hasApprovedStyles
          ? {
              provider: 'user',
              model: 'approved-style-tags',
              promptVersion: 'approved-v1'
            }
          : input.styleAnalyzer?.describe?.() ?? {
              provider: 'unknown',
              model: 'unknown',
              promptVersion: 'unknown'
            };

        input.repository.recordAnalysisRun({
          workId: created.workId,
          provider: metadata.provider,
          model: metadata.model,
          promptVersion: metadata.promptVersion,
          rawResponse: JSON.stringify(analysis),
          parsedResult: analysis,
          status: 'succeeded'
        });

        if (hasApprovedStyles) {
          input.repository.clearWorkStyles(created.workId);
        }

        applyStyleAnalysisToWork(input.repository, created.workId, analysis, hasApprovedStyles ? 'user' : 'llm');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown analysis error';
        input.repository.recordAnalysisRun({
          workId: created.workId,
          provider: 'unknown',
          model: 'unknown',
          promptVersion: 'unknown',
          rawResponse: '',
          parsedResult: { candidates: [] },
          status: 'failed',
          errorMessage: message
        });
      }
    }

    input.repository.markIngestDone(created.workId);
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown ingest error';
    input.repository.markIngestFailed(created.workId, message);
    return;
  }
}

function styleTagToCandidate(tag: ApprovedStyleTag): StyleAnalysisCandidate {
  return {
    rawTerm: tag.name,
    normalizedCandidate: tag.name,
    termType: tag.termType,
    confidence: 1,
    shouldBeStyleTag: true,
    shortExplanation: tag.shortExplanation || '用户确认的风格关键词。'
  };
}

export function applyStyleAnalysisToWork(
  repository: WorkRepository,
  workId: number,
  analysis: StyleAnalysisResult,
  source: 'llm' | 'user'
) {
  for (const [index, candidate] of analysis.candidates.entries()) {
    if (!candidate.shouldBeStyleTag) {
      continue;
    }

    const resolvedStyle = resolveCanonicalStyle({
      rawTerm: candidate.rawTerm,
      normalizedCandidate: candidate.normalizedCandidate,
      termType: candidate.termType,
      shortExplanation: candidate.shortExplanation
    });
    const aliasNorm = normalizeStyleTerm(candidate.rawTerm);
    const existingStyle =
      repository.findStyleByAliasNorm(aliasNorm) ??
      repository.findStyleByName(resolvedStyle.name);

    const style =
      existingStyle ??
      repository.createStyle({
        name: resolvedStyle.name,
        termType: resolvedStyle.termType,
        shortDescription: resolvedStyle.shortDescription
      });

    for (const aliasName of resolvedStyle.aliases) {
      repository.ensureStyleAlias({
        styleId: style.id,
        aliasName,
        aliasNorm: normalizeStyleTerm(aliasName),
        source: aliasName === resolvedStyle.name ? 'rule' : source,
        confidence: candidate.confidence
      });
    }

    repository.linkWorkStyle({
      workId,
      styleId: style.id,
      evidenceText: candidate.rawTerm,
      confidence: candidate.confidence,
      isPrimary: index === 0,
      source
    });
  }
}
