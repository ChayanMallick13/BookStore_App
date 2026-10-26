import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Check, Info, X, XCircle } from 'lucide-react';

export type ToastKind = 'success' | 'error' | 'info';

interface ToastMessage {
  id: number;
  title: string;
  description?: string;
  kind: ToastKind;
}

interface ToastContextValue {
  showToast: (title: string, options?: { description?: string; kind?: ToastKind }) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const showToast = useCallback((title: string, options?: { description?: string; kind?: ToastKind }) => {
    const toast: ToastMessage = {
      id: Date.now() + Math.random(),
      title,
      description: options?.description,
      kind: options?.kind ?? 'success',
    };
    setToasts((current) => [...current.slice(-3), toast]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div aria-label="Notifications" className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3">
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} dismiss={() => dismissToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, dismiss }: { toast: ToastMessage; dismiss: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(dismiss, 4500);
    return () => window.clearTimeout(timer);
  }, [dismiss]);

  const Icon = toast.kind === 'success' ? Check : toast.kind === 'error' ? XCircle : Info;
  const iconClass = toast.kind === 'success' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
    : toast.kind === 'error' ? 'bg-red-500/15 text-red-700 dark:text-red-300'
      : 'bg-sky-500/15 text-sky-700 dark:text-sky-300';

  return (
    <div
      role={toast.kind === 'error' ? 'alert' : 'status'}
      className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-ink-100 bg-surface p-4 text-ink-900 shadow-2xl shadow-ink-950/15 ring-1 ring-black/5 animate-toast-in"
    >
      <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${iconClass}`}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{toast.title}</span>
        {toast.description && <span className="mt-1 block text-sm text-ink-500">{toast.description}</span>}
      </span>
      <button type="button" aria-label="Dismiss notification" onClick={dismiss} className="rounded-lg p-1 text-ink-400 transition hover:bg-ink-100 hover:text-ink-900">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used within ToastProvider');
  return value;
}
