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
// 7) 電子回路レポート / Circuit Report
// ──────────────────────────────────────────
function circuitBlocks(): Block[] {
  return [
    b({ type: "heading", text: "電子回路 実験レポート", level: 1 }, { textAlign: "center", fontSize: 18, fontFamily: "serif" }),
    b({ type: "paragraph", text: "実験者名　｜　2024年 5月 15日" }, { textAlign: "center", fontSize: 11 }),
    b({ type: "divider", style: "solid" }),
    b({ type: "heading", text: "1. 目的", level: 2 }, { fontSize: 14 }),
    b({ type: "paragraph", text: "RC回路のローパスフィルタ特性を実験的に確認し、理論値と比較する。" }),
    b({ type: "heading", text: "2. 理論", level: 2 }, { fontSize: 14 }),
    b({ type: "paragraph", text: "RCローパスフィルタの伝達関数は以下で表される。" }),
    b({ type: "math", latex: "H(s) = \\frac{1}{1 + sRC} = \\frac{1}{1 + j\\omega RC}", displayMode: true }),
    b({ type: "paragraph", text: "カットオフ周波数は次式で求められる。" }),
    b({ type: "math", latex: "f_c = \\frac{1}{2\\pi RC}", displayMode: true }),
    b({ type: "heading", text: "3. 回路図", level: 2 }, { fontSize: 14 }),
    b({ type: "circuit", code: `\\draw (0,0) to[V, v=$V_{in}$] (0,3)
  to[R, l=$R$] (3,3)
  to[C, l=$C$] (3,0) -- (0,0);
\\draw (3,3) to[short, -o] (4.5,3) node[right]{$V_{out}$};
\\draw (3,0) to[short, -o] (4.5,0) node[right]{GND};`, caption: "図1: RCローパスフィルタ回路" }),
    b({ type: "heading", text: "4. 実験結果", level: 2 }, { fontSize: 14 }),
    b({ type: "table", headers: ["周波数 [Hz]", "|H(jω)| [dB]", "位相 [°]"], rows: [["100", "-0.1", "-5.7"], ["1k", "-3.0", "-45.0"], ["10k", "-20.1", "-84.3"]], caption: "表1: 周波数応答測定結果" }),
    b({ type: "heading", text: "5. 考察", level: 2 }, { fontSize: 14 }),
    b({ type: "paragraph", text: "測定結果は理論値とよく一致した。カットオフ周波数付近でゲインが-3dBとなることが確認された。" }),
  ];
}

// ──────────────────────────────────────────
// 8) 制御工学 / Control Systems
// ──────────────────────────────────────────
function controlBlocks(): Block[] {
  return [
    b({ type: "heading", text: "制御工学レポート: フィードバック制御系の設計", level: 1 }, { textAlign: "center", fontSize: 17, fontFamily: "serif" }),
    b({ type: "paragraph", text: "制御工学研究室　｜　2024年 6月" }, { textAlign: "center", fontSize: 10 }),
    b({ type: "divider", style: "solid" }),
    b({ type: "heading", text: "1. システムモデル", level: 2 }, { fontSize: 14 }),
    b({ type: "paragraph", text: "対象プラントの伝達関数を以下に示す。" }),
    b({ type: "math", latex: "G_p(s) = \\frac{\\omega_n^2}{s^2 + 2\\zeta\\omega_n s + \\omega_n^2}", displayMode: true }),
    b({ type: "heading", text: "2. ブロック線図", level: 2 }, { fontSize: 14 }),
    b({ type: "diagram", code: `[auto, node distance=2cm, >=latex',
  block/.style={draw, fill=blue!10, rectangle, minimum height=2em, minimum width=4em},
  sum/.style={draw, fill=blue!10, circle, node distance=1.5cm},
  input/.style={coordinate},
  output/.style={coordinate}]

\\node [input] (input) {};
\\node [sum, right of=input] (sum) {$\\Sigma$};
\\node [block, right of=sum, node distance=2.5cm] (controller) {$G_c(s)$};
\\node [block, right of=controller, node distance=3cm] (plant) {$G_p(s)$};
\\node [output, right of=plant, node distance=2cm] (output) {};
\\node [block, below of=controller, node distance=1.5cm] (sensor) {$H(s)$};

\\draw [->] (input) -- node {$R(s)$} (sum);
\\draw [->] (sum) -- node {$E(s)$} (controller);
\\draw [->] (controller) -- node {$U(s)$} (plant);
\\draw [->] (plant) -- node [name=y] {$Y(s)$}(output);
\\draw [->] (y) |- (sensor);
\\draw [->] (sensor) -| node[pos=0.99] {$-$} (sum);`, diagramType: "block", caption: "図1: フィードバック制御系ブロック線図" }),
    b({ type: "heading", text: "3. 状態空間表現", level: 2 }, { fontSize: 14 }),
    b({ type: "math", latex: "\\dot{\\mathbf{x}} = A\\mathbf{x} + B\\mathbf{u}, \\quad \\mathbf{y} = C\\mathbf{x} + D\\mathbf{u}", displayMode: true }),
    b({ type: "heading", text: "4. 安定性解析", level: 2 }, { fontSize: 14 }),
    b({ type: "paragraph", text: "特性方程式の根を求めて安定性を判定する。" }),
    b({ type: "math", latex: "\\det(sI - A) = s^2 + 2\\zeta\\omega_n s + \\omega_n^2 = 0", displayMode: true }),
  ];
}

