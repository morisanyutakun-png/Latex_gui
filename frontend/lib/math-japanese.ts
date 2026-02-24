/**
 * 日本語 → LaTeX 数式辞書 & パーサー
 *
 * 設計思想:
 * - LaTeXを「日本語訳」する。ユーザは日本語の数学的な読み方で数式を書く
 * - パーサーはトークン化 → パターンマッチ → LaTeX生成 の3段階
 * - 曖昧性がある場合はリアルタイムプレビュー + 候補で解決
 * - 段落内でも $...$ 記法でインライン数式を書ける
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
  // ══════ ギリシャ文字 (小文字) ══════
  { reading: "アルファ", aliases: ["あるふぁ", "α"], latex: "\\alpha", kind: "symbol", description: "ギリシャ文字 α", category: "ギリシャ文字" },
  { reading: "ベータ", aliases: ["べーた", "β"], latex: "\\beta", kind: "symbol", description: "ギリシャ文字 β", category: "ギリシャ文字" },
  { reading: "ガンマ", aliases: ["がんま", "γ"], latex: "\\gamma", kind: "symbol", description: "ギリシャ文字 γ", category: "ギリシャ文字" },
  { reading: "デルタ", aliases: ["でるた", "δ"], latex: "\\delta", kind: "symbol", description: "ギリシャ文字 δ", category: "ギリシャ文字" },
  { reading: "イプシロン", aliases: ["いぷしろん", "ε", "えぷしろん"], latex: "\\epsilon", kind: "symbol", description: "ギリシャ文字 ε", category: "ギリシャ文字" },
  { reading: "ゼータ", aliases: ["ぜーた", "ζ"], latex: "\\zeta", kind: "symbol", description: "ギリシャ文字 ζ", category: "ギリシャ文字" },
  { reading: "イータ", aliases: ["いーた", "η"], latex: "\\eta", kind: "symbol", description: "ギリシャ文字 η", category: "ギリシャ文字" },
  { reading: "シータ", aliases: ["しーた", "θ"], latex: "\\theta", kind: "symbol", description: "ギリシャ文字 θ", category: "ギリシャ文字" },
  { reading: "イオタ", aliases: ["いおた", "ι"], latex: "\\iota", kind: "symbol", description: "ギリシャ文字 ι", category: "ギリシャ文字" },
  { reading: "カッパ", aliases: ["かっぱ", "κ"], latex: "\\kappa", kind: "symbol", description: "ギリシャ文字 κ", category: "ギリシャ文字" },
  { reading: "ラムダ", aliases: ["らむだ", "λ"], latex: "\\lambda", kind: "symbol", description: "ギリシャ文字 λ", category: "ギリシャ文字" },
  { reading: "ミュー", aliases: ["みゅー", "μ"], latex: "\\mu", kind: "symbol", description: "ギリシャ文字 μ", category: "ギリシャ文字" },
  { reading: "ニュー", aliases: ["にゅー", "ν"], latex: "\\nu", kind: "symbol", description: "ギリシャ文字 ν", category: "ギリシャ文字" },
  { reading: "クサイ", aliases: ["くさい", "ξ", "グザイ"], latex: "\\xi", kind: "symbol", description: "ギリシャ文字 ξ", category: "ギリシャ文字" },
  { reading: "パイ", aliases: ["ぱい", "π", "円周率"], latex: "\\pi", kind: "symbol", description: "ギリシャ文字 π", category: "ギリシャ文字" },
  { reading: "ロー", aliases: ["ろー", "ρ"], latex: "\\rho", kind: "symbol", description: "ギリシャ文字 ρ", category: "ギリシャ文字" },
  { reading: "シグマ", aliases: ["しぐま", "σ"], latex: "\\sigma", kind: "symbol", description: "ギリシャ文字 σ", category: "ギリシャ文字" },
  { reading: "タウ", aliases: ["たう", "τ"], latex: "\\tau", kind: "symbol", description: "ギリシャ文字 τ", category: "ギリシャ文字" },
  { reading: "ウプシロン", aliases: ["うぷしろん", "υ"], latex: "\\upsilon", kind: "symbol", description: "ギリシャ文字 υ", category: "ギリシャ文字" },
  { reading: "ファイ", aliases: ["ふぁい", "φ"], latex: "\\phi", kind: "symbol", description: "ギリシャ文字 φ", category: "ギリシャ文字" },
  { reading: "カイ", aliases: ["かい", "χ"], latex: "\\chi", kind: "symbol", description: "ギリシャ文字 χ", category: "ギリシャ文字" },
  { reading: "プサイ", aliases: ["ぷさい", "ψ"], latex: "\\psi", kind: "symbol", description: "ギリシャ文字 ψ", category: "ギリシャ文字" },
  { reading: "オメガ", aliases: ["おめが", "ω"], latex: "\\omega", kind: "symbol", description: "ギリシャ文字 ω", category: "ギリシャ文字" },
  // 大文字
  { reading: "大ガンマ", aliases: ["大がんま", "Γ"], latex: "\\Gamma", kind: "symbol", description: "Γ", category: "ギリシャ文字" },
  { reading: "大デルタ", aliases: ["大でるた", "Δ"], latex: "\\Delta", kind: "symbol", description: "Δ", category: "ギリシャ文字" },
  { reading: "大シータ", aliases: ["大しーた", "Θ"], latex: "\\Theta", kind: "symbol", description: "Θ", category: "ギリシャ文字" },
  { reading: "大ラムダ", aliases: ["大らむだ", "Λ"], latex: "\\Lambda", kind: "symbol", description: "Λ", category: "ギリシャ文字" },
  { reading: "大シグマ", aliases: ["大しぐま", "Σ"], latex: "\\Sigma", kind: "symbol", description: "Σ", category: "ギリシャ文字" },
  { reading: "大パイ", aliases: ["大ぱい", "Π"], latex: "\\Pi", kind: "symbol", description: "Π", category: "ギリシャ文字" },
  { reading: "大ファイ", aliases: ["大ふぁい", "Φ"], latex: "\\Phi", kind: "symbol", description: "Φ", category: "ギリシャ文字" },
  { reading: "大プサイ", aliases: ["大ぷさい", "Ψ"], latex: "\\Psi", kind: "symbol", description: "Ψ", category: "ギリシャ文字" },
  { reading: "大オメガ", aliases: ["大おめが", "Ω"], latex: "\\Omega", kind: "symbol", description: "Ω", category: "ギリシャ文字" },
  // バリアント
  { reading: "ヴァーイプシロン", aliases: ["varepsilon"], latex: "\\varepsilon", kind: "symbol", description: "ε (variant)", category: "ギリシャ文字" },
  { reading: "ヴァーファイ", aliases: ["varphi"], latex: "\\varphi", kind: "symbol", description: "φ (variant)", category: "ギリシャ文字" },
  { reading: "ヴァーシータ", aliases: ["vartheta"], latex: "\\vartheta", kind: "symbol", description: "θ (variant)", category: "ギリシャ文字" },

  // ══════ 演算子 ══════
  { reading: "たす", aliases: ["プラス", "足す", "+"], latex: "+", kind: "operator", description: "加算", category: "演算" },
  { reading: "ひく", aliases: ["マイナス", "引く", "-"], latex: "-", kind: "operator", description: "減算", category: "演算" },
  { reading: "かける", aliases: ["掛ける", "×"], latex: "\\times", kind: "operator", description: "乗算", category: "演算" },
  { reading: "わる", aliases: ["割る", "÷"], latex: "\\div", kind: "operator", description: "除算", category: "演算" },
  { reading: "プラスマイナス", aliases: ["ぷらすまいなす", "±"], latex: "\\pm", kind: "operator", description: "±", category: "演算" },
  { reading: "マイナスプラス", aliases: ["∓"], latex: "\\mp", kind: "operator", description: "∓", category: "演算" },
  { reading: "内積", aliases: ["ないせき", "ドット積", "中点"], latex: "\\cdot", kind: "operator", description: "内積・中点", category: "演算" },
  { reading: "外積", aliases: ["がいせき", "クロス積"], latex: "\\times", kind: "operator", description: "外積", category: "演算" },
  { reading: "テンソル積", aliases: ["てんそるせき", "⊗"], latex: "\\otimes", kind: "operator", description: "⊗", category: "演算" },
  { reading: "直和", aliases: ["ちょくわ", "⊕"], latex: "\\oplus", kind: "operator", description: "⊕", category: "演算" },

  // ══════ 関係演算子 ══════
  { reading: "イコール", aliases: ["等しい", "＝", "="], latex: "=", kind: "relation", description: "等号", category: "関係" },
  { reading: "ノットイコール", aliases: ["等しくない", "≠"], latex: "\\neq", kind: "relation", description: "≠", category: "関係" },
  { reading: "小なりイコール", aliases: ["以下", "≤"], latex: "\\leq", kind: "relation", description: "≤", category: "関係" },
  { reading: "大なりイコール", aliases: ["以上", "≥"], latex: "\\geq", kind: "relation", description: "≥", category: "関係" },
  { reading: "小なり", aliases: ["未満", "<"], latex: "<", kind: "relation", description: "<", category: "関係" },
  { reading: "大なり", aliases: [">"], latex: ">", kind: "relation", description: ">", category: "関係" },
  { reading: "近似", aliases: ["ニアリーイコール", "≈", "約"], latex: "\\approx", kind: "relation", description: "≈", category: "関係" },
  { reading: "合同", aliases: ["≡", "定義"], latex: "\\equiv", kind: "relation", description: "≡", category: "関係" },
  { reading: "比例", aliases: ["∝"], latex: "\\propto", kind: "relation", description: "∝", category: "関係" },
  { reading: "属する", aliases: ["含まれる", "∈", "元"], latex: "\\in", kind: "relation", description: "∈", category: "関係" },
  { reading: "含まない", aliases: ["∉"], latex: "\\notin", kind: "relation", description: "∉", category: "関係" },
  { reading: "部分集合", aliases: ["⊂"], latex: "\\subset", kind: "relation", description: "⊂", category: "関係" },
  { reading: "真部分集合", aliases: ["⊊"], latex: "\\subsetneq", kind: "relation", description: "⊊", category: "関係" },
  { reading: "上位集合", aliases: ["⊃"], latex: "\\supset", kind: "relation", description: "⊃", category: "関係" },
  { reading: "ならば", aliases: ["⇒", "含意"], latex: "\\Rightarrow", kind: "relation", description: "⇒", category: "関係" },
  { reading: "同値", aliases: ["⇔", "必要十分"], latex: "\\Leftrightarrow", kind: "relation", description: "⇔", category: "関係" },
  { reading: "右矢印", aliases: ["→"], latex: "\\to", kind: "relation", description: "→", category: "関係" },
  { reading: "左矢印", aliases: ["←"], latex: "\\leftarrow", kind: "relation", description: "←", category: "関係" },
  { reading: "写像", aliases: ["マッピング", "↦"], latex: "\\mapsto", kind: "relation", description: "↦", category: "関係" },
  { reading: "垂直", aliases: ["直交", "⊥"], latex: "\\perp", kind: "relation", description: "⊥", category: "関係" },
  { reading: "平行", aliases: ["∥"], latex: "\\parallel", kind: "relation", description: "∥", category: "関係" },
  { reading: "相似", aliases: ["∼"], latex: "\\sim", kind: "relation", description: "∼", category: "関係" },

  // ══════ 構造系 (引数あり) ══════
  { reading: "分数", aliases: ["ぶんすう", "分の"], latex: "\\frac{A}{B}", kind: "binary",
    description: "分数: 「AぶんのB」→ B/A",
    category: "構造",
    example: { input: "2ぶんの1", output: "\\frac{1}{2}" } },
  { reading: "ルート", aliases: ["るーと", "平方根", "根号", "√"], latex: "\\sqrt{A}", kind: "unary",
    description: "平方根: 「ルートx」→ √x",
    category: "構造",
    example: { input: "ルート2", output: "\\sqrt{2}" } },
  { reading: "n乗根", aliases: ["じょうこん"], latex: "\\sqrt[N]{A}", kind: "binary",
    description: "n乗根: 「3乗根x」→ ∛x",
    category: "構造" },
  { reading: "乗", aliases: ["じょう", "の二乗", "の三乗", "べき"], latex: "^{A}", kind: "unary",
    description: "累乗: 「xの2乗」→ x²",
    category: "構造",
    example: { input: "xの2乗", output: "x^{2}" } },
  { reading: "添字", aliases: ["そえじ", "サブ", "したつき"], latex: "_{A}", kind: "unary",
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
  { reading: "太字", aliases: ["ボールド", "bold"], latex: "\\mathbf{A}", kind: "unary",
    description: "太字: 「太字A」→ 𝐀",
    category: "構造" },
  { reading: "ハット", aliases: ["はっと", "hat"], latex: "\\hat{A}", kind: "unary",
    description: "ハット: 「ハットa」→ â",
    category: "構造" },
  { reading: "チルダ", aliases: ["ちるだ", "tilde", "波"], latex: "\\tilde{A}", kind: "unary",
    description: "チルダ: 「チルダa」→ ã",
    category: "構造" },
  { reading: "上線", aliases: ["うわせん", "バー", "bar", "平均"], latex: "\\bar{A}", kind: "unary",
    description: "上線: 「バーx」→ x̄",
    category: "構造" },
  { reading: "ドット", aliases: ["どっと", "時間微分"], latex: "\\dot{A}", kind: "unary",
    description: "上ドット: 「ドットx」→ ẋ",
    category: "構造" },
  { reading: "ダブルドット", aliases: ["二階微分"], latex: "\\ddot{A}", kind: "unary",
    description: "二重ドット: 「ダブルドットx」",
    category: "構造" },
  { reading: "下線", aliases: ["アンダーライン"], latex: "\\underline{A}", kind: "unary",
    description: "下線",
    category: "構造" },
  { reading: "上括弧", aliases: ["オーバーブレース"], latex: "\\overbrace{A}", kind: "unary",
    description: "上括弧",
    category: "構造" },
  { reading: "下括弧", aliases: ["アンダーブレース"], latex: "\\underbrace{A}", kind: "unary",
    description: "下括弧",
    category: "構造" },
  { reading: "丸", aliases: ["丸囲み"], latex: "\\bigcirc", kind: "symbol",
    description: "○",
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
  { reading: "三重積分", aliases: ["さんじゅうせきぶん"], latex: "\\iiint", kind: "symbol",
    description: "三重積分: ∭",
    category: "微積分" },
  { reading: "周回積分", aliases: ["しゅうかいせきぶん", "線積分"], latex: "\\oint", kind: "symbol",
    description: "周回積分: ∮",
    category: "微積分" },
  { reading: "微分", aliases: ["びぶん", "d/dx"], latex: "\\frac{d}{dA}", kind: "unary",
    description: "微分: 「xで微分」→ d/dx",
    category: "微積分",
    example: { input: "xで微分", output: "\\frac{d}{dx}" } },
  { reading: "偏微分", aliases: ["へんびぶん"], latex: "\\frac{\\partial}{\\partial A}", kind: "unary",
    description: "偏微分: 「xで偏微分」→ ∂/∂x",
    category: "微積分" },
  { reading: "極限", aliases: ["きょくげん", "リミット", "lim"], latex: "\\lim_{A \\to B}", kind: "binary",
    description: "極限: 「xが0に近づくとき極限」",
    category: "微積分",
    example: { input: "xを無限大に飛ばす極限", output: "\\lim_{x \\to \\infty}" } },
  { reading: "総和", aliases: ["そうわ", "合計", "sum"], latex: "\\sum_{A}^{B}", kind: "binary",
    description: "総和: 「i=1からnまで総和」",
    category: "微積分",
    example: { input: "i=1からnまで総和", output: "\\sum_{i=1}^{n}" } },
  { reading: "総乗", aliases: ["そうじょう", "パイ積", "prod"], latex: "\\prod_{A}^{B}", kind: "binary",
    description: "総乗: 「i=1からnまで総乗」",
    category: "微積分" },
  { reading: "勾配", aliases: ["こうばい", "grad"], latex: "\\nabla", kind: "symbol",
    description: "勾配 ∇",
    category: "微積分" },
  { reading: "発散", aliases: ["はっさん", "div"], latex: "\\nabla \\cdot", kind: "symbol",
    description: "発散 ∇·",
    category: "微積分" },
  { reading: "回転", aliases: ["かいてん", "rot", "curl"], latex: "\\nabla \\times", kind: "symbol",
    description: "回転 ∇×",
    category: "微積分" },
  { reading: "ラプラシアン", aliases: ["らぷらしあん"], latex: "\\nabla^2", kind: "symbol",
    description: "ラプラシアン ∇²",
    category: "微積分" },

  // ══════ 特殊記号 ══════
  { reading: "無限大", aliases: ["むげんだい", "無限", "∞"], latex: "\\infty", kind: "symbol", description: "∞", category: "特殊" },
  { reading: "偏微分記号", aliases: ["パーシャル", "∂"], latex: "\\partial", kind: "symbol", description: "∂", category: "特殊" },
  { reading: "ナブラ", aliases: ["なぶら", "∇"], latex: "\\nabla", kind: "symbol", description: "∇", category: "特殊" },
  { reading: "任意の", aliases: ["すべての", "フォーオール", "∀"], latex: "\\forall", kind: "symbol", description: "∀", category: "特殊" },
  { reading: "存在する", aliases: ["イグジスト", "∃"], latex: "\\exists", kind: "symbol", description: "∃", category: "特殊" },
  { reading: "存在しない", aliases: ["∄"], latex: "\\nexists", kind: "symbol", description: "∄", category: "特殊" },
  { reading: "和集合", aliases: ["わしゅうごう", "ユニオン", "∪"], latex: "\\cup", kind: "operator", description: "∪", category: "集合" },
  { reading: "共通集合", aliases: ["きょうつうしゅうごう", "インターセクション", "∩"], latex: "\\cap", kind: "operator", description: "∩", category: "集合" },
  { reading: "空集合", aliases: ["くうしゅうごう", "∅"], latex: "\\emptyset", kind: "symbol", description: "∅", category: "集合" },
  { reading: "実数", aliases: ["じっすう", "R"], latex: "\\mathbb{R}", kind: "symbol", description: "ℝ", category: "集合" },
  { reading: "整数", aliases: ["せいすう", "Z"], latex: "\\mathbb{Z}", kind: "symbol", description: "ℤ", category: "集合" },
  { reading: "自然数", aliases: ["しぜんすう", "N"], latex: "\\mathbb{N}", kind: "symbol", description: "ℕ", category: "集合" },
  { reading: "有理数", aliases: ["ゆうりすう", "Q"], latex: "\\mathbb{Q}", kind: "symbol", description: "ℚ", category: "集合" },
  { reading: "複素数", aliases: ["ふくそすう", "C"], latex: "\\mathbb{C}", kind: "symbol", description: "ℂ", category: "集合" },
  { reading: "エイチバー", aliases: ["ディラック定数", "ℏ"], latex: "\\hbar", kind: "symbol", description: "ℏ", category: "特殊" },
  { reading: "三角", aliases: ["三角形", "△"], latex: "\\triangle", kind: "symbol", description: "△", category: "特殊" },
  { reading: "角度", aliases: ["角", "∠"], latex: "\\angle", kind: "symbol", description: "∠", category: "特殊" },
  { reading: "度", aliases: ["ど", "°"], latex: "^{\\circ}", kind: "symbol", description: "°", category: "特殊" },
  { reading: "三点リーダー", aliases: ["…", "ドット3つ", "省略"], latex: "\\cdots", kind: "symbol", description: "⋯", category: "特殊" },
  { reading: "縦三点", aliases: ["⋮"], latex: "\\vdots", kind: "symbol", description: "⋮", category: "特殊" },
  { reading: "斜め三点", aliases: ["⋱"], latex: "\\ddots", kind: "symbol", description: "⋱", category: "特殊" },
  { reading: "したがって", aliases: ["ゆえに", "∴"], latex: "\\therefore", kind: "symbol", description: "∴", category: "特殊" },
  { reading: "なぜなら", aliases: ["∵"], latex: "\\because", kind: "symbol", description: "∵", category: "特殊" },
  { reading: "QED", aliases: ["証明終了", "□"], latex: "\\square", kind: "symbol", description: "□ (QED)", category: "特殊" },
  { reading: "天井関数", aliases: ["切り上げ"], latex: "\\lceil A \\rceil", kind: "unary", description: "⌈x⌉", category: "特殊" },
  { reading: "床関数", aliases: ["切り捨て", "ガウス"], latex: "\\lfloor A \\rfloor", kind: "unary", description: "⌊x⌋", category: "特殊" },

  // ══════ 三角関数 & 関数 ══════
  { reading: "サイン", aliases: ["さいん", "sin"], latex: "\\sin", kind: "symbol", description: "sin", category: "関数" },
  { reading: "コサイン", aliases: ["こさいん", "cos"], latex: "\\cos", kind: "symbol", description: "cos", category: "関数" },
  { reading: "タンジェント", aliases: ["たんじぇんと", "tan"], latex: "\\tan", kind: "symbol", description: "tan", category: "関数" },
  { reading: "アークサイン", aliases: ["あーくさいん", "arcsin", "逆サイン"], latex: "\\arcsin", kind: "symbol", description: "arcsin", category: "関数" },
  { reading: "アークコサイン", aliases: ["あーくこさいん", "arccos", "逆コサイン"], latex: "\\arccos", kind: "symbol", description: "arccos", category: "関数" },
  { reading: "アークタンジェント", aliases: ["あーくたんじぇんと", "arctan", "逆タンジェント"], latex: "\\arctan", kind: "symbol", description: "arctan", category: "関数" },
  { reading: "ハイパボリックサイン", aliases: ["sinh"], latex: "\\sinh", kind: "symbol", description: "sinh", category: "関数" },
  { reading: "ハイパボリックコサイン", aliases: ["cosh"], latex: "\\cosh", kind: "symbol", description: "cosh", category: "関数" },
  { reading: "ログ", aliases: ["ろぐ", "対数", "log"], latex: "\\log", kind: "symbol", description: "log", category: "関数" },
  { reading: "自然対数", aliases: ["エルエヌ", "ln", "ネイピア"], latex: "\\ln", kind: "symbol", description: "ln", category: "関数" },
  { reading: "エクスポネンシャル", aliases: ["指数関数", "exp", "イーの"], latex: "\\exp", kind: "symbol", description: "exp", category: "関数" },
  { reading: "最大", aliases: ["max", "マックス"], latex: "\\max", kind: "symbol", description: "max", category: "関数" },
  { reading: "最小", aliases: ["min", "ミニマム"], latex: "\\min", kind: "symbol", description: "min", category: "関数" },
  { reading: "上限", aliases: ["sup", "上界"], latex: "\\sup", kind: "symbol", description: "sup", category: "関数" },
  { reading: "下限", aliases: ["inf", "下界"], latex: "\\inf", kind: "symbol", description: "inf", category: "関数" },
  { reading: "行列式", aliases: ["det", "デターミナント"], latex: "\\det", kind: "symbol", description: "det", category: "関数" },
  { reading: "次元", aliases: ["dim", "ディメンション"], latex: "\\dim", kind: "symbol", description: "dim", category: "関数" },
  { reading: "核", aliases: ["ker", "カーネル"], latex: "\\ker", kind: "symbol", description: "ker", category: "関数" },
  { reading: "像", aliases: ["im", "イメージ"], latex: "\\operatorname{Im}", kind: "symbol", description: "Im", category: "関数" },

  // ══════ 線形代数 ══════
  { reading: "転置", aliases: ["てんち", "トランスポーズ"], latex: "^{\\top}", kind: "symbol", description: "転置 ᵀ", category: "線形代数" },
  { reading: "逆行列", aliases: ["ぎゃくぎょうれつ", "インバース"], latex: "^{-1}", kind: "symbol", description: "逆 ⁻¹", category: "線形代数" },
  { reading: "トレース", aliases: ["とれーす", "trace", "跡"], latex: "\\operatorname{tr}", kind: "symbol", description: "tr", category: "線形代数" },
  { reading: "ランク", aliases: ["らんく", "rank", "階数"], latex: "\\operatorname{rank}", kind: "symbol", description: "rank", category: "線形代数" },
  { reading: "ダガー", aliases: ["†", "エルミート"], latex: "^{\\dagger}", kind: "symbol", description: "† (エルミート共役)", category: "線形代数" },

  // ══════ 確率・統計 ══════
  { reading: "確率", aliases: ["かくりつ", "P"], latex: "P", kind: "symbol", description: "確率 P", category: "確率統計" },
  { reading: "期待値", aliases: ["きたいち", "E"], latex: "\\mathbb{E}", kind: "symbol", description: "𝔼", category: "確率統計" },
  { reading: "分散", aliases: ["ぶんさん", "Var"], latex: "\\operatorname{Var}", kind: "symbol", description: "Var", category: "確率統計" },
  { reading: "共分散", aliases: ["きょうぶんさん", "Cov"], latex: "\\operatorname{Cov}", kind: "symbol", description: "Cov", category: "確率統計" },
  { reading: "標準偏差", aliases: ["ひょうじゅんへんさ"], latex: "\\sigma", kind: "symbol", description: "σ (standard deviation)", category: "確率統計" },
  { reading: "正規分布", aliases: ["せいきぶんぷ", "ガウス分布"], latex: "\\mathcal{N}", kind: "symbol", description: "𝒩 (正規分布)", category: "確率統計" },
  { reading: "相関", aliases: ["そうかん"], latex: "\\rho", kind: "symbol", description: "ρ (相関係数)", category: "確率統計" },
  { reading: "組合せ", aliases: ["くみあわせ", "コンビネーション", "nCr"], latex: "\\binom{A}{B}", kind: "binary", description: "二項係数 C(n,r)", category: "確率統計" },

  // ══════ 環境 ══════
  { reading: "行列", aliases: ["ぎょうれつ", "マトリックス", "matrix"], latex: "\\begin{pmatrix} A \\end{pmatrix}", kind: "environment",
    description: "行列環境",
    category: "環境" },
  { reading: "角括弧行列", aliases: ["かくかっこぎょうれつ"], latex: "\\begin{bmatrix} A \\end{bmatrix}", kind: "environment",
    description: "角括弧行列",
    category: "環境" },
  { reading: "行列式記号", aliases: ["ぎょうれつしききごう"], latex: "\\begin{vmatrix} A \\end{vmatrix}", kind: "environment",
    description: "行列式環境",
    category: "環境" },
  { reading: "連立方程式", aliases: ["れんりつほうていしき", "cases"], latex: "\\begin{cases} A \\end{cases}", kind: "environment",
    description: "連立方程式",
    category: "環境" },
  { reading: "場合分け", aliases: ["ばあいわけ"], latex: "\\begin{cases} A \\end{cases}", kind: "environment",
    description: "場合分け",
    category: "環境" },
  { reading: "整列数式", aliases: ["せいれつすうしき", "align"], latex: "\\begin{aligned} A \\end{aligned}", kind: "environment",
    description: "複数行数式の整列",
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

// ──────────────────────────────────────────
// 6. インライン数式パーサー（段落テキスト用）
// ──────────────────────────────────────────

/**
 * 段落テキスト中のインライン数式を検出・変換する
 *
 * テキスト中で $...$ で囲まれた部分を日本語→LaTeXに変換し、
 * テキスト+数式のセグメント配列を返す
 *
 * 例:
 *   "力の公式は $fイコールma$ です" →
 *   [
 *     { type: "text", content: "力の公式は " },
 *     { type: "math", raw: "fイコールma", latex: "f = ma" },
 *     { type: "text", content: " です" },
 *   ]
 */

