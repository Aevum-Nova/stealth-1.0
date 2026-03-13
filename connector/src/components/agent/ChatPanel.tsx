import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

import ChatMessage from "@/components/agent/ChatMessage";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useChatHistory } from "@/hooks/use-agent";
import { streamChatMessage } from "@/api/agent";
import { useQueryClient } from "@tanstack/react-query";

const CHARS_PER_FRAME = 3;

export default function ChatPanel({
  featureRequestId,
}: {
  featureRequestId: string;
}) {
  const [input, setInput] = useState("");
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [displayedContent, setDisplayedContent] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<(() => void) | null>(null);

  const fullTextRef = useRef("");
  const displayedLenRef = useRef(0);
  const tickingRef = useRef(false);
  const doneRef = useRef(false);

  const chatQuery = useChatHistory(featureRequestId);
  const queryClient = useQueryClient();

  const serverMessages = chatQuery.data?.data?.messages ?? [];

  const messages = [
    ...serverMessages,
    ...(pendingMessage
      ? [
          {
            id: "pending-user",
            role: "user" as const,
            content: pendingMessage,
            created_at: new Date().toISOString(),
            proposed_changes: null,
          },
        ]
      : []),
    ...(displayedContent !== null
      ? [
          {
            id: "streaming-assistant",
            role: "assistant" as const,
            content: displayedContent,
            created_at: new Date().toISOString(),
            proposed_changes: null,
          },
        ]
      : []),
  ];

  const tick = useCallback(() => {
    const full = fullTextRef.current;
    const cur = displayedLenRef.current;

    if (cur < full.length) {
      const ahead = full.length - cur;
      const speed = ahead > 80 ? 12 : ahead > 40 ? 6 : CHARS_PER_FRAME;
      const next = Math.min(cur + speed, full.length);
      displayedLenRef.current = next;
      setDisplayedContent(full.slice(0, next));

      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }

      requestAnimationFrame(tick);
    } else if (doneRef.current) {
      tickingRef.current = false;
      doneRef.current = false;
      setIsStreaming(false);
      queryClient.invalidateQueries({
        queryKey: ["agent-chat", featureRequestId],
      }).then(() => {
        setPendingMessage(null);
        setDisplayedContent(null);
      });
    } else {
      tickingRef.current = false;
    }
  }, [featureRequestId, queryClient]);

  const startTicking = useCallback(() => {
    if (!tickingRef.current) {
      tickingRef.current = true;
      requestAnimationFrame(tick);
    }
  }, [tick]);

  useEffect(() => {
    if (!isStreaming && messages.length > 0 && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [isStreaming, messages.length]);

  useEffect(() => {
    return () => {
      abortRef.current?.();
    };
  }, []);

  const checkScrollPosition = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    setShowScrollToBottom(scrollHeight - scrollTop - clientHeight > 60);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScrollPosition();
    el.addEventListener("scroll", checkScrollPosition);
    const ro = new ResizeObserver(checkScrollPosition);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", checkScrollPosition);
      ro.disconnect();
    };
  }, [checkScrollPosition, messages.length]);

  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput("");
    setStreamError(null);
    setPendingMessage(trimmed);
    setDisplayedContent("");
    fullTextRef.current = "";
    displayedLenRef.current = 0;
    doneRef.current = false;
    tickingRef.current = false;
    setIsStreaming(true);

    const abort = streamChatMessage(
      featureRequestId,
      trimmed,
      (token) => {
        fullTextRef.current += token;
        startTicking();
      },
      () => {
        doneRef.current = true;
        startTicking();
      },
      (error) => {
        setIsStreaming(false);
        setPendingMessage(null);
        setDisplayedContent(null);
        setStreamError(error);
      },
    );

    abortRef.current = abort;
  };

  return (
    <div className="relative flex h-full flex-col bg-white">
      <div
        ref={scrollRef}
        className="chat-scroll-area flex-1 min-h-0 overflow-y-auto bg-white"
      >
        <div className="mx-auto max-w-4xl px-6 py-8">
          {chatQuery.isLoading && (
            <div className="flex h-32 items-center justify-center">
              <LoadingSpinner label="Loading chat..." />
            </div>
          )}
          {messages.length === 0 && !chatQuery.isLoading && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-[15px] font-medium text-[var(--ink-soft)]">
                Ask about the codebase, suggest changes, or refine the PR.
              </p>
              <p className="mt-2 text-[13px] text-[var(--ink-muted)]">
                I can help you understand and improve this feature.
              </p>
            </div>
          )}
          <div className="space-y-0">
            {messages.map((msg, i) => (
              <div key={msg.id}>
                {i > 0 && msg.role === "assistant" && (
                  <div className="flex items-center py-3">
                    <div className="flex-1 border-t border-[#e5e5e5]" />
                    <span className="px-4 text-[11px] text-[var(--ink-muted)]">
                      {i} previous {i === 1 ? "message" : "messages"} &gt;
                    </span>
                    <div className="flex-1 border-t border-[#e5e5e5]" />
                  </div>
                )}
                <ChatMessage
                  message={msg}
                  isStreaming={
                    msg.id === "streaming-assistant" && isStreaming
                  }
                />
              </div>
            ))}
            {isStreaming && displayedContent === "" && (
              <div
                className={`flex items-center gap-2 text-[var(--ink-muted)] ${serverMessages.length || pendingMessage ? "mt-3" : ""}`}
              >
                <span className="text-[var(--ink-muted)]">&gt;</span>
                <span className="text-[13px]">Thinking</span>
              </div>
            )}
            {streamError && (
              <div
                className={`rounded-lg border border-[#e5e5e5] bg-white px-4 py-3 text-[13px] text-[var(--ink)] ${messages.length ? "mt-3" : ""}`}
              >
                Failed to send.{" "}
                <button
                  className="font-medium underline"
                  onClick={() => setStreamError(null)}
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showScrollToBottom && (
        <button
          type="button"
          className="absolute bottom-20 left-1/2 z-10 flex -translate-x-1/2 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] p-2.5 text-[var(--ink-muted)] shadow-sm transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
          onClick={scrollToBottom}
          aria-label="Scroll to bottom"
        >
          <ArrowDown className="size-4" />
        </button>
      )}

      <div className="shrink-0 border-t border-[#eeeeee] bg-white px-6 py-4">
        <div className="mx-auto max-w-4xl">
          <div className="chat-input-container flex items-end gap-3 rounded-full bg-[#f5f5f5] px-5 py-3 transition-colors focus-within:bg-[#eeeeee]">
            <textarea
              className="min-h-[22px] max-h-[140px] min-w-0 flex-1 resize-none border-none bg-transparent text-[14px] leading-relaxed text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)]"
              placeholder="Find leads, enrich data, paste or drop images..."
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height =
                  Math.min(e.target.scrollHeight, 140) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={isStreaming}
            />
            <button
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
            >
              <ArrowUp className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
