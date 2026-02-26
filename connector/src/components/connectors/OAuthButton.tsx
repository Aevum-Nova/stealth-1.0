import { ShieldCheck } from "lucide-react";

export default function OAuthButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="rounded-lg bg-[var(--ink)] px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
      onClick={onClick}
    >
      <span className="inline-flex items-center gap-2">
        <ShieldCheck className="size-4" />
        {label}
      </span>
    </button>
  );
}
