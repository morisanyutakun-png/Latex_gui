/**
 * 日本語 → LaTeX 数式辞書 & パーサー
 *
 * ═══════════════════════════════════════════════════════════════
 *  設計原則 (Design Rules) — 曖昧さゼロの構造化ルール
 * ═══════════════════════════════════════════════════════════════
 *
 * 【原則1: 正規化優先 (Normalize First)】
 *   入力テキストは解析前に必ず正規化する。
 *   - カタカナ → ひらがな (スクリプト統一: タス → たす)
 *   - 全角英数 → 半角 (＋ → +, Ａ → A, ０ → 0)
 *   - 長音の統一 (ー はそのまま保持)
 *   ※ 漢数字 → 算用数字 は構造パターン内でのみ実行 (「一般」誤変換防止)
 *
 * 【原則2: 辞書は単一情報源 (Single Source of Truth)】
 *   - reading: 表示用の正規読み (自然な表記: カタカナ or ひらがな or 漢字)
 *   - aliases: 漢字表記、活用形、英語、記号を明示的に列挙
 *   - カタカナ/ひらがなの揺れは正規化で自動吸収 → aliases に両方入れる必要なし
 *   - ただし 漢字 ↔ ひらがな は自動変換不可 → 必ず aliases に両方列挙
 *
 * 【原則3: パーサーの優先順位 (Parser Precedence)】
 *   Phase 0: 入力正規化 (全角→半角, カタカナ→ひらがな)
 *   Phase 1: 構造パターン (分数, 累乗, ルート, 積分...) — 長いパターン優先
 *   Phase 2: 装飾パターン (べくとる, はっと, ばー, どっと...)
 *   Phase 3: 演算子・関係子 (たす/足す, ひく/引く, いこーる/等しい...)
 *   Phase 4: 辞書引き (記号, 関数名 — 正規化済みマッチ)
 *   Phase 5: 後処理 (全角記号残余, 空白整理)
 *
 * 【原則4: 曖昧さの排除 (Disambiguation)】
 *   - 漢数字変換は構造パターン文脈でのみ実行
 *   - 活用形は自動推測せず、人手で aliases に明示列挙
 *   - カタカナ語のひらがな形は正規化で自動対応
 *   - 同音異義語は kind + category で区別
 *
 * 【原則5: 入力形式の完全網羅】
 *   あらゆる入力に対応:
 *   - ひらがな: たす → +
 *   - カタカナ: タス → (正規化→たす) → +
 *   - 漢字: 足す → +
 *   - 漢字+かな混じり: 足して → +
 *   - 漢数字: 二分の一 → \frac{1}{2}
 *   - 全角: ＋ → +
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// §1. 型定義
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface MathDictEntry {
  /** 日本語の読み方 (表示用の正規形。カタカナ/ひらがな/漢字いずれか) */
  reading: string;
  /** 別の読み方・表記揺れ (漢字↔ひらがな, 活用形, 英語, 記号) */
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// §2. 正規化ユーティリティ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * カタカナ → ひらがな 変換
 * U+30A1-U+30F6 (ァ-ヶ) → U+3041-U+3096 (ぁ-ゖ)
 * 長音記号 ー (U+30FC) はそのまま保持
 */
function katakanaToHiragana(s: string): string {
  return s.replace(/[\u30A1-\u30F6]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

/**
 * 全角英数記号 → 半角
 * Ａ-Ｚ, ａ-ｚ, ０-９ → A-Z, a-z, 0-9
 * ＋, －, ＝, ×, （, ）, etc.
 */
export function zenkakuToHankaku(s: string): string {
  return s
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
    )
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/＝/g, "=")
    .replace(/＋/g, "+")
    .replace(/－/g, "-")
    .replace(/＊/g, "*")
    .replace(/／/g, "/")
    .replace(/｛/g, "{")
    .replace(/｝/g, "}")
    .replace(/［/g, "[")
    .replace(/］/g, "]")
    .replace(/　/g, " ");
}

/**
 * 漢数字の単一字 → 算用数字
 */
const KANJI_DIGIT: Record<string, number> = {
  "零": 0, "〇": 0,
  "一": 1, "二": 2, "三": 3, "四": 4, "五": 5,
  "六": 6, "七": 7, "八": 8, "九": 9,
};
const KANJI_UNIT: Record<string, number> = {
  "十": 10, "百": 100, "千": 1000, "万": 10000,
};

/**
 * 漢数字文字列 → 算用数字
 * 例: "一" → 1, "二十三" → 23, "千二百三十四" → 1234, "百五" → 105
 * 解析不能な場合は null を返す
 */
export function parseKanjiNumber(kanji: string): number | null {
  if (!kanji) return null;

  // 単一漢数字
  if (kanji.length === 1 && kanji in KANJI_DIGIT) return KANJI_DIGIT[kanji];

  let result = 0;
  let current = 0;
  let hasValidChar = false;

  for (const ch of kanji) {
    if (ch in KANJI_DIGIT) {
      current = KANJI_DIGIT[ch];
      hasValidChar = true;
    } else if (ch in KANJI_UNIT) {
      hasValidChar = true;
      if (current === 0) current = 1; // 十 = 10 (not 0×10)
      result += current * KANJI_UNIT[ch];
      current = 0;
    } else {
      return null; // 漢数字以外の文字 → 数字ではない
    }
  }

  if (!hasValidChar) return null;
  result += current; // 末尾の端数 (二十「三」の3)
  return result;
}

/**
 * テキスト中の漢数字列を算用数字に変換 (構造パターン内で使用)
 * ※ 汎用テキストには適用しない (「一般」→「1般」を防ぐ)
 */
export function resolveKanjiNumberInTerm(term: string): string {
  const num = parseKanjiNumber(term);
  return num !== null ? num.toString() : term;
}

/**
 * マッチング用正規化: カタカナ→ひらがな + 全角→半角
 * 辞書検索・サジェストで使用
 */
export function normalizeForMatch(s: string): string {
  return katakanaToHiragana(zenkakuToHankaku(s)).toLowerCase();
}

/**
 * パーサー用正規化: 全角→半角 + カタカナ→ひらがな
 * パーサーの Phase 0 で適用
 */
