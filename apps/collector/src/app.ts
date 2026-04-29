import Fastify from 'fastify';
import type Database from 'better-sqlite3';

import { resolveConfig, type CollectorConfig } from './config';
import { openDatabase } from './db/client';
import { runMigrations } from './db/migrate';
import { registerAnkiRoute } from './routes/anki';
import { registerCollectRoute } from './routes/collect';
import { registerHealthRoute } from './routes/health';
import { registerMediaRoute } from './routes/media';
import { registerMuseumRoute } from './routes/museum';
import { registerStylesRoute } from './routes/styles';
import { registerWorksRoute } from './routes/works';
import { createImageUploaderFromConfig, type ImageUploader } from './services/image-uploader';
import { normalizeStyleCatalog } from './services/style-catalog-maintenance';
import {
  createStyleAnalyzerFromConfig,
  type StyleAnalyzer
} from './services/style-analyzer';
import { StyleEnrichmentQueue } from './services/style-enrichment-queue';
import {
  createStyleEnricherFromConfig,
  type StyleEnricher
} from './services/style-enricher';

export interface BuildAppOptions extends Partial<CollectorConfig> {
  styleAnalyzer?: StyleAnalyzer;
  imageUploader?: ImageUploader;
  styleEnricher?: StyleEnricher;
}

export function buildApp(options: BuildAppOptions = {}) {
  const {
    styleAnalyzer: styleAnalyzerOverride,
    imageUploader: imageUploaderOverride,
    styleEnricher: styleEnricherOverride,
    ...configOverrides
  } = options;
  const config = resolveConfig(configOverrides);
  const db = openDatabase(config.dataDir);
  const styleAnalyzer = styleAnalyzerOverride ?? createStyleAnalyzerFromConfig(config);
  const imageUploader = imageUploaderOverride ?? createImageUploaderFromConfig(config);
  const styleEnricher = styleEnricherOverride ?? createStyleEnricherFromConfig(config);
  runMigrations(db);
  normalizeStyleCatalog(db);
  const app = Fastify();
  const styleEnrichmentQueue = styleEnricher
    ? new StyleEnrichmentQueue(db, styleEnricher, (error, styleId) => {
        app.log.warn({ err: error, styleId }, 'style enrichment failed');
      })
    : undefined;

  app.decorate('collectorConfig', config);
  app.decorate('collectorDb', db);
  app.decorate('styleAnalyzer', styleAnalyzer);
  app.decorate('imageUploader', imageUploader);
  app.decorate('styleEnrichmentQueue', styleEnrichmentQueue);
  void registerHealthRoute(app);
  void registerAnkiRoute(app);
  void registerCollectRoute(app);
  void registerWorksRoute(app);
  void registerStylesRoute(app);
  void registerMediaRoute(app);
  void registerMuseumRoute(app);
  styleEnrichmentQueue?.enqueueMissingStyles();

  app.addHook('onClose', async () => {
    await styleEnrichmentQueue?.close();
    db.close();
  });

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    collectorConfig: CollectorConfig;
    collectorDb: Database.Database;
    styleAnalyzer?: StyleAnalyzer;
    imageUploader?: ImageUploader;
    styleEnrichmentQueue?: StyleEnrichmentQueue;
  }
}
