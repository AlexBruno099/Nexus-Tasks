import { randomBytes } from 'node:crypto';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { loadEnvFile } from '../server/src/config/env';
import { createPool, DEFAULT_ADMIN_URL } from '../server/src/database/connection';
import { migrate } from '../server/src/database/migrate';
import { assertRuntimeRole } from '../server/src/database/permissions';
import { grantRuntimeAccess, provisionRuntimeRole } from '../server/src/database/provision';

loadEnvFile();
if (process.env.NODE_ENV === 'production')
  throw new Error(
    'db:setup configura apenas desenvolvimento. Em produção, provisione contas pelo seu gerenciador de segredos e execute db:migrate.',
  );
const migrationUrl = process.env.MIGRATION_DATABASE_URL ?? DEFAULT_ADMIN_URL;
const admin = createPool(migrationUrl);
try {
  await migrate(admin);
  let runtimeUrl = process.env.DATABASE_URL;
  let validRuntime = false;
  if (runtimeUrl) {
    const runtimeTarget = new URL(runtimeUrl);
    const migrationTarget = new URL(migrationUrl);
    if (runtimeTarget.host !== migrationTarget.host || runtimeTarget.pathname !== migrationTarget.pathname) {
      throw new Error(
        'DATABASE_URL e MIGRATION_DATABASE_URL apontam para bancos diferentes. Revise a configuração antes do setup.',
      );
    }
    const candidate = createPool(runtimeUrl);
    try {
      await assertRuntimeRole(candidate);
      validRuntime = true;
    } catch {
      /* Configuração antiga administrativa será substituída por uma conta nova. */
    } finally {
      await candidate.end();
    }
  }
  if (!validRuntime) {
    const role = `nexus_app_${randomBytes(6).toString('hex')}`;
    const password = randomBytes(32).toString('hex');
    await provisionRuntimeRole(admin, role, password);
    await grantRuntimeAccess(admin, role);
    const parsed = new URL(migrationUrl);
    parsed.username = role;
    parsed.password = password;
    runtimeUrl = parsed.toString();
  } else {
    const role = decodeURIComponent(new URL(runtimeUrl!).username);
    await grantRuntimeAccess(admin, role);
  }
  let content = '';
  try {
    content = await readFile('.env', 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const values = { DATABASE_URL: runtimeUrl!, MIGRATION_DATABASE_URL: migrationUrl };
  for (const [name, value] of Object.entries(values)) {
    const expression = new RegExp(`^${name}=.*$`, 'm');
    const line = `${name}=${value}`;
    content = expression.test(content)
      ? content.replace(expression, () => line)
      : `${content.trimEnd()}\n${line}\n`;
  }
  await writeFile('.env', content.trimStart(), { mode: 0o600 });
  await chmod('.env', 0o600);
  console.log('Banco preparado; .env configurado com conta de execução sem permissões administrativas.');
} finally {
  await admin.end();
}
