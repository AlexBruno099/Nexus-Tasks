import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app';
import { loadEnvFile, readConfig } from './config/env';
import { createPool } from './database/connection';
import { assertRuntimeRole } from './database/permissions';

loadEnvFile();
const config = readConfig();
const pool = createPool(config.DATABASE_URL);
const dist = fileURLToPath(new URL('../../dist/web/', import.meta.url));
const app = buildApp(pool, {
  logger: true,
  logLevel: config.LOG_LEVEL,
  staticDir: config.NODE_ENV === 'production' && existsSync(dist) ? dist : undefined,
});
pool.on('error', (error) => app.log.error({ err: error }, 'Conexão ociosa com o banco falhou'));
app.addHook('onClose', async () => {
  await pool.end();
});
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  try {
    await app.close();
  } catch (error) {
    app.log.error(error);
    process.exitCode = 1;
  }
}
process.once('SIGINT', close);
process.once('SIGTERM', close);
try {
  await assertRuntimeRole(pool);
  await pool.query('select id from columns limit 1');
  await app.listen({ port: config.PORT, host: config.HOST });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
  await close();
}
