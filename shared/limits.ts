// Limites comuns entre validação no servidor e formulários.
export const LIMITS = {
  taskTitle: 200,
  description: 20000,
  checklistItems: 200,
  checklistText: 300,
  labelName: 40,
  labelGroup: 30,
  columnName: 40,
  branchRepo: 60,
  branchName: 120,
  branchNotes: 4000,
} as const;
