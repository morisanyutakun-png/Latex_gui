/**
 * REM (ExamGen RAG) の問題生成・類題生成ノウハウを Eddivom に移植したテンプレ集。
 *
 * 出典:
 *   - /Users/moriyuuta/react_ex/backend/main.py:2167-2178 (類題化指示)
 *   - /Users/moriyuuta/react_ex/backend/main.py:2356-2363 (レイアウトルール)
 *   - /Users/moriyuuta/react_ex/backend/main.py:3470-3520 (プリセット別構造ルール)
 *
 * 設計方針:
 *   - REM 本体 (FastAPI / RAG / DB) は呼ばない。ノウハウだけ移植する。
 *   - これらはユーザ message に prepend する用途。Eddivom の既存 /api/ai/chat
 *     プロキシは中身に手を加えないので、prefix 流し込みで等価の効果が得られる。
 *   - 日英両方を持ち、locale に応じて切り替える。
 *   - Style バリエーションで「同じ / 難しく / 易しく / 別形式 / 量を増やす」を切替。
 */

// ─── 言語ヘルパ ────────────────────────────────────────────
export type RemLocale = "ja" | "en";

/** UI 側の locale 文字列 ("ja" / "ja-JP" / "en" / "en-US" 等) を REM の二択に正規化。 */
export function normalizeLocale(s: string | null | undefined): RemLocale {
  if (!s) return "ja";
  return s.toLowerCase().startsWith("en") ? "en" : "ja";
}

// ─── Variant style バリエーション ──────────────────────────
// Claude/ChatGPT の「regenerate with options」を踏襲。1 ボタン → ドロップダウン → 5 選択肢。
export type VariantStyle = "same" | "harder" | "easier" | "format" | "more";

interface VariantStyleSpec {
  jaTitle: string;
  enTitle: string;
  jaDesc: string;
  enDesc: string;
  /** プロンプトに追加する具体的な「変更指示」。 */
  jaInstruction: string;
  enInstruction: string;
  /** 表示用アイコン名 (lucide-react)。 */
  iconKey: "Sparkles" | "TrendingUp" | "TrendingDown" | "Shuffle" | "Plus";
}

export const VARIANT_STYLES: Record<VariantStyle, VariantStyleSpec> = {
  same: {
    jaTitle: "同じ難易度で類題",
    enTitle: "Variants at same difficulty",
    jaDesc: "出題傾向・形式・難易度を保ったまま、別の数値・設定で類題を作成",
    enDesc: "Keep topic, format, difficulty — only swap numbers and settings",
    jaInstruction: "難易度・出題形式・問題数は変えず、数値・係数・登場する設定のみ変更してください。",
    enInstruction: "Keep difficulty, format, and number of problems identical. Change only numerical values, coefficients, and surface settings.",
    iconKey: "Sparkles",
  },
  harder: {
    jaTitle: "もう少し難しく",
    enTitle: "A bit harder",
    jaDesc: "概念は同じで、難易度を 1 段階上げる (計算量・思考ステップを増やす)",
    enDesc: "Same concept, one tier harder (more computation / reasoning steps)",
    jaInstruction:
      "概念・分野は同じまま、難易度を 1 段階上げてください。" +
      "(具体例: 計算ステップを増やす / 数値を 2 桁→3 桁にする / 場合分けを追加 / " +
      "1 つの問題に複数の概念を組み合わせる)",
    enInstruction:
      "Keep the concept and topic, but raise the difficulty by one tier. " +
      "(Examples: more computation steps / larger numbers / additional case analysis / " +
      "combine multiple concepts in one problem.)",
    iconKey: "TrendingUp",
  },
  easier: {
    jaTitle: "もう少し易しく",
    enTitle: "A bit easier",
    jaDesc: "概念は同じで、難易度を 1 段階下げる (基礎確認向け)",
    enDesc: "Same concept, one tier easier (good for foundations)",
    jaInstruction:
      "概念・分野は同じまま、難易度を 1 段階下げてください。" +
      "(具体例: 数値を簡単に / ヒントを 1 行添える / 場合分けを減らす / " +
      "誘導小問 (1)(2)(3) を増やして段階的に解かせる)",
    enInstruction:
      "Keep the concept and topic, but lower the difficulty by one tier. " +
      "(Examples: simpler numbers / add a one-line hint / fewer case analyses / " +
      "introduce sub-problems (1)(2)(3) for scaffolded solving.)",
    iconKey: "TrendingDown",
  },
  format: {
    jaTitle: "別の形式で",
    enTitle: "Switch format",
    jaDesc: "難易度はほぼ同じで、出題形式を変える (記述↔選択 / 計算↔証明 等)",
    enDesc: "Similar difficulty, different format (free-response ↔ multiple choice, etc.)",
    jaInstruction:
      "難易度はほぼ同等のまま、出題形式を切り替えてください。" +
      "(現在が記述式なら 4 択選択式に / 現在が単純計算なら穴埋め or 証明問題に / " +
      "現在が定義問題なら応用問題に。形式の対応は文脈から自然に判断する)",
    enInstruction:
      "Keep difficulty similar, but switch the question format. " +
      "(If currently free-response, use 4-option multiple choice; " +
      "if simple computation, use fill-in-the-blank or proof; " +
      "if definitional, switch to application. Choose the natural counterpart.)",
    iconKey: "Shuffle",
  },
  more: {
    jaTitle: "問題数を増やして",
    enTitle: "More problems",
    jaDesc: "現在のセットに同じ難易度の問題を追加 (3〜5 問増やす)",
    enDesc: "Append more problems at the same difficulty (add 3–5)",
    jaInstruction:
      "既存の問題セットを残したまま、同じ難易度で 3〜5 問を追加してください。" +
      "(既存問題と数値・設定が重複しないように注意。番号は連番で続ける)",
    enInstruction:
      "Keep the existing problems intact, and append 3–5 more at the same difficulty. " +
      "(Avoid duplicating numbers or settings. Continue numbering sequentially.)",
    iconKey: "Plus",
  },
};

