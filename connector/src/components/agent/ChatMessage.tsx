import { memo, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileCode,
  Copy,
  Check,
  GitPullRequest,
} from "lucide-react";

import { compactChatWhitespace, MessageContent } from "@/lib/chat-message-content";
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
  return compactChatWhitespace(cleaned);
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
  return compactChatWhitespace(cleaned);
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
      className="proposed-file-code-scroll rounded-b-lg"
      style={{ maxHeight }}
    >
      {highlighted.map((html, i) => (
        <div key={i} className="proposed-file-code-line">
          <span className="proposed-file-line-num">{i + 1}</span>
          <pre>
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
    <div className="proposed-file-code-scroll rounded-b-lg">
      {patches.map((patch, pi) => (
        <div
          key={pi}
          className={`proposed-file-patch-block${pi > 0 ? " border-t border-[var(--line)]" : ""}`}
        >
          {patch.search.split("\n").map((line, i) => (
            <div key={`s-${pi}-${i}`} className="proposed-diff-row proposed-diff-row--del">
              <span className="proposed-diff-gutter">−</span>
              <pre>
                <code>{line}</code>
              </pre>
            </div>
          ))}
          {patch.replace.split("\n").map((line, i) => (
            <div key={`r-${pi}-${i}`} className="proposed-diff-row proposed-diff-row--add">
              <span className="proposed-diff-gutter">+</span>
              <pre>
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
    <div className="proposed-file-card">
      <button
        type="button"
        className="proposed-file-card__toggle"
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
        <div className="proposed-file-card__reason">
          <p>{change.reason}</p>
        </div>
      )}

      {expanded && (
        <div className="proposed-file-card__body">
          <button
            type="button"
            className="proposed-file-copy-btn"
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
    <div className="flex flex-col gap-5">
      {displayContent !== undefined && displayContent !== null && (
        <MessageContent content={displayContent} isStreaming={isStreaming} />
      )}

      {hasChanges && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 rounded-xl border border-[#e5e5e5] bg-white px-4 py-4 shadow-sm">
            <p className="flex items-center gap-2 text-[12px] font-medium text-[var(--ink-soft)]">
              <FileCode className="size-3.5 shrink-0 text-[var(--ink-muted)]" />
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
              type="button"
              className="flex w-fit items-center gap-1.5 rounded-lg bg-[var(--ink)] px-3.5 py-2 text-[12px] font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
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
