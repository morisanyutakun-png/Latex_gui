/**
 * 日本語 → LaTeX 数式辞書 & パーサー
 *
 * 設計思想:
 * - LaTeXを「日本語訳」する。ユーザは日本語の数学的な読み方で数式を書く
 * - パーサーはトークン化 → パターンマッチ → LaTeX生成 の3段階
 * - 曖昧性がある場合はリアルタイムプレビュー + 候補で解決
 */

// ──────────────────────────────────────────
// 1. 日本語 → LaTeX 辞書 (標準化された読み方)
// ──────────────────────────────────────────

export interface MathDictEntry {
  /** 日本語の読み方（正規化済み） */
  reading: string;
  /** 別の読み方・表記揺れ */
  aliases: string[];
  /** 生成されるLaTeX */
  latex: string;
  /** 構造型: symbol=そのまま, unary=引数1つ, binary=引数2つ, environment=環境 */
  kind: "symbol" | "unary" | "binary" | "environment" | "operator" | "relation";
  /** 日本語の説明 */
  description: string;
  /** カテゴリ */
  category: string;
  /** 例文（日本語入力 → LaTeX出力） */
  example?: { input: string; output: string };
}

export const MATH_DICTIONARY: MathDictEntry[] = [
  // ══════ ギリシャ文字 ══════
  { reading: "アルファ", aliases: ["あるふぁ", "α"], latex: "\\alpha", kind: "symbol", description: "ギリシャ文字 α", category: "ギリシャ文字" },
  { reading: "ベータ", aliases: ["べーた", "β"], latex: "\\beta", kind: "symbol", description: "ギリシャ文字 β", category: "ギリシャ文字" },
  { reading: "ガンマ", aliases: ["がんま", "γ"], latex: "\\gamma", kind: "symbol", description: "ギリシャ文字 γ", category: "ギリシャ文字" },
  { reading: "デルタ", aliases: ["でるた", "δ"], latex: "\\delta", kind: "symbol", description: "ギリシャ文字 δ", category: "ギリシャ文字" },
  { reading: "イプシロン", aliases: ["いぷしろん", "ε"], latex: "\\epsilon", kind: "symbol", description: "ギリシャ文字 ε", category: "ギリシャ文字" },
  { reading: "ゼータ", aliases: ["ぜーた", "ζ"], latex: "\\zeta", kind: "symbol", description: "ギリシャ文字 ζ", category: "ギリシャ文字" },
  { reading: "イータ", aliases: ["いーた", "η"], latex: "\\eta", kind: "symbol", description: "ギリシャ文字 η", category: "ギリシャ文字" },
  { reading: "シータ", aliases: ["しーた", "θ"], latex: "\\theta", kind: "symbol", description: "ギリシャ文字 θ", category: "ギリシャ文字" },
  { reading: "カッパ", aliases: ["かっぱ", "κ"], latex: "\\kappa", kind: "symbol", description: "ギリシャ文字 κ", category: "ギリシャ文字" },
  { reading: "ラムダ", aliases: ["らむだ", "λ"], latex: "\\lambda", kind: "symbol", description: "ギリシャ文字 λ", category: "ギリシャ文字" },
  { reading: "ミュー", aliases: ["みゅー", "μ"], latex: "\\mu", kind: "symbol", description: "ギリシャ文字 μ", category: "ギリシャ文字" },
  { reading: "ニュー", aliases: ["にゅー", "ν"], latex: "\\nu", kind: "symbol", description: "ギリシャ文字 ν", category: "ギリシャ文字" },
  { reading: "クサイ", aliases: ["くさい", "ξ"], latex: "\\xi", kind: "symbol", description: "ギリシャ文字 ξ", category: "ギリシャ文字" },
  { reading: "パイ", aliases: ["ぱい", "π"], latex: "\\pi", kind: "symbol", description: "ギリシャ文字 π", category: "ギリシャ文字" },
  { reading: "ロー", aliases: ["ろー", "ρ"], latex: "\\rho", kind: "symbol", description: "ギリシャ文字 ρ", category: "ギリシャ文字" },
  { reading: "シグマ", aliases: ["しぐま", "σ"], latex: "\\sigma", kind: "symbol", description: "ギリシャ文字 σ", category: "ギリシャ文字" },
  { reading: "タウ", aliases: ["たう", "τ"], latex: "\\tau", kind: "symbol", description: "ギリシャ文字 τ", category: "ギリシャ文字" },
  { reading: "ファイ", aliases: ["ふぁい", "φ"], latex: "\\phi", kind: "symbol", description: "ギリシャ文字 φ", category: "ギリシャ文字" },
  { reading: "カイ", aliases: ["かい", "χ"], latex: "\\chi", kind: "symbol", description: "ギリシャ文字 χ", category: "ギリシャ文字" },
  { reading: "プサイ", aliases: ["ぷさい", "ψ"], latex: "\\psi", kind: "symbol", description: "ギリシャ文字 ψ", category: "ギリシャ文字" },
  { reading: "オメガ", aliases: ["おめが", "ω"], latex: "\\omega", kind: "symbol", description: "ギリシャ文字 ω", category: "ギリシャ文字" },
  // 大文字
  { reading: "大ガンマ", aliases: ["大がんま", "Γ"], latex: "\\Gamma", kind: "symbol", description: "大文字ガンマ Γ", category: "ギリシャ文字" },
  { reading: "大デルタ", aliases: ["大でるた", "Δ"], latex: "\\Delta", kind: "symbol", description: "大文字デルタ Δ", category: "ギリシャ文字" },
  { reading: "大シータ", aliases: ["大しーた", "Θ"], latex: "\\Theta", kind: "symbol", description: "大文字シータ Θ", category: "ギリシャ文字" },
  { reading: "大ラムダ", aliases: ["大らむだ", "Λ"], latex: "\\Lambda", kind: "symbol", description: "大文字ラムダ Λ", category: "ギリシャ文字" },
  { reading: "大シグマ", aliases: ["大しぐま", "Σ"], latex: "\\Sigma", kind: "symbol", description: "大文字シグマ Σ", category: "ギリシャ文字" },
  { reading: "大ファイ", aliases: ["大ふぁい", "Φ"], latex: "\\Phi", kind: "symbol", description: "大文字ファイ Φ", category: "ギリシャ文字" },
  { reading: "大プサイ", aliases: ["大ぷさい", "Ψ"], latex: "\\Psi", kind: "symbol", description: "大文字プサイ Ψ", category: "ギリシャ文字" },
  { reading: "大オメガ", aliases: ["大おめが", "Ω"], latex: "\\Omega", kind: "symbol", description: "大文字オメガ Ω", category: "ギリシャ文字" },

  // ══════ 演算子・関係 ══════
  { reading: "たす", aliases: ["プラス", "足す", "+"], latex: "+", kind: "operator", description: "加算", category: "演算" },
  { reading: "ひく", aliases: ["マイナス", "引く", "-"], latex: "-", kind: "operator", description: "減算", category: "演算" },
  { reading: "かける", aliases: ["掛ける", "×"], latex: "\\times", kind: "operator", description: "乗算", category: "演算" },
  { reading: "わる", aliases: ["割る", "÷"], latex: "\\div", kind: "operator", description: "除算", category: "演算" },
  { reading: "プラスマイナス", aliases: ["ぷらすまいなす", "±"], latex: "\\pm", kind: "operator", description: "±", category: "演算" },
  { reading: "内積", aliases: ["ないせき", "ドット積"], latex: "\\cdot", kind: "operator", description: "内積・中点", category: "演算" },
  { reading: "外積", aliases: ["がいせき", "クロス積"], latex: "\\times", kind: "operator", description: "外積", category: "演算" },

  // ══════ 関係演算子 ══════
  { reading: "イコール", aliases: ["等しい", "＝", "="], latex: "=", kind: "relation", description: "等号", category: "関係" },
  { reading: "ノットイコール", aliases: ["等しくない", "≠"], latex: "\\neq", kind: "relation", description: "≠", category: "関係" },
  { reading: "小なりイコール", aliases: ["以下", "≤"], latex: "\\leq", kind: "relation", description: "≤", category: "関係" },
  { reading: "大なりイコール", aliases: ["以上", "≥"], latex: "\\geq", kind: "relation", description: "≥", category: "関係" },
  { reading: "小なり", aliases: ["未満", "<"], latex: "<", kind: "relation", description: "<", category: "関係" },
  { reading: "大なり", aliases: [">"], latex: ">", kind: "relation", description: ">", category: "関係" },
  { reading: "近似", aliases: ["ニアリーイコール", "≈"], latex: "\\approx", kind: "relation", description: "≈", category: "関係" },
  { reading: "合同", aliases: ["≡"], latex: "\\equiv", kind: "relation", description: "≡", category: "関係" },
  { reading: "比例", aliases: ["∝"], latex: "\\propto", kind: "relation", description: "∝", category: "関係" },
  { reading: "属する", aliases: ["含まれる", "∈"], latex: "\\in", kind: "relation", description: "∈", category: "関係" },
  { reading: "部分集合", aliases: ["⊂"], latex: "\\subset", kind: "relation", description: "⊂", category: "関係" },
  { reading: "ならば", aliases: ["⇒"], latex: "\\Rightarrow", kind: "relation", description: "⇒", category: "関係" },
  { reading: "同値", aliases: ["⇔"], latex: "\\Leftrightarrow", kind: "relation", description: "⇔", category: "関係" },

  // ══════ 構造系 (引数あり) ══════
  { reading: "分数", aliases: ["ぶんすう", "分の"], latex: "\\frac{A}{B}", kind: "binary",
    description: "分数: 「AぶんのB」→ B/A",
    category: "構造",
    example: { input: "2ぶんの1", output: "\\frac{1}{2}" } },
  { reading: "ルート", aliases: ["るーと", "平方根", "根号"], latex: "\\sqrt{A}", kind: "unary",
    description: "平方根: 「ルートx」→ √x",
    category: "構造",
    example: { input: "ルート2", output: "\\sqrt{2}" } },
  { reading: "n乗根", aliases: ["じょうこん"], latex: "\\sqrt[N]{A}", kind: "binary",
    description: "n乗根: 「3乗根x」→ ∛x",
    category: "構造" },
  { reading: "乗", aliases: ["じょう", "の二乗", "の三乗"], latex: "^{A}", kind: "unary",
    description: "累乗: 「xの2乗」→ x²",
    category: "構造",
    example: { input: "xの2乗", output: "x^{2}" } },
  { reading: "添字", aliases: ["そえじ", "サブ"], latex: "_{A}", kind: "unary",
    description: "下付き: 「x添字i」→ xᵢ",
    category: "構造" },
  { reading: "絶対値", aliases: ["ぜったいち", "abs"], latex: "\\left| A \\right|", kind: "unary",
    description: "絶対値: 「絶対値x」→ |x|",
    category: "構造" },
  { reading: "ノルム", aliases: ["のーむ"], latex: "\\left\\| A \\right\\|", kind: "unary",
    description: "ノルム: 「ノルムx」→ ‖x‖",
    category: "構造" },
  { reading: "ベクトル", aliases: ["べくとる", "vec"], latex: "\\vec{A}", kind: "unary",
    description: "ベクトル: 「ベクトルa」→ a→",
    category: "構造" },
  { reading: "ハット", aliases: ["はっと", "hat"], latex: "\\hat{A}", kind: "unary",
    description: "ハット: 「ハットa」→ â",
    category: "構造" },
  { reading: "上線", aliases: ["うわせん", "バー", "bar"], latex: "\\bar{A}", kind: "unary",
    description: "上線: 「バーx」→ x̄",
    category: "構造" },
  { reading: "ドット", aliases: ["どっと", "時間微分"], latex: "\\dot{A}", kind: "unary",
    description: "上ドット: 「ドットx」→ ẋ",
    category: "構造" },

  // ══════ 微積分 ══════
  { reading: "積分", aliases: ["せきぶん", "インテグラル"], latex: "\\int_{A}^{B}", kind: "binary",
    description: "定積分: 「0から1まで積分」",
    category: "微積分",
    example: { input: "0からパイまで積分 sin(x)dx", output: "\\int_{0}^{\\pi} \\sin(x) \\, dx" } },
  { reading: "不定積分", aliases: ["ふていせきぶん"], latex: "\\int", kind: "symbol",
    description: "不定積分: ∫",
    category: "微積分" },
  { reading: "二重積分", aliases: ["にじゅうせきぶん"], latex: "\\iint", kind: "symbol",
    description: "二重積分: ∬",
    category: "微積分" },
  { reading: "周回積分", aliases: ["しゅうかいせきぶん"], latex: "\\oint", kind: "symbol",
    description: "周回積分: ∮",
    category: "微積分" },
  { reading: "微分", aliases: ["びぶん", "d/dx"], latex: "\\frac{d}{dA}", kind: "unary",
    description: "微分: 「xで微分」→ d/dx",
    category: "微積分",
    example: { input: "xで微分", output: "\\frac{d}{dx}" } },
  { reading: "偏微分", aliases: ["へんびぶん"], latex: "\\frac{\\partial}{\\partial A}", kind: "unary",
    description: "偏微分: 「xで偏微分」→ ∂/∂x",
    category: "微積分" },
  { reading: "極限", aliases: ["きょくげん", "リミット"], latex: "\\lim_{A \\to B}", kind: "binary",
    description: "極限: 「xが0に近づくとき極限」",
    category: "微積分",
    example: { input: "xを無限大に飛ばす極限", output: "\\lim_{x \\to \\infty}" } },
  { reading: "総和", aliases: ["そうわ", "シグマ", "合計"], latex: "\\sum_{A}^{B}", kind: "binary",
    description: "総和: 「i=1からnまで総和」",
    category: "微積分",
    example: { input: "i=1からnまで総和", output: "\\sum_{i=1}^{n}" } },
  { reading: "総乗", aliases: ["そうじょう", "パイ積"], latex: "\\prod_{A}^{B}", kind: "binary",
    description: "総乗: 「i=1からnまで総乗」",
    category: "微積分" },

  // ══════ 特殊記号 ══════
  { reading: "無限大", aliases: ["むげんだい", "無限", "∞"], latex: "\\infty", kind: "symbol", description: "∞", category: "特殊" },
  { reading: "偏微分記号", aliases: ["パーシャル", "∂"], latex: "\\partial", kind: "symbol", description: "∂", category: "特殊" },
  { reading: "ナブラ", aliases: ["なぶら", "∇"], latex: "\\nabla", kind: "symbol", description: "∇", category: "特殊" },
  { reading: "任意の", aliases: ["すべての", "フォーオール", "∀"], latex: "\\forall", kind: "symbol", description: "∀", category: "特殊" },
  { reading: "存在する", aliases: ["イグジスト", "∃"], latex: "\\exists", kind: "symbol", description: "∃", category: "特殊" },
  { reading: "和集合", aliases: ["わしゅうごう", "ユニオン", "∪"], latex: "\\cup", kind: "operator", description: "∪", category: "特殊" },
  { reading: "共通集合", aliases: ["きょうつうしゅうごう", "インターセクション", "∩"], latex: "\\cap", kind: "operator", description: "∩", category: "特殊" },
  { reading: "空集合", aliases: ["くうしゅうごう", "∅"], latex: "\\emptyset", kind: "symbol", description: "∅", category: "特殊" },
  { reading: "エイチバー", aliases: ["ディラック定数", "ℏ"], latex: "\\hbar", kind: "symbol", description: "ℏ", category: "特殊" },

  // ══════ 三角関数 ══════
  { reading: "サイン", aliases: ["さいん", "sin"], latex: "\\sin", kind: "symbol", description: "sin", category: "関数" },
  { reading: "コサイン", aliases: ["こさいん", "cos"], latex: "\\cos", kind: "symbol", description: "cos", category: "関数" },
  { reading: "タンジェント", aliases: ["たんじぇんと", "tan"], latex: "\\tan", kind: "symbol", description: "tan", category: "関数" },
  { reading: "ログ", aliases: ["ろぐ", "対数", "log"], latex: "\\log", kind: "symbol", description: "log", category: "関数" },
  { reading: "自然対数", aliases: ["エルエヌ", "ln"], latex: "\\ln", kind: "symbol", description: "ln", category: "関数" },
  { reading: "エクスポネンシャル", aliases: ["指数関数", "exp"], latex: "\\exp", kind: "symbol", description: "exp", category: "関数" },

  // ══════ 環境 ══════
  { reading: "行列", aliases: ["ぎょうれつ", "マトリックス"], latex: "\\begin{pmatrix} A \\end{pmatrix}", kind: "environment",
    description: "行列環境",
    category: "環境" },
  { reading: "連立方程式", aliases: ["れんりつほうていしき"], latex: "\\begin{cases} A \\end{cases}", kind: "environment",
    description: "連立方程式",
    category: "環境" },
  { reading: "場合分け", aliases: ["ばあいわけ"], latex: "\\begin{cases} A \\end{cases}", kind: "environment",
    description: "場合分け",
    category: "環境" },
];

