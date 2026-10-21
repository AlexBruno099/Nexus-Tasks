import { ApiError, request as req } from '../../shared/api/client';
import type { Board } from '../../shared/types';

export const boardApi = {
  board: async (archived = false, signal?: AbortSignal) => {
    const board = await req<Board>('GET', `/board${archived ? '?archived=1' : ''}`, undefined, { signal });
    if (
      !['columns', 'labels', 'branches', 'tasks'].every((key) => Array.isArray(board[key as keyof Board]))
    ) {
      throw new ApiError('Não foi possível ler os dados do quadro. Tente atualizar novamente.');
    }
    return board;
  },
};
