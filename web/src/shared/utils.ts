import type { Branch, Column, Filters, Label, Order, Priority, Task } from './types';

export const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
];

export const priorityLabel = (p: Priority) => PRIORITIES.find((x) => x.value === p)?.label ?? p;

export const taskCode = (id: number) => `#${String(id).padStart(4, '0')}`;

// Na coluna de concluídas, o que fechou há mais de 7 dias fica recolhido, sempre com aviso.
const STALE_DONE_MS = 7 * 86_400_000;
export const isStaleDone = (task: Pick<Task, 'completedAt'> | undefined, now: number) =>
  !!task?.completedAt && now - Date.parse(task.completedAt) > STALE_DONE_MS;

const pad = (n: number) => String(n).padStart(2, '0');
export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISODate(new Date());

const dayDiff = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  const due = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
};

export type DueState = 'overdue' | 'today' | 'soon' | 'later';

export function dueState(iso: string | null, done: boolean): DueState | null {
  if (!iso || done) return null;
  const diff = dayDiff(iso);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff <= 2) return 'soon';
  return 'later';
}

export function formatDue(iso: string) {
  const diff = dayDiff(iso);
  if (diff === 0) return 'hoje';
  if (diff === 1) return 'amanhã';
  if (diff === -1) return 'ontem';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

export const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-');

/** Separa "#etiqueta" do título digitado na criação rápida. */
export function parseQuickTitle(raw: string, labels: Label[]) {
  const bySlug = new Map(labels.map((l) => [slug(l.name), l.id]));
  const labelIds: number[] = [];
  const title = raw
    .replace(/#([\p{L}\p{N}-]+)/gu, (token, name: string) => {
      const found = bySlug.get(slug(name));
      if (found === undefined) return token;
      labelIds.push(found);
      return '';
    })
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { title, labelIds };
}

export function groupLabels(labels: Label[]) {
  const groups = new Map<string, Label[]>();
  for (const l of labels) groups.set(l.grp, [...(groups.get(l.grp) ?? []), l]);
  return [...groups.entries()];
}

/** Dentro do mesmo grupo vale qualquer etiqueta; entre grupos, todas precisam bater. */
export function matchesFilters(
  task: Task,
  filters: Filters,
  labelsById: Map<number, Label>,
  columnsById: Map<number, Column>,
) {
  if (filters.branchId !== null && task.branchId !== filters.branchId) return false;
  if (filters.overdue && dueState(task.dueDate, !!columnsById.get(task.columnId)?.isDone) !== 'overdue')
    return false;

  const q = slug(filters.q);
  if (q) {
    const hay = slug(`${task.title} ${task.description} ${taskCode(task.id)}`);
    if (!hay.includes(q)) return false;
  }

  if (filters.labelIds.length) {
    const byGroup = new Map<string, number[]>();
    for (const id of filters.labelIds) {
      const grp = labelsById.get(id)?.grp;
      if (grp) byGroup.set(grp, [...(byGroup.get(grp) ?? []), id]);
    }
    for (const ids of byGroup.values()) {
      if (!ids.some((id) => task.labelIds.includes(id))) return false;
    }
  }
  return true;
}

export function buildOrder(columns: Column[], tasks: Task[]): Order {
  const order: Order = {};
  for (const c of columns) order[c.id] = [];
  for (const t of [...tasks].sort((a, b) => a.position - b.position || a.id - b.id))
    order[t.columnId]?.push(t.id);
  return order;
}

export const newId = () => Math.random().toString(36).slice(2, 10);

export const NO_FILTERS: Filters = { labelIds: [], q: '', overdue: false, branchId: null };

export function groupBranches(branches: Branch[]) {
  const groups = new Map<string, Branch[]>();
  for (const b of branches) groups.set(b.repo, [...(groups.get(b.repo) ?? []), b]);
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}
