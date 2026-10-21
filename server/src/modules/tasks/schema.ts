import { LIMITS } from '../../../../shared/limits';
import { z } from 'zod';
import { id, isoDate } from '../../http/validation';
const priority = z.enum(['baixa', 'media', 'alta', 'urgente']);
const checklistItem = z.object({
  id: z.string().min(1).max(64),
  text: z.string().trim().min(1).max(LIMITS.checklistText),
  done: z.boolean(),
});

const taskFields = {
  title: z.string().trim().min(1, 'o título não pode ficar vazio').max(LIMITS.taskTitle),
  description: z.string().max(LIMITS.description),
  priority,
  dueDate: isoDate.nullable(),
  labelIds: z.array(id).max(50),
  checklist: z.array(checklistItem).max(LIMITS.checklistItems),
  branchId: id.nullable(),
};
export const taskCreate = z.object({
  ...taskFields,
  columnId: id,
  description: taskFields.description.default(''),
  priority: priority.default('media'),
  dueDate: taskFields.dueDate.default(null),
  labelIds: taskFields.labelIds.default([]),
  checklist: taskFields.checklist.default([]),
  branchId: taskFields.branchId.default(null),
});
export const taskPatch = z.object({ ...taskFields, archived: z.boolean() }).partial();
export const taskMove = z.object({ columnId: id, index: z.number().int().min(0) });

export type TaskCreate = z.infer<typeof taskCreate>;
export type TaskPatch = z.infer<typeof taskPatch>;
