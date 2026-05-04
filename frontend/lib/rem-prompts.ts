/**
 * REM (ExamGen RAG) の問題生成・類題生成ノウハウを Eddivom に移植したテンプレ集。
 *
 * 出典 (READ-only):
 *   - /Users/moriyuuta/react_ex/backend/main.py:2167-2178 (類題化指示)
 *   - /Users/moriyuuta/react_ex/backend/main.py:2356-2363 (レイアウトルール)
 *   - /Users/moriyuuta/react_ex/backend/main.py:3470-3520 (プリセット別構造ルール)
 *   - /Users/moriyuuta/react_ex/backend/main.py:2274 (\fancyhead 装飾ルール)
 *   - /Users/moriyuuta/react_ex/backend/main.py:3170, 3419 (配色ルール)
 *
 * 設計方針:
 *   - REM 本体 (FastAPI / RAG / DB) は呼ばない。ノウハウだけ移植する。
 *   - 自由入力 (hint) はサポートしない。REM ノウハウ + Style + 件数 だけで完結させる。
 *   - 教科を seed から自動推定して教科別の出題ノウハウを上乗せする。
 *   - 配点が必ず 100 点に揃うよう AI に明示する。
 *   - 解答は「答え + 途中式 + 別解 (任意) + よくある間違い (任意)」の 4 レイヤ。
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
  jaInstruction: string;
  enInstruction: string;
  iconKey: "Sparkles" | "TrendingUp" | "TrendingDown" | "Shuffle" | "Plus";
}

export const VARIANT_STYLES: Record<VariantStyle, VariantStyleSpec> = {
  same: {
    jaTitle: "同じ難易度で類題",
    enTitle: "Variants at same difficulty",
    jaDesc: "出題傾向・形式・難易度を保ったまま、別の数値・設定で類題を作成",
    enDesc: "Keep topic, format, difficulty — only swap numbers and settings",
    jaInstruction:
      "難易度・出題形式・問題数は変えず、数値・係数・登場する設定のみ変更してください。" +
      "解法のキー手順 (因数分解 / 代入 / 場合分け 等) は同じ手数を維持し、計算量も同程度に揃える。",
    enInstruction:
      "Keep difficulty, format, and number of problems identical. Change only numerical values, coefficients, and surface settings. " +
      "Preserve the same key solution steps (factoring / substitution / case analysis, etc.) and equivalent computation load.",
    iconKey: "Sparkles",
  },
  harder: {
    jaTitle: "もう少し難しく",
    enTitle: "A bit harder",
    jaDesc: "概念は同じで、難易度を 1 段階上げる (計算量・思考ステップを増やす)",
    enDesc: "Same concept, one tier harder (more computation / reasoning steps)",
    jaInstruction:
      "概念・分野は同じまま、難易度を 1 段階だけ上げてください。" +
      "難易度の上げ方は次のいずれか (組み合わせも可): " +
      "(1) 計算ステップを 1〜2 段増やす / " +
      "(2) 数値を 1 桁大きくする (例: 2 桁 → 3 桁)、または分数・無理数を導入 / " +
      "(3) 場合分けを 1 つ追加 / " +
      "(4) 文章題の文脈を抽象化する / " +
      "(5) 1 つの問題に 2 つの概念を組み合わせる。" +
      "ただし「テストの難問枠」を超えないこと。所要時間は元の 1.3〜1.6 倍を目安。",
    enInstruction:
      "Keep concept and topic, raise difficulty by exactly one tier. Choose any of: " +
      "(1) add 1–2 computation steps; (2) widen number range by one digit, or introduce fractions/irrationals; " +
      "(3) add a single case split; (4) make the word problem more abstract; " +
      "(5) combine two concepts in one problem. Stay within the 'hardest of this test' band — target 1.3–1.6× the original time.",
    iconKey: "TrendingUp",
  },
  easier: {
    jaTitle: "もう少し易しく",
    enTitle: "A bit easier",
    jaDesc: "概念は同じで、難易度を 1 段階下げる (基礎確認向け)",
    enDesc: "Same concept, one tier easier (good for foundations)",
    jaInstruction:
      "概念・分野は同じまま、難易度を 1 段階だけ下げてください。" +
      "難易度の下げ方は次のいずれか: " +
      "(1) 数値を簡単にする (整数化・1 桁化) / " +
      "(2) ヒントを問題文末に 1 行で添える (例: 「※ 因数分解できる」) / " +
      "(3) 場合分けを減らす or 統合する / " +
      "(4) 誘導小問 (1)(2)(3) を増やして段階的に解かせる / " +
      "(5) 文章題を直接式の形に書き換える。所要時間は元の 0.6〜0.8 倍を目安。",
    enInstruction:
      "Keep concept and topic, lower difficulty by exactly one tier. Choose any of: " +
      "(1) simplify numbers (integers / 1-digit); (2) append a one-line hint after the question " +
      "(e.g., '※ Try factoring'); (3) reduce or merge case splits; " +
      "(4) add scaffolding sub-problems (1)(2)(3); (5) rewrite word problem as a direct equation. " +
      "Target 0.6–0.8× the original time.",
    iconKey: "TrendingDown",
  },
  format: {
    jaTitle: "別の形式で",
    enTitle: "Switch format",
    jaDesc: "難易度はほぼ同じで、出題形式を変える (記述↔選択 / 計算↔証明 等)",
    enDesc: "Similar difficulty, different format (free-response ↔ multiple choice, etc.)",
    jaInstruction:
      "難易度は同等のまま、出題形式を切り替えてください。形式の対応は文脈から自然に判断する: " +
      "(現在 記述式) → 4 択選択式 (誤答選択肢には典型的な計算ミスを 1 つ仕込む) / " +
      "(現在 単純計算) → 穴埋め式 (\\boxed{\\phantom{XX}} を 2〜3 ヶ所) / " +
      "(現在 数値計算) → 証明・説明問題 (「〜であることを示せ」) / " +
      "(現在 単発問題) → 誘導付き大問 ((1)(2)(3) で段階的に解かせる) / " +
      "(現在 定義確認) → 応用問題 (実生活の文脈に落とす)。",
    enInstruction:
      "Same difficulty, switch format. Pick the natural counterpart from context: " +
      "(currently free-response) → 4-option multiple choice with one plausible-distractor based on a typical mistake; " +
      "(currently computation) → fill-in-the-blank with 2–3 \\boxed{\\phantom{XX}}; " +
      "(currently numerical) → proof / explanation ('Show that …'); " +
      "(currently single-shot) → guided multi-part with (1)(2)(3); " +
      "(currently definitional) → applied / real-world context.",
    iconKey: "Shuffle",
  },
  more: {
    jaTitle: "問題数を増やして",
    enTitle: "More problems",
    jaDesc: "現在のセットに同じ難易度の問題を追加 (3〜5 問増やす)",
    enDesc: "Append more problems at the same difficulty (add 3–5)",
    jaInstruction:
      "既存の問題セットを残したまま、同じ難易度で 3〜5 問を追加してください。" +
      "(既存問題と数値・設定が重複しないよう注意。番号は連番で続ける。" +
      "難易度は元のセットの平均にぴったり合わせる)",
    enInstruction:
      "Keep existing problems intact, append 3–5 more at the same difficulty. " +
      "Avoid duplicating numbers or settings. Continue numbering sequentially. " +
      "Match the average difficulty of the original set exactly.",
    iconKey: "Plus",
  },
};

// ─── 教科別の出題ノウハウ ────────────────────────────────
// seed の中身から教科を粗く推定して、その教科で守るべき特有のルールを上乗せする。
// REM が長期運用で蓄えてきた「教科別の良い問題の作り方」をテキスト化したもの。
type Subject = "math" | "physics" | "chemistry" | "biology" | "english" | "japanese" | "social" | "general";

function detectSubject(seed: string): Subject {
  const s = seed.toLowerCase();
  // 数学: \int, \frac, \log, sin, cos, 方程式, 関数, 微分, 積分, 数列, ベクトル, 行列, 確率
  if (/(\\int|\\frac|\\log|\\sin|\\cos|\\tan|\\sum|\\lim|\\sqrt|方程式|関数|微分|積分|数列|ベクトル|行列|確率|統計|二次|三次|因数分解)/.test(s)) return "math";
  // 物理: 力, 速度, 加速度, 電圧, 電流, 抵抗, 運動量, エネルギー, 振動, 波, m/s, kg
  if (/(力学|電磁|波動|熱力|単振動|電圧|電流|抵抗|運動量|エネルギー保存|ニュートン|オーム|キルヒホッフ|m\/s|\\kg|\\text\{m\}|\\text\{kg\})/.test(s)) return "physics";
  // 化学: mol, g/mol, 中和, 酸, 塩基, 反応式, ph, 結合, 電子配置
  if (/(化学|モル|mol|中和|酸化|還元|反応式|\bph\b|電子配置|周期表|有機|無機|アルカン|アルケン)/.test(s)) return "chemistry";
  // 生物: 細胞, 遺伝, dna, rna, 進化, 生態, 体液
  if (/(生物|細胞|遺伝|dna|rna|染色体|進化|生態|代謝|光合成|タンパク質|アミノ酸)/.test(s)) return "biology";
  // 英語: english passage / vocab
  if (/(english|passage|paragraph|vocabulary|grammar|tense|preposition|sentence)/.test(s)) return "english";
  // 国語: 古文 / 漢文 / 評論
  if (/(国語|古文|漢文|現代文|評論|小説|和歌|俳句|文法事項|敬語)/.test(s)) return "japanese";
  // 社会: 歴史 / 地理 / 公民
  if (/(歴史|地理|公民|世界史|日本史|政治経済|倫理|地形|気候)/.test(s)) return "social";
  return "general";
}

const SUBJECT_RULES_JA: Record<Subject, string> = {
  math:
    "■ 数学の出題ノウハウ:\n" +
    "  - 数値選び: 答えが整数 or 既約分数 or 単純な平方根に着地するように係数を選ぶ (ぐちゃぐちゃの分数答えは禁止)\n" +
    "  - 関数 / グラフ問題は TikZ で軸 + 主要点 + ラベルを描く (\\begin{tikzpicture}[scale=0.9])\n" +
    "  - 図形問題: TikZ で正確に描き、頂点ラベル A, B, C を必ず付与\n" +
    "  - 確率は分母を 6 / 36 / 12 など割り切れる数に\n" +
    "  - 数列の漸化式は a_1 = 1〜3 の単純な初期値\n" +
    "  - ベクトルは内積・外積の計算結果が整数になる組\n" +
    "  - 解答にはまず答え → 続けて途中式を 3〜5 行で簡潔に (式変形は等号縦揃え)\n" +
    "  - 別解があれば「別解:」見出しで 1 つだけ添える",
  physics:
    "■ 物理の出題ノウハウ:\n" +
    "  - 必ず単位を明示 (\\,\\text{m/s}, \\,\\text{N}, \\,\\text{J} 等)\n" +
    "  - 数値は SI 単位 + 有効数字 2〜3 桁。重力加速度 g は 9.8 (or 10) で揃える\n" +
    "  - 力学は「運動方程式 → 仕事・エネルギー → 運動量」の階層を意識\n" +
    "  - 図示が必要な問題 (斜面・滑車・ばね・回路) は TikZ で必ず描く\n" +
    "  - 解答: 公式の選択理由 → 代入 → 単位込みの数値 (例: v = 9.8 \\times 2.0 = 19.6\\,\\text{m/s})\n" +
    "  - 記号は IUPAC 準拠 (m, v, a, F, E, p, Q, R 等)、ベクトルは \\vec{F}",
  chemistry:
    "■ 化学の出題ノウハウ:\n" +
    "  - mol 計算は分子量を整数 (H=1, C=12, N=14, O=16, Na=23, Cl=35.5) で\n" +
    "  - 反応式は係数を最簡比に。化学式は \\mathrm{H_2O} の形\n" +
    "  - pH 計算は 10^{-x} のきれいな指数で\n" +
    "  - 構造式は TikZ + chemfig 風に描き、結合線の角度を 30°/60° で統一\n" +
    "  - 解答: 反応式 → 量論計算 → 答え (有効数字 2 桁)",
  biology:
    "■ 生物の出題ノウハウ:\n" +
    "  - 用語は文部科学省検定教科書準拠 (新課程)\n" +
    "  - 図解が要る問題 (細胞構造・遺伝の交配・系統樹) は TikZ で\n" +
    "  - 計算問題 (遺伝率・浸透圧) は割り切れる数値に\n" +
    "  - 解答は段落形式で「結論 → 根拠 → 補足」",
  english:
    "■ English authoring rules:\n" +
    "  - Use natural, contemporary American English\n" +
    "  - For passages: 80–150 words at appropriate CEFR level (A2/B1/B2)\n" +
    "  - Multiple choice: 4 options, exactly 1 correct, 3 plausible distractors\n" +
    "  - Vocabulary: avoid obscure or archaic words\n" +
    "  - Answers: include the correct answer + a 1-line explanation in Japanese (if locale=ja)",
  japanese:
    "■ 国語の出題ノウハウ:\n" +
    "  - 出典は架空でよいが「〜による」と明記\n" +
    "  - 古文・漢文: 元の文体を保ち、品詞分解の解答を別ページで\n" +
    "  - 評論: 論旨を読み取らせる設問を 3 段階 (語句 → 内容把握 → 主張要約)\n" +
    "  - 解答は本文中の具体的な行 / 段落番号を引用",
  social:
    "■ 社会の出題ノウハウ:\n" +
    "  - 歴史: 年代を明記 (例: 1185 年)、複数の事象は時系列で並べる\n" +
    "  - 地理: 地図問題は TikZ で簡略に描く (緯度経度のラベル付き)\n" +
    "  - 公民: 法律・条約は正式名称 + 制定年\n" +
    "  - 解答: 用語 → 一行説明 → 関連事項",
  general:
    "■ 出題の一般ルール:\n" +
    "  - 数値や具体例は日本の教育課程に沿う\n" +
    "  - 解答は答え → 簡潔な解説 (2〜4 行)",
};

const SUBJECT_RULES_EN: Record<Subject, string> = {
  math:
    "■ Math authoring rules:\n" +
    "  - Pick coefficients so answers land on integers, simple fractions, or clean radicals (no ugly fractions)\n" +
    "  - Functions/graphs: draw axes + key points + labels with TikZ\n" +
    "  - Geometry: draw accurately with TikZ, label vertices A, B, C\n" +
    "  - Probability denominators: 6, 12, 36 (cleanly divisible)\n" +
    "  - Solutions: answer first, then 3–5 lines of working (align equals)",
  physics:
    "■ Physics authoring rules:\n" +
    "  - Always state units (\\,\\text{m/s}, \\,\\text{N}, \\,\\text{J})\n" +
    "  - SI units, 2–3 sig figs. Use g = 9.8 (or 10) consistently\n" +
    "  - Mechanics layered: Newton's laws → energy → momentum\n" +
    "  - Diagrams (incline, pulley, spring, circuit) drawn with TikZ\n" +
    "  - Solutions: formula selection rationale → substitution → numeric answer with units",
  chemistry:
    "■ Chemistry authoring rules:\n" +
    "  - Atomic masses as integers (H=1, C=12, N=14, O=16)\n" +
    "  - Balanced equations with smallest integer coefficients\n" +
    "  - pH in clean 10^{-x} powers\n" +
    "  - Structural formulas via TikZ-chemfig with 30°/60° bonds",
  biology:
    "■ Biology authoring rules:\n" +
    "  - Use modern textbook terminology\n" +
    "  - Diagrams (cell, pedigree, phylogeny) via TikZ\n" +
    "  - Numerical answers cleanly divisible",
  english:
    "■ English authoring rules:\n" +
    "  - Natural contemporary English\n" +
    "  - Passages: 80–150 words at A2/B1/B2 CEFR\n" +
    "  - 4-option MC: exactly 1 correct, 3 plausible distractors",
  japanese:
    "■ Japanese language authoring rules:\n" +
    "  - Cite sources as fictional with attribution\n" +
    "  - Three-tier questions: vocabulary → comprehension → main argument",
  social:
    "■ Social studies authoring rules:\n" +
    "  - History: dates explicit (e.g., 1185), events chronological\n" +
    "  - Geography: simple TikZ maps with labeled lat/long\n" +
    "  - Civics: full official names + enactment year",
  general:
    "■ General rules:\n" +
    "  - Numbers and examples appropriate to grade level\n" +
    "  - Solutions: answer → 2–4 line explanation",
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
 */
