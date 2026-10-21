import { motion } from 'motion/react';
import type { CSSProperties } from 'react';
import type { Branch, Column, Label, Task } from '../../../shared/types';
import { dueState, formatDue, priorityLabel, taskCode } from '../../../shared/utils';

interface Props {
  tasks: Task[];
  columns: Column[];
  labelsById: Map<number, Label>;
  branchesById: Map<number, Branch>;
  onOpen: (id: number) => void;
}

export function ListView({ tasks, columns, labelsById, branchesById, onOpen }: Props) {
  const colIndex = new Map(columns.map((c, i) => [c.id, i]));
  const rows = [...tasks].sort(
    (a, b) =>
      (colIndex.get(a.columnId) ?? 0) - (colIndex.get(b.columnId) ?? 0) ||
      (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') ||
      a.position - b.position,
  );

  if (!rows.length)
    return (
      <p className="empty-state">
        Nenhuma task com esses filtros. Limpe os filtros ou crie uma task no quadro.
      </p>
    );

  return (
    <div className="list-wrap">
      <table className="list">
        <thead>
          <tr>
            <th>#</th>
            <th>Task</th>
            <th>Branch</th>
            <th>Coluna</th>
            <th>Prioridade</th>
            <th>Prazo</th>
            <th>Checklist</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t, i) => {
            const col = columns.find((c) => c.id === t.columnId);
            const due = dueState(t.dueDate, !!col?.isDone);
            const done = t.checklist.filter((x) => x.done).length;
            const branch = t.branchId !== null ? branchesById.get(t.branchId) : undefined;
            return (
              <motion.tr
                key={t.id}
                tabIndex={0}
                onClick={() => onOpen(t.id)}
                onKeyDown={(e) => e.key === 'Enter' && onOpen(t.id)}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.4) }}
              >
                <td className="mono muted">{taskCode(t.id)}</td>
                <td>
                  <span className="list-title">{t.title}</span>
                  <span className="tags">
                    {t.labelIds
                      .map((id) => labelsById.get(id))
                      .filter((l): l is Label => !!l)
                      .map((l) => (
                        <span key={l.id} className="tag">
                          <i className="dot" style={{ '--c': l.color } as CSSProperties} aria-hidden />
                          {l.name}
                        </span>
                      ))}
                  </span>
                </td>
                <td className="mono muted" title={branch ? `${branch.repo} / ${branch.name}` : undefined}>
                  {branch?.name ?? '—'}
                </td>
                <td>
                  <span className={`status-pill${col?.isDone ? ' done' : ''}`}>{col?.name}</span>
                </td>
                <td>
                  <span className={`prio prio-${t.priority}`}>{priorityLabel(t.priority)}</span>
                </td>
                <td className={`mono due-${due ?? 'none'}`}>{t.dueDate ? formatDue(t.dueDate) : '—'}</td>
                <td className="mono muted">{t.checklist.length ? `${done}/${t.checklist.length}` : '—'}</td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
