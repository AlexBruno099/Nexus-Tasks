export type * from '../../../shared/contracts';
export interface Filters {
  labelIds: number[];
  q: string;
  overdue: boolean;
  branchId: number | null;
}

export type Order = Record<number, number[]>;
