/**
 * Template definitions — each template provides a starter raw LaTeX source.
 *
 * 方針: テンプレートは「使用パッケージ / 色設定 / 見出し設計 / 図の流儀 /
 * enumerate規則 / 数式スタイル」を固定する。AI はテンプレの範囲内で raw LaTeX を編集する。
 */
import {
  DocumentModel,
  DEFAULT_SETTINGS,
  LaTeXDocumentClass,
} from "./types";

// ──────────────────────────────────────────
// Common preambles (shared building blocks)
// ──────────────────────────────────────────

const JA_PREAMBLE = String.raw`\documentclass[11pt,a4paper]{article}
\usepackage[haranoaji]{luatexja-preset}
\usepackage{geometry}
\geometry{margin=20mm}
\usepackage{amsmath, amssymb, amsthm, mathtools}
\usepackage{enumitem}
\usepackage{booktabs}
\usepackage{graphicx}
\usepackage{xcolor}
\usepackage{hyperref}
\hypersetup{colorlinks=true, linkcolor=blue!60!black, urlcolor=blue!60!black}
`;

// ──────────────────────────────────────────
// Article — レポート・論文
// ──────────────────────────────────────────
const ARTICLE_LATEX = JA_PREAMBLE + String.raw`
\title{レポートタイトル}
\author{著者名}
\date{\today}

\begin{document}
\maketitle

\section{はじめに}
本レポートでは、\textbf{○○}について調査した結果を報告する。研究の背景として、近年この分野では以下の発展が見られる。

\section{理論的背景}
本研究の理論的基盤として、オイラーの公式を紹介する。

\[
  e^{i\pi} + 1 = 0
\]

二次方程式の解の公式は以下のように導かれる。

\[
  x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}
\]

\section{実験結果}
実験の結果を以下の表にまとめる。

\begin{table}[h]
  \centering
  \begin{tabular}{ccc}
    \toprule
    試行 & 測定値 & 誤差 \\
    \midrule
    1 & 3.14 & $\pm$0.02 \\
    2 & 3.16 & $\pm$0.01 \\
    3 & 3.15 & $\pm$0.01 \\
    \bottomrule
  \end{tabular}
  \caption{実験結果}
\end{table}

\section{考察}
実験結果から、以下の点が考察できる。

\begin{itemize}[leftmargin=2em]
  \item 測定値は $\pi$ の近似値として妥当な範囲内である
  \item 試行回数を増やすことで精度の向上が期待できる
  \item 環境温度の影響を今後検討する必要がある
\end{itemize}

\section{結論}
以上の実験及び考察から、本研究の目的は概ね達成されたと考えられる。

\end{document}
`;

// ──────────────────────────────────────────
// Report — 技術報告書（章立て）
// ──────────────────────────────────────────
const REPORT_LATEX = String.raw`\documentclass[11pt,a4paper]{report}
\usepackage[haranoaji]{luatexja-preset}
\usepackage{geometry}
\geometry{margin=22mm}
\usepackage{amsmath, amssymb, amsthm, mathtools}
\usepackage{enumitem}
\usepackage{booktabs}
\usepackage{graphicx}
\usepackage{xcolor}
\usepackage{titlesec}
\usepackage{hyperref}
\hypersetup{colorlinks=true, linkcolor=teal!70!black, urlcolor=teal!70!black}

\title{技術報告書\\\large プロジェクト名: ○○システム}
\author{プロジェクトチーム}
\date{バージョン 1.0}

\begin{document}
\maketitle
\tableofcontents

\chapter{システム概要}
本文書は \textbf{○○システム} の技術仕様を定義するものである。
report クラスでは \verb|\chapter| が使えるため、大規模な文書に適している。

\section{背景}
現状の課題として、以下の点が挙げられる。

\begin{enumerate}[label=(\arabic*)]
  \item 既存システムの保守コストが高い
  \item スケーラビリティに限界がある
  \item ユーザー要望への迅速な対応が困難
\end{enumerate}

\chapter{API仕様}
\section{エンドポイント一覧}

\begin{table}[h]
  \centering
  \begin{tabular}{lll}
    \toprule
    エンドポイント & メソッド & 説明 \\
    \midrule
    \texttt{/api/users} & GET & ユーザー一覧取得 \\
    \texttt{/api/users/:id} & GET & ユーザー詳細取得 \\
    \texttt{/api/users} & POST & ユーザー新規作成 \\
    \texttt{/api/users/:id} & PUT & ユーザー更新 \\
    \bottomrule
  \end{tabular}
\end{table}

\chapter{数理モデル}
システムの応答特性は以下の伝達関数でモデル化される。

\[
  H(s) = \frac{\omega_n^2}{s^2 + 2\zeta\omega_n s + \omega_n^2}
\]

\end{document}
`;

