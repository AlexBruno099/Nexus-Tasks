import { boardApi } from '../features/board/api';
import { branchesApi } from '../features/branches/api';
import { columnsApi } from '../features/columns/api';
import { labelsApi } from '../features/labels/api';
import { tasksApi } from '../features/tasks/api';

export const api = { ...boardApi, ...tasksApi, ...labelsApi, ...columnsApi, ...branchesApi };