function normalizeForParse(s: string): string {
  return katakanaToHiragana(zenkakuToHankaku(s));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// §3. 日本語 → LaTeX 辞書
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
// aliases ルール:
//   - 漢字表記は必須 (正規化で自動変換されないため)
//   - ひらがな表記は漢字 reading の場合必須
//   - カタカナ⇔ひらがなは正規化で吸収 → 片方だけでOK
//   - 活用形 (〜て, 〜した) は頻出するもののみ列挙
//   - 英語・記号は可能な限り列挙
//

export const MATH_DICTIONARY: MathDictEntry[] = [
  // ══════════════════════════════════════
  // ギリシャ文字 (小文字)
  // reading: カタカナ (表示用) → 正規化でひらがなマッチ自動対応
  // ══════════════════════════════════════
  { reading: "アルファ", aliases: ["α"], latex: "\\alpha", kind: "symbol", description: "ギリシャ文字 α", category: "ギリシャ文字" },
  { reading: "ベータ", aliases: ["β"], latex: "\\beta", kind: "symbol", description: "ギリシャ文字 β", category: "ギリシャ文字" },
  { reading: "ガンマ", aliases: ["γ"], latex: "\\gamma", kind: "symbol", description: "ギリシャ文字 γ", category: "ギリシャ文字" },
  { reading: "デルタ", aliases: ["δ"], latex: "\\delta", kind: "symbol", description: "ギリシャ文字 δ", category: "ギリシャ文字" },
  { reading: "イプシロン", aliases: ["ε", "エプシロン"], latex: "\\epsilon", kind: "symbol", description: "ギリシャ文字 ε", category: "ギリシャ文字" },
  { reading: "ゼータ", aliases: ["ζ"], latex: "\\zeta", kind: "symbol", description: "ギリシャ文字 ζ", category: "ギリシャ文字" },
  { reading: "イータ", aliases: ["η"], latex: "\\eta", kind: "symbol", description: "ギリシャ文字 η", category: "ギリシャ文字" },
  { reading: "シータ", aliases: ["θ"], latex: "\\theta", kind: "symbol", description: "ギリシャ文字 θ", category: "ギリシャ文字" },
  { reading: "イオタ", aliases: ["ι"], latex: "\\iota", kind: "symbol", description: "ギリシャ文字 ι", category: "ギリシャ文字" },
  { reading: "カッパ", aliases: ["κ"], latex: "\\kappa", kind: "symbol", description: "ギリシャ文字 κ", category: "ギリシャ文字" },
  { reading: "ラムダ", aliases: ["λ"], latex: "\\lambda", kind: "symbol", description: "ギリシャ文字 λ", category: "ギリシャ文字" },
  { reading: "ミュー", aliases: ["μ"], latex: "\\mu", kind: "symbol", description: "ギリシャ文字 μ", category: "ギリシャ文字" },
  { reading: "ニュー", aliases: ["ν"], latex: "\\nu", kind: "symbol", description: "ギリシャ文字 ν", category: "ギリシャ文字" },
  { reading: "クサイ", aliases: ["ξ", "グザイ"], latex: "\\xi", kind: "symbol", description: "ギリシャ文字 ξ", category: "ギリシャ文字" },
  { reading: "パイ", aliases: ["π", "円周率", "えんしゅうりつ"], latex: "\\pi", kind: "symbol", description: "ギリシャ文字 π", category: "ギリシャ文字" },
  { reading: "ロー", aliases: ["ρ"], latex: "\\rho", kind: "symbol", description: "ギリシャ文字 ρ", category: "ギリシャ文字" },
  { reading: "シグマ", aliases: ["σ"], latex: "\\sigma", kind: "symbol", description: "ギリシャ文字 σ", category: "ギリシャ文字" },
  { reading: "タウ", aliases: ["τ"], latex: "\\tau", kind: "symbol", description: "ギリシャ文字 τ", category: "ギリシャ文字" },
  { reading: "ウプシロン", aliases: ["υ"], latex: "\\upsilon", kind: "symbol", description: "ギリシャ文字 υ", category: "ギリシャ文字" },
  { reading: "ファイ", aliases: ["φ"], latex: "\\phi", kind: "symbol", description: "ギリシャ文字 φ", category: "ギリシャ文字" },
  { reading: "カイ", aliases: ["χ"], latex: "\\chi", kind: "symbol", description: "ギリシャ文字 χ", category: "ギリシャ文字" },
  { reading: "プサイ", aliases: ["ψ"], latex: "\\psi", kind: "symbol", description: "ギリシャ文字 ψ", category: "ギリシャ文字" },
  { reading: "オメガ", aliases: ["ω"], latex: "\\omega", kind: "symbol", description: "ギリシャ文字 ω", category: "ギリシャ文字" },

  // ギリシャ文字 (大文字)
  { reading: "大ガンマ", aliases: ["Γ", "大がんま"], latex: "\\Gamma", kind: "symbol", description: "Γ", category: "ギリシャ文字" },
  { reading: "大デルタ", aliases: ["Δ", "大でるた"], latex: "\\Delta", kind: "symbol", description: "Δ", category: "ギリシャ文字" },
  { reading: "大シータ", aliases: ["Θ", "大しーた"], latex: "\\Theta", kind: "symbol", description: "Θ", category: "ギリシャ文字" },
  { reading: "大ラムダ", aliases: ["Λ", "大らむだ"], latex: "\\Lambda", kind: "symbol", description: "Λ", category: "ギリシャ文字" },
  { reading: "大シグマ", aliases: ["Σ", "大しぐま"], latex: "\\Sigma", kind: "symbol", description: "Σ", category: "ギリシャ文字" },
  { reading: "大パイ", aliases: ["Π", "大ぱい"], latex: "\\Pi", kind: "symbol", description: "Π", category: "ギリシャ文字" },
  { reading: "大ファイ", aliases: ["Φ", "大ふぁい"], latex: "\\Phi", kind: "symbol", description: "Φ", category: "ギリシャ文字" },
  { reading: "大プサイ", aliases: ["Ψ", "大ぷさい"], latex: "\\Psi", kind: "symbol", description: "Ψ", category: "ギリシャ文字" },
  { reading: "大オメガ", aliases: ["Ω", "大おめが"], latex: "\\Omega", kind: "symbol", description: "Ω", category: "ギリシャ文字" },

  // バリアント
  { reading: "ヴァーイプシロン", aliases: ["varepsilon"], latex: "\\varepsilon", kind: "symbol", description: "ε (variant)", category: "ギリシャ文字" },
  { reading: "ヴァーファイ", aliases: ["varphi"], latex: "\\varphi", kind: "symbol", description: "φ (variant)", category: "ギリシャ文字" },
  { reading: "ヴァーシータ", aliases: ["vartheta"], latex: "\\vartheta", kind: "symbol", description: "θ (variant)", category: "ギリシャ文字" },

  // ══════════════════════════════════════
  // 演算子
  // aliases: 漢字, 漢字活用形, ひらがな活用形, 英語loanword, 記号
  // ══════════════════════════════════════
  { reading: "たす", aliases: ["足す", "足して", "たして", "プラス", "+", "加算", "かさん"],
    latex: "+", kind: "operator", description: "加算", category: "演算",
    example: { input: "a たす b", output: "a + b" } },
  { reading: "ひく", aliases: ["引く", "引いて", "ひいて", "マイナス", "-", "減算", "げんざん"],
    latex: "-", kind: "operator", description: "減算", category: "演算" },
  { reading: "かける", aliases: ["掛ける", "掛けて", "かけて", "×", "乗算", "じょうざん"],
    latex: "\\times", kind: "operator", description: "乗算", category: "演算" },
  { reading: "わる", aliases: ["割る", "割って", "わって", "÷", "除算", "じょざん"],
    latex: "\\div", kind: "operator", description: "除算", category: "演算" },
  { reading: "プラスマイナス", aliases: ["±", "ぷらすまいなす"],
    latex: "\\pm", kind: "operator", description: "±", category: "演算" },
  { reading: "マイナスプラス", aliases: ["∓", "まいなすぷらす"],
    latex: "\\mp", kind: "operator", description: "∓", category: "演算" },
  { reading: "内積", aliases: ["ないせき", "ドット積", "どっとせき", "中点", "ちゅうてん", "・"],
    latex: "\\cdot", kind: "operator", description: "内積・中点", category: "演算" },
  { reading: "外積", aliases: ["がいせき", "クロス積", "くろすせき"],
    latex: "\\times", kind: "operator", description: "外積", category: "演算" },
  { reading: "テンソル積", aliases: ["てんそるせき", "⊗"],
    latex: "\\otimes", kind: "operator", description: "⊗", category: "演算" },
  { reading: "直和", aliases: ["ちょくわ", "⊕"],
    latex: "\\oplus", kind: "operator", description: "⊕", category: "演算" },

  // ══════════════════════════════════════
  // 関係演算子
  // aliases: 漢字, ひらがな, 英語, 記号
  // ══════════════════════════════════════
  { reading: "イコール", aliases: ["等しい", "ひとしい", "＝", "=", "いこーる"],
    latex: "=", kind: "relation", description: "等号", category: "関係" },
  { reading: "ノットイコール", aliases: ["等しくない", "ひとしくない", "≠", "のっといこーる"],
    latex: "\\neq", kind: "relation", description: "≠", category: "関係" },
  { reading: "小なりイコール", aliases: ["以下", "いか", "≤", "こなりいこーる"],
    latex: "\\leq", kind: "relation", description: "≤", category: "関係" },
  { reading: "大なりイコール", aliases: ["以上", "いじょう", "≥", "おおなりいこーる"],
    latex: "\\geq", kind: "relation", description: "≥", category: "関係" },
  { reading: "小なり", aliases: ["未満", "みまん", "<", "こなり"],
    latex: "<", kind: "relation", description: "<", category: "関係" },
  { reading: "大なり", aliases: [">", "おおなり"],
    latex: ">", kind: "relation", description: ">", category: "関係" },
  { reading: "近似", aliases: ["きんじ", "ニアリーイコール", "≈", "約", "やく"],
    latex: "\\approx", kind: "relation", description: "≈", category: "関係" },
  { reading: "合同", aliases: ["ごうどう", "≡", "定義", "ていぎ"],
    latex: "\\equiv", kind: "relation", description: "≡", category: "関係" },
  { reading: "比例", aliases: ["ひれい", "∝"],
    latex: "\\propto", kind: "relation", description: "∝", category: "関係" },
  { reading: "属する", aliases: ["ぞくする", "含まれる", "ふくまれる", "∈", "元"],
    latex: "\\in", kind: "relation", description: "∈", category: "関係" },
  { reading: "含まない", aliases: ["ふくまない", "∉", "属さない", "ぞくさない"],
    latex: "\\notin", kind: "relation", description: "∉", category: "関係" },
  { reading: "部分集合", aliases: ["ぶぶんしゅうごう", "⊂"],
    latex: "\\subset", kind: "relation", description: "⊂", category: "関係" },
  { reading: "真部分集合", aliases: ["しんぶぶんしゅうごう", "⊊"],
    latex: "\\subsetneq", kind: "relation", description: "⊊", category: "関係" },
  { reading: "上位集合", aliases: ["じょういしゅうごう", "⊃"],
    latex: "\\supset", kind: "relation", description: "⊃", category: "関係" },
  { reading: "ならば", aliases: ["⇒", "含意", "がんい"],
    latex: "\\Rightarrow", kind: "relation", description: "⇒", category: "関係" },
  { reading: "同値", aliases: ["どうち", "⇔", "必要十分", "ひつようじゅうぶん"],
    latex: "\\Leftrightarrow", kind: "relation", description: "⇔", category: "関係" },
  { reading: "右矢印", aliases: ["みぎやじるし", "→"],
    latex: "\\to", kind: "relation", description: "→", category: "関係" },
  { reading: "左矢印", aliases: ["ひだりやじるし", "←"],
    latex: "\\leftarrow", kind: "relation", description: "←", category: "関係" },
  { reading: "写像", aliases: ["しゃぞう", "マッピング", "↦"],
    latex: "\\mapsto", kind: "relation", description: "↦", category: "関係" },
  { reading: "垂直", aliases: ["すいちょく", "直交", "ちょっこう", "⊥"],
    latex: "\\perp", kind: "relation", description: "⊥", category: "関係" },
  { reading: "平行", aliases: ["へいこう", "∥"],
    latex: "\\parallel", kind: "relation", description: "∥", category: "関係" },
  { reading: "相似", aliases: ["そうじ", "∼"],
    latex: "\\sim", kind: "relation", description: "∼", category: "関係" },

  // ══════════════════════════════════════
  // 構造系 (引数あり)
  // ══════════════════════════════════════
  { reading: "分数", aliases: ["ぶんすう", "分の", "ぶんの"],
    latex: "\\frac{A}{B}", kind: "binary",
    description: "分数: 「AぶんのB」→ B/A",
    category: "構造",
    example: { input: "2ぶんの1", output: "\\frac{1}{2}" } },
  { reading: "ルート", aliases: ["平方根", "へいほうこん", "根号", "こんごう", "√"],
    latex: "\\sqrt{A}", kind: "unary",
    description: "平方根: 「ルートx」→ √x",
    category: "構造",
    example: { input: "ルート2", output: "\\sqrt{2}" } },
  { reading: "n乗根", aliases: ["じょうこん"],
    latex: "\\sqrt[N]{A}", kind: "binary",
    description: "n乗根: 「3乗根x」→ ∛x",
    category: "構造" },
  { reading: "乗", aliases: ["じょう", "の二乗", "の三乗", "べき"],
    latex: "^{A}", kind: "unary",
    description: "累乗: 「xの2乗」→ x²",
    category: "構造",
    example: { input: "xの2乗", output: "x^{2}" } },
  { reading: "添字", aliases: ["そえじ", "サブ", "したつき", "下付き", "したつき"],
    latex: "_{A}", kind: "unary",
    description: "下付き: 「x添字i」→ xᵢ",
    category: "構造" },
  { reading: "絶対値", aliases: ["ぜったいち", "abs"],
    latex: "\\left| A \\right|", kind: "unary",
    description: "絶対値: 「絶対値x」→ |x|",
    category: "構造" },
  { reading: "ノルム", aliases: ["のるむ"],
    latex: "\\left\\| A \\right\\|", kind: "unary",
    description: "ノルム: 「ノルムx」→ ‖x‖",
    category: "構造" },
  { reading: "ベクトル", aliases: ["べくとる", "vec"],
    latex: "\\vec{A}", kind: "unary",
    description: "ベクトル: 「ベクトルa」→ a→",
    category: "構造" },
  { reading: "太字", aliases: ["ふとじ", "ボールド", "bold"],
    latex: "\\mathbf{A}", kind: "unary",
    description: "太字: 「太字A」→ 𝐀",
    category: "構造" },
  { reading: "ハット", aliases: ["はっと", "hat"],
    latex: "\\hat{A}", kind: "unary",
    description: "ハット: 「ハットa」→ â",
    category: "構造" },
  { reading: "チルダ", aliases: ["ちるだ", "tilde", "波", "なみ"],
    latex: "\\tilde{A}", kind: "unary",
    description: "チルダ: 「チルダa」→ ã",
    category: "構造" },
  { reading: "上線", aliases: ["うわせん", "バー", "ばー", "bar", "平均", "へいきん"],
    latex: "\\bar{A}", kind: "unary",
    description: "上線: 「バーx」→ x̄",
    category: "構造" },
  { reading: "ドット", aliases: ["どっと", "時間微分", "じかんびぶん"],
    latex: "\\dot{A}", kind: "unary",
    description: "上ドット: 「ドットx」→ ẋ",
    category: "構造" },
  { reading: "ダブルドット", aliases: ["だぶるどっと", "二階微分", "にかいびぶん"],
    latex: "\\ddot{A}", kind: "unary",
    description: "二重ドット",
    category: "構造" },
  { reading: "下線", aliases: ["かせん", "アンダーライン"],
    latex: "\\underline{A}", kind: "unary",
    description: "下線",
    category: "構造" },
  { reading: "上括弧", aliases: ["うわかっこ", "オーバーブレース"],
    latex: "\\overbrace{A}", kind: "unary",
    description: "上括弧",
    category: "構造" },
  { reading: "下括弧", aliases: ["したかっこ", "アンダーブレース"],
    latex: "\\underbrace{A}", kind: "unary",
    description: "下括弧",
    category: "構造" },
  { reading: "丸", aliases: ["まる", "丸囲み"],
    latex: "\\bigcirc", kind: "symbol",
    description: "○",
    category: "構造" },

  // ══════════════════════════════════════
  // 微積分
  // ══════════════════════════════════════
  { reading: "積分", aliases: ["せきぶん", "インテグラル", "いんてぐらる"],
    latex: "\\int_{A}^{B}", kind: "binary",
    description: "定積分: 「0から1まで積分」",
    category: "微積分",
    example: { input: "0からパイまで積分 sin(x)dx", output: "\\int_{0}^{\\pi} \\sin(x) \\, dx" } },
  { reading: "不定積分", aliases: ["ふていせきぶん"],
    latex: "\\int", kind: "symbol",
    description: "不定積分: ∫",
    category: "微積分" },
  { reading: "二重積分", aliases: ["にじゅうせきぶん"],
    latex: "\\iint", kind: "symbol",
    description: "二重積分: ∬",
    category: "微積分" },
  { reading: "三重積分", aliases: ["さんじゅうせきぶん"],
    latex: "\\iiint", kind: "symbol",
    description: "三重積分: ∭",
    category: "微積分" },
  { reading: "周回積分", aliases: ["しゅうかいせきぶん", "線積分", "せんせきぶん"],
    latex: "\\oint", kind: "symbol",
    description: "周回積分: ∮",
    category: "微積分" },
  { reading: "微分", aliases: ["びぶん", "d/dx"],
    latex: "\\frac{d}{dA}", kind: "unary",
    description: "微分: 「xで微分」→ d/dx",
    category: "微積分",
    example: { input: "xで微分", output: "\\frac{d}{dx}" } },
  { reading: "偏微分", aliases: ["へんびぶん"],
    latex: "\\frac{\\partial}{\\partial A}", kind: "unary",
    description: "偏微分: 「xで偏微分」→ ∂/∂x",
    category: "微積分" },
  { reading: "極限", aliases: ["きょくげん", "リミット", "lim"],
    latex: "\\lim_{A \\to B}", kind: "binary",
    description: "極限: 「xが0に近づくとき極限」",
    category: "微積分",
    example: { input: "xを無限大に飛ばす極限", output: "\\lim_{x \\to \\infty}" } },
  { reading: "総和", aliases: ["そうわ", "合計", "ごうけい", "sum"],
    latex: "\\sum_{A}^{B}", kind: "binary",
    description: "総和: 「i=1からnまで総和」",
    category: "微積分",
    example: { input: "i=1からnまで総和", output: "\\sum_{i=1}^{n}" } },
  { reading: "総乗", aliases: ["そうじょう", "パイ積", "prod"],
    latex: "\\prod_{A}^{B}", kind: "binary",
    description: "総乗: 「i=1からnまで総乗」",
    category: "微積分" },
  { reading: "勾配", aliases: ["こうばい", "grad", "グラジエント"],
    latex: "\\nabla", kind: "symbol",
    description: "勾配 ∇",
    category: "微積分" },
  { reading: "発散", aliases: ["はっさん", "div", "ダイバージェンス"],
    latex: "\\nabla \\cdot", kind: "symbol",
    description: "発散 ∇·",
    category: "微積分" },
  { reading: "回転", aliases: ["かいてん", "rot", "curl"],
    latex: "\\nabla \\times", kind: "symbol",
    description: "回転 ∇×",
    category: "微積分" },
  { reading: "ラプラシアン", aliases: ["らぷらしあん"],
    latex: "\\nabla^2", kind: "symbol",
    description: "ラプラシアン ∇²",
    category: "微積分" },

  // ══════════════════════════════════════
  // 特殊記号
  // ══════════════════════════════════════
  { reading: "無限大", aliases: ["むげんだい", "無限", "むげん", "∞"],
    latex: "\\infty", kind: "symbol", description: "∞", category: "特殊" },
  { reading: "偏微分記号", aliases: ["へんびぶんきごう", "パーシャル", "∂"],
    latex: "\\partial", kind: "symbol", description: "∂", category: "特殊" },
  { reading: "ナブラ", aliases: ["なぶら", "∇"],
    latex: "\\nabla", kind: "symbol", description: "∇", category: "特殊" },
  { reading: "任意の", aliases: ["にんいの", "すべての", "フォーオール", "∀", "全ての"],
    latex: "\\forall", kind: "symbol", description: "∀", category: "特殊" },
  { reading: "存在する", aliases: ["そんざいする", "イグジスト", "∃"],
    latex: "\\exists", kind: "symbol", description: "∃", category: "特殊" },
  { reading: "存在しない", aliases: ["そんざいしない", "∄"],
    latex: "\\nexists", kind: "symbol", description: "∄", category: "特殊" },

  // 集合
  { reading: "和集合", aliases: ["わしゅうごう", "ユニオン", "∪"],
    latex: "\\cup", kind: "operator", description: "∪", category: "集合" },
  { reading: "共通集合", aliases: ["きょうつうしゅうごう", "インターセクション", "∩", "積集合", "せきしゅうごう"],
    latex: "\\cap", kind: "operator", description: "∩", category: "集合" },
  { reading: "空集合", aliases: ["くうしゅうごう", "∅"],
    latex: "\\emptyset", kind: "symbol", description: "∅", category: "集合" },
  { reading: "実数", aliases: ["じっすう", "R"],
    latex: "\\mathbb{R}", kind: "symbol", description: "ℝ", category: "集合" },
  { reading: "整数", aliases: ["せいすう", "Z"],
    latex: "\\mathbb{Z}", kind: "symbol", description: "ℤ", category: "集合" },
  { reading: "自然数", aliases: ["しぜんすう", "N"],
    latex: "\\mathbb{N}", kind: "symbol", description: "ℕ", category: "集合" },
  { reading: "有理数", aliases: ["ゆうりすう", "Q"],
    latex: "\\mathbb{Q}", kind: "symbol", description: "ℚ", category: "集合" },
  { reading: "複素数", aliases: ["ふくそすう", "C"],
    latex: "\\mathbb{C}", kind: "symbol", description: "ℂ", category: "集合" },

  // その他特殊
  { reading: "エイチバー", aliases: ["えいちばー", "ディラック定数", "でぃらっくていすう", "ℏ"],
    latex: "\\hbar", kind: "symbol", description: "ℏ", category: "特殊" },
  { reading: "三角", aliases: ["さんかく", "三角形", "さんかくけい", "△"],
    latex: "\\triangle", kind: "symbol", description: "△", category: "特殊" },
  { reading: "角度", aliases: ["かくど", "角", "かく", "∠"],
    latex: "\\angle", kind: "symbol", description: "∠", category: "特殊" },
  { reading: "度", aliases: ["ど", "°"],
    latex: "^{\\circ}", kind: "symbol", description: "°", category: "特殊" },
  { reading: "三点リーダー", aliases: ["さんてんりーだー", "…", "ドット3つ", "省略", "しょうりゃく"],
    latex: "\\cdots", kind: "symbol", description: "⋯", category: "特殊" },
  { reading: "縦三点", aliases: ["たてさんてん", "⋮"],
    latex: "\\vdots", kind: "symbol", description: "⋮", category: "特殊" },
  { reading: "斜め三点", aliases: ["ななめさんてん", "⋱"],
    latex: "\\ddots", kind: "symbol", description: "⋱", category: "特殊" },
  { reading: "したがって", aliases: ["ゆえに", "∴", "故に"],
    latex: "\\therefore", kind: "symbol", description: "∴", category: "特殊" },
  { reading: "なぜなら", aliases: ["∵"],
    latex: "\\because", kind: "symbol", description: "∵", category: "特殊" },
  { reading: "QED", aliases: ["証明終了", "しょうめいしゅうりょう", "□"],
    latex: "\\square", kind: "symbol", description: "□ (QED)", category: "特殊" },
  { reading: "天井関数", aliases: ["てんじょうかんすう", "切り上げ", "きりあげ"],
    latex: "\\lceil A \\rceil", kind: "unary", description: "⌈x⌉", category: "特殊" },
  { reading: "床関数", aliases: ["ゆかかんすう", "切り捨て", "きりすて", "ガウス"],
    latex: "\\lfloor A \\rfloor", kind: "unary", description: "⌊x⌋", category: "特殊" },

  // ══════════════════════════════════════
  // 三角関数 & 関数
  // ══════════════════════════════════════
  { reading: "サイン", aliases: ["sin"], latex: "\\sin", kind: "symbol", description: "sin", category: "関数" },
  { reading: "コサイン", aliases: ["cos"], latex: "\\cos", kind: "symbol", description: "cos", category: "関数" },
  { reading: "タンジェント", aliases: ["tan"], latex: "\\tan", kind: "symbol", description: "tan", category: "関数" },
  { reading: "アークサイン", aliases: ["arcsin", "逆サイン", "ぎゃくさいん"],
    latex: "\\arcsin", kind: "symbol", description: "arcsin", category: "関数" },
  { reading: "アークコサイン", aliases: ["arccos", "逆コサイン", "ぎゃくこさいん"],
    latex: "\\arccos", kind: "symbol", description: "arccos", category: "関数" },
  { reading: "アークタンジェント", aliases: ["arctan", "逆タンジェント", "ぎゃくたんじぇんと"],
    latex: "\\arctan", kind: "symbol", description: "arctan", category: "関数" },
  { reading: "ハイパボリックサイン", aliases: ["sinh"],
    latex: "\\sinh", kind: "symbol", description: "sinh", category: "関数" },
  { reading: "ハイパボリックコサイン", aliases: ["cosh"],
    latex: "\\cosh", kind: "symbol", description: "cosh", category: "関数" },
  { reading: "ログ", aliases: ["対数", "たいすう", "log"],
    latex: "\\log", kind: "symbol", description: "log", category: "関数" },
  { reading: "自然対数", aliases: ["しぜんたいすう", "エルエヌ", "ln", "ネイピア"],
    latex: "\\ln", kind: "symbol", description: "ln", category: "関数" },
  { reading: "エクスポネンシャル", aliases: ["指数関数", "しすうかんすう", "exp", "イーの"],
    latex: "\\exp", kind: "symbol", description: "exp", category: "関数" },
  { reading: "最大", aliases: ["さいだい", "max", "マックス"],
    latex: "\\max", kind: "symbol", description: "max", category: "関数" },
  { reading: "最小", aliases: ["さいしょう", "min", "ミニマム"],
    latex: "\\min", kind: "symbol", description: "min", category: "関数" },
  { reading: "上限", aliases: ["じょうげん", "sup", "上界", "じょうかい"],
    latex: "\\sup", kind: "symbol", description: "sup", category: "関数" },
  { reading: "下限", aliases: ["かげん", "inf", "下界", "かかい"],
    latex: "\\inf", kind: "symbol", description: "inf", category: "関数" },
  { reading: "行列式", aliases: ["ぎょうれつしき", "det", "デターミナント"],
    latex: "\\det", kind: "symbol", description: "det", category: "関数" },
  { reading: "次元", aliases: ["じげん", "dim", "ディメンション"],
    latex: "\\dim", kind: "symbol", description: "dim", category: "関数" },
  { reading: "核", aliases: ["かく", "ker", "カーネル"],
    latex: "\\ker", kind: "symbol", description: "ker", category: "関数" },
  { reading: "像", aliases: ["ぞう", "im", "イメージ"],
    latex: "\\operatorname{Im}", kind: "symbol", description: "Im", category: "関数" },

  // ══════════════════════════════════════
  // 線形代数
  // ══════════════════════════════════════
  { reading: "転置", aliases: ["てんち", "トランスポーズ"],
    latex: "^{\\top}", kind: "symbol", description: "転置 ᵀ", category: "線形代数" },
  { reading: "逆行列", aliases: ["ぎゃくぎょうれつ", "インバース"],
    latex: "^{-1}", kind: "symbol", description: "逆 ⁻¹", category: "線形代数" },
  { reading: "トレース", aliases: ["とれーす", "trace", "跡", "せき"],
    latex: "\\operatorname{tr}", kind: "symbol", description: "tr", category: "線形代数" },
  { reading: "ランク", aliases: ["らんく", "rank", "階数", "かいすう"],
    latex: "\\operatorname{rank}", kind: "symbol", description: "rank", category: "線形代数" },
  { reading: "ダガー", aliases: ["だがー", "†", "エルミート"],
    latex: "^{\\dagger}", kind: "symbol", description: "† (エルミート共役)", category: "線形代数" },

  // ══════════════════════════════════════
  // 確率・統計
  // ══════════════════════════════════════
  { reading: "確率", aliases: ["かくりつ", "P"],
    latex: "P", kind: "symbol", description: "確率 P", category: "確率統計" },
  { reading: "期待値", aliases: ["きたいち", "E"],
    latex: "\\mathbb{E}", kind: "symbol", description: "𝔼", category: "確率統計" },
  { reading: "分散", aliases: ["ぶんさん", "Var"],
    latex: "\\operatorname{Var}", kind: "symbol", description: "Var", category: "確率統計" },
  { reading: "共分散", aliases: ["きょうぶんさん", "Cov"],
    latex: "\\operatorname{Cov}", kind: "symbol", description: "Cov", category: "確率統計" },
  { reading: "標準偏差", aliases: ["ひょうじゅんへんさ"],
    latex: "\\sigma", kind: "symbol", description: "σ (standard deviation)", category: "確率統計" },
  { reading: "正規分布", aliases: ["せいきぶんぷ", "ガウス分布"],
    latex: "\\mathcal{N}", kind: "symbol", description: "𝒩 (正規分布)", category: "確率統計" },
  { reading: "相関", aliases: ["そうかん"],
    latex: "\\rho", kind: "symbol", description: "ρ (相関係数)", category: "確率統計" },
  { reading: "組合せ", aliases: ["くみあわせ", "コンビネーション", "nCr"],
    latex: "\\binom{A}{B}", kind: "binary", description: "二項係数 C(n,r)", category: "確率統計" },

  // ══════════════════════════════════════
  // 環境
  // ══════════════════════════════════════
  { reading: "行列", aliases: ["ぎょうれつ", "マトリックス", "matrix"],
    latex: "\\begin{pmatrix} A \\end{pmatrix}", kind: "environment",
    description: "行列環境",
    category: "環境" },
  { reading: "角括弧行列", aliases: ["かくかっこぎょうれつ"],
    latex: "\\begin{bmatrix} A \\end{bmatrix}", kind: "environment",
    description: "角括弧行列",
    category: "環境" },
  { reading: "行列式記号", aliases: ["ぎょうれつしききごう"],
    latex: "\\begin{vmatrix} A \\end{vmatrix}", kind: "environment",
    description: "行列式環境",
    category: "環境" },
  { reading: "連立方程式", aliases: ["れんりつほうていしき", "cases"],
    latex: "\\begin{cases} A \\end{cases}", kind: "environment",
    description: "連立方程式",
    category: "環境" },
  { reading: "場合分け", aliases: ["ばあいわけ"],
    latex: "\\begin{cases} A \\end{cases}", kind: "environment",
    description: "場合分け",
    category: "環境" },
  { reading: "整列数式", aliases: ["せいれつすうしき", "align"],
    latex: "\\begin{aligned} A \\end{aligned}", kind: "environment",
    description: "複数行数式の整列",
    category: "環境" },

  // ══════════════════════════════════════
  // 高校数学: 二次方程式・因数分解
  // ══════════════════════════════════════
  { reading: "二次方程式の解", aliases: ["にじほうていしきのかい", "解の公式", "かいのこうしき", "二次方程式"],
    latex: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}", kind: "symbol",
    description: "ax²+bx+c=0 の解の公式", category: "高校数学" },
  { reading: "判別式", aliases: ["はんべつしき", "ディスクリミナント", "D"],
    latex: "D = b^2 - 4ac", kind: "symbol",
    description: "二次方程式の判別式", category: "高校数学" },
  { reading: "因数分解", aliases: ["いんすうぶんかい"],
    latex: "(a+b)(a-b) = a^2 - b^2", kind: "symbol",
    description: "和と差の積", category: "高校数学" },
  { reading: "完全平方", aliases: ["かんぜんへいほう"],
    latex: "(a+b)^2 = a^2 + 2ab + b^2", kind: "symbol",
    description: "完全平方の展開", category: "高校数学" },
  { reading: "三乗展開", aliases: ["さんじょうてんかい"],
    latex: "(a+b)^3 = a^3 + 3a^2b + 3ab^2 + b^3", kind: "symbol",
    description: "三乗の展開", category: "高校数学" },
  { reading: "二項定理", aliases: ["にこうていり", "バイノミアル"],
    latex: "(a+b)^n = \\sum_{k=0}^{n} \\binom{n}{k} a^{n-k} b^k", kind: "symbol",
    description: "二項定理", category: "高校数学" },
  { reading: "相加相乗平均", aliases: ["そうかそうじょうへいきん", "AM-GM"],
    latex: "\\frac{a+b}{2} \\geq \\sqrt{ab}", kind: "symbol",
    description: "相加相乗平均の関係 (a,b≥0)", category: "高校数学" },

  // ══════════════════════════════════════
  // 高校数学: 三角関数の公式
  // ══════════════════════════════════════
  { reading: "三角関数の基本", aliases: ["さんかくかんすうのきほん", "ピタゴラス"],
    latex: "\\sin^2\\theta + \\cos^2\\theta = 1", kind: "symbol",
    description: "三角関数の基本公式", category: "三角関数" },
  { reading: "タンジェントの定義", aliases: ["たんじぇんとのていぎ"],
    latex: "\\tan\\theta = \\frac{\\sin\\theta}{\\cos\\theta}", kind: "symbol",
    description: "tan の定義", category: "三角関数" },
  { reading: "加法定理サイン", aliases: ["かほうていりさいん"],
    latex: "\\sin(\\alpha \\pm \\beta) = \\sin\\alpha\\cos\\beta \\pm \\cos\\alpha\\sin\\beta", kind: "symbol",
    description: "正弦の加法定理", category: "三角関数" },
  { reading: "加法定理コサイン", aliases: ["かほうていりこさいん"],
    latex: "\\cos(\\alpha \\pm \\beta) = \\cos\\alpha\\cos\\beta \\mp \\sin\\alpha\\sin\\beta", kind: "symbol",
    description: "余弦の加法定理", category: "三角関数" },
  { reading: "加法定理タンジェント", aliases: ["かほうていりたんじぇんと"],
    latex: "\\tan(\\alpha \\pm \\beta) = \\frac{\\tan\\alpha \\pm \\tan\\beta}{1 \\mp \\tan\\alpha\\tan\\beta}", kind: "symbol",
    description: "正接の加法定理", category: "三角関数" },
  { reading: "二倍角サイン", aliases: ["にばいかくさいん", "2倍角sin"],
    latex: "\\sin 2\\theta = 2\\sin\\theta\\cos\\theta", kind: "symbol",
    description: "sin の二倍角", category: "三角関数" },
  { reading: "二倍角コサイン", aliases: ["にばいかくこさいん", "2倍角cos"],
    latex: "\\cos 2\\theta = \\cos^2\\theta - \\sin^2\\theta", kind: "symbol",
    description: "cos の二倍角", category: "三角関数" },
  { reading: "半角サイン", aliases: ["はんかくさいん", "半角sin"],
    latex: "\\sin^2\\frac{\\theta}{2} = \\frac{1 - \\cos\\theta}{2}", kind: "symbol",
    description: "sin の半角", category: "三角関数" },
  { reading: "半角コサイン", aliases: ["はんかくこさいん", "半角cos"],
    latex: "\\cos^2\\frac{\\theta}{2} = \\frac{1 + \\cos\\theta}{2}", kind: "symbol",
    description: "cos の半角", category: "三角関数" },
  { reading: "和積変換", aliases: ["わせきへんかん"],
    latex: "\\sin A + \\sin B = 2\\sin\\frac{A+B}{2}\\cos\\frac{A-B}{2}", kind: "symbol",
    description: "和→積の変換", category: "三角関数" },
  { reading: "積和変換", aliases: ["せきわへんかん"],
    latex: "\\sin A \\cos B = \\frac{1}{2}[\\sin(A+B) + \\sin(A-B)]", kind: "symbol",
    description: "積→和の変換", category: "三角関数" },
  { reading: "正弦定理", aliases: ["せいげんていり"],
    latex: "\\frac{a}{\\sin A} = \\frac{b}{\\sin B} = \\frac{c}{\\sin C} = 2R", kind: "symbol",
    description: "正弦定理", category: "三角関数" },
  { reading: "余弦定理", aliases: ["よげんていり", "コサイン定理"],
    latex: "c^2 = a^2 + b^2 - 2ab\\cos C", kind: "symbol",
    description: "余弦定理", category: "三角関数" },
  { reading: "セカント", aliases: ["sec"],
    latex: "\\sec", kind: "symbol", description: "sec (1/cos)", category: "三角関数" },
  { reading: "コセカント", aliases: ["csc", "cosec"],
    latex: "\\csc", kind: "symbol", description: "csc (1/sin)", category: "三角関数" },
  { reading: "コタンジェント", aliases: ["cot"],
    latex: "\\cot", kind: "symbol", description: "cot (1/tan)", category: "三角関数" },

  // ══════════════════════════════════════
  // 高校数学: 数列
  // ══════════════════════════════════════
  { reading: "等差数列の一般項", aliases: ["とうさすうれつのいっぱんこう"],
    latex: "a_n = a_1 + (n-1)d", kind: "symbol",
    description: "等差数列の第n項", category: "数列" },
  { reading: "等差数列の和", aliases: ["とうさすうれつのわ"],
    latex: "S_n = \\frac{n(a_1 + a_n)}{2}", kind: "symbol",
    description: "等差数列の和", category: "数列" },
  { reading: "等比数列の一般項", aliases: ["とうひすうれつのいっぱんこう"],
    latex: "a_n = a_1 r^{n-1}", kind: "symbol",
    description: "等比数列の第n項", category: "数列" },
  { reading: "等比数列の和", aliases: ["とうひすうれつのわ"],
    latex: "S_n = a_1 \\cdot \\frac{1 - r^n}{1 - r}", kind: "symbol",
    description: "等比数列の和 (r≠1)", category: "数列" },
  { reading: "無限等比級数", aliases: ["むげんとうひきゅうすう"],
    latex: "\\sum_{n=0}^{\\infty} ar^n = \\frac{a}{1-r}", kind: "symbol",
    description: "無限等比級数 (|r|<1)", category: "数列" },
  { reading: "階乗", aliases: ["かいじょう", "ファクトリアル", "!"],
    latex: "n!", kind: "symbol",
    description: "n の階乗", category: "数列" },
  { reading: "順列", aliases: ["じゅんれつ", "パーミュテーション", "nPr"],
    latex: "{}_{n}P_{r} = \\frac{n!}{(n-r)!}", kind: "symbol",
    description: "順列 P(n,r)", category: "数列" },
  { reading: "フィボナッチ", aliases: ["ふぃぼなっち"],
    latex: "F_n = F_{n-1} + F_{n-2}", kind: "symbol",
    description: "フィボナッチ数列の漸化式", category: "数列" },
  { reading: "シグマ記号", aliases: ["しぐまきごう", "総和記号"],
    latex: "\\sum_{k=1}^{n}", kind: "symbol",
    description: "総和記号 Σ", category: "数列" },
  { reading: "自然数の和", aliases: ["しぜんすうのわ"],
    latex: "\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}", kind: "symbol",
    description: "1+2+...+n", category: "数列" },
  { reading: "自然数の二乗和", aliases: ["しぜんすうのにじょうわ"],
    latex: "\\sum_{k=1}^{n} k^2 = \\frac{n(n+1)(2n+1)}{6}", kind: "symbol",
    description: "1²+2²+...+n²", category: "数列" },
  { reading: "自然数の三乗和", aliases: ["しぜんすうのさんじょうわ"],
    latex: "\\sum_{k=1}^{n} k^3 = \\left(\\frac{n(n+1)}{2}\\right)^2", kind: "symbol",
    description: "1³+2³+...+n³", category: "数列" },

  // ══════════════════════════════════════
  // 高校数学: 指数・対数
  // ══════════════════════════════════════
  { reading: "指数法則", aliases: ["しすうほうそく"],
    latex: "a^m \\cdot a^n = a^{m+n}", kind: "symbol",
    description: "指数の積法則", category: "指数対数" },
  { reading: "指数の商", aliases: ["しすうのしょう"],
    latex: "\\frac{a^m}{a^n} = a^{m-n}", kind: "symbol",
    description: "指数の商法則", category: "指数対数" },
  { reading: "対数の定義", aliases: ["たいすうのていぎ"],
    latex: "\\log_a b = c \\iff a^c = b", kind: "symbol",
    description: "対数の定義", category: "指数対数" },
  { reading: "対数の変換", aliases: ["たいすうのへんかん", "底の変換"],
    latex: "\\log_a b = \\frac{\\log_c b}{\\log_c a}", kind: "symbol",
    description: "底の変換公式", category: "指数対数" },
  { reading: "対数の積", aliases: ["たいすうのせき"],
    latex: "\\log_a (MN) = \\log_a M + \\log_a N", kind: "symbol",
    description: "対数の積→和", category: "指数対数" },
  { reading: "対数の商", aliases: ["たいすうのしょう"],
    latex: "\\log_a \\frac{M}{N} = \\log_a M - \\log_a N", kind: "symbol",
    description: "対数の商→差", category: "指数対数" },
  { reading: "対数のべき", aliases: ["たいすうのべき"],
    latex: "\\log_a M^n = n \\log_a M", kind: "symbol",
    description: "対数のべき乗", category: "指数対数" },
  { reading: "ネイピア数", aliases: ["ねいぴあすう", "自然対数の底", "オイラー数"],
    latex: "e = \\lim_{n \\to \\infty} \\left(1 + \\frac{1}{n}\\right)^n", kind: "symbol",
    description: "e ≈ 2.71828...", category: "指数対数" },

  // ══════════════════════════════════════
  // 高校数学: ベクトル
  // ══════════════════════════════════════
  { reading: "ベクトルの内積", aliases: ["べくとるのないせき", "ドット積"],
    latex: "\\vec{a} \\cdot \\vec{b} = |\\vec{a}||\\vec{b}|\\cos\\theta", kind: "symbol",
    description: "内積の定義", category: "ベクトル" },
  { reading: "成分内積", aliases: ["せいぶんないせき"],
    latex: "\\vec{a} \\cdot \\vec{b} = a_1 b_1 + a_2 b_2 + a_3 b_3", kind: "symbol",
    description: "成分による内積", category: "ベクトル" },
  { reading: "ベクトルの大きさ", aliases: ["べくとるのおおきさ"],
    latex: "|\\vec{a}| = \\sqrt{a_1^2 + a_2^2 + a_3^2}", kind: "symbol",
    description: "ベクトルのノルム", category: "ベクトル" },
  { reading: "外積の定義", aliases: ["がいせきのていぎ", "クロス積"],
    latex: "\\vec{a} \\times \\vec{b} = |\\vec{a}||\\vec{b}|\\sin\\theta \\, \\hat{n}", kind: "symbol",
    description: "外積の定義", category: "ベクトル" },
  { reading: "位置ベクトル", aliases: ["いちべくとる"],
    latex: "\\vec{OP} = \\vec{p}", kind: "symbol",
    description: "位置ベクトル", category: "ベクトル" },
  { reading: "内分点", aliases: ["ないぶんてん"],
    latex: "\\vec{p} = \\frac{n\\vec{a} + m\\vec{b}}{m+n}", kind: "symbol",
    description: "m:n に内分する点", category: "ベクトル" },

  // ══════════════════════════════════════
  // 高校数学: 微分公式
  // ══════════════════════════════════════
  { reading: "べき関数の微分", aliases: ["べきかんすうのびぶん", "微分の基本"],
    latex: "\\frac{d}{dx} x^n = nx^{n-1}", kind: "symbol",
    description: "xⁿ の微分", category: "微分公式" },
  { reading: "指数関数の微分", aliases: ["しすうかんすうのびぶん"],
    latex: "\\frac{d}{dx} e^x = e^x", kind: "symbol",
    description: "eˣ の微分", category: "微分公式" },
  { reading: "対数関数の微分", aliases: ["たいすうかんすうのびぶん"],
    latex: "\\frac{d}{dx} \\ln x = \\frac{1}{x}", kind: "symbol",
    description: "ln x の微分", category: "微分公式" },
  { reading: "サインの微分", aliases: ["さいんのびぶん"],
    latex: "\\frac{d}{dx} \\sin x = \\cos x", kind: "symbol",
    description: "sin x の微分", category: "微分公式" },
  { reading: "コサインの微分", aliases: ["こさいんのびぶん"],
    latex: "\\frac{d}{dx} \\cos x = -\\sin x", kind: "symbol",
    description: "cos x の微分", category: "微分公式" },
  { reading: "タンジェントの微分", aliases: ["たんじぇんとのびぶん"],
    latex: "\\frac{d}{dx} \\tan x = \\frac{1}{\\cos^2 x}", kind: "symbol",
    description: "tan x の微分", category: "微分公式" },
  { reading: "積の微分", aliases: ["せきのびぶん", "ライプニッツ"],
    latex: "(fg)' = f'g + fg'", kind: "symbol",
    description: "積の微分法則", category: "微分公式" },
  { reading: "商の微分", aliases: ["しょうのびぶん"],
    latex: "\\left(\\frac{f}{g}\\right)' = \\frac{f'g - fg'}{g^2}", kind: "symbol",
    description: "商の微分法則", category: "微分公式" },
  { reading: "合成関数の微分", aliases: ["ごうせいかんすうのびぶん", "チェインルール", "連鎖律"],
    latex: "\\frac{dy}{dx} = \\frac{dy}{du} \\cdot \\frac{du}{dx}", kind: "symbol",
    description: "合成関数の連鎖律", category: "微分公式" },
  { reading: "ロピタルの定理", aliases: ["ろぴたるのていり", "ロピタル"],
    latex: "\\lim_{x \\to a} \\frac{f(x)}{g(x)} = \\lim_{x \\to a} \\frac{f'(x)}{g'(x)}", kind: "symbol",
    description: "ロピタルの定理", category: "微分公式" },
  { reading: "マクローリン展開", aliases: ["まくろーりんてんかい"],
    latex: "f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(0)}{n!} x^n", kind: "symbol",
    description: "x=0 でのテイラー展開", category: "微分公式" },

  // ══════════════════════════════════════
  // 高校数学: 積分公式
  // ══════════════════════════════════════
  { reading: "べき関数の積分", aliases: ["べきかんすうのせきぶん", "積分の基本"],
    latex: "\\int x^n \\, dx = \\frac{x^{n+1}}{n+1} + C", kind: "symbol",
    description: "xⁿ の積分 (n≠-1)", category: "積分公式" },
  { reading: "逆数の積分", aliases: ["ぎゃくすうのせきぶん"],
    latex: "\\int \\frac{1}{x} \\, dx = \\ln|x| + C", kind: "symbol",
    description: "1/x の積分", category: "積分公式" },
  { reading: "指数関数の積分", aliases: ["しすうかんすうのせきぶん"],
    latex: "\\int e^x \\, dx = e^x + C", kind: "symbol",
    description: "eˣ の積分", category: "積分公式" },
  { reading: "サインの積分", aliases: ["さいんのせきぶん"],
    latex: "\\int \\sin x \\, dx = -\\cos x + C", kind: "symbol",
    description: "sin x の積分", category: "積分公式" },
  { reading: "コサインの積分", aliases: ["こさいんのせきぶん"],
    latex: "\\int \\cos x \\, dx = \\sin x + C", kind: "symbol",
    description: "cos x の積分", category: "積分公式" },
  { reading: "部分積分", aliases: ["ぶぶんせきぶん"],
    latex: "\\int u \\, dv = uv - \\int v \\, du", kind: "symbol",
    description: "部分積分法", category: "積分公式" },
  { reading: "置換積分", aliases: ["ちかんせきぶん"],
    latex: "\\int f(g(x))g'(x) \\, dx = \\int f(u) \\, du", kind: "symbol",
    description: "置換積分法", category: "積分公式" },
  { reading: "微分積分の基本定理", aliases: ["びぶんせきぶんのきほんていり"],
    latex: "\\int_a^b f'(x) \\, dx = f(b) - f(a)", kind: "symbol",
    description: "微分積分の基本定理", category: "積分公式" },

  // ══════════════════════════════════════
  // 大学初等: 線形代数
  // ══════════════════════════════════════
  { reading: "クラメルの公式", aliases: ["くらめるのこうしき"],
    latex: "x_i = \\frac{\\det(A_i)}{\\det(A)}", kind: "symbol",
    description: "クラメルの公式", category: "線形代数" },
  { reading: "固有値方程式", aliases: ["こゆうちほうていしき", "特性方程式"],
    latex: "\\det(A - \\lambda I) = 0", kind: "symbol",
    description: "固有値の特性方程式", category: "線形代数" },
  { reading: "固有値", aliases: ["こゆうち", "eigenvalue", "ラムダ"],
    latex: "A\\vec{v} = \\lambda\\vec{v}", kind: "symbol",
    description: "固有値・固有ベクトルの定義", category: "線形代数" },
  { reading: "対角化", aliases: ["たいかくか"],
    latex: "A = PDP^{-1}", kind: "symbol",
    description: "行列の対角化", category: "線形代数" },
  { reading: "ケイリー・ハミルトン", aliases: ["けいりーはみるとん"],
    latex: "A^2 - (\\operatorname{tr}A)A + (\\det A)I = O", kind: "symbol",
    description: "ケイリー・ハミルトンの定理 (2×2)", category: "線形代数" },
  { reading: "逆行列公式", aliases: ["ぎゃくぎょうれつこうしき"],
    latex: "A^{-1} = \\frac{1}{ad-bc}\\begin{pmatrix} d & -b \\\\ -c & a \\end{pmatrix}", kind: "symbol",
    description: "2×2逆行列", category: "線形代数" },
  { reading: "単位行列", aliases: ["たんいぎょうれつ", "恒等行列"],
    latex: "I", kind: "symbol",
    description: "単位行列 I", category: "線形代数" },
  { reading: "零行列", aliases: ["れいぎょうれつ", "ゼロ行列"],
    latex: "O", kind: "symbol",
    description: "零行列 O", category: "線形代数" },
  { reading: "内積空間", aliases: ["ないせきくうかん"],
    latex: "\\langle \\vec{u}, \\vec{v} \\rangle", kind: "symbol",
    description: "内積 ⟨u,v⟩", category: "線形代数" },
  { reading: "グラムシュミット", aliases: ["ぐらむしゅみっと"],
    latex: "\\vec{u}_k = \\vec{v}_k - \\sum_{j=1}^{k-1} \\frac{\\langle \\vec{v}_k, \\vec{u}_j \\rangle}{\\langle \\vec{u}_j, \\vec{u}_j \\rangle} \\vec{u}_j", kind: "symbol",
    description: "グラム・シュミットの直交化", category: "線形代数" },

  // ══════════════════════════════════════
  // 大学初等: 多変数微積分
  // ══════════════════════════════════════
  { reading: "全微分", aliases: ["ぜんびぶん"],
    latex: "df = \\frac{\\partial f}{\\partial x}dx + \\frac{\\partial f}{\\partial y}dy", kind: "symbol",
    description: "全微分", category: "多変数解析" },
  { reading: "ヤコビアン", aliases: ["やこびあん", "ヤコビ行列式"],
    latex: "J = \\frac{\\partial(x,y)}{\\partial(u,v)} = \\begin{vmatrix} \\frac{\\partial x}{\\partial u} & \\frac{\\partial x}{\\partial v} \\\\ \\frac{\\partial y}{\\partial u} & \\frac{\\partial y}{\\partial v} \\end{vmatrix}", kind: "symbol",
    description: "ヤコビアン", category: "多変数解析" },
  { reading: "ガウスの発散定理", aliases: ["がうすのはっさんていり", "発散定理"],
    latex: "\\iiint_V \\nabla \\cdot \\vec{F} \\, dV = \\oiint_S \\vec{F} \\cdot d\\vec{S}", kind: "symbol",
    description: "ガウスの発散定理", category: "多変数解析" },
  { reading: "ストークスの定理", aliases: ["すとーくすのていり"],
    latex: "\\oint_C \\vec{F} \\cdot d\\vec{r} = \\iint_S (\\nabla \\times \\vec{F}) \\cdot d\\vec{S}", kind: "symbol",
    description: "ストークスの定理", category: "多変数解析" },
  { reading: "グリーンの定理", aliases: ["ぐりーんのていり"],
    latex: "\\oint_C (P\\,dx + Q\\,dy) = \\iint_D \\left(\\frac{\\partial Q}{\\partial x} - \\frac{\\partial P}{\\partial y}\\right) dA", kind: "symbol",
    description: "グリーンの定理", category: "多変数解析" },
  { reading: "ラグランジュ乗数法", aliases: ["らぐらんじゅじょうすうほう"],
    latex: "\\nabla f = \\lambda \\nabla g", kind: "symbol",
    description: "制約付き最適化", category: "多変数解析" },
  { reading: "重積分", aliases: ["じゅうせきぶん"],
    latex: "\\iint_D f(x,y) \\, dA", kind: "symbol",
    description: "二重積分", category: "多変数解析" },
  { reading: "極座標変換", aliases: ["きょくざひょうへんかん"],
    latex: "x = r\\cos\\theta, \\quad y = r\\sin\\theta", kind: "symbol",
    description: "極座標変換", category: "多変数解析" },

  // ══════════════════════════════════════
  // 大学初等: 微分方程式
  // ══════════════════════════════════════
  { reading: "一階微分方程式", aliases: ["いっかいびぶんほうていしき"],
    latex: "\\frac{dy}{dx} = f(x,y)", kind: "symbol",
    description: "一階常微分方程式", category: "微分方程式" },
  { reading: "変数分離", aliases: ["へんすうぶんり"],
    latex: "\\frac{dy}{g(y)} = f(x) \\, dx", kind: "symbol",
    description: "変数分離法", category: "微分方程式" },
  { reading: "二階線形", aliases: ["にかいせんけい"],
    latex: "y'' + p(x)y' + q(x)y = r(x)", kind: "symbol",
    description: "二階線形常微分方程式", category: "微分方程式" },
  { reading: "定数係数二階", aliases: ["ていすうけいすうにかい", "特性方程式"],
    latex: "ay'' + by' + cy = 0", kind: "symbol",
    description: "定数係数二階線形ODE", category: "微分方程式" },
  { reading: "特性方程式", aliases: ["とくせいほうていしき"],
    latex: "ar^2 + br + c = 0", kind: "symbol",
    description: "特性方程式 (ODE)", category: "微分方程式" },

  // ══════════════════════════════════════
  // 大学初等: 複素数・複素解析
  // ══════════════════════════════════════
  { reading: "虚数単位", aliases: ["きょすうたんい", "i"],
    latex: "i^2 = -1", kind: "symbol",
    description: "虚数単位の定義", category: "複素数" },
  { reading: "オイラーの公式", aliases: ["おいらーのこうしき"],
    latex: "e^{i\\theta} = \\cos\\theta + i\\sin\\theta", kind: "symbol",
    description: "オイラーの公式", category: "複素数" },
  { reading: "オイラーの等式", aliases: ["おいらーのとうしき"],
    latex: "e^{i\\pi} + 1 = 0", kind: "symbol",
    description: "オイラーの等式 (最も美しい式)", category: "複素数" },
  { reading: "ドモアブルの定理", aliases: ["どもあぶるのていり"],
    latex: "(\\cos\\theta + i\\sin\\theta)^n = \\cos n\\theta + i\\sin n\\theta", kind: "symbol",
    description: "ド・モアブルの定理", category: "複素数" },
  { reading: "複素共役", aliases: ["ふくそきょうやく", "バー"],
    latex: "\\bar{z} = a - bi", kind: "symbol",
    description: "複素共役", category: "複素数" },
  { reading: "複素数の絶対値", aliases: ["ふくそすうのぜったいち"],
    latex: "|z| = \\sqrt{a^2 + b^2}", kind: "symbol",
    description: "複素数の絶対値", category: "複素数" },

  // ══════════════════════════════════════
  // 大学初等: 確率統計の拡張
  // ══════════════════════════════════════
  { reading: "条件付き確率", aliases: ["じょうけんつきかくりつ"],
    latex: "P(A|B) = \\frac{P(A \\cap B)}{P(B)}", kind: "symbol",
    description: "条件付き確率の定義", category: "確率統計" },
  { reading: "ベイズの定理", aliases: ["べいずのていり"],
    latex: "P(A|B) = \\frac{P(B|A)P(A)}{P(B)}", kind: "symbol",
    description: "ベイズの定理", category: "確率統計" },
  { reading: "ポアソン分布", aliases: ["ぽあそんぶんぷ"],
    latex: "P(X=k) = \\frac{\\lambda^k e^{-\\lambda}}{k!}", kind: "symbol",
    description: "ポアソン分布", category: "確率統計" },
  { reading: "二項分布", aliases: ["にこうぶんぷ"],
    latex: "P(X=k) = \\binom{n}{k} p^k (1-p)^{n-k}", kind: "symbol",
    description: "二項分布", category: "確率統計" },
  { reading: "正規分布の密度", aliases: ["せいきぶんぷのみつど", "ガウス分布"],
    latex: "f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}", kind: "symbol",
    description: "正規分布の確率密度関数", category: "確率統計" },
  { reading: "大数の法則", aliases: ["たいすうのほうそく"],
    latex: "\\bar{X}_n \\xrightarrow{P} \\mu", kind: "symbol",
    description: "大数の法則", category: "確率統計" },
  { reading: "中心極限定理", aliases: ["ちゅうしんきょくげんていり"],
    latex: "\\frac{\\bar{X}_n - \\mu}{\\sigma/\\sqrt{n}} \\xrightarrow{d} \\mathcal{N}(0,1)", kind: "symbol",
    description: "中心極限定理", category: "確率統計" },

  // ══════════════════════════════════════
  // 物理: 力学
  // ══════════════════════════════════════
  { reading: "ニュートンの第一法則", aliases: ["にゅーとんのだいいちほうそく", "慣性の法則"],
    latex: "\\vec{F} = \\vec{0} \\Rightarrow \\vec{v} = \\text{const.}", kind: "symbol",
    description: "慣性の法則", category: "力学" },
  { reading: "ニュートンの第二法則", aliases: ["にゅーとんのだいにほうそく", "運動方程式"],
    latex: "\\vec{F} = m\\vec{a}", kind: "symbol",
    description: "運動方程式 F=ma", category: "力学" },
  { reading: "ニュートンの第三法則", aliases: ["にゅーとんのだいさんほうそく", "作用反作用"],
    latex: "\\vec{F}_{12} = -\\vec{F}_{21}", kind: "symbol",
    description: "作用反作用の法則", category: "力学" },
  { reading: "万有引力", aliases: ["ばんゆういんりょく"],
    latex: "F = G\\frac{m_1 m_2}{r^2}", kind: "symbol",
    description: "万有引力の法則", category: "力学" },
  { reading: "運動エネルギー", aliases: ["うんどうえねるぎー"],
    latex: "K = \\frac{1}{2}mv^2", kind: "symbol",
    description: "運動エネルギー", category: "力学" },
  { reading: "位置エネルギー", aliases: ["いちえねるぎー", "ポテンシャルエネルギー"],
    latex: "U = mgh", kind: "symbol",
    description: "重力ポテンシャルエネルギー", category: "力学" },
  { reading: "力学的エネルギー保存", aliases: ["りきがくてきえねるぎーほぞん", "エネルギー保存"],
    latex: "\\frac{1}{2}mv_1^2 + mgh_1 = \\frac{1}{2}mv_2^2 + mgh_2", kind: "symbol",
    description: "力学的エネルギー保存則", category: "力学" },
  { reading: "運動量", aliases: ["うんどうりょう", "モーメンタム"],
    latex: "\\vec{p} = m\\vec{v}", kind: "symbol",
    description: "運動量の定義", category: "力学" },
  { reading: "運動量保存", aliases: ["うんどうりょうほぞん"],
    latex: "m_1\\vec{v}_1 + m_2\\vec{v}_2 = m_1\\vec{v}_1' + m_2\\vec{v}_2'", kind: "symbol",
    description: "運動量保存則", category: "力学" },
  { reading: "力積", aliases: ["りきせき", "インパルス"],
    latex: "\\vec{J} = \\vec{F} \\Delta t = \\Delta \\vec{p}", kind: "symbol",
    description: "力積 = 運動量の変化", category: "力学" },
  { reading: "等加速度直線運動", aliases: ["とうかそくどちょくせんうんどう"],
    latex: "x = v_0 t + \\frac{1}{2}at^2", kind: "symbol",
    description: "等加速度運動の変位", category: "力学" },
  { reading: "速度時間の式", aliases: ["そくどじかんのしき"],
    latex: "v = v_0 + at", kind: "symbol",
    description: "等加速度運動の速度", category: "力学" },
  { reading: "速度変位の式", aliases: ["そくどへんいのしき"],
    latex: "v^2 - v_0^2 = 2ax", kind: "symbol",
    description: "等加速度運動 (時間を含まない)", category: "力学" },
  { reading: "フックの法則", aliases: ["ふっくのほうそく", "ばねの法則"],
    latex: "F = -kx", kind: "symbol",
    description: "フックの法則 (ばね)", category: "力学" },
  { reading: "単振動", aliases: ["たんしんどう"],
    latex: "x(t) = A\\sin(\\omega t + \\phi)", kind: "symbol",
    description: "単振動の一般解", category: "力学" },
  { reading: "単振動の角速度", aliases: ["たんしんどうのかくそくど"],
    latex: "\\omega = \\sqrt{\\frac{k}{m}}", kind: "symbol",
    description: "ばね質点系の角振動数", category: "力学" },
  { reading: "単振り子の周期", aliases: ["たんふりこのしゅうき"],
    latex: "T = 2\\pi\\sqrt{\\frac{l}{g}}", kind: "symbol",
    description: "単振り子の周期", category: "力学" },
  { reading: "角運動量", aliases: ["かくうんどうりょう"],
    latex: "\\vec{L} = \\vec{r} \\times \\vec{p}", kind: "symbol",
    description: "角運動量", category: "力学" },
  { reading: "トルク", aliases: ["とるく", "力のモーメント"],
    latex: "\\vec{\\tau} = \\vec{r} \\times \\vec{F}", kind: "symbol",
    description: "トルク (力のモーメント)", category: "力学" },
  { reading: "慣性モーメント", aliases: ["かんせいもーめんと"],
    latex: "I = \\sum m_i r_i^2", kind: "symbol",
    description: "慣性モーメント", category: "力学" },
  { reading: "ケプラーの第三法則", aliases: ["けぷらーのだいさんほうそく"],
    latex: "\\frac{T^2}{a^3} = \\text{const.}", kind: "symbol",
    description: "ケプラーの第三法則", category: "力学" },

  // ══════════════════════════════════════
  // 物理: 波動
  // ══════════════════════════════════════
  { reading: "波の式", aliases: ["なみのしき", "波動方程式"],
    latex: "y(x,t) = A\\sin(kx - \\omega t)", kind: "symbol",
    description: "正弦波の一般式", category: "波動" },
  { reading: "波の速さ", aliases: ["なみのはやさ"],
    latex: "v = f\\lambda = \\frac{\\omega}{k}", kind: "symbol",
    description: "波の速度", category: "波動" },
  { reading: "ドップラー効果", aliases: ["どっぷらーこうか"],
    latex: "f' = f \\frac{v \\pm v_o}{v \\mp v_s}", kind: "symbol",
    description: "ドップラー効果", category: "波動" },
  { reading: "干渉条件", aliases: ["かんしょうじょうけん", "明線条件"],
    latex: "d\\sin\\theta = m\\lambda", kind: "symbol",
    description: "二重スリットの干渉条件", category: "波動" },

  // ══════════════════════════════════════
  // 物理: 電磁気学
  // ══════════════════════════════════════
  { reading: "クーロンの法則", aliases: ["くーろんのほうそく"],
    latex: "F = k_e \\frac{q_1 q_2}{r^2}", kind: "symbol",
    description: "クーロンの法則", category: "電磁気学" },
  { reading: "電場", aliases: ["でんば", "電界", "でんかい"],
    latex: "\\vec{E} = \\frac{\\vec{F}}{q}", kind: "symbol",
    description: "電場の定義", category: "電磁気学" },
  { reading: "ガウスの法則", aliases: ["がうすのほうそく"],
    latex: "\\oint \\vec{E} \\cdot d\\vec{A} = \\frac{Q_{\\text{enc}}}{\\varepsilon_0}", kind: "symbol",
    description: "ガウスの法則", category: "電磁気学" },
  { reading: "電位", aliases: ["でんい", "ポテンシャル"],
    latex: "V = k_e \\frac{q}{r}", kind: "symbol",
    description: "点電荷の電位", category: "電磁気学" },
  { reading: "コンデンサの容量", aliases: ["こんでんさのようりょう", "静電容量"],
    latex: "C = \\frac{Q}{V} = \\varepsilon_0 \\frac{A}{d}", kind: "symbol",
    description: "平行板コンデンサの容量", category: "電磁気学" },
  { reading: "コンデンサのエネルギー", aliases: ["こんでんさのえねるぎー"],
    latex: "U = \\frac{1}{2}CV^2 = \\frac{Q^2}{2C}", kind: "symbol",
    description: "コンデンサの蓄積エネルギー", category: "電磁気学" },
  { reading: "オームの法則", aliases: ["おーむのほうそく"],
    latex: "V = IR", kind: "symbol",
    description: "オームの法則", category: "電磁気学" },
  { reading: "キルヒホッフの電圧則", aliases: ["きるひほっふのでんあつそく", "KVL"],
    latex: "\\sum V_k = 0", kind: "symbol",
    description: "キルヒホッフの第二法則", category: "電磁気学" },
  { reading: "キルヒホッフの電流則", aliases: ["きるひほっふのでんりゅうそく", "KCL"],
    latex: "\\sum I_k = 0", kind: "symbol",
    description: "キルヒホッフの第一法則", category: "電磁気学" },
  { reading: "ジュール熱", aliases: ["じゅーるねつ"],
    latex: "P = I^2 R = \\frac{V^2}{R}", kind: "symbol",
    description: "ジュール熱 (電力)", category: "電磁気学" },
  { reading: "ビオサバールの法則", aliases: ["びおさばーるのほうそく"],
    latex: "d\\vec{B} = \\frac{\\mu_0}{4\\pi} \\frac{I \\, d\\vec{l} \\times \\hat{r}}{r^2}", kind: "symbol",
    description: "ビオ・サバールの法則", category: "電磁気学" },
  { reading: "アンペールの法則", aliases: ["あんぺーるのほうそく"],
    latex: "\\oint \\vec{B} \\cdot d\\vec{l} = \\mu_0 I_{\\text{enc}}", kind: "symbol",
    description: "アンペールの法則", category: "電磁気学" },
  { reading: "ローレンツ力", aliases: ["ろーれんつりょく"],
    latex: "\\vec{F} = q(\\vec{E} + \\vec{v} \\times \\vec{B})", kind: "symbol",
    description: "ローレンツ力", category: "電磁気学" },
  { reading: "ファラデーの法則", aliases: ["ふぁらでーのほうそく", "電磁誘導"],
    latex: "\\mathcal{E} = -\\frac{d\\Phi_B}{dt}", kind: "symbol",
    description: "ファラデーの電磁誘導", category: "電磁気学" },
  { reading: "マクスウェル方程式1", aliases: ["まくすうぇるほうていしき1", "ガウスの法則微分形"],
    latex: "\\nabla \\cdot \\vec{E} = \\frac{\\rho}{\\varepsilon_0}", kind: "symbol",
    description: "マクスウェル: ガウスの法則", category: "電磁気学" },
  { reading: "マクスウェル方程式2", aliases: ["まくすうぇるほうていしき2", "磁気単極子なし"],
    latex: "\\nabla \\cdot \\vec{B} = 0", kind: "symbol",
    description: "マクスウェル: 磁気単極子なし", category: "電磁気学" },
  { reading: "マクスウェル方程式3", aliases: ["まくすうぇるほうていしき3", "ファラデー微分形"],
    latex: "\\nabla \\times \\vec{E} = -\\frac{\\partial \\vec{B}}{\\partial t}", kind: "symbol",
    description: "マクスウェル: ファラデーの法則", category: "電磁気学" },
  { reading: "マクスウェル方程式4", aliases: ["まくすうぇるほうていしき4", "アンペール・マクスウェル"],
    latex: "\\nabla \\times \\vec{B} = \\mu_0 \\vec{J} + \\mu_0 \\varepsilon_0 \\frac{\\partial \\vec{E}}{\\partial t}", kind: "symbol",
    description: "マクスウェル: アンペール・マクスウェルの法則", category: "電磁気学" },

  // ══════════════════════════════════════
  // 物理: 熱力学
  // ══════════════════════════════════════
  { reading: "気体の状態方程式", aliases: ["きたいのじょうたいほうていしき", "理想気体"],
    latex: "PV = nRT", kind: "symbol",
    description: "理想気体の状態方程式", category: "熱力学" },
  { reading: "ボイルの法則", aliases: ["ぼいるのほうそく"],
    latex: "P_1 V_1 = P_2 V_2", kind: "symbol",
    description: "ボイルの法則 (等温)", category: "熱力学" },
  { reading: "熱力学第一法則", aliases: ["ねつりきがくだいいちほうそく"],
    latex: "\\Delta U = Q - W", kind: "symbol",
    description: "熱力学第一法則", category: "熱力学" },
  { reading: "熱力学第二法則", aliases: ["ねつりきがくだいにほうそく"],
    latex: "\\Delta S \\geq 0", kind: "symbol",
    description: "熱力学第二法則 (エントロピー増大)", category: "熱力学" },
  { reading: "エントロピー", aliases: ["えんとろぴー"],
    latex: "S = k_B \\ln \\Omega", kind: "symbol",
    description: "ボルツマンのエントロピー", category: "熱力学" },
  { reading: "カルノー効率", aliases: ["かるのーこうりつ"],
    latex: "\\eta = 1 - \\frac{T_L}{T_H}", kind: "symbol",
    description: "カルノーサイクルの効率", category: "熱力学" },
  { reading: "熱量", aliases: ["ねつりょう", "比熱"],
    latex: "Q = mc\\Delta T", kind: "symbol",
    description: "熱量 Q=mcΔT", category: "熱力学" },
  { reading: "ステファン・ボルツマン", aliases: ["すてふぁんぼるつまん", "黒体輻射"],
    latex: "P = \\sigma A T^4", kind: "symbol",
    description: "ステファン・ボルツマンの法則", category: "熱力学" },

  // ══════════════════════════════════════
  // 物理: 光学・量子
  // ══════════════════════════════════════
  { reading: "光速", aliases: ["こうそく", "c"],
    latex: "c = 3 \\times 10^8 \\, \\text{m/s}", kind: "symbol",
    description: "真空中の光速", category: "光学" },
  { reading: "スネルの法則", aliases: ["すねるのほうそく", "屈折の法則"],
    latex: "n_1 \\sin\\theta_1 = n_2 \\sin\\theta_2", kind: "symbol",
    description: "スネルの法則", category: "光学" },
  { reading: "プランクの関係式", aliases: ["ぷらんくのかんけいしき"],
    latex: "E = h\\nu = \\hbar\\omega", kind: "symbol",
    description: "光子のエネルギー", category: "量子力学" },
  { reading: "ド・ブロイ波長", aliases: ["どぶろいはちょう"],
    latex: "\\lambda = \\frac{h}{p} = \\frac{h}{mv}", kind: "symbol",
    description: "ド・ブロイ波長", category: "量子力学" },
  { reading: "不確定性原理", aliases: ["ふかくていせいげんり", "ハイゼンベルク"],
    latex: "\\Delta x \\cdot \\Delta p \\geq \\frac{\\hbar}{2}", kind: "symbol",
    description: "ハイゼンベルクの不確定性原理", category: "量子力学" },
  { reading: "シュレーディンガー方程式", aliases: ["しゅれーでぃんがーほうていしき"],
    latex: "i\\hbar \\frac{\\partial}{\\partial t} \\Psi = \\hat{H} \\Psi", kind: "symbol",
    description: "時間依存シュレーディンガー方程式", category: "量子力学" },
  { reading: "時間非依存シュレーディンガー", aliases: ["じかんひいぞんしゅれーでぃんがー"],
    latex: "\\hat{H}\\psi = E\\psi", kind: "symbol",
    description: "定常状態のシュレーディンガー方程式", category: "量子力学" },
  { reading: "質量エネルギー等価", aliases: ["しつりょうえねるぎーとうか"],
    latex: "E = mc^2", kind: "symbol",
    description: "アインシュタインの質量エネルギー等価", category: "相対論" },
  { reading: "ローレンツ収縮", aliases: ["ろーれんつしゅうしゅく"],
    latex: "L = L_0 \\sqrt{1 - \\frac{v^2}{c^2}}", kind: "symbol",
    description: "ローレンツ収縮", category: "相対論" },
  { reading: "時間の遅れ", aliases: ["じかんのおくれ"],
    latex: "\\Delta t = \\frac{\\Delta t_0}{\\sqrt{1 - \\frac{v^2}{c^2}}}", kind: "symbol",
    description: "特殊相対論の時間の遅れ", category: "相対論" },
  { reading: "ローレンツ因子", aliases: ["ろーれんついんし"],
    latex: "\\gamma = \\frac{1}{\\sqrt{1 - v^2/c^2}}", kind: "symbol",
    description: "ローレンツ因子 γ", category: "相対論" },

  // ══════════════════════════════════════
  // 記号・括弧・その他
  // ══════════════════════════════════════
  { reading: "丸括弧", aliases: ["まるかっこ", "パーレン", "括弧"],
    latex: "\\left( A \\right)", kind: "unary",
    description: "自動サイズ括弧 ( )", category: "括弧" },
  { reading: "角括弧", aliases: ["かくかっこ", "ブラケット"],
    latex: "\\left[ A \\right]", kind: "unary",
    description: "自動サイズ角括弧 [ ]", category: "括弧" },
  { reading: "波括弧", aliases: ["なみかっこ", "中括弧", "ちゅうかっこ", "ブレース"],
    latex: "\\left\\{ A \\right\\}", kind: "unary",
    description: "自動サイズ波括弧 { }", category: "括弧" },
  { reading: "山括弧", aliases: ["やまかっこ", "アングルブラケット"],
    latex: "\\left\\langle A \\right\\rangle", kind: "unary",
    description: "自動サイズ山括弧 ⟨ ⟩", category: "括弧" },
  { reading: "文字", aliases: ["もじ", "テキスト", "text"],
    latex: "\\text{A}", kind: "unary",
    description: "数式中のテキスト", category: "構造" },
  { reading: "取り消し線", aliases: ["とりけしせん", "キャンセル"],
    latex: "\\cancel{A}", kind: "unary",
    description: "取り消し線", category: "構造" },
  { reading: "色付き", aliases: ["いろつき", "カラー"],
    latex: "\\textcolor{red}{A}", kind: "unary",
    description: "文字色の変更", category: "構造" },
  { reading: "囲み", aliases: ["かこみ", "ボックス"],
    latex: "\\boxed{A}", kind: "unary",
    description: "囲み枠", category: "構造" },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// §4. LaTeX日本語訳辞書（LaTeX → 日本語の読み方）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface LatexTranslation {
  latex: string;
  japanese: string;
  category: string;
}

