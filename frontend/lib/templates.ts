/**
 * Template definitions — each template is a complete, distinctive starter document.
 *
 * 設計方針:
 * - 各テンプレで「使用パッケージ / 色設定 / 見出し設計 / 図の流儀 / enumerate 規則 / 数式スタイル」
 *   の 6 項目を固定する。
 * - AI とユーザはテンプレの範囲内で raw LaTeX を編集する。
 * - テンプレは "starter" であって "skeleton" ではない。完成度の高いサンプル本文を含めて
 *   ユーザがすぐ使い始められる状態にする。
 *
 * テンプレートはこのプロダクトの命なので、薄っぺらいスケルトンにせず、
 * 手で組めば 30 分以上かかる仕上がりを最初から提供する。
 */
import {
  DocumentModel,
  DEFAULT_SETTINGS,
  LaTeXDocumentClass,
} from "./types";

// ══════════════════════════════════════════
// Shared preamble pieces
// ══════════════════════════════════════════

/** lualatex + 日本語 + 共通数式パッケージ */
const JA_BASE = String.raw`\documentclass[11pt,a4paper]{article}
\usepackage[haranoaji]{luatexja-preset}
\usepackage{geometry}
\usepackage{amsmath, amssymb, amsthm, mathtools, bm}
\usepackage{enumitem}
\usepackage{booktabs, tabularx, array}
\usepackage{graphicx}
\usepackage{xcolor}
\usepackage{hyperref}
`;

/**
 * tcolorbox 共通プリアンブル — 全テンプレートで統一的に使う。
 * skins: enhanced / attach boxed title / bicolor 等に必須
 * breakable: ページ跨ぎボックスに必須
 * theorems: tcbtheorem 等 (将来互換)
 *
 * 個別に \tcbuselibrary を書くとライブラリ漏れの温床になるため、
 * テンプレートでは必ずこの定数経由でロードする。
 */
const TCB_PREAMBLE: string = String.raw`\usepackage{tcolorbox}
\tcbuselibrary{skins,breakable,theorems}`;

// ══════════════════════════════════════════
// 1. Blank — 白紙 (Word ライク)
// ══════════════════════════════════════════
const BLANK_LATEX = JA_BASE + String.raw`\geometry{margin=22mm}
\hypersetup{hidelinks}

\begin{document}

\end{document}
`;

// ══════════════════════════════════════════
// 2. 共通テスト風 — 大学入試問題冊子スタイル
//
//   色: 紺 (#1e3a8a) ベース
//   見出し: tcolorbox の大問ボックス + 小問は (1)(2)(3)
//   数式: 行内優先、適宜 align*
//   特徴: 表紙風タイトル / 注意事項 / 大問ボックス / 配点表示
// ══════════════════════════════════════════
const COMMON_TEST_LATEX = JA_BASE + String.raw`\geometry{margin=20mm,top=22mm}
${TCB_PREAMBLE}
\usepackage{titlesec}
\usepackage{fancyhdr}
\hypersetup{hidelinks}

% ── 配色 (共通テスト風: 紺・コバルト) ──
\definecolor{ctnavy}{HTML}{1e3a8a}
\definecolor{ctcobalt}{HTML}{2563eb}
\definecolor{ctink}{HTML}{0f172a}

% ── 大問ボックス ──
\newtcolorbox{daimon}[2][]{
  enhanced, breakable,
  colback=ctnavy!3, colframe=ctnavy!85,
  fonttitle=\bfseries\large,
  coltitle=white, colbacktitle=ctnavy!90,
  attach boxed title to top left={xshift=8mm,yshift=-3mm},
  boxed title style={colframe=ctnavy!90,sharp corners,size=small},
  title={#2}, sharp corners=south,
  left=10pt,right=10pt,top=12pt,bottom=10pt,
  arc=2mm,boxrule=0.6pt,
  #1
}

% ── 小問見出し (配点バッジ) ──
\newcommand{\haiten}[1]{\hfill\textcolor{ctcobalt}{\small\textbf{[#1点]}}}

% ── enumerate (太字 (1)(2)(3)) ──
\setlist[enumerate,1]{leftmargin=2.4em,label=\textbf{(\arabic*)},itemsep=0.6em,topsep=0.4em}
\setlist[enumerate,2]{leftmargin=2em,label=(\roman*),itemsep=0.3em}

% ── ヘッダ・フッタ ──
\pagestyle{fancy}
\fancyhf{}
\fancyhead[L]{\small\textcolor{ctink!70}{共通テスト型問題冊子}}
\fancyhead[R]{\small\textcolor{ctink!70}{第\,\thepage\,ページ}}
\renewcommand{\headrulewidth}{0.4pt}
\renewcommand{\headrule}{\hbox to\headwidth{\color{ctnavy!60}\leaders\hrule height \headrulewidth\hfill}}

\begin{document}

% ── 表紙風タイトル ──
\begin{center}
  \vspace*{4mm}
  {\fontsize{24pt}{30pt}\selectfont\bfseries\color{ctnavy} 数学\,I\,$\cdot$\,A}\\[3mm]
  {\Large\bfseries 第 1 回 共通テスト型 模擬試験}\\[10mm]
  \begin{tcolorbox}[width=0.78\textwidth, colback=ctnavy!4, colframe=ctnavy!50, sharp corners, boxrule=0.6pt]
    \centering
    \begin{tabular}{c@{\hspace{14mm}}c@{\hspace{14mm}}c}
      \textbf{試験時間}\quad 70 分 & \textbf{配点}\quad 100 点 & \textbf{大問数}\quad 5 \\
    \end{tabular}
  \end{tcolorbox}
\end{center}

\vspace{6mm}
\noindent
\textbf{\textcolor{ctnavy}{\large 注意事項}}
\begin{itemize}[leftmargin=2em,itemsep=0.2em,topsep=0.3em,label=\textcolor{ctcobalt}{\textbullet}]
  \item 解答は解答用紙の指定された欄に記入すること。
  \item 計算や下書きには問題冊子の余白を用いてよい。
  \item 不正行為があった場合は失格とする。
\end{itemize}

\bigskip

% ── 大問1 ──
\begin{daimon}{第 1 問\quad 数と式・集合と論理 (配点 20)}
  \textbf{[1]} 実数 $a, b$ について、次の命題を考える。\haiten{6}

  \begin{enumerate}
    \item $a + b > 0$ かつ $ab > 0$ ならば、$a > 0$ かつ $b > 0$ であることを示せ。
    \item $a^2 + b^2 = 1$ のとき、$a + b$ の取り得る値の範囲を求めよ。
  \end{enumerate}

  \medskip
  \textbf{[2]} 不等式 $|2x - 3| \leq 5$ を解け。\haiten{8}
\end{daimon}

% ── 大問2 ──
\begin{daimon}{第 2 問\quad 二次関数 (配点 25)}
  二次関数 $f(x) = x^2 - 2ax + a^2 - 1$ について、次の問いに答えよ。

  \begin{enumerate}
    \item $f(x)$ の頂点の座標を $a$ を用いて表せ。\haiten{6}
    \item $0 \leq x \leq 2$ における $f(x)$ の最小値を $m(a)$ とおく。$m(a)$ を $a$ の関数として表せ。\haiten{12}
    \item $m(a)$ の最大値を求めよ。\haiten{7}
  \end{enumerate}
\end{daimon}

% ── 大問3 ──
\begin{daimon}{第 3 問\quad 図形と計量 (配点 25)}
  $\triangle \mathrm{ABC}$ において、$\mathrm{AB} = 5$, $\mathrm{BC} = 7$, $\mathrm{CA} = 8$ である。

  \begin{enumerate}
    \item $\cos B$ の値を求めよ。\haiten{8}
    \item $\triangle \mathrm{ABC}$ の面積 $S$ を求めよ。\haiten{8}
    \item $\triangle \mathrm{ABC}$ の外接円の半径 $R$ を求めよ。\haiten{9}
  \end{enumerate}
\end{daimon}

\end{document}
`;

// ══════════════════════════════════════════
// 3. 国公立二次風 — 純白の問題冊子。装飾を抑えた本格仕様
//
//   色: ほぼモノクロ (黒)
//   見出し: 大問は太字 +罫線 + 余白
//   特徴: 問題番号を大きく / 配点をエレガントに / 用紙余白広め
// ══════════════════════════════════════════
const KOKUKO_NIJI_LATEX = JA_BASE + String.raw`\geometry{margin=24mm,top=28mm,bottom=28mm}
\usepackage{titlesec}
\usepackage{fancyhdr}
\usepackage{setspace}
\hypersetup{hidelinks}

% ── 配色 (ほぼ黒の濃淡のみ) ──
\definecolor{kink}{HTML}{0a0a0a}
\definecolor{kgray}{HTML}{4a4a4a}
\definecolor{ksub}{HTML}{707070}

% ── 大問見出しスタイル: ローマ数字 + 罫線 ──
\titleformat{\section}
  {\normalfont\Large\bfseries\color{kink}}
  {\hspace{-1em}\fbox{\,\Large 第\thesection 問\,}}{1em}
  {}
  [\vspace{-0.3em}\noindent\rule{\textwidth}{0.4pt}]
\titlespacing*{\section}{0pt}{18pt}{12pt}

\setlist[enumerate,1]{leftmargin=2.2em,label=(\arabic*),itemsep=0.8em,topsep=0.5em}

\onehalfspacing

\pagestyle{fancy}
\fancyhf{}
\fancyfoot[C]{\small\color{ksub}--\,\thepage\,--}
\renewcommand{\headrulewidth}{0pt}

\begin{document}

% ── 表紙ブロック ──
\begin{center}
  \vspace*{2mm}
  {\Large\bfseries 〇〇大学\quad 入学試験問題}\\[2mm]
  {\large 数学\,(理系)}\\[6mm]
  \rule{0.8\textwidth}{0.6pt}\\[2mm]
  \small
  \begin{tabular}{r@{\;}l @{\hspace{16mm}} r@{\;}l}
    試験時間 & 150\,分 & 配点 & 200\,点 \\
  \end{tabular}\\[1mm]
  \rule{0.8\textwidth}{0.6pt}
\end{center}

\vspace{8mm}

\noindent\textbf{注意}
\begin{itemize}[leftmargin=2em,itemsep=0.15em,topsep=0.3em]
  \item 解答は所定の解答用紙に記入すること。
  \item 結果のみでなく、導出過程も明示すること。
  \item 数値解は分数のままでもよい。
\end{itemize}

\vspace{6mm}

\section*{}
\addtocounter{section}{1}\setcounter{section}{1}
\section{}
$xy$ 平面上の曲線 $C: y = x^3 - 3x$ と直線 $\ell: y = ax + b$ について、次の問いに答えよ。

\begin{enumerate}
  \item $\ell$ が $C$ と異なる 3 点で交わるとき、$a, b$ が満たす条件を求めよ。
  \item $\ell$ が $C$ の極大点を通り、かつ $C$ と異なる 3 点で交わるとき、$b$ を $a$ で表せ。
  \item $(2)$ の条件のもとで、$C$ と $\ell$ で囲まれた 2 つの領域の面積の和を求めよ。
\end{enumerate}

\section{}
数列 $\{a_n\}$ は、$a_1 = 1$、$a_{n+1} = \dfrac{a_n}{1 + 2 a_n}$ ($n = 1, 2, \ldots$) を満たす。

\begin{enumerate}
  \item 一般項 $a_n$ を求めよ。
  \item $\displaystyle \sum_{k=1}^{n} a_k$ を求めよ。
  \item $\displaystyle \lim_{n \to \infty} \sum_{k=1}^{n} a_k^2$ を求めよ。
\end{enumerate}

\section{}
複素数平面上の点 $z$ が $|z - 1| = 1$ を満たしながら動くとき、$w = \dfrac{1}{z}$ の描く図形を求めよ。
ただし $z \neq 0$ とする。

\end{document}
`;

// ══════════════════════════════════════════
// 4. 学校テスト — 定期考査用シンプルテンプレ
//
//   色: ニュートラルグレー
//   特徴: 氏名欄 / 得点欄 / 大問ヘッダ簡素 / 解答欄あり
// ══════════════════════════════════════════
const SCHOOL_TEST_LATEX = JA_BASE + String.raw`\geometry{margin=18mm,top=22mm}
${TCB_PREAMBLE}
\usepackage{multirow}
\hypersetup{hidelinks}

\definecolor{stink}{HTML}{1f2937}
\definecolor{stsub}{HTML}{6b7280}
\definecolor{staccent}{HTML}{dc2626}

\setlist[enumerate,1]{leftmargin=2em,label=\textbf{(\arabic*)},itemsep=0.6em,topsep=0.3em}

\newcommand{\daimonhead}[2]{%
  \par\smallskip\noindent
  \textcolor{staccent}{\rule[-1pt]{3pt}{15pt}}\hspace{4pt}%
  \textbf{\large 第 #1 問}\quad\textbf{#2}\par\smallskip
}

\begin{document}

% ── ヘッダ: タイトル + 氏名 + 得点 ──
\begin{center}
  {\LARGE\bfseries 数学\,II\quad 第 2 回\,定期考査}
\end{center}

\vspace{4mm}

\noindent
\begin{tabularx}{\textwidth}{|c|X|c|X|c|c|}
  \hline
  \rule{0pt}{14pt}年 & \quad & 組 & \quad & 番 & \\[2pt]
  \hline
  \rule{0pt}{14pt}氏名 & \multicolumn{4}{l|}{} & \\[2pt]
  \hline
\end{tabularx}\hfill
\begin{tcolorbox}[width=42mm,colback=white,colframe=stink,sharp corners,boxrule=0.6pt,left=4pt,right=4pt,top=4pt,bottom=4pt]
  \centering\textbf{得点}\\[2pt]
  \rule{0pt}{18pt}\textcolor{staccent}{\Large \hspace{1cm} / 100}
\end{tcolorbox}

\vspace{4mm}
\noindent\textcolor{stsub}{\small ※ 解答は問題用紙の解答欄に記入しなさい。途中式も書くこと。配点は各設問のそばに示してある。}

\bigskip

\daimonhead{1}{次の計算をせよ。\hfill {\small\textbf{(各 5 点)}}}
\begin{enumerate}
  \item $(2x - 3)(x + 4) - (x - 1)^2$
  \item $\dfrac{x + 1}{x - 2} - \dfrac{x - 1}{x + 2}$
  \item $\sqrt{12} + \sqrt{27} - \sqrt{48}$
\end{enumerate}

\daimonhead{2}{次の方程式・不等式を解け。\hfill {\small\textbf{(各 8 点)}}}
\begin{enumerate}
  \item $2x^2 - 5x - 3 = 0$
  \item $|2x - 1| < 5$
  \item $\log_2 (x - 1) + \log_2 (x + 1) = 3$
\end{enumerate}

\daimonhead{3}{二次関数 $f(x) = x^2 - 4x + 7$ について次の問いに答えよ。\hfill {\small\textbf{(各 10 点)}}}
\begin{enumerate}
  \item $f(x)$ を $f(x) = (x - p)^2 + q$ の形に変形し、グラフの頂点と軸を求めよ。
  \item $0 \leq x \leq 5$ における $f(x)$ の最大値と最小値を求めよ。
\end{enumerate}

\end{document}
`;

// ══════════════════════════════════════════
// 5. 塾プリント — 元気で見やすいカラフル系
//
//   色: 朱赤 + オレンジのアクセント
//   特徴: タイトル帯 / 難易度バッジ (★★☆) / 基礎→応用 構成 / 解説スペース
// ══════════════════════════════════════════
const JUKU_LATEX = JA_BASE + String.raw`\geometry{margin=18mm,top=18mm,bottom=20mm}
${TCB_PREAMBLE}
\usepackage{titlesec}
\usepackage{fancyhdr}
\hypersetup{hidelinks}

% ── 配色 (塾プリント風) ──
\definecolor{jkmain}{HTML}{ea580c}
\definecolor{jksub}{HTML}{f97316}
\definecolor{jkpale}{HTML}{fff7ed}
\definecolor{jkink}{HTML}{431407}
\definecolor{jknavy}{HTML}{0c4a6e}

% ── タイトル帯 ──
\newcommand{\jukutitle}[2]{%
  \begin{tcolorbox}[enhanced,colback=jkmain,colframe=jkmain,sharp corners,boxrule=0pt,
    left=12pt,right=12pt,top=8pt,bottom=8pt,
    overlay={
      \node[anchor=east,white,font=\small\bfseries] at ([xshift=-8pt]frame.east) {#2};
    }]
    \color{white}\Large\bfseries #1
  \end{tcolorbox}\par
}

% ── 難易度バッジ ──
\newcommand{\nlevel}[1]{%
  \fcolorbox{jkmain}{white}{\textcolor{jkmain}{\small\textbf{難度 #1}}}%
}

% ── 大問ボックス (左罫線) ──
\newtcolorbox{kihon}[1]{
  enhanced,breakable,
  colback=jkpale,colframe=jkmain!70,
  borderline west={3pt}{0pt}{jkmain},
  sharp corners,arc=0mm,
  fonttitle=\bfseries,coltitle=jkink,
  title={#1},
  left=10pt,right=10pt,top=8pt,bottom=8pt,
  boxrule=0.4pt,
}

\newtcolorbox{ouyou}[1]{
  enhanced,breakable,
  colback=white,colframe=jknavy!60,
  borderline west={3pt}{0pt}{jknavy},
  sharp corners,arc=0mm,
  fonttitle=\bfseries,coltitle=jknavy,
  title={#1},
  left=10pt,right=10pt,top=8pt,bottom=8pt,
  boxrule=0.4pt,
}

\setlist[enumerate,1]{leftmargin=2em,label=\textcolor{jkmain}{\textbf{(\arabic*)}},itemsep=0.7em,topsep=0.4em}

\pagestyle{fancy}
\fancyhf{}
\fancyhead[L]{\small\textcolor{jkink}{\textbf{Eddivom 進学ゼミ}}}
\fancyhead[R]{\small\textcolor{jkink}{二次関数\,/\,Lesson 03}}
\renewcommand{\headrulewidth}{0.4pt}

% ── ヒント / 復習 / 解答 用の小ボックス ──
\newtcolorbox{hintbox}{
  enhanced,breakable,
  colback=jkpale!50,colframe=jkmain!40,
  sharp corners,arc=0mm,boxrule=0.4pt,
  left=8pt,right=8pt,top=4pt,bottom=4pt,
  fontupper=\small,
}
\newtcolorbox{kakuninbox}{
  enhanced,breakable,
  colback=white,colframe=jknavy!30,
  borderline west={2.5pt}{0pt}{jknavy!70},
  sharp corners,arc=0mm,boxrule=0.3pt,
  left=10pt,right=10pt,top=6pt,bottom=6pt,
}

\newcommand{\juKey}[1]{\textcolor{jkmain}{\textbf{#1}}}
\newcommand{\juHint}[1]{\textcolor{jkink!70}{\small\textit{ヒント:\,#1}}}

% ── 配点バッジ ──
\newcommand{\haiten}[1]{\hfill\textcolor{jkmain}{\small\textbf{[#1点]}}}

\begin{document}

\jukutitle{二次関数 完全マスター}{Lesson 03 ・ 中3〜高1 ・ 全 90 分}

\smallskip
\noindent
\nlevel{★☆☆}\quad\nlevel{★★☆}\quad\nlevel{★★★}\hfill
\textcolor{jkink!70}{\small 目標時間: 60 分\quad 目安到達点: 70 / 100 点}

\medskip

\begin{kakuninbox}
  \textcolor{jknavy}{\textbf{今日のゴール}}\quad
  二次関数の頂点・軸を 30 秒で言える / 解の配置を 3 条件で記述できる /
  文字定数を含む最大最小を場合分けで図示できる。
\end{kakuninbox}

\bigskip

\noindent\textcolor{jkink!70}{\small\textbf{――  前回の復習チェック  ――}}\\[1pt]
\noindent\textcolor{jkink!85}{\small
\juKey{① 平方完成} $\;ax^2+bx+c=a\!\left(x+\dfrac{b}{2a}\right)^{\!2}-\dfrac{b^2-4ac}{4a}$\quad
\juKey{② 判別式} $\;D=b^2-4ac$\quad
\juKey{③ 解と係数の関係} $\;\alpha+\beta=-\dfrac{b}{a},\ \alpha\beta=\dfrac{c}{a}$
}

\bigskip

\begin{kihon}{基本問題\quad ★☆☆\quad ウォームアップ \haiten{15}}
  次の二次関数のグラフの頂点と軸を求めよ。

  \begin{enumerate}
    \item $y = x^2 - 6x + 5$
    \item $y = -2 x^2 + 8 x - 3$
    \item $y = 3 (x - 1)^2 + 4$
  \end{enumerate}

  \juHint{(1)(2) は平方完成、(3) は標準形のままでよい。}
\end{kihon}

\medskip

\begin{kihon}{標準問題\quad ★★☆\quad 解の配置 \haiten{30}}
  二次関数 $f(x) = x^2 + a x + 2$ について、次の問いに答えよ。

  \begin{enumerate}
    \item $f(x) = 0$ が異なる 2 つの実数解をもつような $a$ の値の範囲を求めよ。
    \item $f(x) = 0$ の 2 つの解がともに正となるような $a$ の値の範囲を求めよ。
    \item $f(x) = 0$ の 2 つの解が $-1 < x < 3$ の範囲にあるような $a$ の値の範囲を求めよ。
  \end{enumerate}

  \begin{hintbox}
  \juKey{解の配置 3 条件}\\
  ・判別式 $D > 0$ (相異なる実数解)\\
  ・軸 $x = -\dfrac{a}{2}$ の位置\\
  ・区間端での値 $f(\alpha),\,f(\beta)$ の符号
  \end{hintbox}
\end{kihon}

\medskip

\begin{ouyou}{応用問題\quad ★★★\quad 文字を含む最大最小 \haiten{40}}
  二次関数 $f(x) = x^2 - 2 a x + 3$ について、$0 \leq x \leq 2$ における最大値 $M(a)$ と
  最小値 $m(a)$ を、$a$ の値で場合分けして求め、それぞれを $a$ の関数として図示せよ。

  \juHint{軸 $x=a$ が区間 $[0,2]$ の左外・内・右外の 3 通りに分けて考える。}
\end{ouyou}

\medskip

\begin{ouyou}{チャレンジ\quad ★★★\quad 思考力問題 \haiten{15}}
  二次関数 $y = x^2 - 4x + k$ のグラフが $x$ 軸と異なる 2 点 $\mathrm{P},\,\mathrm{Q}$ で交わり、
  $\mathrm{PQ} = 2\sqrt{3}$ となるとき、定数 $k$ の値を求めよ。
\end{ouyou}

\bigskip

\noindent
\textcolor{jkink}{\small\textbf{■ 今日の Point}}
\begin{kakuninbox}
\textcolor{jkink!90}{\small
・ 二次関数の最大最小は「\juKey{定義域の端}」と「\juKey{軸の位置}」で場合分け\\
・ 解の配置は「\juKey{判別式 $D$}」「\juKey{軸の位置}」「\juKey{区間端の符号}」の 3 条件で決まる\\
・ 文字定数を含むときは、必ず軸の位置で場合分けして図を描く\\
・ $\mathrm{PQ}$ の長さは「2 解の差」$|\alpha - \beta| = \sqrt{(\alpha+\beta)^2 - 4\alpha\beta}$ で計算
}
\end{kakuninbox}

\bigskip

\noindent\textcolor{jkink!60}{\footnotesize
$\square$ 完答できた問題数: \underline{\hspace{2em}} / 4 問\quad
$\square$ 自己採点: \underline{\hspace{2em}} / 100 点\quad
$\square$ 次回までに復習する問題番号: \underline{\hspace{6em}}
}

\end{document}
`;

// ══════════════════════════════════════════
// 6. 解説ノート — 定義 / 例題 / 練習 のブロック構成
//
//   色: ティール + 海色
//   特徴: 定義ボックス / 例題ボックス / 注意ボックス / 練習問題
// ══════════════════════════════════════════
const KAISETSU_NOTE_LATEX = JA_BASE + String.raw`\geometry{margin=20mm,top=22mm}
${TCB_PREAMBLE}
\usepackage{titlesec}
\usepackage{fancyhdr}
\hypersetup{hidelinks}

% ── 配色 (海・ティール) ──
\definecolor{knteal}{HTML}{0d9488}
\definecolor{knsky}{HTML}{0284c7}
\definecolor{knpink}{HTML}{e11d48}
\definecolor{knpale}{HTML}{ecfeff}
\definecolor{knink}{HTML}{0f172a}

% ── 見出し (左に色付き縦線) ──
\titleformat{\section}
  {\normalfont\Large\bfseries\color{knteal}}
  {\textcolor{knteal}{$\blacktriangleright$}\;\thesection.}{0.6em}{}
\titleformat{\subsection}
  {\normalfont\large\bfseries\color{knink}}
  {\thesubsection}{0.5em}{}

% ── 定義ボックス ──
\newtcolorbox{teigi}[1][]{
  enhanced,breakable,
  colback=knpale,colframe=knteal,
  fonttitle=\bfseries,coltitle=white,colbacktitle=knteal,
  title={定義},
  attach boxed title to top left={xshift=8mm,yshift=-3mm},
  boxed title style={sharp corners,size=small},
  sharp corners=south,arc=2mm,
  left=10pt,right=10pt,top=10pt,bottom=10pt,
  boxrule=0.6pt,#1
}

% ── 定理ボックス ──
\newtcolorbox{teiri}[1][]{
  enhanced,breakable,
  colback=white,colframe=knsky!85,
  fonttitle=\bfseries,coltitle=white,colbacktitle=knsky,
  title={定理},
  attach boxed title to top left={xshift=8mm,yshift=-3mm},
  boxed title style={sharp corners,size=small},
  sharp corners=south,arc=2mm,
  left=10pt,right=10pt,top=10pt,bottom=10pt,
  boxrule=0.6pt,#1
}

% ── 例題ボックス ──
\newtcolorbox{reidai}[1][]{
  enhanced,breakable,
  colback=knteal!4,colframe=knteal!50,
  fonttitle=\bfseries,coltitle=knteal,
  title={例題},
  sharp corners,arc=0mm,
  left=10pt,right=10pt,top=8pt,bottom=8pt,
  boxrule=0.4pt,#1
}

% ── 注意 ──
\newcommand{\chui}[1]{%
  \par\smallskip
  \noindent\textcolor{knpink}{\textbf{!\;注意}}\quad #1\par\smallskip
}

\setlist[enumerate,1]{leftmargin=2em,label=\textbf{(\arabic*)},itemsep=0.5em}

\pagestyle{fancy}
\fancyhf{}
\fancyhead[L]{\small\color{knteal}\textbf{解説ノート}}
\fancyhead[R]{\small\color{knink!70}微分積分学\,/\,第 3 章}
\fancyfoot[C]{\small\color{knink!50}-\,\thepage\,-}
\renewcommand{\headrulewidth}{0.4pt}

\begin{document}

\begin{center}
  {\fontsize{20pt}{24pt}\selectfont\bfseries\color{knteal}第 3 章\quad 微分の応用}\\[2mm]
  \textcolor{knink!60}{\small \textsl{Differentiation and its Applications}}
\end{center}

\vspace{6mm}

\section{接線の方程式}

\begin{teigi}
  関数 $f(x)$ が $x = a$ で微分可能であるとき、点 $(a, f(a))$ における曲線 $y = f(x)$ の
  \textbf{接線} は、傾き $f'(a)$ をもつ次の直線として定義される:
  \[
    y - f(a) = f'(a)\,(x - a).
  \]
\end{teigi}

\begin{reidai}
  曲線 $y = x^3 - 2x$ 上の点 $(1, -1)$ における接線の方程式を求めよ。

  \medskip
  \textbf{解答}\quad
  $f(x) = x^3 - 2x$ とおくと、$f'(x) = 3 x^2 - 2$ なので $f'(1) = 1$。
  したがって接線の方程式は
  \[
    y - (-1) = 1 \cdot (x - 1) \quad\Longleftrightarrow\quad y = x - 2.
  \]
\end{reidai}

\chui{微分可能でない点 (尖った点・不連続点) では接線を考えることはできない。}

\section{平均値の定理}

\begin{teiri}
  関数 $f(x)$ が閉区間 $[a, b]$ で連続、開区間 $(a, b)$ で微分可能であるならば、
  \[
    \frac{f(b) - f(a)}{b - a} = f'(c)
  \]
  を満たす $c$ が $a < c < b$ の範囲に少なくとも 1 つ存在する。
\end{teiri}

\subsection{練習問題}
\begin{enumerate}
  \item $f(x) = x^2$ について、区間 $[0, 2]$ における平均変化率を求め、$f'(c)$ が
        その値に等しくなる $c$ を見つけよ。
  \item $f(x) = \sqrt{x}$ について、区間 $[1, 4]$ で平均値の定理を確かめよ。
\end{enumerate}

\end{document}
`;

// ══════════════════════════════════════════
// 7. 演習プリント — 授業後の練習用
//
//   色: ティール → スカイ
//   特徴: 単元名バナー / 基本→応用→発展 / 解答スペース
// ══════════════════════════════════════════
const WORKSHEET_LATEX = JA_BASE + String.raw`\geometry{margin=18mm,top=18mm,bottom=20mm}
${TCB_PREAMBLE}
\usepackage{titlesec}
\usepackage{fancyhdr}
\hypersetup{hidelinks}

\definecolor{wsteal}{HTML}{0d9488}
\definecolor{wssky}{HTML}{0284c7}
\definecolor{wsink}{HTML}{0f172a}
\definecolor{wspale}{HTML}{ecfeff}

% \unit は siunitx / physics / 一部 LaTeX カーネルとの衝突を避けるため \unitbox に改名
\newcommand{\unitbox}[1]{%
  \begin{tcolorbox}[colback=wsteal,colframe=wsteal,sharp corners,boxrule=0pt,
    left=10pt,right=10pt,top=4pt,bottom=4pt]
    \color{white}\textbf{単元}\quad #1
  \end{tcolorbox}\par
}

\newcommand{\level}[2]{%
  \par\smallskip\noindent
  \begin{tcolorbox}[colback=wspale,colframe=wsteal!60,sharp corners,boxrule=0.4pt,
    left=8pt,right=8pt,top=3pt,bottom=3pt,nobeforeafter,box align=center]
    \textcolor{wsteal}{\textbf{#1}}\quad\textcolor{wsink!70}{\small #2}
  \end{tcolorbox}\par\smallskip
}

% ── 答案スペース (横罫線) ── TeX \loop で実装。pgffor 等の依存なし。
\newcounter{anslinecnt}
\newcommand{\anslines}[1]{%
  \par\nobreak\vspace{2pt}%
  \setcounter{anslinecnt}{0}%
  \loop\ifnum\value{anslinecnt}<#1\relax
    \noindent\rule{\linewidth}{0.3pt}\par\vspace{6pt}%
    \stepcounter{anslinecnt}%
  \repeat
}

% ── 公式カード ──
\newtcolorbox{formulacard}[1]{
  enhanced,breakable,
  colback=wspale,colframe=wsteal,
  sharp corners,arc=0mm,
  fonttitle=\bfseries\small,coltitle=white,colbacktitle=wsteal,
  title={#1},
  attach boxed title to top left={xshift=8mm,yshift=-2mm},
  boxed title style={sharp corners,size=small,boxrule=0pt},
  left=10pt,right=10pt,top=10pt,bottom=8pt,
  boxrule=0.5pt,
}

\setlist[enumerate,1]{leftmargin=2em,label=\textbf{(\arabic*)},itemsep=0.7em}

\pagestyle{fancy}
\fancyhf{}
\fancyhead[L]{\small\color{wsink}\textbf{演習プリント}}
\fancyhead[C]{\small\color{wsink!60}三角比}
\fancyhead[R]{\small\color{wsink}No.\,\rule{15mm}{0.4pt}}
\renewcommand{\headrulewidth}{0.4pt}
\fancyfoot[C]{\small\color{wsink!50}-\,\thepage\,-}

\begin{document}

\begin{center}
  {\Large\bfseries\color{wsink}三角比 演習プリント}\\[2pt]
  \textcolor{wsink!60}{\small 数学I\,/\,Worksheet 04}
\end{center}

\medskip
\noindent
{\small 学年・組\,\rule{15mm}{0.4pt}\quad 番号\,\rule{8mm}{0.4pt}\quad
氏名\,\rule{45mm}{0.4pt}\hfill 提出日\,\rule{20mm}{0.4pt}}

\bigskip

\unitbox{三角比の定義 / 正弦定理 / 余弦定理}

\begin{formulacard}{今日使う公式}
\small
$\displaystyle \sin^2\theta+\cos^2\theta=1,\quad \tan\theta=\frac{\sin\theta}{\cos\theta}$\\[3pt]
\textbf{正弦定理}\quad $\dfrac{a}{\sin A}=\dfrac{b}{\sin B}=\dfrac{c}{\sin C}=2R$\\[3pt]
\textbf{余弦定理}\quad $a^2=b^2+c^2-2bc\cos A$\\[3pt]
\textbf{面積}\quad $S=\dfrac{1}{2}bc\sin A$
\end{formulacard}

\medskip

\level{【基本】}{角の値が分かっているケース\hfill 配点 各 5 点}
\begin{enumerate}
  \item $\sin 30^\circ + \cos 60^\circ$ の値を求めよ。
  \anslines{2}
  \item $\tan 45^\circ \cdot \sin 60^\circ$ の値を求めよ。
  \anslines{2}
  \item $\sin^2 30^\circ + \sin^2 45^\circ + \sin^2 60^\circ$ の値を求めよ。
  \anslines{2}
\end{enumerate}

\level{【標準】}{正弦定理・余弦定理\hfill 配点 各 8 点}
\begin{enumerate}
  \item $\triangle ABC$ で $a = 7$, $b = 5$, $C = 60^\circ$ のとき、$c$ の値を求めよ。
  \anslines{3}
  \item $\triangle ABC$ で $a = 8$, $b = 7$, $c = 5$ のとき、$\cos A$ の値を求めよ。
  \anslines{3}
  \item $\triangle ABC$ の外接円の半径が $R = 5$, $a = 6$ のとき、$\sin A$ の値を求めよ。
  \anslines{2}
\end{enumerate}

\level{【発展】}{場合分け・図形応用\hfill 配点 各 13 点}
\begin{enumerate}
  \item $\triangle ABC$ で $a = 5$, $b = 7$, $A = 30^\circ$ のとき、$B$ の値を求めよ。
        ただし、解が複数ある場合はすべて求めること。
  \anslines{4}
  \item $\triangle ABC$ で $AB = 6$, $AC = 4$, $\angle BAC = 60^\circ$ のとき、
        $\triangle ABC$ の面積 $S$ と外接円の半径 $R$ を求めよ。
  \anslines{4}
\end{enumerate}

\bigskip

\noindent\textcolor{wsink!60}{\footnotesize
チェック: $\square$ 公式を見ずに解けた\quad $\square$ 図を必ず描いた\quad $\square$ 単位・$\circ$ をつけた
}

\end{document}
`;

