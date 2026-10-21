import type pg from 'pg';
import { tx, type Db } from '../../database/connection';
import { HttpError } from '../../http/errors';
import * as repository from './repository';
import type { BranchCreate, BranchPatch } from './schema';

export async function assertUnlocked(db: Db, branchId: number | null) {
  if (branchId === null) return;
  const branch = await repository.lock(db, branchId);
  if (branch?.locked)
    throw new HttpError(409, `A branch ${branch.name} está trancada. Destranque para mexer nas tasks dela.`);
}
export const create = (pool: pg.Pool, body: BranchCreate) => repository.insert(pool, body);
export async function update(pool: pg.Pool, branchId: number, body: BranchPatch) {
  return tx(pool, async (db) => {
    const branch = await repository.lock(db, branchId);
    if (!branch) throw new HttpError(404, 'Branch não encontrada.');
    const edits = Object.keys(body).some((key) => key !== 'locked' && key !== 'merged');
    if (branch.locked && body.locked !== false && edits)
      throw new HttpError(409, 'Branch trancada. Destranque para editar.');
    return repository.update(db, branchId, body);
  });
}
export async function remove(pool: pg.Pool, branchId: number) {
  return tx(pool, async (db) => {
    const branch = await repository.lock(db, branchId);
    if (!branch) throw new HttpError(404, 'Branch não encontrada.');
    if (branch.locked) throw new HttpError(409, 'Branch trancada. Destranque para excluir.');
    // ON DELETE SET NULL mantém as tarefas de branches abertas.
    await repository.remove(db, branchId);
  });
}