// ─── Seed 抽出 ─────────────────────────────────────────────
/**
 * doc.latex から「問題本体」だけを抽出する。
 *
 * 雑な slice(0, 4000) と違い、LaTeX の構造を見て:
 *   1. \section*{問題} ... \section*{解答} の本文
 *   2. \begin{enumerate} ... \end{enumerate} の最大ブロック
 *   3. \begin{document} ... \end{document} の本体
 *   の優先順位で抽出する。1 つも見つからなければ前半 2500 字に落とす。
 *
 * 目的: AI に渡す seed を「問題そのもの」に絞り、preamble やテンプレ装飾で
 *       履歴を圧迫しない。長すぎる seed はコンテキスト切れの原因にもなる。
 */
export function extractProblemsSection(latex: string | null | undefined): string {
  if (!latex) return "";
  const src = latex;
  const MAX = 2500;

  // (1) \section*{問題} ... 解答ページまで
  const sectionMatch = /\\section\*\{[^}]*?(?:問題|Problems?|Quiz|Exercises?)[^}]*?\}([\s\S]*?)(?:\\section\*\{[^}]*?(?:解答|Solutions?|Answers?)|\\newpage|$)/i.exec(src);
  if (sectionMatch && sectionMatch[1].trim().length > 60) {
    return sectionMatch[1].trim().slice(0, MAX);
  }

  // (2) 最大の enumerate ブロック
  const enumMatches = [...src.matchAll(/\\begin\{enumerate\}[\s\S]*?\\end\{enumerate\}/g)];
  if (enumMatches.length > 0) {
    const longest = enumMatches.reduce((a, b) => (a[0].length >= b[0].length ? a : b));
    return longest[0].slice(0, MAX);
  }

  // (3) document body
  const bodyMatch = /\\begin\{document\}([\s\S]*?)\\end\{document\}/.exec(src);
  if (bodyMatch && bodyMatch[1].trim().length > 60) {
    return bodyMatch[1].trim().slice(0, MAX);
  }

  // (4) フォールバック
  return src.trim().slice(0, MAX);
}

// ─── プロンプトビルダ ──────────────────────────────────────

const VARIANT_HEAD_JA = `【類題生成依頼】
以下のベース問題と同じ出題傾向のまま、新しい類題セットを作成してください。

共通ルール:
- ベース問題をそのままコピーしない (写経禁止)
- 解答を必ず付ける。解説は途中式の要点だけ簡潔に
- 数式は LaTeX で。図が必要なら TikZ で
- 既存ドキュメントのレイアウト・配色・テンプレ構造を踏襲する
- 出力時は \\begin{document} ... \\end{document} の **本文だけ** を返す (preamble は変更しない)`;

