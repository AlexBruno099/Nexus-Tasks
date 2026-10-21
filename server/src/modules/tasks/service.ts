import type pg from 'pg';
import { tx, type Db } from '../../database/connection';
import { HttpError } from '../../http/errors';
import { assertUnlocked } from '../branches/service';
import { lockColumn } from '../columns/repository';
import * as repository from './repository';
import type { TaskCreate, TaskPatch } from './schema';

async function getTask(db: Db, taskId: number) {
  const task = await repository.find(db, taskId);
  if (!task) throw new HttpError(404, 'Task não encontrada.');
  return task;
}
export async function create(pool: pg.Pool, body: TaskCreate) {
  return tx(pool, async (db) => {
    // Coluna primeiro: serializa ordenação e mudanças no significado de conclusão.
    if (!(await lockColumn(db, body.columnId)))
      throw new HttpError(400, 'Coluna, etiqueta ou branch inexistente.');
    await assertUnlocked(db, body.branchId);
    const taskId = await repository.insert(db, body);
    await repository.setLabels(db, taskId, body.labelIds);
    await repository.syncCompletion(db, taskId);
    return getTask(db, taskId);
  });
}
export async function update(pool: pg.Pool, taskId: number, body: TaskPatch) {
  return tx(pool, async (db) => {
    const snapshot = await getTask(db, taskId);
    if (body.branchId !== undefined && snapshot.branchId !== body.branchId) {
      const ids = [...new Set([snapshot.branchId, body.branchId])].sort((a, b) => (a ?? 0) - (b ?? 0));
      for (const branchId of ids) await assertUnlocked(db, branchId);
    }
    const current = await repository.lock(db, taskId);
    if (!current) throw new HttpError(404, 'Task não encontrada.');
    if (body.branchId !== undefined && current.branch_id !== snapshot.branchId) {
      throw new HttpError(409, 'O vínculo da tarefa mudou. Atualize os dados e tente novamente.');
    }
    await repository.update(db, taskId, body);
    if (body.labelIds) await repository.setLabels(db, taskId, body.labelIds);
    return getTask(db, taskId);
  });
}
export async function move(pool: pg.Pool, taskId: number, columnId: number, index: number) {
  return tx(pool, async (db) => {
    if (!(await lockColumn(db, columnId)))
      throw new HttpError(400, 'Coluna, etiqueta ou branch inexistente.');
    if (!(await repository.lock(db, taskId))) throw new HttpError(404, 'Task não encontrada.');
    await repository.move(db, taskId, columnId, index);
    await repository.syncCompletion(db, taskId);
    return getTask(db, taskId);
  });
}
export async function remove(pool: pg.Pool, taskId: number) {
  return tx(pool, async (db) => {
    // Branch antes da tarefa: mesma ordem usada pela exclusão da branch e sua FK.
    const snapshot = await getTask(db, taskId);
    await assertUnlocked(db, snapshot.branchId);
    const current = await repository.lock(db, taskId);
    if (!current) throw new HttpError(404, 'Task não encontrada.');
    if (current.branch_id !== snapshot.branchId)
      throw new HttpError(409, 'O vínculo da tarefa mudou. Atualize os dados e tente novamente.');
    await repository.remove(db, taskId);
  });
}
