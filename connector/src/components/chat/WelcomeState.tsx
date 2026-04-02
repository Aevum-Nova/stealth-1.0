import { Link } from "react-router-dom";
import { ChevronRight, Sun } from "lucide-react";
import { useMemo, useState } from "react";

import { useAuth } from "@/hooks/use-auth";

import { ChatComposer } from "./ChatComposer";

interface WelcomeStateProps {
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
}

const suggestedPrompts = [
  "What is my most useful trigger?",
  "Show me all open feature requests",
  "What trigger should I add?",
  "Summarize my signal volume",
  "Which connectors are active?",
];

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function firstName(fullName: string | undefined): string {
  if (!fullName?.trim()) return "there";
  return fullName.trim().split(/\s+/)[0] ?? "there";
}

export function WelcomeState({ onSendMessage, isLoading }: WelcomeStateProps) {
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const greeting = useMemo(() => timeGreeting(), []);
  const name = firstName(user?.name);

  const send = () => {
    const t = input.trim();
    if (!t || isLoading) return;
    onSendMessage(t);
    setInput("");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center px-4 py-8 sm:py-10">
      <div className="flex w-full max-w-[42rem] flex-1 flex-col items-center justify-center">
        <div className="mb-10 w-full text-center sm:mb-14">
          <div className="mb-6 flex items-center justify-center gap-3 sm:gap-4">
            <Sun
              className="size-7 shrink-0 text-[var(--chat-accent-warm)] sm:size-8"
              strokeWidth={1.25}
            />
            <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-[var(--ink)] sm:text-3xl md:text-[2rem]">
              {greeting}, {name}.
            </h1>
          </div>
        </div>

        <div className="w-full max-w-[42rem]">
          <ChatComposer
            value={input}
            onChange={setInput}
            onSend={send}
            disabled={isLoading}
            autoFocus
          />
        </div>

        <Link
          to="/connectors"
          className="mt-4 flex w-full max-w-[42rem] items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--surface-subtle)] px-4 py-3 text-left text-[13px] text-[var(--ink-soft)] transition-colors hover:border-[var(--line-muted)] hover:bg-[var(--surface-hover)]"
        >
          <span>Connect your data sources</span>
          <ChevronRight className="size-4 shrink-0 text-[var(--ink-muted)]" />
        </Link>

        <div className="mt-10 flex w-full max-w-[42rem] flex-wrap justify-center gap-2">
          {suggestedPrompts.map((prompt, i) => (
            <button
              key={i}
              type="button"
              disabled={isLoading}
              onClick={() => onSendMessage(prompt)}
              className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-1.5 text-[12px] text-[var(--ink-soft)] transition-colors hover:border-[var(--line-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
