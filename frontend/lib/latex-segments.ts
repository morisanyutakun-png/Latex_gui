/**
 * latex-segments — LaTeX 文字列を「区間付きセグメント配列」に分解するパーサー
 *
 * 設計方針:
 * - LaTeX 文字列が単一の真実源 (SoT)。新たな構造化モデルは持たない。
 * - 各セグメント / インラインは元 LaTeX 内の正確な [start, end) を保持する。
 * - 認識できない構文は必ず `raw` に逃がす (壊れない escape hatch)。
 * - 編集時は、セグメント単位で元 LaTeX の該当範囲だけをピンポイント置換する。
 *   (1 編集 → 即 setLatex → 即再パース、で範囲ずれを回避)
 *
 * v1 でサポートする構文 (それ以外は raw):
 *   見出し: \section{} \subsection{} \subsubsection{} \paragraph{}
 *   段落: 連続するテキスト (空行で分割)
 *   表示数式: \[...\] / $$...$$ / \begin{equation|align|gather|displaymath}...\end{...}
 *   インライン: $...$ \(...\) \textbf{} \textit{} \emph{} \texttt{}
 *   リスト: \begin{itemize}...\end{itemize} / \begin{enumerate}...\end{enumerate} (子は \item)
 *   単独命令: \maketitle \tableofcontents \newpage \clearpage \pagebreak (raw として)
 *   \begin{document}/\end{document}, それ以外の \begin{}\end{} は raw
 */

export type SegmentKind =
  | "preamble"
  | "titleBlock"  // \maketitle を展開して \title / \subtitle / \author / \date を可視ブロックとして表示
  | "toc"         // \tableofcontents を展開して章節のリストとして表示
  | "vspace"      // \vspace{...} / \smallskip / \medskip / \bigskip を可視スペースとして描画
  | "pageBreak"   // \newpage / \clearpage / \pagebreak を可視の改ページマーカとして描画
  | "bibliography" // \begin{thebibliography}...\end{thebibliography} を参考文献リストとして描画
  | "section"
  | "subsection"
  | "subsubsection"
  | "paragraph"
  | "displayMath"
  | "itemize"
  | "enumerate"
  | "item"
  | "daimon"      // \begin{daimon}{title}...\end{daimon} (テンプレ独自・大問ボックス)
  | "center"      // \begin{center}...\end{center} (中身を再帰展開して中央寄せ)
  | "container"   // 未知環境を透過的に展開する汎用コンテナ (tcolorbox / kihon / ouyou / teigi など)
  | "table"       // \begin{tabular|tabularx|tabular*}{...}...\end{...} を HTML テーブルとして描画
  | "raw"
  | "documentEnd"; // \end{document} 以降の trailing 部分 (非表示)

export type InlineKind =
  | "text"
  | "inlineMath"
  | "displayMath"  // \[...\] / \begin{equation}...\end{equation} 等を item 等の本文内で出会った場合
  | "bold"
  | "italic"
  | "code"
  | "scoreBadge"   // \haiten{N} 等、表示は装飾バッジ・元 LaTeX は保存
  | "rule"         // \rule{width}{height} → 見える線
  | "linebreak"    // \\ → <br/>
  | "framed"       // \fbox{...} → 枠付きスパン
  | "colored"      // \textcolor{name}{...} → 色付きスパン
  | "sized"        // {\Large\bfseries ...} → 大きな太字スパン
  | "templateCmd"; // テンプレ独自コマンド (\juKey, \jukutitle, \chui, \nlevel, \unit, \level, \daimonhead, \jukutitle, \anslines)

export interface Range {
  start: number;
  end: number;
}

export interface Inline {
  id: string;
  kind: InlineKind;
  /** 元 LaTeX 内の絶対オフセット (wrapper 込みの全範囲) */
  range: Range;
  /** 編集対象になる中身。inlineMath なら $...$ の中身、bold なら \textbf{} の中身 */
  body: string;
  /** kind に応じた補助情報。
   *  - rule: { width, height }
   *  - colored: { color }
   *  - framed: (なし)
   *  - sized: { size: tiny|scriptsize|small|normal|large|Large|LARGE|huge|Huge, weight?: bold } */
  meta?: Record<string, string>;
}

export interface Segment {
  id: string;
  kind: SegmentKind;
  /** 元 LaTeX 内の絶対オフセット (このセグメント全体) */
  range: Range;
  /** 編集対象の中身。kind による:
   *   - section/subsection/...: 見出しタイトル
   *   - paragraph: 段落の生テキスト (inlines が未指定のときの fallback)
   *   - displayMath: 数式の中身 (\[ \] や $$ $$ の内側)
   *   - preamble/raw/documentEnd: 元の slice そのまま (表示専用)
   */
  body: string;
  /** paragraph / item の場合に inline 配列を保持 */
  inlines?: Inline[];
  /** itemize / enumerate の場合に子 (item segment) を保持 */
  children?: Segment[];
  /** 表示用メタ (例: displayMath の wrapper 種別) */
  meta?: Record<string, string>;
}

// ─────────────────────────────────────
// Helpers
// ─────────────────────────────────────

let __idCounter = 0;
function nextId(prefix: string): string {
  __idCounter += 1;
  return `${prefix}-${__idCounter}`;
}

