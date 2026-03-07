import { useState } from "react";

import type { FeatureRequest } from "@/types/feature-request";

interface EditorProps {
  featureRequest: FeatureRequest;
  onSave: (payload: Partial<FeatureRequest>) => Promise<void>;
}

function EditableBlock({
  label,
  value,
  multiline = true,
  onSave
}: {
  label: string;
  value?: string | null;
  multiline?: boolean;
  onSave: (value: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  return (
    <div className="rounded-xl border border-[var(--line)] bg-white p-3.5">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--ink-muted)]">{label}</h4>
        {!editing ? (
          <button className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[11px] text-[var(--ink-soft)] hover:bg-[var(--accent-soft)]" onClick={() => setEditing(true)}>
            Edit
          </button>
        ) : null}
      </div>
      {editing ? (
        <div className="mt-2 space-y-2">
          {multiline ? (
            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} className="h-28 w-full rounded-lg border border-[var(--line)] p-2" />
          ) : (
            <input value={draft} onChange={(event) => setDraft(event.target.value)} className="w-full rounded-lg border border-[var(--line)] p-2" />
          )}
          <div className="flex gap-2">
            <button
              className="rounded-lg bg-[var(--ink)] px-3.5 py-2 text-[13px] font-medium text-white hover:bg-[var(--accent-hover)] transition-colors"
              onClick={() => {
                void onSave(draft).then(() => setEditing(false));
              }}
            >
              Save
            </button>
            <button
              className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[13px] font-medium hover:bg-[var(--accent-soft)] transition-colors"
              onClick={() => {
                setDraft(value ?? "");
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-[14px] leading-6 text-[var(--ink-soft)]">{value || "-"}</p>
      )}
    </div>
  );
}

export default function FeatureRequestEditor({ featureRequest, onSave }: EditorProps) {
  return (
    <div className="space-y-3">
      <EditableBlock
        label="Feature Request"
        value={featureRequest.title}
        multiline={false}
        onSave={(value) => onSave({ title: value })}
      />
    </div>
  );
}
