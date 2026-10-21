import { LIMITS } from '../../../../shared/limits';
import { z } from 'zod';
import { color } from '../../http/validation';
export const labelCreate = z.object({
  name: z.string().trim().min(1, 'o nome não pode ficar vazio').max(LIMITS.labelName),
  color,
  grp: z.string().trim().min(1).max(LIMITS.labelGroup).default('Geral'),
});
export const labelPatch = labelCreate
  .extend({ grp: z.string().trim().min(1).max(LIMITS.labelGroup) })
  .partial();

export type LabelCreate = z.infer<typeof labelCreate>;
export type LabelPatch = z.infer<typeof labelPatch>;
