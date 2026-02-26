import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

interface ToastItem {
  id: number;
  message: string;
  tone: "info" | "success" | "error";
}

interface ToastContextValue {
  pushToast: (message: string, tone?: ToastItem["tone"]) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = useCallback((message: string, tone: ToastItem["tone"] = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((item) => item.id !== id)), 3500);
  }, []);

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed inset-x-3 bottom-3 z-50 flex flex-col gap-2 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-96">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-xl border px-4 py-3 text-sm break-words ${
              toast.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : toast.tone === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-900"
                  : "border-slate-200 bg-white text-slate-800"
            }`}
          >
            {toast.message}
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