export function extractProblemsSection(latex: string | null | undefined): string {
  if (!latex) return "";
  const src = latex;
  const MAX = 2800;

  const sectionMatch = /\\section\*\{[^}]*?(?:問題|Problems?|Quiz|Exercises?)[^}]*?\}([\s\S]*?)(?:\\section\*\{[^}]*?(?:解答|Solutions?|Answers?)|\\newpage|$)/i.exec(src);
  if (sectionMatch && sectionMatch[1].trim().length > 60) {
    return sectionMatch[1].trim().slice(0, MAX);
  }

  const enumMatches = [...src.matchAll(/\\begin\{enumerate\}[\s\S]*?\\end\{enumerate\}/g)];
  if (enumMatches.length > 0) {
    const longest = enumMatches.reduce((a, b) => (a[0].length >= b[0].length ? a : b));
    return longest[0].slice(0, MAX);
  }

  const bodyMatch = /\\begin\{document\}([\s\S]*?)\\end\{document\}/.exec(src);
  if (bodyMatch && bodyMatch[1].trim().length > 60) {
    return bodyMatch[1].trim().slice(0, MAX);
  }

  return src.trim().slice(0, MAX);
}

// ─── プロンプト本体 ─────────────────────────────────────

const VARIANT_HEAD_JA =
`【類題生成依頼 — REM 出題ノウハウ駆動】
以下のベース問題と同じ出題傾向のまま、新しい類題セットを作成してください。
あなたは熟練した教材編集者です。問題作成のプロとして、以下のルールを厳守:

■ 共通ルール:
  - ベース問題をそのままコピーしない (写経禁止)。数値・係数・設定を変える
  - 解答は必ず付ける。「答え → 途中式 (3〜5 行) → 別解 (任意)」の階層
  - 数式は LaTeX、図は TikZ。生のテキストで数式を書かない
  - 既存ドキュメントのレイアウト・配色・テンプレ構造を完全に踏襲する
  - 出力は \\begin{document} ... \\end{document} の **本文だけ** (preamble は変更しない)

■ レイアウトルール (REM 標準):
  - 大問: \\section* で番号付け、または既存テンプレに従う
  - 小問: \\begin{enumerate}[(1)] の \\item
  - 各問末尾に配点 [XX点]。**配点は合計が 100 点ぴったりになるよう整数で揃える**
  - 各問の後に解答スペース (\\vspace{2.5cm} 程度)
  - \\newpage で問題ページと解答ページを分離
  - 解答ページは \\section*{解答・解説} の下に番号順
  - 問題間の区切りに {\\color{rulecolor}\\rule{\\linewidth}{0.2pt}} を入れる (テンプレに rulecolor が定義されている場合)
  - \\problem / \\answer 等の独自コマンドは使わず、enumerate のみ

■ 配色ルール (テンプレ尊重):
  - mainblue / accentcolor / rulecolor / lightbg 等の \\definecolor 定義は **絶対に上書きしない**
  - 既存の色トークンを使い回す`;

