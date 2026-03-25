import { ArrowLeft, Save, Rocket } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface CanvasToolbarProps {
  name: string;
  onNameChange: (name: string) => void;
  onSave: () => void;
  onDeploy: () => void;
  canDeploy: boolean;
  isSaving: boolean;
}

export default function CanvasToolbar({
  name,
  onNameChange,
  onSave,
  onDeploy,
  canDeploy,
  isSaving,
}: CanvasToolbarProps) {
  const navigate = useNavigate();

  return (
    <div className="absolute left-0 right-0 top-0 z-10 flex h-12 items-center justify-between border-b border-[var(--line)] bg-[var(--surface)]">
      {/* Left */}
      <div className="flex items-center gap-2 pl-3">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex size-7 items-center justify-center rounded-lg text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="h-4 w-px bg-[var(--line)]" />
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Untitled workflow"
          className="w-48 border-none bg-transparent text-[13px] font-semibold text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:outline-none focus:ring-0"
          style={{ boxShadow: "none" }}
        />
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 pr-3">
        <button
          onClick={onSave}
          disabled={isSaving}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--ink-soft)] transition-all hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)] disabled:opacity-50"
        >
          <Save className="size-3.5" />
          {isSaving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={onDeploy}
          disabled={!canDeploy}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--ink)] px-3 py-1.5 text-[12px] font-medium text-white transition-all hover:bg-[var(--accent-hover)] disabled:opacity-40"
        >
          <Rocket className="size-3.5" />
          Deploy
        </button>
      </div>
    </div>
  );
}
