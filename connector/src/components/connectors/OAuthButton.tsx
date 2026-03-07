import { ShieldCheck } from "lucide-react";

export default function OAuthButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="rounded-lg bg-[var(--ink)] px-3.5 py-2 text-[13px] font-medium text-white hover:bg-[var(--accent-hover)] transition-colors disabled:cursor-not-allowed disabled:opacity-60"
      onClick={onClick}
    >
      <span className="inline-flex items-center gap-2">
        <ShieldCheck className="size-4" />
        {label}
      </span>
    </button>
  );
}
