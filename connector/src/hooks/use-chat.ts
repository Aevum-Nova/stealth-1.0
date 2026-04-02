import { useCallback, useRef, useState } from "react";

import type { StreamEvent } from "@/api/chat";
import { attemptTokenRefresh, getAccessToken } from "@/lib/auth";

export interface ChatToolCallEntry {
  toolUseId: string;
  name: string;
  status: "pending" | "done";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ChatToolCallEntry[];
  createdAt: Date;
}

export interface UseChatOptions {
  onConversationIdChange?: (id: string) => void;
}

export function useChat(options: UseChatOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: content.trim(),
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    const assistantMessageId = crypto.randomUUID();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      toolCalls: [],
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, assistantMessage]);

    const ac = new AbortController();
    abortControllerRef.current = ac;

    const chatQuery = (token: string | null) =>
      fetch("/api/v1/chat/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          message: content.trim(),
          conversation_id: conversationId,
        }),
        signal: ac.signal,
      });

    try {
      let response = await chatQuery(getAccessToken());
      if (response.status === 401) {
        const refreshed = await attemptTokenRefresh();
        if (refreshed) {
          response = await chatQuery(getAccessToken());
        }
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          const data = line.slice(6);
          if (!data || data === "[DONE]") continue;

          try {
            const event: StreamEvent = JSON.parse(data);

            if (event.type === "token") {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: msg.content + event.content }
                    : msg
                )
              );
            } else if (event.type === "tool_call") {
              const toolUseId = event.tool_use_id || crypto.randomUUID();
              const name = event.name || "";
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? {
                        ...msg,
                        toolCalls: [
                          ...(msg.toolCalls || []),
                          { toolUseId, name, status: "pending" as const },
                        ],
                      }
                    : msg
                )
              );
            } else if (event.type === "tool_result") {
              const tid = event.tool_use_id;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? {
                        ...msg,
                        toolCalls: msg.toolCalls?.map((tc) =>
                          tid && tc.toolUseId === tid
                            ? { ...tc, status: "done" as const }
                            : tc
                        ),
                      }
                    : msg
                )
              );
            } else if (event.type === "done") {
              if (conversationId !== event.content) {
                setConversationId(event.content || null);
                options.onConversationIdChange?.(event.content || "");
              }
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: msg.content + "\n\n[Response cancelled]",
                }
              : msg
          )
        );
      } else {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content:
                    msg.content + "\n\n[Sorry, something went wrong. Please try again.]",
                }
              : msg
          )
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, options]);

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isLoading,
    conversationId,
    sendMessage,
    cancel,
    clearMessages,
  };
}
