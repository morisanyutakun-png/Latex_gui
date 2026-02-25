/**
 * Pre-filled template definitions
 * Each template maps to a unique LaTeX document class — no duplicates.
 */
import { Block, DocumentModel, DEFAULT_SETTINGS, LaTeXDocumentClass } from "./types";
import { v4 as uuidv4 } from "uuid";

function b(content: Block["content"], style?: Partial<Block["style"]>): Block {
  return { id: uuidv4(), content, style: { textAlign: "left", fontSize: 11, fontFamily: "sans", ...style } };
}

// ──────────────────────────────────────────
// article — 一般レポート・論文
// ──────────────────────────────────────────
function articleBlocks(): Block[] {
  return [
    b({ type: "heading", text: "レポートタイトル", level: 1 }, { textAlign: "center", fontSize: 20, fontFamily: "serif" }),
    b({ type: "paragraph", text: "著者名　｜　2024年 4月 1日" }, { textAlign: "center", fontSize: 11 }),
    b({ type: "divider", style: "solid" }),
    b({ type: "heading", text: "1. はじめに", level: 2 }, { fontSize: 14 }),
    b({ type: "paragraph", text: "本レポートでは、○○について調査した結果を報告する。研究の背景として、近年この分野では以下の発展が見られる。" }),
    b({ type: "heading", text: "2. 理論的背景", level: 2 }, { fontSize: 14 }),
    b({ type: "paragraph", text: "本研究の理論的基盤として、オイラーの公式を紹介する。この公式は数学で最も美しいとされる等式である。" }),
    b({ type: "math", latex: "e^{i\\pi} + 1 = 0", displayMode: true }),
    b({ type: "paragraph", text: "また、二次方程式の解の公式は以下のように導かれる。" }),
    b({ type: "math", latex: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}", displayMode: true }),
    b({ type: "heading", text: "3. 実験結果", level: 2 }, { fontSize: 14 }),
    b({ type: "paragraph", text: "実験の結果を以下の表にまとめる。" }),
    b({ type: "table", headers: ["試行", "測定値", "誤差"], rows: [["1", "3.14", "±0.02"], ["2", "3.16", "±0.01"], ["3", "3.15", "±0.01"]], caption: "表1: 実験結果" }),
    b({ type: "heading", text: "4. 考察", level: 2 }, { fontSize: 14 }),
    b({ type: "paragraph", text: "実験結果から、以下の点が考察できる。" }),
    b({ type: "list", style: "bullet", items: ["測定値はπの近似値として妥当な範囲内である", "試行回数を増やすことで精度の向上が期待できる", "環境温度の影響を今後検討する必要がある"] }),
    b({ type: "heading", text: "5. 結論", level: 2 }, { fontSize: 14 }),
    b({ type: "paragraph", text: "以上の実験及び考察から、本研究の目的は概ね達成されたと考えられる。今後の課題として、サンプルサイズの拡大と条件の最適化が挙げられる。" }),
  ];
}

// ──────────────────────────────────────────
// report — 技術報告書（章立て構造）
// ──────────────────────────────────────────
function reportBlocks(): Block[] {
  return [
    b({ type: "heading", text: "技術報告書", level: 1 }, { textAlign: "center", fontSize: 20, fontFamily: "serif" }),
    b({ type: "paragraph", text: "プロジェクト名: ○○システム　｜　バージョン 1.0　｜　2024年" }, { textAlign: "center", fontSize: 9 }),
    b({ type: "divider", style: "solid" }),
    b({ type: "heading", text: "第1章　システム概要", level: 2 }, { fontSize: 15 }),
    b({ type: "paragraph", text: "本文書は○○システムの技術仕様を定義するものである。report クラスでは \\chapter が使えるため、大規模な文書に適している。" }),
    b({ type: "heading", text: "1.1 構成図", level: 3 }, { fontSize: 13 }),
    b({ type: "diagram", code: `[node distance=2.5cm,
  server/.style={rectangle, draw, fill=blue!15, minimum width=2cm, minimum height=1cm, text centered, font=\\small},
  client/.style={rectangle, rounded corners, draw, fill=green!15, minimum width=1.5cm, minimum height=0.8cm, text centered, font=\\small},
  db/.style={cylinder, draw, fill=orange!15, minimum width=1.5cm, minimum height=1cm, text centered, font=\\small, shape border rotate=90, aspect=0.25}]

\\node[client] (web) {Web App};
\\node[server] (api) [right of=web] {API Server};
\\node[db] (db) [right of=api] {Database};

\\draw[thick,->] (web) -- node[above,font=\\tiny]{REST} (api);
\\draw[thick,->] (api) -- node[above,font=\\tiny]{SQL} (db);`, diagramType: "block", caption: "図1.1: システム構成図" }),
    b({ type: "heading", text: "第2章　API仕様", level: 2 }, { fontSize: 15 }),
    b({ type: "table", headers: ["エンドポイント", "メソッド", "説明"], rows: [
      ["/api/users", "GET", "ユーザー一覧取得"],
      ["/api/users/:id", "GET", "ユーザー詳細取得"],
      ["/api/users", "POST", "ユーザー新規作成"],
      ["/api/users/:id", "PUT", "ユーザー更新"],
    ] }),
    b({ type: "heading", text: "第3章　データモデル", level: 2 }, { fontSize: 15 }),
    b({ type: "code", language: "sql", code: `CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);` }),
    b({ type: "heading", text: "第4章　数理モデル", level: 2 }, { fontSize: 15 }),
    b({ type: "paragraph", text: "システムの応答特性は以下の伝達関数でモデル化される。" }),
    b({ type: "math", latex: "H(s) = \\frac{\\omega_n^2}{s^2 + 2\\zeta\\omega_n s + \\omega_n^2}", displayMode: true }),
  ];
}

// ──────────────────────────────────────────
// book — 書籍・教科書
// ──────────────────────────────────────────
function bookBlocks(): Block[] {
  return [
    b({ type: "heading", text: "理工学の基礎", level: 1 }, { textAlign: "center", fontSize: 22, fontFamily: "serif" }),
    b({ type: "paragraph", text: "著者名" }, { textAlign: "center", fontSize: 12 }),
    b({ type: "paragraph", text: "20XX年版" }, { textAlign: "center", fontSize: 10 }),
    b({ type: "divider", style: "solid" }),
    b({ type: "heading", text: "第I部　解析学", level: 2 }, { fontSize: 16 }),
    b({ type: "heading", text: "第1章　微分積分の基礎", level: 2 }, { fontSize: 14 }),
    b({ type: "paragraph", text: "微分積分学は自然科学の言語であり、物理学・工学のあらゆる場面で用いられる。" }),
    b({ type: "heading", text: "1.1 テイラー展開", level: 3 }, { fontSize: 12 }),
    b({ type: "quote", text: "関数 f(x) が十分滑らかであるとき、以下の展開が可能である。" }),
    b({ type: "math", latex: "f(x) = \\sum_{k=0}^{\\infty} \\frac{f^{(k)}(a)}{k!}(x-a)^k", displayMode: true }),
    b({ type: "heading", text: "1.2 微分積分学の基本定理", level: 3 }, { fontSize: 12 }),
    b({ type: "math", latex: "\\frac{d}{dx} \\int_a^x f(t) \\, dt = f(x)", displayMode: true }),
    b({ type: "heading", text: "第2章　線形代数", level: 2 }, { fontSize: 14 }),
    b({ type: "paragraph", text: "固有値問題は振動解析・量子力学など多くの応用を持つ。" }),
    b({ type: "math", latex: "A\\mathbf{v} = \\lambda\\mathbf{v} \\iff \\det(A - \\lambda I) = 0", displayMode: true }),
    b({ type: "paragraph", text: "行列の対角化:" }),
    b({ type: "math", latex: "A = PDP^{-1}, \\quad D = \\begin{pmatrix} \\lambda_1 & & \\\\ & \\ddots & \\\\ & & \\lambda_n \\end{pmatrix}", displayMode: true }),
    b({ type: "heading", text: "第II部　物理学", level: 2 }, { fontSize: 16 }),
    b({ type: "heading", text: "第3章　量子力学入門", level: 2 }, { fontSize: 14 }),
    b({ type: "paragraph", text: "シュレーディンガー方程式は量子力学の基本方程式である。" }),
    b({ type: "math", latex: "i\\hbar \\frac{\\partial}{\\partial t} \\Psi(\\mathbf{r}, t) = \\hat{H} \\Psi(\\mathbf{r}, t)", displayMode: true }),
  ];
}

// ──────────────────────────────────────────
// beamer — プレゼンテーション
// ──────────────────────────────────────────
function beamerBlocks(): Block[] {
  return [
    b({ type: "heading", text: "研究発表タイトル", level: 1 }, { textAlign: "center", fontSize: 22, fontFamily: "serif" }),
    b({ type: "paragraph", text: "発表者名　—　所属機関" }, { textAlign: "center", fontSize: 11 }),
    b({ type: "paragraph", text: "2024年 学会発表" }, { textAlign: "center", fontSize: 9 }),
    b({ type: "divider", style: "solid" }),
    b({ type: "heading", text: "背景と目的", level: 2 }, { fontSize: 16 }),
    b({ type: "list", style: "bullet", items: [
      "本研究の動機: ○○問題の解決",
      "従来手法の課題: 計算コストが高い",
      "本研究の貢献: 新しいアプローチの提案",
    ] }),
    b({ type: "divider", style: "dashed" }),
    b({ type: "heading", text: "提案手法", level: 2 }, { fontSize: 16 }),
    b({ type: "paragraph", text: "提案するアルゴリズムの目的関数は以下の通りである。" }),
    b({ type: "math", latex: "\\min_{\\theta} \\mathcal{L}(\\theta) = \\frac{1}{N} \\sum_{i=1}^{N} \\ell(f_\\theta(x_i), y_i) + \\lambda \\|\\theta\\|^2", displayMode: true }),
    b({ type: "divider", style: "dashed" }),
    b({ type: "heading", text: "実験結果", level: 2 }, { fontSize: 16 }),
    b({ type: "table", headers: ["手法", "精度 [%]", "計算時間 [s]"], rows: [
      ["従来手法A", "85.2", "120"],
      ["従来手法B", "87.1", "95"],
      ["提案手法", "91.8", "42"],
    ], caption: "表: 手法の比較" }),
    b({ type: "divider", style: "dashed" }),
    b({ type: "heading", text: "結論と今後の展望", level: 2 }, { fontSize: 16 }),
    b({ type: "list", style: "bullet", items: [
      "提案手法は従来手法に比べ精度・速度ともに優れる",
      "今後はより大規模なデータセットでの検証を行う",
      "ソースコードは GitHub で公開予定",
    ] }),
  ];
}

// ──────────────────────────────────────────
// letter — 手紙・通信文
// ──────────────────────────────────────────
function letterBlocks(): Block[] {
  return [
    b({ type: "paragraph", text: "2024年 4月 1日" }, { textAlign: "right" }),
    b({ type: "paragraph", text: "○○株式会社\n代表取締役 ○○ ○○ 様" }),
    b({ type: "divider", style: "solid" }),
    b({ type: "heading", text: "○○のご案内", level: 1 }, { textAlign: "center", fontSize: 16, fontFamily: "serif" }),
    b({ type: "paragraph", text: "拝啓　時下ますますご清祥のこととお慶び申し上げます。平素は格別のご高配を賜り、厚く御礼申し上げます。" }),
    b({ type: "paragraph", text: "さて、このたび下記の通りご案内申し上げます。ご多忙のところ恐縮ではございますが、万障お繰り合わせの上、ご出席くださいますようお願い申し上げます。" }),
    b({ type: "heading", text: "記", level: 2 }, { textAlign: "center", fontSize: 13 }),
    b({ type: "table", headers: ["項目", "内容"], rows: [
      ["日時", "2024年5月15日（水）14:00〜16:00"],
      ["場所", "本館3階 大会議室"],
      ["議題", "○○プロジェクトの進捗報告"],
      ["持ち物", "筆記用具、配布資料"],
    ] }),
    b({ type: "divider", style: "dashed" }),
    b({ type: "paragraph", text: "ご不明な点がございましたら、担当（内線: 1234）までお問い合わせください。" }),
    b({ type: "paragraph", text: "敬具" }, { textAlign: "right" }),
    b({ type: "paragraph", text: "△△株式会社\n総務部　担当 △△" }, { textAlign: "right" }),
  ];
}

// ──────────────────────────────────────────
// blank — 白紙
// ──────────────────────────────────────────
function blankBlocks(): Block[] {
  return [
    b({ type: "heading", text: "", level: 1 }, { textAlign: "center", fontSize: 18, fontFamily: "serif" }),
    b({ type: "paragraph", text: "" }),
  ];
}

// ──────────────────────────────────────────
// Template Registry
// ──────────────────────────────────────────

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  gradient: string;         // CSS gradient for card
  accentColor: string;
  icon: string;
  documentClass: LaTeXDocumentClass;
  blocks: () => Block[];
}

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: "article",
    name: "レポート・論文",
    description: "一般的なレポート・短い論文に。最もよく使われるクラス",
    gradient: "from-blue-500 via-blue-400 to-cyan-400",
    accentColor: "bg-blue-500",
    icon: "📄",
    documentClass: "article",
    blocks: articleBlocks,
  },
  {
    id: "report",
    name: "技術報告書",
    description: "章立て構造の長い報告書・仕様書に",
    gradient: "from-slate-500 via-gray-400 to-zinc-400",
    accentColor: "bg-slate-500",
    icon: "📋",
    documentClass: "report",
    blocks: reportBlocks,
  },
  {
    id: "book",
    name: "書籍・教科書",
    description: "複数章・部構成の書籍に。部・章構成対応",
    gradient: "from-amber-500 via-orange-400 to-yellow-400",
    accentColor: "bg-amber-500",
    icon: "📚",
    documentClass: "book",
    blocks: bookBlocks,
  },
  {
    id: "beamer",
    name: "プレゼンテーション",
    description: "学会発表・講義スライドの作成に",
    gradient: "from-violet-500 via-purple-400 to-fuchsia-400",
    accentColor: "bg-violet-500",
    icon: "🎬",
    documentClass: "beamer",
    blocks: beamerBlocks,
  },
  {
    id: "letter",
    name: "手紙・通信文",
    description: "フォーマルな手紙・案内状に",
    gradient: "from-emerald-500 via-green-400 to-teal-400",
    accentColor: "bg-emerald-500",
    icon: "✉️",
    documentClass: "letter",
    blocks: letterBlocks,
  },
  {
    id: "blank",
    name: "白紙",
    description: "自由に始める白紙ドキュメント",
    gradient: "from-slate-400 via-gray-300 to-slate-300",
    accentColor: "bg-slate-400",
    icon: "📝",
    documentClass: "article",
    blocks: blankBlocks,
  },
];

