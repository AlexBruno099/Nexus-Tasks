import { Archive, Plus, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { LIMITS } from '../../../shared/config/limits';
import { useAutosave } from '../../../shared/hooks/useAutosave';
import { useDialog } from '../../../shared/hooks/useDialog';
import type { Branch, Column, Label, Task, TaskPatch } from '../../../shared/types';
import { PRIORITIES, formatDateTime, groupBranches, newId, taskCode } from '../../../shared/utils';
import { LabelList } from '../../labels/components/LabelList';

interface Props {
  task: Task;
  columns: Column[];
  labels: Label[];
  branches: Branch[];
  onClose: () => void;
  onPatch: (patch: TaskPatch) => void;
  onMoveTo: (columnId: number) => void;
  onArchive: () => void;
  onDelete: () => void;
}

export function TaskModal({
  task,
  columns,
  labels,
  branches,
  onClose,
  onPatch,
  onMoveTo,
  onArchive,
  onDelete,
}: Props) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [newItem, setNewItem] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const currentLocked = !!branches.find((b) => b.id === task.branchId)?.locked;
  const [pickerOpen, setPickerOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const titleSave = useAutosave(title, task.title, (v) => {
    if (v.trim()) onPatch({ title: v.trim() });
  });
  const descriptionSave = useAutosave(description, task.description, (v) => onPatch({ description: v }));
  useDialog(panelRef, () => {
    if (pickerOpen) setPickerOpen(false);
    else onClose();
  });

  useEffect(() => {
    const onDown = (e: MouseEvent) =>
      pickerOpen && !pickerRef.current?.contains(e.target as Node) && setPickerOpen(false);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
    };
  }, [pickerOpen]);

  const toggleLabel = (id: number) =>
    onPatch({
      labelIds: task.labelIds.includes(id) ? task.labelIds.filter((x) => x !== id) : [...task.labelIds, id],
    });

  const setChecklist = (checklist: Task['checklist']) => onPatch({ checklist });
  const addItem = () => {
    if (!newItem.trim() || task.checklist.length >= LIMITS.checklistItems) return;
    setChecklist([...task.checklist, { id: newId(), text: newItem.trim(), done: false }]);
    setNewItem('');
  };

  const done = task.checklist.filter((i) => i.done).length;
  const column = columns.find((c) => c.id === task.columnId);
  const selected = labels.filter((l) => task.labelIds.includes(l.id));

  return (
    <motion.div
      className="overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        ref={panelRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Task ${taskCode(task.id)}`}
        tabIndex={-1}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.15 } }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      >
        <header className="modal-head">
          <span className="code">{taskCode(task.id)}</span>
          <select
            className="select"
            value={task.columnId}
            aria-label="Coluna"
            onChange={(e) => onMoveTo(Number(e.target.value))}
          >
            {columns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button className="icon-btn ghost" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        <textarea
          className="modal-title"
          value={title}
          rows={1}
          aria-label="Título"
          maxLength={LIMITS.taskTitle}
          onChange={(e) => setTitle(e.target.value.replace(/\n/g, ' '))}
          onBlur={() => !title.trim() && setTitle(task.title)}
        />

        <dl className="props">
          <dt>Prioridade</dt>
          <dd>
            <div className="segmented" role="radiogroup" aria-label="Prioridade">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  role="radio"
                  aria-checked={task.priority === p.value}
                  className={`seg seg-${p.value}${task.priority === p.value ? ' on' : ''}`}
                  onClick={() => onPatch({ priority: p.value })}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </dd>

          <dt>Prazo</dt>
          <dd className="date-row">
            <input
              type="date"
              className="input"
              value={task.dueDate ?? ''}
              aria-label="Prazo"
              onChange={(e) => onPatch({ dueDate: e.target.value || null })}
            />
            {task.dueDate && (
              <button
                className="icon-btn ghost"
                onClick={() => onPatch({ dueDate: null })}
                aria-label="Tirar prazo"
              >
                <X size={14} />
              </button>
            )}
          </dd>

          <dt>Branch</dt>
          <dd>
            <select
              className="select select-branch"
              value={task.branchId ?? ''}
              aria-label="Branch"
              disabled={currentLocked}
              title={currentLocked ? 'Branch trancada: a task não sai dela' : undefined}
              onChange={(e) => onPatch({ branchId: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">Sem branch</option>
              {groupBranches(branches).map(([repo, items]) => (
                <optgroup key={repo} label={repo}>
                  {items.map((b) => (
                    <option key={b.id} value={b.id} disabled={b.locked && b.id !== task.branchId}>
                      {b.name}
                      {b.locked ? ' (trancada)' : b.merged ? ' (mergeada)' : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </dd>

          <dt>Etiquetas</dt>
          <dd>
            <div className="tags tags-edit">
              {selected.map((l) => (
                <button
                  key={l.id}
                  className="tag tag-btn"
                  onClick={() => toggleLabel(l.id)}
                  aria-label={`Tirar ${l.name}`}
                >
                  <i className="dot" style={{ '--c': l.color } as CSSProperties} aria-hidden />
                  {l.name}
                  <X size={11} aria-hidden />
                </button>
              ))}
              <div className="picker" ref={pickerRef}>
                <button
                  className="tag tag-add"
                  aria-expanded={pickerOpen}
                  onClick={() => setPickerOpen((o) => !o)}
                >
                  <Plus size={12} aria-hidden /> Etiqueta
                </button>
                <AnimatePresence>
                  {pickerOpen && (
                    <motion.div
                      className="popover popover-left"
                      role="menu"
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.16 }}
                    >
                      <LabelList labels={labels} selected={task.labelIds} onToggle={toggleLabel} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </dd>
        </dl>

        <section className="section">
          <h4>Descrição</h4>
          <textarea
            className="input modal-desc"
            maxLength={LIMITS.description}
            aria-label="Descrição"
            value={description}
            rows={4}
            placeholder="Contexto, passos para reproduzir, cliente, número de série da maquininha…"
            onChange={(e) => setDescription(e.target.value)}
          />
        </section>

        <section className="section">
          <h4>
            Checklist{' '}
            {task.checklist.length > 0 && (
              <span className="muted">
                {done}/{task.checklist.length}
              </span>
            )}
          </h4>
          {task.checklist.length > 0 && (
            <div className="progress" aria-hidden>
              <motion.span animate={{ width: `${(done / task.checklist.length) * 100}%` }} />
            </div>
          )}
          <ul className="checklist">
            {task.checklist.map((item) => (
              <li key={item.id} className={item.done ? 'done' : undefined}>
                <label>
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() =>
                      setChecklist(
                        task.checklist.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)),
                      )
                    }
                  />
                  <span>{item.text}</span>
                </label>
                <button
                  className="icon-btn ghost"
                  aria-label={`Remover ${item.text}`}
                  onClick={() => setChecklist(task.checklist.filter((i) => i.id !== item.id))}
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
          <input
            className="input"
            value={newItem}
            placeholder="Adicionar item e Enter"
            aria-label="Novo item da checklist"
            maxLength={LIMITS.checklistText}
            disabled={task.checklist.length >= LIMITS.checklistItems}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addItem()}
          />
        </section>

        <footer className="modal-foot">
          <p className="stamp-line">
            Criada {formatDateTime(task.createdAt)}
            {task.completedAt && column?.isDone && <> · concluída {formatDateTime(task.completedAt)}</>}
          </p>
          <div className="modal-actions">
            <button
              className="btn"
              onClick={() => {
                titleSave.flush();
                descriptionSave.flush();
                onArchive();
              }}
            >
              <Archive size={15} /> Arquivar
            </button>
            {confirmDelete ? (
              <button
                className="btn btn-danger"
                disabled={currentLocked}
                onClick={() => {
                  titleSave.cancel();
                  descriptionSave.cancel();
                  onDelete();
                }}
                onBlur={() => setConfirmDelete(false)}
                autoFocus
              >
                <Trash2 size={15} /> Confirmar exclusão
              </button>
            ) : (
              <button
                className="btn btn-ghost-danger"
                disabled={currentLocked}
                title={currentLocked ? 'Destranque a branch para apagar esta task' : undefined}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={15} /> Apagar
              </button>
            )}
          </div>
        </footer>
      </motion.div>
    </motion.div>
  );
}
