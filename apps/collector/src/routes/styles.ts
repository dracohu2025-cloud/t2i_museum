import type { FastifyInstance } from 'fastify';

import { getStyleDetail, listStyles } from '../services/catalog-query';
import { StyleConflictError, StyleRepository } from '../services/style-repository';

export async function registerStylesRoute(app: FastifyInstance) {
  app.get('/api/styles', async () => ({
    items: listStyles(app.collectorDb, app.collectorConfig.dataDir)
  }));

  app.get('/api/styles/:slug', async (request, reply) => {
    const params = request.params as { slug: string };
    const detail = getStyleDetail(app.collectorDb, params.slug, app.collectorConfig.dataDir);

    if (!detail) {
      return reply.code(404).send({
        error: 'style_not_found'
      });
    }

    return {
      item: detail
    };
  });

  app.patch('/api/styles/:slug', async (request, reply) => {
    const params = request.params as { slug: string };
    const body = (request.body ?? {}) as {
      name?: string;
      shortDescription?: string;
      visualTraits?: string;
      promptHints?: string;
      status?: string;
      heroWorkId?: number | null;
    };
    const repository = new StyleRepository(app.collectorDb);
    const style = repository.getStyleBySlug(params.slug);

    if (!style) {
      return reply.code(404).send({
        error: 'style_not_found'
      });
    }

    try {
      const updated = repository.updateStyle(style.id, body);
      if (!updated) {
        return reply.code(404).send({
          error: 'style_not_found'
        });
      }

      return {
        item: getStyleDetail(app.collectorDb, updated.slug, app.collectorConfig.dataDir)
      };
    } catch (error) {
      if (error instanceof StyleConflictError) {
        return reply.code(409).send({ error: error.code });
      }

      if (error instanceof Error) {
        return reply.code(400).send({ error: error.message });
      }

      throw error;
    }
  });

  app.post('/api/styles/:slug/aliases', async (request, reply) => {
    const params = request.params as { slug: string };
    const body = (request.body ?? {}) as { aliasName?: string };
    const repository = new StyleRepository(app.collectorDb);
    const style = repository.getStyleBySlug(params.slug);

    if (!style) {
      return reply.code(404).send({
        error: 'style_not_found'
      });
    }

    try {
      repository.addAlias(style.id, body.aliasName ?? '');
      return {
        item: getStyleDetail(app.collectorDb, style.slug, app.collectorConfig.dataDir)
      };
    } catch (error) {
      if (error instanceof StyleConflictError) {
        return reply.code(409).send({ error: error.code });
      }

      if (error instanceof Error) {
        return reply.code(400).send({ error: error.message });
      }

      throw error;
    }
  });

  app.post('/api/styles/:slug/merge', async (request, reply) => {
    const params = request.params as { slug: string };
    const body = (request.body ?? {}) as { targetSlug?: string };
    const repository = new StyleRepository(app.collectorDb);
    const source = repository.getStyleBySlug(params.slug);

    if (!source) {
      return reply.code(404).send({
        error: 'style_not_found'
      });
    }

    if (!body.targetSlug) {
      return reply.code(400).send({
        error: 'style_merge_target_missing'
      });
    }

    const target = repository.getStyleBySlug(body.targetSlug);
    if (!target) {
      return reply.code(404).send({
        error: 'style_merge_target_not_found'
      });
    }

    try {
      const updated = repository.mergeStyleInto(source.id, target.id);
      if (!updated) {
        return reply.code(404).send({
          error: 'style_not_found'
        });
      }

      return {
        item: getStyleDetail(app.collectorDb, updated.slug, app.collectorConfig.dataDir),
        redirectedFrom: params.slug
      };
    } catch (error) {
      if (error instanceof StyleConflictError) {
        return reply.code(409).send({ error: error.code });
      }

      if (error instanceof Error) {
        return reply.code(400).send({ error: error.message });
      }

      throw error;
    }
  });
}
