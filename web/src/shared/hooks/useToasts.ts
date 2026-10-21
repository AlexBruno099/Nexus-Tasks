import { useCallback, useEffect, useRef, useState } from 'react';

interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const nextId = useRef(0);
  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((all) => all.filter((t) => t.id !== id));
  }, []);
  const notify = useCallback(
    (text: string, action?: Toast['action']) => {
      const id = ++nextId.current;
      setToasts((all) => [...all, { id, text, action }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), action ? 6000 : 5000),
      );
    },
    [dismiss],
  );
  useEffect(() => {
    const activeTimers = timers.current;
    return () => {
      activeTimers.forEach(clearTimeout);
      activeTimers.clear();
    };
  }, []);
  return { toasts, notify, dismiss };
}
