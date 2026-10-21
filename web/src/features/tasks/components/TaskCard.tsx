import { CalendarClock, Check, Flag, GitBranch, ListChecks } from 'lucide-react';
import { motion } from 'motion/react';
import type { CSSProperties } from 'react';
import type { Branch, Label, Task } from '../../../shared/types';
import { dueState, formatDue, priorityLabel } from '../../../shared/utils';

interface Props {
  task: Task;
  labels: Label[];
  done: boolean;
  /** Omitida quando o quadro já está filtrado pela branch. */
  branch?: Branch;
  /** Task recém-criada: entra com destaque. */
  fresh?: boolean;
  /** Versão que acompanha o ponteiro durante o arraste. */
  lifted?: boolean;
}

const MAX_TAGS = 3;

const namesFrom = (labels: Label[], start: number) =>
  labels
    .slice(start)
    .map((l) => l.name)
    .join(', ');

export function TaskCard({ task, labels, done, branch, fresh, lifted }: Props) {
  const due = dueState(task.dueDate, done);
  const checked = task.checklist.filter((i) => i.done).length;
  const flagged = !done && (task.priority === 'alta' || task.priority === 'urgente');
  const shown = labels.slice(0, MAX_TAGS);
  const extra = labels.length - shown.length;

  return (
    <motion.article
      className={`card${lifted ? ' card-lifted' : ''}${done ? ' card-done' : ''}${fresh ? ' card-fresh' : ''}`}
      initial={fresh ? { opacity: 0, y: -12, scale: 0.96 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
    >
      <div className="card-top">
        {done && (
          <motion.span
            className="done-check"
            initial={lifted ? false : { scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 18 }}
            aria-label="Concluída"
          >
            <Check size={11} strokeWidth={3} />
          </motion.span>
        )}
        <h3 className="card-title">{task.title}</h3>
        {flagged && (
          <span
            className={`flag flag-${task.priority}`}
            title={`Prioridade ${priorityLabel(task.priority).toLowerCase()}`}
          >
            <Flag size={13} aria-label={`Prioridade ${priorityLabel(task.priority)}`} />
          </span>
        )}
      </div>

      {labels.length > 0 && (
        <ul className="tags" aria-label="Etiquetas">
          {shown.map((l, i) => (
            <li key={l.id} className={i === 2 ? 'tag tag-third' : 'tag'}>
              <i className="dot" style={{ '--c': l.color } as CSSProperties} aria-hidden />
              {l.name}
            </li>
          ))}
          {extra > 0 && (
            <li className="tag tag-more tag-more-wide" title={namesFrom(labels, MAX_TAGS)}>
              +{extra}
            </li>
          )}
          {labels.length > 2 && (
            <li className="tag tag-more tag-more-narrow" title={namesFrom(labels, 2)}>
              +{labels.length - 2}
            </li>
          )}
        </ul>
      )}

      {(task.dueDate || task.checklist.length > 0 || branch) && (
        <footer className="card-meta">
          {branch && (
            <span className="card-branch" title={`${branch.repo} / ${branch.name}`}>
              <GitBranch size={13} aria-hidden /> <span>{branch.name}</span>
            </span>
          )}
          {task.dueDate && (
            <span className={`due due-${due ?? 'none'}`} title={`Prazo: ${task.dueDate}`}>
              <CalendarClock size={13} aria-hidden /> {formatDue(task.dueDate)}
            </span>
          )}
          {task.checklist.length > 0 && (
            <span className={checked === task.checklist.length ? 'check-full' : undefined}>
              <ListChecks size={13} aria-hidden /> {checked}/{task.checklist.length}
            </span>
          )}
        </footer>
      )}
    </motion.article>
  );
}
