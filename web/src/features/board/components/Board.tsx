import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { LIMITS } from '../../../shared/config/limits';
import type { Branch, Column, Label, Order, Task } from '../../../shared/types';
import { buildOrder, isStaleDone } from '../../../shared/utils';
import { TaskCard } from '../../tasks/components/TaskCard';

interface Props {
  columns: Column[];
  tasks: Task[];
  labelsById: Map<number, Label>;
  branchOf: (task: Task) => Branch | undefined;
  visible: Set<number>;
  freshId: number | null;
  quickAddSignal: number;
  quickAddHint: string | null;
  onOpen: (id: number) => void;
  onMove: (taskId: number, columnId: number, index: number, order: Order) => void;
  onQuickAdd: (columnId: number, raw: string) => Promise<boolean>;
  onRenameColumn: (id: number, name: string) => void;
  onDeleteColumn: (id: number) => void;
  onAddColumn: (name: string) => void;
}

const taskKey = (id: number) => `t-${id}`;
const colKey = (id: number) => `c-${id}`;
const parseKey = (key: string | number) => Number(String(key).slice(2));

// O que está sob o ponteiro manda; sem ponteiro (teclado), vale o canto mais próximo.
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  if (!hits.length) return closestCorners(args);
  const tasks = hits.filter((c) => String(c.id).startsWith('t-'));
  return tasks.length ? tasks : hits;
};

