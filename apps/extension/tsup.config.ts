import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'content/index': 'src/content/index.ts',
    'background/index': 'src/background/index.ts'
  },
  format: ['iife'],
  bundle: true,
  minify: true,
  platform: 'browser',
  outDir: 'dist',
  sourcemap: true,
  clean: true,
  splitting: false,
  dts: false
});
