import { ArchiveRestore, RotateCw, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '../../../shared/api/client';
import type { Branch, Label, Task } from '../../../shared/types';
import { taskCode } from '../../../shared/utils';
import { boardApi } from '../../board/api';

interface Props {
  labelsById: Map<number, Label>;
  branches: Branch[];
  revision: number;
  onRestore: (id: number) => Promise<Task | undefined>;
  onDelete: (id: number) => Promise<boolean | undefined>;
  notify: (text: string) => void;
}

export function ArchiveView({ labelsById, branches, revision, onRestore, onDelete, notify }: Props) {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState<Set<number>>(new Set());
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const busy = useRef(new Set<number>());

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    boardApi
      .board(true, controller.signal)
      .then((board) => {
        if (!controller.signal.aborted) setTasks(board.tasks);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(errorMessage(error));
      });
    return () => controller.abort();
  }, [attempt, revision]);

  const act = async (task: Task, remove: boolean) => {
    if (busy.current.has(task.id)) return;
    busy.current.add(task.id);
    setPending(new Set(busy.current));
    try {
      const result = remove ? await onDelete(task.id) : await onRestore(task.id);
      if (!result) return;
      setTasks((list) => list?.filter((t) => t.id !== task.id) ?? null);
      setConfirmId(null);
      notify(`${taskCode(task.id)} ${remove ? 'apagada de vez.' : 'voltou para o quadro.'}`);
    } finally {
      busy.current.delete(task.id);
      setPending(new Set(busy.current));
    }
  };

  if (error)
    return (
      <div className="empty-state" role="alert">
        <p>Não foi possível carregar o arquivo.</p>
        <p>{error}</p>
        <button className="btn" onClick={() => setAttempt((value) => value + 1)}>
          <RotateCw size={15} /> Tentar novamente
        </button>
      </div>
    );
  if (!tasks)
    return (
      <p className="empty-state" role="status">
        Carregando arquivo…
      </p>
    );
  if (!tasks.length)
    return (
      <p className="empty-state">Nada arquivado. Tasks arquivadas aparecem aqui para restaurar ou apagar.</p>
    );

  return (
    <ul className="archive">
      <AnimatePresence initial={false}>
        {tasks.map((task) => {
          const locked = branches.some((branch) => branch.id === task.branchId && branch.locked);
          return (
            <motion.li
              key={task.id}
              layout
              exit={{ opacity: 0, x: 40 }}
              className="archive-row"
              aria-busy={pending.has(task.id)}
            >
              <span className="mono muted">{taskCode(task.id)}</span>
              <span className="archive-title">
                {task.title}
                <span className="muted">
                  {' '}
                  ·{' '}
                  {task.labelIds
                    .map((id) => labelsById.get(id)?.name)
                    .filter(Boolean)
                    .join(', ') || 'sem etiqueta'}
                </span>
              </span>
              <button className="btn" disabled={pending.has(task.id)} onClick={() => void act(task, false)}>
                <ArchiveRestore size={15} /> Restaurar
              </button>
              <button
                className={confirmId === task.id ? 'btn btn-danger' : 'btn btn-ghost-danger'}
                disabled={locked || pending.has(task.id)}
                title={locked ? 'Destranque a branch para apagar esta task' : undefined}
                onBlur={() => setConfirmId(null)}
                onClick={() => (confirmId === task.id ? void act(task, true) : setConfirmId(task.id))}
              >
                <Trash2 size={15} /> {confirmId === task.id ? 'Confirmar exclusão' : 'Apagar'}
              </button>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
