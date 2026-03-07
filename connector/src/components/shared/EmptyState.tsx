import type { ReactNode } from "react";

export default function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="panel p-10 text-center">
      <h3 className="text-base font-medium">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] text-[var(--ink-soft)]">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
