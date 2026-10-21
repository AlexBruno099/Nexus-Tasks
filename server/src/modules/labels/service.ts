import type pg from 'pg';
import { HttpError } from '../../http/errors';
import * as repository from './repository';
import type { LabelCreate, LabelPatch } from './schema';
export const create = (pool: pg.Pool, body: LabelCreate) => repository.insert(pool, body);
export async function update(pool: pg.Pool, labelId: number, body: LabelPatch) {
  const label = await repository.update(pool, labelId, body);
  if (!label) throw new HttpError(404, 'Etiqueta não encontrada.');
  return label;
}
export async function remove(pool: pg.Pool, labelId: number) {
  if (!(await repository.remove(pool, labelId))) throw new HttpError(404, 'Etiqueta não encontrada.');
}
