import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { MOTION } from '../art/motion';
import { Banner, type Tone } from './ui';

interface Toast {
  id: number;
  message: string;
  tone: Tone;
}

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => {});

/** Polite, auto-dismissing notifications (02-ui toast()). Not for live race stats. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  const toast = useCallback((message: string, tone: Tone = 'info') => {
    const id = ++next.current;
    setToasts((t) => [...t, { id, message, tone }]);
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setToasts((t) => t.filter((x) => x.id !== id));
    }, MOTION.ms.toast);
    timers.current.add(timer);
  }, []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="g-toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <Banner key={t.id} tone={t.tone}>{t.message}</Banner>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