/**
 * Strip block content to keep only structure (block types) but empty data.
 * When blank=true, everything including heading text is cleared.
 * Only divider blocks are kept as-is.
 */
function stripBlockContent(block: Block): Block {
  const c = block.content;
  switch (c.type) {
    case "heading":
      return { ...block, content: { ...c, text: "" } };
    case "paragraph":
      return { ...block, content: { ...c, text: "" } };
    case "math":
      return { ...block, content: { ...c, latex: "" } };
    case "list":
      return { ...block, content: { ...c, items: [""] } };
    case "table":
      return { ...block, content: { ...c, headers: c.headers.map(() => ""), rows: [c.headers.map(() => "")], caption: c.caption !== undefined ? "" : undefined } };
    case "code":
      return { ...block, content: { ...c, code: "", language: "" } };
    case "quote":
      return { ...block, content: { ...c, text: "", attribution: "" } };
    case "circuit":
      return { ...block, content: { ...c, code: "", caption: "" } };
    case "diagram":
      return { ...block, content: { ...c, code: "", caption: "" } };
    case "chemistry":
      return { ...block, content: { ...c, formula: "", caption: undefined } };
    case "chart":
      return { ...block, content: { ...c, code: "", caption: "" } };
    default:
      return block; // image, divider — keep as-is
  }
}

export function createFromTemplate(templateId: string, blank = false): DocumentModel {
  const tmpl = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[TEMPLATES.length - 1];
  const blocks = tmpl.blocks();
  return {
    template: tmpl.id,
    metadata: { title: tmpl.name === "白紙" ? "無題のドキュメント" : tmpl.name, author: "" },
    settings: { ...DEFAULT_SETTINGS, documentClass: tmpl.documentClass },
    blocks: blank ? blocks.map(stripBlockContent) : blocks,
  };
}
