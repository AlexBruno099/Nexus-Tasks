import {
  Archive,
  Check,
  GitBranch,
  KanbanSquare,
  List,
  ListFilter,
  Plus,
  RotateCw,
  Search,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { LabelList } from '../../features/labels/components/LabelList';
import type { Branch, Filters, Label } from '../../shared/types';
import { NO_FILTERS, groupBranches } from '../../shared/utils';

export type View = 'quadro' | 'lista' | 'branches' | 'arquivo';

interface Props {
  view: View;
  onView: (v: View) => void;
  filters: Filters;
  onFilters: (f: Filters) => void;
  labelsById: Map<number, Label>;
  labels: Label[];
  branches: Branch[];
  branchCounts: Map<number, number>;
  /** Na subpágina da branch o quadro já é dela; escolher outra branch no menu não faria sentido. */
  showBranchFilter?: boolean;
  counts: Map<number, number>;
  summary: { visible: number; total: number; overdue: number; today: number };
  searchRef: RefObject<HTMLInputElement>;
  onManageLabels: () => void;
  onNewTask: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}

const VIEWS: { id: View; label: string; Icon: typeof List }[] = [
  { id: 'quadro', label: 'Quadro', Icon: KanbanSquare },
  { id: 'lista', label: 'Lista', Icon: List },
  { id: 'branches', label: 'Branches', Icon: GitBranch },
  { id: 'arquivo', label: 'Arquivo', Icon: Archive },
];

export function Topbar(props: Props) {
  const { view, filters, onFilters, labelsById, summary } = props;
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!filterOpen) return;
    const onDown = (e: MouseEvent) => !filterRef.current?.contains(e.target as Node) && setFilterOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFilterOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [filterOpen]);

  const toggleLabel = (id: number) =>
    onFilters({
      ...filters,
      labelIds: filters.labelIds.includes(id)
        ? filters.labelIds.filter((x) => x !== id)
        : [...filters.labelIds, id],
    });
  const activeCount =
    filters.labelIds.length + (filters.overdue ? 1 : 0) + (filters.branchId !== null ? 1 : 0);
  const hasFilters = activeCount > 0 || !!filters.q;
  const openBranches =
    props.showBranchFilter === false
      ? []
      : props.branches.filter((b) => !b.merged || b.id === filters.branchId);
  const activeBranch = props.branches.find((b) => b.id === filters.branchId);

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          <span className="hide-sm">nexus-tasks</span>
        </div>

        <nav className="tabs" aria-label="Visões">
          {VIEWS.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`tab${view === id ? ' on' : ''}`}
              aria-current={view === id}
              onClick={() => props.onView(id)}
            >
              {view === id && (
                <motion.span
                  layoutId="tab-pill"
                  className="tab-pill"
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                />
              )}
              <Icon size={15} aria-hidden />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="topbar-actions">
          <button
            className="icon-btn ghost"
            aria-label="Atualizar dados"
            title="Atualizar dados"
            disabled={props.refreshing}
            onClick={props.onRefresh}
          >
            <RotateCw size={16} />
          </button>
          <label className="search">
            <Search size={15} aria-hidden />
            <input
              ref={props.searchRef}
              value={filters.q}
              placeholder="Buscar"
              aria-label="Buscar tasks"
              onChange={(e) => onFilters({ ...filters, q: e.target.value })}
            />
            <kbd>/</kbd>
          </label>

          <div className="filter-wrap" ref={filterRef}>
            <button
              className={`btn${activeCount ? ' btn-active' : ''}`}
              aria-expanded={filterOpen}
              aria-label="Filtrar"
              onClick={() => setFilterOpen((o) => !o)}
            >
              <ListFilter size={15} /> <span className="hide-sm">Filtrar</span>
              {activeCount > 0 && <span className="badge">{activeCount}</span>}
            </button>
            <AnimatePresence>
              {filterOpen && (
                <motion.div
                  className="popover"
                  role="menu"
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.16 }}
                >
                  <button
                    className={`pop-item pop-toggle${filters.overdue ? ' on' : ''}`}
                    role="menuitemcheckbox"
                    aria-checked={filters.overdue}
                    onClick={() => onFilters({ ...filters, overdue: !filters.overdue })}
                  >
                    <span className="switch" aria-hidden />
                    <span className="pop-name">Só atrasadas</span>
                    {summary.overdue > 0 && <span className="pop-count">{summary.overdue}</span>}
                  </button>
                  {openBranches.length > 0 && (
                    <div className="pop-branches">
                      {groupBranches(openBranches).map(([repo, items]) => (
                        <div key={repo}>
                          <p className="pop-group">{repo}</p>
                          {items.map((b) => (
                            <button
                              key={b.id}
                              className={`pop-item${filters.branchId === b.id ? ' on' : ''}`}
                              role="menuitemradio"
                              aria-checked={filters.branchId === b.id}
                              onClick={() =>
                                onFilters({ ...filters, branchId: filters.branchId === b.id ? null : b.id })
                              }
                            >
                              <GitBranch size={14} className="pop-branch-icon" aria-hidden />
                              <span className="pop-name mono">{b.name}</span>
                              <span className="pop-count">{props.branchCounts.get(b.id) ?? 0}</span>
                              <Check size={15} className="pop-check" aria-hidden />
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                  <LabelList
                    labels={props.labels}
                    selected={filters.labelIds}
                    onToggle={toggleLabel}
                    counts={props.counts}
                  />
                  <footer className="pop-foot">
                    <button
                      className="link-btn"
                      onClick={() => {
                        filterRef.current?.querySelector('button')?.focus();
                        setFilterOpen(false);
                        props.onManageLabels();
                      }}
                    >
                      Gerenciar etiquetas
                    </button>
                    {activeCount > 0 && (
                      <button className="link-btn" onClick={() => onFilters({ ...NO_FILTERS, q: filters.q })}>
                        Limpar
                      </button>
                    )}
                  </footer>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button className="btn btn-primary" onClick={props.onNewTask}>
            <Plus size={16} /> <span className="hide-sm">Nova task</span>
          </button>
        </div>
      </header>

      {(view === 'quadro' || view === 'lista') && (
        <div className="subbar">
          <p className="summary">
            <strong>{summary.visible}</strong>{' '}
            {summary.visible === summary.total ? 'tasks' : `de ${summary.total} tasks`}
            {summary.overdue > 0 && (
              <span className="sum-bad">
                {summary.overdue} atrasada{summary.overdue > 1 ? 's' : ''}
              </span>
            )}
            {summary.today > 0 && (
              <span className="sum-warn">
                {summary.today} vence{summary.today > 1 ? 'm' : ''} hoje
              </span>
            )}
          </p>
          <AnimatePresence initial={false}>
            {activeBranch && (
              <motion.button
                key="branch"
                layout
                className="filter-pill filter-pill-branch"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={() => onFilters({ ...filters, branchId: null })}
                aria-label={`Tirar filtro da branch ${activeBranch.name}`}
                title={`${activeBranch.repo} / ${activeBranch.name}`}
              >
                <GitBranch size={13} aria-hidden /> <span className="mono">{activeBranch.name}</span>{' '}
                <X size={12} aria-hidden />
              </motion.button>
            )}
            {filters.labelIds.map((id) => {
              const l = labelsById.get(id);
              if (!l) return null;
              return (
                <motion.button
                  key={id}
                  layout
                  className="filter-pill"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={() => toggleLabel(id)}
                  aria-label={`Tirar filtro ${l.name}`}
                >
                  <i className="dot" style={{ '--c': l.color } as CSSProperties} aria-hidden /> {l.name}{' '}
                  <X size={12} aria-hidden />
                </motion.button>
              );
            })}
            {filters.overdue && (
              <motion.button
                key="overdue"
                layout
                className="filter-pill"
                onClick={() => onFilters({ ...filters, overdue: false })}
              >
                Só atrasadas <X size={12} aria-hidden />
              </motion.button>
            )}
          </AnimatePresence>
          {hasFilters && (
            <button className="link-btn" onClick={() => onFilters(NO_FILTERS)}>
              Limpar filtros
            </button>
          )}
        </div>
      )}
    </>
  );
}
