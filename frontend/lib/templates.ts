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
\usepackage{tcolorbox}
\tcbuselibrary{breakable,skins,theorems}
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
\usepackage{tcolorbox}
\tcbuselibrary{skins}
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
\usepackage{tcolorbox}
\tcbuselibrary{skins,breakable}
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
\usepackage{tcolorbox}
\tcbuselibrary{skins,breakable,theorems}
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
\usepackage{tcolorbox}
\tcbuselibrary{skins}
\usepackage{titlesec}
\usepackage{fancyhdr}
\hypersetup{hidelinks}

\definecolor{wsteal}{HTML}{0d9488}
\definecolor{wssky}{HTML}{0284c7}
\definecolor{wsink}{HTML}{0f172a}
\definecolor{wspale}{HTML}{ecfeff}

\newcommand{\unit}[1]{%
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

\unit{三角比の定義 / 正弦定理 / 余弦定理}

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
\usepackage{tcolorbox}
\tcbuselibrary{skins,breakable}
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
\usepackage{tcolorbox}
\tcbuselibrary{skins,breakable}
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
\usepackage{tcolorbox}
\tcbuselibrary{breakable,skins,theorems}
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
\usepackage{tcolorbox}
\tcbuselibrary{skins}
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
\usepackage{tcolorbox}
\tcbuselibrary{skins,breakable}
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
\juKey{$\circled{1}$ Completing the square} $\;ax^2+bx+c=a\!\left(x+\dfrac{b}{2a}\right)^{\!2}-\dfrac{b^2-4ac}{4a}$\quad
\juKey{$\circled{2}$ Discriminant} $\;D=b^2-4ac$
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
\usepackage{tcolorbox}
\tcbuselibrary{skins,breakable,theorems}
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
\usepackage{tcolorbox}
\tcbuselibrary{skins}
\usepackage{titlesec}
\usepackage{fancyhdr}
\hypersetup{hidelinks}

\definecolor{wsteal}{HTML}{0d9488}
\definecolor{wsink}{HTML}{0f172a}
\definecolor{wspale}{HTML}{ecfeff}

\newcommand{\unit}[1]{%
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

\unit{Right-triangle definitions / Law of Sines / Law of Cosines}

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
\usepackage{tcolorbox}
\tcbuselibrary{skins,breakable}
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
\usepackage{tcolorbox}
\tcbuselibrary{skins,breakable}
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