// ══════════════════════════════════════════
// 8. 英語ワークシート — 二段組 vocab / 本文 / 設問
//
//   色: 緑系 (#16a34a)
//   特徴: vocab table / reading passage / 設問
// ══════════════════════════════════════════
const ENGLISH_WORKSHEET_LATEX = JA_BASE + String.raw`\geometry{margin=18mm,top=20mm}
${TCB_PREAMBLE}
\usepackage{multicol}
\usepackage{titlesec}
\usepackage{fancyhdr}
\hypersetup{hidelinks}

\definecolor{enmoss}{HTML}{16a34a}
\definecolor{enink}{HTML}{14532d}
\definecolor{ensoft}{HTML}{f0fdf4}
\definecolor{enaccent}{HTML}{ca8a04}

\titleformat{\section}
  {\normalfont\large\bfseries\color{enmoss}}
  {\textsf{Part \thesection}}{0.6em}{}

\setlist[enumerate,1]{leftmargin=2.4em,label=\textbf{\arabic*.},itemsep=0.7em}

\newtcolorbox{passage}{
  enhanced,breakable,
  colback=ensoft,colframe=enmoss!50,
  sharp corners,arc=2mm,
  left=12pt,right=12pt,top=10pt,bottom=10pt,
  boxrule=0.4pt,
}

\newtcolorbox{vocabbox}{
  enhanced,
  colback=white,colframe=enaccent!60,
  sharp corners,boxrule=0.4pt,
  left=8pt,right=8pt,top=6pt,bottom=6pt,
}

\pagestyle{fancy}
\fancyhf{}
\fancyhead[L]{\small\color{enink}\textbf{English Worksheet}}
\fancyhead[R]{\small\color{enink}Unit 5\,/\,Reading}
\renewcommand{\headrulewidth}{0.4pt}

\begin{document}

\begin{center}
  {\Large\bfseries\color{enink}Unit 5: \itshape The Power of Curiosity}\\[2mm]
  {\small\color{enink!70}Reading $\cdot$ Vocabulary $\cdot$ Comprehension}
\end{center}

\bigskip

% ── Vocabulary ──
\section{Vocabulary 単語}

\begin{vocabbox}
  \small
  \begin{tabularx}{\linewidth}{l X l X}
    \textbf{curiosity} & 好奇心 & \textbf{discover} & 発見する \\
    \textbf{remarkable} & 注目すべき & \textbf{phenomenon} & 現象 \\
    \textbf{theory} & 理論 & \textbf{evidence} & 証拠 \\
    \textbf{contribute} & 貢献する & \textbf{generation} & 世代 \\
  \end{tabularx}
\end{vocabbox}

% ── Reading Passage ──
\section{Reading 本文}

\begin{passage}
  Curiosity has driven human progress for thousands of years. From the earliest astronomers
  who looked up at the night sky to modern scientists exploring distant galaxies, the desire
  to understand the unknown has been a remarkable force in our history.

  When Isaac Newton wondered why an apple fell from a tree, he was not simply daydreaming;
  he was beginning a scientific journey that would change physics forever. His theory of
  gravity gave us a new way to describe the world. In a similar way, every generation
  contributes new evidence and new ideas, building upon the work of those who came before.
\end{passage}

% ── Comprehension ──
\section{Comprehension 内容把握}

\begin{enumerate}
  \item According to the passage, what role has curiosity played in human history?
  \item Why does the writer mention Isaac Newton?
  \item In your own words, explain what \textit{“building upon the work of those who came before”}
        means.
\end{enumerate}

\section{Writing 表現練習}

\noindent Write 3--5 sentences in English about something you are curious about.

\smallskip
\noindent\rule{\linewidth}{0.3pt}\\[8pt]
\rule{\linewidth}{0.3pt}\\[8pt]
\rule{\linewidth}{0.3pt}\\[8pt]
\rule{\linewidth}{0.3pt}

\end{document}
`;

// ══════════════════════════════════════════
// 9. レポート・論文 — クリーンなアカデミック
// ══════════════════════════════════════════
const ARTICLE_LATEX = JA_BASE + String.raw`\geometry{margin=22mm,top=25mm}
\usepackage{titlesec}
\usepackage{fancyhdr}
\usepackage{abstract}
\hypersetup{colorlinks=true,linkcolor=blue!60!black,urlcolor=blue!60!black,citecolor=teal!60!black}

\definecolor{arink}{HTML}{0f172a}
\definecolor{aracc}{HTML}{1e40af}

\titleformat{\section}{\normalfont\large\bfseries\color{aracc}}{\thesection}{0.7em}{}
\titleformat{\subsection}{\normalfont\normalsize\bfseries\color{arink}}{\thesubsection}{0.6em}{}

\renewcommand{\abstractnamefont}{\normalfont\small\bfseries\color{aracc}}
\renewcommand{\abstracttextfont}{\small\itshape\color{arink!85}}
\setlength{\absleftindent}{8mm}
\setlength{\absrightindent}{8mm}

\setlist[enumerate,1]{leftmargin=*,label=(\arabic*)}
\setlist[itemize,1]{leftmargin=*,label=$\bullet$}

\pagestyle{fancy}
\fancyhf{}
\fancyhead[L]{\small\itshape\color{arink!60}\rightmark}
\fancyfoot[C]{\small\color{arink!50}-\,\thepage\,-}
\renewcommand{\headrulewidth}{0.3pt}

\title{\textbf{機械学習による教材生成の高速化に関する一考察}}
\author{著者名$^{\dagger}$\\\small\itshape $\dagger$ 所属機関}
\date{\today}

\begin{document}
\maketitle

\begin{abstract}
本稿では、教材作成の効率化を目的として、大規模言語モデル (LLM) と
LaTeX テンプレート駆動型エディタを組み合わせた新しいアプローチを提案する。
従来の手作業による教材作成と比較し、本手法は生成時間を 70\,\% 以上短縮しつつ、
出力品質を維持できることを示す。
\end{abstract}

\section{はじめに}
近年の LLM の発展は、文書作成のあり方を大きく変えつつある\,\cite{vaswani2017}。
特に教育分野においては、個別最適化された教材を短時間で生成する需要が高まっている。

本研究では以下の貢献を行う。
\begin{itemize}
  \item LaTeX テンプレートを用いた制約付き生成方式の設計。
  \item 数式編集のための日本語自然言語入力インタフェースの実装。
  \item 実際の教材作成タスクにおける生成時間と品質の評価。
\end{itemize}

\section{関連研究}
LLM を用いた文書生成は多くの研究で取り上げられているが、出力のフォーマットを
LaTeX に限定したものは比較的少ない。Brown らの GPT-3 \cite{brown2020} は
自由形式テキスト生成に強みを持つ一方、構造化文書には不向きである。

\section{提案手法}
\subsection{テンプレート駆動型生成}
本研究では、各文書クラスに対してパッケージ・色設定・見出し設計・図の流儀・
列挙規則・数式スタイルの 6 項目を固定したテンプレートを用意し、AI に対して
\textbf{テンプレ範囲内での raw LaTeX 編集} のみを許可する。

\subsection{損失関数}
学習時の損失関数は、生成された LaTeX の正当性 $\mathcal{L}_{\text{valid}}$ と
スタイル一致度 $\mathcal{L}_{\text{style}}$ の重み付き和で定義する:
\[
  \mathcal{L} = \mathcal{L}_{\text{valid}} + \lambda\, \mathcal{L}_{\text{style}}.
\]

\section{実験}
\subsection{実験設定}
8 名の教員に対し、提案手法と従来手法 (手作業) で同一の教材を作成してもらい、
所要時間と主観評価を比較した。

\subsection{結果}
表に示すように、提案手法は所要時間を平均 73\,\% 短縮した。

\begin{table}[h]
  \centering
  \small
  \begin{tabular}{lcc}
    \toprule
    手法 & 平均時間 [分] & 主観評価 (5 段階) \\
    \midrule
    手作業       & 42.5 & 3.8 \\
    \textbf{提案手法} & \textbf{11.6} & \textbf{4.4} \\
    \bottomrule
  \end{tabular}
\end{table}

\section{結論}
本稿では、テンプレート駆動型 LLM による教材生成手法を提案し、その有効性を示した。
今後は、より多様な文書クラスへの拡張と、生成品質のさらなる向上を目指す。

\begin{thebibliography}{9}
  \bibitem{vaswani2017} A.~Vaswani et al. “Attention is All You Need.” \textit{NeurIPS}, 2017.
  \bibitem{brown2020}   T.~Brown et al. “Language Models are Few-Shot Learners.” \textit{NeurIPS}, 2020.
\end{thebibliography}

\end{document}
`;

// ══════════════════════════════════════════
// 10. 技術報告書 — chapters 付き
// ══════════════════════════════════════════
const REPORT_LATEX = String.raw`\documentclass[11pt,a4paper]{report}
\usepackage[haranoaji]{luatexja-preset}
\usepackage{geometry}
\geometry{margin=22mm,top=24mm}
\usepackage{amsmath, amssymb, amsthm, mathtools}
\usepackage{enumitem}
\usepackage{booktabs, tabularx, array}
\usepackage{graphicx}
\usepackage{xcolor}
\usepackage{titlesec}
${TCB_PREAMBLE}
\usepackage{fancyhdr}
\usepackage{hyperref}
\hypersetup{colorlinks=true,linkcolor=teal!70!black,urlcolor=teal!70!black}

\definecolor{rpteal}{HTML}{0f766e}
\definecolor{rpink}{HTML}{0f172a}
\definecolor{rppale}{HTML}{f0fdfa}

% ── chapter / section ──
\titleformat{\chapter}[display]
  {\normalfont\bfseries\color{rpteal}}
  {\filleft\Large\textsc{Chapter \thechapter}}
  {2pt}
  {\filleft\fontsize{24pt}{28pt}\selectfont}
  [\vspace{1ex}\filleft\rule{0.6\textwidth}{0.6pt}]
\titlespacing*{\chapter}{0pt}{0pt}{30pt}

\titleformat{\section}{\normalfont\large\bfseries\color{rpteal}}{\thesection}{0.6em}{}

\setlist[enumerate,1]{leftmargin=*,label=(\arabic*),itemsep=0.3em}

% ── 注記ボックス ──
\newtcolorbox{note}[1][]{
  enhanced,colback=rppale,colframe=rpteal!60,
  sharp corners,boxrule=0.4pt,
  left=10pt,right=10pt,top=6pt,bottom=6pt,
  fontupper=\small,#1
}

\pagestyle{fancy}
\fancyhf{}
\fancyhead[L]{\small\color{rpink!60}\nouppercase{\leftmark}}
\fancyhead[R]{\small\color{rpink!60}\thepage}
\renewcommand{\headrulewidth}{0.3pt}

\title{
  {\Huge\bfseries\color{rpteal} 技術報告書}\\[8pt]
  {\Large プロジェクト Aurora\,/\,設計書}
}
\author{プロジェクトチーム\\\small revision 1.0}
\date{\today}

\begin{document}
\maketitle
\tableofcontents

\chapter{システム概要}
本文書は \textbf{プロジェクト Aurora} の技術仕様を定義する。本章では全体像、
背景、用語を整理する。

\section{背景}
現状の課題として、以下の点が挙げられる。

\begin{enumerate}
  \item 既存システムの保守コストが高い。
  \item スケーラビリティに限界がある。
  \item ユーザー要望への迅速な対応が困難である。
\end{enumerate}

\begin{note}
  本プロジェクトはこれらの課題を解消するため、マイクロサービス化と
  自動デプロイの導入を中核に据える。
\end{note}

\section{用語定義}
\begin{tabularx}{\linewidth}{lX}
  \toprule
  \textbf{用語} & \textbf{定義} \\
  \midrule
  Aurora       & 本プロジェクトの内部コードネーム。 \\
  サービスメッシュ & マイクロサービス間の通信を管理する仕組み。 \\
  CI/CD        & 継続的インテグレーション/継続的デリバリー。 \\
  \bottomrule
\end{tabularx}

\chapter{アーキテクチャ設計}

\section{全体構成}
システムは API ゲートウェイ、認証サービス、ドメインサービス群、データストアの
4 層から構成される。

\section{API 仕様}

\begin{table}[h]
  \centering
  \small
  \begin{tabular}{lll}
    \toprule
    エンドポイント & メソッド & 説明 \\
    \midrule
    \texttt{/api/users}       & GET  & ユーザー一覧取得 \\
    \texttt{/api/users/:id}   & GET  & ユーザー詳細取得 \\
    \texttt{/api/users}       & POST & ユーザー新規作成 \\
    \texttt{/api/users/:id}   & PUT  & ユーザー更新 \\
    \bottomrule
  \end{tabular}
\end{table}

\chapter{数理モデル}

システムの応答特性は以下の伝達関数でモデル化される:
\[
  H(s) = \frac{\omega_n^2}{s^2 + 2\zeta\omega_n s + \omega_n^2}.
\]

ここで $\omega_n$ は固有角周波数、$\zeta$ は減衰比である。

\end{document}
`;

// ══════════════════════════════════════════
// 11. プレゼンテーション — beamer (metropolis)
// ══════════════════════════════════════════
const BEAMER_LATEX = String.raw`\documentclass[aspectratio=169,11pt]{beamer}
\usepackage{luatexja}
\usetheme{metropolis}
\usepackage{amsmath, amssymb, mathtools}
\usepackage{booktabs}
\usepackage{xcolor}

\definecolor{bmaccent}{HTML}{6366f1}
\setbeamercolor{frametitle}{fg=white,bg=bmaccent}
\setbeamercolor{title separator}{fg=bmaccent}

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
  提案するアルゴリズムの目的関数は次の通り。
  \[
    \min_{\theta}\;
    \mathcal{L}(\theta) = \frac{1}{N} \sum_{i=1}^{N} \ell(f_\theta(x_i), y_i) + \lambda \|\theta\|^2.
  \]

  \begin{itemize}
    \item $\ell$: 損失関数
    \item $\lambda$: 正則化係数
  \end{itemize}
\end{frame}

\begin{frame}{実験結果}
  \begin{table}
    \centering
    \begin{tabular}{lcc}
      \toprule
      手法 & 精度\,[\%] & 計算時間\,[s] \\
      \midrule
      従来手法 A          & 85.2 & 120 \\
      従来手法 B          & 87.1 &  95 \\
      \textbf{提案手法}    & \textbf{91.8} & \textbf{42} \\
      \bottomrule
    \end{tabular}
  \end{table}

  \vspace{4mm}
  提案手法は精度・計算時間の両面で従来手法を上回る。
\end{frame}

\begin{frame}{結論と今後の課題}
  \begin{itemize}
    \item 提案手法は精度・速度の両面で優れる結果を示した。
    \item 今後はより大規模なデータセットでの検証を行う。
    \item 産業応用への展開も検討する。
  \end{itemize}
\end{frame}

\begin{frame}[standout]
  ご清聴ありがとうございました。
\end{frame}

\end{document}
`;

// ══════════════════════════════════════════
// 12. 手紙 — フォーマルな日本語ビジネスレター
// ══════════════════════════════════════════
const LETTER_LATEX = JA_BASE + String.raw`\geometry{margin=25mm,top=28mm}
\usepackage{setspace}
\hypersetup{hidelinks}
\renewcommand{\baselinestretch}{1.45}

\begin{document}

\begin{flushright}
  令和 6 年 5 月 15 日
\end{flushright}

\noindent
○○株式会社\\
代表取締役\quad ○○\,○○\quad 様

\bigskip

\begin{center}
  \large\textbf{○○のご案内}
\end{center}

\bigskip

\noindent
拝啓\quad 時下ますますご清祥のこととお慶び申し上げます。
平素は格別のご高配を賜り、厚く御礼申し上げます。

このたび下記のとおり、○○について\textbf{ご案内}申し上げます。
ご多忙のところ恐縮ではございますが、ご出席くださいますよう
お願い申し上げます。

\bigskip

\begin{center}
  \textbf{記}
\end{center}

\smallskip

\begin{center}
  \begin{tabular}{r@{\quad}l}
    日\,時 & 令和 6 年 5 月 15 日(水)\quad 14:00 〜 16:00 \\
    場\,所 & 本館 3 階 大会議室 \\
    議\,題 & ○○プロジェクトの進捗報告 \\
    持\,物 & 筆記用具・配布資料 \\
  \end{tabular}
\end{center}

\bigskip

\noindent
ご不明な点がございましたら、担当 (内線: 1234) までお問い合わせください。

\bigskip

\begin{flushright}
  敬具\\[6pt]
  △△株式会社\\
  総務部\quad 担当\quad △△\,△△
\end{flushright}

\end{document}
`;

// ══════════════════════════════════════════════════════════════════════
// English-locale templates (locale === "en" 時に使用)
//
// 設計方針:
// - JA 版と同じ "リアルさ" を維持しつつ、英語圏のユーザーにとって自然な内容に置換
// - luatexja-preset / haranoaji 等の日本語フォント設定を外す
// - 大問→Problem, 第N問→Problem N, 解答→Solution, 採点欄→Score などの語彙統一
// - letter は和文ビジネスレターから英文ビジネスレターに完全差し替え
// - 数式・グラフ・装飾系コマンドは可能な限り JA 版と同型に保つ
// ══════════════════════════════════════════════════════════════════════

/** lualatex でも pdflatex でも通る純英語の共通プリアンブル */
const EN_BASE = String.raw`\documentclass[11pt,a4paper]{article}
\usepackage[T1]{fontenc}
\usepackage{lmodern}
\usepackage{geometry}
\usepackage{amsmath, amssymb, amsthm, mathtools, bm}
\usepackage{enumitem}
\usepackage{booktabs, tabularx, array}
\usepackage{graphicx}
\usepackage{xcolor}
\usepackage{hyperref}
`;

// ──── 1. Blank ────
const BLANK_LATEX_EN = EN_BASE + String.raw`\geometry{margin=22mm}
\hypersetup{hidelinks}

\begin{document}

\end{document}
`;

// ──── 2. Common test (US placement-test style) ────
const COMMON_TEST_LATEX_EN = EN_BASE + String.raw`\geometry{margin=20mm,top=22mm}
${TCB_PREAMBLE}
\usepackage{titlesec}
\usepackage{fancyhdr}
\hypersetup{hidelinks}

\definecolor{ctnavy}{HTML}{1e3a8a}
\definecolor{ctcobalt}{HTML}{2563eb}
\definecolor{ctink}{HTML}{0f172a}

\newtcolorbox{daimon}[2][]{
  enhanced,breakable,
  colback=white,colframe=ctnavy!85,
  fonttitle=\bfseries,coltitle=white,colbacktitle=ctnavy,
  title={#2},
  attach boxed title to top left={xshift=10mm,yshift=-3mm},
  boxed title style={sharp corners,size=small,boxrule=0.4pt},
  sharp corners=south,arc=2mm,
  left=12pt,right=12pt,top=12pt,bottom=10pt,
  boxrule=0.6pt,#1
}

\newcommand{\haiten}[1]{\hfill\textcolor{ctcobalt}{\small\textbf{(#1 pts)}}}

\setlist[enumerate,1]{leftmargin=2.2em,label=(\arabic*),itemsep=0.7em,topsep=0.4em}
\setlist[enumerate,2]{leftmargin=2em,label=(\alph*),itemsep=0.4em}

\pagestyle{fancy}
\fancyhf{}
\fancyhead[L]{\small\color{ctink!75}Math Placement Test}
\fancyhead[R]{\small\color{ctink!75}Form A}
\fancyfoot[C]{\small\color{ctink!50}-\,\thepage\,/\,3\,-}
\renewcommand{\headrulewidth}{0.4pt}

\begin{document}

\begin{center}
  {\fontsize{20pt}{24pt}\selectfont\bfseries\color{ctnavy}Math Placement Test}\\[2mm]
  \textcolor{ctink!70}{\small Form A \quad\textbullet\quad 70 minutes \quad\textbullet\quad 100 points}
\end{center}

\vspace{4mm}

\noindent\textbf{Instructions}
\begin{itemize}[leftmargin=1.6em,itemsep=0.15em]
  \item Show all of your work in the space provided. No credit for unsupported answers.
  \item Calculators are not permitted.
  \item Each problem set is worth the points indicated next to its title.
\end{itemize}

\bigskip

\begin{daimon}{Problem 1\quad Algebra and Functions \haiten{30}}
  Let $f(x) = 2x^2 - 5x + 1$.
  \begin{enumerate}
    \item Find the discriminant of $f(x) = 0$ and determine the number of real solutions.
    \item Solve $f(x) = 0$. Express each root in simplest radical form.
    \item Sketch the parabola $y = f(x)$, indicating the vertex and the $y$-intercept.
  \end{enumerate}
\end{daimon}

\medskip

\begin{daimon}{Problem 2\quad Trigonometry \haiten{35}}
  In triangle $ABC$, $a = 7$, $b = 5$, and $C = 60^\circ$.
  \begin{enumerate}
    \item Find the length of side $c$.
    \item Compute the area $S$ of triangle $ABC$.
    \item Find the radius $R$ of the circumscribed circle.
  \end{enumerate}
\end{daimon}

\medskip

\begin{daimon}{Problem 3\quad Calculus \haiten{35}}
  Let $g(x) = x^3 - 3x$.
  \begin{enumerate}
    \item Find $g'(x)$ and determine the critical points of $g$.
    \item Classify each critical point as a local maximum, local minimum, or neither.
    \item Compute $\int_{-1}^{1} g(x)\,dx$.
  \end{enumerate}
\end{daimon}

\end{document}
`;

// ──── 3. University-style free-response exam ────
const KOKUKO_NIJI_LATEX_EN = EN_BASE + String.raw`\geometry{margin=24mm,top=26mm,bottom=26mm}
\usepackage{titlesec}
\usepackage{fancyhdr}
\usepackage{setspace}
\hypersetup{hidelinks}

\definecolor{kjink}{HTML}{0a0a0a}
\definecolor{kjsoft}{HTML}{4a4a4a}
\definecolor{kjmuted}{HTML}{707070}

\titleformat{\section}
  {\normalfont\Large\bfseries\color{kjink}}
  {\fbox{\textbf{Problem \thesection}}}{0.8em}{}
  [\vspace{2pt}\textcolor{kjmuted}{\rule{\linewidth}{0.4pt}}]

\onehalfspacing

\pagestyle{fancy}
\fancyhf{}
\fancyfoot[C]{\small\color{kjmuted}-\,\thepage\,-}
\renewcommand{\headrulewidth}{0pt}

\begin{document}

\begin{center}
  {\fontsize{18pt}{22pt}\selectfont\bfseries\color{kjink}University Mathematics Entrance Exam}\\[3mm]
  \textcolor{kjsoft}{\small Spring Session \quad\textbullet\quad 150 minutes \quad\textbullet\quad 200 points (out of 4 problems)}
\end{center}

\vspace{6mm}

\noindent\textbf{Notes for candidates}
\begin{itemize}[leftmargin=1.6em,itemsep=0.15em]
  \item Write your full solution, including all reasoning, in the answer booklet.
  \item Each problem is worth 50 points. Partial credit will be awarded.
  \item You may use a non-graphing scientific calculator.
\end{itemize}

\vspace{6mm}

\section{}
Let $C$ be the curve $y = x^3 - 3x$ and let $\ell$ be the line $y = ax + b$ ($a, b \in \mathbb{R}$).
\begin{enumerate}[leftmargin=1.8em,label=(\arabic*),itemsep=0.6em]
  \item Determine the condition on $(a, b)$ such that $\ell$ is tangent to $C$ at exactly one point.
  \item Show that if $\ell$ intersects $C$ at three distinct points $P_1, P_2, P_3$, then the centroid of these points lies on the $y$-axis.
  \item Find the area of the region enclosed by $C$ and the line $y = x$.
\end{enumerate}

\vspace{6mm}

\section{}
Define a sequence $\{a_n\}$ by $a_1 = 1$ and $a_{n+1} = \dfrac{a_n + 2}{a_n + 1}\ (n \geq 1)$.
\begin{enumerate}[leftmargin=1.8em,label=(\arabic*),itemsep=0.6em]
  \item Compute $a_2, a_3, a_4$ and conjecture a closed form for $a_n$.
  \item Prove your conjecture by induction.
  \item Show that $\lim_{n \to \infty} a_n$ exists and find its value.
\end{enumerate}

\vspace{6mm}

\section{}
Let $z$ be a complex number with $|z - 1| = 1$.
\begin{enumerate}[leftmargin=1.8em,label=(\arabic*),itemsep=0.6em]
  \item Sketch the locus of $z$ in the complex plane.
  \item Find the maximum and minimum values of $|z|$.
  \item Determine all $z$ for which $z + \dfrac{1}{z}$ is real.
\end{enumerate}

\end{document}
`;

// ──── 4. School test (periodic test sheet) ────
const SCHOOL_TEST_LATEX_EN = EN_BASE + String.raw`\geometry{margin=18mm,top=22mm}
${TCB_PREAMBLE}
\usepackage{multirow}
\usepackage{titlesec}
\usepackage{fancyhdr}
\hypersetup{hidelinks}

\definecolor{stink}{HTML}{1f2937}
\definecolor{stsoft}{HTML}{6b7280}
\definecolor{stred}{HTML}{dc2626}

\newcommand{\daimonhead}[2]{%
  \par\vspace{4mm}\noindent
  \begin{minipage}{\linewidth}
    \textcolor{stred}{\rule[-0.3em]{3pt}{1.2em}}\quad
    {\large\bfseries\color{stink}Problem #1}\quad #2
  \end{minipage}\par\vspace{2mm}
}

\setlist[enumerate,1]{leftmargin=2em,label=(\arabic*),itemsep=0.6em,topsep=0.3em}

\pagestyle{empty}

\begin{document}

\noindent
\begin{tabularx}{\linewidth}{|l|X|l|X|l|X|}
\hline
{\small Class} & & {\small Number} & & {\small Name} & \\[2pt]
\hline
\end{tabularx}

\vspace{3mm}

\begin{center}
  {\Large\bfseries\color{stink}Algebra II — Quarter Test}\\[2pt]
  \textcolor{stsoft}{\small Tuesday, 2nd period \quad 50 minutes \quad 100 points}
\end{center}

\hfill
\begin{tcolorbox}[width=42mm,colback=white,colframe=stink,sharp corners,boxrule=0.7pt,
  left=4pt,right=4pt,top=2pt,bottom=2pt,nobeforeafter]
  \begin{center}
    {\small\textbf{Score}}\\[2pt]
    {\Large\textcolor{stred}{\hspace{6mm}\rule{15mm}{0.4pt}}}\\[1pt]
    {\small / 100}
  \end{center}
\end{tcolorbox}

\bigskip

\daimonhead{1}{Compute the following.\hfill {\small\textbf{(5 pts each)}}}
\begin{enumerate}
  \item $(2x - 3)(x + 4) - (x - 1)^2$
  \item $\dfrac{x + 1}{x - 2} - \dfrac{x - 1}{x + 2}$
  \item $\sqrt{12} + \sqrt{27} - \sqrt{48}$
\end{enumerate}

\daimonhead{2}{Solve the following equations.\hfill {\small\textbf{(8 pts each)}}}
\begin{enumerate}
  \item $x^2 - 5x + 6 = 0$
  \item $\dfrac{2}{x - 1} + \dfrac{1}{x + 1} = 1$
  \item $\sqrt{x + 3} = x - 3$
\end{enumerate}

\daimonhead{3}{Word problems.\hfill {\small\textbf{(12 pts each)}}}
\begin{enumerate}
  \item A rectangle has perimeter 40 cm and area 96 cm$^2$. Find its side lengths.
  \item Two trains leave the same station travelling in opposite directions. Train A travels at 60 km/h and Train B at 75 km/h. After how many hours are they 405 km apart?
\end{enumerate}

\end{document}
`;

// ──── 5. Cram-school worksheet (tutoring center) ────
const JUKU_LATEX_EN = EN_BASE + String.raw`\geometry{margin=18mm,top=18mm,bottom=20mm}
${TCB_PREAMBLE}
\usepackage{titlesec}
\usepackage{fancyhdr}
\hypersetup{hidelinks}

\definecolor{jkmain}{HTML}{ea580c}
\definecolor{jkpale}{HTML}{fff7ed}
\definecolor{jkink}{HTML}{431407}
\definecolor{jknavy}{HTML}{0c4a6e}

\newcommand{\jukutitle}[2]{%
  \begin{tcolorbox}[enhanced,colback=jkmain,colframe=jkmain,sharp corners,boxrule=0pt,
    left=12pt,right=12pt,top=8pt,bottom=8pt,
    overlay={
      \node[anchor=east,white,font=\small\bfseries] at ([xshift=-8pt]frame.east) {#2};
    }]
    \color{white}\Large\bfseries #1
  \end{tcolorbox}\par
}

\newcommand{\nlevel}[1]{%
  \fcolorbox{jkmain}{white}{\textcolor{jkmain}{\small\textbf{Level #1}}}%
}

\newtcolorbox{kihon}[1]{
  enhanced,breakable,
  colback=jkpale,colframe=jkmain!70,
  borderline west={3pt}{0pt}{jkmain},
  sharp corners,arc=0mm,
  fonttitle=\bfseries,coltitle=jkink,
  title={#1},
  left=10pt,right=10pt,top=8pt,bottom=8pt,
  boxrule=0.4pt,
}

\newtcolorbox{ouyou}[1]{
  enhanced,breakable,
  colback=white,colframe=jknavy!60,
  borderline west={3pt}{0pt}{jknavy},
  sharp corners,arc=0mm,
  fonttitle=\bfseries,coltitle=jknavy,
  title={#1},
  left=10pt,right=10pt,top=8pt,bottom=8pt,
  boxrule=0.4pt,
}

\newtcolorbox{hintbox}{
  enhanced,breakable,
  colback=jkpale!50,colframe=jkmain!40,
  sharp corners,arc=0mm,boxrule=0.4pt,
  left=8pt,right=8pt,top=4pt,bottom=4pt,fontupper=\small,
}
\newtcolorbox{kakuninbox}{
  enhanced,breakable,
  colback=white,colframe=jknavy!30,
  borderline west={2.5pt}{0pt}{jknavy!70},
  sharp corners,arc=0mm,boxrule=0.3pt,
  left=10pt,right=10pt,top=6pt,bottom=6pt,
}

\newcommand{\juKey}[1]{\textcolor{jkmain}{\textbf{#1}}}
\newcommand{\juHint}[1]{\textcolor{jkink!70}{\small\textit{Hint:\,#1}}}
\newcommand{\haiten}[1]{\hfill\textcolor{jkmain}{\small\textbf{(#1 pts)}}}

\setlist[enumerate,1]{leftmargin=2em,label=\textcolor{jkmain}{\textbf{(\arabic*)}},itemsep=0.7em,topsep=0.4em}

\pagestyle{fancy}
\fancyhf{}
\fancyhead[L]{\small\textcolor{jkink}{\textbf{Eddivom Tutoring Center}}}
\fancyhead[R]{\small\textcolor{jkink}{Quadratic Functions\,/\,Lesson 03}}
\renewcommand{\headrulewidth}{0.4pt}

\begin{document}

\jukutitle{Quadratic Functions Mastery}{Lesson 03 \,\textbullet\, Grades 9--10 \,\textbullet\, 90 min}

\smallskip
\noindent
\nlevel{$\bigstar$\,\,$\square$\,\,$\square$}\quad
\nlevel{$\bigstar$\,\,$\bigstar$\,\,$\square$}\quad
\nlevel{$\bigstar$\,\,$\bigstar$\,\,$\bigstar$}\hfill
\textcolor{jkink!70}{\small Target time: 60 min \quad Target score: 70/100}

\medskip

\begin{kakuninbox}
  \textcolor{jknavy}{\textbf{Today's goal}}\quad
  Identify the vertex and axis of any parabola in 30 seconds; describe the location of roots
  using three conditions; sketch max/min functions that depend on a parameter.
\end{kakuninbox}

\bigskip

\noindent\textcolor{jkink!70}{\small\textbf{---  Quick review  ---}}\\[1pt]
\noindent\textcolor{jkink!85}{\small
\juKey{\textcircled{\small 1} Completing the square} $\;ax^2+bx+c=a\!\left(x+\dfrac{b}{2a}\right)^{\!2}-\dfrac{b^2-4ac}{4a}$\quad
\juKey{\textcircled{\small 2} Discriminant} $\;D=b^2-4ac$
}

\bigskip

\begin{kihon}{Basic\quad Level $\bigstar\square\square$\quad Warm-up \haiten{15}}
  Find the vertex and axis of each parabola.
  \begin{enumerate}
    \item $y = x^2 - 6x + 5$
    \item $y = -2 x^2 + 8 x - 3$
    \item $y = 3 (x - 1)^2 + 4$
  \end{enumerate}
  \juHint{(1)(2) need completing the square; (3) is already in vertex form.}
\end{kihon}

\medskip

\begin{kihon}{Standard\quad Level $\bigstar\bigstar\square$\quad Root location \haiten{30}}
  Consider $f(x) = x^2 + a x + 2$.
  \begin{enumerate}
    \item Find the values of $a$ for which $f(x) = 0$ has two distinct real roots.
    \item Find the values of $a$ for which both roots are positive.
    \item Find the values of $a$ for which both roots lie in the interval $-1 < x < 3$.
  \end{enumerate}

  \begin{hintbox}
  \juKey{Three conditions for root location}\\
  $\bullet$ Discriminant: $D > 0$ (two distinct real roots)\\
  $\bullet$ Position of axis: $x = -\dfrac{a}{2}$\\
  $\bullet$ Sign of $f$ at the interval endpoints
  \end{hintbox}
\end{kihon}

\medskip

\begin{ouyou}{Advanced\quad Level $\bigstar\bigstar\bigstar$\quad Parametric max/min \haiten{40}}
  Let $f(x) = x^2 - 2 a x + 3$. Find the maximum value $M(a)$ and the minimum value $m(a)$
  of $f$ on the interval $0 \leq x \leq 2$. Sketch each as a function of $a$.

  \juHint{Split into three cases based on whether the axis $x = a$ is to the left of, inside, or to the right of $[0, 2]$.}
\end{ouyou}

\medskip

\begin{ouyou}{Challenge\quad Level $\bigstar\bigstar\bigstar$\quad Reasoning \haiten{15}}
  The parabola $y = x^2 - 4x + k$ meets the $x$-axis at two distinct points $\mathrm{P}, \mathrm{Q}$,
  and $\mathrm{PQ} = 2\sqrt{3}$. Find the value of $k$.
\end{ouyou}

\bigskip

\noindent
\textcolor{jkink}{\small\textbf{$\blacksquare$ Today's takeaways}}
\begin{kakuninbox}
\textcolor{jkink!90}{\small
$\bullet$ Parabola max/min depends on the \juKey{interval endpoints} and the \juKey{position of the axis}.\\
$\bullet$ Root location is determined by \juKey{discriminant}, \juKey{position of axis}, and \juKey{endpoint signs}.\\
$\bullet$ When a parameter is involved, always split into cases by axis position and draw a diagram.\\
$\bullet$ The chord length is $|\alpha - \beta| = \sqrt{(\alpha+\beta)^2 - 4\alpha\beta}$.
}
\end{kakuninbox}

\bigskip

\noindent\textcolor{jkink!60}{\footnotesize
$\square$ Problems completed: \underline{\hspace{2em}} / 4 \quad
$\square$ Self-score: \underline{\hspace{2em}} / 100 \quad
$\square$ Review next time: \underline{\hspace{6em}}
}

\end{document}
`;

