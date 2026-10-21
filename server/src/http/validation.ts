import { z } from 'zod';
export const id = z.coerce.number().int().positive().max(2147483647);
export const params = z.object({ id });
export const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'cor no formato #RRGGBB');
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'data no formato AAAA-MM-DD')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      value.slice(0, 4) !== '0000' &&
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  }, 'data inexistente no calendário');
