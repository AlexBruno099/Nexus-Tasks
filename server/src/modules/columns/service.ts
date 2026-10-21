import type pg from 'pg';
import { tx } from '../../database/connection';
import { HttpError } from '../../http/errors';
import * as repository from './repository';
import type { ColumnCreate, ColumnPatch } from './schema';
export const create = (pool: pg.Pool, body: ColumnCreate) => repository.insert(pool, body);
export async function update(pool: pg.Pool, columnId: number, body: ColumnPatch) {
  return tx(pool, async (db) => {
    if (!(await repository.lockColumn(db, columnId))) throw new HttpError(404, 'Coluna não encontrada.');
    const column = await repository.update(db, columnId, body);
    if (body.isDone !== undefined) await repository.syncCompletion(db, columnId);
    return column;
  });
}
export async function remove(pool: pg.Pool, columnId: number) {
  return tx(pool, async (db) => {
    if (!(await repository.lockColumn(db, columnId))) throw new HttpError(404, 'Coluna não encontrada.');
    const count = await repository.taskCount(db, columnId);
    if (count > 0)
      throw new HttpError(
        409,
        `A coluna tem ${count} task(s), contando as arquivadas. Mova ou apague antes.`,
      );
    await repository.remove(db, columnId);
  });
}