// ──────────────────────────────────────────
// Beamer — プレゼンテーション
// ──────────────────────────────────────────
const BEAMER_LATEX = String.raw`\documentclass[aspectratio=169,11pt]{beamer}
\usepackage{luatexja}
\usetheme{metropolis}
\usepackage{amsmath, amssymb}
\usepackage{booktabs}

\title{研究発表タイトル}
\subtitle{サブタイトル}
\author{発表者名}
\institute{所属機関}
\date{\today}

\begin{document}

\maketitle

\begin{frame}{背景と目的}
  \begin{itemize}
    \item 本研究の動機: ○○問題の解決
    \item 従来手法の課題: 計算コストが高い
    \item 本研究の貢献: 新しいアプローチの提案
  \end{itemize}
\end{frame}

\begin{frame}{提案手法}
  提案するアルゴリズムの目的関数は以下の通りである:
  \[
    \min_{\theta}\;
    \mathcal{L}(\theta) = \frac{1}{N} \sum_{i=1}^{N} \ell(f_\theta(x_i), y_i) + \lambda \|\theta\|^2
  \]
\end{frame}

\begin{frame}{実験結果}
  \begin{table}
    \centering
    \begin{tabular}{lcc}
      \toprule
      手法 & 精度 [\%] & 計算時間 [s] \\
      \midrule
      従来手法A & 85.2 & 120 \\
      従来手法B & 87.1 & 95 \\
      \textbf{提案手法} & \textbf{91.8} & \textbf{42} \\
      \bottomrule
    \end{tabular}
  \end{table}
\end{frame}

\begin{frame}{結論}
  \begin{itemize}
    \item 提案手法は従来手法に比べ精度・速度ともに優れる
    \item 今後はより大規模なデータセットでの検証を行う
  \end{itemize}
\end{frame}

\end{document}
`;

// ──────────────────────────────────────────
// Letter — 手紙・通信文
// ──────────────────────────────────────────
const LETTER_LATEX = JA_PREAMBLE + String.raw`
\renewcommand{\baselinestretch}{1.4}
\begin{document}

\begin{flushright}
  \today
\end{flushright}

\noindent
○○株式会社\\
代表取締役 ○○ ○○ 様

\begin{center}
  \Large \textbf{○○のご案内}
\end{center}

\noindent
拝啓\ 時下ますますご清祥のこととお慶び申し上げます。平素は格別のご高配を賜り、厚く御礼申し上げます。

このたび下記の通りご案内申し上げます。ご多忙のところ恐縮ではございますが、万障お繰り合わせの上、ご出席くださいますようお願い申し上げます。

\begin{center}
  \textbf{記}
\end{center}

\begin{tabular}{ll}
  日時 & 2024年5月15日（水）14:00〜16:00 \\
  場所 & 本館3階 大会議室 \\
  議題 & ○○プロジェクトの進捗報告 \\
  持ち物 & 筆記用具、配布資料 \\
\end{tabular}

\bigskip
\noindent
ご不明な点がございましたら、担当（内線: 1234）までお問い合わせください。

\begin{flushright}
  敬具\\
  △△株式会社\\
  総務部　担当 △△
\end{flushright}

\end{document}
`;