// ──────────────────────────────────────────
// 9) 化学レポート / Chemistry
// ──────────────────────────────────────────
function chemistryBlocks(): Block[] {
  return [
    b({ type: "heading", text: "化学実験レポート: 酸塩基滴定", level: 1 }, { textAlign: "center", fontSize: 17, fontFamily: "serif" }),
    b({ type: "paragraph", text: "化学実験担当　｜　2024年 4月" }, { textAlign: "center", fontSize: 10 }),
    b({ type: "divider", style: "solid" }),
    b({ type: "heading", text: "1. 目的", level: 2 }, { fontSize: 14 }),
    b({ type: "paragraph", text: "酢酸水溶液の濃度を水酸化ナトリウム水溶液を用いた中和滴定により求める。" }),
    b({ type: "heading", text: "2. 反応式", level: 2 }, { fontSize: 14 }),
    b({ type: "paragraph", text: "酢酸と水酸化ナトリウムの中和反応:" }),
    b({ type: "chemistry", formula: "CH3COOH + NaOH -> CH3COONa + H2O", displayMode: true, caption: "中和反応" }),
    b({ type: "paragraph", text: "酢酸の電離平衡:" }),
    b({ type: "chemistry", formula: "CH3COOH <=> CH3COO- + H+", displayMode: true }),
    b({ type: "heading", text: "3. 計算", level: 2 }, { fontSize: 14 }),
    b({ type: "paragraph", text: "電離定数 Ka は以下のように定義される。" }),
    b({ type: "math", latex: "K_a = \\frac{[\\text{CH}_3\\text{COO}^-][\\text{H}^+]}{[\\text{CH}_3\\text{COOH}]} = 1.8 \\times 10^{-5}", displayMode: true }),
    b({ type: "heading", text: "4. 実験結果", level: 2 }, { fontSize: 14 }),
    b({ type: "table", headers: ["試行", "NaOH滴下量 [mL]", "酢酸濃度 [mol/L]"], rows: [["1", "12.5", "0.125"], ["2", "12.3", "0.123"], ["3", "12.4", "0.124"]], caption: "表1: 滴定結果" }),
    b({ type: "heading", text: "5. 考察", level: 2 }, { fontSize: 14 }),
    b({ type: "paragraph", text: "3回の試行の平均から、酢酸水溶液の濃度は約0.124 mol/Lと求められた。標準偏差は0.001 mol/Lであり、再現性は良好である。" }),
  ];
}

