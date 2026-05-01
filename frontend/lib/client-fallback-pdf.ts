/**
 * クライアント生成 PDF — バックエンド compile-raw が完全停止しても、ユーザに
 * 「実際に役立つワークシート」を必ず見せるための最終保険。Helvetica は WinAnsi 範囲
 * しか描画できないため、ASCII / 数式記号のみで構成する。
 *
 * 設計方針:
 *  - 「Worksheet ready」だけのプレースホルダではなく、実際にユーザが取り組める
 *    問題セットを含む PDF を返す
 *  - ユーザのプロンプト (例: "二次方程式の問題作って") と AI が返した latex から
 *    トピックを推定し、最適な問題集を選ぶ
 *  - AI の latex に $...$ 数式が含まれていれば抽出して使う
 *  - すべてバックエンド非依存 — JS だけで完結
 */

interface ProblemSet {
  title: string;
  intro?: string;
  problems: string[];
}

const TOPIC_PROBLEMS: Record<string, ProblemSet> = {
  quadratic: {
    title: "Quadratic Equations",
    intro: "Solve each equation. Show your work.",
    problems: [
      "x^2 - 5x + 6 = 0",
      "2x^2 - 7x + 3 = 0",
      "x^2 + 4x - 12 = 0",
      "3x^2 - 11x + 6 = 0",
      "x^2 - 8x + 16 = 0",
      "x^2 + 6x + 9 = 0",
      "5x^2 - 13x + 6 = 0",
      "x^2 + 2x - 15 = 0",
    ],
  },
  linear: {
    title: "Linear Equations",
    intro: "Solve for x.",
    problems: [
      "3x + 7 = 22",
      "5x - 12 = 2x + 9",
      "2(x + 3) = 4x - 6",
      "(x + 2) / 3 = (x - 4) / 2",
      "0.5x + 1.5 = 4",
      "7x - 4 = 3x + 16",
      "8 - 2x = x + 5",
      "4(2x - 1) = 3(x + 5) + 1",
    ],
  },
  trigonometry: {
    title: "Trigonometry",
    intro: "Evaluate or simplify each expression.",
    problems: [
      "sin(30) + cos(60)",
      "tan(45) * sin(90)",
      "Solve: sin(x) = 1/2 for 0 <= x <= 360",
      "Prove: sin^2(x) + cos^2(x) = 1",
      "Simplify: tan(x) * cos(x)",
      "Find cos(x) if sin(x) = 3/5 and x is acute",
      "Solve: 2cos(x) - 1 = 0 for 0 <= x <= 360",
      "Simplify: 1 - sin^2(x)",
    ],
  },
  derivative: {
    title: "Derivatives",
    intro: "Differentiate each function with respect to x.",
    problems: [
      "f(x) = x^3 - 4x^2 + 7",
      "f(x) = (2x + 1)(x - 3)",
      "f(x) = x^2 * sin(x)",
      "f(x) = (x^2 + 1) / (x - 2)",
      "f(x) = e^(2x) * cos(x)",
      "f(x) = ln(x^2 + 1)",
      "f(x) = sqrt(3x + 5)",
      "f(x) = sin(x^2)",
    ],
  },
  integral: {
    title: "Integrals",
    intro: "Evaluate each integral.",
    problems: [
      "Integrate: 3x^2 + 2x dx",
      "Integrate: 1/x dx from 1 to e",
      "Integrate: cos(x) dx from 0 to pi",
      "Integrate: x * e^x dx",
      "Integrate: sin(2x) dx",
      "Integrate: 1 / (1 + x^2) dx",
      "Integrate: x / (x^2 + 1) dx",
      "Integrate: x^2 dx from 0 to 2",
    ],
  },
  geometry: {
    title: "Geometry",
    intro: "Find the indicated quantity.",
    problems: [
      "Area of a triangle with base 8 cm and height 5 cm.",
      "Circumference of a circle with radius 7 cm. (Use pi = 3.14)",
      "Area of a rectangle with length 12 m and width 4 m.",
      "Volume of a cube with side length 6 cm.",
      "Pythagorean theorem: legs 3 and 4, find hypotenuse.",
      "Sum of angles in a pentagon.",
      "Area of a circle with diameter 10 cm.",
      "Volume of a sphere with radius 3 cm. (Use pi = 3.14)",
    ],
  },
  physics: {
    title: "Physics Practice",
    intro: "Solve each problem. Use g = 9.8 m/s^2.",
    problems: [
      "A car accelerates from rest at 3 m/s^2 for 8 seconds. Find final velocity.",
      "An object falls freely for 4 s. Find the distance fallen.",
      "F = ma: a 5 kg object accelerates at 2 m/s^2. Find force.",
      "Kinetic energy of a 2 kg ball moving at 10 m/s.",
      "A spring with k = 100 N/m is stretched 0.2 m. Find force.",
      "Period of a pendulum with length 1 m. (T = 2 * pi * sqrt(L/g))",
      "Power = work / time: 500 J in 10 s. Find power.",
      "Momentum of a 1500 kg car moving at 20 m/s.",
    ],
  },
  chemistry: {
    title: "Chemistry Practice",
    problems: [
      "Balance: H2 + O2 -> H2O",
      "Balance: CH4 + O2 -> CO2 + H2O",
      "Find moles in 36 g of water (H2O, M = 18 g/mol).",
      "Find pH of a solution with [H+] = 10^-3 mol/L.",
      "Balance: Na + Cl2 -> NaCl",
      "Find mass of 0.5 mol of NaCl (M = 58.5 g/mol).",
      "Convert 25 C to Kelvin.",
      "Balance: Fe + O2 -> Fe2O3",
    ],
  },
  general: {
    title: "Mixed Practice",
    intro: "Work through each problem.",
    problems: [
      "Solve: 2x + 5 = 17",
      "Simplify: 3(x + 4) - 2(x - 1)",
      "Factor: x^2 - 9",
      "Find slope through (1, 2) and (4, 8).",
      "Evaluate: 2^5 - 4^2",
      "Solve: x^2 = 49",
      "Simplify: (a^3 * a^2) / a^4",
      "If f(x) = 2x + 1, find f(3).",
    ],
  },
};

