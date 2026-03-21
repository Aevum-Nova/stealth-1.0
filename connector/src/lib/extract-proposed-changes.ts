import type { ProposedChange } from "@/types/agent";

/**
 * Extract proposed code changes from streamed/text content.
 * Tries JSON block first, then fallback to "# Proposed Changes for path" + code block pattern.
 */
export function extractProposedChangesFromText(text: string): ProposedChange[] | null {
  const fromJson = extractFromJsonBlock(text);
  if (fromJson) return fromJson;
  return extractFromMarkdownPattern(text);
}

function extractFromJsonBlock(text: string): ProposedChange[] | null {
  const match = text.match(/```json\s*\n([\s\S]*?)```/);
  if (!match) return null;

  try {
    const data = JSON.parse(match[1].trim());
    const arr = Array.isArray(data) ? data : [data];
    const changes: ProposedChange[] = [];

    for (const item of arr) {
      if (!item || typeof item !== "object" || !("file_path" in item)) continue;

      if ("search_replace" in item && Array.isArray(item.search_replace)) {
        changes.push({
          file_path: String(item.file_path),
          content: "",
          reason: String(item.reason ?? ""),
          search_replace: item.search_replace.map(
            (sr: { search: string; replace: string }) => ({
              search: String(sr.search),
              replace: String(sr.replace),
            }),
          ),
        });
      } else if ("content" in item) {
        changes.push({
          file_path: String(item.file_path),
          content: String(item.content),
          reason: String(item.reason ?? ""),
        });
      }
    }

    return changes.length > 0 ? changes : null;
  } catch {
    return null;
  }
}

/**
 * Fallback: extract from "# Proposed Changes for path/to/file" + ```lang code block.
 * LLMs sometimes use this instead of the JSON format.
 */
function extractFromMarkdownPattern(text: string): ProposedChange[] | null {
  const pattern =
    /#+\s*Proposed Changes? (?:for\s+)?([^\n]+)\s*\n+```\w*\n([\s\S]*?)```/i;
  const match = text.match(pattern);
  if (match) {
    const filePath = match[1].trim();
    const content = match[2].replace(/\r\n/g, "\n").trim();
    if (filePath && content) {
      return [{ file_path: filePath, content, reason: "" }];
    }
  }

  const FILE_EXT =
    "(?:jsx?|tsx?|css|scss|html|py|rb|go|rs|java|json|ya?ml|md|toml|sh|sql|svelte|vue)";
  const broad = new RegExp(
    `(?:^|\\n)#*\\s*.*?([\\w./-]+\\.${FILE_EXT})[:\\s]*\\n+\`\`\`\\w*\\n([\\s\\S]*?)\`\`\``,
    "i",
  );
  const broadMatch = text.match(broad);
  if (broadMatch) {
    const filePath = broadMatch[1].trim();
    const content = broadMatch[2].replace(/\r\n/g, "\n").trim();
    if (filePath && content) {
      return [{ file_path: filePath, content, reason: "" }];
    }
  }

  return null;
}