// ──────────────────────────────────────────
// 10) 物理実験 / Physics Lab
// ──────────────────────────────────────────
function physicsBlocks(): Block[] {
  return [
    b({ type: "heading", text: "物理学実験レポート: 単振り子の周期", level: 1 }, { textAlign: "center", fontSize: 17, fontFamily: "serif" }),
    b({ type: "paragraph", text: "物理学実験班　｜　2024年 5月" }, { textAlign: "center", fontSize: 10 }),
    b({ type: "divider", style: "solid" }),
    b({ type: "heading", text: "1. 理論", level: 2 }, { fontSize: 14 }),
    b({ type: "paragraph", text: "微小振動の近似下で、単振り子の運動方程式は以下のようになる。" }),
    b({ type: "math", latex: "\\frac{d^2\\theta}{dt^2} + \\frac{g}{l}\\theta = 0", displayMode: true }),
    b({ type: "paragraph", text: "この解から周期Tが求まる。" }),
    b({ type: "math", latex: "T = 2\\pi\\sqrt{\\frac{l}{g}}", displayMode: true }),
    b({ type: "heading", text: "2. 実験方法", level: 2 }, { fontSize: 14 }),
    b({ type: "list", style: "numbered", items: [
      "振り子の長さ l を5段階に変えて設定する (0.5m, 0.7m, 1.0m, 1.2m, 1.5m)",
      "各長さで10回の振動の時間を3回測定する",
      "周期を計算し、理論値と比較する",
    ] }),
    b({ type: "heading", text: "3. 実験結果", level: 2 }, { fontSize: 14 }),
    b({ type: "table", headers: ["長さ l [m]", "実測 T [s]", "理論 T [s]", "誤差 [%]"], rows: [["0.50", "1.42", "1.42", "0.3"], ["0.70", "1.68", "1.68", "0.1"], ["1.00", "2.01", "2.01", "0.2"], ["1.20", "2.20", "2.20", "0.1"], ["1.50", "2.46", "2.46", "0.3"]], caption: "表1: 周期の測定結果と理論値の比較" }),
    b({ type: "heading", text: "4. グラフ", level: 2 }, { fontSize: 14 }),
    b({ type: "paragraph", text: "T² vs l のグラフをプロットすると、原点を通る直線が得られるはずである。" }),
    b({ type: "chart", chartType: "scatter", code: `\\addplot[only marks, mark=*, blue, mark size=3pt] coordinates {
  (0.5, 2.016) (0.7, 2.822) (1.0, 4.040) (1.2, 4.840) (1.5, 6.052)
};
\\addlegendentry{実測値 $T^2$}
\\addplot[red, thick, domain=0.3:1.7] {4*3.14159*3.14159/9.8*x};
\\addlegendentry{理論曲線}`, caption: "図1: T² vs l のグラフ" }),
    b({ type: "heading", text: "5. 結論", level: 2 }, { fontSize: 14 }),
    b({ type: "paragraph", text: "実験結果は理論値とよく一致し、重力加速度 g ≈ 9.8 m/s² を確認できた。" }),
  ];
}

// ──────────────────────────────────────────
// 11) 情報工学 / CS Algorithm
// ──────────────────────────────────────────
function algorithmBlocks(): Block[] {
  return [
    b({ type: "heading", text: "アルゴリズムとデータ構造 レポート", level: 1 }, { textAlign: "center", fontSize: 17, fontFamily: "serif" }),
    b({ type: "paragraph", text: "情報工学科　｜　2024年 7月" }, { textAlign: "center", fontSize: 10 }),
    b({ type: "divider", style: "solid" }),
    b({ type: "heading", text: "1. ソートアルゴリズムの計算量", level: 2 }, { fontSize: 14 }),
    b({ type: "table", headers: ["アルゴリズム", "最良", "平均", "最悪", "空間"], rows: [
      ["バブルソート", "O(n)", "O(n²)", "O(n²)", "O(1)"],
      ["マージソート", "O(n log n)", "O(n log n)", "O(n log n)", "O(n)"],
      ["クイックソート", "O(n log n)", "O(n log n)", "O(n²)", "O(log n)"],
    ], caption: "表1: ソートアルゴリズムの比較" }),
    b({ type: "heading", text: "2. 二分探索の実装", level: 2 }, { fontSize: 14 }),
    b({ type: "code", language: "python", code: `def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1` }),
    b({ type: "heading", text: "3. 計算量の証明", level: 2 }, { fontSize: 14 }),
    b({ type: "paragraph", text: "二分探索の時間計算量がO(log n)であることを示す。" }),
    b({ type: "math", latex: "T(n) = T\\left(\\frac{n}{2}\\right) + O(1) \\implies T(n) = O(\\log n)", displayMode: true }),
    b({ type: "heading", text: "4. フローチャート", level: 2 }, { fontSize: 14 }),
    b({ type: "diagram", code: `[node distance=1.5cm, auto,
  startstop/.style={rectangle, rounded corners, minimum width=3cm, minimum height=0.8cm, text centered, draw=black, fill=red!20},
  process/.style={rectangle, minimum width=3cm, minimum height=0.8cm, text centered, draw=black, fill=blue!15},
  decision/.style={diamond, minimum width=3cm, minimum height=0.8cm, text centered, draw=black, fill=green!15},
  arrow/.style={thick,->,>=stealth}]

\\node (start) [startstop] {開始};
\\node (init) [process, below of=start] {left=0, right=n-1};
\\node (check) [decision, below of=init, yshift=-0.5cm] {left$\\leq$right?};
\\node (calc) [process, below of=check, yshift=-0.5cm] {mid=(left+right)/2};
\\node (found) [startstop, right of=check, xshift=3cm] {発見};
\\node (notfound) [startstop, left of=check, xshift=-3cm] {未発見};

\\draw [arrow] (start) -- (init);
\\draw [arrow] (init) -- (check);
\\draw [arrow] (check) -- node[left]{Yes} (calc);
\\draw [arrow] (check) -- node[above]{No} (notfound);`, diagramType: "flowchart", caption: "図1: 二分探索フローチャート" }),
  ];
}

