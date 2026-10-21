import type { Column } from '../../shared/types';

/** Cor de cada coluna na barra: feito em verde, a primeira em cinza e as do meio em roxo crescente. */
export function columnColor(columns: Column[], col: Column) {
  if (col.isDone) return 'var(--success)';
  const open = columns.filter((c) => !c.isDone);
  const i = open.indexOf(col);
  if (i <= 0) return 'var(--text-faint)';
  const strength = open.length > 2 ? 45 + (55 * (i - 1)) / (open.length - 2) : 100;
  return `color-mix(in srgb, var(--accent-hi) ${Math.round(strength)}%, transparent)`;
}
