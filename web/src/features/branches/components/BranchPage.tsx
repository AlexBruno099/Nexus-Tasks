import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  Check,
  ChevronDown,
  Flag,
  FolderGit2,
  GitBranch,
  GitMerge,
  Lock,
  LockOpen,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { LIMITS } from '../../../shared/config/limits';
import { useAutosave } from '../../../shared/hooks/useAutosave';
import type { Branch, BranchPatch, Column, Label, Task } from '../../../shared/types';
import { dueState, formatDue } from '../../../shared/utils';
import { columnColor } from '../utils';

interface Props {
  branch: Branch;
  /** Todas as tasks da branch; `visible` diz quais passam pela busca e pelas etiquetas do topo. */
  tasks: Task[];
  visible: Set<number>;
  columns: Column[];
  labelsById: Map<number, Label>;
  freshId: number | null;
  quickAddSignal: number;
  quickAddHint: string | null;
  onBack: () => void;
  onUpdate: (patch: BranchPatch) => void;
  onDelete: () => void;
  onOpenTask: (id: number) => void;
  onQuickAdd: (raw: string) => Promise<boolean>;
  onMoveTo: (taskId: number, columnId: number) => void;
}

/** Página própria da branch: capa na cor dela, anotações, números por coluna e as tasks agrupadas por status. */
export function BranchPage(props: Props) {
  const { branch, tasks, visible, columns, labelsById } = props;
  const [name, setName] = useState(branch.name);
  const [notes, setNotes] = useState(branch.notes);
  const [color, setColor] = useState(branch.color);
  const [confirm, setConfirm] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  useEffect(() => setName(branch.name), [branch.name]);
  useEffect(() => setNotes(branch.notes), [branch.notes]);
  useEffect(() => setColor(branch.color), [branch.color]);

  // O seletor de cor dispara a cada movimento; grava só quando a escolha assenta.
  const { onUpdate } = props;
  const colorSave = useAutosave(color, branch.color, (value) => onUpdate({ color: value }), 400);

  const commitName = () => {
    const trimmed = name.trim();
    if (!trimmed) return setName(branch.name);
    if (trimmed !== branch.name) onUpdate({ name: trimmed });
  };
  const commitNotes = () => notes !== branch.notes && onUpdate({ notes });

  const columnsById = new Map(columns.map((c) => [c.id, c]));
  const isDone = (t: Task) => !!columnsById.get(t.columnId)?.isDone;
  const overdue = tasks.filter((t) => dueState(t.dueDate, isDone(t)) === 'overdue').length;
  const done = tasks.filter(isDone).length;
  const firstOpen = columns.find((c) => !c.isDone);
  const firstDone = columns.find((c) => c.isDone);

  // Pendentes primeiro, na ordem das colunas; as de concluído por último.
  const groupOrder = [...columns.filter((c) => !c.isDone), ...columns.filter((c) => c.isDone)];
  const shownTasks = tasks.filter((t) => visible.has(t.id));
  const groups = groupOrder
    .map((col) => ({
      col,
      items: shownTasks
        .filter((t) => t.columnId === col.id)
        .sort((a, b) => a.position - b.position || a.id - b.id),
    }))
    .filter((g) => g.items.length > 0);

  const toggleGroup = (id: number) =>
    setCollapsed((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <div className="bpage" style={{ '--branch': color } as CSSProperties}>
      <div className="bpage-inner">
        <button className="link-btn bpage-back" onClick={props.onBack}>
          <ArrowLeft size={14} aria-hidden /> Branches
        </button>

        <motion.header
          className="bpage-hero"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        >
          <div className="bpage-hero-top">
            <label className="bpage-color" title="Cor da branch">
              {branch.merged ? <GitMerge size={15} aria-hidden /> : <GitBranch size={15} aria-hidden />}
              {!branch.locked && (
                <input
                  type="color"
                  value={color}
                  aria-label="Cor da branch"
                  onChange={(e) => setColor(e.target.value.toUpperCase())}
                />
              )}
            </label>
            <div className="bpage-title">
              <p className="bpage-repo">
                <FolderGit2 size={13} aria-hidden /> {branch.repo}
                {branch.merged && !branch.locked && <span className="merged-badge">mergeada</span>}
                {branch.locked && (
                  <span className="locked-badge">
                    <Lock size={11} aria-hidden /> trancada
                  </span>
                )}
              </p>
              <input
                className="bpage-name"
                value={name}
                aria-label="Nome da branch"
                maxLength={LIMITS.branchName}
                readOnly={branch.locked}
                spellCheck={false}
                onChange={(e) => setName(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              />
            </div>
            <div className="bpage-actions">
              <button
                className={`icon-btn ghost${branch.locked ? ' is-on' : ''}`}
                onClick={() => {
                  colorSave.flush();
                  onUpdate({ locked: !branch.locked });
                }}
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
                  onClick={() => {
                    colorSave.cancel();
                    props.onDelete();
                  }}
                >
                  {tasks.length
                    ? `Soltar ${tasks.length} task${tasks.length > 1 ? 's' : ''} e apagar`
                    : 'Apagar'}
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
          </div>

          {branch.locked && (
            <p className="bpage-locked">Mergeada e apagada do git. Nenhuma task entra ou sai desta branch.</p>
          )}
          {!(branch.locked && !notes.trim()) && (
            <textarea
              className="bpage-notes"
              readOnly={branch.locked}
              value={notes}
              rows={1}
              placeholder="Anotações: o que ela resolve, link do PR, cuidados no deploy…"
              aria-label="Anotações da branch"
              maxLength={LIMITS.branchNotes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={commitNotes}
            />
          )}
        </motion.header>

        <div className="bpage-progress">
          <div className="bpage-meter" role="img" aria-label={`${done} de ${tasks.length} tasks feitas`}>
            <motion.span
              initial={{ width: 0 }}
              animate={{ width: tasks.length ? `${(done / tasks.length) * 100}%` : 0 }}
              transition={{ type: 'spring', stiffness: 120, damping: 22 }}
            />
          </div>
          <p className="bpage-stats">
            <span>
              <strong>{done}</strong>/{tasks.length} feitas
            </span>
            {columns
              .filter((c) => !c.isDone)
              .map((c) => {
                const n = tasks.filter((t) => t.columnId === c.id).length;
                return (
                  n > 0 && (
                    <span key={c.id}>
                      {n} {c.name.toLowerCase()}
                    </span>
                  )
                );
              })}
            {overdue > 0 && (
              <span className="bpage-overdue">
                <AlertTriangle size={12} aria-hidden /> {overdue} atrasada{overdue > 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>

        {!branch.locked && (
          <QuickAdd
            signal={props.quickAddSignal}
            hint={props.quickAddHint}
            target={firstOpen?.name}
            onAdd={props.onQuickAdd}
          />
        )}

        {shownTasks.length < tasks.length && (
          <p className="bpage-filtered">
            Mostrando {shownTasks.length} de {tasks.length}: a busca ou as etiquetas do topo estão filtrando.
          </p>
        )}

        {groups.length === 0 ? (
          <p className="bpage-empty">
            {tasks.length
              ? 'Nenhuma task desta branch passa pelos filtros.'
              : 'Nenhuma task nesta branch. Crie a primeira acima.'}
          </p>
        ) : (
          groups.map(({ col, items }) => {
            const open = !collapsed.has(col.id);
            return (
              <section key={col.id} className="bgroup">
                <button className="bgroup-head" aria-expanded={open} onClick={() => toggleGroup(col.id)}>
                  <ChevronDown size={15} className="bgroup-chevron" aria-hidden />
                  <i
                    className="dot"
                    style={{ '--c': columnColor(columns, col) } as CSSProperties}
                    aria-hidden
                  />
                  {col.name}
                  <span className="bgroup-count">{items.length}</span>
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.ul
                      className="brows"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <AnimatePresence initial={false}>
                        {items.map((t) => (
                          <TaskRow
                            key={t.id}
                            task={t}
                            done={col.isDone}
                            labels={t.labelIds.map((id) => labelsById.get(id)).filter((l): l is Label => !!l)}
                            fresh={t.id === props.freshId}
                            canToggle={!branch.locked && !!firstOpen && !!firstDone}
                            onOpen={() => props.onOpenTask(t.id)}
                            onToggle={() => props.onMoveTo(t.id, (col.isDone ? firstOpen : firstDone)!.id)}
                          />
                        ))}
                      </AnimatePresence>
                    </motion.ul>
                  )}
                </AnimatePresence>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}

function TaskRow({
  task,
  done,
  labels,
  fresh,
  canToggle,
  onOpen,
  onToggle,
}: {
  task: Task;
  done: boolean;
  labels: Label[];
  fresh: boolean;
  canToggle: boolean;
  onOpen: () => void;
  onToggle: () => void;
}) {
  const due = dueState(task.dueDate, done);
  const flagged = !done && (task.priority === 'alta' || task.priority === 'urgente');
  return (
    <motion.li
      layout
      className={`brow${done ? ' is-done' : ''}${fresh ? ' is-fresh' : ''}`}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
    >
      {canToggle && (
        <button
          className="brow-check"
          onClick={onToggle}
          aria-label={done ? `Reabrir ${task.title}` : `Concluir ${task.title}`}
          title={done ? 'Reabrir' : 'Concluir'}
        >
          {done && <Check size={11} strokeWidth={3} />}
        </button>
      )}
      <button className="brow-main" onClick={onOpen}>
        <span className="brow-title">{task.title}</span>
        <span className="brow-meta">
          {labels.length > 0 && (
            <span
              className="brow-dots"
              title={labels.map((l) => l.name).join(', ')}
              aria-label={`Etiquetas: ${labels.map((l) => l.name).join(', ')}`}
            >
              {labels.map((l) => (
                <i key={l.id} className="dot" style={{ '--c': l.color } as CSSProperties} />
              ))}
            </span>
          )}
          {task.dueDate && (
            <span className={`due due-${due ?? 'none'}`}>
              <CalendarClock size={12} aria-hidden /> {formatDue(task.dueDate)}
            </span>
          )}
          {flagged && (
            <Flag
              size={13}
              className={`brow-flag flag-${task.priority}`}
              aria-label={`Prioridade ${task.priority}`}
            />
          )}
        </span>
      </button>
    </motion.li>
  );
}

function QuickAdd({
  signal,
  hint,
  target,
  onAdd,
}: {
  signal: number;
  hint: string | null;
  target?: string;
  onAdd: (raw: string) => Promise<boolean>;
}) {
  const [value, setValue] = useState('');
  const submitting = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const firstSignal = useRef(signal);
  useEffect(() => {
    if (signal !== firstSignal.current) inputRef.current?.focus();
  }, [signal]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim() || submitting.current) return;
    submitting.current = true;
    setIsSubmitting(true);
    try {
      if (await onAdd(value)) setValue('');
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <form className="bpage-add" onSubmit={submit}>
      <Plus size={16} aria-hidden />
      <input
        ref={inputRef}
        value={value}
        placeholder="Nova task · #etiqueta"
        aria-label="Título da nova task"
        readOnly={isSubmitting}
        aria-busy={isSubmitting}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && (setValue(''), e.currentTarget.blur())}
      />
      {value.trim() && (
        <span className="bpage-add-hint">
          Enter cria em {target ?? 'A fazer'}
          {hint ? `, com ${hint}` : ''}
        </span>
      )}
    </form>
  );
}
