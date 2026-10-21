import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import type pg from 'pg';
import { tx } from './connection';
import { SEED_COLUMNS, SEED_LABELS } from './seeds';

/** Migrações imutáveis, aplicadas uma vez, em transação e com trava entre processos. */
export async function migrate(pool: pg.Pool) {
  await tx(pool, async (db) => {
    await db.query('select pg_advisory_xact_lock(736294102)');
    await db.query(`create table if not exists schema_migrations (
      name text primary key, checksum text not null, applied_at timestamptz not null default now())`);
    const directory = new URL('./migrations/', import.meta.url);
    const names = (await readdir(directory)).filter((name) => /^\d{3}-[a-z0-9-]+\.sql$/.test(name)).sort();
    for (const name of names) {
      const sql = await readFile(new URL(name, directory), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const {
        rows: [existing],
      } = await db.query<{ checksum: string }>('select checksum from schema_migrations where name = $1', [
        name,
      ]);
      if (existing) {
        if (existing.checksum !== checksum)
          throw new Error(`Migração ${name} foi alterada depois de aplicada. Crie uma nova migração.`);
        continue;
      }
      await db.query(sql);
      // Só o primeiro esquema cadastra padrões. Reiniciar não recria itens excluídos pelo usuário.
      if (name === '001-initial.sql') {
        const {
          rows: [counts],
        } = await db.query<{ columns: number; labels: number }>(
          'select (select count(*)::int from columns) as columns, (select count(*)::int from labels) as labels',
        );
        if (counts.columns === 0) {
          for (const [position, [name, isDone]] of SEED_COLUMNS.entries())
            await db.query('insert into columns (name, position, is_done) values ($1, $2, $3)', [
              name,
              position,
              isDone,
            ]);
        }
        if (counts.labels === 0) {
          for (const [position, [group, name, color]] of SEED_LABELS.entries())
            await db.query('insert into labels (name, color, grp, position) values ($1, $2, $3, $4)', [
              name,
              color,
              group,
              position,
            ]);
        }
      }
      await db.query('insert into schema_migrations (name, checksum) values ($1, $2)', [name, checksum]);
    }
  });
}