export function Board(props: Props) {
  const { columns, tasks, labelsById, visible } = props;
  const [order, setOrder] = useState<Order>(() => buildOrder(columns, tasks));
  const [activeId, setActiveId] = useState<number | null>(null);
  const orderRef = useRef(order);
  orderRef.current = order;

  useEffect(() => {
    if (activeId === null) setOrder(buildOrder(columns, tasks));
  }, [columns, tasks, activeId]);

  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
    }),
  );

  const containerOf = (key: string | number, o: Order = orderRef.current) => {
    const k = String(key);
    if (k.startsWith('c-')) return parseKey(k);
    const id = parseKey(k);
    const found = Object.entries(o).find(([, ids]) => ids.includes(id));
    return found ? Number(found[0]) : null;
  };

  const handleStart = ({ active }: DragStartEvent) => setActiveId(parseKey(active.id));

  const handleOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const from = containerOf(active.id);
    const to = containerOf(over.id);
    if (from === null || to === null || from === to) return;
    const id = parseKey(active.id);
    setOrder((prev) => {
      const dst = prev[to].filter((x) => x !== id);
      let index = dst.length;
      if (String(over.id).startsWith('t-')) {
        const overIndex = dst.indexOf(parseKey(over.id));
        const activeTop = active.rect.current.translated?.top ?? 0;
        const below = activeTop > over.rect.top + over.rect.height / 2;
        if (overIndex >= 0) index = overIndex + (below ? 1 : 0);
      }
      dst.splice(index, 0, id);
      return { ...prev, [from]: prev[from].filter((x) => x !== id), [to]: dst };
    });
  };

  const handleEnd = ({ active, over }: DragEndEvent) => {
    const id = parseKey(active.id);
    let next = orderRef.current;
    const col = containerOf(active.id, next);
    if (
      col !== null &&
      over &&
      String(over.id).startsWith('t-') &&
      over.id !== active.id &&
      containerOf(over.id, next) === col
    ) {
      const ids = next[col];
      next = { ...next, [col]: arrayMove(ids, ids.indexOf(id), ids.indexOf(parseKey(over.id))) };
    }
    setActiveId(null);
    const task = tasksById.get(id);
    if (col === null || !task) return;
    const index = next[col].indexOf(id);
    const before = buildOrder(columns, tasks);
    if (task.columnId === col && before[col].indexOf(id) === index) return;
    props.onMove(id, col, index, next);
  };

  const active = activeId !== null ? tasksById.get(activeId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={handleStart}
      onDragOver={handleOver}
      onDragEnd={handleEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="board">
        {columns.map((column, i) => (
          <BoardColumn
            key={column.id}
            column={column}
            ids={(order[column.id] ?? []).filter((id) => visible.has(id) || id === activeId)}
            total={(order[column.id] ?? []).length}
            filtering={visible.size < tasks.length}
            activeId={activeId}
            tasksById={tasksById}
            labelsById={labelsById}
            branchOf={props.branchOf}
            freshId={props.freshId}
            focusSignal={i === 0 ? props.quickAddSignal : 0}
            hint={props.quickAddHint}
            onOpen={props.onOpen}
            onQuickAdd={(raw) => props.onQuickAdd(column.id, raw)}
            onRename={(name) => props.onRenameColumn(column.id, name)}
            onDelete={() => props.onDeleteColumn(column.id)}
          />
        ))}
        <AddColumn onAdd={props.onAddColumn} />
      </div>

      <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' }}>
        {active && (
          <TaskCard
            task={active}
            labels={active.labelIds.map((l) => labelsById.get(l)).filter((l): l is Label => !!l)}
            done={!!columns.find((c) => c.id === containerOf(taskKey(active.id)))?.isDone}
            branch={props.branchOf(active)}
            lifted
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}

interface ColumnProps {
  column: Column;
  ids: number[];
  total: number;
  filtering: boolean;
  activeId: number | null;
  tasksById: Map<number, Task>;
  labelsById: Map<number, Label>;
  branchOf: (task: Task) => Branch | undefined;
  freshId: number | null;
  focusSignal: number;
  hint: string | null;
  onOpen: (id: number) => void;
  onQuickAdd: (raw: string) => Promise<boolean>;
  onRename: (name: string) => void;
  onDelete: () => void;
}

function BoardColumn({
  column,
  ids: matching,
  total,
  filtering,
  activeId,
  tasksById,
  labelsById,
  branchOf,
  freshId,
  focusSignal,
  hint,
  onOpen,
  onQuickAdd,
  onRename,
  onDelete,
}: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: colKey(column.id) });
  const [showStale, setShowStale] = useState(false);
  // Com busca ou filtro ativo, nada fica recolhido: a task procurada tem que aparecer.
  const collapsible = column.isDone && !filtering;
  const now = Date.now();
  const staleCount = collapsible ? matching.filter((id) => isStaleDone(tasksById.get(id), now)).length : 0;
  const ids =
    staleCount && !showStale
      ? matching.filter((id) => id === activeId || !isStaleDone(tasksById.get(id), now))
      : matching;
  const [name, setName] = useState(column.name);
  useEffect(() => setName(column.name), [column.name]);

  const commitName = () => {
    const trimmed = name.trim();
    if (!trimmed) return setName(column.name);
    if (trimmed !== column.name) onRename(trimmed);
  };

  return (
    <section
      className={`column${column.isDone ? ' column-done' : ''}${isOver ? ' column-over' : ''}`}
      aria-label={column.name}
    >
      <header className="column-head">
        <input
          className="column-name"
          value={name}
          aria-label="Nome da coluna"
          maxLength={LIMITS.columnName}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        <span className="column-count">{ids.length === total ? total : `${ids.length}/${total}`}</span>
        {total === 0 && (
          <button
            className="icon-btn ghost"
            onClick={onDelete}
            aria-label={`Apagar coluna ${column.name}`}
            title="Apagar coluna vazia"
          >
            <Trash2 size={14} />
          </button>
        )}
      </header>
      <div ref={setNodeRef} className="column-body">
        <SortableContext items={ids.map(taskKey)} strategy={verticalListSortingStrategy}>
          {ids.map((id) => {
            const task = tasksById.get(id);
            if (!task) return null;
            return (
              <SortableCard
                key={id}
                task={task}
                labels={task.labelIds.map((l) => labelsById.get(l)).filter((l): l is Label => !!l)}
                done={column.isDone}
                branch={branchOf(task)}
                fresh={id === freshId}
                onOpen={() => onOpen(id)}
              />
            );
          })}
        </SortableContext>
        {ids.length === 0 && !staleCount && (
          <p className="column-empty">
            {total ? 'Nenhuma task com esses filtros' : 'Arraste uma task para cá'}
          </p>
        )}
        {staleCount > 0 && (
          <button className="column-stale" onClick={() => setShowStale((v) => !v)}>
            {showStale
              ? 'Recolher as concluídas há mais de 7 dias'
              : `${staleCount} concluída${staleCount > 1 ? 's' : ''} há mais de 7 dias · mostrar`}
          </button>
        )}
      </div>
      <QuickAdd onAdd={onQuickAdd} focusSignal={focusSignal} hint={hint} />
    </section>
  );
}

function SortableCard({
  task,
  labels,
  done,
  branch,
  fresh,
  onOpen,
}: {
  task: Task;
  labels: Label[];
  done: boolean;
  branch?: Branch;
  fresh: boolean;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: taskKey(task.id),
  });
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !isDragging) return onOpen();
    listeners?.onKeyDown?.(e);
  };
  return (
    <div
      ref={setNodeRef}
      className={`card-shell${isDragging ? ' is-ghost' : ''}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      aria-roledescription="task arrastável"
      aria-label={task.title}
      onKeyDown={onKeyDown}
      onClick={onOpen}
    >
      <TaskCard task={task} labels={labels} done={done} branch={branch} fresh={fresh} />
    </div>
  );
}

function QuickAdd({
  onAdd,
  focusSignal,
  hint,
}: {
  onAdd: (raw: string) => Promise<boolean>;
  focusSignal: number;
  hint: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (focusSignal) setOpen(true);
  }, [focusSignal]);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open, focusSignal]);

  const submit = async () => {
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

  if (!open) {
    return (
      <button className="quick-add-btn" onClick={() => setOpen(true)}>
        <Plus size={15} /> Nova task
      </button>
    );
  }
  return (
    <div className="quick-add">
      <input
        ref={inputRef}
        value={value}
        placeholder="Título · #stone etiqueta"
        aria-label="Título da nova task"
        readOnly={isSubmitting}
        aria-busy={isSubmitting}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') {
            setValue('');
            setOpen(false);
          }
        }}
        onBlur={() => !value.trim() && setOpen(false)}
      />
      {hint && <p className="quick-add-hint">Entra com {hint}</p>}
    </div>
  );
}

function AddColumn({ onAdd }: { onAdd: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const committed = useRef(false);
  const commit = () => {
    if (committed.current) return;
    committed.current = true;
    if (name.trim()) onAdd(name.trim());
    setName('');
    setEditing(false);
  };
  return (
    <div className="add-column">
      {editing ? (
        <input
          autoFocus
          value={name}
          placeholder="Nome da coluna"
          aria-label="Nome da nova coluna"
          maxLength={LIMITS.columnName}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              committed.current = true;
              setName('');
              setEditing(false);
            }
          }}
        />
      ) : (
        <button
          className="quick-add-btn"
          onClick={() => {
            committed.current = false;
            setEditing(true);
          }}
        >
          <Plus size={15} /> Coluna
        </button>
      )}
    </div>
  );
}
