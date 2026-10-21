import { Check, Search } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import type { Label } from '../../../shared/types';
import { groupLabels, slug } from '../../../shared/utils';

interface Props {
  labels: Label[];
  selected: number[];
  onToggle: (id: number) => void;
  counts?: Map<number, number>;
}

/** Lista de etiquetas com busca, usada no filtro e no seletor da task. */
export function LabelList({ labels, selected, onToggle, counts }: Props) {
  const [q, setQ] = useState('');
  const filtered = labels.filter((l) => slug(l.name).includes(slug(q)) || slug(l.grp).includes(slug(q)));

  return (
    <div className="label-list">
      <label className="pop-search">
        <Search size={14} aria-hidden />
        <input
          autoFocus
          value={q}
          placeholder="Buscar etiqueta"
          aria-label="Buscar etiqueta"
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      <div className="pop-scroll">
        {groupLabels(filtered).map(([grp, items]) => (
          <div key={grp} role="group" aria-label={grp}>
            <div className="pop-group">{grp}</div>
            {items.map((l) => {
              const on = selected.includes(l.id);
              return (
                <button
                  key={l.id}
                  className={`pop-item${on ? ' on' : ''}`}
                  role="menuitemcheckbox"
                  aria-checked={on}
                  onClick={() => onToggle(l.id)}
                >
                  <i className="dot" style={{ '--c': l.color } as CSSProperties} aria-hidden />
                  <span className="pop-name">{l.name}</span>
                  {counts && (counts.get(l.id) ?? 0) > 0 && (
                    <span className="pop-count">{counts.get(l.id)}</span>
                  )}
                  <Check size={14} className="pop-check" aria-hidden />
                </button>
              );
            })}
          </div>
        ))}
        {!filtered.length && <p className="pop-empty">Nenhuma etiqueta com esse nome.</p>}
      </div>
    </div>
  );
}
