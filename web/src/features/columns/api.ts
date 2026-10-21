import { request as req } from '../../shared/api/client';
import type { Column } from '../../shared/types';

export const columnsApi = {
  createColumn: (name: string) => req<Column>('POST', '/columns', { name }),
  updateColumn: (id: number, patch: Partial<Pick<Column, 'name' | 'isDone'>>) =>
    req<Column>('PATCH', `/columns/${id}`, patch),
  deleteColumn: (id: number) => req<void>('DELETE', `/columns/${id}`),
};