const VARIANT_HEAD_EN =
`[Variant generation request — REM authoring playbook]
You are an experienced curriculum editor. Generate a NEW variant set based on the seed below, preserving topic.

■ Common rules:
  - Do NOT copy the seed verbatim. Change numbers, coefficients, settings
  - Always include answers in 3-tier format: answer → 3–5 lines of working → alt-method (optional)
  - Math in LaTeX, figures in TikZ. Never raw text math
  - Match the existing document's layout, colors, and template structure exactly
  - Return ONLY the body inside \\begin{document}…\\end{document} (do not change preamble)

■ Layout rules (REM standard):
  - Section: \\section* numbered, or follow existing template
  - Sub-problem: \\begin{enumerate}[(1)] with \\item
  - Each problem ends with [XX pts]. Scores MUST sum to exactly 100, integer values
  - Answer space after each: \\vspace{2.5cm}
  - Separate problem and answer pages with \\newpage
  - Answer page: \\section*{Solutions} numbered
  - Problem separator: {\\color{rulecolor}\\rule{\\linewidth}{0.2pt}} if template defines rulecolor
  - Use only enumerate, no custom \\problem / \\answer commands

■ Color rules (respect template):
  - NEVER override mainblue / accentcolor / rulecolor / lightbg \\definecolor entries
  - Reuse existing color tokens`;

