/**
 * Lightweight LaTeX syntax tokenizer used by the source viewer
 * and the LeftReviewPanel's LaTeX inspect view.
 */

export type TokenKind = "command" | "brace" | "comment" | "math" | "text";

export interface Token {
  text: string;
  kind: TokenKind;
}

export function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    if (src[i] === "%") {
      const end = src.indexOf("\n", i);
      const slice = end === -1 ? src.slice(i) : src.slice(i, end + 1);
      tokens.push({ text: slice, kind: "comment" });
      i += slice.length;
      continue;
    }
    if (src[i] === "$") {
      const close = src.indexOf("$", i + 1);
      if (close !== -1) {
        tokens.push({ text: src.slice(i, close + 1), kind: "math" });
        i = close + 1;
        continue;
      }
    }
    if (src[i] === "\\") {
      let end = i + 1;
      while (end < src.length && /[a-zA-Z]/.test(src[end])) end++;
      if (end === i + 1) end++;
      tokens.push({ text: src.slice(i, end), kind: "command" });
      i = end;
      continue;
    }
    if (src[i] === "{" || src[i] === "}") {
      tokens.push({ text: src[i], kind: "brace" });
      i++;
      continue;
    }
    let end = i;
    while (
      end < src.length &&
      src[end] !== "%" &&
      src[end] !== "$" &&
      src[end] !== "\\" &&
      src[end] !== "{" &&
      src[end] !== "}"
    ) end++;
    tokens.push({ text: src.slice(i, end), kind: "text" });
    i = end;
  }
  return tokens;
}

export const KIND_CLASS: Record<TokenKind, string> = {
  command: "text-blue-500 dark:text-blue-400",
  brace:   "text-slate-400 dark:text-slate-500",
  comment: "text-emerald-600 dark:text-emerald-400 italic",
  math:    "text-violet-600 dark:text-violet-400",
  text:    "",
};
