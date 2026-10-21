import type { Db } from '../../database/connection';
import type { ColumnCreate, ColumnPatch } from './schema';
const mapColumn = (r: { id: number; name: string; position: number; is_done: boolean }) => ({
  id: r.id,
  name: r.name,
  position: r.position,
  isDone: r.is_done,
});

export async function list(db: Db) {
  return (await db.query('select * from columns order by position, id')).rows.map(mapColumn);
}
export async function lockColumn(db: Db, columnId: number) {
  return (await db.query('select id from columns where id = $1 for update', [columnId])).rows[0];
}
export async function insert(db: Db, body: ColumnCreate) {
  const {
    rows: [column],
  } = await db.query(
    'insert into columns (name, position) values ($1, (select coalesce(max(position), -1) + 1 from columns)) returning *',
    [body.name],
  );
  return mapColumn(column);
}
export async function update(db: Db, columnId: number, body: ColumnPatch) {
  const {
    rows: [column],
  } = await db.query(
    'update columns set name = coalesce($2, name), is_done = coalesce($3, is_done) where id = $1 returning *',
    [columnId, body.name ?? null, body.isDone ?? null],
  );
  return mapColumn(column);
}
export async function syncCompletion(db: Db, columnId: number) {
  await db.query(
    `update tasks t set completed_at = case when c.is_done then coalesce(t.completed_at, now()) else null end, updated_at = now()
    from columns c where c.id = t.column_id and c.id = $1`,
    [columnId],
  );
}
export async function taskCount(db: Db, columnId: number) {
  return (
    await db.query<{ n: number }>('select count(*)::int as n from tasks where column_id = $1', [columnId])
  ).rows[0].n;
}
export async function remove(db: Db, columnId: number) {
  await db.query('delete from columns where id = $1', [columnId]);
}
