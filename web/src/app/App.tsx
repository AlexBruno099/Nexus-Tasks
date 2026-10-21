import { RotateCw, X } from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Board } from '../features/board/components/Board';
import { ListView } from '../features/board/components/ListView';
import { BranchesView } from '../features/branches/components/BranchesView';
import { BranchPage } from '../features/branches/components/BranchPage';
import { LabelManager } from '../features/labels/components/LabelManager';
import { ArchiveView } from '../features/tasks/components/ArchiveView';
import { TaskModal } from '../features/tasks/components/TaskModal';
import { LIMITS } from '../shared/config/limits';
import { useToasts } from '../shared/hooks/useToasts';
import type { Branch, BranchPatch, Filters, Label, Task } from '../shared/types';
import { NO_FILTERS, buildOrder, dueState, matchesFilters, parseQuickTitle, taskCode } from '../shared/utils';
import { Topbar, type View } from './components/Topbar';
import { useWorkspace } from './hooks/useWorkspace';

/** Subpágina da branch aberta, guardada em `#/branches/<id>` para o voltar do navegador funcionar. */
function readBranchHash() {
  const m = location.hash.match(/^#\/branches\/(\d+)$/);
  return m ? Number(m[1]) : null;
}

function readView(): View {
  if (readBranchHash() !== null) return 'branches';
  try {
    const v = localStorage.getItem('bobina:view');
    return v === 'lista' || v === 'branches' || v === 'arquivo' ? v : 'quadro';
  } catch {
    return 'quadro';
  }
}

export default function App() {
  const { toasts, notify, dismiss } = useToasts();
  const data = useWorkspace(notify);
  const { board, loadError, isRefreshing, isSaving, refresh: load } = data;
  const [view, setView] = useState<View>(readView);
  const [branchPage, setBranchPage] = useState<number | null>(readBranchHash);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [openId, setOpenId] = useState<number | null>(null);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [freshId, setFreshId] = useState<number | null>(null);
  const [quickAddSignal, setQuickAddSignal] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem('bobina:view', view);
    } catch {
      /* armazenamento indisponível */
    }
  }, [view]);

  useEffect(() => {
    const onPop = () => {
      const id = readBranchHash();
      setBranchPage(id);
      if (id !== null) setView('branches');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const openBranch = (id: number) => {
    history.pushState(null, '', `#/branches/${id}`);
    setBranchPage(id);
    setView('branches');
  };
  const closeBranch = useCallback(() => {
    if (readBranchHash() !== null) history.pushState(null, '', location.pathname + location.search);
    setBranchPage(null);
  }, []);
  const goView = useCallback(
    (v: View) => {
      closeBranch();
      setView(v);
    },
    [closeBranch],
  );
  const pageBranchId = view === 'branches' ? branchPage : null;

  // Link para uma branch apagada ou trancada: volta para a lista sem deixar o hash morto no histórico.
  useEffect(() => {
    if (!board || branchPage === null || board.branches.some((b) => b.id === branchPage && !b.locked)) return;
    history.replaceState(null, '', location.pathname + location.search);
    setBranchPage(null);
  }, [board, branchPage]);

  const {
    updateTask,
    moveTask,
    updateLabel,
    renameColumn,
    createColumn: addColumn,
    deleteColumn,
    updateBranch,
  } = data;

  const moveToColumn = (taskId: number, columnId: number) => {
    if (!board) return;
    const order = buildOrder(board.columns, board.tasks);
    if (!order[columnId]) return;
    for (const col of Object.keys(order))
      order[Number(col)] = order[Number(col)].filter((id) => id !== taskId);
    order[columnId].push(taskId);
    void moveTask(taskId, columnId, order[columnId].length - 1, order);
  };

  const archiveTask = async (id: number) => {
    setOpenId(null);
    if (await data.archiveTask(id))
      notify(`${taskCode(id)} arquivada.`, {
        label: 'Desfazer',
        run: () => {
          void data.restoreTask(id);
        },
      });
  };

  const deleteTask = async (id: number) => {
    const task = board?.tasks.find((t) => t.id === id);
    if (board?.branches.some((b) => b.id === task?.branchId && b.locked)) {
      notify('Destranque a branch para apagar esta task.');
      return;
    }
    setOpenId(null);
    if (await data.deleteTask(id)) notify(`${taskCode(id)} apagada.`);
  };

  const quickAdd = async (columnId: number | undefined, raw: string) => {
    if (!board || columnId === undefined) {
      notify('Crie uma coluna antes de adicionar uma task.');
      return false;
    }
    const { title, labelIds } = parseQuickTitle(raw, board.labels);
    if (!title || title.length > LIMITS.taskTitle) {
      notify(
        !title
          ? 'Escreva um título além das etiquetas.'
          : `O título pode ter até ${LIMITS.taskTitle} caracteres.`,
      );
      return false;
    }
    const task = await data.createTask({
      title,
      columnId,
      labelIds: [...new Set([...filters.labelIds, ...labelIds])],
      branchId: pageBranchId ?? filters.branchId,
    });
    if (task) setFreshId(task.id);
    return !!task;
  };

  const createLabel = async (label: Pick<Label, 'name' | 'color' | 'grp'>) =>
    !!(await data.createLabel(label));
  const createBranch = async (branch: Pick<Branch, 'repo' | 'name'>) => !!(await data.createBranch(branch));
  const deleteLabel = (id: number) => {
    void data.deleteLabel(id);
    setFilters((f) => ({ ...f, labelIds: f.labelIds.filter((labelId) => labelId !== id) }));
  };
  const deleteBranch = (id: number) => {
    if (board?.branches.some((b) => b.id === id && b.locked)) {
      notify('Destranque a branch para apagá-la.');
      return;
    }
    void data.deleteBranch(id);
    setFilters((f) => (f.branchId === id ? { ...f, branchId: null } : f));
    if (branchPage === id) closeBranch();
  };

  const updateBranchRef = useRef(updateBranch);
  updateBranchRef.current = updateBranch;
  const updatePageBranch = useCallback(
    (patch: BranchPatch) => {
      if (branchPage !== null) void updateBranchRef.current(branchPage, patch);
    },
    [branchPage],
  );

  // Na subpágina da branch, a task nova entra no quadro dela; fora, no quadro geral.
  const newTask = useCallback(() => {
    if (pageBranchId === null) goView('quadro');
    setQuickAddSignal((s) => s + 1);
  }, [pageBranchId, goView]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [contenteditable]') || openId !== null || labelsOpen) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        newTask();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openId, labelsOpen, newTask]);

  const derived = useMemo(() => {
    if (!board) return null;
    const labelsById = new Map(board.labels.map((l) => [l.id, l]));
    const branchesById = new Map(board.branches.map((b) => [b.id, b]));
    const columnsById = new Map(board.columns.map((c) => [c.id, c]));
    const pageBranch = pageBranchId !== null ? branchesById.get(pageBranchId) : undefined;
    // Na subpágina, a branch da página manda no lugar do filtro de branch do quadro geral.
    const scoped = pageBranch ? { ...filters, branchId: pageBranch.id } : filters;
    const visibleTasks = board.tasks.filter((t) => matchesFilters(t, scoped, labelsById, columnsById));
    const counts = new Map<number, number>();
    const branchCounts = new Map<number, number>();
    for (const t of board.tasks) {
      for (const id of t.labelIds) counts.set(id, (counts.get(id) ?? 0) + 1);
      if (t.branchId !== null) branchCounts.set(t.branchId, (branchCounts.get(t.branchId) ?? 0) + 1);
    }
    const isDone = (t: Task) => !!columnsById.get(t.columnId)?.isDone;
    return {
      labelsById,
      branchesById,
      branchCounts,
      pageBranch,
      pageTasks: pageBranch ? board.tasks.filter((t) => t.branchId === pageBranch.id) : [],
      visibleTasks,
      visible: new Set(visibleTasks.map((t) => t.id)),
      counts,
      totals: {
        overdue: board.tasks.filter((t) => dueState(t.dueDate, isDone(t)) === 'overdue').length,
        today: board.tasks.filter((t) => dueState(t.dueDate, isDone(t)) === 'today').length,
      },
    };
  }, [board, filters, pageBranchId]);

  if (!board || !derived) {
    return (
      <div className="splash">
        {loadError ? (
          <div className="splash-card">
            <h1>Sem conexão com a API</h1>
            <p>{loadError}</p>
            <p className="muted">Verifique a conexão e tente novamente.</p>
            <button className="btn btn-primary" onClick={load} disabled={isRefreshing}>
              <RotateCw size={15} /> Tentar de novo
            </button>
          </div>
        ) : (
          <div className="splash-roll" aria-label="Carregando" />
        )}
      </div>
    );
  }

  const openTask = openId !== null ? board.tasks.find((t) => t.id === openId) : undefined;
  const { pageBranch } = derived;
  const filterBranch =
    pageBranch ?? (filters.branchId !== null ? derived.branchesById.get(filters.branchId) : undefined);
  const labelNames = filters.labelIds
    .map((id) => derived.labelsById.get(id)?.name)
    .filter(Boolean) as string[];
  const filterNames = [...(filterBranch ? [`a branch ${filterBranch.name}`] : []), ...labelNames];
  // Com o quadro filtrado por uma branch (ou na página dela), repetir o nome em todo card só polui.
  const branchOf = (t: Task) =>
    filterBranch || t.branchId === null ? undefined : derived.branchesById.get(t.branchId);

  return (
    <MotionConfig reducedMotion="user">
      <div className="app">
        <Topbar
          view={view}
          onView={goView}
          filters={pageBranch ? { ...filters, branchId: null } : filters}
          onFilters={setFilters}
          labels={board.labels}
          labelsById={derived.labelsById}
          branches={board.branches}
          branchCounts={derived.branchCounts}
          showBranchFilter={!pageBranch}
          counts={derived.counts}
          summary={{
            visible: derived.visibleTasks.length,
            total: board.tasks.length,
            overdue: derived.totals.overdue,
            today: derived.totals.today,
          }}
          searchRef={searchRef}
          onManageLabels={() => setLabelsOpen(true)}
          onNewTask={newTask}
          onRefresh={load}
          refreshing={isRefreshing || isSaving}
        />

        {loadError ? (
          <div className="sync-status sync-error" role="alert">
            <span>{loadError}</span>
            <button className="btn btn-sm" onClick={load} disabled={isRefreshing || isSaving}>
              Tentar novamente
            </button>
          </div>
        ) : isSaving ? (
          <p className="sync-status" role="status">
            Salvando alterações…
          </p>
        ) : null}

        <main className="main">
          {view === 'quadro' && (
            <Board
              columns={board.columns}
              tasks={board.tasks}
              labelsById={derived.labelsById}
              branchOf={branchOf}
              visible={derived.visible}
              freshId={freshId}
              quickAddSignal={quickAddSignal}
              quickAddHint={filterNames.length ? filterNames.join(', ') : null}
              onOpen={setOpenId}
              onMove={moveTask}
              onQuickAdd={quickAdd}
              onRenameColumn={renameColumn}
              onDeleteColumn={deleteColumn}
              onAddColumn={addColumn}
            />
          )}
          {view === 'lista' && (
            <ListView
              tasks={derived.visibleTasks}
              columns={board.columns}
              labelsById={derived.labelsById}
              branchesById={derived.branchesById}
              onOpen={setOpenId}
            />
          )}
          {view === 'branches' && pageBranch && (
            <BranchPage
              key={pageBranch.id}
              branch={pageBranch}
              tasks={derived.pageTasks}
              visible={derived.visible}
              columns={board.columns}
              labelsById={derived.labelsById}
              freshId={freshId}
              quickAddSignal={quickAddSignal}
              quickAddHint={labelNames.length ? labelNames.join(', ') : null}
              onBack={closeBranch}
              onUpdate={updatePageBranch}
              onDelete={() => deleteBranch(pageBranch.id)}
              onOpenTask={setOpenId}
              onQuickAdd={(raw) =>
                quickAdd(board.columns.find((c) => !c.isDone)?.id ?? board.columns[0]?.id, raw)
              }
              onMoveTo={moveToColumn}
            />
          )}
          {view === 'branches' && !pageBranch && (
            <BranchesView
              branches={board.branches}
              tasks={board.tasks}
              columns={board.columns}
              onCreate={createBranch}
              onUpdate={updateBranch}
              onDelete={deleteBranch}
              onOpenBranch={openBranch}
              onOpenTask={setOpenId}
            />
          )}
          {view === 'arquivo' && (
            <ArchiveView
              labelsById={derived.labelsById}
              branches={board.branches}
              revision={data.revision}
              onRestore={data.restoreTask}
              onDelete={data.deleteTask}
              notify={notify}
            />
          )}
        </main>
      </div>

      <AnimatePresence>
        {openTask && (
          <TaskModal
            key={openTask.id}
            task={openTask}
            columns={board.columns}
            labels={board.labels}
            branches={board.branches}
            onClose={() => setOpenId(null)}
            onPatch={(patch) => updateTask(openTask.id, patch)}
            onMoveTo={(col) => moveToColumn(openTask.id, col)}
            onArchive={() => archiveTask(openTask.id)}
            onDelete={() => deleteTask(openTask.id)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {labelsOpen && (
          <LabelManager
            labels={board.labels}
            usage={derived.counts}
            onClose={() => setLabelsOpen(false)}
            onCreate={createLabel}
            onUpdate={updateLabel}
            onDelete={deleteLabel}
          />
        )}
      </AnimatePresence>

      <div className="toasts" role="status" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              className="toast"
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40 }}
            >
              <span>{t.text}</span>
              {t.action && (
                <button
                  className="link-btn"
                  onClick={() => {
                    t.action!.run();
                    dismiss(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              )}
              <button className="icon-btn ghost" aria-label="Fechar aviso" onClick={() => dismiss(t.id)}>
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
