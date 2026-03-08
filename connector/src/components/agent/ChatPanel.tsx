import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";

import ChatMessage from "@/components/agent/ChatMessage";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useChatHistory, useSendChatMessage } from "@/hooks/use-agent";

export default function ChatPanel({ featureRequestId }: { featureRequestId: string }) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatQuery = useChatHistory(featureRequestId);
  const sendMutation = useSendChatMessage(featureRequestId);

  const messages = chatQuery.data?.data?.messages ?? [];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || sendMutation.isPending) return;
    setInput("");
    sendMutation.mutate(trimmed);
  };

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
        {chatQuery.isLoading && (
          <div className="flex h-16 items-center justify-center">
            <LoadingSpinner label="Loading chat..." />
          </div>
        )}
        {messages.length === 0 && !chatQuery.isLoading && (
          <div className="flex h-32 items-center justify-center">
            <p className="text-[12px] text-[var(--ink-muted)]">No messages yet. Ask about this feature request.</p>
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {sendMutation.isPending && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-[var(--message-assistant)] px-3 py-2 text-[12px] text-[var(--ink-soft)]">
              Thinking...
            </div>
          </div>
        )}
        {sendMutation.isError && (
          <div className="text-center text-[12px] text-rose-500">
            Failed to send.{" "}
            <button className="underline" onClick={() => sendMutation.reset()}>
              Retry
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-[var(--line-strong)] px-3 py-2.5">
        <div className="flex items-center gap-2 rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] px-3 py-1.5">
          <input
            type="text"
            className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)]"
            placeholder="Ask about this feature..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={sendMutation.isPending}
          />
          <button
            className="shrink-0 rounded-md p-1 text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] disabled:opacity-30"
            onClick={handleSend}
            disabled={!input.trim() || sendMutation.isPending}
          >
            <Send className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
