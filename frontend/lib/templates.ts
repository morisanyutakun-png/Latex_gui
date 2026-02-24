/**
 * Pre-filled template definitions
 * Each template has meaningful sample content demonstrating LaTeX capabilities
 */
import { Block, DocumentModel, DEFAULT_SETTINGS } from "./types";
import { v4 as uuidv4 } from "uuid";

function b(content: Block["content"], style?: Partial<Block["style"]>): Block {
  return { id: uuidv4(), content, style: { textAlign: "left", fontSize: 11, fontFamily: "sans", ...style } };
}

// ──────────────────────────────────────────
// 1) レポート / Report
// ──────────────────────────────────────────
function reportBlocks(): Block[] {
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
// 2) お知らせ / Announcement
// ──────────────────────────────────────────
function announcementBlocks(): Block[] {
  return [
    b({ type: "heading", text: "お知らせ", level: 1 }, { textAlign: "center", fontSize: 22, fontFamily: "serif" }),
    b({ type: "paragraph", text: "2024年 4月 1日" }, { textAlign: "right" }),
    b({ type: "paragraph", text: "関係者各位" }),
    b({ type: "divider", style: "solid" }),
    b({ type: "heading", text: "○○研修会の開催について", level: 2 }, { textAlign: "center", fontSize: 14 }),
    b({ type: "paragraph", text: "平素より大変お世話になっております。\nこのたび、下記の通り研修会を開催いたしますので、ご案内申し上げます。万障お繰り合わせの上、ご参加くださいますようお願い申し上げます。" }),
    b({ type: "heading", text: "詳細", level: 3 }, { fontSize: 12 }),
    b({ type: "table", headers: ["項目", "内容"], rows: [["日時", "2024年5月15日（水）14:00〜16:00"], ["場所", "本館3階 大会議室"], ["対象", "全部署のリーダー以上"], ["持ち物", "筆記用具、配布資料"]] }),
    b({ type: "divider", style: "dashed" }),
    b({ type: "paragraph", text: "ご不明な点がございましたら、総務部（内線: 1234）までお問い合わせください。" }),
    b({ type: "paragraph", text: "以上" }, { textAlign: "right" }),
  ];
}

// ──────────────────────────────────────────
// 3) ワークシート / Worksheet
// ──────────────────────────────────────────
function worksheetBlocks(): Block[] {
  return [
    b({ type: "heading", text: "数学演習 第1回", level: 1 }, { textAlign: "center", fontSize: 18, fontFamily: "serif" }),
    b({ type: "paragraph", text: "科目: 微分積分学　　クラス: ________　　名前: ________________" }),
    b({ type: "divider", style: "solid" }),
    b({ type: "heading", text: "問題 1", level: 2 }, { fontSize: 13 }),
    b({ type: "paragraph", text: "次の関数を微分しなさい。" }),
    b({ type: "math", latex: "f(x) = x^3 + 3x^2 - 2x + 1", displayMode: true }),
    b({ type: "heading", text: "問題 2", level: 2 }, { fontSize: 13 }),
    b({ type: "paragraph", text: "以下の定積分を計算しなさい。" }),
    b({ type: "math", latex: "\\int_0^{\\pi} \\sin(x) \\, dx", displayMode: true }),
    b({ type: "heading", text: "問題 3", level: 2 }, { fontSize: 13 }),
    b({ type: "paragraph", text: "以下の連立方程式を解きなさい。" }),
    b({ type: "math", latex: "\\begin{cases} 2x + y = 5 \\\\ x - y = 1 \\end{cases}", displayMode: true }),
    b({ type: "heading", text: "問題 4", level: 2 }, { fontSize: 13 }),
    b({ type: "paragraph", text: "以下の行列の行列式を求めなさい。" }),
    b({ type: "math", latex: "A = \\begin{pmatrix} 1 & 2 & 3 \\\\ 4 & 5 & 6 \\\\ 7 & 8 & 9 \\end{pmatrix}", displayMode: true }),
    b({ type: "divider", style: "dashed" }),
    b({ type: "paragraph", text: "（解答欄は裏面を使用すること）" }, { textAlign: "center" }),
  ];
}

// ──────────────────────────────────────────
// 4) 論文 / Academic Paper
// ──────────────────────────────────────────
function academicBlocks(): Block[] {
  return [
    b({ type: "heading", text: "量子力学における確率振幅の解釈について", level: 1 }, { textAlign: "center", fontSize: 17, fontFamily: "serif" }),
    b({ type: "paragraph", text: "研究 太郎¹　　共著 花子²" }, { textAlign: "center" }),
    b({ type: "paragraph", text: "¹東京大学理学部　²京都大学工学部" }, { textAlign: "center", fontSize: 9 }),
    b({ type: "divider", style: "solid" }),
    b({ type: "heading", text: "概要", level: 2 }, { fontSize: 12, bold: true }),
    b({ type: "paragraph", text: "量子力学において、波動関数の確率的解釈は物理学の根本的理解に関わる重要な問題である。本論文では、ボルンの確率解釈を再考し、現代的な測定理論との関係を議論する。" }, { fontSize: 10 }),
    b({ type: "heading", text: "1. はじめに", level: 2 }, { fontSize: 13 }),
    b({ type: "paragraph", text: "シュレーディンガー方程式は量子力学の基本方程式であり、以下のように記述される。" }),
    b({ type: "math", latex: "i\\hbar \\frac{\\partial}{\\partial t} \\Psi(\\mathbf{r}, t) = \\hat{H} \\Psi(\\mathbf{r}, t)", displayMode: true }),
    b({ type: "paragraph", text: "ここで、ℏ はディラック定数、Ĥ はハミルトニアン演算子、Ψ は波動関数である。" }),
    b({ type: "heading", text: "2. 理論的考察", level: 2 }, { fontSize: 13 }),
    b({ type: "paragraph", text: "確率密度は波動関数の絶対値の二乗で与えられる。" }),
    b({ type: "math", latex: "\\rho(\\mathbf{r}, t) = |\\Psi(\\mathbf{r}, t)|^2", displayMode: true }),
    b({ type: "paragraph", text: "この解釈に基づき、規格化条件は以下のようになる。" }),
    b({ type: "math", latex: "\\int_{-\\infty}^{\\infty} |\\Psi(\\mathbf{r}, t)|^2 \\, d^3\\mathbf{r} = 1", displayMode: true }),
    b({ type: "heading", text: "3. 結論", level: 2 }, { fontSize: 13 }),
    b({ type: "paragraph", text: "本研究により、確率振幅のコペンハーゲン解釈が測定問題において依然として有効であることが示された。今後は多世界解釈との比較を行う予定である。" }),
  ];
}

// ──────────────────────────────────────────
// 5) 履歴書 / Resume
// ──────────────────────────────────────────
function resumeBlocks(): Block[] {
  return [
    b({ type: "heading", text: "山田 太郎", level: 1 }, { textAlign: "center", fontSize: 20, fontFamily: "serif" }),
    b({ type: "paragraph", text: "東京都渋谷区○○ 1-2-3　｜　090-1234-5678　｜　taro@example.com" }, { textAlign: "center", fontSize: 9 }),
    b({ type: "divider", style: "solid" }),
    b({ type: "heading", text: "学歴", level: 2 }, { fontSize: 13 }),
    b({ type: "list", style: "bullet", items: [
      "2020年3月　○○大学 工学部 情報工学科 卒業",
      "2022年3月　○○大学大学院 工学研究科 修了",
    ] }),
    b({ type: "heading", text: "職歴", level: 2 }, { fontSize: 13 }),
    b({ type: "list", style: "bullet", items: [
      "2022年4月　株式会社○○ ソフトウェアエンジニア",
      "2024年1月　株式会社△△ シニアエンジニア（現職）",
    ] }),
    b({ type: "heading", text: "スキル・資格", level: 2 }, { fontSize: 13 }),
    b({ type: "table", headers: ["カテゴリ", "詳細"], rows: [
      ["言語", "Python, TypeScript, Rust, Go"],
      ["フレームワーク", "React, Next.js, FastAPI, Django"],
      ["インフラ", "AWS, Docker, Kubernetes, Terraform"],
      ["資格", "応用情報技術者、TOEIC 900"],
    ] }),
    b({ type: "heading", text: "自己PR", level: 2 }, { fontSize: 13 }),
    b({ type: "paragraph", text: "私はフルスタックエンジニアとして、フロントエンドからインフラまで幅広い技術領域で開発経験を積んでまいりました。特にDXプロジェクトのリードや技術選定において、ビジネス要件と技術的実現性のバランスを取る力を強みとしています。" }),
  ];
}

// ──────────────────────────────────────────
// 6) 白紙 / Blank
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
  blocks: () => Block[];
}

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: "report",
    name: "レポート",
    description: "構造化されたレポート・報告書",
    gradient: "from-blue-500 via-blue-400 to-cyan-400",
    accentColor: "bg-blue-500",
    icon: "📊",
    blocks: reportBlocks,
  },
  {
    id: "announcement",
    name: "お知らせ",
    description: "フォーマルな通知・案内文書",
    gradient: "from-emerald-500 via-green-400 to-teal-400",
    accentColor: "bg-emerald-500",
    icon: "📢",
    blocks: announcementBlocks,
  },
  {
    id: "worksheet",
    name: "ワークシート",
    description: "数式入りの演習・問題集",
    gradient: "from-violet-500 via-purple-400 to-fuchsia-400",
    accentColor: "bg-violet-500",
    icon: "📝",
    blocks: worksheetBlocks,
  },
  {
    id: "academic",
    name: "論文",
    description: "アカデミックな研究論文",
    gradient: "from-amber-500 via-orange-400 to-yellow-400",
    accentColor: "bg-amber-500",
    icon: "🎓",
    blocks: academicBlocks,
  },
  {
    id: "resume",
    name: "履歴書",
    description: "職務経歴書・CV",
    gradient: "from-pink-500 via-rose-400 to-red-400",
    accentColor: "bg-pink-500",
    icon: "👤",
    blocks: resumeBlocks,
  },
  {
    id: "blank",
    name: "白紙",
    description: "自由に始める白紙ドキュメント",
    gradient: "from-slate-400 via-gray-300 to-slate-300",
    accentColor: "bg-slate-400",
    icon: "📄",
    blocks: blankBlocks,
  },
];

export function createFromTemplate(templateId: string): DocumentModel {
  const tmpl = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[TEMPLATES.length - 1];
  const blocks = tmpl.blocks();
  return {
    template: tmpl.id,
    metadata: { title: tmpl.name === "白紙" ? "無題のドキュメント" : tmpl.name, author: "" },
    settings: { ...DEFAULT_SETTINGS },
    blocks,
  };
}
