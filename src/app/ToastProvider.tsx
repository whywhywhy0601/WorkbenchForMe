import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  kind: ToastKind;
  message: string;
  title?: string;
}

interface ToastApi {
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const ICONS = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const current = timers.current;
    return () => {
      for (const timer of current.values()) window.clearTimeout(timer);
    };
  }, []);

  const remove = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string, title?: string) => {
      const id = crypto.randomUUID();
      setItems((current) => [...current.slice(-4), { id, kind, message, title }]);
      const timer = window.setTimeout(
        () => remove(id),
        kind === 'error' ? 6500 : 3800
      );
      timers.current.set(id, timer);
    },
    [remove]
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message, title) => push('success', message, title),
      error: (message, title) => push('error', message, title),
      info: (message, title) => push('info', message, title),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="toast-stack" aria-live="polite" role="status">
          {items.map((item) => {
            const Icon = ICONS[item.kind];
            return (
              <div key={item.id} className={`toast toast--${item.kind}`}>
                <span className="toast-icon">
                  <Icon size={17} />
                </span>
                <div className="toast-copy">
                  {item.title && <strong>{item.title}</strong>}
                  <span>{item.message}</span>
                </div>
                <button className="toast-close" onClick={() => remove(item.id)} aria-label="关闭提示">
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