const VARIANT_HEAD_EN = `[Variant generation request]
Generate a NEW variant problem set based on the seed below, preserving topic.

Common rules:
- Do NOT copy the seed verbatim
- Always include answers; keep explanations concise (key steps only)
- Use LaTeX for math; TikZ for figures when needed
- Match the existing document's layout, colors, and template structure
- Return ONLY the body inside \\begin{document}…\\end{document} (do not change preamble)`;

const ENHANCE_HEAD_JA = `【出題ノウハウ強化】
以下のラフな依頼を、教材として印刷・配布できる完成度の問題セットに肉付けしてください。

要件:
- 各問末尾に配点バッジ [XX点] を明記
- 大問: \\section* で番号付け、または既存テンプレに従う
- 小問: \\begin{enumerate}[(1)] の \\item
- 各問の後に解答スペース (\\vspace{2.5cm} 程度)
- \\newpage で問題ページと解答ページを分離
- 解答ページ: \\section*{解答・解説} の下に途中式付きで番号順に
- 数式は LaTeX。図は TikZ
- レイアウト: \\begin{enumerate}[leftmargin=*]
- 配色 (mainblue / accentcolor / rulecolor 等) の定義は既存テンプレを尊重し、上書きしない
- \\problem / \\answer 等の独自コマンドは使わず、enumerate のみで構成`;

const ENHANCE_HEAD_EN = `[Prompt boost: pedagogical structure]
Expand the rough request into a print-ready, classroom-quality problem set.

Requirements:
- Each problem ends with a score badge [XX pts]
- Sections: \\section* numbered, or follow the existing template
- Sub-problems: \\begin{enumerate}[(1)] with \\item
- Leave answer space after each problem (\\vspace{2.5cm})
- Separate problem and answer pages with \\newpage
- Answer page: \\section*{Solutions} with step-by-step working in numbered order
- Use LaTeX for math; TikZ for figures
- Layout: \\begin{enumerate}[leftmargin=*]
- Respect existing color definitions (mainblue / accentcolor / rulecolor); do NOT override
- Use only enumerate (no custom \\problem / \\answer commands)`;

/**
 * 「もう1枚 類題」用プロンプト builder。
 *  - seedLatex: 現在の doc.latex (extractProblemsSection で問題本体に絞られる)
 *  - userHint:  ユーザが追加で指定したいニュアンス (例: 「多項式に絞って」)。空でも OK。
 *  - locale:    UI ロケール
 *  - style:     "same" | "harder" | "easier" | "format" | "more"  (デフォルト same)
 */
export function buildVariantPrompt(
  seedLatex: string | null | undefined,
  userHint: string,
  locale: RemLocale,
  style: VariantStyle = "same",
): string {
  const head = locale === "en" ? VARIANT_HEAD_EN : VARIANT_HEAD_JA;
  const styleSpec = VARIANT_STYLES[style];
  const styleLabel = locale === "en" ? "Style" : "スタイル";
  const styleHead =
    `\n[${styleLabel}: ${locale === "en" ? styleSpec.enTitle : styleSpec.jaTitle}]\n` +
    (locale === "en" ? styleSpec.enInstruction : styleSpec.jaInstruction);

  const seedLabel = locale === "en"
    ? "--- Seed problem (extracted from current document) ---"
    : "--- ベース問題 (現在のドキュメントから抽出) ---";
  const seedEnd = locale === "en" ? "--- End of seed ---" : "--- ベース問題ここまで ---";
  const hintLabel = locale === "en" ? "Additional notes from user:" : "ユーザからの追加指示:";

  // 雑な slice ではなく、構造を見て問題本文だけ抽出する。
  const seed = extractProblemsSection(seedLatex);

  const parts: string[] = [head, styleHead];
  if (seed) {
    parts.push("", seedLabel, seed, seedEnd);
  }
  const trimmedHint = userHint.trim();
  if (trimmedHint) {
    parts.push("", hintLabel, trimmedHint);
  }
  return parts.join("\n");
}

/**
 * 「✨ 強化トグル ON」での送信時に使うプロンプト builder。
 *  - rawInput: ユーザの素の入力 (「二次方程式」など短くても OK)
 *  - locale:   i18n
 */
export function buildEnhancePrompt(rawInput: string, locale: RemLocale): string {
  const head = locale === "en" ? ENHANCE_HEAD_EN : ENHANCE_HEAD_JA;
  const userLabel = locale === "en" ? "User request:" : "ユーザの依頼:";
  return [head, "", userLabel, rawInput.trim()].join("\n");
}
