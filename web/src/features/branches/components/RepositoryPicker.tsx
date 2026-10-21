import { FolderGit2, Search, X } from 'lucide-react';
import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from 'react';

interface RepositoryOption {
  name: string;
  count: number;
}

interface Props {
  repositories: RepositoryOption[];
  total: number;
  selected: string | null;
  query: string;
  panelId: string;
  disabled: boolean;
  onQuery: (query: string) => void;
  onSelect: (repository: string) => void;
}

const COLORS = ['#A78BFA', '#38BDF8', '#34D399', '#FBBF24', '#FB7185', '#C084FC'];

function repositoryColor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return COLORS[hash % COLORS.length];
}

/** Flags compactas; apenas o repositório selecionado ocupa a área de branches. */
export function RepositoryPicker({
  repositories,
  total,
  selected,
  query,
  panelId,
  disabled,
  onQuery,
  onSelect,
}: Props) {
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const revealSelection = () => {
      if (selected) buttons.current.get(selected)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    };
    revealSelection();
    const observer = new ResizeObserver(revealSelection);
    if (strip.current) observer.observe(strip.current);
    return () => observer.disconnect();
  }, [selected, repositories.length]);

  const navigate = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number;
    if (event.key === 'ArrowRight') next = (index + 1) % repositories.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + repositories.length) % repositories.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = repositories.length - 1;
    else return;
    event.preventDefault();
    const name = repositories[next].name;
    onSelect(name);
    buttons.current.get(name)?.focus();
    buttons.current.get(name)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  return (
    <div className="repo-picker">
      <div className="repo-picker-top">
        <span className="repo-picker-label">
          <FolderGit2 size={15} aria-hidden /> Repositórios <span>{total}</span>
        </span>
        <div className="repo-search">
          <Search size={14} aria-hidden />
          <input
            aria-label="Buscar repositório"
            placeholder="Buscar repositório"
            value={query}
            disabled={disabled}
            onChange={(event) => onQuery(event.target.value)}
          />
          {query && (
            <button
              type="button"
              className="icon-btn ghost"
              aria-label="Limpar busca de repositórios"
              disabled={disabled}
              onClick={() => onQuery('')}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>
      <div ref={strip} className="repo-tabs" role="tablist" aria-label="Repositórios">
        {repositories.map(({ name, count }, index) => (
          <button
            key={name}
            ref={(node) => {
              if (node) buttons.current.set(name, node);
              else buttons.current.delete(name);
            }}
            type="button"
            role="tab"
            id={`${panelId}-tab-${encodeURIComponent(name)}`}
            aria-selected={selected === name}
            aria-controls={panelId}
            aria-label={`${name}, ${count} branch${count === 1 ? '' : 'es'}`}
            tabIndex={selected === name ? 0 : -1}
            disabled={disabled}
            title={name}
            className={`repo-tab${selected === name ? ' is-selected' : ''}`}
            style={{ '--repo-color': repositoryColor(name) } as CSSProperties}
            onClick={() => onSelect(name)}
            onKeyDown={(event) => navigate(event, index)}
          >
            <span className="repo-tab-mark" aria-hidden>
              <FolderGit2 size={16} />
            </span>
            <span className="repo-tab-name">{name}</span>
            <span className="repo-tab-count" aria-hidden>
              {count}
            </span>
          </button>
        ))}
      </div>
      {repositories.length === 0 && (
        <p className="repo-search-empty" role="status">
          Nenhum repositório encontrado para “{query}”.
        </p>
      )}
    </div>
  );
}
