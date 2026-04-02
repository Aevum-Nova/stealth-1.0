import { MoonStar, SunMedium } from "lucide-react";

import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  compact?: boolean;
  className?: string;
}

export default function ThemeToggle({ compact = false, className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const label = isDark ? "Light mode" : "Dark mode";
  const Icon = isDark ? SunMedium : MoonStar;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--ink-soft)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]",
        compact && "size-9 shrink-0 justify-center px-0 py-0",
        className,
      )}
    >
      <Icon className={compact ? "size-[18px] stroke-[1.75]" : "size-3.5"} />
      {!compact ? <span>{label}</span> : null}
    </button>
  );
}
