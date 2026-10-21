import { Plus, Trash2, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { LIMITS } from '../../../shared/config/limits';
import { useDialog } from '../../../shared/hooks/useDialog';
import type { Label } from '../../../shared/types';
import { groupLabels } from '../../../shared/utils';

interface Props {
  labels: Label[];
  usage: Map<number, number>;
  onClose: () => void;
  onCreate: (label: Pick<Label, 'name' | 'color' | 'grp'>) => Promise<boolean>;
  onUpdate: (id: number, patch: Partial<Pick<Label, 'name' | 'color' | 'grp'>>) => void;
  onDelete: (id: number) => void;
}

export function LabelManager({ labels, usage, onClose, onCreate, onUpdate, onDelete }: Props) {
  const groups = [...new Set(labels.map((l) => l.grp))];
  const [draft, setDraft] = useState({ name: '', color: '#3B6CF6', grp: groups[0] ?? 'Geral' });
  const panelRef = useRef<HTMLDivElement>(null);
  const creating = useRef(false);
  const [isCreating, setIsCreating] = useState(false);
  useDialog(panelRef, onClose);

  const create = async () => {
    if (!draft.name.trim() || creating.current) return;
    creating.current = true;
    setIsCreating(true);
    try {
      if (await onCreate({ ...draft, name: draft.name.trim(), grp: draft.grp.trim() || 'Geral' }))
        setDraft((d) => ({ ...d, name: '' }));
    } finally {
      creating.current = false;
      setIsCreating(false);
    }
  };

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
        tabIndex={-1}
        className="panel"
        role="dialog"
        aria-modal="true"
        aria-label="Etiquetas"
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 16, opacity: 0 }}
      >
        <header className="panel-head">
          <h2>Etiquetas</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        <datalist id="label-groups">
          {groups.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>

        <div className="label-row label-new">
          <input
            type="color"
            value={draft.color}
            aria-label="Cor"
            onChange={(e) => setDraft({ ...draft, color: e.target.value })}
          />
          <input
            value={draft.name}
            placeholder="Nova etiqueta"
            aria-label="Nome da nova etiqueta"
            maxLength={LIMITS.labelName}
            disabled={isCreating}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && create()}
          />
          <input
            list="label-groups"
            value={draft.grp}
            maxLength={LIMITS.labelGroup}
            aria-label="Grupo"
            onChange={(e) => setDraft({ ...draft, grp: e.target.value })}
          />
          <button className="btn btn-primary" disabled={isCreating || !draft.name.trim()} onClick={create}>
            <Plus size={15} /> Criar
          </button>
        </div>

        <div className="lm-list">
          {groupLabels(labels).map(([grp, items]) => (
            <section key={grp}>
              <h3 className="lm-group">{grp}</h3>
              {items.map((l) => (
                <LabelRow
                  key={l.id}
                  label={l}
                  uses={usage.get(l.id) ?? 0}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                />
              ))}
            </section>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

function LabelRow({
  label,
  uses,
  onUpdate,
  onDelete,
}: {
  label: Label;
  uses: number;
  onUpdate: Props['onUpdate'];
  onDelete: Props['onDelete'];
}) {
  const [name, setName] = useState(label.name);
  const [grp, setGrp] = useState(label.grp);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    setName(label.name);
    setGrp(label.grp);
  }, [label.name, label.grp]);

  return (
    <div className="label-row">
      <input
        type="color"
        value={label.color}
        aria-label={`Cor de ${label.name}`}
        onChange={(e) => onUpdate(label.id, { color: e.target.value })}
      />
      <input
        value={name}
        aria-label="Nome"
        maxLength={LIMITS.labelName}
        onChange={(e) => setName(e.target.value)}
        onBlur={() =>
          name.trim() && name.trim() !== label.name
            ? onUpdate(label.id, { name: name.trim() })
            : setName(label.name)
        }
      />
      <input
        list="label-groups"
        value={grp}
        aria-label="Grupo"
        maxLength={LIMITS.labelGroup}
        onChange={(e) => setGrp(e.target.value)}
        onBlur={() =>
          grp.trim() && grp.trim() !== label.grp ? onUpdate(label.id, { grp: grp.trim() }) : setGrp(label.grp)
        }
      />
      {confirm ? (
        <button
          className="btn btn-danger"
          autoFocus
          onBlur={() => setConfirm(false)}
          onClick={() => onDelete(label.id)}
        >
          {uses ? `Tirar de ${uses} task(s)` : 'Confirmar'}
        </button>
      ) : (
        <button
          className="icon-btn ghost"
          aria-label={`Apagar ${label.name}`}
          onClick={() => setConfirm(true)}
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}