// ──────────────────────────────────────────
// Exam — 試験問題・テスト用紙
// ──────────────────────────────────────────
const EXAM_LATEX = JA_PREAMBLE + String.raw`
\usepackage{enumitem}
\setlist[enumerate]{leftmargin=*, label=(\arabic*)}

\begin{document}

\begin{center}
  {\LARGE \textbf{数学 I\quad 確認テスト}}
\end{center}

\begin{flushright}
  \quad 組\quad 番号\quad 名前 \rule{6cm}{0.4pt}
\end{flushright}

\hrule
\medskip

以下の問いに答えなさい。（各10点、計50点）

\bigskip
\noindent\textbf{第1問\quad 計算問題}

次の計算をせよ。
\begin{enumerate}
  \item $3x^2 + 5x - 2 = 0$ を解け。
  \item $\log_2 8 + \log_2 4$ の値を求めよ。
\end{enumerate}

\bigskip
\noindent\textbf{第2問\quad 関数}

関数 $f(x) = x^2 - 4x + 3$ について、次の問いに答えよ。
\begin{enumerate}
  \item 頂点の座標を求めよ。
  \item $f(x) = 0$ となる $x$ の値を全て求めよ。
  \item $0 \leq x \leq 5$ における最大値と最小値を求めよ。
\end{enumerate}

\bigskip
\noindent\textbf{第3問\quad 数列}

初項 $a_1 = 3$、公差 $d = 4$ の等差数列 $\{a_n\}$ について答えよ。
\begin{enumerate}
  \item $a_{10}$ の値を求めよ。
  \item 初項から第 $n$ 項までの和 $S_n$ を求めよ。
\end{enumerate}

\end{document}
`;

// ──────────────────────────────────────────
// Worksheet — 演習プリント
// ──────────────────────────────────────────
const WORKSHEET_LATEX = JA_PREAMBLE + String.raw`
\usepackage{enumitem}
\setlist[enumerate]{leftmargin=*, label=(\arabic*)}

\begin{document}

\begin{center}
  {\LARGE \textbf{練習問題プリント}}
\end{center}

\noindent
単元：二次関数\quad 年\ \ 組\ \ 番\ \ 名前 \rule{5cm}{0.4pt}

\hrule
\medskip

\noindent\textbf{基本問題}

次の二次関数のグラフの頂点と軸を求めなさい。
\begin{enumerate}
  \item $y = x^2 - 6x + 5$
  \item $y = -2x^2 + 8x - 3$
  \item $y = 3(x-1)^2 + 4$
\end{enumerate}

\bigskip
\noindent\textbf{応用問題}

次の問いに答えなさい。途中の計算過程も書くこと。
\begin{enumerate}
  \item 二次関数 $y = x^2 + ax + b$ が点 $(1, 3)$ と $(2, 5)$ を通るとき、$a, b$ の値を求めよ。
  \item $x^2 - 2x - 3 > 0$ を満たす $x$ の範囲を求めよ。
\end{enumerate}

\bigskip
\noindent\textbf{発展問題}

二次関数 $f(x) = x^2 - 2ax + a + 2$ が $0 \leq x \leq 3$ で常に正となる $a$ の範囲を求めよ。

\end{document}
`;

// ──────────────────────────────────────────
// Common-test — 共通テスト風
// ──────────────────────────────────────────
const COMMON_TEST_LATEX = JA_PREAMBLE + String.raw`
\usepackage{enumitem}
\usepackage{tcolorbox}
\tcbuselibrary{breakable, skins}
\setlist[enumerate]{leftmargin=*, label=\textbf{(\arabic*)}}

\definecolor{exambox}{HTML}{1e3a8a}

\begin{document}

\begin{center}
  \fbox{\parbox{0.9\textwidth}{
    \centering\Large\textbf{共通テスト風\quad 数学IA}
    \par\medskip
    \normalsize 試験時間: 70分\quad 配点: 100点
  }}
\end{center}

\bigskip

\begin{tcolorbox}[colback=exambox!5, colframe=exambox!70, title=\textbf{第1問}, breakable]
  次の各問いに答えよ。
  \begin{enumerate}
    \item 集合 $A = \{1, 2, 3, 4, 5\}$, $B = \{2, 4, 6\}$ に対して、$A \cap B$ を求めよ。
    \item 不等式 $|x - 3| < 2$ の解を求めよ。
  \end{enumerate}
\end{tcolorbox}

\bigskip

\begin{tcolorbox}[colback=exambox!5, colframe=exambox!70, title=\textbf{第2問}, breakable]
  二次関数 $y = x^2 - 4x + 1$ について、次の問いに答えよ。
  \begin{enumerate}
    \item このグラフの頂点の座標を求めよ。
    \item $y = 0$ となる $x$ の値を求めよ。
  \end{enumerate}
\end{tcolorbox}

\bigskip

\begin{tcolorbox}[colback=exambox!5, colframe=exambox!70, title=\textbf{第3問}, breakable]
  $\triangle ABC$ において、$AB = 5$, $BC = 7$, $CA = 8$ である。
  \begin{enumerate}
    \item 余弦定理を用いて $\cos B$ を求めよ。
    \item $\triangle ABC$ の面積を求めよ。
  \end{enumerate}
\end{tcolorbox}

\end{document}
`;