// ──────────────────────────────────────────
// 2. LaTeX日本語訳辞書（LaTeX → 日本語の読み方）
// ──────────────────────────────────────────

export interface LatexTranslation {
  latex: string;
  japanese: string;
  category: string;
}

export const LATEX_TRANSLATIONS: LatexTranslation[] = [
  // 構造
  { latex: "\\frac{a}{b}", japanese: "bぶんのa （分数）", category: "構造" },
  { latex: "^{n}", japanese: "のn乗 （累乗）", category: "構造" },
  { latex: "_{i}", japanese: "添字i （下付き）", category: "構造" },
  { latex: "\\sqrt{x}", japanese: "ルートx （平方根）", category: "構造" },
  { latex: "\\sqrt[n]{x}", japanese: "n乗根x", category: "構造" },
  { latex: "\\vec{a}", japanese: "ベクトルa", category: "構造" },
  { latex: "\\hat{a}", japanese: "ハットa", category: "構造" },
  { latex: "\\bar{x}", japanese: "バーx / xの平均", category: "構造" },
  { latex: "\\dot{x}", japanese: "ドットx / xの時間微分", category: "構造" },
  { latex: "\\left| x \\right|", japanese: "xの絶対値", category: "構造" },
  { latex: "\\left\\| x \\right\\|", japanese: "xのノルム", category: "構造" },
  // 微積分
  { latex: "\\int_{a}^{b}", japanese: "aからbまで積分", category: "微積分" },
  { latex: "\\sum_{i=1}^{n}", japanese: "i=1からnまで総和", category: "微積分" },
  { latex: "\\prod_{i=1}^{n}", japanese: "i=1からnまで総乗", category: "微積分" },
  { latex: "\\lim_{x \\to a}", japanese: "xがaに近づくとき極限", category: "微積分" },
  { latex: "\\frac{d}{dx}", japanese: "xで微分", category: "微積分" },
  { latex: "\\frac{\\partial}{\\partial x}", japanese: "xで偏微分", category: "微積分" },
  // 演算・関係
  { latex: "\\times", japanese: "かける", category: "演算" },
  { latex: "\\div", japanese: "わる", category: "演算" },
  { latex: "\\pm", japanese: "プラスマイナス", category: "演算" },
  { latex: "\\cdot", japanese: "内積 / かける（中点）", category: "演算" },
  { latex: "\\neq", japanese: "ノットイコール / 等しくない", category: "関係" },
  { latex: "\\leq", japanese: "小なりイコール / 以下", category: "関係" },
  { latex: "\\geq", japanese: "大なりイコール / 以上", category: "関係" },
  { latex: "\\approx", japanese: "近似 / ニアリーイコール", category: "関係" },
  { latex: "\\equiv", japanese: "合同", category: "関係" },
  { latex: "\\propto", japanese: "比例", category: "関係" },
  { latex: "\\in", japanese: "属する / 含まれる", category: "関係" },
  { latex: "\\subset", japanese: "部分集合", category: "関係" },
  { latex: "\\Rightarrow", japanese: "ならば", category: "関係" },
  { latex: "\\Leftrightarrow", japanese: "同値", category: "関係" },
  { latex: "\\forall", japanese: "任意の / すべての", category: "特殊" },
  { latex: "\\exists", japanese: "存在する", category: "特殊" },
  { latex: "\\infty", japanese: "無限大", category: "特殊" },
  { latex: "\\partial", japanese: "偏微分記号 / パーシャル", category: "特殊" },
  { latex: "\\nabla", japanese: "ナブラ", category: "特殊" },
  // スペーシング（LaTeX日本語訳）
  { latex: "\\,", japanese: "小スペース（3/18em ≈ 1.7pt）", category: "スペーシング" },
  { latex: "\\:", japanese: "中スペース（4/18em ≈ 2.2pt）", category: "スペーシング" },
  { latex: "\\;", japanese: "大スペース（5/18em ≈ 2.8pt）", category: "スペーシング" },
  { latex: "\\!", japanese: "負スペース（-3/18em）", category: "スペーシング" },
  { latex: "\\quad", japanese: "1em幅スペース", category: "スペーシング" },
  { latex: "\\qquad", japanese: "2em幅スペース", category: "スペーシング" },
  { latex: "\\hspace{Xpt}", japanese: "Xpt分の水平スペース", category: "スペーシング" },
  { latex: "\\vspace{Xpt}", japanese: "Xpt分の垂直スペース", category: "スペーシング" },
];

