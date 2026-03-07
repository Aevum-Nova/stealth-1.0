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
      <div className="fixed inset-x-3 bottom-3 z-50 flex flex-col gap-2 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-80">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-lg border px-3.5 py-2.5 text-[13px] break-words shadow-sm ${
              toast.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : toast.tone === "error"
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-[var(--line)] bg-white text-[var(--ink)]"
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