// ──────────────────────────────────────────
// 12) 数学証明 / Math Proof
// ──────────────────────────────────────────
function mathProofBlocks(): Block[] {
  return [
    b({ type: "heading", text: "微分積分学ノート", level: 1 }, { textAlign: "center", fontSize: 18, fontFamily: "serif" }),
    b({ type: "divider", style: "solid" }),
    b({ type: "heading", text: "定理 1: テイラーの定理", level: 2 }, { fontSize: 14 }),
    b({ type: "quote", text: "関数 f(x) が区間 [a, x] で n+1 回連続微分可能であるとき、以下が成り立つ。" }),
    b({ type: "math", latex: "f(x) = \\sum_{k=0}^{n} \\frac{f^{(k)}(a)}{k!}(x-a)^k + R_n(x)", displayMode: true }),
    b({ type: "paragraph", text: "ここで剰余項 Rₙ(x) は次のように表される（ラグランジュの剰余項）:" }),
    b({ type: "math", latex: "R_n(x) = \\frac{f^{(n+1)}(c)}{(n+1)!}(x-a)^{n+1}, \\quad c \\in (a, x)", displayMode: true }),
    b({ type: "heading", text: "例題: e^x の展開", level: 2 }, { fontSize: 14 }),
    b({ type: "math", latex: "e^x = \\sum_{n=0}^{\\infty} \\frac{x^n}{n!} = 1 + x + \\frac{x^2}{2!} + \\frac{x^3}{3!} + \\cdots", displayMode: true }),
    b({ type: "heading", text: "定理 2: 微分積分学の基本定理", level: 2 }, { fontSize: 14 }),
    b({ type: "math", latex: "\\frac{d}{dx} \\int_a^x f(t) \\, dt = f(x)", displayMode: true }),
    b({ type: "heading", text: "定理 3: グリーンの定理", level: 2 }, { fontSize: 14 }),
    b({ type: "math", latex: "\\oint_C (P\\,dx + Q\\,dy) = \\iint_D \\left(\\frac{\\partial Q}{\\partial x} - \\frac{\\partial P}{\\partial y}\\right) dA", displayMode: true }),
    b({ type: "heading", text: "線形代数の基本", level: 2 }, { fontSize: 14 }),
    b({ type: "paragraph", text: "固有値問題:" }),
    b({ type: "math", latex: "A\\mathbf{v} = \\lambda\\mathbf{v} \\iff \\det(A - \\lambda I) = 0", displayMode: true }),
    b({ type: "paragraph", text: "行列の対角化:" }),
    b({ type: "math", latex: "A = PDP^{-1}, \\quad D = \\begin{pmatrix} \\lambda_1 & & \\\\ & \\ddots & \\\\ & & \\lambda_n \\end{pmatrix}", displayMode: true }),
  ];
}

