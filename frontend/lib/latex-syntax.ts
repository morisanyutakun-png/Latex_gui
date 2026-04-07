/**
 * LaTeX 用シンタックス・トークナイザ。
 * LatexCodeEditor (textarea オーバーレイ式の IDE 風ソースエディタ) で使う。
 *
 * 出力は (kind, text) の連続。text を順に連結すると元の文字列に一致する (ロスレス)。
 * コマンドは「種類」(sectioning / package / definition / textformat / mathop / command) に
 * 分けて返すので、エディタ側で色を細かく塗り分けられる。
 */

export type TokenKind =
  // 構造系
  | "comment"
  | "envname"
  // コマンド (細分化)
  | "cmd-section"   // \section, \subsection, \chapter, \paragraph 等
  | "cmd-package"   // \documentclass, \usepackage, \RequirePackage 等
  | "cmd-define"    // \newcommand, \def, \let, \newenvironment 等
  | "cmd-format"    // \textbf, \textit, \emph, \textcolor, \underline 等
  | "cmd-mathop"    // \frac, \sum, \int, \sin, \alpha, \mathbb 等 (代表的な数式コマンド)
  | "cmd-ref"       // \label, \ref, \cite, \pageref, \eqref 等
  | "command"       // 上記以外のコマンド
  // リテラル
  | "math"
  | "brace"
  | "bracket"
  | "number"
  | "dimension"     // 12pt, 2cm, 1.5em など (数値+単位)
  | "special"       // & _ ^ ~ #
  | "url"           // http(s)://...
  | "text";

export interface Token {
  text: string;
  kind: TokenKind;
}

const SPECIAL_CHARS = new Set(["&", "_", "^", "~", "#"]);
const ENV_NAME_RE = /^[a-zA-Z*]+$/;

// LaTeX dimension units
const DIMENSION_UNITS = [
  "pt", "mm", "cm", "em", "ex", "in", "bp", "pc", "dd", "cc", "sp", "mu",
];

// ── コマンド分類辞書 ──
// 末尾 "*" は無視してマッチ (例: \section* → \section と同じ扱い)
const SECTIONING_CMDS = new Set([
  "section", "subsection", "subsubsection",
  "chapter", "part", "paragraph", "subparagraph",
  "title", "author", "date", "maketitle",
]);

const PACKAGE_CMDS = new Set([
  "documentclass", "usepackage", "RequirePackage", "LoadClass",
  "input", "include", "includegraphics", "includeonly",
]);

const DEFINE_CMDS = new Set([
  "newcommand", "renewcommand", "providecommand",
  "def", "let", "edef", "gdef", "xdef",
  "newenvironment", "renewenvironment",
  "newtheorem", "newcounter", "newlength", "setlength",
  "newtcolorbox", "DeclareMathOperator", "DeclareRobustCommand",
  "definecolor", "newcolumntype", "newif",
]);

const FORMAT_CMDS = new Set([
  "textbf", "textit", "emph", "underline", "texttt", "textsc",
  "textsf", "textrm", "textnormal", "textsl", "textup",
  "textcolor", "color", "colorbox", "fcolorbox",
  "tiny", "scriptsize", "footnotesize", "small", "normalsize",
  "large", "Large", "LARGE", "huge", "Huge",
  "bfseries", "itshape", "slshape", "scshape", "upshape", "rmfamily", "sffamily", "ttfamily",
  "centering", "raggedright", "raggedleft", "noindent",
]);

const REF_CMDS = new Set([
  "label", "ref", "pageref", "eqref", "autoref", "hyperref",
  "cite", "citep", "citet", "bibliography", "bibliographystyle",
  "footnote", "footnotemark", "footnotetext",
]);

