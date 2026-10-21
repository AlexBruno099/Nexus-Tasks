import type pg from 'pg';
export async function assertRuntimeRole(pool: pg.Pool) {
  const {
    rows: [role],
  } = await pool.query<{ unsafe: boolean }>(`select
    r.rolsuper or r.rolcreatedb or r.rolcreaterole or r.rolreplication or r.rolbypassrls
    or pg_has_role(current_user, d.datdba, 'USAGE')
    or has_schema_privilege(current_user, 'public', 'CREATE') as unsafe
    from pg_roles r join pg_database d on d.datname = current_database() where r.rolname = current_user`);
  if (!role || role.unsafe)
    throw new Error(
      'DATABASE_URL usa uma conta administrativa. Configure uma conta de execução sem DDL com npm run db:setup.',
    );
}
