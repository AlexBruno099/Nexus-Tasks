import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../../shared/api/client';
import { createMutationQueue } from '../../shared/api/mutationQueue';
import type { Board, Branch, BranchPatch, Label, Order, Task, TaskPatch } from '../../shared/types';
import { api } from '../api';

type UpdateBoard = (board: Board) => Board;
const upsertTask =
  (task: Task): UpdateBoard =>
  (board) => ({
    ...board,
    tasks: board.tasks.some((t) => t.id === task.id)
      ? board.tasks.map((t) => (t.id === task.id ? task : t))
      : [...board.tasks, task],
  });

/** Estado do servidor, escritas ordenadas e reconciliação após a fila terminar. */
export function useWorkspace(notify: (message: string) => void) {
  const [board, setBoard] = useState<Board | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [revision, setRevision] = useState(0);
  const [queue] = useState(createMutationQueue);
  const mounted = useRef(false);
  const readController = useRef<AbortController>();
  const readVersion = useRef(0);

  const cancelRead = useCallback(() => {
    readVersion.current++;
    readController.current?.abort();
    if (mounted.current) setIsRefreshing(false);
  }, []);

  const refresh = useCallback(async () => {
    if (queue.pending || !mounted.current) return;
    cancelRead();
    const version = readVersion.current;
    const controller = new AbortController();
    readController.current = controller;
    setIsRefreshing(true);
    try {
      const data = await api.board(false, controller.signal);
      if (mounted.current && version === readVersion.current) {
        setBoard(data);
        setLoadError(null);
        setRevision((value) => value + 1);
      }
    } catch (error) {
      if (!controller.signal.aborted && mounted.current && version === readVersion.current)
        setLoadError(errorMessage(error));
    } finally {
      if (mounted.current && version === readVersion.current) setIsRefreshing(false);
    }
  }, [cancelRead, queue]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
      cancelRead();
    };
  }, [cancelRead, refresh]);

  const update = useCallback((transform: UpdateBoard) => {
    if (mounted.current) setBoard((current) => current && transform(current));
  }, []);

  const write = useCallback(
    async <T>(operation: () => Promise<T>, optimistic?: UpdateBoard, commit?: (value: T) => UpdateBoard) => {
      cancelRead();
      if (optimistic) update(optimistic);
      if (mounted.current) setIsSaving(true);
      try {
        return await queue.run(async () => {
          const value = await operation();
          if (commit) update(commit(value));
          return value;
        });
      } catch (error) {
        if (mounted.current) notify(errorMessage(error));
        return undefined;
      } finally {
        if (mounted.current && queue.pending === 0) {
          setIsSaving(false);
          void refresh();
        }
      }
    },
    [cancelRead, notify, queue, refresh, update],
  );

  const removeTask =
    (id: number): UpdateBoard =>
    (b) => ({ ...b, tasks: b.tasks.filter((t) => t.id !== id) });
  return {
    board,
    loadError,
    isRefreshing,
    isSaving,
    revision,
    refresh,
    createTask: (body: Parameters<typeof api.createTask>[0]) =>
      write(() => api.createTask(body), undefined, upsertTask),
    updateTask: (id: number, patch: TaskPatch) =>
      write(
        () => api.updateTask(id, patch),
        (b) => ({ ...b, tasks: b.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }),
      ),
    moveTask: (id: number, columnId: number, index: number, order: Order) =>
      write(
        () => api.moveTask(id, columnId, index),
        (b) => {
          const positions = new Map(
            Object.entries(order).flatMap(([column, ids]) =>
              ids.map((id, position) => [id, { columnId: Number(column), position }] as const),
            ),
          );
          return { ...b, tasks: b.tasks.map((t) => ({ ...t, ...positions.get(t.id) })) };
        },
      ),
    archiveTask: (id: number) => write(() => api.updateTask(id, { archived: true }), removeTask(id)),
    restoreTask: (id: number) => write(() => api.updateTask(id, { archived: false }), undefined, upsertTask),
    deleteTask: (id: number) =>
      write(async () => {
        await api.deleteTask(id);
        return true;
      }, removeTask(id)),
    createLabel: (body: Pick<Label, 'name' | 'color' | 'grp'>) =>
      write(
        () => api.createLabel(body),
        undefined,
        (label) => (b) => ({ ...b, labels: [...b.labels, label] }),
      ),
    updateLabel: (id: number, patch: Partial<Pick<Label, 'name' | 'color' | 'grp'>>) =>
      write(
        () => api.updateLabel(id, patch),
        (b) => ({ ...b, labels: b.labels.map((l) => (l.id === id ? { ...l, ...patch } : l)) }),
      ),
    deleteLabel: (id: number) =>
      write(
        async () => {
          await api.deleteLabel(id);
          return true;
        },
        (b) => ({
          ...b,
          labels: b.labels.filter((l) => l.id !== id),
          tasks: b.tasks.map((t) => ({ ...t, labelIds: t.labelIds.filter((l) => l !== id) })),
        }),
      ),
    createColumn: (name: string) =>
      write(
        () => api.createColumn(name),
        undefined,
        (column) => (b) => ({ ...b, columns: [...b.columns, column] }),
      ),
    renameColumn: (id: number, name: string) =>
      write(
        () => api.updateColumn(id, { name }),
        (b) => ({ ...b, columns: b.columns.map((c) => (c.id === id ? { ...c, name } : c)) }),
      ),
    deleteColumn: (id: number) =>
      write(
        async () => {
          await api.deleteColumn(id);
          return true;
        },
        undefined,
        () => (b) => ({ ...b, columns: b.columns.filter((c) => c.id !== id) }),
      ),
    createBranch: (body: Pick<Branch, 'repo' | 'name'>) =>
      write(
        () => api.createBranch(body),
        undefined,
        (branch) => (b) => ({ ...b, branches: [...b.branches, branch] }),
      ),
    updateBranch: (id: number, patch: BranchPatch) =>
      write(
        () => api.updateBranch(id, patch),
        (b) => ({
          ...b,
          branches: b.branches.map((branch) => (branch.id === id ? { ...branch, ...patch } : branch)),
        }),
      ),
    deleteBranch: (id: number) =>
      write(
        async () => {
          await api.deleteBranch(id);
          return true;
        },
        (b) => ({
          ...b,
          branches: b.branches.filter((branch) => branch.id !== id),
          tasks: b.tasks.map((t) => (t.branchId === id ? { ...t, branchId: null } : t)),
        }),
      ),
  };
}