export const LATEX_TRANSLATIONS: LatexTranslation[] = [
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
  { latex: "\\int_{a}^{b}", japanese: "aからbまで積分", category: "微積分" },
  { latex: "\\sum_{i=1}^{n}", japanese: "i=1からnまで総和", category: "微積分" },
  { latex: "\\prod_{i=1}^{n}", japanese: "i=1からnまで総乗", category: "微積分" },
  { latex: "\\lim_{x \\to a}", japanese: "xがaに近づくとき極限", category: "微積分" },
  { latex: "\\frac{d}{dx}", japanese: "xで微分", category: "微積分" },
  { latex: "\\frac{\\partial}{\\partial x}", japanese: "xで偏微分", category: "微積分" },
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
  { latex: "\\,", japanese: "小スペース（3/18em ≈ 1.7pt）", category: "スペーシング" },
  { latex: "\\:", japanese: "中スペース（4/18em ≈ 2.2pt）", category: "スペーシング" },
  { latex: "\\;", japanese: "大スペース（5/18em ≈ 2.8pt）", category: "スペーシング" },
  { latex: "\\!", japanese: "負スペース（-3/18em）", category: "スペーシング" },
  { latex: "\\quad", japanese: "1em幅スペース", category: "スペーシング" },
  { latex: "\\qquad", japanese: "2em幅スペース", category: "スペーシング" },
  { latex: "\\hspace{Xpt}", japanese: "Xpt分の水平スペース", category: "スペーシング" },
  { latex: "\\vspace{Xpt}", japanese: "Xpt分の垂直スペース", category: "スペーシング" },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// §5. 日本語 → LaTeX パーサー
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
// 解析フロー:
//   入力 → Phase0(正規化) → Phase1(構造) → Phase2(装飾) → Phase3(演算子) → Phase4(辞書) → Phase5(後処理)
//

/** 漢数字を含む可能性のある項を解決 */
function resolveTerm(term: string): string {
  const t = term.trim();

  // 漢数字 → 算用数字
  const num = parseKanjiNumber(t);
  if (num !== null) return num.toString();

  // ギリシャ文字 (正規化されたひらがなで検索)
  const normT = normalizeForMatch(t);
  const greekEntry = MATH_DICTIONARY.find(
    (e) => e.category === "ギリシャ文字" && (
      normalizeForMatch(e.reading) === normT ||
      e.aliases.some((a) => normalizeForMatch(a) === normT)
    )
  );
  if (greekEntry) return greekEntry.latex;

  // 特殊語
  if (normT === "むげんだい" || normT === "むげん" || t === "∞") return "\\infty";
  if (normT === "ぱい" || t === "π") return "\\pi";

  return t;
}

/** 漢数字+算用数字の両方にマッチする正規表現の文字クラス */
const K = "零〇一二三四五六七八九十百千万";
const NUM_CLASS = `[${K}\\d]`; // 漢数字 or 算用数字
const NUM_SEQ   = `${NUM_CLASS}+`; // 1文字以上の数字列
const TERM      = `[^\\s]+?`;     // 任意の項 (非貪欲)
const TERM_G    = `[^\\s]+`;      // 任意の項 (貪欲)
const VAR       = `[a-zA-Zα-ωΑ-Ω\\d\\\\{}()]+`; // 変数・LaTeXコマンド

/**
 * 日本語で書かれた数式テキストをLaTeXに変換する
 *
 * 対応パターン一覧:
 *   "2分の1" / "二分の一"      → \frac{1}{2}
 *   "xの2乗" / "xの二乗"      → x^{2}
 *   "ルート2" / "るーと二"      → \sqrt{2}
 *   "3乗根8" / "三乗根八"      → \sqrt[3]{8}
 *   "xからyまで積分"           → \int_{x}^{y}
 *   "i=1からnまで総和"          → \sum_{i=1}^{n}
 *   "xが0に近づく極限"          → \lim_{x \to 0}
 *   "xで微分" / "xで偏微分"     → \frac{d}{dx} / \frac{\partial}{\partial x}
 *   "アルファ たす ベータ"       → \alpha + \beta
 *   "fイコールma"              → f = ma
 *   "ベクトルa" / "ハットa"     → \vec{a} / \hat{a}
 *   etc.
 */
/**
 * 入力がすでにLaTeX記法を含むかを判定
 * バックスラッシュコマンド、^、_、{} のペアなどがあればLaTeX的
 */
function containsLatexNotation(s: string): boolean {
  // バックスラッシュコマンド (\frac, \int, \alpha, etc.)
  if (/\\[a-zA-Z]+/.test(s)) return true;
  // 上付き/下付き (x^2, a_1, etc.)
  if (/[\^_]/.test(s)) return true;
  // 中括弧ペア ({...})
  if (/\{[^}]*\}/.test(s)) return true;
  return false;
}