// ──────────────────────────────────────────
// 13) 技術仕様書 / Technical Spec
// ──────────────────────────────────────────
function techSpecBlocks(): Block[] {
  return [
    b({ type: "heading", text: "技術仕様書", level: 1 }, { textAlign: "center", fontSize: 18, fontFamily: "serif" }),
    b({ type: "paragraph", text: "プロジェクト名: ○○システム　｜　バージョン: 1.0　｜　2024年" }, { textAlign: "center", fontSize: 9 }),
    b({ type: "divider", style: "solid" }),
    b({ type: "heading", text: "1. システム概要", level: 2 }, { fontSize: 14 }),
    b({ type: "paragraph", text: "本文書は○○システムの技術仕様を定義するものである。" }),
    b({ type: "heading", text: "2. システム構成", level: 2 }, { fontSize: 14 }),
    b({ type: "diagram", code: `[node distance=2.5cm,
  server/.style={rectangle, draw, fill=blue!15, minimum width=2cm, minimum height=1cm, text centered, font=\\small},
  client/.style={rectangle, rounded corners, draw, fill=green!15, minimum width=1.5cm, minimum height=0.8cm, text centered, font=\\small},
  db/.style={cylinder, draw, fill=orange!15, minimum width=1.5cm, minimum height=1cm, text centered, font=\\small, shape border rotate=90, aspect=0.25}]

\\node[client] (web) {Web App};
\\node[server] (api) [right of=web] {API Server};
\\node[db] (db) [right of=api] {Database};

\\draw[thick,->] (web) -- node[above,font=\\tiny]{REST} (api);
\\draw[thick,->] (api) -- node[above,font=\\tiny]{SQL} (db);`, diagramType: "block", caption: "図1: システム構成図" }),
    b({ type: "heading", text: "3. API仕様", level: 2 }, { fontSize: 14 }),
    b({ type: "table", headers: ["エンドポイント", "メソッド", "説明"], rows: [
      ["/api/users", "GET", "ユーザー一覧取得"],
      ["/api/users/:id", "GET", "ユーザー詳細取得"],
      ["/api/users", "POST", "ユーザー新規作成"],
      ["/api/users/:id", "PUT", "ユーザー更新"],
    ] }),
    b({ type: "heading", text: "4. データモデル", level: 2 }, { fontSize: 14 }),
    b({ type: "code", language: "sql", code: `CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);` }),
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
  category: "general" | "education" | "engineering" | "science";
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
    category: "general",
    blocks: reportBlocks,
  },
  {
    id: "announcement",
    name: "お知らせ",
    description: "フォーマルな通知・案内文書",
    gradient: "from-emerald-500 via-green-400 to-teal-400",
    accentColor: "bg-emerald-500",
    icon: "📢",
    category: "general",
    blocks: announcementBlocks,
  },
  {
    id: "worksheet",
    name: "ワークシート",
    description: "数式入りの演習・問題集",
    gradient: "from-violet-500 via-purple-400 to-fuchsia-400",
    accentColor: "bg-violet-500",
    icon: "📝",
    category: "education",
    blocks: worksheetBlocks,
  },
  {
    id: "academic",
    name: "論文",
    description: "アカデミックな研究論文",
    gradient: "from-amber-500 via-orange-400 to-yellow-400",
    accentColor: "bg-amber-500",
    icon: "🎓",
    category: "education",
    blocks: academicBlocks,
  },
  {
    id: "resume",
    name: "履歴書",
    description: "職務経歴書・CV",
    gradient: "from-pink-500 via-rose-400 to-red-400",
    accentColor: "bg-pink-500",
    icon: "👤",
    category: "general",
    blocks: resumeBlocks,
  },
  {
    id: "circuit",
    name: "電子回路レポート",
    description: "回路図付きの実験レポート",
    gradient: "from-cyan-500 via-teal-400 to-emerald-400",
    accentColor: "bg-cyan-500",
    icon: "⚡",
    category: "engineering",
    blocks: circuitBlocks,
  },
  {
    id: "control",
    name: "制御工学",
    description: "ブロック線図・伝達関数の解析レポート",
    gradient: "from-indigo-500 via-blue-400 to-sky-400",
    accentColor: "bg-indigo-500",
    icon: "🔄",
    category: "engineering",
    blocks: controlBlocks,
  },
  {
    id: "chemistry",
    name: "化学レポート",
    description: "化学反応式・実験レポート",
    gradient: "from-lime-500 via-green-400 to-emerald-400",
    accentColor: "bg-lime-500",
    icon: "🧪",
    category: "science",
    blocks: chemistryBlocks,
  },
  {
    id: "physics",
    name: "物理実験",
    description: "物理実験レポート・グラフ付き",
    gradient: "from-orange-500 via-red-400 to-pink-400",
    accentColor: "bg-orange-500",
    icon: "🔬",
    category: "science",
    blocks: physicsBlocks,
  },
  {
    id: "algorithm",
    name: "情報工学",
    description: "アルゴリズム・フローチャート付きレポート",
    gradient: "from-teal-500 via-cyan-400 to-blue-400",
    accentColor: "bg-teal-500",
    icon: "💻",
    category: "engineering",
    blocks: algorithmBlocks,
  },
  {
    id: "math-proof",
    name: "数学ノート",
    description: "定理・証明・数式を含む数学ノート",
    gradient: "from-purple-500 via-violet-400 to-indigo-400",
    accentColor: "bg-purple-500",
    icon: "📐",
    category: "education",
    blocks: mathProofBlocks,
  },
  {
    id: "tech-spec",
    name: "技術仕様書",
    description: "システム構成図・API仕様書",
    gradient: "from-slate-500 via-gray-400 to-zinc-400",
    accentColor: "bg-slate-500",
    icon: "📋",
    category: "engineering",
    blocks: techSpecBlocks,
  },
  {
    id: "blank",
    name: "白紙",
    description: "自由に始める白紙ドキュメント",
    gradient: "from-slate-400 via-gray-300 to-slate-300",
    accentColor: "bg-slate-400",
    icon: "📄",
    category: "general",
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
    settings: { ...DEFAULT_SETTINGS },
    blocks: blank ? blocks.map(stripBlockContent) : blocks,
  };
}
