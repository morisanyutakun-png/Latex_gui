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
  | "raw"
  | "documentEnd"; // \end{document} 以降の trailing 部分 (非表示)

export type InlineKind =
  | "text"
  | "inlineMath"
  | "bold"
  | "italic"
  | "code";

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

/** インライン中の 2 引数命令 → 第二引数だけ取り出す (\textcolor{red}{XYZ} の "XYZ") */
const INLINE_UNWRAP_2_SECOND = new Set([
  "textcolor", "colorbox", "fcolorbox", "fbox",
]);

/** インライン中で第一引数も第二引数も全部捨てる命令 */
const INLINE_DROP_ARG_CMDS = new Set([
  "vspace", "hspace", "vskip", "hskip",
  "label", "ref", "pageref", "eqref", "cite",
  "rule", "phantom", "vphantom", "hphantom",
  "setcounter", "addtocounter", "stepcounter", "refstepcounter",
  "fontsize", "color",
]);

/** 段落テキスト [start, end) からインラインを抽出する。 */
function extractInlines(src: string, start: number, end: number): Inline[] {
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

    // \cmdname { ... } 系の処理
    if (ch === "\\") {
      const cmd = readCmdName(i);
      if (cmd) {
        const nameAfter = skipWS(cmd.nextPos);

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
      }
    }

    // 単独の { ... } グループ → 中身を再帰展開 (フォント切替などのスコープ)
    // 例: {\bfseries\color{ctnavy} 数学} のようなフォント切替グループ
    if (ch === "{") {
      const braceEnd = findMatchingBrace(src, i, end);
      if (braceEnd !== -1) {
        pushText(cursor, i);
        const inner = extractInlines(src, i + 1, braceEnd);
        inlines.push(...inner);
        cursor = braceEnd + 1;
        i = braceEnd + 1;
        continue;
      }
    }

    i++;
  }

  pushText(cursor, end);
  return inlines.length > 0 ? inlines : [{
    id: nextId("inl"),
    kind: "text",
    range: { start, end },
    body: src.slice(start, end),
  }];
}

// ─────────────────────────────────────
// 段落分割
// ─────────────────────────────────────

// ─────────────────────────────────────
// itemize/enumerate の中の \item 分割
// ─────────────────────────────────────

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

/** 見出しパターン (より長い prefix を先にマッチさせるため、subsub → sub → section の順) */
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
];

/** 単独命令 ( \maketitle 等 ) の正規表現 — 引数なし */
const STANDALONE_CMD_RE = /^\\(maketitle|tableofcontents|newpage|clearpage|pagebreak|linebreak|hline|midrule|toprule|bottomrule|noindent|smallskip|medskip|bigskip|par|centering|raggedright|raggedleft|onehalfspacing|doublespacing|singlespacing|null|@empty)\b/;

/** 1 つの引数 {…} を取って表示上は無視する命令 (vspace / hspace / setcounter / addtocounter 等)
 *  さらに * 付き variant (\vspace*) も自動でマッチさせる。 */
const ONE_ARG_HIDDEN_CMDS = new Set([
  "vspace", "hspace", "vskip", "hskip", "vfill", "hfill",
  "setcounter", "addtocounter", "stepcounter", "refstepcounter",
  "label", "ref", "pageref", "eqref", "cite",
  "input", "include", "thispagestyle", "pagestyle",
  "rule", "phantom", "vphantom", "hphantom",
]);

