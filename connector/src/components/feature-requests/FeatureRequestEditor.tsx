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
    <div className="rounded-lg border border-[var(--line)] p-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-soft)]">{label}</h4>
        {!editing ? (
          <button className="text-xs text-[var(--accent)]" onClick={() => setEditing(true)}>
            Edit
          </button>
        ) : null}
      </div>
      {editing ? (
        <div className="mt-2 space-y-2">
          {multiline ? (
            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} className="h-28 w-full rounded border border-[var(--line)] p-2" />
          ) : (
            <input value={draft} onChange={(event) => setDraft(event.target.value)} className="w-full rounded border border-[var(--line)] p-2" />
          )}
          <div className="flex gap-2">
            <button
              className="rounded bg-[var(--ink)] px-3 py-1 text-sm text-white"
              onClick={() => {
                void onSave(draft).then(() => setEditing(false));
              }}
            >
              Save
            </button>
            <button
              className="rounded border border-[var(--line)] px-3 py-1 text-sm"
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
        <p className="mt-2 text-sm text-[var(--ink-soft)]">{value || "-"}</p>
      )}
    </div>
  );
}

export default function FeatureRequestEditor({ featureRequest, onSave }: EditorProps) {
  return (
    <div className="space-y-3">
      <EditableBlock label="Title" value={featureRequest.title} multiline={false} onSave={(value) => onSave({ title: value })} />
      <EditableBlock label="Problem Statement" value={featureRequest.problem_statement} onSave={(value) => onSave({ problem_statement: value })} />
      <EditableBlock label="Proposed Solution" value={featureRequest.proposed_solution} onSave={(value) => onSave({ proposed_solution: value })} />
      <EditableBlock label="User Story" value={featureRequest.user_story} onSave={(value) => onSave({ user_story: value })} />
      <EditableBlock label="Technical Notes" value={featureRequest.technical_notes} onSave={(value) => onSave({ technical_notes: value })} />
      <EditableBlock label="Human Notes" value={featureRequest.human_notes} onSave={(value) => onSave({ human_notes: value })} />
    </div>
  );
}