// ──── 6. Lecture note (chapter walkthrough) ────
const KAISETSU_NOTE_LATEX_EN = EN_BASE + String.raw`\geometry{margin=20mm,top=22mm}
${TCB_PREAMBLE}
\usepackage{titlesec}
\usepackage{fancyhdr}
\hypersetup{hidelinks}

\definecolor{knteal}{HTML}{0d9488}
\definecolor{knsky}{HTML}{0284c7}
\definecolor{knpink}{HTML}{e11d48}
\definecolor{knpale}{HTML}{ecfeff}
\definecolor{knink}{HTML}{0f172a}

\titleformat{\section}
  {\normalfont\Large\bfseries\color{knteal}}
  {\textcolor{knteal}{$\blacktriangleright$}\;\thesection.}{0.6em}{}
\titleformat{\subsection}
  {\normalfont\large\bfseries\color{knink}}
  {\thesubsection}{0.5em}{}

\newtcolorbox{teigi}[1][]{
  enhanced,breakable,
  colback=knpale,colframe=knteal,
  fonttitle=\bfseries,coltitle=white,colbacktitle=knteal,
  title={Definition},
  attach boxed title to top left={xshift=8mm,yshift=-3mm},
  boxed title style={sharp corners,size=small},
  sharp corners=south,arc=2mm,
  left=10pt,right=10pt,top=10pt,bottom=10pt,
  boxrule=0.6pt,#1
}
\newtcolorbox{teiri}[1][]{
  enhanced,breakable,
  colback=white,colframe=knsky!85,
  fonttitle=\bfseries,coltitle=white,colbacktitle=knsky,
  title={Theorem},
  attach boxed title to top left={xshift=8mm,yshift=-3mm},
  boxed title style={sharp corners,size=small},
  sharp corners=south,arc=2mm,
  left=10pt,right=10pt,top=10pt,bottom=10pt,
  boxrule=0.6pt,#1
}
\newtcolorbox{reidai}[1][]{
  enhanced,breakable,
  colback=knteal!4,colframe=knteal!50,
  fonttitle=\bfseries,coltitle=knteal,
  title={Worked example},
  sharp corners,arc=0mm,
  left=10pt,right=10pt,top=8pt,bottom=8pt,
  boxrule=0.4pt,#1
}
\newcommand{\chui}[1]{%
  \par\smallskip
  \noindent\textcolor{knpink}{\textbf{!\;Note}}\quad #1\par\smallskip
}

\setlist[enumerate,1]{leftmargin=2em,label=\textbf{(\arabic*)},itemsep=0.5em}

\pagestyle{fancy}
\fancyhf{}
\fancyhead[L]{\small\color{knteal}\textbf{Lecture Notes}}
\fancyhead[R]{\small\color{knink!70}Calculus\,/\,Chapter 3}
\fancyfoot[C]{\small\color{knink!50}-\,\thepage\,-}
\renewcommand{\headrulewidth}{0.4pt}

\begin{document}

\begin{center}
  {\fontsize{20pt}{24pt}\selectfont\bfseries\color{knteal}Chapter 3.\quad Applications of Differentiation}\\[2mm]
  \textcolor{knink!60}{\small \textsl{Tangent lines, the Mean Value Theorem, and beyond}}
\end{center}

\vspace{6mm}

\section{The equation of a tangent line}

\begin{teigi}
  Suppose $f$ is differentiable at $x = a$. The \textbf{tangent line} to the curve
  $y = f(x)$ at the point $(a, f(a))$ is the line through that point with slope $f'(a)$:
  \[
    y - f(a) = f'(a)\,(x - a).
  \]
\end{teigi}

\begin{reidai}
  Find the equation of the tangent line to $y = x^3 - 2x$ at the point $(1, -1)$.

  \medskip
  \textbf{Solution.}\quad
  Let $f(x) = x^3 - 2x$. Then $f'(x) = 3 x^2 - 2$, so $f'(1) = 1$.
  Hence the tangent line is
  \[
    y - (-1) = 1 \cdot (x - 1) \quad\Longleftrightarrow\quad y = x - 2.
  \]
\end{reidai}

\chui{The notion of a tangent line does not apply at points where the function is not differentiable (e.g.\ corners or jumps).}

\section{The Mean Value Theorem}

\begin{teiri}
  Let $f$ be continuous on the closed interval $[a, b]$ and differentiable on the open
  interval $(a, b)$. Then there exists at least one $c$ with $a < c < b$ such that
  \[
    \frac{f(b) - f(a)}{b - a} = f'(c).
  \]
\end{teiri}

\subsection{Practice problems}
\begin{enumerate}
  \item For $f(x) = x^2$ on $[0, 2]$, compute the average rate of change and find a value
        $c$ at which $f'(c)$ equals it.
  \item Verify the Mean Value Theorem for $f(x) = \sqrt{x}$ on $[1, 4]$.
\end{enumerate}

\end{document}
`;

// ──── 7. Worksheet (in-class practice) ────
const WORKSHEET_LATEX_EN = EN_BASE + String.raw`\geometry{margin=18mm,top=18mm,bottom=20mm}
${TCB_PREAMBLE}
\usepackage{titlesec}
\usepackage{fancyhdr}
\hypersetup{hidelinks}

\definecolor{wsteal}{HTML}{0d9488}
\definecolor{wsink}{HTML}{0f172a}
\definecolor{wspale}{HTML}{ecfeff}

% \unit は siunitx / physics / 一部 LaTeX カーネルとの衝突を避けるため \unitbox に改名
\newcommand{\unitbox}[1]{%
  \begin{tcolorbox}[colback=wsteal,colframe=wsteal,sharp corners,boxrule=0pt,
    left=10pt,right=10pt,top=4pt,bottom=4pt]
    \color{white}\textbf{Unit}\quad #1
  \end{tcolorbox}\par
}

\newcommand{\level}[2]{%
  \par\smallskip\noindent
  \begin{tcolorbox}[colback=wspale,colframe=wsteal!60,sharp corners,boxrule=0.4pt,
    left=8pt,right=8pt,top=3pt,bottom=3pt,nobeforeafter,box align=center]
    \textcolor{wsteal}{\textbf{#1}}\quad\textcolor{wsink!70}{\small #2}
  \end{tcolorbox}\par\smallskip
}

\newcounter{anslinecnt}
\newcommand{\anslines}[1]{%
  \par\nobreak\vspace{2pt}%
  \setcounter{anslinecnt}{0}%
  \loop\ifnum\value{anslinecnt}<#1\relax
    \noindent\rule{\linewidth}{0.3pt}\par\vspace{6pt}%
    \stepcounter{anslinecnt}%
  \repeat
}

\newtcolorbox{formulacard}[1]{
  enhanced,breakable,
  colback=wspale,colframe=wsteal,
  sharp corners,arc=0mm,
  fonttitle=\bfseries\small,coltitle=white,colbacktitle=wsteal,
  title={#1},
  attach boxed title to top left={xshift=8mm,yshift=-2mm},
  boxed title style={sharp corners,size=small,boxrule=0pt},
  left=10pt,right=10pt,top=10pt,bottom=8pt,
  boxrule=0.5pt,
}

\setlist[enumerate,1]{leftmargin=2em,label=\textbf{(\arabic*)},itemsep=0.7em}

\pagestyle{fancy}
\fancyhf{}
\fancyhead[L]{\small\color{wsink}\textbf{Practice Worksheet}}
\fancyhead[C]{\small\color{wsink!60}Trigonometry}
\fancyhead[R]{\small\color{wsink}No.\,\rule{15mm}{0.4pt}}
\renewcommand{\headrulewidth}{0.4pt}
\fancyfoot[C]{\small\color{wsink!50}-\,\thepage\,-}

\begin{document}

\begin{center}
  {\Large\bfseries\color{wsink}Trigonometry Practice Worksheet}\\[2pt]
  \textcolor{wsink!60}{\small Algebra II\,/\,Worksheet 04}
\end{center}

\medskip
\noindent
{\small Class\,\rule{15mm}{0.4pt}\quad Number\,\rule{8mm}{0.4pt}\quad
Name\,\rule{45mm}{0.4pt}\hfill Due\,\rule{20mm}{0.4pt}}

\bigskip

\unitbox{Right-triangle definitions / Law of Sines / Law of Cosines}

\begin{formulacard}{Formulas you will use}
\small
$\displaystyle \sin^2\theta+\cos^2\theta=1,\quad \tan\theta=\frac{\sin\theta}{\cos\theta}$\\[3pt]
\textbf{Law of Sines}\quad $\dfrac{a}{\sin A}=\dfrac{b}{\sin B}=\dfrac{c}{\sin C}=2R$\\[3pt]
\textbf{Law of Cosines}\quad $a^2=b^2+c^2-2bc\cos A$\\[3pt]
\textbf{Area}\quad $S=\dfrac{1}{2}bc\sin A$
\end{formulacard}

\medskip

\level{[Basic]}{Special angles\hfill 5 pts each}
\begin{enumerate}
  \item Compute $\sin 30^\circ + \cos 60^\circ$.
  \anslines{2}
  \item Compute $\tan 45^\circ \cdot \sin 60^\circ$.
  \anslines{2}
  \item Compute $\sin^2 30^\circ + \sin^2 45^\circ + \sin^2 60^\circ$.
  \anslines{2}
\end{enumerate}

\level{[Standard]}{Law of Sines / Cosines\hfill 8 pts each}
\begin{enumerate}
  \item In $\triangle ABC$, $a = 7$, $b = 5$, $C = 60^\circ$. Find $c$.
  \anslines{3}
  \item In $\triangle ABC$, $a = 8$, $b = 7$, $c = 5$. Find $\cos A$.
  \anslines{3}
  \item In $\triangle ABC$, the circumradius $R = 5$ and $a = 6$. Find $\sin A$.
  \anslines{2}
\end{enumerate}

\level{[Advanced]}{Casework and area\hfill 13 pts each}
\begin{enumerate}
  \item In $\triangle ABC$, $a = 5$, $b = 7$, $A = 30^\circ$. Find all possible values of $B$.
  \anslines{4}
  \item In $\triangle ABC$, $AB = 6$, $AC = 4$, $\angle BAC = 60^\circ$.
        Find the area $S$ and the circumradius $R$.
  \anslines{4}
\end{enumerate}

\bigskip

\noindent\textcolor{wsink!60}{\footnotesize
Checklist: $\square$ Solved without looking at the formulas\quad $\square$ Drew a diagram\quad $\square$ Included units / degree symbol
}

\end{document}
`;

// ──── 8. English (language arts) worksheet ────
// JA 版は「日本語話者向けの英語学習プリント」だが、EN 版は「英語話者向けの
// 英語 reading & comprehension worksheet (英語の授業用)」として再構成。
const ENGLISH_WORKSHEET_LATEX_EN = EN_BASE + String.raw`\geometry{margin=18mm,top=20mm}
${TCB_PREAMBLE}
\usepackage{multicol}
\usepackage{titlesec}
\usepackage{fancyhdr}
\hypersetup{hidelinks}

\definecolor{enmoss}{HTML}{16a34a}
\definecolor{enink}{HTML}{14532d}
\definecolor{ensoft}{HTML}{f0fdf4}
\definecolor{enaccent}{HTML}{ca8a04}

\titleformat{\section}
  {\normalfont\large\bfseries\color{enmoss}}
  {\textsf{Part \thesection}}{0.6em}{}

\setlist[enumerate,1]{leftmargin=2.4em,label=\textbf{\arabic*.},itemsep=0.7em}

\newtcolorbox{passage}{
  enhanced,breakable,
  colback=ensoft,colframe=enmoss!60,
  sharp corners,arc=0mm,boxrule=0.4pt,
  left=12pt,right=12pt,top=10pt,bottom=10pt,
  fontupper=\small\itshape,
}
\newtcolorbox{vocabbox}{
  enhanced,breakable,
  colback=white,colframe=enaccent!70,
  sharp corners,arc=0mm,boxrule=0.5pt,
  left=10pt,right=10pt,top=8pt,bottom=8pt,
}

\pagestyle{fancy}
\fancyhf{}
\fancyhead[L]{\small\color{enink}English Language Arts\,/\,Reading Unit 02}
\fancyhead[R]{\small\color{enink}\rule{30mm}{0.4pt}}
\renewcommand{\headrulewidth}{0.4pt}

\begin{document}

\begin{center}
  {\Large\bfseries\color{enink}Reading Unit 02 \quad “Curiosity and Discovery”}\\[2pt]
  \textcolor{enink!60}{\small Name \rule{40mm}{0.4pt}\quad Date \rule{25mm}{0.4pt}}
\end{center}

\bigskip

\section{Vocabulary}
\begin{vocabbox}
\small
\begin{tabularx}{\linewidth}{l X | l X}
\textbf{curiosity} & a strong desire to know or learn something
  & \textbf{discover} & to find or learn about for the first time \\
\textbf{progress} & forward movement toward a destination
  & \textbf{venture} & a risky or daring undertaking \\
\textbf{remarkable} & worthy of attention; striking
  & \textbf{innovate} & to introduce something new \\
\textbf{theory} & a supposition explaining something
  & \textbf{evidence} & facts supporting a belief \\
\end{tabularx}
\end{vocabbox}

\section{Reading passage}
\begin{passage}
Curiosity has driven human progress for thousands of years. From the first cave painters
who wondered about the night sky to the scientists who built telescopes and sent rovers
to Mars, our species has always asked “why?” and “what if?”.
Discovery is rarely the work of a single moment. It is the slow accumulation of small
observations, careful experiments, and the willingness to be surprised by an unexpected
result. Even what appears to be a sudden breakthrough is usually the visible tip of a
much longer story of failed attempts and revised theories.
\end{passage}

\section{Comprehension}
Answer in complete sentences.
\begin{enumerate}
  \item According to the passage, what role has curiosity played in human history?
  \item Why does the author say that discovery is “rarely the work of a single moment”?
  \item In your own words, explain what “the visible tip of a much longer story” means.
  \item Think of one modern scientific discovery. How might it illustrate the author's point?
\end{enumerate}

\section{Writing}
Choose \textbf{one} of the prompts below and write a short paragraph (5--7 sentences).
\begin{enumerate}
  \item Describe a time when you were genuinely curious about something. What did you do?
  \item If you could ask any scientist (past or present) one question, what would it be and why?
\end{enumerate}

\end{document}
`;

// ──── 9. Academic article ────
const ARTICLE_LATEX_EN = EN_BASE + String.raw`\geometry{margin=22mm,top=25mm,bottom=25mm}
\usepackage{titlesec}
\usepackage{fancyhdr}
\usepackage{abstract}
\hypersetup{colorlinks=true,linkcolor=blue!60!black,urlcolor=blue!60!black,citecolor=blue!60!black}

\definecolor{aink}{HTML}{0f172a}
\definecolor{aaccent}{HTML}{1e40af}

\titleformat{\section}{\normalfont\large\bfseries\color{aaccent}}{\thesection.}{0.6em}{}
\titleformat{\subsection}{\normalfont\normalsize\bfseries\color{aink}}{\thesubsection}{0.5em}{}

\renewcommand{\abstractnamefont}{\normalfont\bfseries\color{aaccent}}
\renewcommand{\abstracttextfont}{\normalfont\itshape\small}

\pagestyle{fancy}
\fancyhf{}
\fancyhead[R]{\small\color{aink!60}Draft \today}
\fancyfoot[C]{\small\color{aink!50}\thepage}
\renewcommand{\headrulewidth}{0.4pt}

\title{\textbf{\color{aaccent}Template-Driven LaTeX Generation with Large Language Models}}
\author{Jane Doe\thanks{Department of Computer Science, Example University}\\
        \small\texttt{jane.doe@example.edu}}
\date{\today}

\begin{document}
\maketitle

\begin{abstract}
We present a template-driven approach to LaTeX document generation in which a large
language model edits raw LaTeX inside a fixed schema. Our method preserves visual
consistency across documents while still enabling the model to express domain-specific
content, and we report a small user study showing a $\sim$3$\times$ reduction in
formatting-related editing time compared with free-form generation.
\end{abstract}

\section{Introduction}
LaTeX remains the de-facto standard for high-quality typesetting in mathematics, the
sciences, and engineering. Despite its expressive power, authoring LaTeX is notoriously
verbose, and small mistakes can break compilation in opaque ways. Recent work has
explored using large language models (LLMs) to lower this barrier, either by translating
natural-language prompts into LaTeX, or by editing existing LaTeX in place.

In this paper we argue that the most effective interaction model is neither pure
generation nor pure editing, but \emph{template-driven} editing: the model is constrained
to operate inside a known document schema, and the host application enforces structural
invariants on every change.

\section{Related work}
Prior work in this area falls into three broad categories.
\begin{enumerate}
  \item \emph{Free-form generation.} Models are prompted with a high-level description and
        asked to emit a complete LaTeX document. This approach maximizes creativity but
        produces inconsistent visual styles and frequent compile errors.
  \item \emph{In-place editing.} Models are given the current LaTeX and a natural-language
        instruction, and asked to return a diff. This is closer to a real authoring loop
        but still allows the model to introduce arbitrary new commands.
  \item \emph{Template-driven editing.} Models operate inside a fixed schema; the
        application validates every edit. This is the approach we explore.
\end{enumerate}

\section{Method}
Our system maintains the LaTeX source as a single source of truth and exposes it to the
LLM through a small set of editing tools. The key invariants are:
\begin{itemize}
  \item The preamble (\textbackslash documentclass and \textbackslash usepackage) is treated as read-only.
  \item Edits are applied in terms of named segments (sections, paragraphs, list items).
  \item After every edit the system re-parses the LaTeX and rejects any change that
        introduces a structurally invalid state.
\end{itemize}

\section{Experiments}
We evaluated our system in a controlled study with twelve graduate students. Each
participant produced two documents: one using a free-form LLM and one using our
template-driven editor. We measured time-to-completion and the number of formatting
edits required after the LLM finished.

\begin{center}
\begin{tabular}{lcc}
\toprule
\textbf{Condition} & \textbf{Time (min)} & \textbf{Format edits} \\
\midrule
Free-form          & 38.4 $\pm$ 6.1      & 14.2 $\pm$ 3.8 \\
Template-driven    & 22.7 $\pm$ 4.5      & 4.3 $\pm$ 1.6 \\
\bottomrule
\end{tabular}
\end{center}

\section{Conclusion}
Template-driven editing combines the productivity of LLM authoring with the visual
consistency that LaTeX users expect. We hope future work will extend this approach to
collaborative editing and to non-mathematical document genres.

\begin{thebibliography}{9}
  \bibitem{ref1} A. Author, “A study of LaTeX generation with LLMs,”
                 \textit{Proc.\ of CHI}, 2025.
  \bibitem{ref2} B. Researcher, “Constrained generation for structured documents,”
                 \textit{Proc.\ of NeurIPS}, 2024.
\end{thebibliography}

\end{document}
`;

// ──── 10. Technical report ────
const REPORT_LATEX_EN = EN_BASE.replace("article", "report") + String.raw`\geometry{margin=22mm,top=24mm}
${TCB_PREAMBLE}
\usepackage{titlesec}
\hypersetup{colorlinks=true,linkcolor=teal!70!black,urlcolor=teal!70!black}

\definecolor{rpteal}{HTML}{0f766e}
\definecolor{rpink}{HTML}{0f172a}
\definecolor{rppale}{HTML}{f0fdfa}

\titleformat{\chapter}[display]
  {\normalfont\huge\bfseries\color{rpteal}}
  {\textcolor{rpteal}{Chapter \thechapter}}{14pt}
  {\Huge}
  [\vspace{2pt}\textcolor{rpteal}{\rule{\linewidth}{0.6pt}}]

\titleformat{\section}{\normalfont\Large\bfseries\color{rpink}}{\thesection}{0.6em}{}

\newtcolorbox{note}{
  enhanced,breakable,
  colback=rppale,colframe=rpteal!70,
  sharp corners,arc=0mm,
  borderline west={3pt}{0pt}{rpteal},
  left=10pt,right=10pt,top=8pt,bottom=8pt,boxrule=0pt,
}

\title{\textbf{\color{rpteal}System Design Report\\[4pt]}\large\color{rpink}Project Eddivom — Technical Documentation}
\author{Engineering Team\\\small\texttt{engineering@example.com}}
\date{\today}

\begin{document}
\maketitle
\tableofcontents

\chapter{System overview}

\section{Background}
Project Eddivom provides an end-to-end LaTeX authoring environment with built-in AI
assistance, immediate preview, and PDF export. This document describes the system's
architecture, the public API, and the design decisions behind the major subsystems.

\section{Terminology}
\begin{itemize}
  \item \textbf{Document model.} The in-memory representation of a LaTeX file together
        with its template id and metadata.
  \item \textbf{Template.} A starter document plus a fixed set of style invariants
        (packages, color palette, headings, list rules, math style).
  \item \textbf{Segment.} A semantically named span of LaTeX (e.g.\ a paragraph, a section
        heading, a math block) used by the visual editor for in-place editing.
\end{itemize}

\chapter{Architecture}

\section{High-level layout}
The system is split into a Next.js frontend and a FastAPI backend. The backend exposes
endpoints for compilation, AI assistance, OMR (answer-sheet recognition), and grading.

\section{API endpoints}
\begin{center}
\begin{tabular}{lll}
\toprule
\textbf{Path} & \textbf{Method} & \textbf{Description} \\
\midrule
\texttt{/compile}      & POST & Compile LaTeX to PDF \\
\texttt{/agent/chat}   & POST & Stream an AI editing session \\
\texttt{/grading/extract-rubric} & POST & Generate a grading rubric \\
\texttt{/grading/grade} & POST & Grade an uploaded answer sheet \\
\bottomrule
\end{tabular}
\end{center}

\begin{note}
All endpoints stream responses using Server-Sent Events where the underlying operation
is long-running. Clients should use a streaming HTTP client to surface progress to users.
\end{note}

\chapter{Data model}

\section{Documents}
A document is stored as a single LaTeX string. Higher-level structure is recovered on
demand by parsing the source into a list of segments. The parser is intentionally
permissive: any unrecognized syntax falls back to a transparent “container” segment so
that the visual editor never destroys user content.

\section{Templates}
Templates are pure data: a starter LaTeX string and a set of metadata fields. Switching
templates replaces the entire document, so the user is informed before any data loss
occurs.

\end{document}
`;

// ──── 11. Beamer presentation ────
const BEAMER_LATEX_EN = String.raw`\documentclass[aspectratio=169,11pt]{beamer}
\usetheme{metropolis}
\usepackage[T1]{fontenc}
\usepackage{lmodern}
\usepackage{amsmath, amssymb, amsthm, mathtools, bm}
\usepackage{booktabs}
\usepackage{xcolor}

\definecolor{bmaccent}{HTML}{6366f1}
\setbeamercolor{title}{fg=bmaccent}
\setbeamercolor{frametitle}{bg=bmaccent,fg=white}

\title{Template-Driven LaTeX Generation}
\subtitle{An overview of Project Eddivom}
\author{Jane Doe}
\institute{Example University}
\date{\today}

\begin{document}

\begin{frame}
  \titlepage
\end{frame}

\begin{frame}{Outline}
  \tableofcontents
\end{frame}

\section{Background}
\begin{frame}{Background and motivation}
  \begin{itemize}
    \item \textbf{Motivation.} Writing LaTeX is verbose and error-prone.
    \item \textbf{Prior work.} Free-form LLM generation produces inconsistent style.
    \item \textbf{Our contribution.} A template-driven approach that constrains LLM edits.
  \end{itemize}
\end{frame}

\section{Method}
\begin{frame}{Method overview}
  Documents are stored as raw LaTeX. The LLM edits inside a fixed schema, and every
  change is validated by re-parsing the source.
  \[
    \text{Doc}_{n+1} = \text{Validate}\bigl(\text{LLM}(\text{Doc}_n,\;\text{instruction})\bigr)
  \]
\end{frame}

\section{Results}
\begin{frame}{Experimental results}
  \begin{table}
    \centering
    \begin{tabular}{lcc}
      \toprule
      Method            & Accuracy [\%] & Time [s] \\
      \midrule
      Free-form         & 71.2          & 38.4 \\
      Template-driven   & 92.5          & 22.7 \\
      \bottomrule
    \end{tabular}
  \end{table}
\end{frame}

\begin{frame}[standout]
  Thank you!\\[1em]
  \small jane.doe@example.edu
\end{frame}

\end{document}
`;

// ──── 12. Formal English business letter ────
const LETTER_LATEX_EN = EN_BASE + String.raw`\geometry{margin=25mm,top=28mm}
\usepackage{setspace}
\setstretch{1.2}
\hypersetup{hidelinks}

\begin{document}

\begin{flushright}
  Jane Doe\\
  123 Example Street\\
  Cambridge, MA 02139\\
  \texttt{jane.doe@example.com}\\[6pt]
  May 15, 2026
\end{flushright}

\vspace{4mm}

\noindent
Dr.\ John Smith\\
Director of Engineering\\
Acme Industries, Inc.\\
456 Innovation Way\\
San Francisco, CA 94107

\vspace{4mm}

\noindent
Dear Dr.\ Smith,

\vspace{2mm}

\noindent
I hope this letter finds you well. I am writing to formally propose a collaboration
between our research group at Example University and your engineering team at Acme
Industries on the development of a template-driven document authoring system.

Over the past six months, our group has built a prototype that combines a large language
model with a constrained LaTeX editor. Early evaluation suggests a substantial reduction
in authoring time for technical documents, and we believe a joint pilot project would
benefit both organizations.

I would welcome the opportunity to discuss this idea further at your convenience. Please
let me know if a brief introductory call sometime in the next two weeks would be possible.

\vspace{2mm}

\noindent
Thank you for your time and consideration.

\vspace{4mm}

\noindent
Sincerely,\\[18pt]
Jane Doe\\
\small Department of Computer Science\\
\small Example University

\end{document}
`;

// ══════════════════════════════════════════
// Premium-only templates (Premium tier 限定)
//
// Pro 以上で使えるテンプレとは別枠で、本格的な長尺ドキュメント
// (卒論 / 学術論文 / 学会ポスター / 教科書 / 問題集 / 総合模試冊子) を Premium に解放する。
// いずれも 手で組めば数時間〜1 日かかる仕上がりを最初から提供する、というテンプレ指針に沿う。
// ══════════════════════════════════════════

