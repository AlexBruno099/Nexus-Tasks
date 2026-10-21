import type pg from 'pg';
/** Somente ferramentas administrativas. A API não importa este módulo. */
export async function provisionRuntimeRole(pool: pg.Pool, role: string, password: string) {
  const {
    rows: [exists],
  } = await pool.query('select 1 from pg_roles where rolname = $1', [role]);
  if (exists)
    throw new Error('A conta solicitada já existe; a configuração não altera senhas de contas existentes.');
  const {
    rows: [statement],
  } = await pool.query<{ sql: string }>(
    `select format('CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS', $1::text, $2::text) as sql`,
    [role, password],
  );
  await pool.query(statement.sql);
}
export async function grantRuntimeAccess(pool: pg.Pool, role: string) {
  const {
    rows: [grants],
  } = await pool.query<{ sql: string }>(
    `select format(
    'GRANT CONNECT ON DATABASE %I TO %I; GRANT USAGE ON SCHEMA public TO %I;
     GRANT SELECT, INSERT, UPDATE, DELETE ON columns, labels, branches, tasks, task_labels TO %I;
     GRANT USAGE, SELECT ON SEQUENCE columns_id_seq, labels_id_seq, branches_id_seq, tasks_id_seq TO %I',
     current_database(), $1::text, $1::text, $1::text, $1::text) as sql`,
    [role],
  );
  await pool.query(grants.sql);
}