// ──────────────────────────────────────────
// 3. 日本語 → LaTeX パーサー
// ──────────────────────────────────────────

/**
 * 日本語で書かれた数式テキストをLaTeXに変換する
 *
 * 対応パターン:
 *   "2分の1"          → \frac{1}{2}
 *   "xの2乗"          → x^{2}
 *   "ルート2"          → \sqrt{2}
 *   "xからyまで積分"   → \int_{x}^{y}
 *   "i=1からnまで総和"  → \sum_{i=1}^{n}
 *   "xが0に近づく極限"  → \lim_{x \to 0}
 *   "xで微分"          → \frac{d}{dx}
 *   "アルファ たす ベータ" → \alpha + \beta
 *   "fイコールma"      → f = ma
 *   etc.
 */
export function parseJapanesemath(input: string): string {
  let result = input.trim();
  if (!result) return "";

  // ── Phase 1: 複合パターン（順序重要、長いものから） ──

  // [N]分の[M] → \frac{M}{N}  (日本語: 分母→分子の順)
  result = result.replace(
    /([^\s]+?)分の([^\s]+)/g,
    (_, denom, numer) => `\\frac{${parseTerm(numer)}}{${parseTerm(denom)}}`
  );

  // [X]の[N]乗 → X^{N}
  result = result.replace(
    /([a-zA-Zα-ωΑ-Ω\d\\{}()]+)の(\d+|[a-zA-Z])乗/g,
    (_, base, exp) => `${parseTerm(base)}^{${parseTerm(exp)}}`
  );

  // [N]乗根[X] → \sqrt[N]{X}
  result = result.replace(
    /(\d+)乗根([^\s]+)/g,
    (_, n, x) => `\\sqrt[${n}]{${parseTerm(x)}}`
  );

  // ルート[X] → \sqrt{X}
  result = result.replace(
    /ルート([^\s]+)/g,
    (_, x) => `\\sqrt{${parseTerm(x)}}`
  );

  // [X]から[Y]まで積分 → \int_{X}^{Y}
  result = result.replace(
    /([^\s]+)から([^\s]+)まで積分/g,
    (_, from, to) => `\\int_{${parseTerm(from)}}^{${parseTerm(to)}}`
  );

  // [X]から[Y]まで総和 → \sum_{X}^{Y}
  result = result.replace(
    /([^\s]+?)から([^\s]+?)まで総和/g,
    (_, from, to) => `\\sum_{${parseTerm(from)}}^{${parseTerm(to)}}`
  );

  // [X]から[Y]まで総乗 → \prod_{X}^{Y}
  result = result.replace(
    /([^\s]+?)から([^\s]+?)まで総乗/g,
    (_, from, to) => `\\prod_{${parseTerm(from)}}^{${parseTerm(to)}}`
  );

  // [X]が[Y]に近づく極限 / [X]を[Y]に飛ばす極限
  result = result.replace(
    /([a-zA-Z])が([^\s]+?)に近づく(?:とき(?:の)?)?極限/g,
    (_, x, a) => `\\lim_{${x} \\to ${parseTerm(a)}}`
  );
  result = result.replace(
    /([a-zA-Z])を([^\s]+?)に飛ばす極限/g,
    (_, x, a) => `\\lim_{${x} \\to ${parseTerm(a)}}`
  );

  // [X]で微分 → \frac{d}{dX}
  result = result.replace(
    /([a-zA-Z])で微分/g,
    (_, x) => `\\frac{d}{d${x}}`
  );

  // [X]で偏微分 → \frac{\partial}{\partial X}
  result = result.replace(
    /([a-zA-Z])で偏微分/g,
    (_, x) => `\\frac{\\partial}{\\partial ${x}}`
  );

  // ベクトル[X] → \vec{X}
  result = result.replace(
    /ベクトル([a-zA-Z])/g,
    (_, x) => `\\vec{${x}}`
  );

  // ハット[X] → \hat{X}
  result = result.replace(
    /ハット([a-zA-Z])/g,
    (_, x) => `\\hat{${x}}`
  );

  // バー[X] → \bar{X}
  result = result.replace(
    /バー([a-zA-Z])/g,
    (_, x) => `\\bar{${x}}`
  );

  // ドット[X] → \dot{X}
  result = result.replace(
    /ドット([a-zA-Z])/g,
    (_, x) => `\\dot{${x}}`
  );

  // 絶対値[X] → \left| X \right|
  result = result.replace(
    /絶対値([^\s]+)/g,
    (_, x) => `\\left| ${parseTerm(x)} \\right|`
  );

  // ── Phase 2: 演算子 ──
  result = result.replace(/たす/g, "+");
  result = result.replace(/足す/g, "+");
  result = result.replace(/プラス/g, "+");
  result = result.replace(/ひく/g, "-");
  result = result.replace(/引く/g, "-");
  result = result.replace(/マイナス/g, "-");
  result = result.replace(/かける/g, "\\times ");
  result = result.replace(/掛ける/g, "\\times ");
  result = result.replace(/わる/g, "\\div ");
  result = result.replace(/割る/g, "\\div ");
  result = result.replace(/イコール/g, "= ");
  result = result.replace(/等しい/g, "= ");
  result = result.replace(/ノットイコール/g, "\\neq ");
  result = result.replace(/以下/g, "\\leq ");
  result = result.replace(/以上/g, "\\geq ");
  result = result.replace(/未満/g, "< ");
  result = result.replace(/ならば/g, "\\Rightarrow ");

  // ── Phase 3: 単純な記号置換（辞書から） ──
  for (const entry of MATH_DICTIONARY) {
    if (entry.kind === "symbol" || entry.kind === "operator" || entry.kind === "relation") {
      // Reading
      if (result.includes(entry.reading)) {
        result = result.split(entry.reading).join(entry.latex + " ");
      }
      // Aliases
      for (const alias of entry.aliases) {
        if (alias.length > 1 && result.includes(alias)) {
          result = result.split(alias).join(entry.latex + " ");
        }
      }
    }
  }

  // ── Phase 4: 全角→半角 ──
  result = result.replace(/（/g, "(").replace(/）/g, ")");
  result = result.replace(/＝/g, "=");
  result = result.replace(/＋/g, "+");
  result = result.replace(/－/g, "-");

  // Clean up multiple spaces
  result = result.replace(/ +/g, " ").trim();

  return result;
}

