import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type ToastTone = "info" | "success" | "error";

interface ToastOptions {
  title?: string;
  message: string;
  tone?: ToastTone;
  durationMs?: number;
}

interface ToastItem extends Required<Pick<ToastOptions, "message">> {
  id: number;
  title?: string;
  tone: ToastTone;
}

interface ToastContextValue {
  pushToast: (toast: string | ToastOptions, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
const DEFAULT_DURATION_MS = 3500;
const ERROR_DURATION_MS = 6000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timeoutIdsRef = useRef(new Map<number, number>());

  const dismissToast = useCallback((id: number) => {
    const timeoutId = timeoutIdsRef.current.get(id);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutIdsRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  useEffect(
    () => () => {
      timeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeoutIdsRef.current.clear();
    },
    []
  );

  const pushToast = useCallback((toast: string | ToastOptions, tone: ToastTone = "info") => {
    const id = Date.now();
    const item: ToastItem =
      typeof toast === "string"
        ? { id, message: toast, tone }
        : {
            id,
            title: toast.title,
            message: toast.message,
            tone: toast.tone ?? tone
          };
    const durationMs =
      typeof toast === "string"
        ? tone === "error"
          ? ERROR_DURATION_MS
          : DEFAULT_DURATION_MS
        : toast.durationMs ?? (item.tone === "error" ? ERROR_DURATION_MS : DEFAULT_DURATION_MS);

    setToasts((prev) => [...prev, item]);
    const timeoutId = window.setTimeout(() => dismissToast(id), durationMs);
    timeoutIdsRef.current.set(id, timeoutId);
  }, [dismissToast]);

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-3 bottom-3 z-50 flex flex-col gap-2 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-96" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            className={`pointer-events-auto rounded-xl border px-3.5 py-3 text-[13px] shadow-lg backdrop-blur-sm ${
              toast.tone === "success"
                ? "border-emerald-200 bg-emerald-50/95 text-emerald-950"
                : toast.tone === "error"
                  ? "border-red-200 bg-red-50/95 text-red-950"
                  : "border-[var(--line)] bg-[var(--surface)]/95 text-[var(--ink)]"
            }`}
          >
            <div className="flex items-start gap-3">
              {toast.tone === "success" ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              ) : toast.tone === "error" ? (
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              ) : (
                <Info className="mt-0.5 size-4 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                {toast.title ? <p className="font-semibold leading-5">{toast.title}</p> : null}
                <p className={`break-words leading-5 ${toast.title ? "text-[12px] opacity-90" : ""}`}>{toast.message}</p>
              </div>
              <button
                type="button"
                aria-label="Dismiss notification"
                className="rounded-md p-1 opacity-70 transition-opacity hover:opacity-100"
                onClick={() => dismissToast(toast.id)}
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
