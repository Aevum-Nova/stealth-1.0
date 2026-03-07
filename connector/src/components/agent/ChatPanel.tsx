import { useEffect, useRef, useState } from "react";

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
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {chatQuery.isLoading && <LoadingSpinner label="Loading chat..." />}
        {messages.length === 0 && !chatQuery.isLoading && (
          <p className="text-center text-[13px] text-[var(--ink-soft)]">
            No messages yet. Ask about this feature request.
          </p>
        )}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {sendMutation.isPending && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg bg-[var(--surface-2)] px-4 py-2 text-[13px] text-[var(--ink-soft)]">
              Thinking...
            </div>
          </div>
        )}
        {sendMutation.isError && (
          <div className="text-center text-[13px] text-rose-500">
            Failed to send message.{" "}
            <button
              className="underline"
              onClick={() => sendMutation.reset()}
            >
              Retry
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-[var(--line)] p-3">
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
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
            className="rounded-lg bg-[var(--ink)] px-3.5 py-2 text-[13px] font-medium text-white hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
            onClick={handleSend}
            disabled={!input.trim() || sendMutation.isPending}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
