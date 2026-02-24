/**
 * Smart Math Parser — 電卓/Excel/Python風の入力をLaTeXに変換
 *
 * 設計思想：
 *   LaTeX知識ゼロでも、全人類が知っている記法で数式が書ける
 *   - a/b       → \frac{a}{b}
 *   - x^2       → x^{2}
 *   - x_i       → x_{i}
 *   - sqrt(x)   → \sqrt{x}
 *   - |x|       → \left| x \right|
 *   - ||x||     → \left\| x \right\|
 *   - vec(a)    → \vec{a}
 *   - hat(a)    → \hat{a}
 *   - bar(x)    → \bar{x}
 *   - dot(x)    → \dot{x}
 *   - sum(i=1,n) → \sum_{i=1}^{n}
 *   - int(0,pi)  → \int_{0}^{\pi}
 *   - lim(x->0)  → \lim_{x \to 0}
 *   - alpha, beta, pi, theta, etc. → Greek letters
 *
 *   さらに日本語も混ぜられる（ギリシャ文字名、演算子）
 */

// ──────────────────────────────────────────
// Greek letter map (short name → LaTeX)
// ──────────────────────────────────────────
const GREEK: Record<string, string> = {
  // lowercase
  alpha: "\\alpha", beta: "\\beta", gamma: "\\gamma", delta: "\\delta",
  epsilon: "\\epsilon", zeta: "\\zeta", eta: "\\eta", theta: "\\theta",
  iota: "\\iota", kappa: "\\kappa", lambda: "\\lambda", mu: "\\mu",
  nu: "\\nu", xi: "\\xi", pi: "\\pi", rho: "\\rho",
  sigma: "\\sigma", tau: "\\tau", upsilon: "\\upsilon", phi: "\\phi",
  chi: "\\chi", psi: "\\psi", omega: "\\omega",
  // uppercase
  Gamma: "\\Gamma", Delta: "\\Delta", Theta: "\\Theta", Lambda: "\\Lambda",
  Sigma: "\\Sigma", Phi: "\\Phi", Psi: "\\Psi", Omega: "\\Omega",
  Pi: "\\Pi", Xi: "\\Xi",
  // Japanese
  "アルファ": "\\alpha", "ベータ": "\\beta", "ガンマ": "\\gamma", "デルタ": "\\delta",
  "イプシロン": "\\epsilon", "ゼータ": "\\zeta", "イータ": "\\eta", "シータ": "\\theta",
  "カッパ": "\\kappa", "ラムダ": "\\lambda", "ミュー": "\\mu", "ニュー": "\\nu",
  "クサイ": "\\xi", "パイ": "\\pi", "ロー": "\\rho", "シグマ": "\\sigma",
  "タウ": "\\tau", "ファイ": "\\phi", "カイ": "\\chi", "プサイ": "\\psi", "オメガ": "\\omega",
};

// Special named constants & symbols
const NAMED: Record<string, string> = {
  inf: "\\infty", infinity: "\\infty", "無限": "\\infty", "無限大": "\\infty",
  partial: "\\partial", nabla: "\\nabla", hbar: "\\hbar",
  forall: "\\forall", exists: "\\exists", emptyset: "\\emptyset",
  // Functions
  sin: "\\sin", cos: "\\cos", tan: "\\tan", log: "\\log", ln: "\\ln", exp: "\\exp",
  arcsin: "\\arcsin", arccos: "\\arccos", arctan: "\\arctan",
  sinh: "\\sinh", cosh: "\\cosh", tanh: "\\tanh",
  det: "\\det", max: "\\max", min: "\\min", lim: "\\lim",
  // Relations  
  "!=": "\\neq", "<=": "\\leq", ">=": "\\geq", "~=": "\\approx",
  "==": "\\equiv", "=>": "\\Rightarrow", "<=>": "\\Leftrightarrow",
  "+-": "\\pm",
  // Japanese operators
  "たす": "+", "ひく": "-", "かける": "\\times", "わる": "\\div",
  "イコール": "=", "プラス": "+", "マイナス": "-",
  ...GREEK,
};

