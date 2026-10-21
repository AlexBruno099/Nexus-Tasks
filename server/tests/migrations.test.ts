import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createIsolatedDatabase } from '../testing/database';
import { migrate } from '../src/database/migrate';

test('migrações preservam dados, não recriam seeds removidos e detectam histórico alterado', async () => {
  const target = await createIsolatedDatabase();
  try {
    await target.pool.query('delete from labels');
    const before = (await target.pool.query('select * from columns order by id')).rows;
    await migrate(target.migrationPool);
    assert.deepEqual((await target.pool.query('select * from columns order by id')).rows, before);
    assert.equal((await target.pool.query('select count(*)::int as n from labels')).rows[0].n, 0);
    const history = (await target.migrationPool.query('select name from schema_migrations order by name'))
      .rows;
    assert.deepEqual(
      history.map((row) => row.name),
      ['001-initial.sql', '002-label-index.sql'],
    );
    await target.migrationPool.query(
      "update schema_migrations set checksum = 'tampered' where name = '001-initial.sql'",
    );
    await assert.rejects(migrate(target.migrationPool), /foi alterada depois de aplicada/);
  } finally {
    await target.close();
  }
});