// ──────────────────────────────────────────
// P1. 卒論・修論 (thesis)
// ──────────────────────────────────────────
const THESIS_LATEX = String.raw`\documentclass[11pt,a4paper,openany,twoside]{report}
\usepackage[haranoaji]{luatexja-preset}
\usepackage{geometry}
\geometry{top=30mm,bottom=30mm,inner=32mm,outer=24mm,headheight=14pt}
\usepackage{amsmath, amssymb, amsthm, mathtools, bm}
\usepackage{booktabs, tabularx, array, longtable, multirow}
\usepackage{graphicx}
\usepackage{xcolor}
\usepackage[hidelinks,breaklinks]{hyperref}
\usepackage{fancyhdr}
\usepackage{titlesec}
\usepackage{enumitem}
\usepackage{tcolorbox}
\tcbuselibrary{skins,breakable,theorems}
\usepackage{siunitx}

\definecolor{thesisaccent}{HTML}{1f3a68}
\definecolor{thesissoft}{HTML}{e0e7ff}

% ── 見出しスタイル (大学論文の端正なレイアウト) ──
\titleformat{\chapter}[display]
  {\normalfont\Huge\bfseries\color{thesisaccent}}
  {第 \thechapter 章}{18pt}{\Huge}
\titlespacing*{\chapter}{0pt}{-20pt}{24pt}

\titleformat{\section}[hang]
  {\normalfont\Large\bfseries\color{thesisaccent}}
  {\thesection}{0.8em}{}

% ── ヘッダ・フッタ (奇偶異ページ) ──
\pagestyle{fancy}
\fancyhf{}
\fancyhead[LE]{\small\thepage}
\fancyhead[CE]{\small\leftmark}
\fancyhead[RO]{\small\rightmark}
\fancyhead[LO]{\small\thepage}
\renewcommand{\headrulewidth}{0.3pt}

% ── 定理類 (章番号連動) ──
\theoremstyle{plain}
\newtheorem{theorem}{定理}[chapter]
\newtheorem{proposition}[theorem]{命題}
\newtheorem{lemma}[theorem]{補題}
\newtheorem{corollary}[theorem]{系}

\theoremstyle{definition}
\newtheorem{definition}{定義}[chapter]
\newtheorem{example}{例}[chapter]
\newtheorem{assumption}{仮定}[chapter]

\theoremstyle{remark}
\newtheorem{remark}{注意}[chapter]

\numberwithin{equation}{chapter}

% 記号表用ボックス
\newtcolorbox{gloss}{colback=thesissoft!40,colframe=thesisaccent,left=3mm,right=3mm,top=2mm,bottom=2mm,sharp corners,boxrule=0.4pt}

% ── アルゴリズム疑似コード box (algorithm パッケージの代替) ──
% #1: 題目 (例: "1: 提案アルゴリズム")
\newtcolorbox{algbox}[1]{%
  enhanced, breakable, colback=white, colframe=thesisaccent!85!black,
  sharp corners, boxrule=0.4pt,
  attach boxed title to top left={xshift=5mm,yshift=-3mm},
  boxed title style={colback=thesisaccent, colframe=thesisaccent, sharp corners, boxrule=0pt},
  coltitle=white, fonttitle=\bfseries\small,
  title={アルゴリズム #1},
  left=4mm,right=4mm,top=3mm,bottom=3mm
}

\begin{document}

% ══════════════════════════════════
% 前付け (front matter) ── ローマ数字ページ番号
% ══════════════════════════════════
\pagenumbering{Roman}
\thispagestyle{empty}

% ── 表紙 ──
\begin{titlepage}
  \centering
  \vspace*{25mm}
  \rule{0.8\linewidth}{0.8pt}\par
  \vspace{5mm}
  {\large 令和 \underline{\hspace{10mm}} 年度\par}
  {\Large 卒業論文\par}
  \vspace{2mm}
  \rule{0.8\linewidth}{0.8pt}\par
  \vspace{30mm}
  {\Huge\bfseries\color{thesisaccent} ○○に関する研究\par}
  \vspace{4mm}
  {\LARGE --- $\cdots$ を用いたアプローチ ---\par}
  \vspace{55mm}
  \begin{tabular}{rl}
    学籍番号 & : \ 20XX-XXXX\\[4pt]
    氏\ \ \ \ 名  & : \ △△ △△\\[4pt]
    指導教員 & : \ ○○ 教授\\
  \end{tabular}
  \vfill
  {\large ○○大学 ○○学部 ○○学科\par}
  \vspace{3mm}
  {\large 令和 \underline{\hspace{10mm}} 年 \underline{\hspace{6mm}} 月\par}
\end{titlepage}

% ── 和文要旨 ──
\chapter*{要旨}
\addcontentsline{toc}{chapter}{要旨}
\noindent
本論文では、○○ 分野における △△ 問題に対して新しいアプローチを提案する。従来手法は $O(n^2)$ の計算量を要し、大規模データへの適用が困難であった。提案手法では $\cdots$ を導入することにより計算量を $O(n \log n)$ に削減する。さらに、$\mu$-強凸仮定の下で収束率 $O(1/T)$ を理論的に保証し、公開ベンチマーク 3 種での数値実験により、精度で 4.7\%、計算時間で 2.3 倍の改善を確認した。

\bigskip\noindent\textbf{キーワード:} ○○, △△, ××, 最適化, 機械学習

% ── 英文 Abstract ──
\chapter*{Abstract}
\addcontentsline{toc}{chapter}{Abstract}
\noindent
This thesis addresses the problem of $\cdots$ in the field of $\cdots$. Existing methods require $O(n^2)$ computation and are thus infeasible for large-scale data. The proposed method reduces the complexity to $O(n \log n)$ by introducing $\cdots$. Under the $\mu$-strong-convexity assumption we prove an $O(1/T)$ convergence rate, and numerical experiments on three public benchmarks show a 4.7\% accuracy gain and a 2.3$\times$ speed-up.

\bigskip\noindent\textbf{Keywords:} $\cdots$, optimisation, machine learning

% ── 目次 / 図目次 / 表目次 ──
\tableofcontents
\clearpage
\listoffigures
\clearpage
\listoftables

% ── 記号表 ──
\chapter*{記号一覧}
\addcontentsline{toc}{chapter}{記号一覧}
\begin{gloss}
\renewcommand{\arraystretch}{1.25}
\begin{tabular}{@{}ll@{\hspace{10mm}}l@{}}
  $\mathcal{X} \subseteq \mathbb{R}^d$ & 入力空間        & 次元 $d$ のユークリッド空間の部分集合\\
  $\mathcal{Y} \subseteq \mathbb{R}$   & 出力空間        & 回帰問題では実数値\\
  $\theta \in \mathbb{R}^d$            & パラメータ      & 学習対象\\
  $\mathcal{L}(\theta)$                & 損失関数        & 平均経験損失 $+$ 正則化\\
  $\eta_t$                             & 学習率          & $\eta / \sqrt{t+1}$ と設定\\
  $\mu,\ L$                            & 強凸性・平滑性定数 & $\mathcal{L}$ に対する仮定\\
  $T$                                  & 反復回数        &\\
  $O(\cdot)$                           & ランダウ記法    & 漸近的な上界\\
\end{tabular}
\end{gloss}

% ══════════════════════════════════
% 本編 (main matter) ── 算用数字ページ番号
% ══════════════════════════════════
\cleardoublepage
\pagenumbering{arabic}

\chapter{序論}
\section{研究背景}
近年、○○ 分野では \cite{ref1, ref2} に端を発する一連の研究により、△△ の実現可能性が示されつつある。しかし、既存手法は計算コストが大きく、実用規模のデータに適用するには現実的でない\cite{ref3}。

\section{研究目的と貢献}
本論文の目的は、上記の計算コスト問題を解決する新しいアルゴリズムを設計し、理論と実験の両面からその有効性を示すことである。本研究の貢献を以下にまとめる。
\begin{enumerate}[label=(\arabic*),leftmargin=*]
  \item 計算量を $O(n \log n)$ に削減する新アルゴリズムの提案 (第 \ref{chap:method} 章)
  \item $\mu$-強凸条件下における収束率 $O(1/T)$ の理論保証 (第 \ref{chap:theory} 章)
  \item 公開ベンチマーク 3 種における定量的評価 (第 \ref{chap:exp} 章)
\end{enumerate}

\section{本論文の構成}
本論文は本章を含め全 6 章から構成される。第 \ref{chap:related} 章で関連研究を概観、第 \ref{chap:method} 章で提案手法を、第 \ref{chap:theory} 章でその理論解析を示す。第 \ref{chap:exp} 章で数値実験により有効性を検証し、第 \ref{chap:conclusion} 章で結論と今後の課題を述べる。

\chapter{関連研究}\label{chap:related}
\section{○○ に関する研究の変遷}
○○ の研究は大別して (i) 直接最適化アプローチ、(ii) 間接近似アプローチの 2 つに分類できる。

\subsection{直接最適化アプローチ}
\begin{definition}[○○ 問題]
  入力空間 $\mathcal{X} \subseteq \mathbb{R}^d$ と出力空間 $\mathcal{Y} \subseteq \mathbb{R}$ に対して、写像 $f:\mathcal{X}\to\mathcal{Y}$ の汎化誤差
  \[ \mathcal{R}(f) = \mathbb{E}_{(x,y)\sim\mathcal{D}}[\ell(f(x), y)] \]
  を最小化する問題を \emph{○○ 問題} という。
\end{definition}

Smith ら \cite{ref1} はこの問題を直接解くアルゴリズムを提案したが、反復あたり $O(n^2)$ の計算量を要する。

\subsection{間接近似アプローチ}
\begin{theorem}[既存結果, Jones 2021 \cite{ref2}]
  $\mathcal{L}$ が凸かつ $L$-平滑なとき、近似アルゴリズムの反復は
  \[ \mathcal{L}(\theta_T) - \mathcal{L}(\theta^\ast) \le \frac{2L \|\theta_0 - \theta^\ast\|^2}{T} \]
  を満たす。
\end{theorem}

\section{既存研究の限界と本研究の位置づけ}
従来研究は \textbf{理論} と \textbf{実用} のいずれかを犠牲にしてきた。本研究の立ち位置は、両者を両立する新しいアルゴリズムを設計することにある。

\chapter{提案手法}\label{chap:method}
\section{問題設定}
\begin{assumption}[正則性]\label{asm:smooth}
  損失関数 $\mathcal{L}$ は $\mu$-強凸かつ $L$-平滑であり、$\nabla\mathcal{L}$ は有界な分散を持つ確率的勾配として観測可能であるとする。
\end{assumption}

\section{アルゴリズム}
提案アルゴリズムを以下に示す。

\begin{algbox}{1: 提案アルゴリズム}
\textbf{入力:} 初期値 $\theta_0$, 学習率 $\eta > 0$, 反復回数 $T$ \\
\textbf{出力:} $\theta_T$
\begin{enumerate}[label=\arabic*:,leftmargin=*,itemsep=1pt]
  \item \textbf{for} $t = 0, 1, \dots, T-1$ \textbf{do}
  \item \quad 確率的勾配 $g_t \gets \nabla \mathcal{L}(\theta_t;\xi_t)$
  \item \quad $\eta_t \gets \eta / \sqrt{t + 1}$
  \item \quad $\theta_{t+1} \gets \theta_t - \eta_t\, g_t$
  \item \textbf{end for}
  \item \textbf{return} $\theta_T$
\end{enumerate}
\end{algbox}

反復式は次のようにも書ける。
\begin{equation}\label{eq:sgd}
  \theta_{t+1} = \theta_t - \eta_t \nabla \mathcal{L}(\theta_t;\xi_t), \qquad \eta_t = \frac{\eta}{\sqrt{t+1}}.
\end{equation}

\chapter{理論解析}\label{chap:theory}
\section{収束率}
\begin{theorem}[主定理]\label{thm:main}
  仮定 \ref{asm:smooth} の下で、アルゴリズム 1 の反復 \eqref{eq:sgd} は次を満たす。
  \[ \mathbb{E}\!\left[\mathcal{L}(\theta_T) - \mathcal{L}(\theta^\ast)\right] \le \frac{C}{T}, \]
  ここで $C$ は $\mu, L, \|\theta_0 - \theta^\ast\|$ にのみ依存する正定数である。
\end{theorem}

\begin{proof}[証明の概略]
  標準的な強凸関数に対する確率勾配法の解析に従う。詳細は付録 \ref{appx:proof} を参照。
\end{proof}

\begin{corollary}[サンプル複雑度]
  定理 \ref{thm:main} より、$\epsilon$-最適解を得るには $T = O(1/\epsilon)$ 回の反復で十分である。
\end{corollary}

\begin{remark}
  強凸性の仮定は実用上は緩和可能であり、第 \ref{chap:exp} 章の数値実験では非凸損失関数に対しても良好な挙動を示した。
\end{remark}

\chapter{数値実験}\label{chap:exp}
\section{実験設定}
\begin{table}[h]
  \centering
  \caption{実験環境}\label{tab:env}
  \begin{tabular}{ll}
    \toprule
    項目 & 値\\
    \midrule
    CPU  & Intel Xeon Gold 6248R (24 core)\\
    GPU  & NVIDIA A100 (40\,GB)\\
    RAM  & 256\,GB\\
    OS   & Ubuntu 22.04 LTS\\
    実装 & Python 3.11 + PyTorch 2.1\\
    \bottomrule
  \end{tabular}
\end{table}

\section{データセット}
公開ベンチマーク X, Y, Z を用いた。各データセットの規模を表 \ref{tab:dataset} に示す。
\begin{table}[h]
  \centering
  \caption{実験に用いたデータセット}\label{tab:dataset}
  \begin{tabular}{lrrr}
    \toprule
    & サンプル数 & 特徴数 & クラス数\\
    \midrule
    X & \num{50000}     & 128   & 10\\
    Y & \num{100000}    & 512   & 100\\
    Z & \num{1000000}   & 1024  & 1000\\
    \bottomrule
  \end{tabular}
\end{table}

\section{結果}
表 \ref{tab:results} に既存手法 A, B と提案手法の比較を示す。3 試行の平均 $\pm$ 標準偏差を報告する。
\begin{table}[h]
  \centering
  \caption{精度 [\%] と計算時間 [s] の比較}\label{tab:results}
  \begin{tabular}{lcc}
    \toprule
    手法 & 精度 [\%] & 時間 [s]\\
    \midrule
    既存手法 A     & $85.2 \pm 0.4$          & $120 \pm 3$\\
    既存手法 B     & $87.1 \pm 0.3$          & $95 \pm 2$\\
    \textbf{提案}  & $\mathbf{91.8 \pm 0.2}$ & $\mathbf{42 \pm 1}$\\
    \bottomrule
  \end{tabular}
\end{table}

\section{考察}
提案手法は既存手法 A, B と比較して精度で 4.6--6.6\%、計算時間で 2.3--2.9 倍の改善を達成した。特に大規模データセット Z での差が顕著であり、理論予測 $O(n \log n)$ と整合する。

\chapter{結論}\label{chap:conclusion}
\section{本研究の成果}
本論文では ○○ 問題に対する新しいアルゴリズムを提案し、$\mu$-強凸条件下で $O(1/T)$ の収束率を理論的に保証するとともに、数値実験によりその実用性を確認した。

\section{今後の課題}
\begin{itemize}[leftmargin=*]
  \item 非凸損失関数に対する理論解析の拡張
  \item 分散環境 (Federated Learning) への応用
  \item 他分野 ($\cdots$) への展開
\end{itemize}

% ══════════════════════════════════
% 後付け (back matter)
% ══════════════════════════════════
\appendix
\chapter{定理 \ref{thm:main} の証明詳細}\label{appx:proof}
\section{補題}
\begin{lemma}
  確率的勾配 $g_t$ は $\mathbb{E}[g_t \mid \theta_t] = \nabla\mathcal{L}(\theta_t)$ かつ $\mathbb{E}[\|g_t\|^2 \mid \theta_t] \le \sigma^2$ を満たす。
\end{lemma}

\section{証明}
\begin{proof}[定理 \ref{thm:main} の証明]
  ステップ $t$ での最適値との差を $\Delta_t = \mathcal{L}(\theta_t) - \mathcal{L}(\theta^\ast)$ とおく。強凸性から $\|\theta_t - \theta^\ast\|^2 \le \tfrac{2}{\mu}\Delta_t$。更新式 \eqref{eq:sgd} より
  \begin{align*}
    \|\theta_{t+1} - \theta^\ast\|^2 &= \|\theta_t - \theta^\ast - \eta_t g_t\|^2\\
    &= \|\theta_t - \theta^\ast\|^2 - 2\eta_t \langle g_t, \theta_t - \theta^\ast\rangle + \eta_t^2 \|g_t\|^2.
  \end{align*}
  両辺に $\mathbb{E}[\cdot]$ をとり、$\mu$-強凸性と $L$-平滑性を適用、総和を取ることで
  \[ \mathbb{E}[\Delta_T] \le \frac{C}{T} \]
  を得る。詳細は Shalev-Shwartz らの教科書 \cite{ref4} を参照。
\end{proof}

% ── 参考文献 ──
\begin{thebibliography}{99}
  \bibitem{ref1} Smith, J., Lee, S., "An algorithm for $\cdots$," \emph{Proc.\ of NeurIPS}, pp.~1--10, 20XX.
  \bibitem{ref2} Jones, R., "Approximation methods for $\cdots$," \emph{J. Mach. Learn. Res.}, vol.~22, no.~3, pp.~45--60, 2021.
  \bibitem{ref3} Tanaka, Y., "○○ のサーベイ," \emph{情報処理学会論文誌}, vol.~X, pp.~XX--YY, 20XX.
  \bibitem{ref4} Shalev-Shwartz, S., Ben-David, S., \emph{Understanding Machine Learning: From Theory to Algorithms}, Cambridge Univ.\ Press, 2014.
\end{thebibliography}

% ── 謝辞 ──
\chapter*{謝辞}
\addcontentsline{toc}{chapter}{謝辞}
本研究を進めるにあたり、終始熱心なご指導を賜りました ○○ 教授に深く感謝申し上げます。副指導教員としてご助言を下さった △△ 准教授、日々の議論を通じて多くの示唆をくださった研究室の皆様にも厚く御礼申し上げます。また、本研究は科学研究費補助金 (課題番号 XX-XXXXX) および ○○ 財団の助成を受けて実施されました。ここに記して謝意を表します。

\end{document}
`;

const THESIS_LATEX_EN = String.raw`\documentclass[11pt,a4paper,openany,twoside]{report}
\usepackage[T1]{fontenc}
\usepackage{geometry}
\geometry{top=30mm,bottom=30mm,inner=32mm,outer=24mm,headheight=14pt}
\usepackage{amsmath, amssymb, amsthm, mathtools, bm}
\usepackage{booktabs, tabularx, array, longtable, multirow}
\usepackage{graphicx}
\usepackage{xcolor}
\usepackage[hidelinks,breaklinks]{hyperref}
\usepackage{fancyhdr}
\usepackage{titlesec}
\usepackage{enumitem}
\usepackage{tcolorbox}
\tcbuselibrary{skins,breakable,theorems}
\usepackage{siunitx}

\definecolor{thesisaccent}{HTML}{1f3a68}
\definecolor{thesissoft}{HTML}{e0e7ff}

\titleformat{\chapter}[display]
  {\normalfont\Huge\bfseries\color{thesisaccent}}
  {Chapter \thechapter}{18pt}{\Huge}
\titlespacing*{\chapter}{0pt}{-20pt}{24pt}

\titleformat{\section}[hang]
  {\normalfont\Large\bfseries\color{thesisaccent}}
  {\thesection}{0.8em}{}

\pagestyle{fancy}
\fancyhf{}
\fancyhead[LE]{\small\thepage}
\fancyhead[CE]{\small\leftmark}
\fancyhead[RO]{\small\rightmark}
\fancyhead[LO]{\small\thepage}
\renewcommand{\headrulewidth}{0.3pt}

\theoremstyle{plain}
\newtheorem{theorem}{Theorem}[chapter]
\newtheorem{proposition}[theorem]{Proposition}
\newtheorem{lemma}[theorem]{Lemma}
\newtheorem{corollary}[theorem]{Corollary}

\theoremstyle{definition}
\newtheorem{definition}{Definition}[chapter]
\newtheorem{example}{Example}[chapter]
\newtheorem{assumption}{Assumption}[chapter]

\theoremstyle{remark}
\newtheorem{remark}{Remark}[chapter]

\numberwithin{equation}{chapter}

\newtcolorbox{gloss}{colback=thesissoft!40,colframe=thesisaccent,left=3mm,right=3mm,top=2mm,bottom=2mm,sharp corners,boxrule=0.4pt}

% Pseudo-code algorithm box (stand-in for the algorithm package)
% #1: title suffix, e.g. "1: Proposed algorithm"
\newtcolorbox{algbox}[1]{%
  enhanced, breakable, colback=white, colframe=thesisaccent!85!black,
  sharp corners, boxrule=0.4pt,
  attach boxed title to top left={xshift=5mm,yshift=-3mm},
  boxed title style={colback=thesisaccent, colframe=thesisaccent, sharp corners, boxrule=0pt},
  coltitle=white, fonttitle=\bfseries\small,
  title={Algorithm #1},
  left=4mm,right=4mm,top=3mm,bottom=3mm
}

\begin{document}

% ══════════════════════════════════
% Front matter
% ══════════════════════════════════
\pagenumbering{Roman}
\thispagestyle{empty}

% ── Title page ──
\begin{titlepage}
  \centering
  \vspace*{25mm}
  \rule{0.8\linewidth}{0.8pt}\par
  \vspace{5mm}
  {\large Academic Year 20XX\par}
  {\Large Bachelor / Master Thesis\par}
  \vspace{2mm}
  \rule{0.8\linewidth}{0.8pt}\par
  \vspace{30mm}
  {\Huge\bfseries\color{thesisaccent} A Study on $\cdots$\par}
  \vspace{4mm}
  {\LARGE --- An approach based on $\cdots$ ---\par}
  \vspace{55mm}
  \begin{tabular}{rl}
    Student ID & : \ 20XX-XXXX\\[4pt]
    Author     & : \ Jane Doe\\[4pt]
    Supervisor & : \ Prof.\ A. Example\\
  \end{tabular}
  \vfill
  {\large Department of \dots, Example University\par}
  \vspace{3mm}
  {\large \underline{\hspace{10mm}} 20XX\par}
\end{titlepage}

% ── Abstract ──
\chapter*{Abstract}
\addcontentsline{toc}{chapter}{Abstract}
\noindent
This thesis addresses the problem of $\cdots$ in the field of $\cdots$. Existing methods require $O(n^2)$ computation and are thus infeasible for large-scale data. The proposed method reduces the complexity to $O(n \log n)$ by introducing $\cdots$. Under the $\mu$-strong-convexity assumption we prove an $O(1/T)$ convergence rate, and numerical experiments on three public benchmarks show a 4.7\% accuracy gain and a 2.3$\times$ speed-up.

\bigskip\noindent\textbf{Keywords:} $\cdots$, optimisation, machine learning

% ── TOC / List of figures / tables ──
\tableofcontents
\clearpage
\listoffigures
\clearpage
\listoftables

% ── Nomenclature ──
\chapter*{Nomenclature}
\addcontentsline{toc}{chapter}{Nomenclature}
\begin{gloss}
\renewcommand{\arraystretch}{1.25}
\begin{tabular}{@{}ll@{\hspace{10mm}}l@{}}
  $\mathcal{X} \subseteq \mathbb{R}^d$ & Input space         & Euclidean subset of dim.\ $d$\\
  $\mathcal{Y} \subseteq \mathbb{R}$   & Output space        & Real-valued (regression)\\
  $\theta \in \mathbb{R}^d$            & Parameter           & Learned quantity\\
  $\mathcal{L}(\theta)$                & Loss                & Empirical mean $+$ regulariser\\
  $\eta_t$                             & Learning rate       & Set as $\eta/\sqrt{t+1}$\\
  $\mu,\ L$                            & Strong-convex / smooth constants &\\
  $T$                                  & Number of iterations &\\
  $O(\cdot)$                           & Landau notation     & Asymptotic upper bound\\
\end{tabular}
\end{gloss}

% ══════════════════════════════════
% Main matter
% ══════════════════════════════════
\cleardoublepage
\pagenumbering{arabic}

\chapter{Introduction}
\section{Background}
In recent years, the $\cdots$ field has seen considerable activity around the problem of $\cdots$~\cite{ref1, ref2}. However, existing methods are computationally expensive and not applicable at practical scale~\cite{ref3}.

\section{Objectives and Contributions}
The goal of this thesis is to design a new algorithm that resolves the above computational bottleneck and to evaluate it both theoretically and empirically. The contributions are:
\begin{enumerate}[label=(\arabic*),leftmargin=*]
  \item A new algorithm reducing the complexity to $O(n \log n)$ (Ch.~\ref{chap:method}).
  \item A convergence-rate guarantee of $O(1/T)$ under $\mu$-strong convexity (Ch.~\ref{chap:theory}).
  \item A quantitative evaluation on three public benchmarks (Ch.~\ref{chap:exp}).
\end{enumerate}

\section{Structure of This Thesis}
This thesis is organised in six chapters. Chapter~\ref{chap:related} reviews related work. Chapter~\ref{chap:method} presents the proposed method, and Chapter~\ref{chap:theory} analyses it. Chapter~\ref{chap:exp} reports experimental results, and Chapter~\ref{chap:conclusion} concludes.

\chapter{Related Work}\label{chap:related}
\section{Evolution of Research on $\cdots$}
Prior work falls into (i) direct-optimisation and (ii) indirect-approximation approaches.

\subsection{Direct optimisation}
\begin{definition}[The $\cdots$ problem]
  Given an input space $\mathcal{X} \subseteq \mathbb{R}^d$ and an output space $\mathcal{Y} \subseteq \mathbb{R}$, the problem of minimising the generalisation risk
  \[ \mathcal{R}(f) = \mathbb{E}_{(x,y)\sim\mathcal{D}}[\ell(f(x), y)] \]
  over all measurable maps $f:\mathcal{X}\to\mathcal{Y}$ is called the \emph{$\cdots$ problem}.
\end{definition}

Smith et al.~\cite{ref1} proposed a direct algorithm but required $O(n^2)$ per iteration.

\subsection{Indirect approximation}
\begin{theorem}[Existing result, Jones 2021~\cite{ref2}]
  If $\mathcal{L}$ is convex and $L$-smooth, the iteration satisfies
  \[ \mathcal{L}(\theta_T) - \mathcal{L}(\theta^\ast) \le \frac{2L \|\theta_0 - \theta^\ast\|^2}{T}. \]
\end{theorem}

\chapter{Proposed Method}\label{chap:method}
\section{Problem setting}
\begin{assumption}[Regularity]\label{asm:smooth}
  $\mathcal{L}$ is $\mu$-strongly convex and $L$-smooth, and $\nabla\mathcal{L}$ is observable as a stochastic gradient with bounded variance.
\end{assumption}

\section{Algorithm}
The proposed algorithm is given below.

\begin{algbox}{1: Proposed algorithm}
\textbf{Input:} Initial value $\theta_0$, learning rate $\eta > 0$, iterations $T$ \\
\textbf{Output:} $\theta_T$
\begin{enumerate}[label=\arabic*:,leftmargin=*,itemsep=1pt]
  \item \textbf{for} $t = 0, 1, \dots, T-1$ \textbf{do}
  \item \quad Stochastic gradient $g_t \gets \nabla \mathcal{L}(\theta_t;\xi_t)$
  \item \quad $\eta_t \gets \eta / \sqrt{t + 1}$
  \item \quad $\theta_{t+1} \gets \theta_t - \eta_t\, g_t$
  \item \textbf{end for}
  \item \textbf{return} $\theta_T$
\end{enumerate}
\end{algbox}

\begin{equation}\label{eq:sgd}
  \theta_{t+1} = \theta_t - \eta_t \nabla \mathcal{L}(\theta_t;\xi_t), \qquad \eta_t = \frac{\eta}{\sqrt{t+1}}.
\end{equation}

\chapter{Theoretical Analysis}\label{chap:theory}
\begin{theorem}[Main result]\label{thm:main}
  Under Assumption~\ref{asm:smooth}, iteration \eqref{eq:sgd} of Algorithm 1 satisfies
  \[ \mathbb{E}\!\left[\mathcal{L}(\theta_T) - \mathcal{L}(\theta^\ast)\right] \le \frac{C}{T}, \]
  where $C$ depends only on $\mu, L, \|\theta_0 - \theta^\ast\|$.
\end{theorem}

\begin{proof}[Proof sketch]
  Standard analysis of SGD for $\mu$-strongly convex objectives. See Appendix~\ref{appx:proof} for details.
\end{proof}

\begin{corollary}[Sample complexity]
  $T = O(1/\epsilon)$ iterations suffice to obtain an $\epsilon$-optimal solution.
\end{corollary}

\begin{remark}
  The strong-convexity assumption can be relaxed in practice; experiments show favourable behaviour even for non-convex losses.
\end{remark}

\chapter{Experiments}\label{chap:exp}
\section{Setup}
\begin{table}[h]
  \centering
  \caption{Experimental environment.}\label{tab:env}
  \begin{tabular}{ll}
    \toprule
    Item & Value\\
    \midrule
    CPU        & Intel Xeon Gold 6248R (24 core)\\
    GPU        & NVIDIA A100 (40\,GB)\\
    RAM        & 256\,GB\\
    OS         & Ubuntu 22.04 LTS\\
    Framework  & Python 3.11 + PyTorch 2.1\\
    \bottomrule
  \end{tabular}
\end{table}

\section{Datasets}
\begin{table}[h]
  \centering
  \caption{Datasets.}\label{tab:dataset}
  \begin{tabular}{lrrr}
    \toprule
    & Samples & Features & Classes\\
    \midrule
    X & \num{50000}   & 128   & 10\\
    Y & \num{100000}  & 512   & 100\\
    Z & \num{1000000} & 1024  & 1000\\
    \bottomrule
  \end{tabular}
\end{table}

\section{Results}
\begin{table}[h]
  \centering
  \caption{Accuracy [\%] and wall-clock time [s] (mean $\pm$ SD over 3 runs).}\label{tab:results}
  \begin{tabular}{lcc}
    \toprule
    Method & Accuracy [\%] & Time [s]\\
    \midrule
    Baseline A   & $85.2 \pm 0.4$          & $120 \pm 3$\\
    Baseline B   & $87.1 \pm 0.3$          & $95  \pm 2$\\
    \textbf{Ours}& $\mathbf{91.8 \pm 0.2}$ & $\mathbf{42 \pm 1}$\\
    \bottomrule
  \end{tabular}
\end{table}

The proposed method improves accuracy by 4.6--6.6\% and reduces wall-clock time by 2.3--2.9$\times$.

\chapter{Conclusion}\label{chap:conclusion}
We proposed a new algorithm for the $\cdots$ problem, proved an $O(1/T)$ convergence rate under $\mu$-strong convexity, and validated it numerically. Future directions:
\begin{itemize}[leftmargin=*]
  \item Extension to non-convex losses
  \item Application to federated settings
  \item Deployment in other domains
\end{itemize}

% ══════════════════════════════════
% Back matter
% ══════════════════════════════════
\appendix
\chapter{Proof of Theorem~\ref{thm:main}}\label{appx:proof}
\begin{lemma}
  The stochastic gradient satisfies $\mathbb{E}[g_t \mid \theta_t] = \nabla\mathcal{L}(\theta_t)$ and $\mathbb{E}[\|g_t\|^2 \mid \theta_t] \le \sigma^2$.
\end{lemma}
\begin{proof}[Proof of Theorem~\ref{thm:main}]
  Let $\Delta_t = \mathcal{L}(\theta_t) - \mathcal{L}(\theta^\ast)$. By strong convexity, $\|\theta_t - \theta^\ast\|^2 \le \tfrac{2}{\mu}\Delta_t$. Using \eqref{eq:sgd},
  \begin{align*}
    \|\theta_{t+1} - \theta^\ast\|^2 &= \|\theta_t - \theta^\ast\|^2 - 2\eta_t \langle g_t, \theta_t - \theta^\ast\rangle + \eta_t^2 \|g_t\|^2.
  \end{align*}
  Taking expectations and summing yields $\mathbb{E}[\Delta_T] \le C/T$; see Shalev-Shwartz \& Ben-David~\cite{ref4}.
\end{proof}

\begin{thebibliography}{99}
  \bibitem{ref1} Smith, J., Lee, S., "An algorithm for $\cdots$," \emph{Proc.\ NeurIPS}, pp.~1--10, 20XX.
  \bibitem{ref2} Jones, R., "Approximation methods for $\cdots$," \emph{J. Mach. Learn. Res.}, vol.~22, no.~3, pp.~45--60, 2021.
  \bibitem{ref3} Tanaka, Y., "A survey of $\cdots$," \emph{IPSJ J.}, vol.~X, pp.~XX--YY, 20XX.
  \bibitem{ref4} Shalev-Shwartz, S., Ben-David, S., \emph{Understanding Machine Learning: From Theory to Algorithms}, Cambridge Univ.\ Press, 2014.
\end{thebibliography}

\chapter*{Acknowledgements}
\addcontentsline{toc}{chapter}{Acknowledgements}
I am deeply grateful to my supervisor Prof.\ A.\ Example for his/her continuous guidance throughout this research. I also thank Assoc.\ Prof.\ B.\ Example and the members of our lab for insightful discussions. This work was supported by Grant No.~XX-XXXXX.

\end{document}
`;

