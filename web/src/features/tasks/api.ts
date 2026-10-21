import { request as req } from '../../shared/api/client';
import type { Task, TaskPatch } from '../../shared/types';

export const tasksApi = {
  createTask: (body: TaskPatch & { title: string; columnId: number }) => req<Task>('POST', '/tasks', body),
  updateTask: (id: number, patch: TaskPatch) => req<Task>('PATCH', `/tasks/${id}`, patch),
  moveTask: (id: number, columnId: number, index: number) =>
    req<Task>('POST', `/tasks/${id}/move`, { columnId, index }),
  deleteTask: (id: number) => req<void>('DELETE', `/tasks/${id}`),
};