/**
 * 純粋な算術式かどうかを判定 (2+4, 3*5, x=2 など)
 * 日本語文字が含まれていなければ算術式とみなす
 */
function isPureArithmetic(s: string): boolean {
  // 日本語文字（ひらがな、カタカナ、漢字）が含まれていない
  return !/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(s);
}

export function parseJapanesemath(input: string): string {
  let result = input.trim();
  if (!result) return "";

  // ── Phase -1: LaTeX / 算術式のパススルー ──
  // 入力がすでにLaTeX記法や純粋な算術式の場合、そのまま返す
  if (containsLatexNotation(result)) {
    // 全角→半角のみ適用してそのまま返す
    return zenkakuToHankaku(result);
  }
  if (isPureArithmetic(result)) {
    // 全角→半角のみ適用してそのまま返す
    return zenkakuToHankaku(result);
  }

  // ── Phase 0: 正規化 (全角→半角, カタカナ→ひらがな) ──
  result = normalizeForParse(result);

  // ── Phase 1: 構造パターン (長いパターン優先) ──

  // [denom]ぶんの[numer] / [denom]分の[numer] → \frac{numer}{denom}
  result = result.replace(
    new RegExp(`(${TERM})(?:ぶんの|分の)(${TERM_G})`, "g"),
    (_, denom, numer) => `\\frac{${resolveTerm(numer)}}{${resolveTerm(denom)}}`
  );

  // [base]の[n]じょう / [base]の[n]乗 → base^{n}
  result = result.replace(
    new RegExp(`(${VAR})の(${NUM_SEQ}|[a-zA-Z])(?:じょう|乗)`, "g"),
    (_, base, exp) => `${resolveTerm(base)}^{${resolveTerm(exp)}}`
  );

  // [n]じょうこん[x] / [n]乗根[x] → \sqrt[n]{x}
  result = result.replace(
    new RegExp(`(${NUM_SEQ})(?:じょうこん|乗根)(${TERM_G})`, "g"),
    (_, n, x) => `\\sqrt[${resolveTerm(n)}]{${resolveTerm(x)}}`
  );

  // るーと[x] / 平方根[x] / 根号[x] → \sqrt{x}
  result = result.replace(
    /(?:るーと|平方根|根号|√)([^\s]+)/g,
    (_, x) => `\\sqrt{${resolveTerm(x)}}`
  );

  // [from]から[to]まで せきぶん/積分 → \int_{from}^{to}
  result = result.replace(
    /([^\s]+)から([^\s]+)まで(?:せきぶん|積分)/g,
    (_, from, to) => `\\int_{${resolveTerm(from)}}^{${resolveTerm(to)}}`
  );

  // [from]から[to]まで そうわ/総和/合計/ごうけい → \sum_{from}^{to}
  result = result.replace(
    /([^\s]+?)から([^\s]+?)まで(?:そうわ|総和|合計|ごうけい)/g,
    (_, from, to) => `\\sum_{${resolveTerm(from)}}^{${resolveTerm(to)}}`
  );

  // [from]から[to]まで そうじょう/総乗 → \prod_{from}^{to}
  result = result.replace(
    /([^\s]+?)から([^\s]+?)まで(?:そうじょう|総乗)/g,
    (_, from, to) => `\\prod_{${resolveTerm(from)}}^{${resolveTerm(to)}}`
  );

  // [x]が[a]に 近づく/ちかづく [とき[の]] きょくげん/極限 → \lim_{x \to a}
  result = result.replace(
    /([a-zA-Z])が([^\s]+?)に(?:近づく|ちかづく)(?:とき(?:の)?)?(?:きょくげん|極限)/g,
    (_, x, a) => `\\lim_{${x} \\to ${resolveTerm(a)}}`
  );
  // [x]を[a]に 飛ばす/とばす 極限
  result = result.replace(
    /([a-zA-Z])を([^\s]+?)に(?:飛ばす|とばす)(?:きょくげん|極限)/g,
    (_, x, a) => `\\lim_{${x} \\to ${resolveTerm(a)}}`
  );

  // [x]で びぶん/微分 → \frac{d}{dx}
  result = result.replace(
    /([a-zA-Z])で(?:びぶん|微分)/g,
    (_, x) => `\\frac{d}{d${x}}`
  );

  // [x]で へんびぶん/偏微分 → \frac{\partial}{\partial x}
  result = result.replace(
    /([a-zA-Z])で(?:へんびぶん|偏微分)/g,
    (_, x) => `\\frac{\\partial}{\\partial ${x}}`
  );

  // ── Phase 2: 装飾パターン ──
  // ※ 正規化済みなのでカタカナ形はひらがなに統一済み
  result = result.replace(/べくとる([a-zA-Z])/g, (_, x) => `\\vec{${x}}`);
  result = result.replace(/はっと([a-zA-Z])/g, (_, x) => `\\hat{${x}}`);
  result = result.replace(/ちるだ([a-zA-Z])/g, (_, x) => `\\tilde{${x}}`);
  result = result.replace(/(?:ばー|平均)([a-zA-Z])/g, (_, x) => `\\bar{${x}}`);
  result = result.replace(/(?:だぶるどっと|二階微分)([a-zA-Z])/g, (_, x) => `\\ddot{${x}}`);
  result = result.replace(/どっと([a-zA-Z])/g, (_, x) => `\\dot{${x}}`);
  result = result.replace(/(?:ぜったいち|絶対値)([^\s]+)/g, (_, x) => `\\left| ${resolveTerm(x)} \\right|`);
  result = result.replace(/(?:のるむ)([^\s]+)/g, (_, x) => `\\left\\| ${resolveTerm(x)} \\right\\|`);
  result = result.replace(/太字([a-zA-Z])/g, (_, x) => `\\mathbf{${x}}`);

  // ── Phase 3: 演算子・関係子 ──
  // 各概念について ひらがな | 漢字 | 漢字活用形 をカバー
  // (カタカナ形は Phase0 でひらがなに正規化済み)

  // 加算: たす | たして | 足す | 足して | ぷらす | 加算 | かさん
  result = result.replace(/(?:たす|たして|足す|足して|ぷらす|加算|かさん)/g, "+ ");
  // 減算: ひく | ひいて | 引く | 引いて | まいなす | 減算 | げんざん
  result = result.replace(/(?:ひく|ひいて|引く|引いて|まいなす|減算|げんざん)/g, "- ");
  // 乗算: かける | かけて | 掛ける | 掛けて | × | 乗算 | じょうざん
  result = result.replace(/(?:かける|かけて|掛ける|掛けて|×|乗算|じょうざん)/g, "\\times ");
  // 除算: わる | わって | 割る | 割って | ÷ | 除算 | じょざん
  result = result.replace(/(?:わる|わって|割る|割って|÷|除算|じょざん)/g, "\\div ");
  // 等号: いこーる | 等しい | ひとしい
  result = result.replace(/(?:いこーる|等しい|ひとしい)/g, "= ");
  // 不等号: のっといこーる | 等しくない | ひとしくない
  result = result.replace(/(?:のっといこーる|等しくない|ひとしくない)/g, "\\neq ");
  // 以下: いか | 以下
  result = result.replace(/(?:いか(?!ら)|以下)/g, "\\leq ");
  // 以上: いじょう | 以上
  result = result.replace(/(?:いじょう|以上)/g, "\\geq ");
  // 未満: みまん | 未満
  result = result.replace(/(?:みまん|未満)/g, "< ");
  // ならば
  result = result.replace(/ならば/g, "\\Rightarrow ");
  // 同値: どうち | 同値
  result = result.replace(/(?:どうち|同値)/g, "\\Leftrightarrow ");

  // ── Phase 4: 辞書引き (残りの記号・関数) ──
  // 正規化済み入力に対して、辞書のreading/aliasesを正規化比較
  // binary/unary もプレースホルダーを除去して記号部分のみ挿入
  for (const entry of MATH_DICTIONARY) {
    // すべてのkindを処理対象にする
    const normReading = normalizeForMatch(entry.reading);
    // binary/unary の場合、プレースホルダー {A}, {B}, {N} を除去して記号のみにする
    const entryLatex = (entry.kind === "binary" || entry.kind === "unary")
      ? entry.latex.replace(/\{[A-Z]\}/g, "").replace(/_\s*\^/g, "").trim()
      : entry.latex;
    // Reading でマッチ (正規化済みの入力にはひらがな形がある)
    if (normReading.length > 1 && result.includes(normReading)) {
      result = result.split(normReading).join(entryLatex + " ");
    }
    // Aliases でマッチ
    for (const alias of entry.aliases) {
      const normAlias = normalizeForMatch(alias);
      if (normAlias.length > 1 && result.includes(normAlias)) {
        result = result.split(normAlias).join(entryLatex + " ");
      }
      // 漢字形そのままでもマッチ (正規化で変わらない文字列)
      if (alias.length > 1 && alias !== normAlias && result.includes(alias)) {
        result = result.split(alias).join(entryLatex + " ");
      }
    }
  }

  // ── Phase 5: 後処理 ──
  result = result.replace(/ +/g, " ").trim();

  return result;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// §6. リアルタイム候補生成
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface JapaneseSuggestion {
  display: string;
  reading: string;
  latex: string;
  preview: string;
  category: string;
}

/**
 * 日本語入力のサフィックスに基づく候補生成 (正規化マッチ対応)
 */
export function getJapaneseSuggestions(input: string): JapaneseSuggestion[] {
  if (!input.trim()) return [];

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

  return results.slice(0, 8);
}

/**
 * マッチスコア計算 (正規化対応)
 * query と entry の reading/aliases を正規化して比較
 */
function getMatchScore(query: string, entry: MathDictEntry): number {
  const normQ = normalizeForMatch(query);
  const normR = normalizeForMatch(entry.reading);

  if (normR.startsWith(normQ)) return 3;
  if (normR.includes(normQ)) return 2;

  for (const alias of entry.aliases) {
    const normA = normalizeForMatch(alias);
    if (normA.startsWith(normQ)) return 3;
    if (normA.includes(normQ)) return 2;
  }

  if (entry.description.includes(query)) return 1;
  return 0;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// §7. スペーシング・プリセット
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface SpacingPreset {
  name: string;
  latex: string;
  description: string;
  widthEm: number;
}

export const SPACING_PRESETS: SpacingPreset[] = [
  { name: "負スペース", latex: "\\!", description: "少し詰める (-3/18em)", widthEm: -0.167 },
  { name: "極小", latex: "\\,", description: "微調整 (3/18em ≈ 1.7pt)", widthEm: 0.167 },
  { name: "小", latex: "\\:", description: "単語間 (4/18em ≈ 2.2pt)", widthEm: 0.222 },
  { name: "中", latex: "\\;", description: "区切り (5/18em ≈ 2.8pt)", widthEm: 0.278 },
  { name: "大", latex: "\\quad", description: "1em幅", widthEm: 1.0 },
  { name: "特大", latex: "\\qquad", description: "2em幅", widthEm: 2.0 },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// §8. インライン数式パーサー（段落テキスト用）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface InlineSegment {
  type: "text" | "math";
  content: string;
  raw?: string;
  latex?: string;
}

/**
 * 段落テキスト中の $...$ インライン数式を検出・変換
 */
export function parseInlineText(text: string): InlineSegment[] {
  if (!text) return [{ type: "text", content: "" }];

  const segments: InlineSegment[] = [];
  const regex = /\$([^$]+)\$/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    const raw = match[1];
    const latex = parseJapanesemath(raw);
    segments.push({ type: "math", content: latex, raw, latex });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", content: text.slice(lastIndex) });
  }

  if (segments.length === 0) {
    return [{ type: "text", content: text }];
  }

  return segments;
}

/**
 * インラインテキスト → LaTeX文字列
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
 * カーソル位置が$...$の中にいるか判定
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
    const start = match.index + 1;
    const end = match.index + match[0].length - 1;
    if (cursorPos >= start && cursorPos <= end) {
      return {
        inMath: true,
        mathStart: match.index,
        mathEnd: match.index + match[0].length,
        mathContent: match[1],
      };
    }
  }

  const lastDollar = text.lastIndexOf("$");
  if (lastDollar >= 0 && cursorPos > lastDollar) {
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// §9. 検索ユーティリティ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * カテゴリ一覧を取得
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
 * 全文検索 (正規化マッチ対応)
 * ひらがな/カタカナ/漢字/英語 どの形式で検索してもヒットする
 */
export function searchDictionary(query: string): MathDictEntry[] {
  if (!query.trim()) return [];
  const normQ = normalizeForMatch(query.trim());

  return MATH_DICTIONARY
    .map((entry) => {
      let score = 0;
      const normR = normalizeForMatch(entry.reading);

      // reading マッチ (正規化)
      if (normR.startsWith(normQ)) score += 10;
      else if (normR.includes(normQ)) score += 5;

      // aliases マッチ (正規化)
      for (const alias of entry.aliases) {
        const normA = normalizeForMatch(alias);
        if (normA.startsWith(normQ)) score += 8;
        else if (normA.includes(normQ)) score += 4;
      }

      // description マッチ (原文)
      if (entry.description.toLowerCase().includes(normQ)) score += 3;

      // LaTeX マッチ
      if (entry.latex.toLowerCase().includes(normQ)) score += 2;

      return { entry, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.entry);
}
