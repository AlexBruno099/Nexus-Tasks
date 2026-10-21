import type { Branch } from '../../../../shared/contracts';
import type { Db } from '../../database/connection';
import type { BranchCreate, BranchPatch } from './schema';
const mapBranch = (r: {
  id: number;
  repo: string;
  name: string;
  merged: boolean;
  locked: boolean;
  color: string;
  notes: string;
  created_at: Date;
}): Branch => ({
  id: r.id,
  repo: r.repo,
  name: r.name,
  merged: r.merged,
  locked: r.locked,
  color: r.color,
  notes: r.notes,
  createdAt: r.created_at.toISOString(),
});

export async function list(db: Db) {
  return (await db.query('select * from branches order by repo, created_at, id')).rows.map(mapBranch);
}
export async function lock(db: Db, branchId: number) {
  return (
    await db.query<{ name: string; locked: boolean }>(
      'select name, locked from branches where id = $1 for update',
      [branchId],
    )
  ).rows[0];
}
export async function insert(db: Db, body: BranchCreate) {
  const {
    rows: [branch],
  } = await db.query('insert into branches (repo, name) values ($1, $2) returning *', [body.repo, body.name]);
  return mapBranch(branch);
}
export async function update(db: Db, branchId: number, body: BranchPatch) {
  const {
    rows: [branch],
  } = await db.query(
    `update branches set repo = coalesce($2, repo), name = coalesce($3, name), merged = coalesce($4, merged),
    color = coalesce($5, color), notes = coalesce($6, notes), locked = coalesce($7, locked) where id = $1 returning *`,
    [
      branchId,
      body.repo ?? null,
      body.name ?? null,
      body.merged ?? null,
      body.color ?? null,
      body.notes ?? null,
      body.locked ?? null,
    ],
  );
  return mapBranch(branch);
}
export async function remove(db: Db, branchId: number) {
  await db.query('delete from branches where id = $1', [branchId]);
}
