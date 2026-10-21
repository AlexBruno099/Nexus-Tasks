import { FolderGit2, Plus } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { LIMITS } from '../../../shared/config/limits';
import type { Branch, BranchPatch, Column, Task } from '../../../shared/types';
import { groupBranches } from '../../../shared/utils';
import { BranchCard } from './BranchCard';
import { RepositoryPicker } from './RepositoryPicker';

interface Props {
  branches: Branch[];
  tasks: Task[];
  columns: Column[];
  onCreate: (branch: Pick<Branch, 'repo' | 'name'>) => Promise<boolean>;
  onUpdate: (id: number, patch: BranchPatch) => void;
  onDelete: (id: number) => void;
  onOpenBranch: (id: number) => void;
  onOpenTask: (id: number) => void;
}

function readSelectedRepository() {
  try {
    return localStorage.getItem('bobina:branches:repo');
  } catch {
    return null;
  }
}

export function BranchesView({
  branches,
  tasks,
  columns,
  onCreate,
  onUpdate,
  onDelete,
  onOpenBranch,
  onOpenTask,
}: Props) {
  const [selectedRepo, setSelectedRepo] = useState<string | null>(readSelectedRepository);
  const [query, setQuery] = useState('');
  const [addingRepo, setAddingRepo] = useState(false);
  const [draft, setDraft] = useState({ repo: '', name: '' });
  const creating = useRef(false);
  const [isCreating, setIsCreating] = useState(false);
  const panelId = useId();
  const groups = useMemo(
    () =>
      groupBranches(
        [...branches].sort((a, b) => Number(a.merged || a.locked) - Number(b.merged || b.locked)),
      ),
    [branches],
  );
  const matching = groups.filter(([repo]) =>
    repo.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const [activeRepo, items] = matching.find(([repo]) => repo === selectedRepo) ?? matching[0] ?? [null, []];
  const newRepository = addingRepo || groups.length === 0;
  const formRepo = newRepository ? draft.repo : (activeRepo ?? '');
  const tasksByBranch = useMemo(() => {
    const result = new Map<number, Task[]>();
    for (const task of tasks) {
      if (task.branchId === null) continue;
      const list = result.get(task.branchId) ?? [];
      list.push(task);
      result.set(task.branchId, list);
    }
    return result;
  }, [tasks]);
  const loose = tasks.filter((task) => task.branchId === null).length;
  const activeCount = items.filter((branch) => !branch.merged && !branch.locked).length;
  const taskCount = items.reduce((sum, branch) => sum + (tasksByBranch.get(branch.id)?.length ?? 0), 0);

  useEffect(() => {
    if (!activeRepo || query.trim()) return;
    try {
      localStorage.setItem('bobina:branches:repo', activeRepo);
    } catch {
      /* armazenamento indisponível */
    }
  }, [activeRepo, query]);

  const selectRepo = (repo: string) => {
    setSelectedRepo(repo);
    setQuery('');
    setAddingRepo(false);
    setDraft({ repo: '', name: '' });
  };

  const create = async (event: FormEvent) => {
    event.preventDefault();
    const repo = formRepo.trim();
    if (!repo || !draft.name.trim() || creating.current) return;
    creating.current = true;
    setIsCreating(true);
    try {
      if (await onCreate({ repo, name: draft.name.trim() })) selectRepo(repo);
    } finally {
      creating.current = false;
      setIsCreating(false);
    }
  };

  return (
    <div className="branches">
      <header className="branches-heading">
        <div>
          <h1>Branches por repositório</h1>
          <p>Escolha um repositório para acompanhar suas branches.</p>
        </div>
        {groups.length > 0 && !addingRepo && (
          <button
            className="btn"
            type="button"
            disabled={isCreating}
            onClick={() => {
              setAddingRepo(true);
              setQuery('');
              setDraft({ repo: '', name: '' });
            }}
          >
            <Plus size={15} /> Novo repositório
          </button>
        )}
      </header>

      {groups.length > 0 && (
        <RepositoryPicker
          repositories={matching.map(([name, branches]) => ({ name, count: branches.length }))}
          total={groups.length}
          selected={activeRepo}
          query={query}
          panelId={panelId}
          disabled={isCreating}
          onQuery={setQuery}
          onSelect={selectRepo}
        />
      )}

      {(newRepository || activeRepo) && (
        <form className="branch-new" onSubmit={create}>
          {newRepository ? (
            <>
              <FolderGit2 size={16} className="muted" aria-hidden />
              <input
                autoFocus
                className="branch-new-repo"
                list="branch-repos"
                value={draft.repo}
                placeholder="repositório"
                aria-label="Repositório"
                maxLength={LIMITS.branchRepo}
                disabled={isCreating}
                onChange={(event) => setDraft({ ...draft, repo: event.target.value })}
              />
              <datalist id="branch-repos">
                {groups.map(([repo]) => (
                  <option key={repo} value={repo} />
                ))}
              </datalist>
            </>
          ) : (
            <span className="branch-new-context" title={activeRepo ?? undefined}>
              <FolderGit2 size={15} aria-hidden />
              <span>{activeRepo}</span>
            </span>
          )}
          <span className="branch-new-sep" aria-hidden>
            /
          </span>
          <input
            className="branch-new-name"
            value={draft.name}
            placeholder="nome da branch, ex.: fix/clickup"
            aria-label="Nome da branch"
            maxLength={LIMITS.branchName}
            disabled={isCreating}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
          <button
            className="btn btn-primary"
            type="submit"
            disabled={isCreating || !formRepo.trim() || !draft.name.trim()}
          >
            <Plus size={15} /> Criar branch
          </button>
          {addingRepo && (
            <button
              className="btn"
              type="button"
              disabled={isCreating}
              onClick={() => {
                setAddingRepo(false);
                setDraft({ repo: '', name: '' });
              }}
            >
              Cancelar
            </button>
          )}
        </form>
      )}

      {groups.length === 0 ? (
        <p className="empty-state">
          Comece com um repositório e sua primeira branch. Os repositórios vão aparecer aqui como flags para
          você alternar entre eles.
        </p>
      ) : activeRepo ? (
        <section
          className="repo-workspace"
          role="tabpanel"
          id={panelId}
          aria-labelledby={`${panelId}-tab-${encodeURIComponent(activeRepo)}`}
        >
          <header className="repo-workspace-head">
            <h2>
              <FolderGit2 size={17} aria-hidden /> {activeRepo}
            </h2>
            <p>
              {items.length} branch{items.length === 1 ? '' : 'es'} <span aria-hidden>·</span> {activeCount}{' '}
              em andamento <span aria-hidden>·</span> {taskCount} task{taskCount === 1 ? '' : 's'}
            </p>
          </header>
          <div className="branch-grid" key={activeRepo}>
            <AnimatePresence initial={false}>
              {items.map((branch) => (
                <BranchCard
                  key={branch.id}
                  branch={branch}
                  tasks={tasksByBranch.get(branch.id) ?? []}
                  columns={columns}
                  onUpdate={(patch) => onUpdate(branch.id, patch)}
                  onDelete={() => onDelete(branch.id)}
                  onOpen={() => onOpenBranch(branch.id)}
                  onOpenTask={onOpenTask}
                />
              ))}
            </AnimatePresence>
          </div>
        </section>
      ) : null}

      {branches.length > 0 && loose > 0 && (
        <p className="branch-loose">
          {loose} task{loose === 1 ? '' : 's'} sem branch. Abra a task e escolha a branch no detalhe.
        </p>
      )}
    </div>
  );
}