// ──────────────────────────────────────────
// P2. 総合模試冊子 (mock-exam-book)
// ──────────────────────────────────────────
const MOCK_EXAM_LATEX = String.raw`\documentclass[11pt,a4paper]{article}
\usepackage[haranoaji]{luatexja-preset}
\usepackage{geometry}
\geometry{top=24mm,bottom=22mm,left=20mm,right=20mm,headheight=14pt,footskip=12mm}
\usepackage{amsmath, amssymb, amsthm, mathtools, bm}
\usepackage{booktabs, tabularx, array, multirow}
\usepackage{graphicx}
\usepackage{xcolor}
\usepackage[hidelinks]{hyperref}
\usepackage{enumitem}
\usepackage{fancyhdr}
\usepackage{tcolorbox}
\tcbuselibrary{skins,breakable}
\usepackage{tikz}
\usetikzlibrary{calc}

\definecolor{mockaccent}{HTML}{b22222}
\definecolor{mocksoft}{HTML}{fee2e2}
\definecolor{mockdark}{HTML}{7f1d1d}

% ── ヘッダ / フッタ (冊子の全ページで統一) ──
\pagestyle{fancy}
\fancyhf{}
\fancyhead[L]{\small\color{mockaccent}\textbf{令和XX年度 第 1 回 総合模擬試験}}
\fancyhead[R]{\small 数学 I $\cdot$ A $\cdot$ II $\cdot$ B}
\fancyfoot[C]{\small --- \thepage\ / \pageref{LastPage} ---}
\fancyfoot[L]{\small 受験番号:\hspace{4mm}\rule{22mm}{0.3pt}}
\fancyfoot[R]{\small 氏名:\hspace{4mm}\rule{35mm}{0.3pt}}
\renewcommand{\headrulewidth}{0.4pt}
\renewcommand{\headrule}{{\color{mockaccent}\hrule width\headwidth height\headrulewidth \vskip-\headrulewidth}}

\usepackage{lastpage}

% ── 難易度バッジ (★:基本、★★:標準、★★★:発展) ──
\newcommand{\diffbadge}[1]{%
  \hspace{4pt}\textcolor{mockaccent}{\small\bfseries #1}%
}

% ── 大問見出し (大問番号 / タイトル / 配点 / 難易度レンジ) ──
\newcommand{\daimon}[4]{%
  \vspace{6mm}%
  \noindent\begin{tcolorbox}[enhanced,colback=mocksoft!40,colframe=mockaccent,sharp corners,boxrule=0.4pt,left=4mm,right=4mm,top=1.5mm,bottom=1.5mm]%
    \textbf{\large\color{mockaccent} 第 #1 問}\quad \textbf{#2} \hfill \small 配点 \textbf{#3}\,点 \quad 難易度 \textbf{#4}%
  \end{tcolorbox}\par%
  \vspace{2mm}%
}

% ── 答欄ボックス (記述用の白枠) ──
\newcommand{\ansbox}[1]{%
  \par\vspace{1mm}%
  \noindent\fbox{\rule{0pt}{#1}\hspace{0.98\linewidth}}\par%
}

% ── マークシート風の選択肢 ──
\newcommand{\markchoice}[5]{%
  \begin{center}%
    \footnotesize\fbox{\ \textcircled{\scriptsize ①}\,#1\ \ \textcircled{\scriptsize ②}\,#2\ \ \textcircled{\scriptsize ③}\,#3\ \ \textcircled{\scriptsize ④}\,#4\ \ \textcircled{\scriptsize ⑤}\,#5\ }%
  \end{center}%
}

\begin{document}

% ══════════════════════════════════
% 表紙
% ══════════════════════════════════
\thispagestyle{empty}
\begin{center}
  \vspace*{12mm}
  {\Huge\bfseries 令和\underline{\hspace{6mm}}年度\par}
  \vspace{6mm}
  {\Huge\bfseries\color{mockaccent} 第 1 回 総合模擬試験\par}
  \vspace{16mm}
  {\LARGE 数学 I $\cdot$ A $\cdot$ II $\cdot$ B\par}
  \vspace{18mm}

  % 受験情報
  \renewcommand{\arraystretch}{1.8}
  \begin{tabular}{|>{\centering\arraybackslash}p{40mm}|p{80mm}|}\hline
    試験時間 & \hspace{3mm} 90 分 (休憩なし)\\\hline
    配\ \ 点  & \hspace{3mm} 合計 200 点\\\hline
    合格基準 & \hspace{3mm} 偏差値 60 相当 (例年 128 点前後)\\\hline
    受験番号 & \\\hline
    氏\ \ \ \ 名  & \\\hline
    会\ \ \ \ 場  & \\\hline
  \end{tabular}

  \vspace{14mm}

  % 試験科目・大問構成 (受験者が全体像を把握できるようにする)
  \renewcommand{\arraystretch}{1.3}
  \begin{tabular}{|c|l|c|c|}\hline
    \rowcolor{mocksoft!60}\textbf{大問} & \textbf{分野}     & \textbf{配点} & \textbf{目安時間}\\\hline
    第 1 問 & 小問集合 (数 I・II)       & 40  & 15 分\\\hline
    第 2 問 & 二次関数・二次不等式     & 50  & 20 分\\\hline
    第 3 問 & 微分・積分                & 50  & 25 分\\\hline
    第 4 問 & 数列・漸化式              & 60  & 30 分\\\hline
    \multicolumn{2}{|r|}{\textbf{合計}} & \textbf{200} & \textbf{90 分}\\\hline
  \end{tabular}

  \vfill
  \fbox{\parbox{140mm}{\centering\bfseries 試験官の指示があるまで この冊子を開かないでください。}}
  \vspace{6mm}
\end{center}
\clearpage

% ══════════════════════════════════
% 注意事項
% ══════════════════════════════════
\section*{\color{mockaccent} 注意事項}
\begin{enumerate}[leftmargin=*,itemsep=4pt]
  \item 試験時間は 90 分です。開始の合図があるまで問題冊子を開かないでください。
  \item 解答はすべて別紙の\textbf{解答用紙}に記入してください。問題冊子への書き込みは採点の対象になりません。
  \item 選択肢のある小問はマークシート式です。該当する番号の $\bigcirc$ を 濃くはっきりと塗りつぶしてください。
  \item 記述式の小問は、結論だけでなく途中式を省略せずに書いてください。途中式に部分点が与えられます。
  \item 数表・電卓・スマートフォンなどの\textbf{電子機器の使用は一切認めません}。
  \item 問題冊子の余白は下書きとして自由に利用してかまいません。
  \item 途中退出は試験開始 45 分後から可能です。退出時は解答用紙を試験官に手渡してください。
  \item 不正行為があった場合、その時点で失格となります。
\end{enumerate}

\vspace{5mm}

\noindent\begin{tcolorbox}[colback=mocksoft!30,colframe=mockaccent,boxrule=0.4pt,sharp corners,left=4mm,right=4mm]
\textbf{持ち物チェックリスト} \ $\Box$ 鉛筆 (HB 以上) \ $\Box$ 消しゴム \ $\Box$ 受験票 \ $\Box$ 時計 (通信機能なし) \ $\Box$ 身分証明書
\end{tcolorbox}

\clearpage

% ══════════════════════════════════
% 大問 1 — 小問集合
% ══════════════════════════════════
\daimon{1}{小問集合}{40}{★〜★★}
\begin{enumerate}[label=(\arabic*),leftmargin=*,itemsep=6mm]
  \item \diffbadge{★} $2x^2 - 5x + 3 = 0$ の解を求めよ。\hfill\textbf{(8 点)}
  \item \diffbadge{★} 点 $(2, 3)$ を通り、傾き $-1$ の直線の方程式を求めよ。\hfill\textbf{(8 点)}
  \item \diffbadge{★★} $\sin 75^\circ$ の値を求めよ。\hfill\textbf{(8 点)}
  \item \diffbadge{★★} 不等式 $|x - 2| < 3$ を解け。\hfill\textbf{(8 点)}
  \item \diffbadge{★★} $\log_3 81 + \log_2 16$ の値を求めよ。\hfill\textbf{(8 点)}
\end{enumerate}

% ══════════════════════════════════
% 大問 2 — 二次関数
% ══════════════════════════════════
\daimon{2}{二次関数}{50}{★★}
放物線 $y = x^2 - 4x + k$ ($k$ は実数) について、次の問いに答えよ。

\begin{center}
\begin{tikzpicture}[scale=0.55]
  % 軸
  \draw[->,gray] (-0.5,0) -- (6,0) node[right,black]{\scriptsize $x$};
  \draw[->,gray] (0,-2) -- (0,5) node[above,black]{\scriptsize $y$};
  % 放物線 (k=3 想定)
  \draw[thick,mockaccent,domain=-0.3:4.3,samples=80] plot(\x,{\x*\x-4*\x+3});
  % 頂点マーク
  \draw[dashed,gray] (2,0)--(2,-1);
  \node[below] at (2,-1) {\scriptsize $(2,\,k-4)$};
  \node[right,mockdark] at (4.3,1.8) {\scriptsize $y=x^2-4x+k$};
\end{tikzpicture}
\end{center}

\begin{enumerate}[label=(\arabic*),leftmargin=*,itemsep=6mm]
  \item \diffbadge{★} 頂点の座標を $k$ で表せ。\hfill\textbf{(10 点)}
  \item \diffbadge{★★} この放物線が $x$ 軸と異なる 2 点で交わるような $k$ の範囲を求めよ。\hfill\textbf{(15 点)}
  \item \diffbadge{★★★} $k = 2$ のとき、放物線と直線 $y = x$ で囲まれる部分の面積 $S$ を求めよ。\hfill\textbf{(25 点)}
\end{enumerate}

% ══════════════════════════════════
% 大問 3 — 微分・積分
% ══════════════════════════════════
\daimon{3}{微分・積分}{50}{★★〜★★★}
関数 $f(x) = x^3 - 3x^2 + 1$ について、次の問いに答えよ。
\begin{enumerate}[label=(\arabic*),leftmargin=*,itemsep=6mm]
  \item \diffbadge{★★} $f(x)$ の極値を求めよ。増減表を書いて示すこと。\hfill\textbf{(25 点)}
  \item \diffbadge{★★★} 曲線 $y = f(x)$ と $x$ 軸で囲まれる部分のうち $x \ge 0$ の領域の面積を求めよ。\hfill\textbf{(25 点)}
\end{enumerate}

% ══════════════════════════════════
% 大問 4 — 数列・漸化式
% ══════════════════════════════════
\daimon{4}{数列・漸化式}{60}{★★★}
数列 $\{a_n\}$ が
\[ a_1 = 1,\qquad a_{n+1} = 2 a_n + 1 \quad (n \ge 1) \]
で定義されている。次の問いに答えよ。
\begin{enumerate}[label=(\arabic*),leftmargin=*,itemsep=6mm]
  \item \diffbadge{★★★} 一般項 $a_n$ を $n$ の式で表せ。\hfill\textbf{(30 点)}
  \item \diffbadge{★★★} $\displaystyle S_n = \sum_{k=1}^{n} a_k$ を $n$ の式で表せ。\hfill\textbf{(30 点)}
\end{enumerate}

\clearpage

% ══════════════════════════════════
% 解答用紙
% ══════════════════════════════════
\thispagestyle{empty}
\begin{center}
  {\LARGE\bfseries\color{mockaccent} 解答用紙} \quad{\small (この用紙のみ採点対象)}
\end{center}

\vspace{2mm}
\noindent
\renewcommand{\arraystretch}{1.5}
\begin{tabular}{|>{\centering\arraybackslash}p{30mm}|p{60mm}||>{\centering\arraybackslash}p{20mm}|p{50mm}|}\hline
  受験番号 & & 氏名 & \\\hline
\end{tabular}

\vspace{4mm}

% ── 大問 1: マークシート式 ──
\noindent\textbf{\color{mockaccent}第 1 問 (マーク式)}\par
\vspace{1mm}
\noindent
\renewcommand{\arraystretch}{1.6}
\begin{tabular}{|c|c|c|c|c|c|c|c|}\hline
  \rowcolor{mocksoft!50}
  小問 & \multicolumn{5}{c|}{\textbf{解答欄} (該当する $\bigcirc$ を塗る)} & 解答値 & 得点\\\hline
  (1) & $\bigcirc\!①$ & $\bigcirc\!②$ & $\bigcirc\!③$ & $\bigcirc\!④$ & $\bigcirc\!⑤$ & & /8\\\hline
  (2) & $\bigcirc\!①$ & $\bigcirc\!②$ & $\bigcirc\!③$ & $\bigcirc\!④$ & $\bigcirc\!⑤$ & & /8\\\hline
  (3) & $\bigcirc\!①$ & $\bigcirc\!②$ & $\bigcirc\!③$ & $\bigcirc\!④$ & $\bigcirc\!⑤$ & & /8\\\hline
  (4) & $\bigcirc\!①$ & $\bigcirc\!②$ & $\bigcirc\!③$ & $\bigcirc\!④$ & $\bigcirc\!⑤$ & & /8\\\hline
  (5) & $\bigcirc\!①$ & $\bigcirc\!②$ & $\bigcirc\!③$ & $\bigcirc\!④$ & $\bigcirc\!⑤$ & & /8\\\hline
\end{tabular}

\vspace{4mm}

% ── 大問 2〜4: 記述式 ──
\noindent\textbf{\color{mockaccent}第 2 問〜第 4 問 (記述式)}\par
\vspace{1mm}
\noindent
\begin{tabularx}{\linewidth}{|>{\centering\arraybackslash}c|>{\centering\arraybackslash}c|X|>{\centering\arraybackslash}c|}\hline
  \rowcolor{mocksoft!50}
  大問 & 小問 & \textbf{解答および途中式} (必要なら裏面も可) & 得点\\\hline
  \multirow{3}{*}{2} & (1) & \rule{0pt}{16mm} & /10\\\cline{2-4}
                     & (2) & \rule{0pt}{16mm} & /15\\\cline{2-4}
                     & (3) & \rule{0pt}{20mm} & /25\\\hline
  \multirow{2}{*}{3} & (1) & \rule{0pt}{20mm} & /25\\\cline{2-4}
                     & (2) & \rule{0pt}{20mm} & /25\\\hline
  \multirow{2}{*}{4} & (1) & \rule{0pt}{20mm} & /30\\\cline{2-4}
                     & (2) & \rule{0pt}{20mm} & /30\\\hline
\end{tabularx}

\vspace{5mm}

% ── 得点集計 ──
\noindent\textbf{\color{mockaccent}得点集計 (採点者記入欄)}\par
\vspace{1mm}
\noindent
\renewcommand{\arraystretch}{1.4}
\begin{tabular}{|>{\centering\arraybackslash}c|>{\centering\arraybackslash}c|>{\centering\arraybackslash}c|>{\centering\arraybackslash}c|>{\centering\arraybackslash}c|>{\centering\arraybackslash}c|}\hline
  \rowcolor{mocksoft!50}
  第 1 問 & 第 2 問 & 第 3 問 & 第 4 問 & 合計 & 偏差値 (自動記入)\\\hline
  \ /40 & \ /50 & \ /50 & \ /60 & \ / \textbf{200} &\\\hline
\end{tabular}

\vspace{4mm}

\noindent\begin{tcolorbox}[colback=mocksoft!30,colframe=mockaccent,boxrule=0.4pt,sharp corners,left=3mm,right=3mm,top=1.5mm,bottom=1.5mm]
\small\textbf{採点基準}\quad 最終解答の一致 $+$ 途中式の論理性で評価。途中式不備は最大 50\% 減点、最終解答のみの記入は最大 70\% 減点。
\end{tcolorbox}

\end{document}
`;

const MOCK_EXAM_LATEX_EN = String.raw`\documentclass[11pt,a4paper]{article}
\usepackage[T1]{fontenc}
\usepackage{geometry}
\geometry{top=24mm,bottom=22mm,left=20mm,right=20mm,headheight=14pt,footskip=12mm}
\usepackage{amsmath, amssymb, amsthm, mathtools, bm}
\usepackage{booktabs, tabularx, array, multirow}
\usepackage{graphicx}
\usepackage{xcolor}
\usepackage[hidelinks]{hyperref}
\usepackage{enumitem}
\usepackage{fancyhdr}
\usepackage{tcolorbox}
\tcbuselibrary{skins,breakable}
\usepackage{tikz}
\usepackage{lastpage}

\definecolor{mockaccent}{HTML}{b22222}
\definecolor{mocksoft}{HTML}{fee2e2}
\definecolor{mockdark}{HTML}{7f1d1d}

\pagestyle{fancy}
\fancyhf{}
\fancyhead[L]{\small\color{mockaccent}\textbf{Academic Year 20XX — Mock Examination 1}}
\fancyhead[R]{\small Mathematics I $\cdot$ A $\cdot$ II $\cdot$ B}
\fancyfoot[C]{\small --- \thepage\ / \pageref{LastPage} ---}
\fancyfoot[L]{\small Student ID:\hspace{4mm}\rule{22mm}{0.3pt}}
\fancyfoot[R]{\small Name:\hspace{4mm}\rule{35mm}{0.3pt}}
\renewcommand{\headrulewidth}{0.4pt}
\renewcommand{\headrule}{{\color{mockaccent}\hrule width\headwidth height\headrulewidth \vskip-\headrulewidth}}

\newcommand{\diffbadge}[1]{\hspace{4pt}\textcolor{mockaccent}{\small\bfseries #1}}

\newcommand{\daimon}[4]{%
  \vspace{6mm}%
  \noindent\begin{tcolorbox}[enhanced,colback=mocksoft!40,colframe=mockaccent,sharp corners,boxrule=0.4pt,left=4mm,right=4mm,top=1.5mm,bottom=1.5mm]%
    \textbf{\large\color{mockaccent} Problem #1}\quad \textbf{#2} \hfill \small \textbf{#3}\,pts\ \ Level \textbf{#4}%
  \end{tcolorbox}\par%
  \vspace{2mm}%
}

\begin{document}

% ══════════════════════════════════
% Cover page
% ══════════════════════════════════
\thispagestyle{empty}
\begin{center}
  \vspace*{12mm}
  {\Huge\bfseries Academic Year 20XX\par}
  \vspace{6mm}
  {\Huge\bfseries\color{mockaccent} Mock Examination 1\par}
  \vspace{16mm}
  {\LARGE Mathematics I $\cdot$ A $\cdot$ II $\cdot$ B\par}
  \vspace{18mm}

  \renewcommand{\arraystretch}{1.8}
  \begin{tabular}{|>{\centering\arraybackslash}p{40mm}|p{80mm}|}\hline
    Duration       & \hspace{3mm} 90 min (no break)\\\hline
    Total points   & \hspace{3mm} 200\\\hline
    Pass threshold & \hspace{3mm} $\approx$ 128 (deviation 60)\\\hline
    Student ID     & \\\hline
    Name           & \\\hline
    Room           & \\\hline
  \end{tabular}

  \vspace{14mm}

  \renewcommand{\arraystretch}{1.3}
  \begin{tabular}{|c|l|c|c|}\hline
    \rowcolor{mocksoft!60}\textbf{Problem} & \textbf{Topic} & \textbf{Points} & \textbf{Target time}\\\hline
    1 & Short questions (I/II)      & 40  & 15 min\\\hline
    2 & Quadratic functions         & 50  & 20 min\\\hline
    3 & Calculus                    & 50  & 25 min\\\hline
    4 & Sequences \& recurrences    & 60  & 30 min\\\hline
    \multicolumn{2}{|r|}{\textbf{Total}} & \textbf{200} & \textbf{90 min}\\\hline
  \end{tabular}

  \vfill
  \fbox{\parbox{140mm}{\centering\bfseries Do not open this booklet until instructed.}}
  \vspace{6mm}
\end{center}
\clearpage

% ══════════════════════════════════
% Instructions
% ══════════════════════════════════
\section*{\color{mockaccent} Instructions}
\begin{enumerate}[leftmargin=*,itemsep=4pt]
  \item The duration is 90 minutes. Do not open the booklet before the start signal.
  \item Write all answers on the \textbf{answer sheet} at the end. Writing in the booklet is not graded.
  \item Multiple-choice items use a mark-sheet format — fill in the matching $\bigcirc$ cleanly.
  \item For free-response items, show your working; partial credit is given.
  \item Calculators, phones, and any other electronic device are \textbf{strictly prohibited}.
  \item Early exit is permitted 45 minutes after the start signal.
  \item Dishonest conduct results in immediate disqualification.
\end{enumerate}

\vspace{5mm}\noindent
\begin{tcolorbox}[colback=mocksoft!30,colframe=mockaccent,boxrule=0.4pt,sharp corners]
\textbf{Checklist}\ $\Box$ Pencil (HB+) \ $\Box$ Eraser \ $\Box$ Admission ticket \ $\Box$ Watch (no smart-watch) \ $\Box$ Photo ID
\end{tcolorbox}

\clearpage

% ══════════════════════════════════
% Problem 1
% ══════════════════════════════════
\daimon{1}{Short questions}{40}{★--★★}
\begin{enumerate}[label=(\arabic*),leftmargin=*,itemsep=6mm]
  \item \diffbadge{★} Solve $2x^2 - 5x + 3 = 0$.\hfill\textbf{(8 pts)}
  \item \diffbadge{★} Find the line through $(2,3)$ with slope $-1$.\hfill\textbf{(8 pts)}
  \item \diffbadge{★★} Evaluate $\sin 75^\circ$.\hfill\textbf{(8 pts)}
  \item \diffbadge{★★} Solve $|x-2| < 3$.\hfill\textbf{(8 pts)}
  \item \diffbadge{★★} Evaluate $\log_3 81 + \log_2 16$.\hfill\textbf{(8 pts)}
\end{enumerate}

% ══════════════════════════════════
% Problem 2
% ══════════════════════════════════
\daimon{2}{Quadratic functions}{50}{★★}
Consider the parabola $y = x^2 - 4x + k$ ($k \in \mathbb{R}$).

\begin{center}
\begin{tikzpicture}[scale=0.55]
  \draw[->,gray] (-0.5,0) -- (6,0) node[right,black]{\scriptsize $x$};
  \draw[->,gray] (0,-2) -- (0,5) node[above,black]{\scriptsize $y$};
  \draw[thick,mockaccent,domain=-0.3:4.3,samples=80] plot(\x,{\x*\x-4*\x+3});
  \draw[dashed,gray] (2,0)--(2,-1);
  \node[below] at (2,-1) {\scriptsize $(2,\,k-4)$};
  \node[right,mockdark] at (4.3,1.8) {\scriptsize $y=x^2-4x+k$};
\end{tikzpicture}
\end{center}

\begin{enumerate}[label=(\arabic*),leftmargin=*,itemsep=6mm]
  \item \diffbadge{★} Express the vertex in terms of $k$.\hfill\textbf{(10 pts)}
  \item \diffbadge{★★} Find the range of $k$ such that the parabola meets the $x$-axis at two distinct points.\hfill\textbf{(15 pts)}
  \item \diffbadge{★★★} For $k=2$, find the area bounded by the parabola and the line $y=x$.\hfill\textbf{(25 pts)}
\end{enumerate}

% ══════════════════════════════════
% Problem 3
% ══════════════════════════════════
\daimon{3}{Calculus}{50}{★★--★★★}
Let $f(x) = x^3 - 3x^2 + 1$.
\begin{enumerate}[label=(\arabic*),leftmargin=*,itemsep=6mm]
  \item \diffbadge{★★} Find all local extrema of $f(x)$ (show the sign table).\hfill\textbf{(25 pts)}
  \item \diffbadge{★★★} Find the area bounded by $y=f(x)$ and the $x$-axis for $x \ge 0$.\hfill\textbf{(25 pts)}
\end{enumerate}

% ══════════════════════════════════
% Problem 4
% ══════════════════════════════════
\daimon{4}{Sequences \& recurrences}{60}{★★★}
A sequence $\{a_n\}$ is defined by $a_1 = 1,\ a_{n+1} = 2a_n + 1$ $(n \ge 1)$.
\begin{enumerate}[label=(\arabic*),leftmargin=*,itemsep=6mm]
  \item \diffbadge{★★★} Find the general term $a_n$ in closed form.\hfill\textbf{(30 pts)}
  \item \diffbadge{★★★} Express $S_n = \sum_{k=1}^n a_k$ in closed form.\hfill\textbf{(30 pts)}
\end{enumerate}

\clearpage

% ══════════════════════════════════
% Answer sheet
% ══════════════════════════════════
\thispagestyle{empty}
\begin{center}
  {\LARGE\bfseries\color{mockaccent} Answer Sheet}\quad{\small (graded page only)}
\end{center}

\vspace{2mm}
\noindent
\renewcommand{\arraystretch}{1.5}
\begin{tabular}{|>{\centering\arraybackslash}p{30mm}|p{60mm}||>{\centering\arraybackslash}p{20mm}|p{50mm}|}\hline
  Student ID & & Name & \\\hline
\end{tabular}

\vspace{4mm}

\noindent\textbf{\color{mockaccent}Problem 1 — Multiple choice (mark)}\par
\vspace{1mm}\noindent
\renewcommand{\arraystretch}{1.6}
\begin{tabular}{|c|c|c|c|c|c|c|c|}\hline
  \rowcolor{mocksoft!50}
  Part & \multicolumn{5}{c|}{\textbf{Mark one}} & Value & Score\\\hline
  (1) & $\bigcirc\!①$ & $\bigcirc\!②$ & $\bigcirc\!③$ & $\bigcirc\!④$ & $\bigcirc\!⑤$ & & /8\\\hline
  (2) & $\bigcirc\!①$ & $\bigcirc\!②$ & $\bigcirc\!③$ & $\bigcirc\!④$ & $\bigcirc\!⑤$ & & /8\\\hline
  (3) & $\bigcirc\!①$ & $\bigcirc\!②$ & $\bigcirc\!③$ & $\bigcirc\!④$ & $\bigcirc\!⑤$ & & /8\\\hline
  (4) & $\bigcirc\!①$ & $\bigcirc\!②$ & $\bigcirc\!③$ & $\bigcirc\!④$ & $\bigcirc\!⑤$ & & /8\\\hline
  (5) & $\bigcirc\!①$ & $\bigcirc\!②$ & $\bigcirc\!③$ & $\bigcirc\!④$ & $\bigcirc\!⑤$ & & /8\\\hline
\end{tabular}

\vspace{4mm}

\noindent\textbf{\color{mockaccent}Problems 2--4 — Free response (show work)}\par
\vspace{1mm}\noindent
\begin{tabularx}{\linewidth}{|>{\centering\arraybackslash}c|>{\centering\arraybackslash}c|X|>{\centering\arraybackslash}c|}\hline
  \rowcolor{mocksoft!50}
  Problem & Part & \textbf{Answer / working} (use back if needed) & Score\\\hline
  \multirow{3}{*}{2} & (1) & \rule{0pt}{16mm} & /10\\\cline{2-4}
                     & (2) & \rule{0pt}{16mm} & /15\\\cline{2-4}
                     & (3) & \rule{0pt}{20mm} & /25\\\hline
  \multirow{2}{*}{3} & (1) & \rule{0pt}{20mm} & /25\\\cline{2-4}
                     & (2) & \rule{0pt}{20mm} & /25\\\hline
  \multirow{2}{*}{4} & (1) & \rule{0pt}{20mm} & /30\\\cline{2-4}
                     & (2) & \rule{0pt}{20mm} & /30\\\hline
\end{tabularx}

\vspace{5mm}

\noindent\textbf{\color{mockaccent}Score summary (grader use)}\par
\vspace{1mm}\noindent
\renewcommand{\arraystretch}{1.4}
\begin{tabular}{|>{\centering\arraybackslash}c|>{\centering\arraybackslash}c|>{\centering\arraybackslash}c|>{\centering\arraybackslash}c|>{\centering\arraybackslash}c|>{\centering\arraybackslash}c|}\hline
  \rowcolor{mocksoft!50}
  Prob 1 & Prob 2 & Prob 3 & Prob 4 & Total & Deviation\\\hline
  \ /40 & \ /50 & \ /50 & \ /60 & \ / \textbf{200} &\\\hline
\end{tabular}

\vspace{4mm}\noindent
\begin{tcolorbox}[colback=mocksoft!30,colframe=mockaccent,boxrule=0.4pt,sharp corners]
\small\textbf{Grading policy}\quad Final answer $+$ logical working. Missing working: up to 50\% deducted; final answer only: up to 70\% deducted.
\end{tcolorbox}

\end{document}
`;

// ──────────────────────────────────────────
// P3. 学会ポスター (academic-poster, A0 portrait)
// ──────────────────────────────────────────
const POSTER_LATEX = String.raw`% A0 縦ポスター — 極限までコンパイルを軽量化した版
% ─────────────────────────────────────────────────────────────────────
% LuaLaTeX の font-load コストを最小化するため:
%   - 使用する \fontsize は 6 サイズだけに集約 (マクロ化)
%   - tcolorbox を使わず colorbox / minipage だけで装飾
%   - システム図は TikZ でなく tabular ベース
% ─────────────────────────────────────────────────────────────────────
\documentclass[20pt]{article}
\usepackage[haranoaji]{luatexja-preset}
\usepackage[paperwidth=841mm,paperheight=1189mm,top=28mm,bottom=26mm,left=24mm,right=24mm]{geometry}
\usepackage{amsmath, amssymb, mathtools, bm}
\usepackage{graphicx}
\usepackage{booktabs, colortbl, array}
\usepackage{xcolor}
\usepackage{multicol}
\usepackage{anyfontsize}
\usepackage{enumitem}

\pagestyle{empty}
\setlength{\parindent}{0pt}
\setlength{\parskip}{6mm}
\setlength{\columnsep}{20mm}
\setlength{\columnseprule}{0pt}
\setlength{\fboxsep}{0pt}

% ── フォントサイズは 6 種だけ (1 回のみ font-load で済む) ──
% 高速化のため、これ以外のサイズは使わない。
\newcommand{\fontXL}{\fontsize{76pt}{88pt}\selectfont}      % 主タイトル
\newcommand{\fontL}{\fontsize{44pt}{52pt}\selectfont}        % サブタイトル
\newcommand{\fontM}{\fontsize{34pt}{42pt}\selectfont}        % ブロック見出し + 著者名
\newcommand{\fontSM}{\fontsize{26pt}{34pt}\selectfont}       % 本文
\newcommand{\fontS}{\fontsize{22pt}{28pt}\selectfont}        % 所属・キャプション・小文字
\newcommand{\fontKey}{\fontsize{64pt}{72pt}\selectfont}      % Key Finding の巨大数字

% A0 本文の default を 26pt に統一
\renewcommand{\normalsize}{\fontSM}
\normalsize

\setlist[itemize]{leftmargin=1.4em,itemsep=3mm,topsep=2mm,parsep=0pt}
\setlist[enumerate]{leftmargin=1.6em,itemsep=3mm,topsep=2mm,parsep=0pt}

\raggedcolumns

% ── カラーテーマ ──
\definecolor{posterbg}{HTML}{0f172a}
\definecolor{posteraccent}{HTML}{f59e0b}
\definecolor{postersoft}{HTML}{fff7ed}
\definecolor{posterkey}{HTML}{dc2626}
\definecolor{posterblue}{HTML}{2563eb}
\definecolor{postergreen}{HTML}{059669}

% ── 高速 block header (colorbox + minipage、tcolorbox 不使用) ──
\newcommand{\blockhead}[2][posterbg]{%
  \par\vspace{6mm}%
  \noindent\colorbox{#1}{%
    \begin{minipage}{\linewidth}%
      \vspace{5mm}\hspace{8mm}{\color{white}\fontM\bfseries #2}\vspace{5mm}%
    \end{minipage}%
  }\par\nobreak\vspace{5mm}%
}

% ── タブルでフローチャートを描く軽量ボックス (TikZ 不使用) ──
% #1: 色 (posterbg / posterkey)  #2: 本文
\newcommand{\flowbox}[2]{%
  \fcolorbox{#1}{postersoft}{\parbox[c][18mm][c]{60mm}{\centering\fontS\bfseries #2}}%
}
\newcommand{\flowboxhl}[1]{%
  \fcolorbox{posterkey}{posterkey!15}{\parbox[c][18mm][c]{60mm}{\centering\fontS\bfseries #1}}%
}
% arrow as colored right-pointing triangle text
\newcommand{\arr}{\textcolor{posterbg}{\(\;\Rightarrow\;\)}}
\newcommand{\darr}{\textcolor{posterbg}{\(\Downarrow\)}}

\begin{document}

% ══════════════════════════════════════════════
% タイトルバー
% ══════════════════════════════════════════════
\noindent
\begin{minipage}[c]{0.14\linewidth}\centering
  \fbox{\parbox[c][80mm][c]{100mm}{\centering\fontS LOGO\\(所属 1)}}
\end{minipage}%
\hfill
\begin{minipage}[c]{0.68\linewidth}\centering
  {\color{posterbg}\fontXL\bfseries 研究ポスタータイトル\par}
  \vspace{5mm}
  {\color{posterbg!85}\fontL\bfseries ── $\cdots$ への新しいアプローチ ──\par}
  \vspace{8mm}
  {\color{posterbg!80}\fontM 山田 太郎$^{\mathsf{1,\dagger}}$\quad 鈴木 花子$^{\mathsf{2}}$\quad 佐藤 一郎$^{\mathsf{1}}$\par}
  \vspace{3mm}
  {\color{posterbg!65}\fontS $^{\mathsf{1}}$ ○○大学 \quad $^{\mathsf{2}}$ △△研究所 \quad $\dagger$ \texttt{yamada@example.ac.jp}\par}
\end{minipage}%
\hfill
\begin{minipage}[c]{0.14\linewidth}\centering
  \fbox{\parbox[c][80mm][c]{100mm}{\centering\fontS LOGO\\(所属 2)}}
\end{minipage}

\vspace{8mm}
{\color{posteraccent}\hrule height 6pt}
\vspace{8mm}

% ══════════════════════════════════════════════
% 3 段組本体
% ══════════════════════════════════════════════
\begin{multicols}{3}

% ─── 左カラム ───
\blockhead{1. 背景と課題}
近年 ○○ 分野では $\cdots$ の研究が急速に発展している。しかし従来手法は:
\begin{itemize}
  \item 計算コストが高い ── $n$ に対し $O(n^2)$
  \item 大規模データ ($n \ge 10^6$) への適用が非現実的
  \item 並列化・分散化が困難
  \item 理論保証と実用性能のギャップ
\end{itemize}
本研究はこの計算コスト問題を解決する新アルゴリズムを提案する。

\blockhead{2. 目的と貢献}
\begin{itemize}
  \item 計算量 $O(n^2) \to O(n \log n)$ に削減
  \item $\mu$-強凸下における収束率 $O(1/T)$ の理論保証
  \item 公開ベンチマーク 3 種 (最大 \textbf{100 万件}) の定量評価
  \item 非凸損失 (ResNet-50) への経験的拡張
  \item 分散環境でのスケーラビリティ保証
\end{itemize}

\vspace{6mm}
\noindent\colorbox{posterkey!12}{%
  \begin{minipage}{\linewidth}%
    \vspace{8mm}
    \centering
    {\fontM\bfseries\color{posterkey} Key Finding\par}
    \vspace{5mm}
    {\fontKey\bfseries\color{posterkey} $+$\,\textbf{4.7\%}\quad $\times$\,\textbf{2.3}\par}
    \vspace{5mm}
    {\fontS\color{posterkey!80!black} 精度向上 (pt)\hspace{22mm}高速化 (倍)\par}
    \vspace{3mm}
    {\fontS 大規模データ Z (1M件) で最大の改善\par}
    \vspace{8mm}
  \end{minipage}%
}
\vspace{6mm}

\blockhead{3. システム全体像}
\centering
\renewcommand{\arraystretch}{1.4}
\setlength{\tabcolsep}{4mm}
\begin{tabular}{@{}ccc@{}}
  \flowbox{posterbg}{入力 $x$} & \arr & \flowbox{posterbg}{特徴抽出 $\phi(x)$} \\
  & & \darr \\
  \flowbox{posterbg}{出力 $\hat y$} & & \flowboxhl{提案 SGD\\$O(n \log n)$} \\
  \darr & & \darr \\
  \flowbox{posterbg}{推論 $f_{\theta^\ast}(x')$} & \(\Leftarrow\) & \flowbox{posterbg}{学習済 $\theta^\ast$} \\
\end{tabular}
\raggedright

\columnbreak

% ─── 中央カラム ───
\blockhead[posterblue]{4. 提案手法}
\textbf{\color{posterblue}問題設定.}\quad 目的関数:
\[ \min_{\theta}\ \mathcal{L}(\theta) = \tfrac{1}{N}\sum_{i=1}^{N} \ell(f_\theta(x_i), y_i) + \lambda \|\theta\|^2. \]

\textbf{\color{posterblue}学習.}\quad SGD で反復:
\[ \theta_{t+1} = \theta_t - \eta_t \nabla \mathcal{L}(\theta_t;\xi_t), \quad \eta_t = \frac{\eta}{\sqrt{t+1}}. \]

\textbf{\color{posterblue}核心.}\quad 特徴空間の階層分解で勾配計算を $O(n^2) \to O(n \log n)$ に:
\begin{itemize}
  \item \textbf{Step 1.}\ 特徴空間を $\log n$ 段の木に分割
  \item \textbf{Step 2.}\ 各段で部分勾配を並列計算
  \item \textbf{Step 3.}\ 木を逆順にたどり合成 ($O(n)$)
  \item $L$-平滑性を保ち、収束保証を維持
\end{itemize}

\blockhead[posterblue]{5. 理論保証}
\textbf{\color{posterblue}定理 1 (収束率).}\quad $\mu$-強凸・$L$-平滑下で
\[ \mathbb{E}\!\left[\mathcal{L}(\theta_T) - \mathcal{L}(\theta^\ast)\right] \le \frac{C}{T}. \]
\textbf{\color{posterblue}定理 2 (複雑度).}\quad $\epsilon$-最適解に $T = O(1/\epsilon)$ で到達。

\begin{itemize}
  \item 収束率 $O(1/T)$ (強凸仮定下)
  \item サンプル複雑度 $O(d \log d)$
  \item 非凸損失でも大域最適付近では同等挙動
\end{itemize}

\blockhead[posterblue]{6. データセット}
\centering
\renewcommand{\arraystretch}{1.8}
\begin{tabular}{lrrr}
  \toprule
  \textbf{データ} & \textbf{サンプル数} & \textbf{特徴数} & \textbf{クラス数}\\
  \midrule
  X (small)  & 50{,}000     & 128  & 10\\
  Y (medium) & 100{,}000    & 512  & 100\\
  \rowcolor{posteraccent!20}
  \textbf{Z (large)} & \textbf{1{,}000{,}000} & \textbf{1{,}024} & \textbf{1{,}000}\\
  \bottomrule
\end{tabular}

\vspace{4mm}
{\fontS\color{posterbg!75}
\textbf{Z} は本研究で新規構築。$n \ge 10^6$ スケール評価を可能にする。}
\raggedright

\columnbreak

% ─── 右カラム ───
\blockhead[postergreen]{7. 実験結果}
\centering
\renewcommand{\arraystretch}{1.8}
\begin{tabular}{lcc}
  \toprule
  \textbf{手法} & \textbf{精度 [\%]} & \textbf{時間 [s]}\\
  \midrule
  既存 A & $85.2 \pm 0.4$ & $120 \pm 3$\\
  既存 B & $87.1 \pm 0.3$ & $95 \pm 2$\\
  \rowcolor{posteraccent!25}
  \textbf{提案} & $\mathbf{91.8 \pm 0.2}$ & $\mathbf{42 \pm 1}$\\
  \bottomrule
\end{tabular}

\vspace{5mm}
{\fontM\color{postergreen}\textbf{$+$4.7 pt} 精度向上 \quad \textbf{$\times$2.3} 高速化}

\vspace{6mm}
\fbox{\parbox[c][200mm][c]{0.94\linewidth}{\centering\fontSM [実験結果のグラフ]\\[4mm] 精度 vs.\ 反復回数 $T$ \\[2mm] {\fontS (3 データセットでの収束曲線)}}}

\vspace{4mm}
{\fontS\color{postergreen!85!black}
大規模 Z で顕著な改善 ── 理論予測 $O(n \log n)$ と整合。}
\raggedright

\blockhead[postergreen]{8. 結論と今後}
\textbf{\color{postergreen}まとめ.}\ 提案手法は精度・時間両面で既存を上回る。特に 100 万件データで最大改善。

\textbf{\color{postergreen}今後:}
\begin{itemize}
  \item 非凸損失への理論拡張
  \item 分散・Federated 環境への応用
  \item プライバシー保護学習との組み合わせ
\end{itemize}

\blockhead{9. 著者貢献 \& 謝辞}
{\fontS
\textbf{貢献:}\ 山田 (手法・実装), 鈴木 (理論), 佐藤 (実験・統括)。

\textbf{謝辞:}\ JSPS 科研費 JP-XXXXXXX および ○○ 財団の助成を受けた。計算基盤として △△ クラスタを利用。
}

\blockhead{参考文献}
{\fontS
[1] J. Smith, S. Lee, "An algorithm for $\cdots$," \emph{Proc.\ NeurIPS}, 20XX.\\[2mm]
[2] R. Jones, "Approximation methods," \emph{JMLR}, vol.~22, 2021.\\[2mm]
[3] 田中 洋, “○○ のサーベイ,” \emph{情処論誌}, 20XX.
}

\end{multicols}

% ══════════════════════════════════════════════
% フッタ
% ══════════════════════════════════════════════
\vfill
{\color{posteraccent}\hrule height 3pt}
\vspace{6mm}

\noindent
\begin{minipage}[c]{0.72\linewidth}
  {\fontS 第 XX 回 ○○学会大会\ (20XX)\par}
  \vspace{2mm}
  {\fontS\color{posterbg!70}
    連絡先: \texttt{yamada@example.ac.jp} \ | \ $\dagger$ Corresponding author \ | \ 論文 PDF $\to$}
\end{minipage}\hfill
\begin{minipage}[c]{0.2\linewidth}\raggedleft
  \fbox{\parbox[c][80mm][c]{80mm}{\centering\fontS QR\\[2mm]{\fontS (論文リンク)}}}
\end{minipage}

\end{document}
`;

