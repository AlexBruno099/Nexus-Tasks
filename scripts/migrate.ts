import { loadEnvFile } from '../server/src/config/env';
import { createPool } from '../server/src/database/connection';
import { migrate } from '../server/src/database/migrate';
loadEnvFile();
const url = process.env.MIGRATION_DATABASE_URL;
if (!url) throw new Error('Informe MIGRATION_DATABASE_URL para executar migrações.');
const pool = createPool(url);
try {
  await migrate(pool);
  console.log('Migrações aplicadas.');
} finally {
  await pool.end();
}
