import type { ReactNode } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  children
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="panel elevated w-full max-w-md p-6">
        <h3 className="mb-2 text-xl">{title}</h3>
        <p className="text-[var(--ink-soft)]">{description}</p>
        {children ? <div className="mt-4">{children}</div> : null}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <button className="w-full rounded-lg border border-[var(--line)] px-4 py-2 sm:w-auto" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className="w-full rounded-lg bg-[var(--ink)] px-4 py-2 text-white sm:w-auto" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
