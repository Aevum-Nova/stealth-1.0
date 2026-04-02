import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, Copy } from "lucide-react";

import { highlightLine } from "@/lib/syntax-highlight";

/** Collapse huge blank runs (common after stripping JSON) to a single paragraph gap.
 * Skips ```fenced``` regions so code formatting is preserved. */
export function compactChatWhitespace(text: string): string {
  const fenceRe = /```[\w]*\n[\s\S]*?```/g;
  let result = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = fenceRe.exec(text)) !== null) {
    const before = text.slice(last, m.index);
    result += before
      .replace(/(?:\r?\n[\t ]*){3,}/g, "\n\n")
      .replace(/^\s+/, "")
      .replace(/\s+$/, "");
    result += m[0];
    last = m.index + m[0].length;
  }
  result += text
    .slice(last)
    .replace(/(?:\r?\n[\t ]*){3,}/g, "\n\n")
    .replace(/^\s+/, "")
    .replace(/\s+$/, "");
  return result;
}

type Segment =
  | { type: "text"; content: string }
  | { type: "code"; language: string; code: string };

export function parseSegments(text: string, isStreaming: boolean): Segment[] {
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderInlineMarkdown(cell: string): string {
  let html = escapeHtml(cell);
  html = html.replace(/`([^`]+)`/g, '<code class="chat-inline-code">$1</code>');
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  return html;
}

function isTableRowLine(line: string): boolean {
  const t = line.trim();
  if (!t.includes("|")) return false;
  const parts = t.split("|").filter((c) => c.trim() !== "");
  return parts.length >= 2;
}

function isTableSeparatorLine(line: string): boolean {
  const t = line.trim();
  if (!t.includes("|") || !t.includes("-")) return false;
  const inner = t
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|");
  return inner.every((part) => /^[\s\-:]+$/.test(part) && /-/.test(part));
}

function parseTableRow(row: string): string[] {
  return row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function markdownTableToHtml(tableLines: string[]): string {
  if (tableLines.length < 2) {
    return escapeHtml(tableLines.join("\n"));
  }
  const headerCells = parseTableRow(tableLines[0]);
  const bodyRows = tableLines.slice(2).map(parseTableRow);
  const colCount = headerCells.length;

  let html =
    '<div class="chat-table-wrap"><table class="chat-md-table"><thead><tr>';
  for (const h of headerCells) {
    html += `<th>${renderInlineMarkdown(h)}</th>`;
  }
  html += "</tr></thead><tbody>";
  for (const row of bodyRows) {
    html += "<tr>";
    for (let j = 0; j < colCount; j++) {
      const cell = row[j] ?? "";
      html += `<td>${renderInlineMarkdown(cell)}</td>`;
    }
    html += "</tr>";
  }
  html += "</tbody></table></div>";
  return html;
}

/** Prose markdown: headings, lists, bold, tables; fenced code is handled in segments. */
export function renderMarkdownText(text: string): string {
  const lines = text.split("\n");
  const pieces: string[] = [];
  let buf: string[] = [];
  let i = 0;

  const flushProse = () => {
    if (buf.length) {
      pieces.push(renderMarkdownTextProse(buf.join("\n")));
      buf = [];
    }
  };

  while (i < lines.length) {
    if (
      i + 1 < lines.length &&
      isTableRowLine(lines[i]) &&
      isTableSeparatorLine(lines[i + 1])
    ) {
      flushProse();
      const tbl: string[] = [];
      while (i < lines.length && isTableRowLine(lines[i])) {
        tbl.push(lines[i]);
        i++;
      }
      pieces.push(markdownTableToHtml(tbl));
      continue;
    }
    buf.push(lines[i]);
    i++;
  }
  flushProse();
  return pieces.join("");
}

function renderMarkdownTextProse(text: string): string {
  let html = escapeHtml(text);

  html = html.replace(/`([^`]+)`/g, '<code class="chat-inline-code">$1</code>');

  html = html.replace(/^#### (.+)$/gm, '<strong class="chat-h4">$1</strong>');
  html = html.replace(/^### (.+)$/gm, '<strong class="chat-h3">$1</strong>');
  html = html.replace(/^## (.+)$/gm, '<strong class="chat-h2">$1</strong>');
  html = html.replace(/^# (.+)$/gm, '<strong class="chat-h1">$1</strong>');

  html = html.replace(/^- (.+)$/gm, '<span class="chat-li">$1</span>');
  html = html.replace(/^\* (.+)$/gm, '<span class="chat-li">$1</span>');
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<span class="chat-li">$1</span>');

  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  html = html.replace(
    /\n\n+/g,
    '<span class="chat-para-gap" aria-hidden="true"></span>',
  );
  html = html.replace(/\n/g, "<br/>");

  return html;
}

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
    <div className="my-3 overflow-hidden rounded-lg border border-[#e5e5e5] bg-[#fafafa]">
      <div className="flex items-center gap-1 px-3 py-1.5 text-[11px]">
        <button
          type="button"
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
          type="button"
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
          {highlighted.map((lineHtml, idx) => (
            <div key={idx} className="flex text-[12px] leading-[20px]">
              <span className="w-10 shrink-0 select-none pr-3 text-right font-mono text-[var(--ink-muted)] opacity-40">
                {idx + 1}
              </span>
              <pre className="min-w-0 flex-1 whitespace-pre-wrap break-all pr-3 font-mono">
                <code dangerouslySetInnerHTML={{ __html: lineHtml }} />
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

export function MessageContent({
  content,
  isStreaming,
}: {
  content: string;
  isStreaming: boolean;
}) {
  const normalizedContent = useMemo(
    () => compactChatWhitespace(content),
    [content],
  );

  const segments = useMemo(
    () => parseSegments(normalizedContent, isStreaming),
    [normalizedContent, isStreaming],
  );

  const lastIdx = segments.length - 1;
  const lastSegment = segments[lastIdx];
  const cursorInCodeBlock = isStreaming && lastSegment?.type === "code";
  const cursorInText = isStreaming && (!lastSegment || lastSegment.type === "text");

  return (
    <div className="chat-message-content text-[14px] leading-relaxed text-[var(--ink)]">
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
        return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
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