function detectTopic(prompt: string, fallbackLatex?: string): keyof typeof TOPIC_PROBLEMS {
  const text = `${prompt} ${fallbackLatex ?? ""}`.toLowerCase();
  // 順序が重要: より特異なキーワードを先に判定
  if (/二次方程式|quadratic|2 ?次方程式|二次関数|quadratic equation/.test(text)) return "quadratic";
  if (/三角関数|trigonom|sin|cos|tan/.test(text)) return "trigonometry";
  if (/微分|derivative|differen/.test(text)) return "derivative";
  if (/積分|integral|integ/.test(text)) return "integral";
  if (/幾何|図形|geometry|circle|triangle|sphere|area|volume/.test(text)) return "geometry";
  if (/物理|力学|電磁気|physics|kinematic|newton/.test(text)) return "physics";
  if (/化学|chemistry|mole|balance|reaction/.test(text)) return "chemistry";
  if (/一次方程式|linear equation|連立方程式|linear/.test(text)) return "linear";
  return "general";
}

/** AI が返した latex から $...$ または \(...\) で囲まれた数式を最大 8 件抜き出す。 */
function extractMathFromLatex(latex: string | undefined): string[] {
  if (!latex) return [];
  const out: string[] = [];
  const re1 = /\$([^$]{2,80})\$/g;
  let m: RegExpExecArray | null;
  while ((m = re1.exec(latex)) !== null && out.length < 8) {
    out.push(latexMathToAscii(m[1]));
  }
  // \(...\) 形式
  const re2 = /\\\(([^)]{2,80})\\\)/g;
  while ((m = re2.exec(latex)) !== null && out.length < 8) {
    out.push(latexMathToAscii(m[1]));
  }
  return out.filter((s) => s.trim().length > 0);
}

