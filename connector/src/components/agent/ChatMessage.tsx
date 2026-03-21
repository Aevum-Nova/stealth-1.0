import { memo, useMemo, useState } from "react";
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

/* ── Stripping helpers (for proposed-changes JSON / markdown) ── */

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
  let cleaned = text.replace(/```json\s*\n\[[\s\S]*?\]\s*\n```/g, "");
  cleaned = stripProposedChangesMarkdown(cleaned);
  const idx = cleaned.lastIndexOf("```json");
  if (idx !== -1) {
    const afterFence = cleaned.slice(idx + 7);
    if (!afterFence.includes("```")) {
      cleaned = cleaned.slice(0, idx);
    }
  }
  cleaned = cleaned.replace(/\n*\d+ proposed changes?\s*$/i, "");
  return cleaned.trim();
}

/* ── Segment parser ── */

type Segment =
  | { type: "text"; content: string }
  | { type: "code"; language: string; code: string };

function parseSegments(text: string, isStreaming: boolean): Segment[] {
  const segments: Segment[] = [];
  const fenceRe = /```(\w*)\n/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRe.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }

    const lang = match[1] || "plaintext";
    const codeStart = match.index + match[0].length;
    const closeIndex = text.indexOf("```", codeStart);

    if (closeIndex !== -1) {
      segments.push({ type: "code", language: lang, code: text.slice(codeStart, closeIndex) });
      lastIndex = closeIndex + 3;
      fenceRe.lastIndex = lastIndex;
    } else if (isStreaming) {
      segments.push({ type: "code", language: lang, code: text.slice(codeStart) });
      lastIndex = text.length;
      break;
    } else {
      fenceRe.lastIndex = codeStart;
      break;
    }
  }

  if (lastIndex < text.length) {
    const trailing = text.slice(lastIndex);
    if (trailing.trim()) {
      segments.push({ type: "text", content: trailing });
    }
  }

  return segments;
}