export interface InlineSegment {
  type: "text" | "math";
  content: string;
  /** 数式セグメントの場合: 元の日本語入力 */
  raw?: string;
  /** 数式セグメントの場合: 変換後LaTeX */
  latex?: string;
}

export function parseInlineText(text: string): InlineSegment[] {
  if (!text) return [{ type: "text", content: "" }];

  const segments: InlineSegment[] = [];
  const regex = /\$([^$]+)\$/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // テキスト部分
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    // 数式部分: 日本語→LaTeX変換
    const raw = match[1];
    const latex = parseJapanesemath(raw);
    segments.push({ type: "math", content: latex, raw, latex });
    lastIndex = match.index + match[0].length;
  }

  // 残りのテキスト
  if (lastIndex < text.length) {
    segments.push({ type: "text", content: text.slice(lastIndex) });
  }

  if (segments.length === 0) {
    return [{ type: "text", content: text }];
  }

  return segments;
}

/**
 * インラインテキストから最終的なLaTeXを生成する
 * 段落ブロックで使用: テキスト部分はそのまま、数式部分は $...$で囲む
 */
export function renderInlineToLatex(text: string): string {
  const segments = parseInlineText(text);
  return segments
    .map((s) => {
      if (s.type === "math" && s.latex) {
        return `$${s.latex}$`;
      }
      return s.content;
    })
    .join("");
}

