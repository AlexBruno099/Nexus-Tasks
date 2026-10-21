import { build } from 'esbuild';
import { cp, mkdir } from 'node:fs/promises';

await build({
  entryPoints: ['server/src/index.ts'],
  outfile: 'dist/server/index.js',
  bundle: true,
  packages: 'external',
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
});
await mkdir('dist/server/migrations', { recursive: true });
await cp('server/src/database/migrations', 'dist/server/migrations', { recursive: true });
