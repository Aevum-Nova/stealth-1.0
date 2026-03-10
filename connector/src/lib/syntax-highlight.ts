type TokenType =
  | "keyword"
  | "type"
  | "string"
  | "comment"
  | "number"
  | "punctuation"
  | "operator"
  | "function"
  | "property"
  | "decorator"
  | "tag"
  | "attr"
  | "plain";

interface Token {
  type: TokenType;
  value: string;
}

const KEYWORDS = new Set([
  "abstract", "as", "async", "await", "break", "case", "catch", "class",
  "const", "continue", "debugger", "default", "delete", "do", "else",
  "enum", "export", "extends", "finally", "for", "from", "function",
  "get", "if", "implements", "import", "in", "instanceof", "interface",
  "let", "new", "of", "package", "private", "protected", "public",
  "readonly", "return", "set", "static", "super", "switch", "this",
  "throw", "try", "typeof", "var", "void", "while", "with", "yield",
  // Python
  "def", "elif", "except", "lambda", "pass", "raise", "with", "assert",
  "global", "nonlocal", "and", "or", "not", "is", "in",
  // Rust
  "fn", "impl", "mod", "pub", "use", "crate", "self", "mut", "ref",
  "loop", "match", "move", "struct", "trait", "where",
  // Go
  "func", "go", "chan", "defer", "fallthrough", "range", "select", "type",
  // Common
  "true", "false", "null", "undefined", "None", "True", "False", "nil",
  "self", "Self",
]);

const BUILTIN_TYPES = new Set([
  "string", "number", "boolean", "object", "any", "void", "never",
  "unknown", "Array", "Map", "Set", "Promise", "Record", "Partial",
  "Required", "Omit", "Pick", "Exclude", "Extract", "Readonly",
  "int", "float", "str", "bool", "list", "dict", "tuple", "bytes",
  "i32", "i64", "u32", "u64", "f32", "f64", "usize", "isize",
  "String", "Vec", "Option", "Result", "Box", "Rc", "Arc",
  "React", "JSX", "HTMLElement", "Event", "Error",
]);

const patterns: [RegExp, TokenType][] = [
  // Comments
  [/^\/\/.*/, "comment"],
  [/^#(?!!)[^\n]*/, "comment"],
  [/^\/\*[\s\S]*?\*\//, "comment"],
  // Strings
  [/^"(?:[^"\\]|\\.)*"/, "string"],
  [/^'(?:[^'\\]|\\.)*'/, "string"],
  [/^`(?:[^`\\]|\\.)*`/, "string"],
  // Decorators / attributes
  [/^@\w+/, "decorator"],
  // Numbers
  [/^0[xX][0-9a-fA-F]+/, "number"],
  [/^0[bB][01]+/, "number"],
  [/^\d+\.?\d*(?:[eE][+-]?\d+)?/, "number"],
  // JSX/HTML tags
  [/^<\/?[A-Z]\w*/, "tag"],
  [/^<\/?[a-z][\w-]*/, "tag"],
  // Operators
  [/^(?:=>|===|!==|==|!=|<=|>=|&&|\|\||\.{3}|\?\?|\?\.|\+\+|--|[+\-*/%&|^~!<>=?:])/, "operator"],
  // Punctuation
  [/^[{}()\[\];,.]/, "punctuation"],
  // Words (identifiers, keywords, types)
  [/^\w+/, "plain"],
  // Whitespace
  [/^\s+/, "plain"],
  // Anything else
  [/^[^\s\w]/, "punctuation"],
];

function classifyWord(word: string, nextChar: string): TokenType {
  if (KEYWORDS.has(word)) return "keyword";
  if (BUILTIN_TYPES.has(word)) return "type";
  if (/^[A-Z]/.test(word) && word.length > 1) return "type";
  if (nextChar === "(") return "function";
  return "plain";
}

function tokenize(code: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;

  while (pos < code.length) {
    let matched = false;
    for (const [re, type] of patterns) {
      const m = code.slice(pos).match(re);
      if (m) {
        let value = m[0];
        let finalType = type;

        if (type === "plain" && /^\w+$/.test(value)) {
          const nextChar = code[pos + value.length] || "";
          finalType = classifyWord(value, nextChar);
        }

        tokens.push({ type: finalType, value });
        pos += value.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      tokens.push({ type: "plain", value: code[pos] });
      pos++;
    }
  }

  return tokens;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function highlightLine(line: string): string {
  const tokens = tokenize(line);
  return tokens
    .map((t) => {
      const escaped = escapeHtml(t.value);
      if (t.type === "plain") return escaped;
      return `<span class="syn-${t.type}">${escaped}</span>`;
    })
    .join("");
}

export function highlightCode(code: string): string {
  return code
    .split("\n")
    .map((line) => highlightLine(line))
    .join("\n");
}