/**
 * カーソル位置が$...$の中にいるかどうか判定し、
 * 数式部分のインデックスと内容を返す
 */
export function getInlineMathContext(text: string, cursorPos: number): {
  inMath: boolean;
  mathStart: number;
  mathEnd: number;
  mathContent: string;
} | null {
  if (!text) return null;

  const regex = /\$([^$]*)\$/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const start = match.index + 1; // $ の次の文字
    const end = match.index + match[0].length - 1; // 閉じ $ の前
    if (cursorPos >= start && cursorPos <= end) {
      return {
        inMath: true,
        mathStart: match.index,
        mathEnd: match.index + match[0].length,
        mathContent: match[1],
      };
    }
  }

  // 開いた $ はあるが閉じていない場合（入力中）
  const lastDollar = text.lastIndexOf("$");
  if (lastDollar >= 0 && cursorPos > lastDollar) {
    // 閉じられた$の後では無いことを確認
    const afterDollar = text.slice(lastDollar + 1);
    if (!afterDollar.includes("$")) {
      return {
        inMath: true,
        mathStart: lastDollar,
        mathEnd: text.length,
        mathContent: afterDollar,
      };
    }
  }

  return null;
}

/**
 * カテゴリ一覧を取得（辞書ブラウジング用）
 */
export function getDictionaryCategories(): string[] {
  const cats = new Set<string>();
  for (const entry of MATH_DICTIONARY) {
    cats.add(entry.category);
  }
  return Array.from(cats);
}

/**
 * カテゴリでフィルタリング
 */
export function getDictionaryByCategory(category: string): MathDictEntry[] {
  return MATH_DICTIONARY.filter((e) => e.category === category);
}

/**
 * 全文検索（reading, aliases, description すべてから検索）
 */
export function searchDictionary(query: string): MathDictEntry[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase().trim();

  return MATH_DICTIONARY
    .map((entry) => {
      let score = 0;
      if (entry.reading.toLowerCase().startsWith(q)) score += 10;
      else if (entry.reading.toLowerCase().includes(q)) score += 5;
      for (const alias of entry.aliases) {
        if (alias.toLowerCase().startsWith(q)) score += 8;
        else if (alias.toLowerCase().includes(q)) score += 4;
      }
      if (entry.description.toLowerCase().includes(q)) score += 3;
      if (entry.latex.toLowerCase().includes(q)) score += 2;
      return { entry, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.entry);
}