/** 2 つの引数 {…}{…} を取って表示上は無視する命令 */
const TWO_ARG_HIDDEN_CMDS = new Set([
  "rule",
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
        segments.push({
          id: nextId("seg"),
          kind: headingHit.kind,
          range: { start: i, end: braceEnd + 1 },
          body: src.slice(braceStart + 1, braceEnd),
          meta: headingHit.starred ? { starred: "true" } : undefined,
        });
        i = braceEnd + 1;
        continue;
      }
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
          // raw 環境 (table/figure/tabular/...)
          segments.push({
            id: nextId("seg"),
            kind: "raw",
            range: { start: i, end: envEnd },
            body: src.slice(i, envEnd),
            meta: { envName, isEnvironment: "true" },
          });
          i = envEnd;
          continue;
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
    const paraStart = i;
    let paraEnd = end;
    let scan = i;
    while (scan < end) {
      // 構文の境界 (見出し / \begin / \[ / $$ / 各種非表示コマンド) に当たったら停止
      if (
        src.startsWith("\\section{", scan) ||
        src.startsWith("\\section*{", scan) ||
        src.startsWith("\\subsection{", scan) ||
        src.startsWith("\\subsection*{", scan) ||
        src.startsWith("\\subsubsection{", scan) ||
        src.startsWith("\\subsubsection*{", scan) ||
        src.startsWith("\\paragraph{", scan) ||
        src.startsWith("\\begin{", scan) ||
        src.startsWith("\\[", scan) ||
        src.startsWith("$$", scan)
      ) {
        paraEnd = scan;
        break;
      }
      // 単独命令 / 1引数命令を見つけたらそこで段落を打ち切る (scan が paraStart より進んでいるときのみ)
      if (src[scan] === "\\" && scan > paraStart) {
        const tail = src.slice(scan, Math.min(scan + 40, end));
        if (STANDALONE_CMD_RE.test(tail)) {
          paraEnd = scan;
          break;
        }
        const m = tail.match(/^\\([a-zA-Z@]+)\*?\s*\{/);
        if (m && (ONE_ARG_HIDDEN_CMDS.has(m[1]) || TWO_ARG_HIDDEN_CMDS.has(m[1]))) {
          paraEnd = scan;
          break;
        }
      }
      // \n\n で段落終端
      if (src[scan] === "\n") {
        let j = scan + 1;
        while (j < end && (src[j] === " " || src[j] === "\t")) j++;
        if (j >= end || src[j] === "\n") {
          paraEnd = scan;
          break;
        }
      }
      // \\ (escape) はスキップして次へ
      if (src[scan] === "\\" && scan + 1 < end) {
        scan += 2;
        continue;
      }
      scan++;
    }
    if (scan >= end) paraEnd = end;

    // 末尾の空白を除去
    let realEnd = paraEnd;
    while (realEnd > paraStart && /\s/.test(src[realEnd - 1])) realEnd--;

    if (realEnd > paraStart) {
      const inlines = extractInlines(src, paraStart, realEnd);
      segments.push({
        id: nextId("seg"),
        kind: "paragraph",
        range: { start: paraStart, end: realEnd },
        body: src.slice(paraStart, realEnd),
        inlines,
      });
      i = paraEnd;
    } else {
      // 進捗ゼロの保険
      i = skipStart + 1;
    }
  }

  return segments;
}

/** トップレベル: preamble + body + documentEnd を抽出 */
export function parseLatexToSegments(latex: string): Segment[] {
  __idCounter = 0;
  const segments: Segment[] = [];

  const beginDoc = latex.indexOf("\\begin{document}");
  if (beginDoc === -1) {
    // \begin{document} なし → 全体を body として扱う
    segments.push(...parseBody(latex, 0, latex.length));
    return segments;
  }

  const preambleEnd = beginDoc + "\\begin{document}".length;
  segments.push({
    id: nextId("seg"),
    kind: "preamble",
    range: { start: 0, end: preambleEnd },
    body: latex.slice(0, preambleEnd),
  });

  const endDoc = latex.indexOf("\\end{document}", preambleEnd);
  const bodyEnd = endDoc === -1 ? latex.length : endDoc;
  segments.push(...parseBody(latex, preambleEnd, bodyEnd));

  if (endDoc !== -1) {
    segments.push({
      id: nextId("seg"),
      kind: "documentEnd",
      range: { start: bodyEnd, end: latex.length },
      body: latex.slice(bodyEnd),
      meta: { hidden: "true" },
    });
  }

  return segments;
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
    case "daimon":
    case "center":
      // daimon/center は子セグメントを通じて編集する。
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
    case "bold": return `\\textbf{${newBody}}`;
    case "italic": return `\\textit{${newBody}}`;
    case "code": return `\\texttt{${newBody}}`;
    default: return newBody;
  }
}

/** range を新しい文字列で置換した新 LaTeX を返す。 */
export function replaceRange(latex: string, range: Range, replacement: string): string {
  return latex.slice(0, range.start) + replacement + latex.slice(range.end);
}
