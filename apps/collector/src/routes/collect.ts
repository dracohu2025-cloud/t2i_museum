import path from 'node:path';

import type { FastifyInstance } from 'fastify';

import { collectWorkPayloadSchema } from '@t2i/contracts';
import type { StyleAnalysisCandidate } from '@t2i/contracts';

import { startIngestWork } from '../services/ingest-work';
import { normalizeStyleTerm, resolveCanonicalStyle, sanitizePreviewTerm } from '../services/style-normalizer';
import { WorkRepository } from '../services/work-repository';

export async function registerCollectRoute(app: FastifyInstance) {
  const inflightTasks = new Set<Promise<void>>();

  app.addHook('onClose', async () => {
    await Promise.allSettled([...inflightTasks]);
  });

  app.post('/api/collect', async (request, reply) => {
    const payload = collectWorkPayloadSchema.parse(request.body);
    const repository = new WorkRepository(app.collectorDb);
    const started = startIngestWork({
      repository,
      cacheDir: path.join(app.collectorConfig.dataDir, 'cache', 'originals'),
      payload,
      styleAnalyzer: app.styleAnalyzer,
      imageUploader: app.imageUploader
    });
    const task = started.run().catch((error) => {
      request.log.error(
        {
          err: error,
          sourceSite: payload.sourceSite,
          sourceWorkId: payload.sourceWorkId
        },
        'background ingest failed'
      );
    });
    inflightTasks.add(task);
    void task.finally(() => {
      inflightTasks.delete(task);
    });

    if (started.status === 'already_collected') {
      return reply.code(200).send({
        status: started.status,
        workId: started.workId
      });
    }

    return reply.code(202).send({
      status: started.status,
      workId: started.workId
    });
  });

  app.post('/api/collect/preview', async (request, reply) => {
    const payload = collectWorkPayloadSchema.parse(request.body);
    if (!app.styleAnalyzer) {
      return reply.code(503).send({
        error: 'style_analyzer_unavailable'
      });
    }

    const repository = new WorkRepository(app.collectorDb);
    const analysis = await app.styleAnalyzer.analyzePrompt({
      promptRaw: payload.promptRaw
    });

    return {
      sourceWorkId: payload.sourceWorkId,
      candidates: analysis.candidates
        .filter((candidate) => candidate.shouldBeStyleTag)
        .map((candidate) => toPreviewCandidate(repository, candidate))
    };
  });
}

function toPreviewCandidate(repository: WorkRepository, candidate: StyleAnalysisCandidate) {
  // Apply a final sanitization pass so LLM-leaked grammatical particles never reach the extension UI.
  const cleanRawTerm = sanitizePreviewTerm(candidate.rawTerm);
  const cleanNormalized = sanitizePreviewTerm(candidate.normalizedCandidate) || cleanRawTerm;

  const resolvedStyle = resolveCanonicalStyle({
    rawTerm: cleanRawTerm,
    normalizedCandidate: cleanNormalized,
    termType: candidate.termType,
    shortExplanation: candidate.shortExplanation
  });
  const existingStyle =
    repository.findStyleByAliasNorm(normalizeStyleTerm(cleanRawTerm)) ??
    repository.findStyleByAliasNorm(normalizeStyleTerm(resolvedStyle.name)) ??
    repository.findStyleByName(resolvedStyle.name);

  return {
    name: existingStyle?.name ?? resolvedStyle.name,
    rawTerm: cleanRawTerm,
    termType: resolvedStyle.termType,
    confidence: candidate.confidence,
    shortExplanation: resolvedStyle.shortDescription,
    existsInCatalog: Boolean(existingStyle)
  };
}
