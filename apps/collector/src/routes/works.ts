import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { approvedStyleTagSchema } from '@t2i/contracts';

import { getWorkDetail, listWorksWithStyles } from '../services/catalog-query';
import { applyStyleAnalysisToWork } from '../services/ingest-work';
import { WorkRepository } from '../services/work-repository';

const updateWorkStylesSchema = z.object({
  approvedStyles: z.array(approvedStyleTagSchema)
});

function approvedStyleToCandidate(style: z.infer<typeof approvedStyleTagSchema>) {
  return {
    rawTerm: style.name,
    normalizedCandidate: style.name,
    termType: style.termType,
    confidence: 1,
    shouldBeStyleTag: true,
    shortExplanation: style.shortExplanation || '用户在 museum 中二次编辑的风格关键词。'
  };
}

export async function registerWorksRoute(app: FastifyInstance) {
  app.get('/api/works', async () => ({
    items: listWorksWithStyles(app.collectorDb, app.collectorConfig.dataDir)
  }));

  app.get('/api/works/:sourceWorkId', async (request, reply) => {
    const params = request.params as { sourceWorkId: string };
    const detail = getWorkDetail(app.collectorDb, params.sourceWorkId, app.collectorConfig.dataDir);

    if (!detail) {
      return reply.code(404).send({
        error: 'work_not_found'
      });
    }

    return {
      item: detail
    };
  });

  app.patch('/api/works/:sourceWorkId/styles', async (request, reply) => {
    const params = request.params as { sourceWorkId: string };
    const parsed = updateWorkStylesSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_work_styles_payload'
      });
    }

    const repository = new WorkRepository(app.collectorDb);
    const workId = repository.getWorkIdBySourceWorkId(params.sourceWorkId);

    if (!workId) {
      return reply.code(404).send({
        error: 'work_not_found'
      });
    }

    const approvedStyles = parsed.data.approvedStyles;
    const analysis = {
      candidates: approvedStyles.map(approvedStyleToCandidate)
    };
    repository.clearWorkStyles(workId);
    const styleApplication = applyStyleAnalysisToWork(repository, workId, analysis, 'user');
    app.styleEnrichmentQueue?.enqueueStyleIds(styleApplication.createdStyleIds);
    repository.recordAnalysisRun({
      workId,
      provider: 'user',
      model: 'museum-style-editor',
      promptVersion: 'museum-edit-v1',
      rawResponse: JSON.stringify({ approvedStyles }),
      parsedResult: analysis,
      status: 'succeeded'
    });

    return {
      item: getWorkDetail(app.collectorDb, params.sourceWorkId, app.collectorConfig.dataDir)
    };
  });

  app.delete('/api/works/:sourceWorkId', async (request, reply) => {
    const params = request.params as { sourceWorkId: string };
    const repository = new WorkRepository(app.collectorDb);
    const deleted = repository.deleteWorkBySourceWorkId(params.sourceWorkId);

    if (!deleted) {
      return reply.code(404).send({
        error: 'work_not_found'
      });
    }

    return {
      status: 'deleted',
      item: deleted
    };
  });
}
