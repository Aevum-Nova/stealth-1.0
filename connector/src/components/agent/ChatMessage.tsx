import type { ChatMessage as ChatMessageType } from "@/types/agent";

export default function ChatMessage({ message }: { message: ChatMessageType }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 text-[13px] ${
          isUser
            ? "bg-[var(--accent)] text-white"
            : "bg-[var(--surface-2)] text-[var(--ink)]"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        <time className={`mt-1 block text-[11px] ${isUser ? "text-white/70" : "text-[var(--ink-soft)]"}`}>
          {new Date(message.created_at).toLocaleTimeString()}
        </time>
      </div>
    </div>
  );
}
