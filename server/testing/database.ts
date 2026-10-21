import { randomBytes, randomUUID } from 'node:crypto';
import { loadEnvFile } from '../src/config/env';
import { createPool, DEFAULT_ADMIN_URL } from '../src/database/connection';
import { migrate } from '../src/database/migrate';
import { assertRuntimeRole } from '../src/database/permissions';
import { grantRuntimeAccess, provisionRuntimeRole } from '../src/database/provision';

/** Nunca executa DROP ou TRUNCATE contra o nome recebido na configuração. */
export async function createIsolatedDatabase() {
  loadEnvFile();
  const source = new URL(
    process.env.TEST_ADMIN_DATABASE_URL ?? process.env.MIGRATION_DATABASE_URL ?? DEFAULT_ADMIN_URL,
  );
  source.pathname = '/postgres';
  const admin = createPool(source.toString());
  const suffix = randomUUID().replaceAll('-', '');
  const database = `nexus_test_${suffix}`;
  const role = `nexus_test_app_${suffix}`;
  const password = randomBytes(32).toString('hex');
  if (!/^nexus_test_[a-f0-9]{32}$/.test(database) || !/^nexus_test_app_[a-f0-9]{32}$/.test(role))
    throw new Error('Identificador temporário inválido.');
  let created = false;
  let roleCreated = false;
  let closed = false;
  let migrationPool: ReturnType<typeof createPool> | undefined;
  let pool: ReturnType<typeof createPool> | undefined;
  const close = async () => {
    if (closed) return;
    closed = true;
    try {
      await pool?.end();
      await migrationPool?.end();
      if (created) await admin.query(`DROP DATABASE ${database}`);
      if (roleCreated) await admin.query(`DROP ROLE ${role}`);
    } finally {
      await admin.end();
    }
  };
  try {
    await admin.query(`CREATE DATABASE ${database}`);
    created = true;
    source.pathname = `/${database}`;
    migrationPool = createPool(source.toString());
    const actual = (await migrationPool.query<{ name: string }>('select current_database() as name')).rows[0]
      .name;
    if (actual !== database) throw new Error('Conexão não corresponde ao banco temporário.');
    await migrate(migrationPool);
    await provisionRuntimeRole(admin, role, password);
    roleCreated = true;
    await grantRuntimeAccess(migrationPool, role);
    source.username = role;
    source.password = password;
    pool = createPool(source.toString());
    await assertRuntimeRole(pool);
    return { pool, migrationPool, database, close };
  } catch (error) {
    await close();
    throw error;
  }
}