/**
 * 個別の項(term)を処理。日本語のギリシャ文字名をLaTeXに変換。
 */
function parseTerm(term: string): string {
  const t = term.trim();
  // ギリシャ文字の日本語名
  const greekEntry = MATH_DICTIONARY.find(
    (e) => e.category === "ギリシャ文字" && (e.reading === t || e.aliases.includes(t))
  );
  if (greekEntry) return greekEntry.latex;

  // 特殊記号
  if (t === "無限大" || t === "無限" || t === "∞") return "\\infty";
  if (t === "パイ" || t === "ぱい" || t === "π") return "\\pi";

  return t;
}

// ──────────────────────────────────────────
// 4. リアルタイム候補生成
// ──────────────────────────────────────────

export interface JapaneseSuggestion {
  display: string;     // ユーザに見せるテキスト
  reading: string;     // 日本語の読み
  latex: string;       // 対応するLaTeX
  preview: string;     // KaTeXプレビュー用LaTeX
  category: string;
}

/**
 * 日本語入力のサフィックスに基づく候補生成
 */
export function getJapaneseSuggestions(input: string): JapaneseSuggestion[] {
  if (!input.trim()) return [];

  // 最後の単語/フレーズを取得
  const lastWord = input.split(/[\s　]+/).pop() || "";
  if (lastWord.length < 1) return [];

  const results: JapaneseSuggestion[] = [];

  for (const entry of MATH_DICTIONARY) {
    const matchScore = getMatchScore(lastWord, entry);
    if (matchScore > 0) {
      const preview = entry.latex.replace(/[AB]/g, "x").replace(/[N]/g, "n");
      results.push({
        display: `${entry.reading} → ${entry.description}`,
        reading: entry.reading,
        latex: entry.latex,
        preview,
        category: entry.category,
      });
    }
  }

  // Sort by relevance and limit
  return results.slice(0, 8);
}

