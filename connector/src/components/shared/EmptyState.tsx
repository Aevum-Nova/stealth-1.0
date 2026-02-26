import type { ReactNode } from "react";

export default function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="panel elevated p-8 text-center">
      <div className="mx-auto mb-3 h-1.5 w-24 rounded bg-gray-200" />
      <h3 className="mb-2 text-xl">{title}</h3>
      <p className="mx-auto max-w-lg text-[var(--ink-soft)]">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