const POSTER_LATEX_EN = String.raw`% A0 portrait conference poster — minimum-overhead edition
% ─────────────────────────────────────────────────────────────────────
% Font-size calls collapsed to 6 macros to cut LuaLaTeX font-loading time
% on haranoaji / default Japanese fonts. System overview is a tabular of
% coloured \parbox cells instead of a TikZ flowchart.
% ─────────────────────────────────────────────────────────────────────
\documentclass[20pt]{article}
\usepackage[T1]{fontenc}
\usepackage[paperwidth=841mm,paperheight=1189mm,top=28mm,bottom=26mm,left=24mm,right=24mm]{geometry}
\usepackage{amsmath, amssymb, mathtools, bm}
\usepackage{graphicx}
\usepackage{booktabs, colortbl, array}
\usepackage{xcolor}
\usepackage{multicol}
\usepackage{anyfontsize}
\usepackage{enumitem}

\pagestyle{empty}
\setlength{\parindent}{0pt}
\setlength{\parskip}{6mm}
\setlength{\columnsep}{20mm}
\setlength{\columnseprule}{0pt}
\setlength{\fboxsep}{0pt}

\newcommand{\fontXL}{\fontsize{76pt}{88pt}\selectfont}
\newcommand{\fontL}{\fontsize{44pt}{52pt}\selectfont}
\newcommand{\fontM}{\fontsize{34pt}{42pt}\selectfont}
\newcommand{\fontSM}{\fontsize{26pt}{34pt}\selectfont}
\newcommand{\fontS}{\fontsize{22pt}{28pt}\selectfont}
\newcommand{\fontKey}{\fontsize{64pt}{72pt}\selectfont}

\renewcommand{\normalsize}{\fontSM}
\normalsize

\setlist[itemize]{leftmargin=1.4em,itemsep=3mm,topsep=2mm,parsep=0pt}
\setlist[enumerate]{leftmargin=1.6em,itemsep=3mm,topsep=2mm,parsep=0pt}

\raggedcolumns

\definecolor{posterbg}{HTML}{0f172a}
\definecolor{posteraccent}{HTML}{f59e0b}
\definecolor{postersoft}{HTML}{fff7ed}
\definecolor{posterkey}{HTML}{dc2626}
\definecolor{posterblue}{HTML}{2563eb}
\definecolor{postergreen}{HTML}{059669}

\newcommand{\blockhead}[2][posterbg]{%
  \par\vspace{6mm}%
  \noindent\colorbox{#1}{%
    \begin{minipage}{\linewidth}%
      \vspace{5mm}\hspace{8mm}{\color{white}\fontM\bfseries #2}\vspace{5mm}%
    \end{minipage}%
  }\par\nobreak\vspace{5mm}%
}

\newcommand{\flowbox}[2]{%
  \fcolorbox{#1}{postersoft}{\parbox[c][18mm][c]{60mm}{\centering\fontS\bfseries #2}}%
}
\newcommand{\flowboxhl}[1]{%
  \fcolorbox{posterkey}{posterkey!15}{\parbox[c][18mm][c]{60mm}{\centering\fontS\bfseries #1}}%
}
\newcommand{\arr}{\textcolor{posterbg}{\(\;\Rightarrow\;\)}}
\newcommand{\darr}{\textcolor{posterbg}{\(\Downarrow\)}}

\begin{document}

\noindent
\begin{minipage}[c]{0.14\linewidth}\centering
  \fbox{\parbox[c][80mm][c]{100mm}{\centering\fontS LOGO\\(Univ.)}}
\end{minipage}%
\hfill
\begin{minipage}[c]{0.68\linewidth}\centering
  {\color{posterbg}\fontXL\bfseries Research Poster Title\par}
  \vspace{5mm}
  {\color{posterbg!85}\fontL\bfseries --- A Novel Approach to $\cdots$ ---\par}
  \vspace{8mm}
  {\color{posterbg!80}\fontM Jane Doe$^{\mathsf{1,\dagger}}$\quad John Smith$^{\mathsf{2}}$\quad Alice Brown$^{\mathsf{1}}$\par}
  \vspace{3mm}
  {\color{posterbg!65}\fontS $^{\mathsf{1}}$ Example University \quad $^{\mathsf{2}}$ Example Research Institute \quad $\dagger$ \texttt{jane@example.ac.jp}\par}
\end{minipage}%
\hfill
\begin{minipage}[c]{0.14\linewidth}\centering
  \fbox{\parbox[c][80mm][c]{100mm}{\centering\fontS LOGO\\(Inst.)}}
\end{minipage}

\vspace{8mm}
{\color{posteraccent}\hrule height 6pt}
\vspace{8mm}

\begin{multicols}{3}

\blockhead{1. Background}
Recent advances in $\cdots$ have opened new possibilities, but existing methods suffer from:
\begin{itemize}
  \item High $O(n^2)$ computational cost per iteration
  \item Infeasible for large-scale data ($n \ge 10^6$)
  \item Difficulty in parallelisation / distribution
  \item A gap between theory and practice
\end{itemize}
We resolve this with a new algorithm backed by theory and experiments.

\blockhead{2. Goals \& Contributions}
\begin{itemize}
  \item Reduce complexity $O(n^2) \to O(n \log n)$
  \item $O(1/T)$ convergence guarantee under $\mu$-strong convexity
  \item Quantitative evaluation on three benchmarks (up to \textbf{1M samples})
  \item Empirical extension to non-convex losses (ResNet-50)
  \item Provable scalability in distributed settings
\end{itemize}

\vspace{6mm}
\noindent\colorbox{posterkey!12}{%
  \begin{minipage}{\linewidth}%
    \vspace{8mm}
    \centering
    {\fontM\bfseries\color{posterkey} Key Finding\par}
    \vspace{5mm}
    {\fontKey\bfseries\color{posterkey} $+$\,\textbf{4.7\%}\quad $\times$\,\textbf{2.3}\par}
    \vspace{5mm}
    {\fontS\color{posterkey!80!black} Accuracy (pt)\hspace{22mm}Speed-up ($\times$)\par}
    \vspace{3mm}
    {\fontS Largest gains on the 1M-sample dataset\par}
    \vspace{8mm}
  \end{minipage}%
}
\vspace{6mm}

\blockhead{3. System Overview}
\centering
\renewcommand{\arraystretch}{1.4}
\setlength{\tabcolsep}{4mm}
\begin{tabular}{@{}ccc@{}}
  \flowbox{posterbg}{Input $x$} & \arr & \flowbox{posterbg}{Features $\phi(x)$} \\
  & & \darr \\
  \flowbox{posterbg}{Output $\hat y$} & & \flowboxhl{Ours SGD\\$O(n \log n)$} \\
  \darr & & \darr \\
  \flowbox{posterbg}{Predict $f_{\theta^\ast}(x')$} & \(\Leftarrow\) & \flowbox{posterbg}{Trained $\theta^\ast$} \\
\end{tabular}
\raggedright

\columnbreak

\blockhead[posterblue]{4. Method}
\textbf{\color{posterblue}Problem.}\quad Minimise
\[ \mathcal{L}(\theta) = \tfrac{1}{N}\sum_{i=1}^{N} \ell(f_\theta(x_i), y_i) + \lambda \|\theta\|^2. \]

\textbf{\color{posterblue}Training.}\quad SGD update:
\[ \theta_{t+1} = \theta_t - \eta_t \nabla \mathcal{L}(\theta_t;\xi_t), \quad \eta_t = \frac{\eta}{\sqrt{t+1}}. \]

\textbf{\color{posterblue}Key idea.}\quad Hierarchical feature decomposition:
\begin{itemize}
  \item \textbf{Step 1.}\ Split feature space into a $\log n$-deep tree
  \item \textbf{Step 2.}\ Compute partial gradients in parallel
  \item \textbf{Step 3.}\ Aggregate via tree traversal ($O(n)$)
  \item Preserves $L$-smoothness and the original convergence guarantee
\end{itemize}

\blockhead[posterblue]{5. Theory}
\textbf{\color{posterblue}Theorem 1 (Convergence).}\quad For $\mu$-strongly convex, $L$-smooth $\mathcal{L}$,
\[ \mathbb{E}\!\left[\mathcal{L}(\theta_T) - \mathcal{L}(\theta^\ast)\right] \le \frac{C}{T}. \]
\textbf{\color{posterblue}Theorem 2 (Complexity).}\quad $T = O(1/\epsilon)$ iterations suffice for $\epsilon$-optimality.

\begin{itemize}
  \item Convergence rate $O(1/T)$ (strongly-convex regime)
  \item Sample complexity $O(d \log d)$
  \item Empirically stable on non-convex losses
\end{itemize}

\blockhead[posterblue]{6. Datasets}
\centering
\renewcommand{\arraystretch}{1.8}
\begin{tabular}{lrrr}
  \toprule
  \textbf{Dataset} & \textbf{Samples} & \textbf{Features} & \textbf{Classes}\\
  \midrule
  X (small)  & 50{,}000     & 128  & 10\\
  Y (medium) & 100{,}000    & 512  & 100\\
  \rowcolor{posteraccent!20}
  \textbf{Z (large)} & \textbf{1{,}000{,}000} & \textbf{1{,}024} & \textbf{1{,}000}\\
  \bottomrule
\end{tabular}

\vspace{4mm}
{\fontS\color{posterbg!75}
\textbf{Z} is a new large-scale benchmark introduced in this work.}
\raggedright

\columnbreak

\blockhead[postergreen]{7. Experiments}
\centering
\renewcommand{\arraystretch}{1.8}
\begin{tabular}{lcc}
  \toprule
  \textbf{Method} & \textbf{Accuracy [\%]} & \textbf{Time [s]}\\
  \midrule
  Baseline A & $85.2 \pm 0.4$ & $120 \pm 3$\\
  Baseline B & $87.1 \pm 0.3$ & $95 \pm 2$\\
  \rowcolor{posteraccent!25}
  \textbf{Ours} & $\mathbf{91.8 \pm 0.2}$ & $\mathbf{42 \pm 1}$\\
  \bottomrule
\end{tabular}

\vspace{5mm}
{\fontM\color{postergreen}\textbf{$+$4.7 pt} accuracy \quad \textbf{$\times$2.3} speed-up}

\vspace{6mm}
\fbox{\parbox[c][200mm][c]{0.94\linewidth}{\centering\fontSM [Experimental curves]\\[4mm] Accuracy vs.\ iterations $T$ \\[2mm] {\fontS (3 datasets)}}}

\vspace{4mm}
{\fontS\color{postergreen!85!black}
Most pronounced on the 1M Z --- consistent with the $O(n \log n)$ theoretical prediction.}
\raggedright

\blockhead[postergreen]{8. Conclusion \& Future}
\textbf{\color{postergreen}Summary.}\ Ours beats baselines in accuracy \emph{and} speed across three benchmarks; the gap is largest on the 1M-sample Z.

\textbf{\color{postergreen}Future:}
\begin{itemize}
  \item Theoretical extension to non-convex losses
  \item Federated / distributed deployment
  \item Combination with privacy-preserving learning
\end{itemize}

\blockhead{9. Contributions \& Acknowledgements}
{\fontS
\textbf{Contributions:}\ Doe (method \& code), Smith (theory), Brown (experiments \& writing).

\textbf{Acknowledgements:}\ Supported by JSPS Grant JP-XXXX and the $\cdots$ Foundation. Computed on the $\triangle\triangle$ cluster.
}

\blockhead{References}
{\fontS
[1] J. Smith, S. Lee, "An algorithm for $\cdots$," \emph{Proc.\ NeurIPS}, 20XX.\\[2mm]
[2] R. Jones, "Approximation methods for $\cdots$," \emph{JMLR}, vol.~22, 2021.\\[2mm]
[3] Y. Tanaka, "A survey of $\cdots$," \emph{IPSJ J.}, vol.~X, 20XX.
}

\end{multicols}

\vfill
{\color{posteraccent}\hrule height 3pt}
\vspace{6mm}

\noindent
\begin{minipage}[c]{0.72\linewidth}
  {\fontS The XXth Conference on $\cdots$\ (20XX)\par}
  \vspace{2mm}
  {\fontS\color{posterbg!70}
    Contact: \texttt{jane@example.ac.jp} \ | \ $\dagger$ Corresponding author \ | \ Paper PDF $\to$}
\end{minipage}\hfill
\begin{minipage}[c]{0.2\linewidth}\raggedleft
  \fbox{\parbox[c][80mm][c]{80mm}{\centering\fontS QR\\[2mm]{\fontS (paper link)}}}
\end{minipage}

\end{document}
`;

// ──────────────────────────────────────────
// P4. 学術論文 (academic-paper, 投稿原稿)
// ──────────────────────────────────────────
const ACADEMIC_PAPER_LATEX = String.raw`\documentclass[10pt,a4paper,twocolumn]{article}
\usepackage[haranoaji]{luatexja-preset}
\usepackage{geometry}
\geometry{top=22mm,bottom=22mm,left=18mm,right=18mm,columnsep=6mm}
\usepackage{amsmath, amssymb, amsthm, mathtools, bm}
\usepackage{booktabs, tabularx, multirow}
\usepackage{graphicx}
\usepackage{subcaption}
\usepackage{xcolor}
\usepackage[hidelinks,breaklinks]{hyperref}
\usepackage{enumitem}
\usepackage{siunitx}
\usepackage{tcolorbox}
\tcbuselibrary{skins,breakable}

\definecolor{paperaccent}{HTML}{0b4f8c}
\definecolor{papersoft}{HTML}{dbeafe}

% ── 定理環境 (IEEE 風に節番号と連動) ──
\theoremstyle{plain}
\newtheorem{theorem}{Theorem}[section]
\newtheorem{proposition}[theorem]{Proposition}
\newtheorem{lemma}[theorem]{Lemma}
\newtheorem{corollary}[theorem]{Corollary}

\theoremstyle{definition}
\newtheorem{definition}{Definition}[section]
\newtheorem{assumption}{Assumption}[section]

\theoremstyle{remark}
\newtheorem{remark}{Remark}[section]

% Key finding box
\newtcolorbox{keyfinding}{colback=papersoft!50,colframe=paperaccent,left=3mm,right=3mm,top=1.5mm,bottom=1.5mm,sharp corners,boxrule=0.4pt}

% ── 疑似コード box (algorithm / algpseudocode の代替) ──
% #1: タイトル末尾 (例: "1: Proposed SGD")
\newtcolorbox{algbox}[1]{%
  enhanced, breakable, colback=white, colframe=paperaccent!85!black,
  sharp corners, boxrule=0.4pt,
  attach boxed title to top left={xshift=5mm,yshift=-3mm},
  boxed title style={colback=paperaccent, colframe=paperaccent, sharp corners, boxrule=0pt},
  coltitle=white, fonttitle=\bfseries\small,
  title={Algorithm #1},
  left=4mm,right=4mm,top=3mm,bottom=3mm
}

\title{\vspace{-10mm}{\LARGE\bfseries 論文タイトル: ○○に関する新しいアプローチ}\\[0.4em]\large A Novel Approach to $\cdots$ via Hierarchical Decomposition}

% ── 著者ブロック (authblk の代替: 手書き) ──
\author{%
  \normalsize 山田 太郎$^{\mathsf{1,\dagger}}$\quad 鈴木 花子$^{\mathsf{2}}$\quad 佐藤 一郎$^{\mathsf{1}}$\\[2pt]
  \small $^{\mathsf{1}}$ ○○大学 大学院情報理工学系研究科\\[-2pt]
  \small $^{\mathsf{2}}$ △△研究所 情報科学部門\\[-2pt]
  \small $\dagger$ Corresponding author: \texttt{yamada@example.ac.jp}%
}
\date{}

\begin{document}

% ── 要旨は段組を使わず 1 段表示 (\twocolumn[...] にするとタイトル直後に出る) ──
\twocolumn[
\begin{@twocolumnfalse}
\maketitle
\begin{abstract}
\noindent
本論文では、○○分野における△△問題に対して新しいアプローチを提案する。提案手法はアルゴリズム的な工夫により従来手法と比べ計算量を $O(n^2)$ から $O(n \log n)$ に削減しつつ、理論保証 ($O(1/T)$ の収束率) を維持することに成功している。公開ベンチマーク 3 種での数値実験により、実データ上でも有効であることを示した。提案手法は精度で 4.7\%、計算時間で 2.3 倍の改善を達成した。

\bigskip\noindent\textbf{キーワード:}\ ○○, △△, ××, 最適化, 機械学習, 確率的勾配降下法
\end{abstract}
\vspace{5mm}
\end{@twocolumnfalse}
]

\section{序論}\label{sec:intro}
近年、○○分野では $\cdots$ に関する研究が盛んに行われている \cite{ref1,ref2}。実応用が進むにつれ、大規模データに適用可能な高速アルゴリズムの需要が増大している。しかし、既存手法には計算コストが大きいという課題があり、サンプル数 $n$ に対して $O(n^2)$ の時間を要する \cite{ref3}。

\smallskip
\noindent\textbf{貢献.}\quad 本論文の貢献を以下にまとめる:
\begin{itemize}[leftmargin=*,itemsep=1pt]
  \item 計算量を $O(n \log n)$ に削減する新アルゴリズムの提案 (\S\ref{sec:method})
  \item $\mu$-強凸条件下における収束率 $O(1/T)$ の理論保証 (\S\ref{sec:theory})
  \item 公開ベンチマーク 3 種における定量的評価 (\S\ref{sec:exp})
\end{itemize}

\begin{keyfinding}
\textbf{Key finding.}\quad 大規模データ Z (1M 件) において、提案手法は既存手法と比較して精度を \textbf{4.7\%} 改善し、計算時間を \textbf{2.3 倍} 高速化した。
\end{keyfinding}

\section{関連研究}\label{sec:related}
○○ に関する従来研究は大きく 2 つのアプローチに分類できる。

\paragraph{アプローチ A: 直接最適化.}
Smith ら \cite{ref1} は $\cdots$ を直接最適化する手法を提案したが、各反復で $O(n^2)$ の計算量を要する。

\paragraph{アプローチ B: 間接近似.}
Jones ら \cite{ref2} は線形緩和に基づく近似手法を導入した。計算量は $O(n)$ となるが、理論保証が弱い。

\section{提案手法}\label{sec:method}
\begin{definition}[問題設定]\label{def:problem}
  入力空間 $\mathcal{X} \subseteq \mathbb{R}^d$ と出力空間 $\mathcal{Y} \subseteq \mathbb{R}$ に対して、データ $\{(x_i, y_i)\}_{i=1}^N$ が与えられたとき、次の汎化誤差を最小化する写像 $f:\mathcal{X}\to\mathcal{Y}$ を求める問題を考える:
  \[ \mathcal{R}(f) = \mathbb{E}_{(x,y)\sim\mathcal{D}}[\ell(f(x), y)]. \]
\end{definition}

\begin{assumption}[正則性]\label{asm:smooth}
  損失関数 $\mathcal{L}$ は $\mu$-強凸かつ $L$-平滑であり、$\nabla\mathcal{L}$ は有界な分散 $\sigma^2$ を持つ確率的勾配として観測可能である。
\end{assumption}

提案アルゴリズム (下の Algorithm 1) は、特徴空間を階層分解することで勾配計算を高速化する。

\begin{algbox}{1: Proposed SGD with hierarchical decomposition}
\textbf{Input:} Initial $\theta_0$, learning rate $\eta > 0$, iterations $T$ \\
\textbf{Output:} $\theta_T$
\begin{enumerate}[label=\arabic*:,leftmargin=*,itemsep=1pt]
  \item \textbf{for} $t = 0, 1, \dots, T-1$ \textbf{do}
  \item \quad $g_t \gets \nabla \mathcal{L}(\theta_t;\xi_t)$ \quad \textit{// $O(n \log n)$}
  \item \quad $\eta_t \gets \eta / \sqrt{t+1}$
  \item \quad $\theta_{t+1} \gets \theta_t - \eta_t\, g_t$
  \item \textbf{end for}
  \item \textbf{return} $\theta_T$
\end{enumerate}
\end{algbox}

具体的な更新式は
\begin{align}
  \theta_{t+1} &= \theta_t - \eta_t \nabla \mathcal{L}(\theta_t;\xi_t), \label{eq:sgd}\\
  \mathcal{L}(\theta) &= \frac{1}{N}\sum_{i=1}^{N} \ell(f_\theta(x_i), y_i) + \lambda \|\theta\|^2. \label{eq:loss}
\end{align}

\section{理論解析}\label{sec:theory}
\begin{theorem}[主定理]\label{thm:main}
  仮定~\ref{asm:smooth} の下で、式 \eqref{eq:sgd} の反復は次を満たす:
  \[ \mathbb{E}\!\left[\mathcal{L}(\theta_T) - \mathcal{L}(\theta^\ast)\right] \le \frac{C}{T}, \]
  ここで $C$ は $\mu, L, \sigma, \|\theta_0 - \theta^\ast\|$ にのみ依存する正定数である。
\end{theorem}
\begin{proof}[証明 (概略)]
  標準的な解析 \cite{ref4} に従う。詳細は付録~\ref{appx:proof} を参照。
\end{proof}

\begin{corollary}[サンプル複雑度]
  $\epsilon$-最適解を得るには $T = O(1/\epsilon)$ 回の反復で十分である。
\end{corollary}

\begin{remark}
  強凸性の仮定は実用上は緩和可能であり、実験では凸でない損失関数でも良好な結果が得られた (\S\ref{sec:exp})。
\end{remark}

\section{数値実験}\label{sec:exp}
\subsection{実験設定}
公開ベンチマーク X, Y, Z を用いて、既存手法 A \cite{ref1}, B \cite{ref2} と比較した。すべての実験は 3 試行の平均 $\pm$ 標準偏差で報告する。ハイパーパラメータは検証セットで選択した。

\begin{table}[t]
  \centering\small
  \caption{データセットの規模.}\label{tab:dataset}
  \begin{tabular}{lrrr}
    \toprule
    & サンプル数 & 特徴数 & クラス数\\
    \midrule
    X & \num{50000}     & 128   & 10\\
    Y & \num{100000}    & 512   & 100\\
    Z & \num{1000000}   & 1024  & 1000\\
    \bottomrule
  \end{tabular}
\end{table}

\subsection{結果}
\begin{table}[t]
  \centering\small
  \caption{精度 [\%] と計算時間 [s] の比較 (3 試行).}\label{tab:results}
  \begin{tabular}{lcc}
    \toprule
    手法           & 精度 [\%]              & 時間 [s]\\
    \midrule
    既存 A \cite{ref1} & $85.2 \pm 0.4$           & $120 \pm 3$\\
    既存 B \cite{ref2} & $87.1 \pm 0.3$           & $95 \pm 2$\\
    \textbf{提案}  & $\mathbf{91.8 \pm 0.2}$  & $\mathbf{42 \pm 1}$\\
    \bottomrule
  \end{tabular}
\end{table}

Table~\ref{tab:results} に示すとおり、提案手法は精度で 4.6--6.6\%、計算時間で 2.3--2.9 倍の改善を達成した。特に大規模データセット Z での差が顕著である。

\subsection{考察}
計算量解析の理論予測 $O(n \log n)$ と一致する挙動を確認できた。非凸損失 (ResNet-50) でも 1.8\% の精度改善が見られ、理論解析の前提を超えて実用上有効であることが示唆される。

\section{結論}\label{sec:conclusion}
本論文では ○○ を実現する新しい手法を提案し、理論解析と数値実験の両面からその有効性を示した。今後は (i) 非凸損失の理論拡張、(ii) 分散環境への応用、(iii) $\cdots$ への展開、の 3 方向を探索したい。

\section*{謝辞}
本研究は科学研究費補助金 (課題番号 JP-XXXXXXX) および ○○ 財団の助成を受けたものである。査読者から有益なコメントをいただいた。

% ── 付録 ──
\appendix
\section{定理~\ref{thm:main} の証明詳細}\label{appx:proof}
\begin{lemma}
  確率的勾配 $g_t$ は $\mathbb{E}[g_t \mid \theta_t] = \nabla\mathcal{L}(\theta_t)$ かつ $\mathbb{E}[\|g_t\|^2 \mid \theta_t] \le \sigma^2$ を満たす。
\end{lemma}

$\Delta_t = \mathcal{L}(\theta_t) - \mathcal{L}(\theta^\ast)$ とおくと、強凸性から $\|\theta_t - \theta^\ast\|^2 \le \tfrac{2}{\mu}\Delta_t$。更新式 \eqref{eq:sgd} より
\begin{align*}
  \|\theta_{t+1} - \theta^\ast\|^2
    &= \|\theta_t - \theta^\ast\|^2\\
    &\ \ - 2\eta_t \langle g_t, \theta_t - \theta^\ast\rangle + \eta_t^2 \|g_t\|^2.
\end{align*}
両辺に $\mathbb{E}[\cdot]$ をとり、総和を取ることで定理の結果を得る \cite{ref4}。

\section*{著者略歴}
\noindent\textbf{山田 太郎} ── 20XX 年 ○○大学 学士課程修了。同大学院博士後期課程修了、博士 (工学)。20XX 年より同大助教。機械学習・最適化理論に関する研究に従事。情報処理学会、IEEE 各会員。

\smallskip\noindent\textbf{鈴木 花子} ── 20XX 年 ○○大学博士 (理学)。△△研究所 情報科学部門 主任研究員。確率最適化、ベイズ統計を専門とする。

\begin{thebibliography}{99}
\small
\bibitem{ref1} J.~Smith and S.~Lee, "An algorithm for $\cdots$," in \emph{Proc.\ NeurIPS}, pp.~1--10, 20XX.
\bibitem{ref2} R.~Jones, "Approximation methods for $\cdots$," \emph{J. Mach. Learn. Res.}, vol.~22, no.~3, pp.~45--60, 2021.
\bibitem{ref3} Y.~Tanaka, "○○ のサーベイ," \emph{情報処理学会論文誌}, vol.~X, pp.~XX--YY, 20XX.
\bibitem{ref4} S.~Shalev-Shwartz and S.~Ben-David, \emph{Understanding Machine Learning: From Theory to Algorithms}. Cambridge Univ.\ Press, 2014.
\end{thebibliography}

\end{document}
`;

const ACADEMIC_PAPER_LATEX_EN = String.raw`\documentclass[10pt,a4paper,twocolumn]{article}
\usepackage[T1]{fontenc}
\usepackage{geometry}
\geometry{top=22mm,bottom=22mm,left=18mm,right=18mm,columnsep=6mm}
\usepackage{amsmath, amssymb, amsthm, mathtools, bm}
\usepackage{booktabs, tabularx, multirow}
\usepackage{graphicx}
\usepackage{subcaption}
\usepackage{xcolor}
\usepackage[hidelinks,breaklinks]{hyperref}
\usepackage{enumitem}
\usepackage{siunitx}
\usepackage{tcolorbox}
\tcbuselibrary{skins,breakable}

\definecolor{paperaccent}{HTML}{0b4f8c}
\definecolor{papersoft}{HTML}{dbeafe}

\theoremstyle{plain}
\newtheorem{theorem}{Theorem}[section]
\newtheorem{proposition}[theorem]{Proposition}
\newtheorem{lemma}[theorem]{Lemma}
\newtheorem{corollary}[theorem]{Corollary}

\theoremstyle{definition}
\newtheorem{definition}{Definition}[section]
\newtheorem{assumption}{Assumption}[section]

\theoremstyle{remark}
\newtheorem{remark}{Remark}[section]

\newtcolorbox{keyfinding}{colback=papersoft!50,colframe=paperaccent,left=3mm,right=3mm,top=1.5mm,bottom=1.5mm,sharp corners,boxrule=0.4pt}

% Pseudo-code algorithm box (stand-in for algorithm/algpseudocode)
\newtcolorbox{algbox}[1]{%
  enhanced, breakable, colback=white, colframe=paperaccent!85!black,
  sharp corners, boxrule=0.4pt,
  attach boxed title to top left={xshift=5mm,yshift=-3mm},
  boxed title style={colback=paperaccent, colframe=paperaccent, sharp corners, boxrule=0pt},
  coltitle=white, fonttitle=\bfseries\small,
  title={Algorithm #1},
  left=4mm,right=4mm,top=3mm,bottom=3mm
}

\title{\vspace{-10mm}{\LARGE\bfseries A Novel Approach to $\cdots$ via Hierarchical Decomposition}}

% Manual author block (stand-in for authblk)
\author{%
  \normalsize Jane Doe$^{\mathsf{1,\dagger}}$\quad John Smith$^{\mathsf{2}}$\quad Alice Brown$^{\mathsf{1}}$\\[2pt]
  \small $^{\mathsf{1}}$ Graduate School of \dots, Example University\\[-2pt]
  \small $^{\mathsf{2}}$ Example Research Institute\\[-2pt]
  \small $\dagger$ Corresponding author: \texttt{jane@example.ac.jp}%
}
\date{}

\begin{document}

\twocolumn[
\begin{@twocolumnfalse}
\maketitle
\begin{abstract}
\noindent
We propose a novel approach to the problem of $\cdots$ in the field of $\cdots$. Our hierarchical decomposition reduces the per-iteration complexity from $O(n^2)$ to $O(n \log n)$ while preserving the $O(1/T)$ convergence rate. Experiments on three public benchmarks show a 4.7\% accuracy improvement and a 2.3$\times$ speed-up, with the largest gains on the 1M-sample dataset.

\bigskip\noindent\textbf{Keywords:}\ $\cdots$, optimisation, stochastic gradient descent, machine learning.
\end{abstract}
\vspace{5mm}
\end{@twocolumnfalse}
]

\section{Introduction}\label{sec:intro}
Recent studies \cite{ref1,ref2} in the field of $\cdots$ have drawn considerable attention. However, existing methods are computationally expensive, with a cost of $O(n^2)$ per iteration in the number of samples $n$ \cite{ref3}.

\smallskip
\noindent\textbf{Contributions.}
\begin{itemize}[leftmargin=*,itemsep=1pt]
  \item A new algorithm reducing the complexity to $O(n \log n)$ (\S\ref{sec:method}).
  \item An $O(1/T)$ convergence-rate guarantee under $\mu$-strong convexity (\S\ref{sec:theory}).
  \item A quantitative evaluation on three benchmarks (\S\ref{sec:exp}).
\end{itemize}

\begin{keyfinding}
\textbf{Key finding.}\quad On the 1M-sample dataset, our method achieves a \textbf{4.7\%} accuracy gain and a \textbf{2.3$\times$} speed-up over strong baselines.
\end{keyfinding}

\section{Related Work}\label{sec:related}
Prior work falls into two categories.
\paragraph{Approach A: direct optimisation.} Smith et al.~\cite{ref1} solve $\cdots$ directly but require $O(n^2)$ time per iteration.
\paragraph{Approach B: indirect approximation.} Jones et al.~\cite{ref2} use a linear relaxation; the cost drops to $O(n)$ but theoretical guarantees weaken.

\section{Method}\label{sec:method}
\begin{definition}[Problem]\label{def:problem}
  Given data $\{(x_i, y_i)\}_{i=1}^N$, find $f:\mathcal{X}\to\mathcal{Y}$ minimising
  \[ \mathcal{R}(f) = \mathbb{E}_{(x,y)\sim\mathcal{D}}[\ell(f(x), y)]. \]
\end{definition}

\begin{assumption}[Regularity]\label{asm:smooth}
  $\mathcal{L}$ is $\mu$-strongly convex, $L$-smooth, and $\nabla\mathcal{L}$ is observable via a stochastic gradient with bounded variance $\sigma^2$.
\end{assumption}

\begin{algbox}{1: Proposed SGD with hierarchical decomposition}
\textbf{Input:} Initial $\theta_0$, learning rate $\eta > 0$, iterations $T$ \\
\textbf{Output:} $\theta_T$
\begin{enumerate}[label=\arabic*:,leftmargin=*,itemsep=1pt]
  \item \textbf{for} $t = 0, 1, \dots, T-1$ \textbf{do}
  \item \quad $g_t \gets \nabla \mathcal{L}(\theta_t;\xi_t)$ \quad \textit{// $O(n \log n)$}
  \item \quad $\eta_t \gets \eta / \sqrt{t+1}$
  \item \quad $\theta_{t+1} \gets \theta_t - \eta_t\, g_t$
  \item \textbf{end for}
  \item \textbf{return} $\theta_T$
\end{enumerate}
\end{algbox}

The update rule is
\begin{align}
  \theta_{t+1} &= \theta_t - \eta_t \nabla \mathcal{L}(\theta_t;\xi_t), \label{eq:sgd}\\
  \mathcal{L}(\theta) &= \tfrac{1}{N}\sum_i \ell(f_\theta(x_i), y_i) + \lambda \|\theta\|^2.
\end{align}

\section{Theory}\label{sec:theory}
\begin{theorem}[Main]\label{thm:main}
  Under Assumption~\ref{asm:smooth}, the iteration \eqref{eq:sgd} satisfies
  \[ \mathbb{E}\!\left[\mathcal{L}(\theta_T) - \mathcal{L}(\theta^\ast)\right] \le C/T. \]
\end{theorem}
\begin{proof}[Proof sketch]
  Standard analysis \cite{ref4}; see Appendix~\ref{appx:proof}.
\end{proof}

\begin{corollary}
  $T = O(1/\epsilon)$ iterations suffice for an $\epsilon$-optimal solution.
\end{corollary}

\begin{remark}
  Strong convexity can be relaxed in practice: experiments on non-convex losses remain stable (\S\ref{sec:exp}).
\end{remark}

\section{Experiments}\label{sec:exp}
\subsection{Setup}
We compare against Approach A~\cite{ref1} and B~\cite{ref2} on three public benchmarks. All numbers are mean $\pm$ SD over 3 runs.

\begin{table}[t]\centering\small
  \caption{Datasets.}\label{tab:dataset}
  \begin{tabular}{lrrr}\toprule
    & Samples & Features & Classes\\\midrule
    X & \num{50000}   & 128   & 10\\
    Y & \num{100000}  & 512   & 100\\
    Z & \num{1000000} & 1024  & 1000\\\bottomrule
  \end{tabular}
\end{table}

\subsection{Results}
\begin{table}[t]\centering\small
  \caption{Comparison on the three benchmarks.}\label{tab:results}
  \begin{tabular}{lcc}\toprule
    Method & Acc.\,[\%] & Time [s]\\\midrule
    Baseline A \cite{ref1} & $85.2 \pm 0.4$          & $120 \pm 3$\\
    Baseline B \cite{ref2} & $87.1 \pm 0.3$          & $95 \pm 2$\\
    \textbf{Ours}          & $\mathbf{91.8 \pm 0.2}$ & $\mathbf{42 \pm 1}$\\\bottomrule
  \end{tabular}
\end{table}

As shown in Table~\ref{tab:results}, our method improves accuracy by 4.6--6.6\% and reduces wall-clock time by 2.3--2.9$\times$, with the largest gains on the 1M-sample dataset Z.

\subsection{Discussion}
The empirical trend matches the $O(n \log n)$ cost predicted by theory. On non-convex losses (ResNet-50) we still observe a 1.8\% accuracy gain, suggesting practical utility beyond the theoretical regime.

\section{Conclusion}
We introduced $\cdots$ with a matching theoretical guarantee and empirical evidence. Future directions: (i)~theory for non-convex losses, (ii)~federated training, (iii)~applications to $\cdots$.

\section*{Acknowledgements}
This work was supported by JSPS Grant JP-XXXXXXX and the $\cdots$ Foundation. We thank the anonymous reviewers.

\appendix
\section{Proof of Theorem~\ref{thm:main}}\label{appx:proof}
\begin{lemma}
  The stochastic gradient $g_t$ satisfies $\mathbb{E}[g_t \mid \theta_t] = \nabla\mathcal{L}(\theta_t)$ and $\mathbb{E}[\|g_t\|^2 \mid \theta_t] \le \sigma^2$.
\end{lemma}

Let $\Delta_t = \mathcal{L}(\theta_t) - \mathcal{L}(\theta^\ast)$. By strong convexity, $\|\theta_t - \theta^\ast\|^2 \le \tfrac{2}{\mu}\Delta_t$. From \eqref{eq:sgd},
\begin{align*}
  \|\theta_{t+1} - \theta^\ast\|^2
    &= \|\theta_t - \theta^\ast\|^2\\
    &\ \ - 2\eta_t \langle g_t, \theta_t - \theta^\ast\rangle + \eta_t^2 \|g_t\|^2.
\end{align*}
Taking expectations and summing yields the claim; see \cite{ref4}.

\section*{Author Biographies}
\noindent\textbf{Jane Doe} received her Ph.D.\ from Example University in 20XX. She is currently an Assistant Professor working on machine learning and optimisation. She is a member of IEEE and IPSJ.

\smallskip\noindent\textbf{John Smith} received his Ph.D.\ from Example University in 20XX. He is a Principal Researcher at Example Research Institute, specialising in stochastic optimisation and Bayesian statistics.

\begin{thebibliography}{99}\small
\bibitem{ref1} J.~Smith and S.~Lee, "An algorithm for $\cdots$," in \emph{Proc.\ NeurIPS}, pp.~1--10, 20XX.
\bibitem{ref2} R.~Jones, "Approximation methods for $\cdots$," \emph{J. Mach. Learn. Res.}, vol.~22, no.~3, pp.~45--60, 2021.
\bibitem{ref3} Y.~Tanaka, "A survey of $\cdots$," \emph{IPSJ J.}, vol.~X, pp.~XX--YY, 20XX.
\bibitem{ref4} S.~Shalev-Shwartz and S.~Ben-David, \emph{Understanding Machine Learning: From Theory to Algorithms}. Cambridge Univ.\ Press, 2014.
\end{thebibliography}

\end{document}
`;

