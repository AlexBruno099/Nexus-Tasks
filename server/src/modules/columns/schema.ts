import { LIMITS } from '../../../../shared/limits';
import { z } from 'zod';
export const columnCreate = z.object({
  name: z.string().trim().min(1, 'o nome não pode ficar vazio').max(LIMITS.columnName),
});
export const columnPatch = columnCreate.extend({ isDone: z.boolean() }).partial();

export type ColumnCreate = z.infer<typeof columnCreate>;
export type ColumnPatch = z.infer<typeof columnPatch>;
