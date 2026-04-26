import type { FastifyInstance } from 'fastify';

import { getStyleDetail, listStyles } from '../services/catalog-query';
import { needsStyleEnrichment } from '../services/style-enrichment-queue';
import { getCuratedStyleNarrative } from '../services/style-knowledge';
import { StyleConflictError, StyleRepository } from '../services/style-repository';

const detailEnrichmentWaitMs = 12_000;

async function waitForDetailEnrichment(app: FastifyInstance, styleId: number) {
  const enrichmentTask = app.styleEnrichmentQueue
    ?.enrichStyleId(styleId)
    .catch((error) => {
      app.log.warn({ err: error, styleId }, 'style detail enrichment failed');
      return false;
    });

  if (!enrichmentTask) {
    return false;
  }

  return await Promise.race([
    enrichmentTask,
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), detailEnrichmentWaitMs))
  ]);
}

export async function registerStylesRoute(app: FastifyInstance) {
  app.get('/api/styles', async () => ({
    items: listStyles(app.collectorDb, app.collectorConfig.dataDir)
  }));

  app.get('/api/styles/:slug', async (request, reply) => {
    const params = request.params as { slug: string };
    const repository = new StyleRepository(app.collectorDb);
    const style = repository.getStyleBySlug(params.slug);

    if (!style) {
      return reply.code(404).send({
        error: 'style_not_found'
      });
    }

    if (needsStyleEnrichment(style)) {
      const curated = getCuratedStyleNarrative(style.name);
      if (curated) {
        repository.updateStyle(style.id, {
          shortDescription: curated.overview,
          visualTraits: style.visualTraits.trim() ? undefined : curated.characteristics,
          promptHints: style.promptHints.trim() ? undefined : curated.lineage
        });
      } else {
        await waitForDetailEnrichment(app, style.id);
      }
    }

    const latest = repository.getStyleById(style.id);
    if (latest && needsStyleEnrichment(latest)) {
      app.styleEnrichmentQueue?.enqueueStyleIds([style.id]);
    }

    return {
      item: getStyleDetail(app.collectorDb, params.slug, app.collectorConfig.dataDir)
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
