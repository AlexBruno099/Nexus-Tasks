import { LIMITS } from '../../../../shared/limits';
import { z } from 'zod';
import { color } from '../../http/validation';
export const branchCreate = z.object({
  repo: z.string().trim().min(1, 'informe o repositório').max(LIMITS.branchRepo),
  name: z.string().trim().min(1, 'o nome da branch não pode ficar vazio').max(LIMITS.branchName),
});
export const branchPatch = branchCreate
  .extend({ merged: z.boolean(), locked: z.boolean(), color, notes: z.string().max(LIMITS.branchNotes) })
  .partial();

export type BranchCreate = z.infer<typeof branchCreate>;
export type BranchPatch = z.infer<typeof branchPatch>;
