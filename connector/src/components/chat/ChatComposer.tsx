import { ArrowUp, Plus } from "lucide-react";

export interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

export function ChatComposer({
  value,
  onChange,
  onSend,
  disabled,
  placeholder = "How can I help you today?",
  autoFocus,
}: ChatComposerProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() && !disabled) {
      onSend();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="chat-composer-shell rounded-[22px] border border-[var(--line)] bg-[var(--chat-input-shell)] shadow-[0_1px_2px_var(--shadow-soft)] transition-[border-color,box-shadow] focus-within:border-[var(--line-muted)] focus-within:shadow-[0_4px_24px_var(--shadow-soft)]">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          rows={1}
          className="max-h-[200px] min-h-[52px] w-full resize-none border-0 bg-transparent px-5 pb-2 pt-4 text-[15px] leading-relaxed text-[var(--ink)] shadow-none placeholder:text-[var(--ink-muted)] focus:border-0 focus:outline-none focus:ring-0 focus-visible:border-0 focus-visible:ring-0 disabled:opacity-50"
        />
        <div className="flex items-center justify-between px-3 pb-3">
          <button
            type="button"
            className="rounded-xl p-2.5 text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--ink-soft)]"
            aria-label="Add attachment"
            tabIndex={-1}
          >
            <Plus className="size-5 stroke-[1.5]" />
          </button>
          <button
            type="submit"
            disabled={!value.trim() || disabled}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--canvas)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-25"
            aria-label="Send message"
          >
            <ArrowUp className="size-4 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </form>
  );
}