// ──────────────────────────────────────────
// P5. 問題集 (problem-book, 章別 + 解答切替)
// ──────────────────────────────────────────
const PROBLEM_BOOK_LATEX = String.raw`\documentclass[11pt,a4paper,openany]{report}
\usepackage[haranoaji]{luatexja-preset}
\usepackage{geometry}
\geometry{top=26mm,bottom=24mm,left=22mm,right=22mm,headheight=14pt}
\usepackage{amsmath, amssymb, amsthm, mathtools, bm}
\usepackage{booktabs, tabularx, array, multirow}
\usepackage{graphicx}
\usepackage{xcolor}
\usepackage[hidelinks]{hyperref}
\usepackage{enumitem}
\usepackage{tcolorbox}
\tcbuselibrary{skins,breakable,theorems}
\usepackage{comment}
\usepackage{titlesec}
\usepackage{fancyhdr}

% ══════════════════════════════════
% 解答表示モード切替トグル
% ══════════════════════════════════
% \showsoltrue  → 解答冊子モード (解答・別解・ヒントを表示)
% \showsolfalse → 本冊モード      (解答だけを隠す)
\newif\ifshowsol
\showsoltrue

\definecolor{pbaccent}{HTML}{c2410c}
\definecolor{pbsoft}{HTML}{fde4d0}
\definecolor{pbhint}{HTML}{0369a1}
\definecolor{pbhintsoft}{HTML}{dbeafe}
\definecolor{pbkey}{HTML}{059669}
\definecolor{pbkeysoft}{HTML}{d1fae5}

% ── 章・部 (Part) のスタイル ──
\titleformat{\part}[display]
  {\normalfont\Huge\bfseries\color{pbaccent}\filcenter}
  {第 \thepart 部}{10pt}{\Huge}
\titleformat{\chapter}[hang]
  {\normalfont\huge\bfseries\color{pbaccent}}{第 \thechapter 章}{12pt}{}
\titlespacing*{\chapter}{0pt}{10pt}{14pt}

% ── ヘッダ (章名 + 問題集タイトル + ページ) ──
\pagestyle{fancy}
\fancyhf{}
\fancyhead[L]{\small\color{pbaccent}\textbf{高校数学 問題集 II$\cdot$B}}
\fancyhead[R]{\small\leftmark}
\fancyfoot[C]{\small\thepage}
\renewcommand{\headrulewidth}{0.3pt}

% ── 難易度バッジ (4 段階: ★ 基本 / ★★ 標準 / ★★★ 発展 / ★★★★ 最難関) ──
\newcommand{\diff}[1]{%
  \hspace{4pt}\colorbox{pbaccent!15}{\textcolor{pbaccent}{\small\bfseries 難易度 #1}}%
}

% ── 問題 box (章.問題番号 自動) ──
\newcounter{pbcount}[chapter]
\renewcommand{\thepbcount}{\thechapter.\arabic{pbcount}}
\newtcolorbox{problem}[2][]{%
  enhanced, breakable, colback=white, colframe=pbaccent!70,
  sharp corners, boxrule=0.4pt,
  attach boxed title to top left={xshift=6mm,yshift=-3mm},
  boxed title style={colback=pbaccent, colframe=pbaccent, sharp corners, boxrule=0pt},
  coltitle=white, fonttitle=\bfseries\small,
  title={問\,#2},
  left=4mm,right=4mm,top=3mm,bottom=3mm,
  #1
}

% ── ヒント box (解答冊子モードでのみ表示) ──
\newtcolorbox{hintbox}{%
  colback=pbhintsoft!50, colframe=pbhint, sharp corners, boxrule=0.3pt,
  left=3mm,right=3mm,top=1mm,bottom=1mm,
  fontupper=\small
}

% ── 重要公式 box (両モードで常時表示) ──
\newtcolorbox{keyformula}[1][]{%
  enhanced, colback=pbkeysoft!60, colframe=pbkey,
  sharp corners, boxrule=0.5pt,
  attach boxed title to top left={xshift=5mm,yshift=-3mm},
  boxed title style={colback=pbkey, colframe=pbkey, sharp corners, boxrule=0pt},
  coltitle=white, fonttitle=\bfseries\small,
  title={重要公式},
  left=4mm,right=4mm,top=3mm,bottom=3mm, #1
}

% ── 解答冊子モードでのみ展開される環境 ──
\ifshowsol
  \newenvironment{solution}{\par\medskip\noindent\textbf{\color{pbaccent}▶ 解答.}\enspace}{\par\medskip}
  \newenvironment{altsolution}{\par\smallskip\noindent\textbf{\color{pbaccent}▶ 別解.}\enspace}{\par}
  \newenvironment{hint}{\begin{hintbox}\textbf{\color{pbhint}ヒント.}\enspace}{\end{hintbox}\par\smallskip}
\else
  \excludecomment{solution}
  \excludecomment{altsolution}
  \excludecomment{hint}
\fi

\title{}\author{}\date{}

\begin{document}

% ══════════════════════════════════
% 表紙
% ══════════════════════════════════
\thispagestyle{empty}
\begin{center}
  \vspace*{30mm}
  {\Huge\bfseries 高校数学 問題集\par}
  \vspace{5mm}
  {\large ---\ 教科書レベルから入試レベルまで ---\par}
  \vspace{25mm}
  {\LARGE 数学 II $\cdot$ B\par}
  \vspace{5mm}
  \rule{80mm}{0.5pt}\par
  \vspace{5mm}
  {\large 微分・積分 \quad 数列 \quad ベクトル\par}
  \vspace{45mm}
  {\large 第 1 版 \quad [解答冊子モード]\par}
  \vspace{2mm}
  {\large 編著:\ \underline{\hspace{40mm}}\par}
  \vfill
  \fbox{\parbox{120mm}{\centering\small プリアンブルの \texttt{\textbackslash showsolfalse} で\\解答を隠した\textbf{本冊モード} を生成できます}}
  \vspace{10mm}
\end{center}
\clearpage

\tableofcontents
\clearpage

% ══════════════════════════════════
% 使い方
% ══════════════════════════════════
\section*{この問題集の使い方}

\noindent本書は一つの LaTeX ソースから、学習者用の「本冊」と、教員用の「解答冊子」の 2 つを切り替えてコンパイルできます。

\begin{center}
  \renewcommand{\arraystretch}{1.3}
  \begin{tabular}{|l|c|c|}\hline
    \rowcolor{pbsoft!60} モード & \texttt{\textbackslash showsoltrue} & \texttt{\textbackslash showsolfalse}\\\hline
    解答 (▶ 解答.)  & \textcolor{pbkey}{表示}    & \textcolor{pbaccent}{非表示}\\\hline
    別解 (▶ 別解.)  & \textcolor{pbkey}{表示}    & \textcolor{pbaccent}{非表示}\\\hline
    ヒント         & \textcolor{pbkey}{表示}    & \textcolor{pbaccent}{非表示}\\\hline
    問題本文・重要公式 & \multicolumn{2}{c|}{常時表示}\\\hline
  \end{tabular}
\end{center}

\bigskip\noindent\textbf{難易度バッジ}\quad 各問題の右肩に以下の 4 段階のバッジが付きます。
\begin{itemize}[leftmargin=*,itemsep=1pt]
  \item \diff{★}\ 教科書レベル ── 授業後の確認に最適
  \item \diff{★★}\ 標準 ── 定期試験レベル
  \item \diff{★★★}\ 発展 ── 国公立二次・GMARCH レベル
  \item \diff{★★★★}\ 最難関 ── 難関国立・上位私立レベル
\end{itemize}

\clearpage

% ══════════════════════════════════
% 第 1 部 ── 微分・積分
% ══════════════════════════════════
\part{微分・積分}

\chapter{微分法}
\section*{到達目標}
\noindent本章では次の 3 点が達成できることを目指す。
\begin{itemize}[leftmargin=*,itemsep=1pt]
  \item 多項式関数・合成関数・積の関数の導関数が求められる
  \item 増減表を描いて極値を正しく判定できる
  \item 接線・法線の方程式が立てられる
\end{itemize}

\begin{keyformula}
\textbf{導関数の公式 (抜粋)}
\[ (x^n)' = nx^{n-1},\quad (cf)' = cf',\quad (f+g)' = f'+g',\quad (fg)' = f'g + fg'. \]
\end{keyformula}

\section{導関数の定義}

\begin{problem}{1.1}\diff{★}
  次の関数を微分せよ。
  \[ f(x) = 3x^2 - 2x + 5 \]
  \begin{hint}
    導関数の線形性 $(af + bg)' = af' + bg'$ と $(x^n)' = nx^{n-1}$ を使う。
  \end{hint}
  \begin{solution}
    線形性より $f'(x) = 3 \cdot 2x - 2 \cdot 1 + 0 = 6x - 2.$
  \end{solution}
\end{problem}

\begin{problem}{1.2}\diff{★★}
  曲線 $y = x^3 - 3x$ の $x = 1$ における接線の方程式を求めよ。
  \begin{hint}
    接線の方程式は $y - y_0 = f'(x_0)(x - x_0)$。 $(x_0, y_0) = (1, f(1))$ をまず求める。
  \end{hint}
  \begin{solution}
    $y' = 3x^2 - 3$ より、$x = 1$ における傾きは $3 - 3 = 0$。通る点は $(1, 1 - 3) = (1, -2)$ なので、接線は
    \[ y = -2. \]
  \end{solution}
  \begin{altsolution}
    接線 $y = ax + b$ と放物線の方程式 $x^3 - 3x - ax - b = 0$ が $x = 1$ で重解を持つ条件から $a, b$ を決定してもよい。
  \end{altsolution}
\end{problem}

\section{極値問題}

\begin{problem}{1.3}\diff{★★★}
  関数 $f(x) = x^3 - 6x^2 + 9x + 1$ の極値を求めよ。類題: 問題 1.4。
  \begin{hint}
    $f'(x) = 0$ を解いて極値の候補を求め、増減表で極大・極小を判定する。
  \end{hint}
  \begin{solution}
    $f'(x) = 3x^2 - 12x + 9 = 3(x-1)(x-3)$ より $f'(x) = 0$ の解は $x = 1, 3$。\par
    増減表から $x = 1$ で極大値 $f(1) = 1 - 6 + 9 + 1 = 5$、$x = 3$ で極小値 $f(3) = 27 - 54 + 27 + 1 = 1$。
  \end{solution}
\end{problem}

\begin{problem}{1.4}\diff{★★★★}
  関数 $f(x) = x^4 - 4x^3 + 4x^2$ の最小値を求めよ。 (問題 1.3 の類題)
  \begin{hint}
    $f'(x)$ を因数分解し、増減表から最小となる $x$ を絞り込む。
  \end{hint}
  \begin{solution}
    $f'(x) = 4x^3 - 12x^2 + 8x = 4x(x-1)(x-2)$。$f'(x) = 0$ の解は $x = 0, 1, 2$。\par
    増減表を作ると、$f(0) = 0$, $f(1) = 1$, $f(2) = 0$ で、$x \to \pm\infty$ のとき $f(x) \to \infty$。よって最小値は $\mathbf{0}$ ($x = 0, 2$ で実現)。
  \end{solution}
\end{problem}

\chapter{積分法}
\section*{到達目標}
\begin{itemize}[leftmargin=*,itemsep=1pt]
  \item 不定積分・定積分の計算ができる
  \item 曲線で囲まれた部分の面積を求められる
\end{itemize}

\begin{keyformula}[title={重要公式: 面積の計算}]
区間 $[a, b]$ で $f(x) \ge g(x)$ のとき、$y = f(x)$ と $y = g(x)$ で囲まれる部分の面積 $S$ は
\[ S = \int_a^b \bigl(f(x) - g(x)\bigr)\,dx. \]
\end{keyformula}

\section{不定積分・定積分}

\begin{problem}{2.1}\diff{★}
  次の不定積分を求めよ。
  \[ \int (2x + 1)\,dx \]
  \begin{solution}
    \[ \int (2x + 1)\,dx = x^2 + x + C. \]
  \end{solution}
\end{problem}

\begin{problem}{2.2}\diff{★★}
  次の定積分を求めよ。
  \[ \int_0^1 (3x^2 + 2x)\,dx \]
  \begin{solution}
    \[ \bigl[x^3 + x^2\bigr]_0^1 = 1 + 1 = 2. \]
  \end{solution}
\end{problem}

\section{面積}

\begin{problem}{2.3}\diff{★★★}
  曲線 $y = x^2$ と直線 $y = 2x$ で囲まれる部分の面積 $S$ を求めよ。
  \begin{hint}
    まず交点を求める ($x^2 = 2x$)。区間 $[0, 2]$ でどちらが上かを判定してから重要公式を適用。
  \end{hint}
  \begin{solution}
    交点は $x^2 = 2x$ より $x = 0, 2$. $0 \le x \le 2$ で $2x \ge x^2$ だから
    \[ S = \int_0^2 (2x - x^2)\,dx = \Bigl[x^2 - \tfrac{x^3}{3}\Bigr]_0^2 = 4 - \tfrac{8}{3} = \tfrac{4}{3}. \]
  \end{solution}
\end{problem}

% ── 単元末まとめ ──
\section*{章末まとめ}
\begin{keyformula}[title={本章で押さえるべき 3 点}]
\begin{enumerate}[leftmargin=*,itemsep=1pt]
  \item 導関数は線形で、$(x^n)' = nx^{n-1}$ が基本。
  \item 極値は $f'(x) = 0$ の解 $+$ 増減表で判定する。
  \item 面積は「上 $-$ 下」の積分で求める。交点と大小関係を先に調べる。
\end{enumerate}
\end{keyformula}

\end{document}
`;

const PROBLEM_BOOK_LATEX_EN = String.raw`\documentclass[11pt,a4paper,openany]{report}
\usepackage[T1]{fontenc}
\usepackage{geometry}
\geometry{top=26mm,bottom=24mm,left=22mm,right=22mm,headheight=14pt}
\usepackage{amsmath, amssymb, amsthm, mathtools, bm}
\usepackage{booktabs, tabularx, array, multirow}
\usepackage{graphicx}
\usepackage{xcolor}
\usepackage[hidelinks]{hyperref}
\usepackage{enumitem}
\usepackage{tcolorbox}
\tcbuselibrary{skins,breakable}
\usepackage{comment}
\usepackage{titlesec}
\usepackage{fancyhdr}

% \showsoltrue  -> answer-key booklet
% \showsolfalse -> exercise-only booklet
\newif\ifshowsol
\showsoltrue

\definecolor{pbaccent}{HTML}{c2410c}
\definecolor{pbsoft}{HTML}{fde4d0}
\definecolor{pbhint}{HTML}{0369a1}
\definecolor{pbhintsoft}{HTML}{dbeafe}
\definecolor{pbkey}{HTML}{059669}
\definecolor{pbkeysoft}{HTML}{d1fae5}

\titleformat{\part}[display]
  {\normalfont\Huge\bfseries\color{pbaccent}\filcenter}
  {Part \thepart}{10pt}{\Huge}
\titleformat{\chapter}[hang]
  {\normalfont\huge\bfseries\color{pbaccent}}{Ch.\ \thechapter}{12pt}{}
\titlespacing*{\chapter}{0pt}{10pt}{14pt}

\pagestyle{fancy}
\fancyhf{}
\fancyhead[L]{\small\color{pbaccent}\textbf{High-school Math II$\cdot$B}}
\fancyhead[R]{\small\leftmark}
\fancyfoot[C]{\small\thepage}
\renewcommand{\headrulewidth}{0.3pt}

\newcommand{\diff}[1]{%
  \hspace{4pt}\colorbox{pbaccent!15}{\textcolor{pbaccent}{\small\bfseries Level #1}}%
}

\newtcolorbox{problem}[2][]{%
  enhanced, breakable, colback=white, colframe=pbaccent!70,
  sharp corners, boxrule=0.4pt,
  attach boxed title to top left={xshift=6mm,yshift=-3mm},
  boxed title style={colback=pbaccent, colframe=pbaccent, sharp corners, boxrule=0pt},
  coltitle=white, fonttitle=\bfseries\small,
  title={Q\,#2},
  left=4mm,right=4mm,top=3mm,bottom=3mm,
  #1
}

\newtcolorbox{hintbox}{colback=pbhintsoft!50,colframe=pbhint,sharp corners,boxrule=0.3pt,left=3mm,right=3mm,top=1mm,bottom=1mm,fontupper=\small}

\newtcolorbox{keyformula}[1][]{%
  enhanced, colback=pbkeysoft!60, colframe=pbkey,
  sharp corners, boxrule=0.5pt,
  attach boxed title to top left={xshift=5mm,yshift=-3mm},
  boxed title style={colback=pbkey, colframe=pbkey, sharp corners, boxrule=0pt},
  coltitle=white, fonttitle=\bfseries\small,
  title={Key formulas},
  left=4mm,right=4mm,top=3mm,bottom=3mm, #1
}

\ifshowsol
  \newenvironment{solution}{\par\medskip\noindent\textbf{\color{pbaccent}▶ Solution.}\enspace}{\par\medskip}
  \newenvironment{altsolution}{\par\smallskip\noindent\textbf{\color{pbaccent}▶ Alternative.}\enspace}{\par}
  \newenvironment{hint}{\begin{hintbox}\textbf{\color{pbhint}Hint.}\enspace}{\end{hintbox}\par\smallskip}
\else
  \excludecomment{solution}
  \excludecomment{altsolution}
  \excludecomment{hint}
\fi

\begin{document}

\thispagestyle{empty}
\begin{center}
  \vspace*{30mm}
  {\Huge\bfseries High-school Math Problem Book\par}
  \vspace{5mm}
  {\large From textbook level to university entrance exam\par}
  \vspace{25mm}
  {\LARGE Mathematics II $\cdot$ B\par}
  \vspace{5mm}
  \rule{80mm}{0.5pt}\par
  \vspace{5mm}
  {\large Calculus \quad Sequences \quad Vectors\par}
  \vspace{45mm}
  {\large Edition 1.0 \quad [answer-key mode]\par}
  \vfill
  \fbox{\parbox{120mm}{\centering\small Switch to \texttt{\textbackslash showsolfalse} to compile the\\ \textbf{exercise-only} booklet}}
  \vspace{10mm}
\end{center}
\clearpage

\tableofcontents
\clearpage

\section*{How to Use This Book}
\noindent This book compiles either as a student booklet or a teacher answer key from a single LaTeX source.

\begin{center}
  \renewcommand{\arraystretch}{1.3}
  \begin{tabular}{|l|c|c|}\hline
    \rowcolor{pbsoft!60} Mode & \texttt{\textbackslash showsoltrue} & \texttt{\textbackslash showsolfalse}\\\hline
    Solution (▶ Solution.)  & \textcolor{pbkey}{shown}    & \textcolor{pbaccent}{hidden}\\\hline
    Alt.\ solution          & \textcolor{pbkey}{shown}    & \textcolor{pbaccent}{hidden}\\\hline
    Hint                    & \textcolor{pbkey}{shown}    & \textcolor{pbaccent}{hidden}\\\hline
    Problem / Key formula   & \multicolumn{2}{c|}{always shown}\\\hline
  \end{tabular}
\end{center}

\bigskip\noindent\textbf{Difficulty badges}
\begin{itemize}[leftmargin=*,itemsep=1pt]
  \item \diff{★}\ Textbook level
  \item \diff{★★}\ Standard (term-exam level)
  \item \diff{★★★}\ Advanced (national 2nd stage)
  \item \diff{★★★★}\ Top tier (top-national / elite private)
\end{itemize}

\clearpage

\part{Calculus}

\chapter{Differentiation}
\section*{Learning goals}
\begin{itemize}[leftmargin=*,itemsep=1pt]
  \item Differentiate polynomials and products
  \item Identify extrema from a sign table
  \item Set up tangent and normal lines
\end{itemize}

\begin{keyformula}
\textbf{Derivative rules.}
\[ (x^n)' = nx^{n-1},\quad (cf)' = cf',\quad (f+g)' = f'+g',\quad (fg)' = f'g + fg'. \]
\end{keyformula}

\begin{problem}{1.1}\diff{★}
  Differentiate $f(x) = 3x^2 - 2x + 5$.
  \begin{hint}
    Use linearity and the power rule $(x^n)' = nx^{n-1}$.
  \end{hint}
  \begin{solution} $f'(x) = 6x - 2$. \end{solution}
\end{problem}

\begin{problem}{1.2}\diff{★★}
  Find the tangent line to $y = x^3 - 3x$ at $x = 1$.
  \begin{hint}
    Use $y - y_0 = f'(x_0)(x - x_0)$. First compute $f(1)$ and $f'(1)$.
  \end{hint}
  \begin{solution}
    $y' = 3x^2 - 3$; the slope at $x=1$ is $0$. The tangent line is $y = -2$.
  \end{solution}
  \begin{altsolution}
    Equivalently, solve $x^3 - 3x - ax - b = 0$ with a double root at $x = 1$.
  \end{altsolution}
\end{problem}

\begin{problem}{1.3}\diff{★★★}
  Find the extrema of $f(x) = x^3 - 6x^2 + 9x + 1$.
  \begin{hint}
    Solve $f'(x) = 0$ and build a sign table.
  \end{hint}
  \begin{solution}
    $f'(x) = 3(x-1)(x-3)$, so critical points are $x = 1, 3$. Maximum $f(1) = 5$; minimum $f(3) = 1$.
  \end{solution}
\end{problem}

\chapter{Integration}
\section*{Learning goals}
\begin{itemize}[leftmargin=*,itemsep=1pt]
  \item Compute indefinite and definite integrals
  \item Compute areas enclosed by curves
\end{itemize}

\begin{keyformula}[title={Key formula: area between curves}]
If $f(x) \ge g(x)$ on $[a, b]$, the enclosed area is
\[ S = \int_a^b \bigl(f(x) - g(x)\bigr)\,dx. \]
\end{keyformula}

\begin{problem}{2.1}\diff{★}
  Evaluate $\int (2x + 1)\,dx$.
  \begin{solution} $x^2 + x + C$. \end{solution}
\end{problem}

\begin{problem}{2.2}\diff{★★★}
  Find the area enclosed by $y = x^2$ and $y = 2x$.
  \begin{hint}
    First find the intersections, then determine which curve is on top over $[0, 2]$.
  \end{hint}
  \begin{solution}
    $x^2 = 2x$ gives $x \in \{0, 2\}$. On $[0, 2]$, $2x \ge x^2$, so
    $S = \int_0^2 (2x - x^2)\,dx = \tfrac{4}{3}$.
  \end{solution}
\end{problem}

\section*{Chapter summary}
\begin{keyformula}[title={Three take-aways}]
\begin{enumerate}[leftmargin=*,itemsep=1pt]
  \item Differentiation is linear; the power rule $(x^n)' = nx^{n-1}$ is your workhorse.
  \item Extrema come from $f'(x) = 0$ plus a sign table.
  \item Areas are "upper $-$ lower" integrals; find intersections first.
\end{enumerate}
\end{keyformula}

\end{document}
`;

