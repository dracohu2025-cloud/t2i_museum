import type { FastifyInstance } from 'fastify';

import { renderMuseumPage } from '../ui/museum-page';

export async function registerMuseumRoute(app: FastifyInstance) {
  const html = renderMuseumPage();

  app.get('/museum', async (_request, reply) => reply.type('text/html').send(html));
  app.get('/museum/styles/:slug', async (_request, reply) => reply.type('text/html').send(html));
  app.get('/museum/works/:sourceWorkId', async (_request, reply) => reply.type('text/html').send(html));
}
