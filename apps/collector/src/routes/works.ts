import type { FastifyInstance } from 'fastify';

import { getWorkDetail, listWorksWithStyles } from '../services/catalog-query';
import { WorkRepository } from '../services/work-repository';

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
