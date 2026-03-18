import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileCode,
  Copy,
  Check,
  GitPullRequest,
} from "lucide-react";

import { highlightLine } from "@/lib/syntax-highlight";
import type {
  ChatMessage as ChatMessageType,
  ProposedChange,
} from "@/types/agent";

/** Strip "# Proposed Changes for X" + following code block (shows in FileChangeCard instead) */
function stripProposedChangesMarkdown(text: string): string {
  return text
    .replace(
      /#+\s*Proposed Changes? (?:for\s+)?[^\n]+\s*\n+```\w*\n[\s\S]*?```/gi,
      "",
    )
    .trim();
}

function stripJsonBlocks(text: string): string {
  let cleaned = text.replace(/```json\s*\n\[[\s\S]*?\]\s*\n```/g, "").trim();
  cleaned = stripProposedChangesMarkdown(cleaned);
  cleaned = cleaned.replace(/\n*\d+ proposed changes?\s*$/i, "").trim();
  return cleaned;
}

function stripStreamingJsonBlock(text: string): string {
  // Strip complete JSON array code blocks
  let cleaned = text.replace(/```json\s*\n\[[\s\S]*?\]\s*\n```/g, "");
  // Strip "# Proposed Changes for X" + code block
  cleaned = stripProposedChangesMarkdown(cleaned);
  // Strip any unclosed ```json block (proposed changes still being streamed)
  const idx = cleaned.lastIndexOf("```json");
  if (idx !== -1) {
    const afterFence = cleaned.slice(idx + 7);
    if (!afterFence.includes("```")) {
      cleaned = cleaned.slice(0, idx);
    }
  }
  // Strip trailing "X proposed changes" text
  cleaned = cleaned.replace(/\n*\d+ proposed changes?\s*$/i, "");
  return cleaned.trim();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderCodeBlock(code: string): string {
  const rawCode = code
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
  const lines = rawCode.trimEnd().split("\n");
  const rendered = lines
    .map((line: string, i: number) => {
      const highlighted = highlightLine(line);
      return `<div class="chat-code-line"><span class="chat-line-num">${i + 1}</span><span class="chat-line-content">${highlighted}</span></div>`;
    })
    .join("");
  return `<div class="chat-code-block">${rendered}</div>`;
}

function renderMarkdown(text: string, isStreaming = false): string {
  let html = escapeHtml(text);

  // Fenced code blocks with syntax highlighting (complete blocks)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) =>
    renderCodeBlock(code),
  );

  // During streaming: trailing unclosed code block (```lang\n... without closing)
  if (isStreaming) {
    html = html.replace(/```(\w*)\n([\s\S]*)$/, (_m, _lang, code) =>
      renderCodeBlock(code),
    );
  }

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="chat-inline-code">$1</code>');

  // Headers
  html = html.replace(/^### (.+)$/gm, '<strong class="chat-h3">$1</strong>');
  html = html.replace(/^## (.+)$/gm, '<strong class="chat-h2">$1</strong>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Lists
  html = html.replace(/^- (.+)$/gm, '<span class="chat-li">$1</span>');
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<span class="chat-li">$1</span>');

  // Line breaks
  html = html.replace(
    /\n\n/g,
    '<br class="chat-break"/><br class="chat-break"/>',
  );
  html = html.replace(/\n/g, "<br/>");

  return html;
}

function estimateLines(content: string): number {
  return content.split("\n").length;
}

function HighlightedCodeBlock({
  code,
  maxHeight = "400px",
}: {
  code: string;
  maxHeight?: string;
}) {
  const lines = code.split("\n");
  const highlighted = useMemo(() => lines.map((l) => highlightLine(l)), [code]);

  return (
    <div
      className="overflow-auto rounded-b-lg border border-t-0 border-[#e5e5e5] bg-white"
      style={{ maxHeight }}
    >
      {highlighted.map((html, i) => (
        <div key={i} className="flex text-[11px] leading-[18px]">
          <span className="w-9 shrink-0 select-none pr-2 text-right font-mono text-[var(--ink-muted)] opacity-40">
            {i + 1}
          </span>
          <pre className="min-w-0 flex-1 whitespace-pre-wrap break-all pr-2 font-mono">
            <code dangerouslySetInnerHTML={{ __html: html }} />
          </pre>
        </div>
      ))}
    </div>
  );
}

function FileChangeCard({ change }: { change: ProposedChange }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const lineCount = estimateLines(change.content);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(change.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-[#e5e5e5] bg-white">
      <button
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-[#fafafa]"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="size-3.5 shrink-0 text-[var(--ink-muted)]" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0 text-[var(--ink-muted)]" />
        )}
        <FileCode className="size-3.5 shrink-0 text-[var(--ink-soft)]" />
        <code className="min-w-0 flex-1 truncate text-[13px] text-[var(--ink)]">
          {change.file_path}
        </code>
        <span className="shrink-0 text-[11px] tabular-nums text-[var(--ink-muted)]">
          +{lineCount}
        </span>
      </button>

      {change.reason && (
        <div className="border-t border-[#e5e5e5] bg-white px-3.5 py-2">
          <p className="text-[12px] leading-snug text-[var(--ink-muted)]">
            {change.reason}
          </p>
        </div>
      )}

      {expanded && (
        <div className="relative border-t border-[#e5e5e5] bg-white">
          <button
            className="absolute right-2.5 top-2.5 z-10 rounded-lg bg-white p-1.5 text-[var(--ink-muted)] transition-colors hover:bg-[#eeeeee] hover:text-[var(--ink)]"
            onClick={handleCopy}
            title="Copy to clipboard"
          >
            {copied ? (
              <Check className="size-3 text-[var(--ink)]" />
            ) : (
              <Copy className="size-3" />
            )}
          </button>
          <HighlightedCodeBlock code={change.content} />
        </div>
      )}
    </div>
  );
}

export default function ChatMessage({
  message,
  isStreaming = false,
  onApplyToPr,
  canApplyToPr = false,
  isApplyingToPr = false,
}: {
  message: ChatMessageType;
  isStreaming?: boolean;
  onApplyToPr?: (changes: ProposedChange[]) => void;
  canApplyToPr?: boolean;
  isApplyingToPr?: boolean;
}) {
  const isUser = message.role === "user";
  const changes = message.proposed_changes;
  const hasChanges = changes && changes.length > 0;

  const displayContent = useMemo(() => {
    if (isUser) return message.content;
    if (hasChanges) return stripJsonBlocks(message.content);
    if (isStreaming) return stripStreamingJsonBlock(message.content);
    return message.content;
  }, [isUser, hasChanges, isStreaming, message.content]);

  const renderedHtml = useMemo(
    () =>
      !isUser && displayContent
        ? renderMarkdown(displayContent, isStreaming)
        : "",
    [isUser, displayContent, isStreaming],
  );

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="chat-user-bubble max-w-[85%] rounded-lg bg-[#f0f0f0] px-4 py-2.5">
          <p className="whitespace-pre-wrap text-[14px] leading-snug text-[var(--ink)]">
            {displayContent}
          </p>
          <time className="mt-1 block text-[11px] text-[var(--ink-muted)]">
            {new Date(message.created_at).toLocaleTimeString()}
          </time>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {displayContent !== undefined && displayContent !== null && (
        <div className="chat-message-content text-[14px] leading-snug text-[var(--ink)]">
          <span dangerouslySetInnerHTML={{ __html: renderedHtml }} />
          {isStreaming && (
            <span
              className="chat-streaming-cursor ml-0.5 inline-block h-[1em] w-[2px] shrink-0 align-baseline bg-[var(--ink)] [animation:cursor-blink_1s_ease-in-out_infinite]"
              aria-hidden
            />
          )}
        </div>
      )}

      {hasChanges && (
        <div className="space-y-2.5">
          <div className="space-y-1.5 rounded-lg border border-[#e5e5e5] bg-white px-4 py-3">
            <p className="flex items-center gap-2 text-[12px] text-[var(--ink-muted)]">
              <FileCode className="size-3.5" />
              {changes.length} proposed{" "}
              {changes.length === 1 ? "file" : "files"}
            </p>
            {changes.map((change, i) => (
              <FileChangeCard
                key={`${change.file_path}-${i}`}
                change={change}
              />
            ))}
          </div>
          {canApplyToPr && onApplyToPr && (
            <button
              className="flex items-center gap-1.5 rounded-lg bg-[var(--ink)] px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
              disabled={isApplyingToPr}
              onClick={() => onApplyToPr(changes!)}
            >
              <GitPullRequest className="size-3.5" />
              {isApplyingToPr ? "Applying..." : "Apply to PR"}
            </button>
          )}
        </div>
      )}

      <time className="block text-[11px] text-[var(--ink-muted)]">
        {new Date(message.created_at).toLocaleTimeString()}
      </time>
    </div>
  );
}