// ──────────────────────────────────────────
// Tokenizer
// ──────────────────────────────────────────

type Token =
  | { type: "number"; value: string }
  | { type: "ident"; value: string }      // variable name, function name, greek
  | { type: "op"; value: string }          // +, -, *, ×
  | { type: "frac"; num: string; den: string }
  | { type: "power"; base: string; exp: string }
  | { type: "sub"; base: string; sub: string }
  | { type: "paren"; inner: string }
  | { type: "pipe"; inner: string }
  | { type: "dpipe"; inner: string }
  | { type: "raw"; value: string };

function resolveIdent(name: string): string {
  return NAMED[name] || GREEK[name] || name;
}

// ──────────────────────────────────────────
// Main parser: smart math string → LaTeX
// ──────────────────────────────────────────

export function parseSmartMath(input: string): string {
  let s = input.trim();
  if (!s) return "";

  // Pre-process: normalize whitespace
  s = s.replace(/\s+/g, " ");

  // ── Step 1: Handle double-pipe norms ||x|| → \left\| x \right\| ──
  s = s.replace(/\|\|([^|]+?)\|\|/g, (_, inner) => {
    return `\\left\\| ${parseSmartMath(inner)} \\right\\|`;
  });

  // ── Step 2: Handle single-pipe absolute |x| → \left| x \right| ──
  s = s.replace(/\|([^|]+?)\|/g, (_, inner) => {
    return `\\left| ${parseSmartMath(inner)} \\right|`;
  });

  // ── Step 3: Function calls with parens ──
  // sqrt(x)  → \sqrt{x}
  s = s.replace(/sqrt\(([^)]+)\)/g, (_, arg) => `\\sqrt{${parseSmartMath(arg)}}`);
  // cbrt(x) or 3rt(x) → \sqrt[3]{x}
  s = s.replace(/cbrt\(([^)]+)\)/g, (_, arg) => `\\sqrt[3]{${parseSmartMath(arg)}}`);
  // nrt(n, x) → \sqrt[n]{x}
  s = s.replace(/(\d+)rt\(([^)]+)\)/g, (_, n, arg) => `\\sqrt[${n}]{${parseSmartMath(arg)}}`);

  // vec(x) → \vec{x}
  s = s.replace(/vec\(([^)]+)\)/g, (_, arg) => `\\vec{${parseSmartMath(arg)}}`);
  // hat(x) → \hat{x}
  s = s.replace(/hat\(([^)]+)\)/g, (_, arg) => `\\hat{${parseSmartMath(arg)}}`);
  // bar(x) → \bar{x}, or mean(x)
  s = s.replace(/(?:bar|mean)\(([^)]+)\)/g, (_, arg) => `\\bar{${parseSmartMath(arg)}}`);
  // dot(x) → \dot{x}
  s = s.replace(/dot\(([^)]+)\)/g, (_, arg) => `\\dot{${parseSmartMath(arg)}}`);
  // ddot(x) → \ddot{x}
  s = s.replace(/ddot\(([^)]+)\)/g, (_, arg) => `\\ddot{${parseSmartMath(arg)}}`);
  // tilde(x) → \tilde{x}
  s = s.replace(/tilde\(([^)]+)\)/g, (_, arg) => `\\tilde{${parseSmartMath(arg)}}`);

  // sum(i=1, n) → \sum_{i=1}^{n}
  s = s.replace(/sum\(([^,]+),\s*([^)]+)\)/g, (_, from, to) => {
    return `\\sum_{${parseSmartMath(from)}}^{${parseSmartMath(to)}}`;
  });
  // prod(i=1, n) → \prod_{i=1}^{n}
  s = s.replace(/prod\(([^,]+),\s*([^)]+)\)/g, (_, from, to) => {
    return `\\prod_{${parseSmartMath(from)}}^{${parseSmartMath(to)}}`;
  });
  // int(a, b) → \int_{a}^{b}
  s = s.replace(/int\(([^,]+),\s*([^)]+)\)/g, (_, from, to) => {
    return `\\int_{${parseSmartMath(from)}}^{${parseSmartMath(to)}}`;
  });
  // lim(x->a) or lim(x→a) → \lim_{x \to a}
  s = s.replace(/lim\(([a-zA-Z])\s*(?:->|→)\s*([^)]+)\)/g, (_, x, a) => {
    return `\\lim_{${x} \\to ${parseSmartMath(a)}}`;
  });
  // d/dx or diff(x) → \frac{d}{dx}
  s = s.replace(/d\/d([a-zA-Z])/g, (_, x) => `\\frac{d}{d${x}}`);
  s = s.replace(/diff\(([a-zA-Z])\)/g, (_, x) => `\\frac{d}{d${x}}`);
  // pd/pdx or pdiff(x) → \frac{\partial}{\partial x}
  s = s.replace(/pd\/pd([a-zA-Z])/g, (_, x) => `\\frac{\\partial}{\\partial ${x}}`);
  s = s.replace(/pdiff\(([a-zA-Z])\)/g, (_, x) => `\\frac{\\partial}{\\partial ${x}}`);

  // matrix(1,2;3,4) → \begin{pmatrix} 1 & 2 \\ 3 & 4 \end{pmatrix}
  s = s.replace(/matrix\(([^)]+)\)/g, (_, inner) => {
    const rows = inner.split(";").map((row: string) =>
      row.split(",").map((cell: string) => parseSmartMath(cell.trim())).join(" & ")
    );
    return `\\begin{pmatrix} ${rows.join(" \\\\ ")} \\end{pmatrix}`;
  });

  // cases(expr1, cond1; expr2, cond2) → \begin{cases}...
  s = s.replace(/cases\(([^)]+)\)/g, (_, inner) => {
    const rows = inner.split(";").map((row: string) => {
      const parts = row.split(",").map((c: string) => c.trim());
      if (parts.length >= 2) {
        return `${parseSmartMath(parts[0])} & \\text{${parts[1]}}`;
      }
      return parseSmartMath(parts[0]);
    });
    return `\\begin{cases} ${rows.join(" \\\\ ")} \\end{cases}`;
  });

  // ── Step 4: Fractions — a/b patterns ──
  // Handle grouped fractions: (a+b)/(c+d)
  s = s.replace(/\(([^()]+)\)\/\(([^()]+)\)/g, (_, num, den) => {
    return `\\frac{${parseSmartMath(num)}}{${parseSmartMath(den)}}`;
  });
  // Handle simple fractions: single-token / single-token
  // But avoid matching things like d/dx (already handled)
  s = s.replace(/(?<![d])\b([a-zA-Z0-9α-ωΑ-Ω\\]+(?:\^{[^}]+})?)\s*\/\s*([a-zA-Z0-9α-ωΑ-Ω\\]+(?:\^{[^}]+})?)\b/g, (_, num, den) => {
    // Skip if it looks like it was already processed
    if (num.includes("\\frac") || den.includes("\\frac")) return _;
    return `\\frac{${resolveIdent(num)}}{${resolveIdent(den)}}`;
  });

  // ── Step 5: Superscripts x^n ──
  // x^{...} already ok, x^(expr) → x^{expr}, x^2 → x^{2}
  s = s.replace(/\^(\([^)]+\))/g, (_, group) => {
    const inner = group.slice(1, -1);
    return `^{${parseSmartMath(inner)}}`;
  });
  s = s.replace(/\^([a-zA-Z0-9α-ωΑ-Ω]+)/g, (_, exp) => {
    // Handle multi-char like x^2n → x^{2n}
    return `^{${resolveIdent(exp)}}`;
  });

  // ── Step 6: Subscripts x_i ──
  s = s.replace(/_(\([^)]+\))/g, (_, group) => {
    const inner = group.slice(1, -1);
    return `_{${parseSmartMath(inner)}}`;
  });
  s = s.replace(/_([a-zA-Z0-9]+)/g, (_, sub) => {
    return `_{${resolveIdent(sub)}}`;
  });

  // ── Step 7: Resolve remaining identifiers ──
  // Replace known names not yet resolved
  for (const [name, latex] of Object.entries(NAMED)) {
    if (name.length >= 2 && s.includes(name)) {
      // Only replace standalone words (not parts of other words)
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(?<![a-zA-Z\\\\])${escaped}(?![a-zA-Z{])`, "g");
      s = s.replace(regex, latex);
    }
  }

  // ── Step 8: Operator cleanup ──
  s = s.replace(/\*/g, "\\cdot ");
  // Fullwidth → halfwidth
  s = s.replace(/（/g, "(").replace(/）/g, ")");
  s = s.replace(/＝/g, "=").replace(/＋/g, "+").replace(/－/g, "-");

  // ── Step 9: Smart parentheses — upgrade () to \left( \right) for large content ──
  s = s.replace(/\(([^()]*\\(?:frac|sqrt|sum|int|prod)[^()]*)\)/g, (_, inner) => {
    return `\\left( ${inner} \\right)`;
  });

  // Clean up spacing
  s = s.replace(/ +/g, " ").trim();

  return s;
}

// ──────────────────────────────────────────
// Visual Toolbar Items — one-click math structures
// ──────────────────────────────────────────

export interface MathToolbarItem {
  id: string;
  label: string;        // Short label shown on button
  icon: string;         // Visual representation (KaTeX-renderable)
  template: string;     // Smart-syntax template to insert (with placeholders)
  description: string;  // Japanese tooltip
  category: "structure" | "decoration" | "calculus" | "set" | "greek";
}

export const MATH_TOOLBAR: MathToolbarItem[] = [
  // ── Structure ──
  { id: "frac", label: "分数", icon: "\\frac{a}{b}", template: "/", description: "分数 — a/b", category: "structure" },
  { id: "power", label: "累乗", icon: "x^{n}", template: "^", description: "累乗 — x^2", category: "structure" },
  { id: "sub", label: "添字", icon: "x_{i}", template: "_", description: "添字 — x_i", category: "structure" },
  { id: "sqrt", label: "√", icon: "\\sqrt{x}", template: "sqrt()", description: "平方根 — sqrt(x)", category: "structure" },
  { id: "nroot", label: "ⁿ√", icon: "\\sqrt[n]{x}", template: "3rt()", description: "n乗根 — 3rt(x)", category: "structure" },
  { id: "abs", label: "||", icon: "\\left| x \\right|", template: "||", description: "絶対値 — |x|", category: "structure" },
  { id: "norm", label: "‖‖", icon: "\\left\\| x \\right\\|", template: "||||", description: "ノルム — ||x||", category: "structure" },
  { id: "matrix", label: "行列", icon: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}", template: "matrix(,;,)", description: "行列 — matrix(a,b;c,d)", category: "structure" },
  { id: "cases", label: "場合分け", icon: "\\begin{cases} a \\\\ b \\end{cases}", template: "cases(,;,)", description: "場合分け — cases(式,条件;...)", category: "structure" },

  // ── Decoration ──
  { id: "vec", label: "→", icon: "\\vec{a}", template: "vec()", description: "ベクトル — vec(a)", category: "decoration" },
  { id: "hat", label: "^", icon: "\\hat{a}", template: "hat()", description: "ハット — hat(a)", category: "decoration" },
  { id: "bar", label: "–", icon: "\\bar{x}", template: "bar()", description: "バー/平均 — bar(x)", category: "decoration" },
  { id: "dot", label: "•", icon: "\\dot{x}", template: "dot()", description: "ドット — dot(x)", category: "decoration" },
  { id: "tilde", label: "~", icon: "\\tilde{x}", template: "tilde()", description: "チルダ — tilde(x)", category: "decoration" },

  // ── Calculus ──
  { id: "sum", label: "Σ", icon: "\\sum_{i=1}^{n}", template: "sum(i=1,n)", description: "総和 — sum(i=1,n)", category: "calculus" },
  { id: "prod", label: "Π", icon: "\\prod_{i=1}^{n}", template: "prod(i=1,n)", description: "総乗 — prod(i=1,n)", category: "calculus" },
  { id: "int", label: "∫", icon: "\\int_{a}^{b}", template: "int(a,b)", description: "積分 — int(0,pi)", category: "calculus" },
  { id: "lim", label: "lim", icon: "\\lim_{x \\to 0}", template: "lim(x->0)", description: "極限 — lim(x->0)", category: "calculus" },
  { id: "diff", label: "d/dx", icon: "\\frac{d}{dx}", template: "d/dx", description: "微分 — d/dx", category: "calculus" },
  { id: "pdiff", label: "∂/∂x", icon: "\\frac{\\partial}{\\partial x}", template: "pd/pdx", description: "偏微分 — pd/pdx", category: "calculus" },

  // ── Relations / Operators ──
  { id: "neq", label: "≠", icon: "\\neq", template: "!=", description: "ノットイコール", category: "set" },
  { id: "leq", label: "≤", icon: "\\leq", template: "<=", description: "以下", category: "set" },
  { id: "geq", label: "≥", icon: "\\geq", template: ">=", description: "以上", category: "set" },
  { id: "approx", label: "≈", icon: "\\approx", template: "~=", description: "近似", category: "set" },
  { id: "implies", label: "⇒", icon: "\\Rightarrow", template: "=>", description: "ならば", category: "set" },
  { id: "iff", label: "⇔", icon: "\\Leftrightarrow", template: "<=>", description: "同値", category: "set" },
  { id: "in", label: "∈", icon: "\\in", template: "in", description: "属する", category: "set" },
  { id: "pm", label: "±", icon: "\\pm", template: "+-", description: "プラスマイナス", category: "set" },
  { id: "times", label: "×", icon: "\\times", template: "*", description: "かける", category: "set" },
  { id: "infty", label: "∞", icon: "\\infty", template: "inf", description: "無限大", category: "set" },
];

// ──────────────────────────────────────────
// Quick reference — cheat sheet for users
// ──────────────────────────────────────────

export interface CheatSheetEntry {
  input: string;
  output: string;   // LaTeX for KaTeX preview
  category: string;
}

export const CHEAT_SHEET: CheatSheetEntry[] = [
  // 基本
  { input: "a/b", output: "\\frac{a}{b}", category: "基本" },
  { input: "x^2", output: "x^{2}", category: "基本" },
  { input: "x_i", output: "x_{i}", category: "基本" },
  { input: "sqrt(x)", output: "\\sqrt{x}", category: "基本" },
  { input: "(a+b)/(c+d)", output: "\\frac{a+b}{c+d}", category: "基本" },
  { input: "3rt(x)", output: "\\sqrt[3]{x}", category: "基本" },
  // 装飾
  { input: "|x|", output: "\\left| x \\right|", category: "装飾" },
  { input: "||x||", output: "\\left\\| x \\right\\|", category: "装飾" },
  { input: "vec(a)", output: "\\vec{a}", category: "装飾" },
  { input: "hat(a)", output: "\\hat{a}", category: "装飾" },
  { input: "bar(x)", output: "\\bar{x}", category: "装飾" },
  { input: "dot(x)", output: "\\dot{x}", category: "装飾" },
  // 微積分
  { input: "sum(i=1,n)", output: "\\sum_{i=1}^{n}", category: "微積分" },
  { input: "int(0,pi)", output: "\\int_{0}^{\\pi}", category: "微積分" },
  { input: "lim(x->0)", output: "\\lim_{x \\to 0}", category: "微積分" },
  { input: "d/dx", output: "\\frac{d}{dx}", category: "微積分" },
  { input: "pd/pdx", output: "\\frac{\\partial}{\\partial x}", category: "微積分" },
  // 関係
  { input: "!=", output: "\\neq", category: "記号" },
  { input: "<=", output: "\\leq", category: "記号" },
  { input: ">=", output: "\\geq", category: "記号" },
  { input: "=>", output: "\\Rightarrow", category: "記号" },
  { input: "alpha", output: "\\alpha", category: "記号" },
  { input: "theta", output: "\\theta", category: "記号" },
  // 構造
  { input: "matrix(1,2;3,4)", output: "\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}", category: "構造" },
  { input: "cases(x, x>0; -x, x<0)", output: "\\begin{cases} x & \\text{x>0} \\\\ -x & \\text{x<0} \\end{cases}", category: "構造" },
];
