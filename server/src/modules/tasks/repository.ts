import type { Task, Priority, ChecklistItem } from '../../../../shared/contracts';
import type { Db } from '../../database/connection';
import type { TaskCreate, TaskPatch } from './schema';
const TASK_SELECT = `
  select t.*,
         coalesce(array_agg(tl.label_id order by tl.label_id) filter (where tl.label_id is not null), '{}') as label_ids
  from tasks t
  left join task_labels tl on tl.task_id = t.id`;

type TaskRow = {
  id: number;
  title: string;
  description: string;
  column_id: number;
  position: number;
  priority: Priority;
  due_date: string | null;
  checklist: ChecklistItem[];
  archived: boolean;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
  label_ids: number[];
  branch_id: number | null;
};

const mapTask = (r: TaskRow): Task => ({
  id: r.id,
  title: r.title,
  description: r.description,
  columnId: r.column_id,
  position: r.position,
  priority: r.priority,
  dueDate: r.due_date,
  checklist: r.checklist,
  archived: r.archived,
  createdAt: r.created_at.toISOString(),
  updatedAt: r.updated_at.toISOString(),
  completedAt: r.completed_at?.toISOString() ?? null,
  labelIds: r.label_ids,
  branchId: r.branch_id,
});

export async function list(db: Db, archived: boolean) {
  const { rows } = await db.query<TaskRow>(
    `${TASK_SELECT} where t.archived = $1 group by t.id order by t.column_id, t.position, t.id`,
    [archived],
  );
  return rows.map(mapTask);
}
export async function find(db: Db, taskId: number) {
  const { rows } = await db.query<TaskRow>(`${TASK_SELECT} where t.id = $1 group by t.id`, [taskId]);
  return rows[0] ? mapTask(rows[0]) : undefined;
}
export async function lock(db: Db, taskId: number) {
  const { rows } = await db.query<{ branch_id: number | null }>(
    'select branch_id from tasks where id = $1 for update',
    [taskId],
  );
  return rows[0];
}
export async function insert(db: Db, body: TaskCreate) {
  const {
    rows: [row],
  } = await db.query<{ id: number }>(
    `insert into tasks (title, description, column_id, position, priority, due_date, checklist, branch_id)
     values ($1, $2, $3, (select coalesce(max(position), -1) + 1 from tasks where column_id = $3), $4, $5, $6, $7) returning id`,
    [
      body.title,
      body.description,
      body.columnId,
      body.priority,
      body.dueDate,
      JSON.stringify(body.checklist),
      body.branchId,
    ],
  );
  return row.id;
}
export async function update(db: Db, taskId: number, body: TaskPatch) {
  const columns: Record<string, [string, unknown]> = {
    title: ['title', body.title],
    description: ['description', body.description],
    priority: ['priority', body.priority],
    dueDate: ['due_date', body.dueDate],
    checklist: ['checklist', body.checklist && JSON.stringify(body.checklist)],
    archived: ['archived', body.archived],
    branchId: ['branch_id', body.branchId],
  };
  const sets = ['updated_at = now()'];
  const values: unknown[] = [taskId];
  for (const [key, [column, value]] of Object.entries(columns)) {
    if (!(key in body)) continue;
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  }
  await db.query(`update tasks set ${sets.join(', ')} where id = $1`, values);
}
export async function setLabels(db: Db, taskId: number, labelIds: number[]) {
  await db.query('delete from task_labels where task_id = $1', [taskId]);
  await db.query(
    'insert into task_labels (task_id, label_id) select $1, unnest($2::int[]) on conflict do nothing',
    [taskId, [...new Set(labelIds)]],
  );
}
export async function syncCompletion(db: Db, taskId: number) {
  await db.query(
    `update tasks t set completed_at = case when c.is_done then coalesce(t.completed_at, now()) else null end
    from columns c where c.id = t.column_id and t.id = $1`,
    [taskId],
  );
}
export async function move(db: Db, taskId: number, columnId: number, index: number) {
  const { rows } = await db.query<{ id: number }>(
    'select id from tasks where column_id = $1 and id <> $2 and not archived order by position, id',
    [columnId, taskId],
  );
  const ids = rows.map((row) => row.id);
  ids.splice(Math.min(index, ids.length), 0, taskId);
  await db.query(
    `update tasks set column_id = $1, position = d.ord - 1,
    updated_at = case when tasks.id = $3 then now() else updated_at end
    from unnest($2::int[]) with ordinality as d(id, ord) where tasks.id = d.id`,
    [columnId, ids, taskId],
  );
}
export async function remove(db: Db, taskId: number) {
  await db.query('delete from tasks where id = $1', [taskId]);
}
