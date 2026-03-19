import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";

import { ChatComposer } from "@/components/agent/ChatComposer";
import ChatMessage from "@/components/agent/ChatMessage";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useApplyChangesToPr, useChatHistory } from "@/hooks/use-agent";
import { streamChatMessage } from "@/api/agent";
import { useQueryClient } from "@tanstack/react-query";
import { extractProposedChangesFromText } from "@/lib/extract-proposed-changes";
import type { ProposedChange } from "@/types/agent";

const CHARS_PER_FRAME = 6;

export default function ChatPanel({
  featureRequestId,
  latestPrUrl,
}: {
  featureRequestId: string;
  latestPrUrl?: string | null;
}) {
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [displayedContent, setDisplayedContent] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const userScrolledUpRef = useRef(false);
  const programmaticScrollRef = useRef(false);

  const fullTextRef = useRef("");
  const displayedLenRef = useRef(0);
  const tickingRef = useRef(false);
  const doneRef = useRef(false);

  const chatQuery = useChatHistory(featureRequestId);
  const applyMutation = useApplyChangesToPr(featureRequestId);
  const queryClient = useQueryClient();

  const serverMessages = chatQuery.data?.data?.messages ?? [];

  const streamingProposedChanges = useMemo(
    () =>
      displayedContent !== null
        ? extractProposedChangesFromText(displayedContent) ?? undefined
        : undefined,
    [displayedContent],
  );

  const messages = useMemo(
    () => [
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
              proposed_changes: streamingProposedChanges,
            },
          ]
        : []),
    ],
    [
      serverMessages,
      pendingMessage,
      displayedContent,
      streamingProposedChanges,
    ],
  );

  const handleApplyToPr = useCallback(
    (changes: ProposedChange[]) => {
      applyMutation.mutate(changes);
    },
    [applyMutation],
  );

  const tick = useCallback(() => {
    const full = fullTextRef.current;
    const cur = displayedLenRef.current;

    if (cur < full.length) {
      const ahead = full.length - cur;
      const speed = ahead > 200 ? 40 : ahead > 80 ? 20 : ahead > 30 ? 10 : CHARS_PER_FRAME;
      const next = Math.min(cur + speed, full.length);
      displayedLenRef.current = next;
      setDisplayedContent(full.slice(0, next));

      if (scrollRef.current && !userScrolledUpRef.current) {
        programmaticScrollRef.current = true;
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }

      requestAnimationFrame(tick);
    } else if (doneRef.current) {
      tickingRef.current = false;
      doneRef.current = false;
      setIsStreaming(false);
      setPendingMessage(null);
      setDisplayedContent(null);
      queryClient.invalidateQueries({
        queryKey: ["agent-chat", featureRequestId],
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
    if (
      !isStreaming &&
      messages.length > 0 &&
      scrollRef.current &&
      !userScrolledUpRef.current
    ) {
      programmaticScrollRef.current = true;
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [isStreaming, messages.length]);

  // Scroll to bottom immediately when user sends a message (before first token)
  useEffect(() => {
    if (pendingMessage && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [pendingMessage]);

  useEffect(() => {
    return () => {
      abortRef.current?.();
    };
  }, []);

  const SCROLL_BOTTOM_THRESHOLD = 60;

  const checkScrollPosition = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setShowScrollToBottom(distanceFromBottom > 60);

    if (programmaticScrollRef.current) {
      programmaticScrollRef.current = false;
      return;
    }

    if (distanceFromBottom <= SCROLL_BOTTOM_THRESHOLD) {
      userScrolledUpRef.current = false;
    }
  }, []);

  const handleUserScrollIntent = useCallback(
    (e: Event) => {
      if (!isStreaming) return;
      const we = e as WheelEvent;
      if (we.deltaY !== undefined && we.deltaY < 0) {
        userScrolledUpRef.current = true;
      } else if (e.type === "touchmove") {
        userScrolledUpRef.current = true;
      }
    },
    [isStreaming],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScrollPosition();
    el.addEventListener("scroll", checkScrollPosition);
    el.addEventListener("wheel", handleUserScrollIntent, { passive: true });
    el.addEventListener("touchmove", handleUserScrollIntent, { passive: true });
    const ro = new ResizeObserver(checkScrollPosition);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", checkScrollPosition);
      el.removeEventListener("wheel", handleUserScrollIntent);
      el.removeEventListener("touchmove", handleUserScrollIntent);
      ro.disconnect();
    };
  }, [checkScrollPosition, handleUserScrollIntent, messages.length]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      programmaticScrollRef.current = true;
      userScrolledUpRef.current = false;
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  const handleSendMessage = useCallback(
    (trimmed: string) => {
      if (!trimmed || isStreaming) return;
      setStreamError(null);
      userScrolledUpRef.current = false;
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
    },
    [featureRequestId, isStreaming, startTicking],
  );

  const handleStop = useCallback(() => {
    abortRef.current?.();
    abortRef.current = null;
    doneRef.current = false;
    tickingRef.current = false;
    fullTextRef.current = "";
    displayedLenRef.current = 0;
    setIsStreaming(false);
    setPendingMessage(null);
    setDisplayedContent(null);
    queryClient.invalidateQueries({
      queryKey: ["agent-chat", featureRequestId],
    });
  }, [featureRequestId, queryClient]);

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
                  isStreaming={msg.id === "streaming-assistant" && isStreaming}
                  onApplyToPr={handleApplyToPr}
                  canApplyToPr={!!latestPrUrl}
                  isApplyingToPr={applyMutation.isPending}
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

      <ChatComposer
        isStreaming={isStreaming}
        onSend={handleSendMessage}
        onStop={handleStop}
      />
    </div>
  );
}