// ── 代表的な数式コマンド (フル列挙はしない。よく使うものだけ) ──
const MATHOP_CMDS = new Set([
  // 分数・根号
  "frac", "tfrac", "dfrac", "sqrt", "binom", "tbinom", "dbinom",
  // 大演算子
  "sum", "prod", "int", "iint", "iiint", "oint", "bigcup", "bigcap",
  "bigvee", "bigwedge", "bigotimes", "bigoplus", "biguplus",
  "lim", "limsup", "liminf", "max", "min", "sup", "inf",
  // 三角関数 / 対数
  "sin", "cos", "tan", "cot", "sec", "csc",
  "arcsin", "arccos", "arctan", "sinh", "cosh", "tanh",
  "log", "ln", "lg", "exp",
  // ギリシャ文字
  "alpha", "beta", "gamma", "delta", "epsilon", "varepsilon", "zeta",
  "eta", "theta", "vartheta", "iota", "kappa", "lambda", "mu",
  "nu", "xi", "pi", "varpi", "rho", "varrho", "sigma", "varsigma",
  "tau", "upsilon", "phi", "varphi", "chi", "psi", "omega",
  "Gamma", "Delta", "Theta", "Lambda", "Xi", "Pi", "Sigma", "Upsilon",
  "Phi", "Psi", "Omega",
  // 比較 / 論理
  "leq", "geq", "neq", "approx", "equiv", "sim", "simeq", "cong",
  "subset", "supset", "subseteq", "supseteq", "in", "notin", "ni",
  "land", "lor", "lnot", "implies", "iff", "forall", "exists",
  // 矢印
  "to", "rightarrow", "leftarrow", "Rightarrow", "Leftarrow",
  "leftrightarrow", "Leftrightarrow", "mapsto", "longmapsto",
  // フォント / スタイル
  "mathbb", "mathcal", "mathbf", "mathit", "mathrm", "mathsf", "mathtt", "mathfrak",
  "boldsymbol", "bm", "vec", "hat", "tilde", "bar", "dot", "ddot",
  "overline", "underline", "overbrace", "underbrace",
  // 集合
  "emptyset", "varnothing", "mathbb", "infty", "partial", "nabla",
  // 区切り記号
  "left", "right", "big", "Big", "bigg", "Bigg",
  "langle", "rangle", "lceil", "rceil", "lfloor", "rfloor",
  // その他
  "cdot", "cdots", "ldots", "vdots", "ddots", "times", "div", "pm", "mp",
  "circ", "ast", "star", "bullet", "oplus", "ominus", "otimes", "oslash",
  "begin", "end", // begin/end は別パスで処理されるが念のため
]);

function commandCategory(name: string): TokenKind {
  const base = name.replace(/\*+$/, ""); // \section* → section
  if (SECTIONING_CMDS.has(base)) return "cmd-section";
  if (PACKAGE_CMDS.has(base)) return "cmd-package";
  if (DEFINE_CMDS.has(base)) return "cmd-define";
  if (FORMAT_CMDS.has(base)) return "cmd-format";
  if (REF_CMDS.has(base)) return "cmd-ref";
  if (MATHOP_CMDS.has(base)) return "cmd-mathop";
  return "command";
}

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
    const last = out[out.length - 1];
    if (last && last.kind === kind) {
      last.text += text;
    } else {
      out.push({ kind, text });
    }
  };

  while (i < len) {
    const ch = src[i];

    // ── コメント: % … EOL ──
    if (ch === "%") {
      let j = i;
      while (j < len && src[j] !== "\n") j++;
      push("comment", src.slice(i, j));
      i = j;
      continue;
    }

    // ── URL ハイパーリンク (http(s)://...) ──
    if ((ch === "h" || ch === "H") && (src.startsWith("http://", i) || src.startsWith("https://", i))) {
      let j = i;
      while (j < len && !/\s|[}{)\]"']/.test(src[j])) j++;
      push("url", src.slice(i, j));
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
      while (j < len) {
        if (src[j] === "\\" && j + 1 < len) { j += 2; continue; }
        if (src[j] === "$") { j++; break; }
        if (src[j] === "\n") break;
        j++;
      }
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

    // ── \begin{name} / \end{name} ──
    if (ch === "\\" && (src.startsWith("\\begin{", i) || src.startsWith("\\end{", i))) {
      const head = src.startsWith("\\begin{", i) ? "\\begin" : "\\end";
      push("cmd-define", head); // begin/end を define 色で目立たせる (構造の起点)
      i += head.length;
      push("brace", "{");
      i += 1;
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
        const name = src.slice(i + 1, j);
        push(commandCategory(name), src.slice(i, j));
      } else if (j < len) {
        // 単発 (バックスラッシュ + 1 文字)
        j += 1;
        push("command", src.slice(i, j));
      }
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

    // ── 数値 (+ オプション dimension 単位) ──
    if (ch >= "0" && ch <= "9") {
      let j = i;
      while (j < len && ((src[j] >= "0" && src[j] <= "9") || src[j] === ".")) j++;
      // dimension 単位を look-ahead
      let unitLen = 0;
      for (const u of DIMENSION_UNITS) {
        if (src.startsWith(u, j) && !/[a-zA-Z]/.test(src[j + u.length] ?? "")) {
          unitLen = u.length;
          break;
        }
      }
      if (unitLen > 0) {
        push("dimension", src.slice(i, j + unitLen));
        i = j + unitLen;
      } else {
        push("number", src.slice(i, j));
        i = j;
      }
      continue;
    }

    // ── プレーンテキスト ──
    let j = i;
    while (j < len && !isBoundary(src[j])) j++;
    if (j === i) j++;
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
  comment:      "tk-comment",
  envname:      "tk-envname",
  "cmd-section": "tk-cmd-section",
  "cmd-package": "tk-cmd-package",
  "cmd-define":  "tk-cmd-define",
  "cmd-format":  "tk-cmd-format",
  "cmd-mathop":  "tk-cmd-mathop",
  "cmd-ref":     "tk-cmd-ref",
  command:      "tk-command",
  math:         "tk-math",
  brace:        "tk-brace",
  bracket:      "tk-bracket",
  number:       "tk-number",
  dimension:    "tk-dimension",
  special:      "tk-special",
  url:          "tk-url",
  text:         "",
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
