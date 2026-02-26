export default function LoadingSpinner({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-[var(--ink-soft)]">
      <span className="size-4 animate-spin rounded-full border-2 border-[var(--ink-soft)] border-t-transparent" />
      <span>{label}</span>
    </div>
  );
}
