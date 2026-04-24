import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';

import { buildApp } from './app';
import { resolveConfig } from './config';

function loadEnvFiles() {
  const serverFile = fileURLToPath(import.meta.url);
  const srcDir = dirname(serverFile);
  const collectorRoot = resolve(srcDir, '..');
  const projectRoot = resolve(collectorRoot, '..', '..');

  dotenv.config({
    path: resolve(projectRoot, '.env')
  });
  dotenv.config({
    path: resolve(collectorRoot, '.env'),
    override: true
  });
}

loadEnvFiles();

const config = resolveConfig();
const app = buildApp(config);

app.listen({ host: config.host, port: config.port }).then(() => {
  console.log(`collector listening on http://${config.host}:${config.port}`);
});
