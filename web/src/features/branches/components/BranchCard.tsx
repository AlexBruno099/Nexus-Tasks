import { ArrowRight, Check, GitBranch, GitMerge, Lock, LockOpen, RotateCcw, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useState, type CSSProperties } from 'react';
import type { Branch, BranchPatch, Column, Task } from '../../../shared/types';
import { columnColor } from '../utils';

interface CardProps {
  branch: Branch;
  tasks: Task[];
  columns: Column[];
  onUpdate: (patch: BranchPatch) => void;
  onDelete: () => void;
  onOpen: () => void;
  onOpenTask: (id: number) => void;
}

/** Barra com a fatia de cada coluna e a contagem de feitas e pendentes. */

const SHOWN_TASKS = 4;

function BranchProgress({ tasks, columns }: { tasks: Task[]; columns: Column[] }) {
  const done = tasks.filter((t) => columns.find((c) => c.id === t.columnId)?.isDone).length;
  const perColumn = columns
    .map((c) => ({ col: c, n: tasks.filter((t) => t.columnId === c.id).length }))
    .filter((x) => x.n > 0);
  return (
    <div className="branch-progress">
      <div className="branch-bar" role="img" aria-label={`${done} de ${tasks.length} tasks feitas`}>
        {perColumn.map(({ col, n }) => (
          <motion.span
            key={col.id}
            style={{ '--c': columnColor(columns, col) } as CSSProperties}
            initial={{ flexGrow: 0 }}
            animate={{ flexGrow: n }}
            transition={{ type: 'spring', stiffness: 200, damping: 26 }}
          />
        ))}
      </div>
      <p className="branch-stats">
        <span className="branch-done">
          <strong>{done}</strong>/{tasks.length} feitas
        </span>
        {perColumn
          .filter(({ col }) => !col.isDone)
          .map(({ col, n }) => (
            <span key={col.id}>
              <i className="dot" style={{ '--c': columnColor(columns, col) } as CSSProperties} aria-hidden />{' '}
              {n} {col.name.toLowerCase()}
            </span>
          ))}
      </p>
    </div>
  );
}

export function BranchCard({ branch, tasks, columns, onUpdate, onDelete, onOpen, onOpenTask }: CardProps) {
  const [confirm, setConfirm] = useState(false);

  const colIndex = new Map(columns.map((c, i) => [c.id, i]));
  const isDone = (t: Task) => !!columns.find((c) => c.id === t.columnId)?.isDone;
  // Pendentes primeiro, na ordem das colunas; concluídas por último.
  const ordered = [...tasks].sort(
    (a, b) =>
      Number(isDone(a)) - Number(isDone(b)) ||
      (colIndex.get(a.columnId) ?? 0) - (colIndex.get(b.columnId) ?? 0) ||
      a.position - b.position,
  );
  const shown = ordered.slice(0, SHOWN_TASKS);

  return (
    <motion.article
      layout
      className={`branch-card${branch.merged ? ' branch-merged' : ''}`}
      style={{ '--branch': branch.color } as CSSProperties}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
    >
      <header className="branch-head">
        {branch.locked ? (
          <span className="branch-open is-static">
            <GitMerge size={16} className="branch-icon" aria-hidden />
            <span className="branch-name">{branch.name}</span>
          </span>
        ) : (
          <button className="branch-open" onClick={onOpen} title={`Abrir ${branch.repo} / ${branch.name}`}>
            {branch.merged ? (
              <GitMerge size={16} className="branch-icon" aria-hidden />
            ) : (
              <GitBranch size={16} className="branch-icon" aria-hidden />
            )}
            <span className="branch-name">{branch.name}</span>
          </button>
        )}
        {branch.merged && !branch.locked && <span className="merged-badge">mergeada</span>}
        {branch.locked && (
          <span className="locked-badge" title="Mergeada e apagada do git">
            <Lock size={11} aria-hidden /> trancada
          </span>
        )}
      </header>
      {branch.notes.trim() && <p className="branch-notes">{branch.notes.trim().split('\n')[0]}</p>}

      <BranchProgress tasks={tasks} columns={columns} />

      {tasks.length === 0 ? (
        <p className="branch-empty">Nenhuma task nesta branch ainda.</p>
      ) : (
        <ul className="branch-tasks">
          {shown.map((t) => (
            <li key={t.id}>
              <button className={isDone(t) ? 'is-done' : undefined} onClick={() => onOpenTask(t.id)}>
                {isDone(t) ? (
                  <span className="mini-check" aria-label="Feita">
                    <Check size={9} strokeWidth={3.5} />
                  </span>
                ) : (
                  <i
                    className="dot"
                    style={
                      {
                        '--c': columnColor(
                          columns,
                          columns.find((c) => c.id === t.columnId)!,
                        ),
                      } as CSSProperties
                    }
                    aria-hidden
                  />
                )}
                <span className="branch-task-title">{t.title}</span>
              </button>
            </li>
          ))}
          {tasks.length > SHOWN_TASKS && (
            <li>
              {branch.locked ? (
                <span className="branch-more">+{tasks.length - SHOWN_TASKS} na branch</span>
              ) : (
                <button className="branch-more" onClick={onOpen}>
                  +{tasks.length - SHOWN_TASKS} na branch
                </button>
              )}
            </li>
          )}
        </ul>
      )}

      <footer className="branch-foot">
        {!branch.locked && (
          <button className="link-btn" onClick={onOpen}>
            Abrir branch <ArrowRight size={13} aria-hidden />
          </button>
        )}
        <div className="branch-actions">
          <button
            className="icon-btn ghost"
            onClick={() => onUpdate({ locked: !branch.locked })}
            aria-label={branch.locked ? 'Destrancar branch' : 'Trancar branch'}
            title={branch.locked ? 'Destrancar branch' : 'Trancar: mergeada e apagada do git'}
          >
            {branch.locked ? <LockOpen size={15} /> : <Lock size={15} />}
          </button>
          {!branch.locked && (
            <button
              className="icon-btn ghost"
              onClick={() => onUpdate({ merged: !branch.merged })}
              aria-label={branch.merged ? 'Reabrir branch' : 'Marcar como mergeada'}
              title={branch.merged ? 'Reabrir branch' : 'Marcar como mergeada'}
            >
              {branch.merged ? <RotateCcw size={15} /> : <GitMerge size={15} />}
            </button>
          )}
          {confirm ? (
            <button
              className="btn btn-danger btn-sm"
              disabled={branch.locked}
              autoFocus
              onBlur={() => setConfirm(false)}
              onClick={onDelete}
            >
              {tasks.length ? `Soltar ${tasks.length} task${tasks.length > 1 ? 's' : ''} e apagar` : 'Apagar'}
            </button>
          ) : (
            <button
              className="icon-btn ghost"
              disabled={branch.locked}
              onClick={() => setConfirm(true)}
              aria-label="Apagar branch"
              title={branch.locked ? 'Destranque a branch para apagá-la' : 'Apagar branch'}
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </footer>
    </motion.article>
  );
}
