export default function LoadingSpinner({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 text-[13px] text-[var(--ink-soft)] w-full h-full min-h-[50vh]">
      <span className="size-3.5 animate-spin rounded-full border-[1.5px] border-[var(--ink-muted)] border-t-transparent" />
      <span>{label}</span>
    </div>
  );
}
