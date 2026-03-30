export default function LoadingSpinner({
  label = "Loading...",
  fill = false,
}: {
  label?: string;
  /** Use for full-page or major-pane loading. Omit inside buttons and compact UI. */
  fill?: boolean;
}) {
  const row = (
    <div className="inline-flex items-center justify-center gap-2.5 text-[13px] text-[var(--ink-soft)]">
      <span className="size-3.5 animate-spin rounded-full border-[1.5px] border-[var(--ink-muted)] border-t-transparent" />
      <span>{label}</span>
    </div>
  );

  if (fill) {
    return (
      <div className="flex min-h-[min(50vh,28rem)] w-full items-center justify-center py-10">
        {row}
      </div>
    );
  }

  return row;
}
