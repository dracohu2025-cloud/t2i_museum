import fs from 'node:fs';
import path from 'node:path';

import type { FastifyInstance } from 'fastify';

function inferMimeType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === '.webp') {
    return 'image/webp';
  }

  if (extension === '.png') {
    return 'image/png';
  }

  if (extension === '.jpg' || extension === '.jpeg') {
    return 'image/jpeg';
  }

  return 'application/octet-stream';
}

export async function registerMediaRoute(app: FastifyInstance) {
  app.get('/media/*', async (request, reply) => {
    const params = request.params as { '*': string };
    const requestedPath = params['*'] ?? '';
    const dataRoot = path.resolve(app.collectorConfig.dataDir);
    const absolutePath = path.resolve(dataRoot, requestedPath);

    if (!absolutePath.startsWith(dataRoot)) {
      return reply.code(400).send({
        error: 'invalid_media_path'
      });
    }

    if (!fs.existsSync(absolutePath)) {
      return reply.code(404).send({
        error: 'media_not_found'
      });
    }

    return reply.type(inferMimeType(absolutePath)).send(fs.readFileSync(absolutePath));
  });
}
