import { request as req } from '../../shared/api/client';
import type { Branch, BranchPatch } from '../../shared/types';

export const branchesApi = {
  createBranch: (body: Pick<Branch, 'repo' | 'name'>) => req<Branch>('POST', '/branches', body),
  updateBranch: (id: number, patch: BranchPatch) => req<Branch>('PATCH', `/branches/${id}`, patch),
  deleteBranch: (id: number) => req<void>('DELETE', `/branches/${id}`),
};
