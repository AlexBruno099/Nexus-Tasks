import type { Label } from '../../../../shared/contracts';
import type { Db } from '../../database/connection';
import type { LabelCreate, LabelPatch } from './schema';
export async function list(db: Db) {
  return (await db.query<Label>('select * from labels order by position, id')).rows;
}
export async function insert(db: Db, body: LabelCreate) {
  return (
    await db.query<Label>(
      `insert into labels (name, color, grp, position) values ($1, $2, $3, (select coalesce(max(position), -1) + 1 from labels)) returning *`,
      [body.name, body.color, body.grp],
    )
  ).rows[0];
}
export async function update(db: Db, labelId: number, body: LabelPatch) {
  return (
    await db.query<Label>(
      `update labels set name = coalesce($2, name), color = coalesce($3, color), grp = coalesce($4, grp) where id = $1 returning *`,
      [labelId, body.name ?? null, body.color ?? null, body.grp ?? null],
    )
  ).rows[0];
}
export async function remove(db: Db, labelId: number) {
  return (await db.query('delete from labels where id = $1', [labelId])).rowCount;
}
