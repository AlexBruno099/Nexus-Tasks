import { useCallback, useEffect, useRef } from 'react';

/** Grava apenas novos rascunhos; uma falha não provoca reenvios em ciclo. */
export function useAutosave(value: string, saved: string, save: (value: string) => void, delay = 600) {
  const pending = useRef<string | null>(null);
  const attempted = useRef(saved);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const saveRef = useRef(save);
  saveRef.current = save;
  const cancel = useCallback(() => {
    clearTimeout(timer.current);
    pending.current = null;
  }, []);
  const flush = useCallback(() => {
    clearTimeout(timer.current);
    if (pending.current === null) return;
    const next = pending.current;
    pending.current = null;
    attempted.current = next;
    saveRef.current(next);
  }, []);

  useEffect(() => {
    if (value === saved || value === attempted.current) {
      cancel();
      return;
    }
    pending.current = value;
    timer.current = setTimeout(flush, delay);
    return () => clearTimeout(timer.current);
  }, [cancel, delay, flush, saved, value]);
  useEffect(() => flush, [flush]);
  return { flush, cancel };
}
