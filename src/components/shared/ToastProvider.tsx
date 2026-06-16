/**
 * ToastProvider — système de notifications léger, unifié pour toute l'app.
 * Remplace les `alert()` bloquants par des toasts non bloquants.
 *
 * Usage :
 *   const { notify } = useToast();
 *   notify('Patient enregistré', 'success');
 *   notify("Erreur lors de l'enregistrement", 'error');
 */

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  notify: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ notify: () => {} });

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

const STYLES: Record<ToastType, { bar: string; icon: ReactNode }> = {
  success: { bar: 'border-l-teal-500', icon: <CheckCircle className="w-5 h-5 text-teal-600" /> },
  error: { bar: 'border-l-red-500', icon: <AlertTriangle className="w-5 h-5 text-red-600" /> },
  info: { bar: 'border-l-slate-400', icon: <Info className="w-5 h-5 text-slate-500" /> },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    const delay = type === 'error' ? 6000 : 3500;
    window.setTimeout(() => dismiss(id), delay);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 max-w-[calc(100vw-2rem)] w-[360px]" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-3 rounded-xl border border-slate-200 border-l-4 ${STYLES[t.type].bar} bg-white shadow-lg px-4 py-3 animate-in slide-in-from-right-4`}
          >
            <span className="shrink-0 mt-0.5">{STYLES[t.type].icon}</span>
            <p className="flex-1 text-sm font-medium text-slate-700 leading-snug">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Fermer"
              className="shrink-0 text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