function getMatchScore(query: string, entry: MathDictEntry): number {
  const q = query.toLowerCase();
  if (entry.reading.startsWith(q)) return 3;
  if (entry.reading.includes(q)) return 2;
  for (const alias of entry.aliases) {
    if (alias.startsWith(q)) return 3;
    if (alias.includes(q)) return 2;
  }
  if (entry.description.includes(q)) return 1;
  return 0;
}

// ──────────────────────────────────────────
// 5. スペーシング・プリセット
// ──────────────────────────────────────────

export interface SpacingPreset {
  name: string;
  latex: string;
  description: string;
  widthEm: number; // approximate width in em
}

export const SPACING_PRESETS: SpacingPreset[] = [
  { name: "負スペース", latex: "\\!", description: "少し詰める (-3/18em)", widthEm: -0.167 },
  { name: "極小", latex: "\\,", description: "微調整 (3/18em ≈ 1.7pt)", widthEm: 0.167 },
  { name: "小", latex: "\\:", description: "単語間 (4/18em ≈ 2.2pt)", widthEm: 0.222 },
  { name: "中", latex: "\\;", description: "区切り (5/18em ≈ 2.8pt)", widthEm: 0.278 },
  { name: "大", latex: "\\quad", description: "1em幅", widthEm: 1.0 },
  { name: "特大", latex: "\\qquad", description: "2em幅", widthEm: 2.0 },
];
