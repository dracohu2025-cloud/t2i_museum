import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { AnkiRepository } from '../services/anki-repository';

const reviewPayloadSchema = z.object({
  workId: z.number().int().positive(),
  styleSlug: z.string().min(1),
  correct: z.boolean()
});

export async function registerAnkiRoute(app: FastifyInstance) {
  app.get('/api/anki/cards', async () => {
    const repository = new AnkiRepository(app.collectorDb, app.collectorConfig.dataDir);
    return {
      items: repository.listCards()
    };
  });

  app.post('/api/anki/reviews', async (request, reply) => {
    const parsed = reviewPayloadSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_anki_review_payload'
      });
    }

    const repository = new AnkiRepository(app.collectorDb, app.collectorConfig.dataDir);
    const item = repository.recordReview(parsed.data);
    if (!item) {
      return reply.code(404).send({
        error: 'anki_card_not_found'
      });
    }

    return {
      item
    };
  });
}
