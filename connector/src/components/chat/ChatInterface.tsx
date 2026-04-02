import { useEffect, useRef, useState } from "react";

import type { ChatToolCallEntry } from "@/hooks/use-chat";

import { ChatComposer } from "./ChatComposer";
import { MessageBubble } from "./MessageBubble";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ChatToolCallEntry[];
}

interface ChatInterfaceProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
}

export function ChatInterface({ messages, isLoading, onSendMessage }: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    const t = input.trim();
    if (!t || isLoading) return;
    onSendMessage(t);
    setInput("");
  };

  const lastAssistantMessage = messages.filter((m) => m.role === "assistant").at(-1);
  const streamingAssistantId =
    isLoading && lastAssistantMessage ? lastAssistantMessage.id : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="chat-scroll-area min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 pb-4 pt-6 md:px-6">
          <div className="flex flex-col">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                role={message.role}
                content={message.content}
                toolCalls={message.toolCalls}
                isStreaming={message.id === streamingAssistantId}
                variant="claude"
              />
            ))}
            <div ref={messagesEndRef} className="h-px shrink-0" />
          </div>
        </div>
      </div>

      <footer className="shrink-0 border-t border-[var(--line)] bg-[var(--canvas)]/80 px-4 py-4 backdrop-blur-md md:px-6">
        <div className="mx-auto max-w-3xl">
          <ChatComposer
            value={input}
            onChange={setInput}
            onSend={send}
            disabled={isLoading}
            placeholder="Message…"
          />
        </div>
      </footer>
    </div>
  );
}
