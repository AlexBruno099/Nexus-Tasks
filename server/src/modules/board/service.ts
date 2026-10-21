import type { Board } from '../../../../shared/contracts';
import type pg from 'pg';
import * as branches from '../branches/repository';
import * as columns from '../columns/repository';
import * as labels from '../labels/repository';
import * as tasks from '../tasks/repository';
export async function getBoard(pool: pg.Pool, archived: boolean): Promise<Board> {
  const [columnList, labelList, branchList, taskList] = await Promise.all([
    columns.list(pool),
    labels.list(pool),
    branches.list(pool),
    tasks.list(pool, archived),
  ]);
  return { columns: columnList, labels: labelList, branches: branchList, tasks: taskList };
}
