interface SynthesisTriggerButtonProps {
  mode: "incremental" | "full";
  onRun: (mode: "incremental" | "full") => void;
  disabled?: boolean;
}

export default function SynthesisTriggerButton({ mode, onRun, disabled }: SynthesisTriggerButtonProps) {
  return (
    <button
      className={`w-full rounded-lg px-4 py-2 text-center text-sm sm:w-auto ${mode === "incremental" ? "bg-[var(--ink)] text-white" : "border border-[var(--line)]"}`}
      onClick={() => onRun(mode)}
      disabled={disabled}
    >
      {mode === "incremental" ? "Run Incremental Synthesis" : "Run Full Re-Synthesis"}
    </button>
  );
}