/* ── Prose-only markdown renderer (no code fences) ── */

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderMarkdownText(text: string): string {
  let html = escapeHtml(text);

  html = html.replace(/`([^`]+)`/g, '<code class="chat-inline-code">$1</code>');

  html = html.replace(/^#### (.+)$/gm, '<strong class="chat-h4">$1</strong>');
  html = html.replace(/^### (.+)$/gm, '<strong class="chat-h3">$1</strong>');
  html = html.replace(/^## (.+)$/gm, '<strong class="chat-h2">$1</strong>');
  html = html.replace(/^# (.+)$/gm, '<strong class="chat-h1">$1</strong>');

  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  html = html.replace(/^- (.+)$/gm, '<span class="chat-li">$1</span>');
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<span class="chat-li">$1</span>');

  html = html.replace(
    /\n\n/g,
    '<br class="chat-break"/><br class="chat-break"/>',
  );
  html = html.replace(/\n/g, "<br/>");

  return html;
}

/* ── CodeBlockPanel (interactive React component) ── */

function CodeBlockPanel({
  language,
  code,
  isStreamingBlock = false,
}: {
  language: string;
  code: string;
  isStreamingBlock?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const trimmed = code.trimEnd();
  const lines = trimmed ? trimmed.split("\n") : [];
  const lineCount = lines.length;

  const highlighted = useMemo(
    () => lines.map((l) => highlightLine(l)),
    [trimmed],
  );

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(trimmed);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-[#e5e5e5] bg-[#fafafa]">
      <div className="flex items-center gap-1 px-3 py-1.5 text-[11px]">
        <button
          className="flex flex-1 items-center gap-1.5 text-left"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <ChevronDown className="size-3 shrink-0 text-[var(--ink-muted)]" />
          ) : (
            <ChevronRight className="size-3 shrink-0 text-[var(--ink-muted)]" />
          )}
          <span className="font-mono text-[var(--ink-muted)]">
            {language || "code"}
          </span>
          {!expanded && (
            <span className="tabular-nums text-[var(--ink-muted)]">
              · {lineCount} {lineCount === 1 ? "line" : "lines"}
            </span>
          )}
        </button>
        <button
          className="rounded p-1 text-[var(--ink-muted)] transition-colors hover:bg-[#e5e5e5] hover:text-[var(--ink)]"
          onClick={handleCopy}
          title="Copy code"
        >
          {copied ? (
            <Check className="size-3" />
          ) : (
            <Copy className="size-3" />
          )}
        </button>
      </div>

      {expanded && (
        <div
          className="overflow-auto border-t border-[#e5e5e5] bg-white"
          style={{ maxHeight: "400px" }}
        >
          {highlighted.map((html, i) => (
            <div key={i} className="flex text-[12px] leading-[20px]">
              <span className="w-10 shrink-0 select-none pr-3 text-right font-mono text-[var(--ink-muted)] opacity-40">
                {i + 1}
              </span>
              <pre className="min-w-0 flex-1 whitespace-pre-wrap break-all pr-3 font-mono">
                <code dangerouslySetInnerHTML={{ __html: html }} />
              </pre>
            </div>
          ))}
          {isStreamingBlock && (
            <div className="flex text-[12px] leading-[20px]">
              <span className="w-10 shrink-0" />
              <span
                className="inline-block h-[14px] w-[2px] bg-[var(--ink)] [animation:cursor-blink_1s_ease-in-out_infinite]"
                aria-hidden
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Segment-based message content renderer ── */

function MessageContent({
  content,
  isStreaming,
}: {
  content: string;
  isStreaming: boolean;
}) {
  const segments = useMemo(
    () => parseSegments(content, isStreaming),
    [content, isStreaming],
  );

  const lastIdx = segments.length - 1;
  const lastSegment = segments[lastIdx];
  const cursorInCodeBlock =
    isStreaming && lastSegment?.type === "code";
  const cursorInText =
    isStreaming && (!lastSegment || lastSegment.type === "text");

  return (
    <div className="chat-message-content text-[14px] leading-snug text-[var(--ink)]">
      {segments.map((seg, i) => {
        if (seg.type === "code") {
          return (
            <CodeBlockPanel
              key={i}
              language={seg.language}
              code={seg.code}
              isStreamingBlock={cursorInCodeBlock && i === lastIdx}
            />
          );
        }
        const html = renderMarkdownText(seg.content);
        return (
          <span key={i} dangerouslySetInnerHTML={{ __html: html }} />
        );
      })}
      {cursorInText && (
        <span
          className="ml-0.5 inline-block h-[1em] w-[2px] shrink-0 align-baseline bg-[var(--ink)] [animation:cursor-blink_1s_ease-in-out_infinite]"
          aria-hidden
        />
      )}
    </div>
  );
}

/* ── FileChangeCard (for proposed changes / Apply to PR) ── */

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

function SearchReplaceDiff({
  patches,
}: {
  patches: { search: string; replace: string }[];
}) {
  return (
    <div className="overflow-auto rounded-b-lg border border-t-0 border-[#e5e5e5] bg-white">
      {patches.map((patch, pi) => (
        <div key={pi} className={pi > 0 ? "border-t border-[#e5e5e5]" : ""}>
          {patch.search.split("\n").map((line, i) => (
            <div
              key={`s-${pi}-${i}`}
              className="flex text-[11px] leading-[18px] bg-[#fff0f0]"
            >
              <span className="w-5 shrink-0 select-none text-center font-mono text-red-400">
                −
              </span>
              <pre className="min-w-0 flex-1 whitespace-pre-wrap break-all pr-2 font-mono text-red-700">
                <code>{line}</code>
              </pre>
            </div>
          ))}
          {patch.replace.split("\n").map((line, i) => (
            <div
              key={`r-${pi}-${i}`}
              className="flex text-[11px] leading-[18px] bg-[#f0fff0]"
            >
              <span className="w-5 shrink-0 select-none text-center font-mono text-green-500">
                +
              </span>
              <pre className="min-w-0 flex-1 whitespace-pre-wrap break-all pr-2 font-mono text-green-700">
                <code>{line}</code>
              </pre>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function FileChangeCard({ change }: { change: ProposedChange }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const hasDiffs = change.search_replace && change.search_replace.length > 0;
  const lineCount = hasDiffs
    ? change.search_replace!.reduce(
        (sum, sr) => sum + sr.replace.split("\n").length,
        0,
      )
    : estimateLines(change.content);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = hasDiffs
      ? change
          .search_replace!.map(
            (sr) =>
              `<<<<<<< SEARCH\n${sr.search}\n=======\n${sr.replace}\n>>>>>>> REPLACE`,
          )
          .join("\n\n")
      : change.content;
    await navigator.clipboard.writeText(text);
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
          {hasDiffs
            ? `${change.search_replace!.length} change${change.search_replace!.length > 1 ? "s" : ""}`
            : `+${lineCount}`}
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
          {hasDiffs ? (
            <SearchReplaceDiff patches={change.search_replace!} />
          ) : (
            <HighlightedCodeBlock code={change.content} />
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main ChatMessage component ── */

const ChatMessage = memo(function ChatMessage({
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
        <MessageContent content={displayContent} isStreaming={isStreaming} />
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
});

export default ChatMessage;