/** バランスのとれた {} の終端を見つける。startBrace は '{' の位置。見つからなければ -1。 */
function findMatchingBrace(src: string, startBrace: number, end: number): number {
  if (src[startBrace] !== "{") return -1;
  let depth = 0;
  for (let i = startBrace; i < end; i++) {
    const ch = src[i];
    if (ch === "\\" && i + 1 < end) {
      i++; // skip escaped char
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** \begin{name}…\end{name} の終端 (\end{name} の最後の `}` の次) を返す。見つからなければ -1。 */
function findEnvironmentEnd(src: string, beginStart: number, name: string, end: number): number {
  const open = `\\begin{${name}}`;
  const close = `\\end{${name}}`;
  let depth = 1;
  let i = beginStart + open.length;
  while (i < end) {
    if (src.startsWith(open, i)) {
      depth++;
      i += open.length;
      continue;
    }
    if (src.startsWith(close, i)) {
      depth--;
      if (depth === 0) return i + close.length;
      i += close.length;
      continue;
    }
    if (src[i] === "\\" && i + 1 < end) {
      i += 2;
      continue;
    }
    i++;
  }
  return -1;
}

/** 環境名 (\begin{NAME}) を読み取る。見つからなければ null。 */
function readEnvironmentName(src: string, atBackslash: number, end: number): string | null {
  if (!src.startsWith("\\begin{", atBackslash)) return null;
  const nameStart = atBackslash + "\\begin{".length;
  const nameEnd = src.indexOf("}", nameStart);
  if (nameEnd === -1 || nameEnd >= end) return null;
  return src.slice(nameStart, nameEnd);
}

// ─────────────────────────────────────
// インライン抽出
// ─────────────────────────────────────

/** インライン中で「無視して通り抜ける」コマンド (引数なし or サイズ系)
 *  これらが現れたら、本文 (続くテキスト or グループ) はそのまま流し込む。 */
const INLINE_DROP_CMDS = new Set([
  // サイズ
  "tiny", "scriptsize", "footnotesize", "small", "normalsize",
  "large", "Large", "LARGE", "huge", "Huge",
  // 字形
  "bfseries", "itshape", "slshape", "scshape", "upshape",
  "rmfamily", "sffamily", "ttfamily", "mdseries",
  // 配置 / その他
  "noindent", "centering", "raggedright", "raggedleft",
  "selectfont", "par",
]);

/** インライン中で「空白として描画する」引数なしコマンド。
 *  消費して "\u00A0" (NBSP) を 1 つ挿入する。 */
const INLINE_SPACE_CMDS = new Set([
  "quad", "qquad",
  "thinspace", "negthinspace",
  "medspace", "negmedspace",
  "thickspace", "negthickspace",
  "enspace", "enskip", "space",
]);

/** バックスラッシュ + 1 文字 の空白系命令 (\,  \;  \:  \!  \  \/) — 値はそのまま空白扱い */
const INLINE_SYMBOL_SPACE = new Set([",", ";", ":", "!", " ", "/"]);

/** 表示は装飾バッジに変換するが、シリアライズ時は元 LaTeX を残す 1 引数命令。
 *  例: \haiten{6} → 緑バッジ "[6点]"、保存時は \haiten{6}。 */
const INLINE_BADGE_CMDS: Record<string, (arg: string) => string> = {
  haiten: (arg) => `[${arg}点]`,
};

/** テンプレ独自コマンドの一覧。
 *  これらは \newcommand で定義されているが、ビジュアルエディタは preamble を解釈しないので
 *  名前から arity と表示カテゴリを直接ハードコードして拾う。
 *  これにより `\jukutitle{Quadratic}{Lesson 03}` のような呼び出しが
 *  「生 LaTeX として画面に漏れる」のを防ぐ。
 *  CSS は data-cmd-name 属性 + data-template 属性 で各テンプレに合わせて装飾する。 */
export interface TemplateCmdSpec {
  arity: 1 | 2;
  /** ブロックレベルか (display:block で描画) */
  block?: boolean;
}
const INLINE_TEMPLATE_CMDS: Record<string, TemplateCmdSpec> = {
  // 1-arg inline (juku/worksheet/kaisetsu-note 共通の強調語句)
  juKey:     { arity: 1 },
  juHint:    { arity: 1 },
  nlevel:    { arity: 1 },
  // 1-arg block-level
  unit:      { arity: 1, block: true },
  chui:      { arity: 1, block: true },
  anslines:  { arity: 1, block: true },
  // 2-arg block-level
  daimonhead:{ arity: 2, block: true },
  jukutitle: { arity: 2, block: true },
  level:     { arity: 2, block: true },
};

/** \today のような「引数を取らず現在日付などに展開される」 LaTeX プリミティブ。
 *  templateCmd inline として保持し、serializer 側で引数ブレースを付けずに出し戻す。 */
const INLINE_NO_ARG_VALUE_CMDS: Record<string, () => string> = {
  today: () => formatLatexToday(),
};

/** LaTeX で特殊文字をテキストモードで出すためのエスケープコマンド群。
 *  これらは Unicode に単純置換すると、round-trip 時に本物の特殊文字が出てしまい、
 *  LaTeX の再コンパイルで全く別の解釈になる (例: `\textbackslash documentclass` を
 *  `\` に置換すると、serializer が `\documentclass` を literal として書き戻し、
 *  "Can be used only in preamble" の fatal error になる)。
 *  そこで noarg templateCmd として保持し、表示は該当 Unicode、serialize は元コマンド、
 *  という非対称ラウンドトリップにする。 */
const INLINE_LATEX_ESCAPE_CMDS: Record<string, string> = {
  textbackslash: "\u005C",  // "\"
  textless: "<",
  textgreater: ">",
  textbar: "|",
};

/** 標準 LaTeX の \today と同じフォーマット ("April 11, 2026") を返す。
 *  luatexja-preset[haranoaji] 下でも \today の展開は英語式なので、templates.ts で使われる
 *  \documentclass{article|report|beamer|letter} のいずれでも PDF と近い見た目になる。 */
function formatLatexToday(): string {
  const d = new Date();
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** インライン中の 1 引数命令 → 中身だけ取り出す */
const INLINE_UNWRAP_1: Record<string, "bold" | "italic" | "code" | "text"> = {
  textbf: "bold",
  textit: "italic",
  emph: "italic",
  textsl: "italic",
  texttt: "code",
  textrm: "text",
  textsf: "text",
  textsc: "text",
  textnormal: "text",
  textup: "text",
  underline: "text",
  uline: "text",
  mathrm: "text",
};

/** インライン中の 2 引数命令 → 第二引数だけ取り出す。
 *  textcolor / fbox / framebox / fcolorbox / colorbox は専用ハンドラ (rule の隣)
 *  で扱うので、こちらには残さない (色や枠を保持するため)。 */
const INLINE_UNWRAP_2_SECOND = new Set<string>([]);

/** テキストモード LaTeX コマンド → Unicode の置換テーブル。
 *  parser 側で `\textbullet` `\square` 等を Unicode に変換しておくことで、
 *  text inline body に `\xxx` が混入して raw LaTeX が漏れるのを防ぐ。
 *  視覚エディタの renderer 側にも同じテーブルがあるが、parser 側で潰しておくと
 *  text inline と sized/colored 系の両方で一貫してクリーンになる。 */
const TEXT_CMD_UNICODE: Record<string, string> = {
  textbullet: "\u2022",
  // NOTE: textbackslash / textbar / textless / textgreater は LaTeX 特殊文字の
  // エスケープ形式なので Unicode に置換せず、INLINE_LATEX_ESCAPE_CMDS 経由で
  // noarg templateCmd inline として round-trip する。
  textquoteleft: "\u2018",
  textquoteright: "\u2019",
  textquotedblleft: "\u201C",
  textquotedblright: "\u201D",
  textregistered: "\u00AE",
  texttrademark: "\u2122",
  textcopyright: "\u00A9",
  textdegree: "\u00B0",
  textperiodcentered: "\u00B7",
  textellipsis: "\u2026",
  textendash: "\u2013",
  textemdash: "\u2014",
  bullet: "\u2022",
  cdots: "\u22EF",
  ldots: "\u2026",
  dots: "\u2026",
  square: "\u25A1",
  blacksquare: "\u25A0",
  bigstar: "\u2605",
  star: "\u2606",
  triangle: "\u25B3",
  blacktriangleright: "\u25B6",
  blacktriangle: "\u25B2",
  P: "\u00B6",
  S: "\u00A7",
};

/** 3 引数命令で「最後の引数だけが本文」のものを定義 (\multicolumn{n}{spec}{content}) */
const INLINE_THREE_ARG_LAST_BODY = new Set([
  "multicolumn",
]);

/** Inline[] から「ユーザに見えるテキスト」を取り出す。
 *  inlineMath は `$..$` の形で残し、bold/italic 等は中身だけ。
 *  色付き / 枠付き / サイズ付きスパンは中身だけ取り出す (再帰的に)。
 *  シリアライズ用ではなく、表示用の文字列を作るときに使う。
 *
 *  ※ linebreak (`\\`) は LaTeX の literal `\\` として残す。
 *    ここを `\n` に変換すると、`\textcolor{..}{\small A\\\nB\\\nC}` のような
 *    命令の中身で「ソース側の改行 + 変換された \n」が合流し、空行 (= `\par`) になり、
 *    "Paragraph ended before \@textcolor was complete" の fatal error を誘発する。
 *    `\\` を literal のまま保持すれば DOM → serialize 経路でもそのまま書き戻せる。 */
function inlinesToVisible(inlines: Inline[]): string {
  let out = "";
  for (const it of inlines) {
    if (it.kind === "inlineMath") out += `$${it.body}$`;
    else if (it.kind === "displayMath") {
      // ラウンドトリップ時に元の wrapper を尊重する
      const wrapper = it.meta?.wrapper ?? "bracket";
      const envName = it.meta?.envName ?? "";
      if (wrapper === "env" && envName) out += `\\begin{${envName}}${it.body}\\end{${envName}}`;
      else if (wrapper === "dollar") out += `$$${it.body}$$`;
      else out += `\\[${it.body}\\]`;
    }
    else if (it.kind === "linebreak") out += "\\\\";
    else if (it.kind === "rule") {
      // \rule{w}{h} は LaTeX の literal 文字列として残す。空文字だと
      // 親ラッパ (e.g. `{\Large \rule{..}}`) が空 group になって
      // 直後の `\\[Npt]` が "There's no line here to end" で落ちる。
      const w = it.meta?.width ?? "1em";
      const h = it.meta?.height ?? "0.4pt";
      out += `\\rule{${w}}{${h}}`;
    }
    else out += it.body;
  }
  return out;
}

const SCOPE_SIZE_CMDS = new Set([
  "tiny", "scriptsize", "footnotesize", "small", "normalsize",
  "large", "Large", "LARGE", "huge", "Huge",
]);
const SCOPE_WEIGHT_CMDS = new Set(["bfseries", "mdseries"]);
const SCOPE_SHAPE_CMDS = new Set(["itshape", "slshape", "scshape", "upshape", "em"]);
const SCOPE_FAMILY_CMDS = new Set(["rmfamily", "sffamily", "ttfamily"]);
/** スコープ先頭で許可される (読み飛ばす) フォーマット系命令。
 *  これらと \color{...} だけを連続して読み、最後にコンテンツ開始位置を返す。 */
function readScopeFormatting(
  src: string,
  start: number,
  end: number,
): { size?: string; weight?: string; shape?: string; bodyStart: number } | null {
  let i = start;
  let size: string | undefined;
  let weight: string | undefined;
  let shape: string | undefined;
  let any = false;
  while (i < end) {
    while (i < end && /[ \t\n]/.test(src[i])) i++;
    if (i >= end) break;
    if (src[i] !== "\\") break;
    let j = i + 1;
    if (j >= end || !/[a-zA-Z@]/.test(src[j])) break;
    while (j < end && /[a-zA-Z@]/.test(src[j])) j++;
    const name = src.slice(i + 1, j);
    if (SCOPE_SIZE_CMDS.has(name)) {
      size = name;
      i = j;
      // 直後の単一スペースを食う
      if (src[i] === " ") i++;
      any = true;
      continue;
    }
    if (SCOPE_WEIGHT_CMDS.has(name)) {
      weight = name === "bfseries" ? "bold" : "normal";
      i = j;
      if (src[i] === " ") i++;
      any = true;
      continue;
    }
    if (SCOPE_SHAPE_CMDS.has(name)) {
      shape = name === "upshape" ? "normal" : "italic";
      i = j;
      if (src[i] === " ") i++;
      any = true;
      continue;
    }
    if (SCOPE_FAMILY_CMDS.has(name)) {
      // family は visual editor では区別しない (本文 serif で十分)
      i = j;
      if (src[i] === " ") i++;
      any = true;
      continue;
    }
    if (name === "color" && src[j] === "{") {
      // \color{name} を読み飛ばす
      const close = findMatchingBrace(src, j, end);
      if (close === -1) break;
      i = close + 1;
      if (src[i] === " ") i++;
      any = true;
      continue;
    }
    if (name === "fontsize" && src[j] === "{") {
      // \fontsize{14pt}{18pt}\selectfont を読み飛ばす
      const close = findMatchingBrace(src, j, end);
      if (close === -1) break;
      let k = close + 1;
      while (k < end && /\s/.test(src[k])) k++;
      if (src[k] === "{") {
        const close2 = findMatchingBrace(src, k, end);
        if (close2 !== -1) k = close2 + 1;
      }
      // optional \selectfont
      while (k < end && /\s/.test(src[k])) k++;
      if (src.startsWith("\\selectfont", k)) k += "\\selectfont".length;
      i = k;
      if (src[i] === " ") i++;
      any = true;
      // \fontsize は size を強制的に Large 扱いにする (厳密ではないが)
      size = size ?? "Large";
      continue;
    }
    break;
  }
  if (!any) return null;
  return { size, weight, shape, bodyStart: i };
}

/** インライン中で第一引数も第二引数も全部捨てる命令 (\rule は別途 inline-rule として扱う) */
const INLINE_DROP_ARG_CMDS = new Set([
  "vspace", "hspace", "vskip", "hskip",
  "label", "ref", "pageref", "eqref", "cite",
  "phantom", "vphantom", "hphantom",
  "stepcounter", "refstepcounter",
  "fontsize", "color",
]);

/** インライン中で 2 引数を取って捨てる命令 (両方の {…} を消費する) */
const INLINE_DROP_2ARG_CMDS = new Set([
  "setcounter", "addtocounter",
]);

/** インライン中で「**引数を取らず**そのまま消滅させる」命令。
 *  視覚的にスペース/罫線を描く LaTeX プリミティブだが、
 *  ビジュアルエディタ上では何も出さない。
 *
 *  ※ INLINE_DROP_CMDS と分けている理由:
 *     INLINE_DROP_CMDS は \large などの「直後の本文に効く」スイッチ。
 *     こちらは \hfill のように「単独で完結する」コマンド。
 *     どちらも消費するだけだが、意味論を明示するために別 set。
 *     ここに無いと parseBody パスで「単独命令認識」も「1引数命令認識」も
 *     失敗し、最終的に段落本文として `\hfill` という生 LaTeX が描画される。 */
const INLINE_NO_ARG_HIDDEN_CMDS = new Set([
  // 水平・垂直の「埋め草」スペース
  "hfill", "vfill", "hfil", "vfil", "hfilneg", "vfilneg",
  // 罫線・点線フィラー
  "hrulefill", "dotfill", "leftarrowfill", "rightarrowfill",
  // 行送り / ページ調整
  "smallskip", "medskip", "bigskip", "linebreak", "nolinebreak",
  "pagebreak", "nopagebreak", "newline", "allowbreak",
  "break", "nobreak", "goodbreak", "filbreak",
  "samepage", "nopagebreak",
  // ストレッチ系
  "stretch",
]);

/** 段落テキスト [start, end) からインラインを抽出する。 */
export function extractInlines(src: string, start: number, end: number): Inline[] {
  const inlines: Inline[] = [];
  let cursor = start;

  const pushText = (from: number, to: number) => {
    if (from >= to) return;
    inlines.push({
      id: nextId("inl"),
      kind: "text",
      range: { start: from, end: to },
      body: src.slice(from, to),
    });
  };

  /** \cmdname を読む。バックスラッシュの位置から始まり、次の非英字位置を返す */
  const readCmdName = (pos: number): { name: string; nextPos: number } | null => {
    if (src[pos] !== "\\") return null;
    let j = pos + 1;
    if (j >= end || !/[a-zA-Z@]/.test(src[j])) return null;
    while (j < end && /[a-zA-Z@*]/.test(src[j])) j++;
    return { name: src.slice(pos + 1, j).replace(/\*$/, ""), nextPos: j };
  };

  /** 空白をスキップ */
  const skipWS = (pos: number): number => {
    while (pos < end && /[ \t]/.test(src[pos])) pos++;
    return pos;
  };

  let i = start;
  while (i < end) {
    const ch = src[i];

    // インライン数式 $...$  (ただし $$ は表示数式扱いなのでここに来ないはず)
    if (ch === "$" && src[i + 1] !== "$") {
      let j = i + 1;
      while (j < end) {
        if (src[j] === "\\" && j + 1 < end) { j += 2; continue; }
        if (src[j] === "$") break;
        j++;
      }
      if (j < end && src[j] === "$") {
        pushText(cursor, i);
        inlines.push({
          id: nextId("inl"),
          kind: "inlineMath",
          range: { start: i, end: j + 1 },
          body: src.slice(i + 1, j),
        });
        cursor = j + 1;
        i = j + 1;
        continue;
      }
    }

    // \( ... \)
    if (ch === "\\" && src[i + 1] === "(") {
      const close = src.indexOf("\\)", i + 2);
      if (close !== -1 && close < end) {
        pushText(cursor, i);
        inlines.push({
          id: nextId("inl"),
          kind: "inlineMath",
          range: { start: i, end: close + 2 },
          body: src.slice(i + 2, close),
        });
        cursor = close + 2;
        i = close + 2;
        continue;
      }
    }

    // \[ ... \] — list item 等「段落の中」に出現した表示数式。
    // トップレベルでは parseBody が displayMath セグメントに昇格するが、
    // \item の body を extractInlines で取ると段落扱いになるためここでも拾う。
    if (ch === "\\" && src[i + 1] === "[") {
      const close = src.indexOf("\\]", i + 2);
      if (close !== -1 && close < end) {
        pushText(cursor, i);
        inlines.push({
          id: nextId("inl"),
          kind: "displayMath",
          range: { start: i, end: close + 2 },
          body: src.slice(i + 2, close).trim(),
          meta: { wrapper: "bracket" },
        });
        cursor = close + 2;
        i = close + 2;
        continue;
      }
    }

    // \begin{equation}...\end{equation} / align / gather / ... 等も
    // 段落内で出会うことがある (稀だが教材で使われる)
    if (ch === "\\" && src.startsWith("\\begin{", i)) {
      const braceOpen = i + 7;
      const braceClose = src.indexOf("}", braceOpen);
      if (braceClose !== -1 && braceClose < end) {
        const envName = src.slice(braceOpen, braceClose);
        const mathEnvs = new Set([
          "equation", "equation*", "align", "align*", "gather", "gather*",
          "multline", "multline*", "displaymath", "eqnarray", "eqnarray*",
        ]);
        if (mathEnvs.has(envName)) {
          const endMarker = `\\end{${envName}}`;
          const endIdx = src.indexOf(endMarker, braceClose + 1);
          if (endIdx !== -1 && endIdx + endMarker.length <= end) {
            const envEnd = endIdx + endMarker.length;
            const innerStart = braceClose + 1;
            pushText(cursor, i);
            inlines.push({
              id: nextId("inl"),
              kind: "displayMath",
              range: { start: i, end: envEnd },
              body: src.slice(innerStart, endIdx).trim(),
              meta: { wrapper: "env", envName },
            });
            cursor = envEnd;
            i = envEnd;
            continue;
          }
        }
      }
    }

    // $$ ... $$
    if (ch === "$" && src[i + 1] === "$") {
      const close = src.indexOf("$$", i + 2);
      if (close !== -1 && close < end) {
        pushText(cursor, i);
        inlines.push({
          id: nextId("inl"),
          kind: "displayMath",
          range: { start: i, end: close + 2 },
          body: src.slice(i + 2, close).trim(),
          meta: { wrapper: "dollar" },
        });
        cursor = close + 2;
        i = close + 2;
        continue;
      }
    }

    // \\ (LaTeX line break) 任意の * + 任意の [Nmm]
    if (ch === "\\" && src[i + 1] === "\\") {
      let cmdEnd = i + 2;
      if (src[cmdEnd] === "*") cmdEnd++;
      if (src[cmdEnd] === "[") {
        let depth = 1;
        let j = cmdEnd + 1;
        while (j < end && depth > 0) {
          if (src[j] === "\\" && j + 1 < end) { j += 2; continue; }
          if (src[j] === "[") depth++;
          else if (src[j] === "]") depth--;
          j++;
        }
        cmdEnd = j;
      }
      pushText(cursor, i);
      inlines.push({
        id: nextId("inl"),
        kind: "linebreak",
        range: { start: i, end: cmdEnd },
        body: "",
      });
      cursor = cmdEnd;
      i = cmdEnd;
      continue;
    }

    // バックスラッシュ + 記号 1 文字の空白系コマンド (\,  \;  \:  \!  \ )
    // これらは readCmdName で letter を要求するため捕まえられない。
    if (ch === "\\" && i + 1 < end && INLINE_SYMBOL_SPACE.has(src[i + 1])) {
      pushText(cursor, i);
      inlines.push({
        id: nextId("inl"),
        kind: "text",
        range: { start: i, end: i + 2 },
        body: "\u00A0",
      });
      cursor = i + 2;
      i += 2;
      continue;
    }

    // \cmdname { ... } 系の処理
    if (ch === "\\") {
      const cmd = readCmdName(i);
      if (cmd) {
        const nameAfter = skipWS(cmd.nextPos);

        // 0a) 空白系コマンド (\quad / \qquad / \thinspace 等) → 空白 1 個に置換
        //     LaTeX 仕様で「letter コマンドの直後の単一スペース」は飲み込まれるため、
        //     range にもそのスペースを含めて消費する。
        if (INLINE_SPACE_CMDS.has(cmd.name)) {
          let consumeEnd = cmd.nextPos;
          if (src[consumeEnd] === " " || src[consumeEnd] === "\t") consumeEnd++;
          pushText(cursor, i);
          inlines.push({
            id: nextId("inl"),
            kind: "text",
            range: { start: i, end: consumeEnd },
            body: "\u00A0",
          });
          cursor = consumeEnd;
          i = consumeEnd;
          continue;
        }

        // 0a') 引数なしの「消すだけ」コマンド (\hfill / \vfill / \smallskip / \linebreak …)
        //     何も描画しない。インラインなら直前/直後の単一スペースも巻き取る。
        if (INLINE_NO_ARG_HIDDEN_CMDS.has(cmd.name)) {
          let consumeEnd = cmd.nextPos;
          if (src[consumeEnd] === " " || src[consumeEnd] === "\t") consumeEnd++;
          pushText(cursor, i);
          cursor = consumeEnd;
          i = consumeEnd;
          continue;
        }

        // 0b) 装飾バッジ命令 (\haiten{N} 等) → scoreBadge inline
        if (INLINE_BADGE_CMDS[cmd.name] && src[nameAfter] === "{") {
          const braceEnd = findMatchingBrace(src, nameAfter, end);
          if (braceEnd !== -1) {
            const arg = src.slice(nameAfter + 1, braceEnd);
            const display = INLINE_BADGE_CMDS[cmd.name](arg);
            pushText(cursor, i);
            inlines.push({
              id: nextId("inl"),
              kind: "scoreBadge",
              range: { start: i, end: braceEnd + 1 },
              body: display,
              // body は表示用、原形コマンドは別途必要
              // (再構築は visual-editor 側で data 属性経由で復元)
            });
            // メタ情報を別途付与するため、最後の inline に直接書き込む
            const last = inlines[inlines.length - 1];
            // Inline には meta 欄が無いので、body の先頭にコマンド名と引数を埋めて持つ。
            // 復元時は data 属性で渡す方が綺麗なので、ここでは body と range を保持し、
            // 元コマンドは renderer 側で src[range.start..range.end] から抽出する。
            void last;
            cursor = braceEnd + 1;
            i = braceEnd + 1;
            continue;
          }
        }

        // 0c) \rule{width}{height} → 可視ライン inline
        if (cmd.name === "rule" && src[nameAfter] === "{") {
          const firstClose = findMatchingBrace(src, nameAfter, end);
          if (firstClose !== -1) {
            const next2 = skipWS(firstClose + 1);
            if (src[next2] === "{") {
              const secondClose = findMatchingBrace(src, next2, end);
              if (secondClose !== -1) {
                const w = src.slice(nameAfter + 1, firstClose).trim();
                const h = src.slice(next2 + 1, secondClose).trim();
                pushText(cursor, i);
                inlines.push({
                  id: nextId("inl"),
                  kind: "rule",
                  range: { start: i, end: secondClose + 1 },
                  body: "",
                  meta: { width: w, height: h },
                });
                cursor = secondClose + 1;
                i = secondClose + 1;
                continue;
              }
            }
          }
        }

        // 0d) \textcolor{name}{TEXT} → colored inline (色を保持)
        if (cmd.name === "textcolor" && src[nameAfter] === "{") {
          const firstClose = findMatchingBrace(src, nameAfter, end);
          if (firstClose !== -1) {
            const second = skipWS(firstClose + 1);
            if (src[second] === "{") {
              const secondClose = findMatchingBrace(src, second, end);
              if (secondClose !== -1) {
                const colorName = src.slice(nameAfter + 1, firstClose).trim();
                const inner = extractInlines(src, second + 1, secondClose);
                const visible = inlinesToVisible(inner);
                pushText(cursor, i);
                inlines.push({
                  id: nextId("inl"),
                  kind: "colored",
                  range: { start: i, end: secondClose + 1 },
                  body: visible,
                  meta: { color: colorName },
                });
                cursor = secondClose + 1;
                i = secondClose + 1;
                continue;
              }
            }
          }
        }

        // 0e) \fbox{TEXT} / \framebox{TEXT} → framed inline (枠を保持。1 引数)
        if ((cmd.name === "fbox" || cmd.name === "framebox") && src[nameAfter] === "{") {
          const braceEnd = findMatchingBrace(src, nameAfter, end);
          if (braceEnd !== -1) {
            const inner = extractInlines(src, nameAfter + 1, braceEnd);
            const visible = inlinesToVisible(inner);
            pushText(cursor, i);
            inlines.push({
              id: nextId("inl"),
              kind: "framed",
              range: { start: i, end: braceEnd + 1 },
              body: visible,
              meta: { cmd: cmd.name },
            });
            cursor = braceEnd + 1;
            i = braceEnd + 1;
            continue;
          }
        }

        // 0e0) \textbackslash / \textless / \textgreater / \textbar →
        //      表示は記号、serialize は元の \text… コマンドにラウンドトリップ
        //
        //      ※ コマンド直後の空白は inline に取り込まない。LaTeX では
        //        `\textbackslash documentclass` の「空白が区切り」であり、
        //        serialize 時に `\textbackslash` + 次の text inline (先頭が空白)
        //        と連結することで `\textbackslashdocumentclass` 化を防ぐ。
        if (INLINE_LATEX_ESCAPE_CMDS[cmd.name] !== undefined) {
          pushText(cursor, i);
          inlines.push({
            id: nextId("inl"),
            kind: "templateCmd",
            range: { start: i, end: cmd.nextPos },
            body: INLINE_LATEX_ESCAPE_CMDS[cmd.name],
            meta: { name: cmd.name, noarg: "1" },
          });
          cursor = cmd.nextPos;
          i = cmd.nextPos;
          continue;
        }

        // 0e1) 引数を取らない値展開コマンド (\today 等) → 現在値を持つ templateCmd inline
        //      同様に、後続の空白は次の text inline に委ねる (連結事故を防ぐ)。
        if (INLINE_NO_ARG_VALUE_CMDS[cmd.name]) {
          pushText(cursor, i);
          inlines.push({
            id: nextId("inl"),
            kind: "templateCmd",
            range: { start: i, end: cmd.nextPos },
            body: INLINE_NO_ARG_VALUE_CMDS[cmd.name](),
            meta: { name: cmd.name, noarg: "1" },
          });
          cursor = cmd.nextPos;
          i = cmd.nextPos;
          continue;
        }

        // 0e2) テンプレ独自コマンド (\juKey, \jukutitle, \chui, \nlevel, ...) を
        //      templateCmd inline として保持する。生 LaTeX を画面に漏らさず、
        //      data-cmd-name 属性 + テンプレ別 CSS で装飾する。
        if (INLINE_TEMPLATE_CMDS[cmd.name] && src[nameAfter] === "{") {
          const spec = INLINE_TEMPLATE_CMDS[cmd.name];
          const firstClose = findMatchingBrace(src, nameAfter, end);
          if (firstClose !== -1) {
            let endPos = firstClose + 1;
            let visible2: string | undefined;
            if (spec.arity === 2) {
              const next2 = skipWS(endPos);
              if (src[next2] === "{") {
                const secondClose = findMatchingBrace(src, next2, end);
                if (secondClose !== -1) {
                  const inner2 = extractInlines(src, next2 + 1, secondClose);
                  visible2 = inlinesToVisible(inner2);
                  endPos = secondClose + 1;
                }
              }
            }
            const inner1 = extractInlines(src, nameAfter + 1, firstClose);
            const visible1 = inlinesToVisible(inner1);
            const meta: Record<string, string> = { name: cmd.name };
            if (visible2 !== undefined) meta.arg2 = visible2;
            if (spec.block) meta.block = "1";
            pushText(cursor, i);
            inlines.push({
              id: nextId("inl"),
              kind: "templateCmd",
              range: { start: i, end: endPos },
              body: visible1,
              meta,
            });
            cursor = endPos;
            i = endPos;
            continue;
          }
        }

        // 0f) 2 引数捨てコマンド (\setcounter{x}{y}, \addtocounter{x}{y})
        if (INLINE_DROP_2ARG_CMDS.has(cmd.name) && src[nameAfter] === "{") {
          const firstClose = findMatchingBrace(src, nameAfter, end);
          if (firstClose !== -1) {
            const next2 = skipWS(firstClose + 1);
            let endPos = firstClose + 1;
            if (src[next2] === "{") {
              const secondClose = findMatchingBrace(src, next2, end);
              if (secondClose !== -1) endPos = secondClose + 1;
            }
            pushText(cursor, i);
            cursor = endPos;
            i = endPos;
            continue;
          }
        }

        // 1) 完全に捨てる引数つきコマンド (\vspace{6mm}, \label{...} 等)
        if (INLINE_DROP_ARG_CMDS.has(cmd.name)) {
          if (src[nameAfter] === "{") {
            const braceEnd = findMatchingBrace(src, nameAfter, end);
            if (braceEnd !== -1) {
              // \rule{X}{Y} など 2 引数も食う
              let endPos = braceEnd + 1;
              const next2 = skipWS(endPos);
              if (src[next2] === "{") {
                const second = findMatchingBrace(src, next2, end);
                if (second !== -1) endPos = second + 1;
              }
              pushText(cursor, i);
              cursor = endPos;
              i = endPos;
              continue;
            }
          } else {
            // 引数なしバリアント (\vfill 等)
            pushText(cursor, i);
            cursor = cmd.nextPos;
            i = cmd.nextPos;
            continue;
          }
        }

        // 2) 引数なし命令 (\noindent / \large / \bfseries 等) → 単に消費
        if (INLINE_DROP_CMDS.has(cmd.name)) {
          pushText(cursor, i);
          cursor = cmd.nextPos;
          i = cmd.nextPos;
          continue;
        }

        // 3) \textcolor{red}{TEXT} 系 → 第二引数だけ採用 (再帰的にインライン抽出)
        if (INLINE_UNWRAP_2_SECOND.has(cmd.name) && src[nameAfter] === "{") {
          const firstClose = findMatchingBrace(src, nameAfter, end);
          if (firstClose !== -1) {
            const second = skipWS(firstClose + 1);
            if (src[second] === "{") {
              const secondClose = findMatchingBrace(src, second, end);
              if (secondClose !== -1) {
                pushText(cursor, i);
                // 内側を再帰的に展開
                const inner = extractInlines(src, second + 1, secondClose);
                inlines.push(...inner);
                cursor = secondClose + 1;
                i = secondClose + 1;
                continue;
              }
            }
          }
        }

        // 4) \textbf{...} \textit{...} \texttt{...} 等 1 引数 unwrap
        const unwrapKind = INLINE_UNWRAP_1[cmd.name];
        if (unwrapKind && src[nameAfter] === "{") {
          const braceEnd = findMatchingBrace(src, nameAfter, end);
          if (braceEnd !== -1) {
            pushText(cursor, i);
            if (unwrapKind === "text") {
              // text は再帰展開
              const inner = extractInlines(src, nameAfter + 1, braceEnd);
              inlines.push(...inner);
            } else {
              // bold/italic/code: 中身を再帰展開して "可視テキスト" を取り出す
              // (\textbf{\textcolor{red}{X}} → bold("X") として保持)
              const inner = extractInlines(src, nameAfter + 1, braceEnd);
              const visibleBody = inner.map((it) => it.kind === "inlineMath" ? `$${it.body}$` : it.body).join("");
              inlines.push({
                id: nextId("inl"),
                kind: unwrapKind,
                range: { start: i, end: braceEnd + 1 },
                body: visibleBody,
              });
            }
            cursor = braceEnd + 1;
            i = braceEnd + 1;
            continue;
          }
        }

        // 5) テキストモード Unicode 命令 (\textbullet \square \cdot ...) → Unicode 文字
        if (TEXT_CMD_UNICODE[cmd.name] !== undefined) {
          let consumeEnd = cmd.nextPos;
          if (src[consumeEnd] === " " || src[consumeEnd] === "\t") consumeEnd++;
          pushText(cursor, i);
          inlines.push({
            id: nextId("inl"),
            kind: "text",
            range: { start: i, end: consumeEnd },
            body: TEXT_CMD_UNICODE[cmd.name],
          });
          cursor = consumeEnd;
          i = consumeEnd;
          continue;
        }

        // 6) \multicolumn{N}{spec}{content} 等 — 最後の引数だけが本文
        if (INLINE_THREE_ARG_LAST_BODY.has(cmd.name) && src[nameAfter] === "{") {
          const close1 = findMatchingBrace(src, nameAfter, end);
          if (close1 !== -1) {
            const w1 = skipWS(close1 + 1);
            if (src[w1] === "{") {
              const close2 = findMatchingBrace(src, w1, end);
              if (close2 !== -1) {
                const w2 = skipWS(close2 + 1);
                if (src[w2] === "{") {
                  const close3 = findMatchingBrace(src, w2, end);
                  if (close3 !== -1) {
                    pushText(cursor, i);
                    // 本文 (3 番目の引数) を再帰展開
                    const inner = extractInlines(src, w2 + 1, close3);
                    inlines.push(...inner);
                    cursor = close3 + 1;
                    i = close3 + 1;
                    continue;
                  }
                }
              }
            }
          }
        }

        // 7) フォールバック: 未知の `\cmd` (引数の有無を問わず) は中身だけ取り出す。
        //    `\cmd{...}` なら {} の中を再帰展開し、`\cmd` 単独なら何も出さない。
        //    生 LaTeX を画面に漏らさないための最後の砦。
        {
          if (src[nameAfter] === "{") {
            const braceEnd = findMatchingBrace(src, nameAfter, end);
            if (braceEnd !== -1) {
              pushText(cursor, i);
              const inner = extractInlines(src, nameAfter + 1, braceEnd);
              inlines.push(...inner);
              cursor = braceEnd + 1;
              i = braceEnd + 1;
              continue;
            }
          }
          // 引数なしの未知 `\cmd` → スキップ (生コードを表示しない)
          pushText(cursor, i);
          let consumeEnd = cmd.nextPos;
          if (src[consumeEnd] === " " || src[consumeEnd] === "\t") consumeEnd++;
          cursor = consumeEnd;
          i = consumeEnd;
          continue;
        }
      }
    }

    // 単独の { ... } グループ → 中身を再帰展開 (フォント切替などのスコープ)
    // 例: {\bfseries\color{ctnavy} 数学} → 太字
    //    {\Large\bfseries タイトル} → 大きな太字
    // スコープ先頭の \large \Large \LARGE \huge \bfseries 等を読み取って
    // sized inline として保持する。フォーマット指示が無ければ素直に再帰展開。
    if (ch === "{") {
      const braceEnd = findMatchingBrace(src, i, end);
      if (braceEnd !== -1) {
        // スコープ先頭のサイズ/字形コマンドを読み取る
        const scopeFmt = readScopeFormatting(src, i + 1, braceEnd);
        pushText(cursor, i);
        if (scopeFmt && (scopeFmt.size || scopeFmt.weight)) {
          const inner = extractInlines(src, scopeFmt.bodyStart, braceEnd);
          const visible = inlinesToVisible(inner);
          const meta: Record<string, string> = {};
          if (scopeFmt.size) meta.size = scopeFmt.size;
          if (scopeFmt.weight) meta.weight = scopeFmt.weight;
          if (scopeFmt.shape) meta.shape = scopeFmt.shape;
          inlines.push({
            id: nextId("inl"),
            kind: "sized",
            range: { start: i, end: braceEnd + 1 },
            body: visible,
            meta,
          });
        } else {
          const inner = extractInlines(src, i + 1, braceEnd);
          inlines.push(...inner);
        }
        cursor = braceEnd + 1;
        i = braceEnd + 1;
        continue;
      }
    }

    i++;
  }

  pushText(cursor, end);

  if (inlines.length > 0) return inlines;

  // ── Fallback: 何も recognize されなかった ──
  // 範囲がプレーンテキスト (LaTeX コマンドを含まない) なら、それを 1 つの text inline として返す。
  // LaTeX コマンドだけで構成されていた (例: `\hspace{6mm}\rule{15mm}{0.4pt}`) 場合は、
  // 中身を生 LaTeX のまま画面に出すと「コードが本文に漏れた」状態になるので、
  // 代わりに **空配列** を返して呼び出し側で「空のセグメント」として扱わせる。
  // これにより `{\textcolor{red}{\hspace...\rule...}}` が画面に raw LaTeX として
  // 表示されるバグを防ぐ。
  const slice = src.slice(start, end);
  if (!slice.includes("\\")) {
    return [{
      id: nextId("inl"),
      kind: "text",
      range: { start, end },
      body: slice,
    }];
  }
  return [];
}

// ─────────────────────────────────────
// 段落分割
// ─────────────────────────────────────

// ─────────────────────────────────────
// itemize/enumerate の中の \item 分割
// ─────────────────────────────────────

// ─────────────────────────────────────
// tabular / tabularx の解析
// ─────────────────────────────────────

/** 列スペック文字列 (`{|c|X|c|}` の中身) から列定義の配列を作る。
 *  - `l`/`c`/`r` → 左/中央/右寄せ
 *  - `X` → 横方向ストレッチ (tabularx)
 *  - `p{...}`/`m{...}`/`b{...}` → 固定幅列 (幅は捨てて左寄せ扱い)
 *  - `|` → ボーダー (左/右に true を立てる)
 *  - `@{...}` / `!{...}` → 区切り装飾 (中身ごとスキップ)
 *  - `*{n}{cols}` → cols を n 回展開
 */
export interface TableColumn {
  align: "left" | "center" | "right";
  /** 直前の `|` の数 (表示用) */
  borderLeft: boolean;
  /** 直後の `|` の数 */
  borderRight: boolean;
  /** X 列 (ストレッチ) */
  stretch: boolean;
}

function parseColumnSpec(spec: string): TableColumn[] {
  const cols: TableColumn[] = [];
  let pendingBorderLeft = false;
  let i = 0;
  // `*{n}{cols}` を再帰的に展開して spec を平坦化
  // (大規模 spec はあまり来ないので素朴に書き換える)
  let flat = spec;
  // 単純な *{n}{cols} 展開 (ネストは未対応 — 教材テンプレでは出ない)
  for (let pass = 0; pass < 3; pass++) {
    flat = flat.replace(/\*\{(\d+)\}\{([^{}]*)\}/g, (_m, n, c) => c.repeat(parseInt(n, 10)));
  }
  while (i < flat.length) {
    const ch = flat[i];
    if (ch === " " || ch === "\t" || ch === "\n") { i++; continue; }
    if (ch === "|") { pendingBorderLeft = true; i++; continue; }
    // @{...} / !{...} は中身を読み飛ばす
    if (ch === "@" || ch === "!") {
      i++;
      if (flat[i] === "{") {
        let depth = 1;
        i++;
        while (i < flat.length && depth > 0) {
          if (flat[i] === "{") depth++;
          else if (flat[i] === "}") depth--;
          i++;
        }
      }
      continue;
    }
    // p{...} / m{...} / b{...} は幅指定をスキップして左寄せ
    if (ch === "p" || ch === "m" || ch === "b") {
      i++;
      if (flat[i] === "{") {
        let depth = 1;
        i++;
        while (i < flat.length && depth > 0) {
          if (flat[i] === "{") depth++;
          else if (flat[i] === "}") depth--;
          i++;
        }
      }
      cols.push({ align: "left", borderLeft: pendingBorderLeft, borderRight: false, stretch: false });
      pendingBorderLeft = false;
      continue;
    }
    if (ch === "l") {
      cols.push({ align: "left", borderLeft: pendingBorderLeft, borderRight: false, stretch: false });
      pendingBorderLeft = false;
      i++; continue;
    }
    if (ch === "c") {
      cols.push({ align: "center", borderLeft: pendingBorderLeft, borderRight: false, stretch: false });
      pendingBorderLeft = false;
      i++; continue;
    }
    if (ch === "r") {
      cols.push({ align: "right", borderLeft: pendingBorderLeft, borderRight: false, stretch: false });
      pendingBorderLeft = false;
      i++; continue;
    }
    if (ch === "X") {
      cols.push({ align: "left", borderLeft: pendingBorderLeft, borderRight: false, stretch: true });
      pendingBorderLeft = false;
      i++; continue;
    }
    // 未知の文字は黙ってスキップ
    i++;
  }
  // 残った borderLeft は最後の列の borderRight に
  if (pendingBorderLeft && cols.length > 0) {
    cols[cols.length - 1].borderRight = true;
  }
  // `|c|c|` のような連続ボーダーで col[i+1].borderLeft が立っていたら
  // col[i].borderRight も立てて見た目を合わせる
  for (let k = 0; k < cols.length - 1; k++) {
    if (cols[k + 1].borderLeft) cols[k].borderRight = true;
  }
  return cols;
}

/** tabular 本文 [innerStart, innerEnd) を行 (`\\`) → セル (`&`) に分解する。
 *  ネスト ({...}, \begin..\end, $..$) 内の `&` `\\` は無視する。
 *  各行は string[] (セルの slice) と、その行の前に \hline があるかどうかのフラグを返す。 */
export interface TableRow {
  cells: { start: number; end: number }[];
  topRule: boolean;
  bottomRule: boolean;
}

function splitTableBody(src: string, innerStart: number, innerEnd: number): TableRow[] {
  const rows: TableRow[] = [];
  let cursor = innerStart;
  let pendingTopRule = false;

  /** 1 行を読む。次の `\\` (トップレベル) の前まで進む。
   *  return: { cells, nextCursor, hadRowBreak } */
  const readRow = (from: number): { cells: { start: number; end: number }[]; nextCursor: number; hadRowBreak: boolean } => {
    const cells: { start: number; end: number }[] = [];
    let cellStart = from;
    let i = from;
    let depth = 0;
    while (i < innerEnd) {
      const ch = src[i];
      // \\ で行終端 (トップレベル)
      if (ch === "\\" && i + 1 < innerEnd) {
        const next = src[i + 1];
        if (next === "\\" && depth === 0) {
          cells.push({ start: cellStart, end: i });
          // \\ + 任意の * + 任意の [Nmm]
          let after = i + 2;
          if (src[after] === "*") after++;
          if (src[after] === "[") {
            let d = 1;
            let j = after + 1;
            while (j < innerEnd && d > 0) {
              if (src[j] === "[") d++;
              else if (src[j] === "]") d--;
              j++;
            }
            after = j;
          }
          return { cells, nextCursor: after, hadRowBreak: true };
        }
        // \{ \} はエスケープ
        if (next === "{" || next === "}") { i += 2; continue; }
        // 通常コマンド: 名前末尾までスキップ (\hline 等はそのままセルに残る)
        let j = i + 1;
        while (j < innerEnd && /[a-zA-Z@]/.test(src[j])) j++;
        i = j;
        continue;
      }
      // {} のネスト
      if (ch === "{") { depth++; i++; continue; }
      if (ch === "}") { if (depth > 0) depth--; i++; continue; }
      // $...$ math はスキップ
      if (ch === "$" && depth === 0) {
        let j = i + 1;
        while (j < innerEnd) {
          if (src[j] === "\\" && j + 1 < innerEnd) { j += 2; continue; }
          if (src[j] === "$") break;
          j++;
        }
        i = j + 1;
        continue;
      }
      // セル区切り `&` (トップレベル)
      if (ch === "&" && depth === 0) {
        cells.push({ start: cellStart, end: i });
        i++;
        cellStart = i;
        continue;
      }
      i++;
    }
    // 末尾 (最後の行で `\\` 無し)
    cells.push({ start: cellStart, end: innerEnd });
    return { cells, nextCursor: innerEnd, hadRowBreak: false };
  };

  while (cursor < innerEnd) {
    // 先頭の空白をスキップ
    while (cursor < innerEnd && /\s/.test(src[cursor])) cursor++;
    if (cursor >= innerEnd) break;

    // \hline / \toprule / \midrule / \bottomrule / \cline{...} / \specialrule / \cmidrule
    // を行頭で連続的に消費して pendingTopRule を立てる
    let consumedRule = false;
    while (true) {
      while (cursor < innerEnd && /\s/.test(src[cursor])) cursor++;
      const tail = src.slice(cursor, Math.min(cursor + 24, innerEnd));
      const m = tail.match(/^\\(hline|toprule|midrule|bottomrule)\b/);
      if (m) {
        cursor += m[0].length;
        pendingTopRule = true;
        consumedRule = true;
        continue;
      }
      const m2 = tail.match(/^\\(cline|cmidrule|specialrule)\b/);
      if (m2) {
        cursor += m2[0].length;
        // 引数 [opt]{arg} を雑にスキップ
        while (cursor < innerEnd && /\s/.test(src[cursor])) cursor++;
        if (src[cursor] === "[") {
          let d = 1; let j = cursor + 1;
          while (j < innerEnd && d > 0) { if (src[j] === "[") d++; else if (src[j] === "]") d--; j++; }
          cursor = j;
        }
        if (src[cursor] === "{") {
          const close = findMatchingBrace(src, cursor, innerEnd);
          if (close !== -1) cursor = close + 1;
        }
        pendingTopRule = true;
        consumedRule = true;
        continue;
      }
      break;
    }
    if (cursor >= innerEnd) {
      // 末尾の \hline 等は最後の行の bottomRule として扱う
      if (consumedRule && rows.length > 0) rows[rows.length - 1].bottomRule = true;
      break;
    }

    const { cells, nextCursor, hadRowBreak } = readRow(cursor);
    // 全セルが空 (single empty cell with no whitespace) の行は無視
    const isEmpty = cells.length === 1 && cells[0].end <= cells[0].start;
    if (!isEmpty) {
      rows.push({ cells, topRule: pendingTopRule, bottomRule: false });
      pendingTopRule = false;
    } else if (consumedRule && rows.length > 0) {
      // 空行 + \hline → 直前行の bottomRule に
      rows[rows.length - 1].bottomRule = true;
    }
    if (!hadRowBreak) break;
    cursor = nextCursor;
  }
  // pendingTopRule が末尾に残っている場合は最後の行の bottomRule にする
  if (pendingTopRule && rows.length > 0) {
    rows[rows.length - 1].bottomRule = true;
  }
  return rows;
}

/** tabular 環境を 1 つの table セグメントに変換する。 */
function parseTableEnvironment(
  src: string,
  envName: string,
  envStart: number,
  envEnd: number,
): Segment | null {
  const beginLen = `\\begin{${envName}}`.length;
  let cursor = envStart + beginLen;

  // tabularx は 1st arg が幅 ({\textwidth} 等) — スキップ
  // tabular* も 1st arg が幅
  if (envName === "tabularx" || envName === "tabular*") {
    while (cursor < envEnd && /\s/.test(src[cursor])) cursor++;
    if (src[cursor] === "{") {
      const close = findMatchingBrace(src, cursor, envEnd);
      if (close !== -1) cursor = close + 1;
    }
  }
  // 任意の [pos] (位置指定) をスキップ
  while (cursor < envEnd && /\s/.test(src[cursor])) cursor++;
  if (src[cursor] === "[") {
    let d = 1; let j = cursor + 1;
    while (j < envEnd && d > 0) { if (src[j] === "[") d++; else if (src[j] === "]") d--; j++; }
    cursor = j;
  }

  // 列スペック {col_spec}
  while (cursor < envEnd && /\s/.test(src[cursor])) cursor++;
  if (src[cursor] !== "{") return null;
  const specClose = findMatchingBrace(src, cursor, envEnd);
  if (specClose === -1) return null;
  const colSpec = src.slice(cursor + 1, specClose);
  cursor = specClose + 1;

  const innerStart = cursor;
  const innerEnd = envEnd - `\\end{${envName}}`.length;
  const cols = parseColumnSpec(colSpec);
  const rows = splitTableBody(src, innerStart, innerEnd);

  // meta に列・行情報を JSON で持たせる (renderer で復元)
  const cellsFlat: { start: number; end: number; row: number; col: number }[] = [];
  rows.forEach((row, ri) => {
    row.cells.forEach((c, ci) => cellsFlat.push({ start: c.start, end: c.end, row: ri, col: ci }));
  });

  return {
    id: nextId("seg"),
    kind: "table",
    range: { start: envStart, end: envEnd },
    body: src.slice(envStart, envEnd),
    meta: {
      envName,
      colSpec,
      cols: JSON.stringify(cols),
      rows: JSON.stringify(rows.map((r) => ({
        topRule: r.topRule,
        bottomRule: r.bottomRule,
        cells: r.cells,
      }))),
    },
  };
}

function parseListChildren(src: string, innerStart: number, innerEnd: number): Segment[] {
  const items: Segment[] = [];
  // \item 位置を全て収集
  const itemPositions: number[] = [];
  let i = innerStart;
  while (i < innerEnd) {
    if (src.startsWith("\\item", i)) {
      // \item に続く文字が letter なら別命令
      const after = src[i + 5];
      if (!after || !/[a-zA-Z]/.test(after)) {
        itemPositions.push(i);
        i += 5;
        continue;
      }
    }
    if (src[i] === "\\" && i + 1 < innerEnd) { i += 2; continue; }
    i++;
  }

  if (itemPositions.length === 0) return [];

  for (let idx = 0; idx < itemPositions.length; idx++) {
    const itemStart = itemPositions[idx];
    const itemEnd = idx + 1 < itemPositions.length ? itemPositions[idx + 1] : innerEnd;
    // body は \item 本体 + 中身
    // 中身の先頭 = "\item" の後ろ、optional [label] スキップ
    let bodyStart = itemStart + 5;
    while (bodyStart < itemEnd && (src[bodyStart] === " " || src[bodyStart] === "\t")) bodyStart++;
    // [...] スキップ
    if (src[bodyStart] === "[") {
      const close = src.indexOf("]", bodyStart);
      if (close !== -1 && close < itemEnd) bodyStart = close + 1;
    }
    while (bodyStart < itemEnd && /\s/.test(src[bodyStart])) bodyStart++;

    let bodyEnd = itemEnd;
    while (bodyEnd > bodyStart && /\s/.test(src[bodyEnd - 1])) bodyEnd--;

    const inlines = extractInlines(src, bodyStart, bodyEnd);
    items.push({
      id: nextId("seg"),
      kind: "item",
      range: { start: itemStart, end: itemEnd },
      body: src.slice(bodyStart, bodyEnd),
      inlines,
      meta: { bodyStart: String(bodyStart), bodyEnd: String(bodyEnd) },
    });
  }
  return items;
}

// ─────────────────────────────────────
// メインパーサー
// ─────────────────────────────────────

const DISPLAY_MATH_ENVS = new Set([
  "equation", "equation*", "align", "align*", "gather", "gather*",
  "displaymath", "multline", "multline*", "eqnarray", "eqnarray*",
]);

/** 見出しパターン (より長い prefix を先にマッチさせるため、subsub → sub → section → chapter の順)
 *  ※ \chapter は report テンプレで使われる。section と同じ扱いで番号付け対象。 */
const HEADING_PATTERNS: ReadonlyArray<{
  prefix: string;
  kind: "section" | "subsection" | "subsubsection";
  cmdLen: number;
  starred: boolean;
}> = [
  { prefix: "\\subsubsection*{", kind: "subsubsection", cmdLen: "\\subsubsection*".length, starred: true },
  { prefix: "\\subsubsection{",  kind: "subsubsection", cmdLen: "\\subsubsection".length,  starred: false },
  { prefix: "\\subsection*{",    kind: "subsection",    cmdLen: "\\subsection*".length,    starred: true },
  { prefix: "\\subsection{",     kind: "subsection",    cmdLen: "\\subsection".length,     starred: false },
  { prefix: "\\section*{",       kind: "section",       cmdLen: "\\section*".length,       starred: true },
  { prefix: "\\section{",        kind: "section",       cmdLen: "\\section".length,        starred: false },
  { prefix: "\\chapter*{",       kind: "section",       cmdLen: "\\chapter*".length,       starred: true },
  { prefix: "\\chapter{",        kind: "section",       cmdLen: "\\chapter".length,        starred: false },
];

/** 単独命令 ( \maketitle 等 ) の正規表現 — 引数なし。
 *  ここに書いたものは parseBody で「hidden raw」にされ、通常は非表示。
 *  maketitle は後段の upgradeMaketitleSegments で titleBlock に昇格する。
 *  tableofcontents は後段の upgradeTocSegments で toc に昇格する。
 *  skip 系 (smallskip/medskip/bigskip) と page break 系 (newpage/clearpage/pagebreak)
 *  は upgradeSpacingSegments で可視 vspace/pageBreak 段落に昇格する。
 *  \today はここから外してあり、段落として extractInlines に流れて現在日付に展開される。 */
const STANDALONE_CMD_RE = /^\\(maketitle|tableofcontents|titlepage|newpage|clearpage|pagebreak|linebreak|hline|midrule|toprule|bottomrule|noindent|smallskip|medskip|bigskip|par|centering|raggedright|raggedleft|onehalfspacing|doublespacing|singlespacing|null|@empty)\b/;

/**
 * 「これらの環境はビジュアルエディタで `container` 化せず raw に残す」リスト。
 * 表/figure/コード/TikZ など、本文として再帰パースしても意味のある要素にならないもの。
 * これ以外の未知環境は container として中身を再帰パースして表示する。
 */
const PRESERVE_AS_RAW_ENVS = new Set([
  "array", "matrix",
  "tikzpicture", "pgfpicture", "scope",
  "circuitikz", "circuittikz",
  "verbatim", "verbatim*", "lstlisting", "minted", "alltt", "Verbatim",
  // figure / wrapfigure は内部で \includegraphics を使うことが多く、raw のまま
  // FigureAssetPreview / FigureSnippetPreview に流す方が安定する。
  "figure", "figure*", "wrapfigure",
  "filecontents", "filecontents*",
]);

/** HTML テーブルとして可視化する表組環境 (tabular 系)。
 *  ここに含めた環境は parseBody で「table」セグメントとして
 *  HTML テーブルに展開される。
 *  longtable / tabular* / tabularx も含む。 */
const TABLE_ENVS = new Set([
  "tabular", "tabular*", "tabularx", "tabulary", "longtable",
]);

/** 1 つの引数 {…} を取って表示上は無視する命令 (vspace / hspace / 等)
 *  さらに * 付き variant (\vspace*) も自動でマッチさせる。
 *  ※ 2 引数を取るコマンド (rule / setcounter / addtocounter ...) は別 set にあり、
 *    こちらに含めると第二引数 ({1} 等) が段落として漏れて画面に "1" と出るバグになる。 */
const ONE_ARG_HIDDEN_CMDS = new Set([
  "vspace", "hspace", "vskip", "hskip", "vfill", "hfill",
  "stepcounter", "refstepcounter",
  "label", "ref", "pageref", "eqref", "cite",
  "input", "include", "thispagestyle", "pagestyle",
  "phantom", "vphantom", "hphantom",
  // キャプション/表関連のローカルスコープ命令 (ビジュアル側では意味なし)
  // `\caption{...}` は本来キャプションだが、現状は本文ノイズになるので簡略的に非表示。
  "caption", "captionsetup",
  "rowcolor", "columncolor", "cellcolor",
  "multirow",
  // フォント切替 (PDFサイズ情報なのでビジュアルでは無視)
  "selectfont",
  // LaTeX デバッグ/暗黙命令
  "protect", "unskip", "ignorespaces",
]);

/** 2 つの引数 {…}{…} を取って表示上は無視する命令。
 *  setcounter / addtocounter は 2 引数を取るので必ずここに置く
 *  (1 引数扱いだと第二引数 `{1}` が段落として漏れる)。
 *  ※ \rule はビジュアル側で「可視ライン inline」として描画したいので、
 *    ここには **入れない**。段落として読み取られ、extractInlines で rule inline になる。 */
const TWO_ARG_HIDDEN_CMDS = new Set([
  "setcounter", "addtocounter",
  // ユーザー定義・再定義 (ビジュアル側ではコマンド自体を見せずスルー)
  "renewcommand", "newcommand", "providecommand", "DeclareRobustCommand",
  // フォントサイズ指定 (例: \fontsize{10pt}{12pt})
  "fontsize",
  // \setlength{...}{...} / \addtolength{...}{...} — 本来 1arg + dim だが ONE_ARG 経路だと dim が漏れる
  "setlength", "addtolength",
]);

function parseBody(src: string, start: number, end: number): Segment[] {
  const segments: Segment[] = [];
  let i = start;

  while (i < end) {
    // 先頭の空白行スキップ
    const skipStart = i;
    while (i < end && /\s/.test(src[i])) i++;
    if (i >= end) break;

    // % コメント行 → raw として 1 行包む
    if (src[i] === "%") {
      const lineEnd = src.indexOf("\n", i);
      const stop = lineEnd === -1 || lineEnd > end ? end : lineEnd;
      segments.push({
        id: nextId("seg"),
        kind: "raw",
        range: { start: i, end: stop },
        body: src.slice(i, stop),
        meta: { hidden: "true" },
      });
      i = stop;
      continue;
    }

    // 見出し (* 付き variant も対応。* 付き = 番号なし)
    const headingHit = HEADING_PATTERNS.find((p) => src.startsWith(p.prefix, i));
    if (headingHit) {
      const braceStart = i + headingHit.cmdLen;
      const braceEnd = findMatchingBrace(src, braceStart, end);
      if (braceEnd !== -1) {
        const titleBody = src.slice(braceStart + 1, braceEnd);
        const meta: Record<string, string> = {};
        if (headingHit.starred) meta.starred = "true";
        // 空 \section{} の場合は、テンプレ側で \titleformat により
        // 「第N問」「Problem N」などが自動挿入されることが多い。
        // ビジュアルエディタは titleformat を解釈できないが、空表示は最悪なので
        // autoLabel フラグを立てて renderer 側で番号付きラベルを描く。
        if (!headingHit.starred && titleBody.trim() === "") {
          meta.autoLabel = "true";
        }
        segments.push({
          id: nextId("seg"),
          kind: headingHit.kind,
          range: { start: i, end: braceEnd + 1 },
          body: titleBody,
          meta: Object.keys(meta).length > 0 ? meta : undefined,
        });
        i = braceEnd + 1;
        continue;
      }
    }

    // 改行コマンド: \\  または  \\[10mm] 等の縦スペース付き改行
    // 注意: src 内では `\\` (本物の 2 文字バックスラッシュ) で表現される。
    // これを paragraph パスに流すと「\\[10mm]」のような生 LaTeX が画面に出てしまうため、
    // ここで hidden raw として消費する。
    if (src.startsWith("\\\\", i)) {
      let cmdEnd = i + 2;
      // 任意の `*` (\\*[10mm] などの no-page-break variant)
      if (src[cmdEnd] === "*") cmdEnd++;
      // 任意の [<長さ>] 引数
      if (src[cmdEnd] === "[") {
        let depth = 1;
        let j = cmdEnd + 1;
        while (j < end) {
          if (src[j] === "\\" && j + 1 < end) { j += 2; continue; }
          if (src[j] === "[") depth++;
          else if (src[j] === "]") {
            depth--;
            if (depth === 0) { cmdEnd = j + 1; break; }
          }
          j++;
        }
      }
      segments.push({
        id: nextId("seg"),
        kind: "raw",
        range: { start: i, end: cmdEnd },
        body: src.slice(i, cmdEnd),
        meta: { isStandalone: "true", cmd: "linebreak", hidden: "true" },
      });
      i = cmdEnd;
      continue;
    }

    // 表示数式: \[...\]
    if (src.startsWith("\\[", i)) {
      const close = src.indexOf("\\]", i + 2);
      if (close !== -1 && close < end) {
        segments.push({
          id: nextId("seg"),
          kind: "displayMath",
          range: { start: i, end: close + 2 },
          body: src.slice(i + 2, close).trim(),
          meta: { wrapper: "bracket" },
        });
        i = close + 2;
        continue;
      }
    }

    // 表示数式: $$...$$
    if (src.startsWith("$$", i)) {
      const close = src.indexOf("$$", i + 2);
      if (close !== -1 && close < end) {
        segments.push({
          id: nextId("seg"),
          kind: "displayMath",
          range: { start: i, end: close + 2 },
          body: src.slice(i + 2, close).trim(),
          meta: { wrapper: "dollar" },
        });
        i = close + 2;
        continue;
      }
    }

    // \begin{...} ... \end{...}
    if (src.startsWith("\\begin{", i)) {
      const envName = readEnvironmentName(src, i, end);
      if (envName) {
        const envEnd = findEnvironmentEnd(src, i, envName, end);
        if (envEnd !== -1) {
          // displayMath 系
          if (DISPLAY_MATH_ENVS.has(envName)) {
            const innerStart = i + `\\begin{${envName}}`.length;
            const innerEnd = envEnd - `\\end{${envName}}`.length;
            segments.push({
              id: nextId("seg"),
              kind: "displayMath",
              range: { start: i, end: envEnd },
              body: src.slice(innerStart, innerEnd).trim(),
              meta: { wrapper: "env", envName },
            });
            i = envEnd;
            continue;
          }
          // itemize / enumerate
          if (envName === "itemize" || envName === "enumerate") {
            const innerStart = i + `\\begin{${envName}}`.length;
            const innerEnd = envEnd - `\\end{${envName}}`.length;
            // optional [...] (\begin{itemize}[leftmargin=2em]) スキップ
            let optStart = innerStart;
            while (optStart < innerEnd && (src[optStart] === " " || src[optStart] === "\t")) optStart++;
            let realInnerStart = innerStart;
            if (src[optStart] === "[") {
              const close = src.indexOf("]", optStart);
              if (close !== -1 && close < innerEnd) realInnerStart = close + 1;
            }
            const children = parseListChildren(src, realInnerStart, innerEnd);
            segments.push({
              id: nextId("seg"),
              kind: envName,
              range: { start: i, end: envEnd },
              body: src.slice(i, envEnd),
              children,
              meta: { envName },
            });
            i = envEnd;
            continue;
          }
          // daimon (テンプレ独自・大問ボックス)
          //   \begin{daimon}[opt]{title}...\end{daimon}
          //   or \begin{daimon}{title}...\end{daimon}
          if (envName === "daimon") {
            const beginLen = `\\begin{daimon}`.length;
            const endLen = `\\end{daimon}`.length;
            let cursor = i + beginLen;
            // 任意 [opt] を読み飛ばす (中身は触らない)
            let optStart = -1;
            let optEnd = -1;
            if (src[cursor] === "[") {
              let depth = 0;
              let j = cursor;
              while (j < envEnd) {
                if (src[j] === "\\" && j + 1 < envEnd) { j += 2; continue; }
                if (src[j] === "[") depth++;
                else if (src[j] === "]") {
                  depth--;
                  if (depth === 0) { optStart = cursor; optEnd = j + 1; cursor = j + 1; break; }
                }
                j++;
              }
            }
            // 必須 {title}
            let titleStart = -1;
            let titleEnd = -1;
            if (src[cursor] === "{") {
              const close = findMatchingBrace(src, cursor, envEnd);
              if (close !== -1) {
                titleStart = cursor + 1;
                titleEnd = close;
                cursor = close + 1;
              }
            }
            const innerStart = cursor;
            const innerEnd = envEnd - endLen;
            const children = parseBody(src, innerStart, innerEnd);
            segments.push({
              id: nextId("seg"),
              kind: "daimon",
              range: { start: i, end: envEnd },
              body: titleStart !== -1 ? src.slice(titleStart, titleEnd) : "",
              children,
              meta: {
                envName: "daimon",
                titleStart: String(titleStart),
                titleEnd: String(titleEnd),
                optStart: String(optStart),
                optEnd: String(optEnd),
                innerStart: String(innerStart),
                innerEnd: String(innerEnd),
              },
            });
            i = envEnd;
            continue;
          }
          // center (中身を再帰的にパース)
          if (envName === "center") {
            const beginLen = `\\begin{center}`.length;
            const endLen = `\\end{center}`.length;
            const innerStart = i + beginLen;
            const innerEnd = envEnd - endLen;
            const children = parseBody(src, innerStart, innerEnd);
            segments.push({
              id: nextId("seg"),
              kind: "center",
              range: { start: i, end: envEnd },
              body: src.slice(innerStart, innerEnd),
              children,
              meta: {
                envName: "center",
                innerStart: String(innerStart),
                innerEnd: String(innerEnd),
              },
            });
            i = envEnd;
            continue;
          }
          // thebibliography — 参考文献リスト
          //   \begin{thebibliography}{widest-label}
          //     \bibitem{key1} content
          //     \bibitem{key2} content
          //   \end{thebibliography}
          // 各 \bibitem{key} のあとから次の \bibitem か \end までを item として拾う。
          if (envName === "thebibliography") {
            const beginLen = `\\begin{thebibliography}`.length;
            const endLen = `\\end{thebibliography}`.length;
            let cursor = i + beginLen;
            // 必須 {widest-label} をスキップ (容器には保持しない)
            while (cursor < envEnd && (src[cursor] === " " || src[cursor] === "\t" || src[cursor] === "\n")) cursor++;
            if (src[cursor] === "{") {
              const close = findMatchingBrace(src, cursor, envEnd);
              if (close !== -1) cursor = close + 1;
            }
            const innerStart = cursor;
            const innerEnd = envEnd - endLen;
            // \bibitem{key} の位置を全部拾う
            const children: Segment[] = [];
            const bibRe = /\\bibitem(?:\[[^\]]*\])?\{([^{}]*)\}/g;
            bibRe.lastIndex = innerStart;
            const positions: Array<{ start: number; cmdEnd: number; key: string }> = [];
            let m: RegExpExecArray | null;
            while ((m = bibRe.exec(src)) !== null) {
              if (m.index >= innerEnd) break;
              positions.push({ start: m.index, cmdEnd: m.index + m[0].length, key: m[1] });
            }
            for (let k = 0; k < positions.length; k++) {
              const cur = positions[k];
              const next = k + 1 < positions.length ? positions[k + 1].start : innerEnd;
              const bodyStart = cur.cmdEnd;
              const bodyEnd = next;
              children.push({
                id: nextId("seg"),
                kind: "item",
                range: { start: cur.start, end: bodyEnd },
                body: src.slice(bodyStart, bodyEnd).trim(),
                inlines: extractInlines(src, bodyStart, bodyEnd),
                meta: {
                  bibKey: cur.key,
                  bibIndex: String(k + 1),
                  bodyStart: String(bodyStart),
                  bodyEnd: String(bodyEnd),
                },
              });
            }
            segments.push({
              id: nextId("seg"),
              kind: "bibliography",
              range: { start: i, end: envEnd },
              body: "",
              children,
              meta: { envName: "thebibliography" },
            });
            i = envEnd;
            continue;
          }
          // tabular 系 → table セグメントとして HTML テーブルに展開
          if (TABLE_ENVS.has(envName)) {
            const tableSeg = parseTableEnvironment(src, envName, i, envEnd);
            if (tableSeg) {
              segments.push(tableSeg);
              i = envEnd;
              continue;
            }
            // パース失敗時は raw にフォールバック
          }

          // 「中身を覗かない」と決めている環境 (figure/tikz/verbatim/…)
          // → これだけは raw 扱い (RawPlaceholder で控えめに表示)
          if (PRESERVE_AS_RAW_ENVS.has(envName)) {
            const body = src.slice(i, envEnd);
            // 図アセットライブラリで挿入された図は `% eddivom-figure: id=<id>`
            // マーカコメントが入っている。Visual Editor はこれを使って
            // サーバの preview PNG を表示する。
            const figIdMatch = body.match(/%\s*eddivom-figure:\s*id=([a-z0-9_.]+)/i);
            const meta: Record<string, string> = {
              envName,
              isEnvironment: "true",
            };
            if (figIdMatch) {
              meta.figureId = figIdMatch[1];
            }
            segments.push({
              id: nextId("seg"),
              kind: "raw",
              range: { start: i, end: envEnd },
              body,
              meta,
            });
            i = envEnd;
            continue;
          }

          // それ以外の未知環境 (tcolorbox / kihon / ouyou / teigi / passage / note / frame など)
          // → 透過的な container として中身を再帰パースして表示する。
          // \begin{name}[opt]{title} などの引数列はスキップしてから body をパースする。
          // {title} 引数があれば、それを container.body に保持して見出し風に出す。
          {
            const beginLen = `\\begin{${envName}}`.length;
            const endLen = `\\end{${envName}}`.length;
            let cursor = i + beginLen;
            let titleStart = -1;
            let titleEnd = -1;

            // 任意の [opt] と {arg} を任意個スキップ。最初の {arg} を title として保持する。
            while (cursor < envEnd) {
              while (cursor < envEnd && (src[cursor] === " " || src[cursor] === "\t")) cursor++;
              if (src[cursor] === "[") {
                let depth = 1;
                let j = cursor + 1;
                let found = false;
                while (j < envEnd) {
                  if (src[j] === "\\" && j + 1 < envEnd) { j += 2; continue; }
                  if (src[j] === "[") depth++;
                  else if (src[j] === "]") {
                    depth--;
                    if (depth === 0) { cursor = j + 1; found = true; break; }
                  }
                  j++;
                }
                if (!found) break;
                continue;
              }
              if (src[cursor] === "{") {
                const close = findMatchingBrace(src, cursor, envEnd);
                if (close === -1) break;
                if (titleStart === -1) {
                  titleStart = cursor + 1;
                  titleEnd = close;
                }
                cursor = close + 1;
                continue;
              }
              break;
            }

            const innerStart = cursor;
            const innerEnd = envEnd - endLen;
            const children = parseBody(src, innerStart, innerEnd);
            segments.push({
              id: nextId("seg"),
              kind: "container",
              range: { start: i, end: envEnd },
              body: titleStart !== -1 ? src.slice(titleStart, titleEnd) : "",
              children,
              meta: {
                envName,
                titleStart: String(titleStart),
                titleEnd: String(titleEnd),
                innerStart: String(innerStart),
                innerEnd: String(innerEnd),
              },
            });
            i = envEnd;
            continue;
          }
        }
      }
    }

    // 単独命令 (\maketitle 等)
    const remaining = src.slice(i, Math.min(i + 40, end));
    const standaloneMatch = remaining.match(STANDALONE_CMD_RE);
    if (standaloneMatch) {
      const cmdEnd = i + standaloneMatch[0].length;
      segments.push({
        id: nextId("seg"),
        kind: "raw",
        range: { start: i, end: cmdEnd },
        body: src.slice(i, cmdEnd),
        meta: { isStandalone: "true", cmd: standaloneMatch[1], hidden: "true" },
      });
      i = cmdEnd;
      continue;
    }

    // 引数なしの「消すだけ」命令 (\hfill / \vfill / \smallskip など) を hidden raw として消費
    // ※ STANDALONE_CMD_RE に追加してもよかったが、用途上「インラインでも段落でも同じ意味」
    //    なので INLINE_NO_ARG_HIDDEN_CMDS と単一情報源で扱いたい。
    const noArgMatch = remaining.match(/^\\([a-zA-Z@]+)(?![a-zA-Z@])/);
    if (noArgMatch && INLINE_NO_ARG_HIDDEN_CMDS.has(noArgMatch[1])) {
      const cmdEnd = i + noArgMatch[0].length;
      segments.push({
        id: nextId("seg"),
        kind: "raw",
        range: { start: i, end: cmdEnd },
        body: src.slice(i, cmdEnd),
        meta: { isStandalone: "true", cmd: noArgMatch[1], hidden: "true" },
      });
      i = cmdEnd;
      continue;
    }

    // 1〜2 引数の「表示上は無視する」命令 (\vspace{6mm} / \setcounter{x}{1} 等)
    const hiddenCmdMatch = remaining.match(/^\\([a-zA-Z@]+)\*?\s*\{/);
    if (hiddenCmdMatch) {
      const cmdName = hiddenCmdMatch[1];
      if (ONE_ARG_HIDDEN_CMDS.has(cmdName) || TWO_ARG_HIDDEN_CMDS.has(cmdName)) {
        // 第一引数の終端を探す
        const firstBraceIdx = i + hiddenCmdMatch[0].length - 1;
        const firstClose = findMatchingBrace(src, firstBraceIdx, end);
        if (firstClose !== -1) {
          let cmdEnd = firstClose + 1;
          // 第二引数があるならそれも消費
          if (TWO_ARG_HIDDEN_CMDS.has(cmdName)) {
            let j = cmdEnd;
            while (j < end && (src[j] === " " || src[j] === "\t")) j++;
            if (src[j] === "{") {
              const secondClose = findMatchingBrace(src, j, end);
              if (secondClose !== -1) cmdEnd = secondClose + 1;
            }
          }
          segments.push({
            id: nextId("seg"),
            kind: "raw",
            range: { start: i, end: cmdEnd },
            body: src.slice(i, cmdEnd),
            meta: { isStandalone: "true", cmd: cmdName, hidden: "true" },
          });
          i = cmdEnd;
          continue;
        }
      }
    }

    // それ以外 → 段落として次の改行2つまで読む (ただし、上記の構文に当たったら停止)
    //
    // ★ braceDepth 追跡:
    //   `{\textcolor{red}{\n\n}}` のように波括弧の中に空行を含むケースで段落が
    //   分断され「{\textcolor{red}{」と「}}」が別ボックスとして表示されるバグを防ぐ。
    //   段落終端トリガ (空行 / 構造命令 / 行送り) は **トップレベル(braceDepth=0)** のみ
    //   有効にする。
    const paraStart = i;
    let paraEnd = end;
    let scan = i;
    let braceDepth = 0;
    while (scan < end) {
      const ch = src[scan];

      // \\ (escape) はそのまま 2 文字スキップ。\{ \} \\ もここで一括処理する。
      if (ch === "\\" && scan + 1 < end) {
        const next = src[scan + 1];
        // `\\` (LaTeX line break) — トップレベルかつ 1 文字以上進んだ位置でだけ段落終端
        if (next === "\\") {
          if (braceDepth === 0 && scan > paraStart) {
            paraEnd = scan;
            break;
          }
          scan += 2;
          continue;
        }
        // \{ \} は depth に影響しない。エスケープとしてスキップ。
        if (next === "{" || next === "}") {
          scan += 2;
          continue;
        }
        // 構造的境界 / hidden 命令 / 単独命令はトップレベルでのみ段落を打ち切る
        if (braceDepth === 0) {
          if (
            src.startsWith("\\section{", scan) ||
            src.startsWith("\\section*{", scan) ||
            src.startsWith("\\subsection{", scan) ||
            src.startsWith("\\subsection*{", scan) ||
            src.startsWith("\\subsubsection{", scan) ||
            src.startsWith("\\subsubsection*{", scan) ||
            src.startsWith("\\paragraph{", scan) ||
            src.startsWith("\\begin{", scan) ||
            src.startsWith("\\[", scan)
          ) {
            paraEnd = scan;
            break;
          }
          if (scan > paraStart) {
            const tail = src.slice(scan, Math.min(scan + 40, end));
            if (STANDALONE_CMD_RE.test(tail)) {
              paraEnd = scan;
              break;
            }
            const mNoArg = tail.match(/^\\([a-zA-Z@]+)(?![a-zA-Z@])/);
            if (mNoArg && INLINE_NO_ARG_HIDDEN_CMDS.has(mNoArg[1])) {
              paraEnd = scan;
              break;
            }
            const m = tail.match(/^\\([a-zA-Z@]+)\*?\s*\{/);
            if (m && (ONE_ARG_HIDDEN_CMDS.has(m[1]) || TWO_ARG_HIDDEN_CMDS.has(m[1]))) {
              paraEnd = scan;
              break;
            }
          }
        }
        // 通常のコマンド: 命令名末尾までスキップして depth を進めない
        let j = scan + 1;
        while (j < end && /[a-zA-Z@]/.test(src[j])) j++;
        scan = j;
        continue;
      }

      // 波括弧の depth 追跡
      if (ch === "{") {
        braceDepth++;
        scan++;
        continue;
      }
      if (ch === "}") {
        if (braceDepth > 0) braceDepth--;
        scan++;
        continue;
      }

      // $$...$$ 表示数式境界 (トップレベルのみ)
      if (braceDepth === 0 && ch === "$" && src[scan + 1] === "$") {
        paraEnd = scan;
        break;
      }

      // \n\n で段落終端 (トップレベルのみ)
      if (ch === "\n" && braceDepth === 0) {
        let j = scan + 1;
        while (j < end && (src[j] === " " || src[j] === "\t")) j++;
        if (j >= end || src[j] === "\n") {
          paraEnd = scan;
          break;
        }
      }

      scan++;
    }
    if (scan >= end) paraEnd = end;

    // 末尾の空白を除去
    let realEnd = paraEnd;
    while (realEnd > paraStart && /\s/.test(src[realEnd - 1])) realEnd--;

    if (realEnd > paraStart) {
      const inlines = extractInlines(src, paraStart, realEnd);
      if (inlines.length > 0) {
        segments.push({
          id: nextId("seg"),
          kind: "paragraph",
          range: { start: paraStart, end: realEnd },
          body: src.slice(paraStart, realEnd),
          inlines,
        });
      } else {
        // 中身が hidden/drop コマンドだけだった (\hspace{...}\rule{...} 等)
        // → 段落を作らず、hidden raw として控えめに保持する。
        //   こうすれば「raw LaTeX が画面に漏れる」症状を完全に防ぎつつ、
        //   元 LaTeX を range として保存するので serialize 経路を壊さない。
        segments.push({
          id: nextId("seg"),
          kind: "raw",
          range: { start: paraStart, end: realEnd },
          body: src.slice(paraStart, realEnd),
          meta: { hidden: "true", reason: "no-visible-content" },
        });
      }
      i = paraEnd;
    } else {
      // 進捗ゼロの保険
      i = skipStart + 1;
    }
  }

  return segments;
}

/** プリアンブルから \title / \subtitle / \author / \date の中身の絶対 range を抽出する。
 *  例: `\title{ABC}` → titleStart = '{' の次, titleEnd = '}' の位置
 *  見つからないフィールドは undefined を返す。
 *  ※ トップレベルのみをスキャンする (環境内に書かれている場合は拾わない)。 */
function extractTitleFieldsFromPreamble(
  src: string,
  preambleStart: number,
  preambleEnd: number,
): { title?: Range; subtitle?: Range; author?: Range; institute?: Range; date?: Range } {
  const result: { title?: Range; subtitle?: Range; author?: Range; institute?: Range; date?: Range } = {};
  const fields: Array<{ cmd: string; key: "title" | "subtitle" | "author" | "institute" | "date" }> = [
    { cmd: "\\title", key: "title" },
    { cmd: "\\subtitle", key: "subtitle" },
    { cmd: "\\author", key: "author" },
    { cmd: "\\institute", key: "institute" },
    { cmd: "\\date", key: "date" },
  ];
  for (const { cmd, key } of fields) {
    // 同名コマンドが複数回定義されていれば最後のものが有効になる (LaTeX 準拠)
    let searchFrom = preambleStart;
    while (searchFrom < preambleEnd) {
      const found = src.indexOf(cmd, searchFrom);
      if (found === -1 || found >= preambleEnd) break;
      // \title[...] → コマンド名として厳密にマッチさせる (\titleformat 等と区別)
      const afterCmd = found + cmd.length;
      const nextCh = src[afterCmd];
      if (nextCh !== "{" && nextCh !== " " && nextCh !== "\t" && nextCh !== "[") {
        searchFrom = afterCmd;
        continue;
      }
      // 行頭が '%' でコメントアウトされていないかだけ粗くチェック
      let lineStart = found;
      while (lineStart > preambleStart && src[lineStart - 1] !== "\n") lineStart--;
      let isCommented = false;
      for (let k = lineStart; k < found; k++) {
        if (src[k] === "%" && (k === lineStart || src[k - 1] !== "\\")) { isCommented = true; break; }
      }
      if (isCommented) {
        searchFrom = afterCmd;
        continue;
      }
      // オプション引数 [...] をスキップ
      let cursor = afterCmd;
      while (cursor < preambleEnd && (src[cursor] === " " || src[cursor] === "\t")) cursor++;
      if (src[cursor] === "[") {
        let depth = 1;
        let j = cursor + 1;
        while (j < preambleEnd) {
          if (src[j] === "\\" && j + 1 < preambleEnd) { j += 2; continue; }
          if (src[j] === "[") depth++;
          else if (src[j] === "]") { depth--; if (depth === 0) { cursor = j + 1; break; } }
          j++;
        }
        while (cursor < preambleEnd && (src[cursor] === " " || src[cursor] === "\t")) cursor++;
      }
      if (src[cursor] !== "{") {
        searchFrom = afterCmd;
        continue;
      }
      const close = findMatchingBrace(src, cursor, preambleEnd);
      if (close === -1) {
        searchFrom = afterCmd;
        continue;
      }
      result[key] = { start: cursor + 1, end: close };
      searchFrom = close + 1;
    }
  }
  return result;
}

/** 再帰的にセグメントツリーを歩き、hidden raw \maketitle を見つけて titleBlock に差し替える。
 *  beamer / article / report のいずれでも最上位 body に出るのが基本なので、
 *  通常は 1 箇所だけヒットする想定だが、念のため再帰で探す。 */
function upgradeMaketitleSegments(
  segments: Segment[],
  titleFields: { title?: Range; subtitle?: Range; author?: Range; institute?: Range; date?: Range },
): void {
  if (!titleFields.title && !titleFields.subtitle && !titleFields.author && !titleFields.institute && !titleFields.date) return;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    // beamer は \maketitle の代わりに \titlepage を frame 内で呼ぶ流儀があるので両方拾う
    if (seg.kind === "raw" && (seg.meta?.cmd === "maketitle" || seg.meta?.cmd === "titlepage")) {
      const meta: Record<string, string> = { cmd: seg.meta.cmd };
      if (titleFields.title) {
        meta.titleStart = String(titleFields.title.start);
        meta.titleEnd = String(titleFields.title.end);
      }
      if (titleFields.subtitle) {
        meta.subtitleStart = String(titleFields.subtitle.start);
        meta.subtitleEnd = String(titleFields.subtitle.end);
      }
      if (titleFields.author) {
        meta.authorStart = String(titleFields.author.start);
        meta.authorEnd = String(titleFields.author.end);
      }
      if (titleFields.institute) {
        meta.instituteStart = String(titleFields.institute.start);
        meta.instituteEnd = String(titleFields.institute.end);
      }
      if (titleFields.date) {
        meta.dateStart = String(titleFields.date.start);
        meta.dateEnd = String(titleFields.date.end);
      }
      segments[i] = {
        id: seg.id,
        kind: "titleBlock",
        range: seg.range,
        body: "",
        meta,
      };
    }
    if (seg.children && seg.children.length > 0) {
      upgradeMaketitleSegments(seg.children, titleFields);
    }
  }
}

/** セグメントツリーをトップレベル順に走査して章・節の一覧を収集する。
 *  \tableofcontents セグメントに渡して PDF ライクな目次を描画するために使う。
 *  container / center / daimon 等の中に置かれた見出しも拾う (再帰)。
 *  トップレベルでは chapter → section → subsection の親子関係はカウンタで擬似的に振る。 */
function collectTocEntries(segments: Segment[]): Array<{ level: number; text: string; starred: boolean }> {
  const entries: Array<{ level: number; text: string; starred: boolean }> = [];
  const walk = (segs: Segment[]): void => {
    for (const s of segs) {
      if (s.kind === "section") {
        // chapter も section 扱いだが、LaTeX 的には \chapter が最上位。テンプレ上は
        // \chapter と \section の混在は少ないので level=1 で並べる。
        entries.push({
          level: 1,
          text: (s.body ?? "").trim(),
          starred: s.meta?.starred === "true",
        });
      } else if (s.kind === "subsection") {
        entries.push({ level: 2, text: (s.body ?? "").trim(), starred: s.meta?.starred === "true" });
      } else if (s.kind === "subsubsection") {
        entries.push({ level: 3, text: (s.body ?? "").trim(), starred: s.meta?.starred === "true" });
      }
      if (s.children && s.children.length > 0) walk(s.children);
    }
  };
  walk(segments);
  return entries;
}

/** 本文中の hidden raw "\tableofcontents" を見つけて、収集済みの見出し一覧を
 *  含む toc セグメントに差し替える。 */
function upgradeTocSegments(segments: Segment[], tocJson: string): void {
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.kind === "raw" && seg.meta?.cmd === "tableofcontents") {
      segments[i] = {
        id: seg.id,
        kind: "toc",
        range: seg.range,
        body: "",
        meta: { entries: tocJson },
      };
    }
    if (seg.children && seg.children.length > 0) {
      upgradeTocSegments(seg.children, tocJson);
    }
  }
}

/** hidden raw の skip 系 (\smallskip / \medskip / \bigskip / \vspace{...}) と
 *  page break 系 (\newpage / \clearpage / \pagebreak) を可視セグメントに昇格する。 */
function upgradeSpacingSegments(segments: Segment[]): void {
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const cmd = seg.meta?.cmd;
    if (seg.kind === "raw" && cmd) {
      if (cmd === "smallskip" || cmd === "medskip" || cmd === "bigskip") {
        segments[i] = {
          id: seg.id,
          kind: "vspace",
          range: seg.range,
          body: "",
          meta: { size: cmd },
        };
      } else if (cmd === "vspace" || cmd === "vspace*") {
        // \vspace{Nmm} の第一引数を body から抽出
        const m = /\\vspace\*?\s*\{([^{}]*)\}/.exec(seg.body);
        const arg = m ? m[1].trim() : "";
        segments[i] = {
          id: seg.id,
          kind: "vspace",
          range: seg.range,
          body: "",
          meta: { size: "custom", amount: arg },
        };
      } else if (cmd === "newpage" || cmd === "clearpage" || cmd === "pagebreak") {
        segments[i] = {
          id: seg.id,
          kind: "pageBreak",
          range: seg.range,
          body: "",
          meta: { cmd },
        };
      }
    }
    if (seg.children && seg.children.length > 0) {
      upgradeSpacingSegments(seg.children);
    }
  }
}

/** トップレベル: preamble + body + documentEnd を抽出 */
export function parseLatexToSegments(latex: string): Segment[] {
  __idCounter = 0;
  const segments: Segment[] = [];

  const beginDoc = latex.indexOf("\\begin{document}");
  if (beginDoc === -1) {
    // \begin{document} なし → 全体を body として扱う
    segments.push(...parseBody(latex, 0, latex.length));
    assignSectionNumbers(segments);
    return segments;
  }

  const preambleEnd = beginDoc + "\\begin{document}".length;
  segments.push({
    id: nextId("seg"),
    kind: "preamble",
    range: { start: 0, end: preambleEnd },
    body: latex.slice(0, preambleEnd),
  });

  const titleFields = extractTitleFieldsFromPreamble(latex, 0, beginDoc);

  const endDoc = latex.indexOf("\\end{document}", preambleEnd);
  const bodyEnd = endDoc === -1 ? latex.length : endDoc;
  const bodySegs = parseBody(latex, preambleEnd, bodyEnd);
  upgradeMaketitleSegments(bodySegs, titleFields);
  upgradeSpacingSegments(bodySegs);
  // 目次の中身は「最終的なセグメントツリー」を歩いて集める必要がある (spacing の昇格後)
  const tocEntries = collectTocEntries(bodySegs);
  if (tocEntries.length > 0) {
    upgradeTocSegments(bodySegs, JSON.stringify(tocEntries));
  }
  segments.push(...bodySegs);

  if (endDoc !== -1) {
    segments.push({
      id: nextId("seg"),
      kind: "documentEnd",
      range: { start: bodyEnd, end: latex.length },
      body: latex.slice(bodyEnd),
      meta: { hidden: "true" },
    });
  }

  assignSectionNumbers(segments);
  return segments;
}

/** \section{} (starred 以外) に通し番号を振る。再帰的に container の中も走査する。
 *  \titleformat により「第N問」「Problem N」が PDF に出ているテンプレで、
 *  ビジュアル側でも同じ番号を表示するために使う。
 *  ※ 厳密な LaTeX のセクションカウンタ挙動 (\setcounter / \addtocounter) は再現しない。
 *    入門用テンプレでよくある「3 つの \section{}」を 1, 2, 3 と振るだけで十分。 */
function assignSectionNumbers(segments: Segment[]): void {
  let counter = 0;
  const walk = (segs: Segment[]): void => {
    for (const s of segs) {
      if (s.kind === "section" && s.meta?.starred !== "true") {
        counter++;
        if (!s.meta) s.meta = {};
        s.meta.sectionNumber = String(counter);
      }
      if (s.children) walk(s.children);
    }
  };
  walk(segments);
}

// ─────────────────────────────────────
// シリアライズ (編集 → LaTeX 文字列の置換)
// ─────────────────────────────────────

/** Segment の新 body から、その range に書き戻すべき LaTeX スニペットを生成。 */
export function serializeSegment(segment: Segment, newBody: string, originalSrc: string): string {
  const original = originalSrc.slice(segment.range.start, segment.range.end);
  const star = segment.meta?.starred === "true" ? "*" : "";
  switch (segment.kind) {
    case "section":
      return `\\section${star}{${newBody}}`;
    case "subsection":
      return `\\subsection${star}{${newBody}}`;
    case "subsubsection":
      return `\\subsubsection${star}{${newBody}}`;
    case "displayMath": {
      const wrapper = segment.meta?.wrapper;
      if (wrapper === "bracket") return `\\[\n${newBody}\n\\]`;
      if (wrapper === "dollar") return `$$${newBody}$$`;
      if (wrapper === "env") {
        const env = segment.meta?.envName ?? "equation";
        return `\\begin{${env}}\n${newBody}\n\\end{${env}}`;
      }
      return original;
    }
    case "paragraph":
    case "item":
    case "preamble":
    case "raw":
    case "documentEnd":
      // paragraph/item は外部で inline 単位で書き換えるか、body 全体を文字列として置換する想定
      return newBody;
    case "titleBlock":
    case "toc":
    case "vspace":
    case "pageBreak":
    case "bibliography":
      // 構造的に上書きしないブロック — 元のスライスをそのまま返す
      return original;
    case "daimon":
    case "center":
    case "container":
      // daimon / center / container は子セグメントを通じて編集する。
      // 直接 body を置換することはないので、original を返す。
      return original;
    default:
      return original;
  }
}

/** Inline の新 body から、その range に書き戻すべき LaTeX スニペットを生成。 */
export function serializeInline(inline: Inline, newBody: string): string {
  switch (inline.kind) {
    case "text": return newBody;
    case "inlineMath": return `$${newBody}$`;
    case "displayMath": {
      const wrapper = inline.meta?.wrapper ?? "bracket";
      const envName = inline.meta?.envName ?? "";
      if (wrapper === "env" && envName) {
        return `\\begin{${envName}}${newBody}\\end{${envName}}`;
      }
      if (wrapper === "dollar") {
        return `$$${newBody}$$`;
      }
      return `\\[${newBody}\\]`;
    }
    case "bold": return `\\textbf{${newBody}}`;
    case "italic": return `\\textit{${newBody}}`;
    case "code": return `\\texttt{${newBody}}`;
    case "linebreak": return "\\\\";
    case "rule": {
      const w = inline.meta?.width ?? "1em";
      const h = inline.meta?.height ?? "0.4pt";
      return `\\rule{${w}}{${h}}`;
    }
    case "framed": {
      const cmdName = inline.meta?.cmd ?? "fbox";
      return `\\${cmdName}{${newBody}}`;
    }
    case "colored": {
      const color = inline.meta?.color ?? "black";
      return `\\textcolor{${color}}{${newBody}}`;
    }
    case "sized": {
      const size = inline.meta?.size;
      const weight = inline.meta?.weight;
      const shape = inline.meta?.shape;
      const parts: string[] = [];
      if (size) parts.push(`\\${size}`);
      if (weight === "bold") parts.push(`\\bfseries`);
      if (shape === "italic") parts.push(`\\itshape`);
      const prefix = parts.join("");
      return `{${prefix}${prefix ? " " : ""}${newBody}}`;
    }
    case "templateCmd": {
      const name = inline.meta?.name ?? "text";
      const arg2 = inline.meta?.arg2;
      if (arg2 !== undefined) {
        return `\\${name}{${newBody}}{${arg2}}`;
      }
      return `\\${name}{${newBody}}`;
    }
    default: return newBody;
  }
}

/** range を新しい文字列で置換した新 LaTeX を返す。 */
export function replaceRange(latex: string, range: Range, replacement: string): string {
  return latex.slice(0, range.start) + replacement + latex.slice(range.end);
}