// ──────────────────────────────────────────
// P6. 教科書章 (textbook, 例題+練習+marginpar)
// ──────────────────────────────────────────
const TEXTBOOK_LATEX = String.raw`\documentclass[11pt,a4paper,openany]{report}
\usepackage[haranoaji]{luatexja-preset}
\usepackage{geometry}
\geometry{top=26mm,bottom=26mm,left=28mm,right=42mm,marginparwidth=34mm,marginparsep=4mm,headheight=14pt}
\usepackage{amsmath, amssymb, amsthm, mathtools, bm}
\usepackage{booktabs, tabularx, array}
\usepackage{graphicx}
\usepackage{xcolor}
\usepackage[hidelinks]{hyperref}
\usepackage{enumitem}
\usepackage{tcolorbox}
\tcbuselibrary{skins,breakable,theorems}
\usepackage{titlesec}
\usepackage{fancyhdr}

\definecolor{tbaccent}{HTML}{15803d}
\definecolor{tbsoft}{HTML}{d1fae5}
\definecolor{tbkey}{HTML}{fde68a}
\definecolor{tbadvance}{HTML}{7c3aed}   % 発展 (purple)
\definecolor{tbcaution}{HTML}{dc2626}   % 注意 (red)
\definecolor{tbcolumn}{HTML}{0369a1}    % コラム (blue)

% ── 章タイトル (display 形式) ──
% 小さな章番号 (第 N 章) を1行目、大きなタイトル (例: 三角比) を2行目、下線で締める。
% display shape の引数は {format}{label}{sep}{before-code}[after-code] の 5 つ。
% label = 第 N 章、before-code = title のフォントサイズ指定、after-code = 下線。
\titleformat{\chapter}[display]
  {\normalfont\color{tbaccent}}
  {\Large\bfseries 第 \thechapter 章}
  {6pt}
  {\Huge\bfseries}
  [\vspace{3mm}{\color{tbaccent}\hrule height 2pt}]
\titlespacing*{\chapter}{0pt}{0pt}{18pt}

\titleformat{\section}[hang]
  {\normalfont\Large\bfseries\color{tbaccent}}
  {\S\thesection}{0.8em}{}

% ── 走るヘッダ (章名とページ番号) ──
\pagestyle{fancy}
\fancyhf{}
\fancyhead[L]{\small\color{tbaccent}\textbf{高校数学 I}}
\fancyhead[R]{\small\leftmark}
\fancyfoot[C]{\small\thepage}
\renewcommand{\headrulewidth}{0.3pt}

% ── 例題 box (breakable で長文も確実に) ──
\newtcolorbox{example}[1][]{%
  enhanced, breakable, colback=tbsoft!50, colframe=tbaccent,
  sharp corners, boxrule=0.6pt,
  attach boxed title to top left={xshift=6mm,yshift=-3mm},
  boxed title style={colback=tbaccent, colframe=tbaccent, sharp corners, boxrule=0pt},
  coltitle=white, fonttitle=\bfseries\small,
  title={例題},
  left=4mm,right=4mm,top=3mm,bottom=3mm,
  #1
}

% ── 重要公式カード ──
\newtcolorbox{keyformula}[1][]{%
  enhanced, breakable, colback=tbkey!40, colframe=tbkey!80!black,
  sharp corners, boxrule=0.5pt,
  attach boxed title to top left={xshift=5mm,yshift=-3mm},
  boxed title style={colback=tbkey!80!black, colframe=tbkey!80!black, sharp corners, boxrule=0pt},
  coltitle=white, fonttitle=\bfseries\small,
  title={重要公式},
  left=4mm,right=4mm,top=3mm,bottom=3mm, #1
}

% ── 4 種コールアウト (発展 / 注意 / コラム / 参考) — すべて breakable ──
\newtcolorbox{advanced}[1][]{%
  enhanced, breakable, colback=tbadvance!10, colframe=tbadvance,
  sharp corners, boxrule=0.4pt,
  attach boxed title to top left={xshift=5mm,yshift=-3mm},
  boxed title style={colback=tbadvance, colframe=tbadvance, sharp corners, boxrule=0pt},
  coltitle=white, fonttitle=\bfseries\small,
  title={発展},
  left=4mm,right=4mm,top=2.5mm,bottom=2.5mm, #1
}

\newtcolorbox{caution}[1][]{%
  enhanced, breakable, colback=tbcaution!8, colframe=tbcaution,
  sharp corners, boxrule=0.4pt,
  left=4mm,right=4mm,top=2mm,bottom=2mm, #1
}

\newtcolorbox{column}[1][]{%
  enhanced, breakable, colback=tbcolumn!8, colframe=tbcolumn,
  sharp corners, boxrule=0.4pt,
  attach boxed title to top left={xshift=5mm,yshift=-3mm},
  boxed title style={colback=tbcolumn, colframe=tbcolumn, sharp corners, boxrule=0pt},
  coltitle=white, fonttitle=\bfseries\small,
  title={コラム},
  left=4mm,right=4mm,top=2.5mm,bottom=2.5mm, #1
}

% ── 余白メモ (margin note) ──
\newcommand{\side}[1]{\marginpar{\raggedright\small\color{tbaccent}#1}}
\newcommand{\term}[1]{\textbf{#1}\index{#1}}   % 用語強調 + 索引登録

\newenvironment{solution}{\par\smallskip\noindent\textbf{\small 解.}\enspace}{\par}

\title{}\author{}\date{}

\begin{document}

% ══════════════════════════════════
% 章扉 (学習目標 + この章で学ぶキーワード)
% ══════════════════════════════════
\chapter{三角比}

\begin{keyformula}[title={本章の学習目標}]
\begin{itemize}[leftmargin=*,itemsep=1pt]
  \item 直角三角形を用いて三角比 ($\sin, \cos, \tan$) を \term{定義} できる
  \item 三角比の \term{相互関係} (3 つの公式) を説明し、計算に利用できる
  \item 三角比を用いて実際の \term{測量問題} を解くことができる
  \item $30^\circ, 45^\circ, 60^\circ$ の三角比の値を暗記している
\end{itemize}
\end{keyformula}

\smallskip\noindent\textbf{キーワード:}\ 三角比 $\cdot$ 相似 $\cdot$ 三平方の定理 $\cdot$ 仰角 $\cdot$ 単位円

% ══════════════════════════════════
% §1. 定義
% ══════════════════════════════════
\section{三角比の定義}
\side{直角三角形の鋭角 $\theta$ に対して三角比を定義する。斜辺 (hypotenuse) / 対辺 (opposite) / 底辺 (adjacent) の位置関係を図で確認しよう。}

直角三角形 $\triangle ABC$ において $\angle C = 90^\circ$ とし、角 $\theta = \angle BAC$ に対して次の 3 つの比を定義する。
\begin{align*}
  \sin\theta = \frac{\text{対辺}}{\text{斜辺}},\quad
  \cos\theta = \frac{\text{底辺}}{\text{斜辺}},\quad
  \tan\theta = \frac{\text{対辺}}{\text{底辺}}.
\end{align*}

\begin{keyformula}[title={覚え方 (筆記体の書き順)}]
筆記体 s / c / t の書き順 "斜 $\to$ 対" / "斜 $\to$ 底" / "底 $\to$ 対" を思い浮かべると、分子と分母を迷わない。
\end{keyformula}

\begin{caution}
\textbf{よくある誤り:}\quad $\tan\theta$ の値は斜辺に依存しない。「対辺 $\div$ 底辺」であり、斜辺は分母に現れない。
\end{caution}

\begin{example}
  直角三角形で底辺 $= 4$, 対辺 $= 3$ のとき、$\sin\theta, \cos\theta, \tan\theta$ を求めよ。
  \begin{solution}
    斜辺は $\sqrt{4^2 + 3^2} = 5$。よって
    \[ \sin\theta = \tfrac{3}{5},\ \cos\theta = \tfrac{4}{5},\ \tan\theta = \tfrac{3}{4}. \]
  \end{solution}
\end{example}

\subsection*{練習 1.1 (基礎)}
底辺 $= 5$, 対辺 $= 12$ のとき、三角比 3 つの値を求めよ。

% ══════════════════════════════════
% §2. 主要な角
% ══════════════════════════════════
\section{主要な角の三角比}
\side{$30^\circ, 45^\circ, 60^\circ$ は高校数学で頻出。表のまま暗記してしまうのが近道。}

\begin{center}
  \renewcommand{\arraystretch}{1.5}
  \begin{tabular}{c|ccc}
    \toprule
    \rowcolor{tbsoft!60}
    $\theta$      & $30^\circ$              & $45^\circ$              & $60^\circ$\\
    \midrule
    $\sin\theta$  & $\dfrac{1}{2}$          & $\dfrac{\sqrt{2}}{2}$   & $\dfrac{\sqrt{3}}{2}$\\
    $\cos\theta$  & $\dfrac{\sqrt{3}}{2}$   & $\dfrac{\sqrt{2}}{2}$   & $\dfrac{1}{2}$\\
    $\tan\theta$  & $\dfrac{1}{\sqrt{3}}$   & $1$                     & $\sqrt{3}$\\
    \bottomrule
  \end{tabular}
\end{center}

\begin{column}[title={コラム: 30$^\circ$-60$^\circ$-90$^\circ$ の三角形}]
一辺が 2 の正三角形を垂線で 2 等分すると、辺の比 $1 : \sqrt{3} : 2$ の直角三角形が現れる。これが $30^\circ/60^\circ$ の三角比を導く幾何的基礎となる。
\end{column}

% ══════════════════════════════════
% §3. 相互関係
% ══════════════════════════════════
\section{相互関係}
\side{3 つの公式は三角比の根幹。入試での頻出度も非常に高い。}

直角三角形で三平方の定理 $(\text{対辺})^2 + (\text{底辺})^2 = (\text{斜辺})^2$ が成り立つことから、次の 3 つの等式が導かれる。

\begin{keyformula}[title={三角比の相互関係 (必修)}]
\begin{enumerate}[label=(\roman*),leftmargin=*,itemsep=2pt]
  \item $\sin^2\theta + \cos^2\theta = 1$
  \item $\displaystyle \tan\theta = \frac{\sin\theta}{\cos\theta}$
  \item $\displaystyle 1 + \tan^2\theta = \frac{1}{\cos^2\theta}$
\end{enumerate}
\end{keyformula}

\begin{example}
  $\sin\theta = \tfrac{3}{5}$ かつ $0^\circ < \theta < 90^\circ$ のとき、$\cos\theta$ と $\tan\theta$ を求めよ。
  \begin{solution}
    相互関係 (i) より $\cos^2\theta = 1 - \tfrac{9}{25} = \tfrac{16}{25}$。$0^\circ < \theta < 90^\circ$ のとき $\cos\theta > 0$ だから $\cos\theta = \tfrac{4}{5}$。したがって $\tan\theta = \tfrac{3/5}{4/5} = \tfrac{3}{4}$。
  \end{solution}
\end{example}

\begin{advanced}[title={発展: 負の角・鈍角への拡張}]
高校 2 年で学ぶ単位円を用いると、三角比の定義は $0^\circ$ 未満や $90^\circ$ 超の角にも拡張できる。詳しくは後の章で扱う。
\end{advanced}

% ══════════════════════════════════
% §4. 測量
% ══════════════════════════════════
\section{測量への応用}
\side{実地測量では $\tan\theta$ を用いて「高さ」を求めることが多い。}

\begin{example}
  高さ 20\,m の建物を地点 P から見上げた仰角が $30^\circ$ であった。地点 P から建物までの水平距離 $d$ を求めよ。
  \begin{solution}
    $\tan 30^\circ = \tfrac{20}{d}$ より
    \[ d = \frac{20}{\tan 30^\circ} = \frac{20}{1/\sqrt{3}} = 20\sqrt{3} \approx 34.6\,\text{[m]}. \]
  \end{solution}
\end{example}

\begin{column}[title={コラム: エラトステネスによる地球の大きさの測定}]
紀元前 240 年頃、エラトステネスは日時計による太陽の影の角度差を測り、地球の円周を約 39{,}000\,km と算出した。現代の値 (約 40{,}000\,km) と数パーセントしか違わない。三角比が実地の大きな測量に使える強力な道具であることを示す古典的な例である。
\end{column}

% ══════════════════════════════════
% 章末 — レベル別練習 + まとめ
% ══════════════════════════════════
\section*{章末問題 (レベル別)}

\noindent\textbf{[基礎]}
\begin{enumerate}[leftmargin=*,itemsep=3mm]
  \item $\cos\theta = \tfrac{1}{3}$ かつ $0^\circ < \theta < 90^\circ$ のとき、$\sin\theta,\ \tan\theta$ を求めよ。
  \item $(\sin\theta + \cos\theta)^2 + (\sin\theta - \cos\theta)^2$ を簡単にせよ。
\end{enumerate}

\medskip\noindent\textbf{[標準]}
\begin{enumerate}[leftmargin=*,start=3,itemsep=3mm]
  \item 地上 1.5\,m の観測者が高さ $h$\,m の電柱を見上げたとき、仰角が $45^\circ$ であった。観測者と電柱の根元との水平距離が 12\,m であるとして $h$ を求めよ。
  \item $\sin\theta + \cos\theta = \tfrac{1}{2}$ のとき、$\sin\theta \cos\theta$ の値を求めよ。
\end{enumerate}

\medskip\noindent\textbf{[発展]}
\begin{enumerate}[leftmargin=*,start=5,itemsep=3mm]
  \item $0^\circ < \theta < 90^\circ$ において、$\sin\theta + \cos\theta$ と $\sin\theta \cos\theta$ の関係式を導け。
\end{enumerate}

\section*{章末まとめ}

\begin{keyformula}[title={本章で押さえるべき 4 点}]
\begin{enumerate}[leftmargin=*,itemsep=1pt]
  \item 三角比は直角三角形の辺の比で定義される ($\sin, \cos, \tan$)。
  \item $30^\circ, 45^\circ, 60^\circ$ の三角比は暗記 (頻出)。
  \item 相互関係 3 公式は必修 ── $\sin^2 + \cos^2 = 1$ が最重要。
  \item 仰角・俯角を用いた測量問題は $\tan\theta$ を使って「高さ $=$ 距離 $\times \tan\theta$」と組み立てる。
\end{enumerate}
\end{keyformula}

\end{document}
`;

const TEXTBOOK_LATEX_EN = String.raw`\documentclass[11pt,a4paper,openany]{report}
\usepackage[T1]{fontenc}
\usepackage{geometry}
\geometry{top=26mm,bottom=26mm,left=28mm,right=42mm,marginparwidth=34mm,marginparsep=4mm,headheight=14pt}
\usepackage{amsmath, amssymb, amsthm, mathtools, bm}
\usepackage{booktabs, tabularx, array}
\usepackage{graphicx}
\usepackage{xcolor}
\usepackage[hidelinks]{hyperref}
\usepackage{enumitem}
\usepackage{tcolorbox}
\tcbuselibrary{skins,breakable}
\usepackage{titlesec}
\usepackage{fancyhdr}

\definecolor{tbaccent}{HTML}{15803d}
\definecolor{tbsoft}{HTML}{d1fae5}
\definecolor{tbkey}{HTML}{fde68a}
\definecolor{tbadvance}{HTML}{7c3aed}
\definecolor{tbcaution}{HTML}{dc2626}
\definecolor{tbcolumn}{HTML}{0369a1}

% Chapter title — small chapter label above a big title, ended by a rule.
\titleformat{\chapter}[display]
  {\normalfont\color{tbaccent}}
  {\Large\bfseries Chapter \thechapter}
  {6pt}
  {\Huge\bfseries}
  [\vspace{3mm}{\color{tbaccent}\hrule height 2pt}]
\titlespacing*{\chapter}{0pt}{0pt}{18pt}

\titleformat{\section}[hang]
  {\normalfont\Large\bfseries\color{tbaccent}}
  {\S\thesection}{0.8em}{}

\pagestyle{fancy}
\fancyhf{}
\fancyhead[L]{\small\color{tbaccent}\textbf{High-school Math I}}
\fancyhead[R]{\small\leftmark}
\fancyfoot[C]{\small\thepage}
\renewcommand{\headrulewidth}{0.3pt}

\newtcolorbox{example}[1][]{%
  enhanced, breakable, colback=tbsoft!50, colframe=tbaccent,
  sharp corners, boxrule=0.6pt,
  attach boxed title to top left={xshift=6mm,yshift=-3mm},
  boxed title style={colback=tbaccent, colframe=tbaccent, sharp corners, boxrule=0pt},
  coltitle=white, fonttitle=\bfseries\small,
  title={Worked example},
  left=4mm,right=4mm,top=3mm,bottom=3mm,
  #1
}

\newtcolorbox{keyformula}[1][]{%
  enhanced, breakable, colback=tbkey!40, colframe=tbkey!80!black,
  sharp corners, boxrule=0.5pt,
  attach boxed title to top left={xshift=5mm,yshift=-3mm},
  boxed title style={colback=tbkey!80!black, colframe=tbkey!80!black, sharp corners, boxrule=0pt},
  coltitle=white, fonttitle=\bfseries\small,
  title={Key point},
  left=4mm,right=4mm,top=3mm,bottom=3mm, #1
}

\newtcolorbox{advanced}[1][]{%
  enhanced, breakable, colback=tbadvance!10, colframe=tbadvance,
  sharp corners, boxrule=0.4pt,
  attach boxed title to top left={xshift=5mm,yshift=-3mm},
  boxed title style={colback=tbadvance, colframe=tbadvance, sharp corners, boxrule=0pt},
  coltitle=white, fonttitle=\bfseries\small,
  title={Further study},
  left=4mm,right=4mm,top=2.5mm,bottom=2.5mm, #1
}

\newtcolorbox{caution}[1][]{%
  enhanced, breakable, colback=tbcaution!8, colframe=tbcaution,
  sharp corners, boxrule=0.4pt,
  left=4mm,right=4mm,top=2mm,bottom=2mm, #1
}

\newtcolorbox{column}[1][]{%
  enhanced, breakable, colback=tbcolumn!8, colframe=tbcolumn,
  sharp corners, boxrule=0.4pt,
  attach boxed title to top left={xshift=5mm,yshift=-3mm},
  boxed title style={colback=tbcolumn, colframe=tbcolumn, sharp corners, boxrule=0pt},
  coltitle=white, fonttitle=\bfseries\small,
  title={Column},
  left=4mm,right=4mm,top=2.5mm,bottom=2.5mm, #1
}

\newcommand{\side}[1]{\marginpar{\raggedright\small\color{tbaccent}#1}}
\newcommand{\term}[1]{\textbf{#1}\index{#1}}

\newenvironment{solution}{\par\smallskip\noindent\textbf{\small Solution.}\enspace}{\par}

\begin{document}

\chapter{Trigonometric ratios}

\begin{keyformula}[title={Learning objectives}]
\begin{itemize}[leftmargin=*,itemsep=1pt]
  \item \term{Define} $\sin$, $\cos$, and $\tan$ using a right triangle
  \item State and use the three \term{Pythagorean identities}
  \item Apply trigonometry to real-world \term{measurement} problems
  \item Memorise the values of $\sin, \cos, \tan$ at $30^\circ, 45^\circ, 60^\circ$
\end{itemize}
\end{keyformula}

\smallskip\noindent\textbf{Keywords:}\ trigonometric ratios $\cdot$ similarity $\cdot$ Pythagorean theorem $\cdot$ elevation angle $\cdot$ unit circle

\section{Definitions}
\side{Identify the hypotenuse, opposite, and adjacent sides relative to the acute angle $\theta$.}

In a right triangle $\triangle ABC$ with $\angle C = 90^\circ$, let $\theta = \angle BAC$. Define
\[ \sin\theta = \tfrac{\text{opp.}}{\text{hyp.}},\ \cos\theta = \tfrac{\text{adj.}}{\text{hyp.}},\ \tan\theta = \tfrac{\text{opp.}}{\text{adj.}}. \]

\begin{keyformula}[title={Memory aid}]
Trace the cursive letters \emph{s}, \emph{c}, \emph{t} to remember which two sides go in the numerator and denominator.
\end{keyformula}

\begin{caution}
\textbf{Common error:}\ $\tan\theta$ does not depend on the hypotenuse. It is "opposite $\div$ adjacent", not "opposite $\div$ hypotenuse".
\end{caution}

\begin{example}
  If the adjacent side is $4$ and the opposite side is $3$, find the three ratios.
  \begin{solution}
    Hypotenuse $= \sqrt{16+9} = 5$. Hence $\sin\theta = \tfrac{3}{5}$, $\cos\theta = \tfrac{4}{5}$, $\tan\theta = \tfrac{3}{4}$.
  \end{solution}
\end{example}

\subsection*{Practice 1.1 (basic)}
If the adjacent side is $5$ and the opposite side is $12$, find the three ratios.

\section{Table of special angles}
\side{Memorise the values at $30^\circ, 45^\circ, 60^\circ$ — they appear everywhere.}

\begin{center}
  \renewcommand{\arraystretch}{1.5}
  \begin{tabular}{c|ccc}\toprule
    \rowcolor{tbsoft!60}
    $\theta$ & $30^\circ$ & $45^\circ$ & $60^\circ$\\\midrule
    $\sin$ & $\tfrac{1}{2}$          & $\tfrac{\sqrt{2}}{2}$   & $\tfrac{\sqrt{3}}{2}$\\
    $\cos$ & $\tfrac{\sqrt{3}}{2}$   & $\tfrac{\sqrt{2}}{2}$   & $\tfrac{1}{2}$\\
    $\tan$ & $\tfrac{1}{\sqrt{3}}$   & $1$                     & $\sqrt{3}$\\\bottomrule
  \end{tabular}
\end{center}

\begin{column}[title={Column: the 30-60-90 triangle}]
Bisecting an equilateral triangle of side $2$ with a perpendicular produces a right triangle with sides in the ratio $1 : \sqrt{3} : 2$. This is the geometric basis of the $30^\circ$ and $60^\circ$ values.
\end{column}

\section{Identities}
\side{These three are the backbone of trigonometry.}

From the Pythagorean theorem $(\text{opp.})^2 + (\text{adj.})^2 = (\text{hyp.})^2$, the following identities follow.

\begin{keyformula}[title={Pythagorean identities (must memorise)}]
\begin{enumerate}[label=(\roman*),leftmargin=*,itemsep=2pt]
  \item $\sin^2\theta + \cos^2\theta = 1$
  \item $\displaystyle \tan\theta = \frac{\sin\theta}{\cos\theta}$
  \item $\displaystyle 1 + \tan^2\theta = \frac{1}{\cos^2\theta}$
\end{enumerate}
\end{keyformula}

\begin{example}
  Given $\sin\theta = \tfrac{3}{5}$ and $0^\circ < \theta < 90^\circ$, find $\cos\theta$ and $\tan\theta$.
  \begin{solution}
    From (i), $\cos^2\theta = 1 - \tfrac{9}{25} = \tfrac{16}{25}$. Since $\cos\theta > 0$ on $(0^\circ, 90^\circ)$, $\cos\theta = \tfrac{4}{5}$, and $\tan\theta = \tfrac{3/5}{4/5} = \tfrac{3}{4}$.
  \end{solution}
\end{example}

\begin{advanced}[title={Further study: extending to negative and obtuse angles}]
Using the unit-circle definition (introduced later), the trigonometric ratios extend to angles outside $(0^\circ, 90^\circ)$. Covered in a later chapter.
\end{advanced}

\section{Applications to measurement}
\side{In surveying, $\tan\theta$ is often used to find heights from horizontal distances.}

\begin{example}
  From point $P$, the elevation angle of the top of a 20\,m building is $30^\circ$. Find the horizontal distance $d$ from $P$ to the building.
  \begin{solution}
    $\tan 30^\circ = \tfrac{20}{d}$, so $d = \tfrac{20}{\tan 30^\circ} = 20\sqrt{3} \approx 34.6\,\text{m}$.
  \end{solution}
\end{example}

\begin{column}[title={Column: Eratosthenes measures the Earth}]
Around 240 BC, Eratosthenes measured the angle of the Sun's shadow at two locations and used trigonometry to estimate the Earth's circumference as roughly 39{,}000\,km --- only a few percent off the modern figure of $\sim$40{,}000\,km. A striking demonstration that simple trigonometric ratios scale up to planetary measurements.
\end{column}

\section*{End-of-chapter problems (by level)}

\noindent\textbf{[Basic]}
\begin{enumerate}[leftmargin=*,itemsep=3mm]
  \item Given $\cos\theta = \tfrac{1}{3}$ and $0^\circ < \theta < 90^\circ$, find $\sin\theta$ and $\tan\theta$.
  \item Simplify $(\sin\theta + \cos\theta)^2 + (\sin\theta - \cos\theta)^2$.
\end{enumerate}

\medskip\noindent\textbf{[Standard]}
\begin{enumerate}[leftmargin=*,start=3,itemsep=3mm]
  \item A $1.5$-m-tall observer sees the top of a lamp post at a $45^\circ$ elevation from $12$\,m away. Find the height of the post.
  \item If $\sin\theta + \cos\theta = \tfrac{1}{2}$, find $\sin\theta\cos\theta$.
\end{enumerate}

\medskip\noindent\textbf{[Advanced]}
\begin{enumerate}[leftmargin=*,start=5,itemsep=3mm]
  \item For $0^\circ < \theta < 90^\circ$, derive a relation between $\sin\theta + \cos\theta$ and $\sin\theta\cos\theta$.
\end{enumerate}

\section*{Chapter summary}
\begin{keyformula}[title={Four take-aways}]
\begin{enumerate}[leftmargin=*,itemsep=1pt]
  \item Trigonometric ratios are defined by the sides of a right triangle.
  \item Memorise the values at $30^\circ, 45^\circ, 60^\circ$.
  \item The three Pythagorean identities are essential --- $\sin^2 + \cos^2 = 1$ most of all.
  \item For elevation-angle problems: \emph{height $=$ distance $\times \tan\theta$}.
\end{enumerate}
\end{keyformula}

\end{document}
`;

// ══════════════════════════════════════════
// Template Registry
// ══════════════════════════════════════════

/** UI 上のテンプレートのカテゴリ。 */
export type TemplateCategory =
  | "blank"
  | "exam"      // 試験・入試
  | "study"     // 学習・解説
  | "document"  // 文書・レポート
  | "slide"     // 発表
  | "letter";   // 手紙

export interface TemplateDefinition {
  id: string;
  name: string;
  nameEn: string;
  /** 一行の補助説明 (UI ではプレビューが主役なので使わないことが多い) */
  description: string;
  descriptionEn: string;
  /** 短いタグ (例: "試験", "発表"). カードのフッタに表示。 */
  tag?: string;
  tagEn?: string;
  category: TemplateCategory;
  gradient: string;
  accentColor: string;
  icon: string;
  documentClass: LaTeXDocumentClass;
  /** Japanese starter LaTeX source. locale === "ja" のとき使用。 */
  latex: string;
  /** English starter LaTeX source. locale === "en" のとき使用。
   *  英訳されていないテンプレートでは undefined → ja 版にフォールバック。 */
  latexEn?: string;
  /**
   * 利用可能な最低プラン。
   *   - "free":    全プラン (LP の「基本テンプレート」、6 種)
   *   - "pro":     Pro / Premium 限定 (入試・発表・報告書 等、+6 種)
   *   - "premium": Premium のみ (卒論・学会ポスター・教科書 等の本格長尺、+6 種)
   * 省略時は "free" とみなす。
   */
  tier?: "free" | "pro" | "premium";
}

export const TEMPLATES: TemplateDefinition[] = [
  // ──── Blank ────
  {
    id: "blank",
    name: "白紙",
    nameEn: "Blank page",
    description: "白紙の紙から自由に書き始める",
    descriptionEn: "Start writing from a blank page",
    tag: "白紙",
    tagEn: "Blank",
    category: "blank",
    gradient: "from-slate-400 via-gray-300 to-slate-300",
    accentColor: "bg-slate-400",
    icon: "📄",
    documentClass: "article",
    latex: BLANK_LATEX,
    latexEn: BLANK_LATEX_EN,
  },

  // ──── Exam: 試験・入試 ────
  {
    id: "common-test",
    name: "共通テスト風",
    nameEn: "National exam style",
    description: "70 分・100 点・大問 3 題の模試冊子",
    descriptionEn: "70-min, 100-point mock exam booklet with 3 problem sets",
    tag: "入試",
    tagEn: "Exam",
    category: "exam",
    gradient: "from-blue-700 via-indigo-500 to-cyan-400",
    accentColor: "bg-indigo-600",
    icon: "📐",
    documentClass: "article",
    latex: COMMON_TEST_LATEX,
    latexEn: COMMON_TEST_LATEX_EN,
    tier: "pro",
  },
  {
    id: "kokuko-niji",
    name: "国公立二次風",
    nameEn: "Univ. 2nd-stage style",
    description: "150 分・200 点・記述式 大問 3 題の本格冊子",
    descriptionEn: "150-min, 200-point free-response booklet with 3 problems",
    tag: "二次",
    tagEn: "Univ.",
    category: "exam",
    gradient: "from-zinc-700 via-zinc-500 to-zinc-400",
    accentColor: "bg-zinc-700",
    icon: "🎓",
    documentClass: "article",
    latex: KOKUKO_NIJI_LATEX,
    latexEn: KOKUKO_NIJI_LATEX_EN,
    tier: "pro",
  },
  {
    id: "school-test",
    name: "学校テスト",
    nameEn: "School test",
    description: "氏名欄+得点欄付き・100 点満点の定期考査用紙",
    descriptionEn: "Periodic test sheet with name/score fields, scored out of 100",
    tag: "テスト",
    tagEn: "Test",
    category: "exam",
    gradient: "from-rose-500 via-red-400 to-orange-400",
    accentColor: "bg-rose-500",
    icon: "📝",
    documentClass: "article",
    latex: SCHOOL_TEST_LATEX,
    latexEn: SCHOOL_TEST_LATEX_EN,
  },

  // ──── Study: 学習・解説 ────
  {
    id: "juku",
    name: "塾プリント",
    nameEn: "Cram-school worksheet",
    description: "★難度バッジ付き・90 分授業の二次関数プリント",
    descriptionEn: "90-min cram-school worksheet on quadratic functions, with ★ difficulty badges",
    tag: "塾",
    tagEn: "Cram",
    category: "study",
    gradient: "from-orange-500 via-red-400 to-amber-400",
    accentColor: "bg-orange-500",
    icon: "🔥",
    documentClass: "article",
    latex: JUKU_LATEX,
    latexEn: JUKU_LATEX_EN,
    tier: "pro",
  },
  {
    id: "kaisetsu-note",
    name: "解説ノート",
    nameEn: "Lecture note",
    description: "定義 → 例題 → 定理 → 練習で 1 章まるごとカバー",
    descriptionEn: "Full chapter walkthrough: definition → example → theorem → exercises",
    tag: "ノート",
    tagEn: "Notes",
    category: "study",
    gradient: "from-teal-500 via-cyan-400 to-sky-400",
    accentColor: "bg-teal-500",
    icon: "📓",
    documentClass: "article",
    latex: KAISETSU_NOTE_LATEX,
    latexEn: KAISETSU_NOTE_LATEX_EN,
  },
  {
    id: "worksheet",
    name: "演習プリント",
    nameEn: "Worksheet",
    description: "1 単元 7 問・基本/標準/発展で組まれた授業用プリント",
    descriptionEn: "7-question 1-unit class worksheet, split into basic/standard/advanced",
    tag: "授業",
    tagEn: "Class",
    category: "study",
    gradient: "from-cyan-500 via-teal-400 to-sky-400",
    accentColor: "bg-teal-500",
    icon: "📋",
    documentClass: "article",
    latex: WORKSHEET_LATEX,
    latexEn: WORKSHEET_LATEX_EN,
  },
  {
    id: "english-worksheet",
    name: "英語ワークシート",
    nameEn: "Reading worksheet",
    description: "単語 → 本文 → 設問 → 作文の Unit 1 枚",
    descriptionEn: "1-page reading unit: vocabulary → passage → comprehension → writing",
    tag: "英語",
    tagEn: "Reading",
    category: "study",
    gradient: "from-emerald-500 via-green-400 to-lime-400",
    accentColor: "bg-emerald-500",
    icon: "🇬🇧",
    documentClass: "article",
    latex: ENGLISH_WORKSHEET_LATEX,
    latexEn: ENGLISH_WORKSHEET_LATEX_EN,
    tier: "pro",
  },

  // ──── Document: 文書・レポート ────
  {
    id: "article",
    name: "レポート・論文",
    nameEn: "Report / paper",
    description: "abstract → 5 セクション → 参考文献の学術論文",
    descriptionEn: "Academic paper: abstract → 5 sections → bibliography",
    tag: "論文",
    tagEn: "Paper",
    category: "document",
    gradient: "from-blue-600 via-indigo-500 to-cyan-400",
    accentColor: "bg-blue-600",
    icon: "📄",
    documentClass: "article",
    latex: ARTICLE_LATEX,
    latexEn: ARTICLE_LATEX_EN,
  },
  {
    id: "report",
    name: "技術報告書",
    nameEn: "Technical report",
    description: "表紙 + 目次 + 3 章構成の長文ドキュメント",
    descriptionEn: "Cover + TOC + 3-chapter long-form document",
    tag: "報告書",
    tagEn: "Report",
    category: "document",
    gradient: "from-teal-700 via-emerald-500 to-cyan-400",
    accentColor: "bg-teal-700",
    icon: "📊",
    documentClass: "report",
    latex: REPORT_LATEX,
    latexEn: REPORT_LATEX_EN,
    tier: "pro",
  },

  // ──── Slide ────
  {
    id: "beamer",
    name: "プレゼンテーション",
    nameEn: "Presentation",
    description: "16:9・5 枚で構成される学会発表スライド",
    descriptionEn: "5-slide 16:9 conference-talk deck",
    tag: "発表",
    tagEn: "Slides",
    category: "slide",
    gradient: "from-violet-600 via-purple-500 to-fuchsia-400",
    accentColor: "bg-violet-600",
    icon: "🎬",
    documentClass: "beamer",
    latex: BEAMER_LATEX,
    latexEn: BEAMER_LATEX_EN,
    tier: "pro",
  },

  // ──── Letter ────
  {
    id: "letter",
    name: "手紙・通信文",
    nameEn: "Formal letter",
    description: "拝啓〜敬具・「記」付きの正式なビジネス案内状",
    descriptionEn: "Formal English business letter (Dear ... → Sincerely)",
    tag: "手紙",
    tagEn: "Letter",
    category: "letter",
    gradient: "from-stone-500 via-amber-300 to-orange-300",
    accentColor: "bg-amber-600",
    icon: "✉️",
    documentClass: "article",
    latex: LETTER_LATEX,
    latexEn: LETTER_LATEX_EN,
  },

  // ════════════════════════════════════════
  // Premium-only templates (tier: "premium")
  //   本格長尺ドキュメント — 卒論 / 総合模試冊子 / 学会ポスター
  //   学術論文 / 問題集 / 教科書。Premium プラン限定。
  // ════════════════════════════════════════
  {
    id: "thesis",
    name: "卒論・修論",
    nameEn: "Thesis",
    description: "表紙+目次+5章+参考文献+謝辞の本格卒業論文",
    descriptionEn: "Title + TOC + 5 chapters + bibliography + acknowledgements",
    tag: "卒論",
    tagEn: "Thesis",
    category: "document",
    gradient: "from-blue-900 via-indigo-700 to-slate-600",
    accentColor: "bg-blue-900",
    icon: "🎓",
    documentClass: "article",
    latex: THESIS_LATEX,
    latexEn: THESIS_LATEX_EN,
    tier: "premium",
  },
  {
    id: "mock-exam-book",
    name: "総合模試冊子",
    nameEn: "Full mock-exam",
    description: "表紙+注意事項+4大問+解答用紙の模試一式",
    descriptionEn: "Cover + instructions + 4 problems + answer sheet",
    tag: "模試",
    tagEn: "Mock",
    category: "exam",
    gradient: "from-red-800 via-rose-600 to-orange-500",
    accentColor: "bg-red-800",
    icon: "📚",
    documentClass: "article",
    latex: MOCK_EXAM_LATEX,
    latexEn: MOCK_EXAM_LATEX_EN,
    tier: "premium",
  },
  {
    id: "poster",
    name: "学会ポスター",
    nameEn: "Academic poster",
    description: "A0縦・3列×7ブロック構成の学会ポスター",
    descriptionEn: "A0 portrait, 3-column × 7-block conference poster",
    tag: "ポスター",
    tagEn: "Poster",
    category: "slide",
    gradient: "from-sky-700 via-cyan-500 to-amber-300",
    accentColor: "bg-sky-700",
    icon: "🖼️",
    documentClass: "beamer",
    latex: POSTER_LATEX,
    latexEn: POSTER_LATEX_EN,
    tier: "premium",
  },
  {
    id: "academic-paper",
    name: "学術論文 (投稿原稿)",
    nameEn: "Journal paper",
    description: "abstract+キーワード+6節+定理環境+参考文献",
    descriptionEn: "Abstract + keywords + 6 sections + theorems + bibliography",
    tag: "論文",
    tagEn: "Journal",
    category: "document",
    gradient: "from-indigo-800 via-blue-600 to-sky-400",
    accentColor: "bg-indigo-800",
    icon: "🧪",
    documentClass: "article",
    latex: ACADEMIC_PAPER_LATEX,
    latexEn: ACADEMIC_PAPER_LATEX_EN,
    tier: "premium",
  },
  {
    id: "problem-book",
    name: "問題集 (解答切替)",
    nameEn: "Problem book",
    description: "章別・難易度バッジ・本冊/解答冊子をトグルで切替",
    descriptionEn: "Chapters + difficulty badges + answer-key toggle",
    tag: "問題集",
    tagEn: "Problems",
    category: "study",
    gradient: "from-orange-700 via-amber-500 to-yellow-300",
    accentColor: "bg-orange-700",
    icon: "📕",
    documentClass: "article",
    latex: PROBLEM_BOOK_LATEX,
    latexEn: PROBLEM_BOOK_LATEX_EN,
    tier: "premium",
  },
  {
    id: "textbook",
    name: "教科書章",
    nameEn: "Textbook chapter",
    description: "margin注+例題box+練習+章末問題の本格教科書章",
    descriptionEn: "Margin notes + example boxes + exercises + end-of-chapter",
    tag: "教科書",
    tagEn: "Textbook",
    category: "study",
    gradient: "from-emerald-800 via-green-500 to-lime-300",
    accentColor: "bg-emerald-800",
    icon: "📗",
    documentClass: "article",
    latex: TEXTBOOK_LATEX,
    latexEn: TEXTBOOK_LATEX_EN,
    tier: "premium",
  },
];

// ══════════════════════════════════════════
// Categories metadata (for UI grouping)
// ══════════════════════════════════════════

export interface TemplateCategoryMeta {
  id: TemplateCategory;
  label: string;
  labelEn: string;
  icon: string;
}

export const TEMPLATE_CATEGORIES: TemplateCategoryMeta[] = [
  { id: "blank",    label: "白紙",         labelEn: "Blank",    icon: "📄" },
  { id: "exam",     label: "試験・入試",   labelEn: "Exams",    icon: "🎓" },
  { id: "study",    label: "学習・教材",   labelEn: "Study",    icon: "📓" },
  { id: "document", label: "文書",         labelEn: "Documents",icon: "📑" },
  { id: "slide",    label: "発表",         labelEn: "Slides",   icon: "🎬" },
  { id: "letter",   label: "手紙",         labelEn: "Letters",  icon: "✉️" },
];

// ══════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════

/** UI ロケール (ja / en) を表す軽量型。i18n の Locale と互換。 */
export type TemplateLocale = "ja" | "en";

/** locale を考慮してテンプレートの LaTeX を選ぶ。en で latexEn が無ければ ja にフォールバック。 */
function pickLatex(tmpl: TemplateDefinition, locale: TemplateLocale): string {
  if (locale === "en" && tmpl.latexEn) return tmpl.latexEn;
  return tmpl.latex;
}

function pickBlankLatex(locale: TemplateLocale): string {
  return locale === "en" ? BLANK_LATEX_EN : BLANK_LATEX;
}

function pickTitle(tmpl: TemplateDefinition, locale: TemplateLocale): string {
  if (tmpl.id === "blank") return "";
  return locale === "en" ? tmpl.nameEn : tmpl.name;
}

export function createFromTemplate(
  templateId: string,
  locale: TemplateLocale = "ja",
  blank = false,
): DocumentModel {
  const tmpl = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0];
  return {
    template: tmpl.id,
    metadata: { title: pickTitle(tmpl, locale), author: "" },
    settings: {
      ...DEFAULT_SETTINGS,
      documentClass: tmpl.documentClass,
    },
    latex: blank ? pickBlankLatex(locale) : pickLatex(tmpl, locale),
  };
}

export function getTemplateLatex(templateId: string, locale: TemplateLocale = "ja"): string {
  const tmpl = TEMPLATES.find((t) => t.id === templateId);
  if (!tmpl) return pickBlankLatex(locale);
  return pickLatex(tmpl, locale);
}
