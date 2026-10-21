export type Priority = 'baixa' | 'media' | 'alta' | 'urgente';

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  columnId: number;
  position: number;
  priority: Priority;
  dueDate: string | null;
  checklist: ChecklistItem[];
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  labelIds: number[];
  branchId: number | null;
}

export interface Branch {
  id: number;
  repo: string;
  name: string;
  merged: boolean;
  /** Mergeada e apagada do git: não ganha nem perde task e não se edita. */
  locked: boolean;
  color: string;
  notes: string;
  createdAt: string;
}

export interface Label {
  id: number;
  name: string;
  color: string;
  grp: string;
  position: number;
}

export interface Column {
  id: number;
  name: string;
  position: number;
  isDone: boolean;
}

export interface Board {
  columns: Column[];
  labels: Label[];
  branches: Branch[];
  tasks: Task[];
}

export type TaskPatch = Partial<
  Pick<
    Task,
    'title' | 'description' | 'priority' | 'dueDate' | 'checklist' | 'labelIds' | 'archived' | 'branchId'
  >
>;

export type BranchPatch = Partial<Pick<Branch, 'repo' | 'name' | 'merged' | 'locked' | 'color' | 'notes'>>;
