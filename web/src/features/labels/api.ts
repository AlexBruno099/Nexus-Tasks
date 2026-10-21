import { request as req } from '../../shared/api/client';
import type { Label } from '../../shared/types';

export const labelsApi = {
  createLabel: (body: Pick<Label, 'name' | 'color' | 'grp'>) => req<Label>('POST', '/labels', body),
  updateLabel: (id: number, patch: Partial<Pick<Label, 'name' | 'color' | 'grp'>>) =>
    req<Label>('PATCH', `/labels/${id}`, patch),
  deleteLabel: (id: number) => req<void>('DELETE', `/labels/${id}`),
};
