/**
 * LaTeX 用の軽量シンタックス・トークナイザ。
 * LatexCodeEditor (textarea オーバーレイ式の IDE 風ソースエディタ) で使う。
 *
 * 出力は (kind, text) の連続。text を順に連結すると元の文字列に一致する (ロスレス)。
 * 改行・空白は "text" / "math" / "comment" 等に含まれた状態で返るので、エディタ側は
 * そのまま <span> として書き出せばよい。
 */

export type TokenKind =
  | "comment"
  | "command"
  | "envname"
  | "math"
  | "brace"
  | "bracket"
  | "number"
  | "special"
  | "string"
  | "text";

export interface Token {
  text: string;
  kind: TokenKind;
}

const SPECIAL_CHARS = new Set(["&", "_", "^", "~", "#"]);

/** \begin{name} / \end{name} の name の中身に許される文字 */
const ENV_NAME_RE = /^[a-zA-Z*]+$/;

/** プレーンテキスト走査の停止文字 */
function isBoundary(ch: string): boolean {
  return (
    ch === "%" ||
    ch === "$" ||
    ch === "\\" ||
    ch === "{" ||
    ch === "}" ||
    ch === "[" ||
    ch === "]" ||
    SPECIAL_CHARS.has(ch) ||
    (ch >= "0" && ch <= "9")
  );
}

export function tokenize(src: string): Token[] {
  const out: Token[] = [];
  const len = src.length;
  let i = 0;

  const push = (kind: TokenKind, text: string) => {
    if (!text) return;
    // 直前トークンと同種なら連結 (出力 span 数を減らす)
    const last = out[out.length - 1];
    if (last && last.kind === kind) {
      last.text += text;
    } else {
      out.push({ kind, text });
    }
  };

  while (i < len) {
    const ch = src[i];

    // ── コメント: % … EOL (改行は含めない) ──
    if (ch === "%") {
      let j = i;
      while (j < len && src[j] !== "\n") j++;
      push("comment", src.slice(i, j));
      i = j;
      continue;
    }

    // ── 表示数式: $$ … $$ ──
    if (ch === "$" && src[i + 1] === "$") {
      let j = i + 2;
      while (j < len) {
        if (src[j] === "\\" && j + 1 < len) { j += 2; continue; }
        if (src[j] === "$" && src[j + 1] === "$") { j += 2; break; }
        j++;
      }
      push("math", src.slice(i, j));
      i = j;
      continue;
    }

    // ── インライン数式: $ … $ ──
    if (ch === "$") {
      let j = i + 1;
      let closed = false;
      while (j < len) {
        if (src[j] === "\\" && j + 1 < len) { j += 2; continue; }
        if (src[j] === "$") { j++; closed = true; break; }
        if (src[j] === "\n") {
          // 改行を跨いだら未閉じとして打ち切り (見た目だけハイライト)
          break;
        }
        j++;
      }
      // closed でも未閉じでも math として塗る (未閉じは少しダサくても許容)
      void closed;
      push("math", src.slice(i, j));
      i = j;
      continue;
    }

    // ── \( … \) と \[ … \] ──
    if (ch === "\\" && (src[i + 1] === "(" || src[i + 1] === "[")) {
      const closeChar = src[i + 1] === "(" ? ")" : "]";
      let j = i + 2;
      while (j < len) {
        if (src[j] === "\\" && src[j + 1] === closeChar) { j += 2; break; }
        if (src[j] === "\\" && j + 1 < len) { j += 2; continue; }
        j++;
      }
      push("math", src.slice(i, j));
      i = j;
      continue;
    }

    // ── \begin{name} / \end{name} ── command + brace + envname の合成
    if (ch === "\\" && (src.startsWith("\\begin{", i) || src.startsWith("\\end{", i))) {
      const head = src.startsWith("\\begin{", i) ? "\\begin" : "\\end";
      push("command", head);
      i += head.length;
      // '{'
      push("brace", "{");
      i += 1;
      // name
      const close = src.indexOf("}", i);
      const nameEnd = close === -1 ? len : close;
      const name = src.slice(i, nameEnd);
      if (ENV_NAME_RE.test(name)) {
        push("envname", name);
      } else {
        push("text", name);
      }
      i = nameEnd;
      if (i < len && src[i] === "}") {
        push("brace", "}");
        i += 1;
      }
      continue;
    }

    // ── 通常コマンド: \foo / \, / \\ など ──
    if (ch === "\\") {
      let j = i + 1;
      if (j < len && /[a-zA-Z@]/.test(src[j])) {
        while (j < len && /[a-zA-Z@*]/.test(src[j])) j++;
      } else if (j < len) {
        // 単発 (バックスラッシュ + 1 文字: \, \; \! \\ \% など)
        j += 1;
      }
      push("command", src.slice(i, j));
      i = j;
      continue;
    }

    // ── 中括弧 ──
    if (ch === "{" || ch === "}") {
      push("brace", ch);
      i += 1;
      continue;
    }

    // ── 角括弧 (オプション引数) ──
    if (ch === "[" || ch === "]") {
      push("bracket", ch);
      i += 1;
      continue;
    }

    // ── 特殊文字 ──
    if (SPECIAL_CHARS.has(ch)) {
      push("special", ch);
      i += 1;
      continue;
    }

    // ── 数値 ──
    if (ch >= "0" && ch <= "9") {
      let j = i;
      while (j < len && ((src[j] >= "0" && src[j] <= "9") || src[j] === ".")) j++;
      push("number", src.slice(i, j));
      i = j;
      continue;
    }

    // ── プレーンテキスト ──
    let j = i;
    while (j < len && !isBoundary(src[j])) j++;
    if (j === i) j++; // セーフティ
    push("text", src.slice(i, j));
    i = j;
  }

  return out;
}

const HTML_ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPE[c]);
}

const KIND_CLASS: Record<TokenKind, string> = {
  comment: "tk-comment",
  command: "tk-command",
  envname: "tk-envname",
  math: "tk-math",
  brace: "tk-brace",
  bracket: "tk-bracket",
  number: "tk-number",
  special: "tk-special",
  string: "tk-string",
  text: "",
};

/** トークン列を <span class="tk-…"> 入りの HTML 文字列に変換する。 */
export function highlightLatexToHtml(src: string): string {
  const tokens = tokenize(src);
  let html = "";
  for (const tok of tokens) {
    const cls = KIND_CLASS[tok.kind];
    if (cls) {
      html += `<span class="${cls}">${escapeHtml(tok.text)}</span>`;
    } else {
      html += escapeHtml(tok.text);
    }
  }
  return html;
}
