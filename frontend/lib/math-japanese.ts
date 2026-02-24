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
function zenkakuToHankaku(s: string): string {
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
  { reading: "積分", aliases: ["せきぶん", "インテグラル"],
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
export function parseJapanesemath(input: string): string {
  let result = input.trim();
  if (!result) return "";

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

  // 加算: たす | たして | 足す | 足して | ぷらす
  result = result.replace(/(?:たす|たして|足す|足して|ぷらす)/g, "+ ");
  // 減算: ひく | ひいて | 引く | 引いて | まいなす
  result = result.replace(/(?:ひく|ひいて|引く|引いて|まいなす)/g, "- ");
  // 乗算: かける | かけて | 掛ける | 掛けて
  result = result.replace(/(?:かける|かけて|掛ける|掛けて)/g, "\\times ");
  // 除算: わる | わって | 割る | 割って
  result = result.replace(/(?:わる|わって|割る|割って)/g, "\\div ");
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
  for (const entry of MATH_DICTIONARY) {
    if (entry.kind === "symbol" || entry.kind === "operator" || entry.kind === "relation") {
      const normReading = normalizeForMatch(entry.reading);
      // Reading でマッチ (正規化済みの入力にはひらがな形がある)
      if (normReading.length > 1 && result.includes(normReading)) {
        result = result.split(normReading).join(entry.latex + " ");
      }
      // Aliases でマッチ
      for (const alias of entry.aliases) {
        const normAlias = normalizeForMatch(alias);
        if (normAlias.length > 1 && result.includes(normAlias)) {
          result = result.split(normAlias).join(entry.latex + " ");
        }
        // 漢字形そのままでもマッチ (正規化で変わらない文字列)
        if (alias.length > 1 && alias !== normAlias && result.includes(alias)) {
          result = result.split(alias).join(entry.latex + " ");
        }
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
