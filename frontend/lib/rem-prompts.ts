/**
 * REM (ExamGen RAG) の問題生成・類題生成ノウハウを Eddivom に移植したテンプレ集。
 *
 * 出典:
 *   - /Users/moriyuuta/react_ex/backend/main.py:2167-2178 (類題化指示)
 *   - /Users/moriyuuta/react_ex/backend/main.py:2356-2363 (レイアウトルール)
 *   - /Users/moriyuuta/react_ex/backend/main.py:3470-3520 (プリセット別構造ルール)
 *
 * 設計方針:
 *   - REM 本体 (FastAPI / RAG / DB) は呼ばない。テキストだけ移植する。
 *   - これらはユーザ message に prepend する用途。Eddivom の既存
 *     /api/ai/chat プロキシは中身に手を加えないので、prefix 流し込みで
 *     等価の効果が得られる。
 *   - 日英両方を持ち、locale に応じて切り替える。
 */

const VARIANT_HEAD_JA = `【類題生成依頼】
以下のベース問題と同じ出題傾向・形式・難易度で、新しい類題を作成してください。

ルール:
- 数値・係数・設定は変えるが、概念・解法パターンは保つ
- ベース問題をそのままコピーしない (写経禁止)
- 解答を必ず付ける。解説は途中式の要点だけ簡潔に
- 数式は LaTeX で。図が必要なら TikZ で
- 既存ドキュメントのレイアウト・配色・テンプレ構造を踏襲する`;

const VARIANT_HEAD_EN = `[Variant generation request]
Generate a NEW set of similar problems based on the seed problem below, preserving the same topic, format, and difficulty.

Rules:
- Change numbers / coefficients / settings, but preserve the concept and solution pattern
- Do NOT copy the seed verbatim
- Always include answers. Keep explanations concise (key steps only)
- Use LaTeX for math; TikZ for figures
- Match the existing document's layout, colors, and template structure`;

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
Expand the following rough request into a print-ready, classroom-quality problem set.

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

export type RemLocale = "ja" | "en";

/**
 * 「もう1枚 類題」用プロンプト builder。
 *  - seedLatex: 現在の doc.latex (もしあれば、抜粋して渡す)
 *  - userHint: ユーザが追加で指定したいニュアンス (例: 「もう少し難しく」)。空でもOK。
 *  - locale: i18n
 */
export function buildVariantPrompt(
  seedLatex: string | null | undefined,
  userHint: string,
  locale: RemLocale,
): string {
  const head = locale === "en" ? VARIANT_HEAD_EN : VARIANT_HEAD_JA;
  const seedLabel = locale === "en" ? "--- Seed problem (current document) ---" : "--- ベース問題 (現在のドキュメント) ---";
  const seedEnd = locale === "en" ? "--- End of seed ---" : "--- ベース問題ここまで ---";
  const hintLabel = locale === "en" ? "Additional notes from user:" : "ユーザからの追加指示:";

  // seed が長すぎる場合は本文の前半 4000 字に丸める (履歴を圧迫しない)
  const seed = (seedLatex || "").trim().slice(0, 4000);

  const parts: string[] = [head];
  if (seed) {
    parts.push("", seedLabel, seed, seedEnd);
  }
  const trimmedHint = userHint.trim();
  if (trimmedHint) {
    parts.push("", hintLabel, trimmedHint);
  } else {
    parts.push(
      "",
      locale === "en"
        ? "Generate a fresh variant set with comparable difficulty."
        : "ベース問題と同等の難易度で、別の類題セットを作成してください。",
    );
  }
  return parts.join("\n");
}

/**
 * 「✨ 強化トグル ON」での送信時に使うプロンプト builder。
 *  - rawInput: ユーザの素の入力 (「二次方程式」など短くてもOK)
 *  - locale: i18n
 *
 * Eddivom の既存テンプレ駆動方針 (CLAUDE memory: テンプレ + AI が枠内で書く) に
 * 沿う形で、AI に「教材として整った構造」を要求する。
 */
export function buildEnhancePrompt(rawInput: string, locale: RemLocale): string {
  const head = locale === "en" ? ENHANCE_HEAD_EN : ENHANCE_HEAD_JA;
  const userLabel = locale === "en" ? "User request:" : "ユーザの依頼:";
  return [head, "", userLabel, rawInput.trim()].join("\n");
}