const ENHANCE_HEAD_JA =
`【出題ノウハウ強化】
以下のラフな依頼を、教材として印刷・配布できる完成度の問題セットに肉付けしてください。

■ 必須要件:
  - 各問末尾に配点 [XX点]、合計 100 点ぴったり
  - 大問: \\section* (番号付け or 既存テンプレ準拠)
  - 小問: \\begin{enumerate}[(1)] の \\item
  - 各問の後に解答スペース (\\vspace{2.5cm})
  - \\newpage で問題と解答を分離
  - 解答ページ: \\section*{解答・解説}、番号順、途中式付き
  - 数式は LaTeX、図は TikZ
  - レイアウト: \\begin{enumerate}[leftmargin=*]
  - 配色 (mainblue / accentcolor / rulecolor) の定義は既存テンプレを尊重し、絶対に上書きしない
  - \\problem / \\answer の独自コマンドは禁止、enumerate のみ

■ 出題の質:
  - 数値選び: 答えが整数 or 既約分数 or 単純な根号に着地するように
  - 解答: 答え → 簡潔な途中式 → 別解 (任意)`;

const ENHANCE_HEAD_EN =
`[Prompt boost: pedagogical structure]
Expand the rough request into a print-ready, classroom-quality problem set.

■ Required structure:
  - Score badge [XX pts] at end of each, totaling exactly 100
  - Section: \\section* (numbered or per existing template)
  - Sub-problem: \\begin{enumerate}[(1)]
  - Answer space \\vspace{2.5cm} after each
  - \\newpage separates problem and answer pages
  - Solutions page: \\section*{Solutions}, numbered, with working
  - Math in LaTeX, figures in TikZ
  - Layout: \\begin{enumerate}[leftmargin=*]
  - Respect mainblue / accentcolor / rulecolor template colors; do NOT override
  - No custom \\problem / \\answer commands

■ Authoring quality:
  - Pick coefficients so answers land cleanly (integers, simple fractions, clean radicals)
  - Solutions: answer → concise working → optional alt-method`;

