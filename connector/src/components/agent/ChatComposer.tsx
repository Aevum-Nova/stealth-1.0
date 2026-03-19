import { memo, useCallback, useRef, useState } from "react";
import { ArrowUp, Square } from "lucide-react";

const MAX_INPUT_HEIGHT = 140;

/**
 * Isolated composer so typing does not re-render the full chat message list.
 */
export const ChatComposer = memo(function ChatComposer({
  isStreaming,
  onSend,
  onStop,
}: {
  isStreaming: boolean;
  onSend: (message: string) => void;
  onStop: () => void;
}) {
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resizeToContent = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_HEIGHT)}px`;
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed || isStreaming) return;
    setDraft("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    onSend(trimmed);
  }, [draft, isStreaming, onSend]);

  return (
    <div className="shrink-0 border-t border-[#eeeeee] bg-white px-6 py-4">
      <div className="mx-auto max-w-4xl">
        <div className="chat-input-container flex items-center gap-3 rounded-full bg-[#f5f5f5] px-5 py-3 transition-colors focus-within:bg-[#eeeeee]">
          <textarea
            ref={textareaRef}
            className="min-h-[22px] max-h-[140px] min-w-0 flex-1 resize-none border-none bg-transparent text-[14px] leading-relaxed text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)]"
            placeholder="Find leads, enrich data, paste or drop images..."
            rows={1}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              requestAnimationFrame(resizeToContent);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={isStreaming}
          />
          {isStreaming ? (
            <button
              type="button"
              aria-label="Stop generation"
              className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#e5e5e5] bg-white text-[var(--ink)] shadow-sm transition-colors hover:bg-[#f5f5f5]"
              onClick={onStop}
            >
              <Square className="size-3 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              onClick={handleSend}
              disabled={!draft.trim()}
            >
              <ArrowUp className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