/** LaTeX 数式記法を ASCII 表記に粗く変換する (Helvetica で出すため)。 */
function latexMathToAscii(s: string): string {
  return s
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1)/($2)")
    .replace(/\\sqrt\{([^}]+)\}/g, "sqrt($1)")
    .replace(/\\sqrt\b/g, "sqrt")
    .replace(/\\pi\b/g, "pi")
    .replace(/\\theta\b/g, "theta")
    .replace(/\\alpha\b/g, "alpha")
    .replace(/\\beta\b/g, "beta")
    .replace(/\\gamma\b/g, "gamma")
    .replace(/\\le\b|\\leq\b/g, "<=")
    .replace(/\\ge\b|\\geq\b/g, ">=")
    .replace(/\\ne\b|\\neq\b/g, "!=")
    .replace(/\\times\b/g, "*")
    .replace(/\\cdot\b/g, "*")
    .replace(/\\div\b/g, "/")
    .replace(/\\sin\b/g, "sin")
    .replace(/\\cos\b/g, "cos")
    .replace(/\\tan\b/g, "tan")
    .replace(/\\log\b/g, "log")
    .replace(/\\ln\b/g, "ln")
    .replace(/\\int\b/g, "Integ")
    .replace(/\\sum\b/g, "Sum")
    .replace(/\\infty\b/g, "inf")
    .replace(/\\\\/g, "")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN_X = 56;

/**
 * 実際に使えるワークシート PDF をクライアント生成する。
 * @param userPrompt 元のユーザプロンプト (トピック検出用)
 * @param aiLatex 任意 — AI が返した latex (数式抽出用)
 */
export function buildClientFallbackPdf(userPrompt: string, aiLatex?: string): Blob {
  const safeAscii = (s: string) =>
    s
      .replace(/[\\()]/g, (m) => "\\" + m)
      .replace(/[^\x20-\x7E]/g, "?");

  const topic = detectTopic(userPrompt, aiLatex);
  const set = TOPIC_PROBLEMS[topic];

  // AI latex から数式を抽出。あればその問題セットを優先 (= ユーザ依頼により近い内容)
  const extracted = extractMathFromLatex(aiLatex);
  const useExtracted = extracted.length >= 3;
  const problems = useExtracted ? extracted.slice(0, 8) : set.problems;
  const title = useExtracted ? "Worksheet" : set.title;
  const intro = useExtracted
    ? "Generated based on your request."
    : (set.intro ?? "");

  // 行ごとに描画。座標は PDF 単位 (1 pt = 1/72 inch)。Y 軸は下から。
  // タイトル → イントロ → 問題リスト + 解答用空行
  const lines: { text: string; size: number; spacingAfter: number }[] = [];
  lines.push({ text: title, size: 22, spacingAfter: 18 });
  if (intro) {
    lines.push({ text: intro, size: 11, spacingAfter: 22 });
  }
  problems.forEach((p, i) => {
    lines.push({ text: `${i + 1}. ${p}`, size: 13, spacingAfter: 8 });
    // 解答用の空行 (薄いラインの代わりに余白を取る)
    lines.push({ text: "", size: 11, spacingAfter: 28 });
  });
  lines.push({
    text: "Reload the preview or open the AI chat to refine this worksheet.",
    size: 9,
    spacingAfter: 0,
  });

  // テキストオブジェクトを構築。最初の行は (PAGE_H - topMargin) から開始。
  const TOP_Y = PAGE_H - 80;
  let cur = TOP_Y;
  let stream = "";
  for (const ln of lines) {
    if (ln.text) {
      stream += `BT\n/F1 ${ln.size} Tf\n${MARGIN_X} ${cur} Td (${safeAscii(ln.text)}) Tj\nET\n`;
    }
    cur -= ln.size + ln.spacingAfter;
    if (cur < 60) break; // ページ末尾でカット
  }

  const header = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  const objs: string[] = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n",
    `5 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj\n`,
  ];
  const offsets: number[] = [];
  let pos = header.length;
  for (const o of objs) {
    offsets.push(pos);
    pos += o.length;
  }
  const xrefStart = pos;
  let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += String(off).padStart(10, "0") + " 00000 n \n";
  }
  const trailer = `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  const fullStr = header + objs.join("") + xref + trailer;
  const bytes = new Uint8Array(fullStr.length);
  for (let i = 0; i < fullStr.length; i++) bytes[i] = fullStr.charCodeAt(i) & 0xff;
  return new Blob([bytes], { type: "application/pdf" });
}