/**
 * 「もう1枚 類題」用プロンプト builder。
 *  - seedLatex: 現在の doc.latex (extractProblemsSection で問題本体に絞られる)
 *  - locale:    UI ロケール
 *  - style:     "same" | "harder" | "easier" | "format" | "more"  (デフォルト same)
 *  - count:     目標問題数 (任意。AI に "目安" として伝える)
 *
 * 注意: ユーザの自由入力 (hint) は **意図的に受け付けない**。REM ノウハウだけで完結させる。
 */
export function buildVariantPrompt(
  seedLatex: string | null | undefined,
  locale: RemLocale,
  style: VariantStyle = "same",
  count?: number,
): string {
  const head = locale === "en" ? VARIANT_HEAD_EN : VARIANT_HEAD_JA;
  const styleSpec = VARIANT_STYLES[style];

  // 教科推定 + 教科別ルール
  const seed = extractProblemsSection(seedLatex);
  const subject = detectSubject(seed);
  const subjectRules = (locale === "en" ? SUBJECT_RULES_EN : SUBJECT_RULES_JA)[subject];

  const styleLabel = locale === "en" ? "Style" : "スタイル";
  const styleHead =
    `\n\n[${styleLabel}: ${locale === "en" ? styleSpec.enTitle : styleSpec.jaTitle}]\n` +
    (locale === "en" ? styleSpec.enInstruction : styleSpec.jaInstruction);

  const seedLabel = locale === "en"
    ? "--- Seed problem (extracted from current document) ---"
    : "--- ベース問題 (現在のドキュメントから抽出) ---";
  const seedEnd = locale === "en" ? "--- End of seed ---" : "--- ベース問題ここまで ---";

  const countLabel = count
    ? (locale === "en"
        ? `\n\n[Target count: ~${count} problems. Adjust score per problem so total = 100.]`
        : `\n\n[目標問題数: ${count} 問前後。配点は合計が 100 点ぴったりになるよう調整。]`)
    : "";

  const parts: string[] = [head, styleHead, "", subjectRules, countLabel];
  if (seed) {
    parts.push("", seedLabel, seed, seedEnd);
  }
  return parts.filter(Boolean).join("\n");
}

/**
 * 「✨ 強化トグル ON」での送信時に使うプロンプト builder。
 *  - rawInput: ユーザの素の入力 (「二次方程式」など短くても OK)
 *  - locale:   i18n
 *
 * Eddivom の既存テンプレ駆動方針 (CLAUDE memory: テンプレ + AI が枠内で書く) に
 * 沿う形で、AI に「教材として整った構造」を要求する。
 */
export function buildEnhancePrompt(rawInput: string, locale: RemLocale): string {
  const head = locale === "en" ? ENHANCE_HEAD_EN : ENHANCE_HEAD_JA;
  const userLabel = locale === "en" ? "User request:" : "ユーザの依頼:";
  return [head, "", userLabel, rawInput.trim()].join("\n");
}
