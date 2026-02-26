import { useState } from "react";

import ConfirmDialog from "@/components/shared/ConfirmDialog";
import type { FeatureRequest } from "@/types/feature-request";

interface MergeDialogProps {
  open: boolean;
  currentId: string;
  candidates: FeatureRequest[];
  onClose: () => void;
  onMerge: (targetId: string) => void;
}

export default function MergeDialog({ open, currentId, candidates, onClose, onMerge }: MergeDialogProps) {
  const [targetId, setTargetId] = useState("");

  return (
    <ConfirmDialog
      open={open}
      title="Merge Feature Request"
      description="Choose a target feature request. This request will be marked merged."
      confirmLabel="Merge"
      onCancel={onClose}
      onConfirm={() => {
        if (targetId) {
          onMerge(targetId);
        }
      }}
    >
      <div className="space-y-2">
        <label className="text-sm text-[var(--ink-soft)]" htmlFor="merge-target">
          Target Feature Request
        </label>
        <select
          id="merge-target"
          value={targetId}
          onChange={(event) => setTargetId(event.target.value)}
          className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
        >
          <option value="">Select target</option>
          {candidates
            .filter((item) => item.id !== currentId)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.title} ({item.priority_score})
              </option>
            ))}
        </select>
      </div>
    </ConfirmDialog>
  );
}
