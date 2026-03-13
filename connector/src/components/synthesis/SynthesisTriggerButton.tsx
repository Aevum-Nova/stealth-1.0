interface SynthesisTriggerButtonProps {
  mode: "incremental" | "full";
  onRun: (mode: "incremental" | "full") => void;
  disabled?: boolean;
}

export default function SynthesisTriggerButton({ mode, onRun, disabled }: SynthesisTriggerButtonProps) {
  return (
    <button
      className={`w-full rounded-lg px-3.5 py-2 text-center text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${mode === "incremental" ? "bg-[var(--ink)] text-white hover:bg-[var(--accent-hover)]" : "border border-[var(--line)] hover:bg-[var(--accent-soft)]"}`}
      onClick={() => onRun(mode)}
      disabled={disabled}
    >
      {mode === "incremental" ? "Run Incremental Synthesis" : "Run Full Re-Synthesis"}
    </button>
  );
}
