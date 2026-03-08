import type { ChatMessage as ChatMessageType } from "@/types/agent";

export default function ChatMessage({ message }: { message: ChatMessageType }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 ${
          isUser
            ? "bg-[var(--message-user)] text-white"
            : "bg-[var(--message-assistant)] text-[var(--ink)]"
        }`}
      >
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{message.content}</p>
        <time className={`mt-1 block text-[10px] ${isUser ? "text-[var(--message-user-muted)]" : "text-[var(--ink-muted)]"}`}>
          {new Date(message.created_at).toLocaleTimeString()}
        </time>
      </div>
    </div>
  );
}