// ──────────────────────────────────────────
// Blank — 白紙
// ──────────────────────────────────────────
const BLANK_LATEX = JA_PREAMBLE + String.raw`
\begin{document}

\section{}

\end{document}
`;

// ──────────────────────────────────────────
// Template Registry
// ──────────────────────────────────────────

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  gradient: string;
  accentColor: string;
  icon: string;
  documentClass: LaTeXDocumentClass;
  /** Starter raw LaTeX source for this template */
  latex: string;
}

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: "common-test",
    name: "共通テスト風",
    description: "大学入学共通テスト風の問題冊子。配色とブロック装飾付き",
    gradient: "from-blue-700 via-indigo-500 to-cyan-400",
    accentColor: "bg-indigo-600",
    icon: "📐",
    documentClass: "article",
    latex: COMMON_TEST_LATEX,
  },
  {
    id: "exam",
    name: "試験問題・テスト",
    description: "定期テスト・小テスト・確認テストに",
    gradient: "from-rose-500 via-red-400 to-orange-400",
    accentColor: "bg-rose-500",
    icon: "📝",
    documentClass: "article",
    latex: EXAM_LATEX,
  },
  {
    id: "worksheet",
    name: "演習プリント",
    description: "授業用の練習問題・ワークシートに",
    gradient: "from-teal-500 via-cyan-400 to-sky-400",
    accentColor: "bg-teal-500",
    icon: "📋",
    documentClass: "article",
    latex: WORKSHEET_LATEX,
  },
  {
    id: "article",
    name: "レポート・論文",
    description: "一般的なレポート・短い論文に。最もよく使われるクラス",
    gradient: "from-blue-500 via-blue-400 to-cyan-400",
    accentColor: "bg-blue-500",
    icon: "📄",
    documentClass: "article",
    latex: ARTICLE_LATEX,
  },
  {
    id: "report",
    name: "技術報告書",
    description: "章立て構造の長い報告書・仕様書に",
    gradient: "from-slate-500 via-gray-400 to-zinc-400",
    accentColor: "bg-slate-500",
    icon: "📋",
    documentClass: "report",
    latex: REPORT_LATEX,
  },
  {
    id: "beamer",
    name: "プレゼンテーション",
    description: "学会発表・講義スライドの作成に",
    gradient: "from-violet-500 via-purple-400 to-fuchsia-400",
    accentColor: "bg-violet-500",
    icon: "🎬",
    documentClass: "beamer",
    latex: BEAMER_LATEX,
  },
  {
    id: "letter",
    name: "手紙・通信文",
    description: "フォーマルな手紙・案内状に",
    gradient: "from-emerald-500 via-green-400 to-teal-400",
    accentColor: "bg-emerald-500",
    icon: "✉️",
    documentClass: "article",
    latex: LETTER_LATEX,
  },
  {
    id: "blank",
    name: "白紙",
    description: "自由に始める白紙ドキュメント",
    gradient: "from-slate-400 via-gray-300 to-slate-300",
    accentColor: "bg-slate-400",
    icon: "📝",
    documentClass: "article",
    latex: BLANK_LATEX,
  },
];

export function createFromTemplate(templateId: string, blank = false): DocumentModel {
  const tmpl = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[TEMPLATES.length - 1];
  return {
    template: tmpl.id,
    metadata: { title: tmpl.name === "白紙" ? "" : tmpl.name, author: "" },
    settings: {
      ...DEFAULT_SETTINGS,
      documentClass: tmpl.documentClass,
    },
    latex: blank ? BLANK_LATEX : tmpl.latex,
  };
}

export function getTemplateLatex(templateId: string): string {
  const tmpl = TEMPLATES.find((t) => t.id === templateId);
  return tmpl?.latex ?? BLANK_LATEX;
}
