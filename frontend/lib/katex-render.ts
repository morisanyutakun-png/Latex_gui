/**
 * 中央集約された KaTeX レンダラ。
 *
 * 目的:
 *   1. プロジェクト固有のマクロ (\haiten, \juKey, \circled, ...) を一元定義し、
 *      テンプレ由来のコマンドが KaTeX エラーで「赤い生 LaTeX」として表示されるのを防ぐ。
 *   2. 失敗時のフォールバックを「生 LaTeX 表示」ではなく「[数式]」プレースホルダに統一し、
 *      ユーザーが LaTeX ソースを直接見ることがないようにする (テンプレ駆動方針)。
 *   3. ブラウザ間で揺れない安定した HTML 出力のため、`output: "html"` 固定にする。
 *
 * このモジュールは visual-editor / math-editor / display-math すべてから使う唯一の入口。
 */
import katex from "katex";

/**
 * テンプレートで多用されるカスタムコマンドの最小定義。
 * KaTeX は LaTeX のフルパーサではないので、ここで吸収しないとコンパイルは通っても
 * ビジュアル側で `katex-error` 扱いになり生 LaTeX が露出する。
 *
 * 厳密に PDF と同じ見た目にする必要は無い。重要なのは
 * 「赤い文字で生 LaTeX が出ない」「数式の意味が読める」こと。
 */
export const PROJECT_KATEX_MACROS: Record<string, string> = {
  // 配点バッジ系
  "\\haiten": "\\;\\text{(#1\\,pts)}",
  // 強調 (juku/worksheet テンプレで多用)
  "\\juKey": "\\boldsymbol{#1}",
  "\\juHint": "\\;\\text{(hint: #1)}",
  "\\chui": "\\;\\text{Note: #1}",
  // 丸数字
  "\\circled": "\\textcircled{\\scriptsize #1}",
  // レベルバッジ / unit / level / nlevel — 中身だけ残す
  "\\nlevel": "\\boxed{\\text{#1}}",
  "\\level": "\\text{#1}\\;\\text{#2}",
  "\\unit": "\\text{#1}",
  "\\daimonhead": "\\text{Problem #1}\\;\\text{#2}",
  "\\jukutitle": "\\text{#1}\\;\\text{#2}",
  // 色付け (KaTeX は \textcolor を持つが念のため)
  "\\juKeyText": "\\boldsymbol{\\text{#1}}",
  // 数式中で使われがちな text 系
  "\\bm": "\\boldsymbol{#1}",
  // 角度・度・対数の短縮
  "\\degree": "^{\\circ}",

  // ─── siunitx (LaTeX で多用、KaTeX は標準で知らない) ───
  // \SI{2}{\ohm} → "2 Ω", \SI[per-mode=symbol]{3}{\m\per\s} → "3 m/s"
  // KaTeX では引数の分解ができないので、1st arg (数値) + 2nd arg (単位テキスト) を
  // 並べた最小形を返す。単位コマンドは後述の個別マクロで解決する。
  "\\SI": "#1\\,#2",
  "\\si": "#1",
  "\\num": "#1",
  "\\qty": "#1\\,#2",
  "\\qtylist": "#1",
  "\\qtyrange": "#1\\text{--}#2\\,#3",
  "\\numlist": "#1",
  "\\numrange": "#1\\text{--}#2",

  // siunitx の単位コマンド (\ohm, \kilo, \ampere 等) を text に落とす
  "\\ohm": "\\Omega",
  "\\kilo": "\\text{k}",
  "\\milli": "\\text{m}",
  "\\micro": "\\mu",
  "\\mega": "\\text{M}",
  "\\giga": "\\text{G}",
  "\\nano": "\\text{n}",
  "\\pico": "\\text{p}",
  "\\centi": "\\text{c}",
  "\\volt": "\\text{V}",
  "\\ampere": "\\text{A}",
  "\\watt": "\\text{W}",
  "\\joule": "\\text{J}",
  "\\newton": "\\text{N}",
  "\\coulomb": "\\text{C}",
  "\\farad": "\\text{F}",
  "\\henry": "\\text{H}",
  "\\tesla": "\\text{T}",
  "\\metre": "\\text{m}",
  "\\meter": "\\text{m}",
  "\\second": "\\text{s}",
  "\\kilogram": "\\text{kg}",
  "\\gram": "\\text{g}",
  "\\kelvin": "\\text{K}",
  "\\celsius": "^{\\circ}\\text{C}",
  "\\hertz": "\\text{Hz}",
  "\\pascal": "\\text{Pa}",
  "\\mole": "\\text{mol}",
  "\\candela": "\\text{cd}",
  "\\per": "/",
  "\\square": "^2",
  "\\cubic": "^3",

  // ─── physics package ───
  // \vb{F} → \mathbf{F} (bold vector), \va{v} / \vu{n} / \vdot / \abs{x} ...
  "\\vb": "\\mathbf{#1}",
  "\\va": "\\vec{#1}",
  "\\vu": "\\hat{#1}",
  "\\vdot": "\\cdot",
  "\\vcross": "\\times",
  "\\vnabla": "\\nabla",
  "\\grad": "\\nabla",
  "\\div": "\\nabla\\cdot",
  "\\curl": "\\nabla\\times",
  "\\abs": "\\left|#1\\right|",
  "\\norm": "\\left\\|#1\\right\\|",
  "\\order": "\\mathcal{O}\\!\\left(#1\\right)",
  "\\dd": "\\mathrm{d}",
  "\\dv": "\\frac{\\mathrm{d}#1}{\\mathrm{d}#2}",
  "\\pdv": "\\frac{\\partial #1}{\\partial #2}",
  "\\eval": "\\bigg|",
  "\\expval": "\\left\\langle #1\\right\\rangle",
  "\\matrixel": "\\left\\langle #1\\middle|#2\\middle|#3\\right\\rangle",
  "\\ev": "\\left\\langle #1\\right\\rangle",
  "\\mel": "\\left\\langle #1\\middle|#2\\middle|#3\\right\\rangle",

  // ─── 日本語テンプレで見かける短縮 ───
  // 空集合、実数、自然数などの黒板文字
  "\\R": "\\mathbb{R}",
  "\\N": "\\mathbb{N}",
  "\\Z": "\\mathbb{Z}",
  "\\Q": "\\mathbb{Q}",
  "\\C": "\\mathbb{C}",
};

export interface RenderMathOptions {
  displayMode?: boolean;
}

export interface RenderMathResult {
  /** KaTeX が生成した HTML 文字列 (空文字なら失敗) */
  html: string;
  /** レンダリングが成功したかどうか */
  ok: boolean;
}

// KaTeX の `trust` 設定。以前は関数コールバックで \href の URL プロトコルを
// 検証していたが、KaTeX の内部コマンド (\unicode, \char 等) まで意図せず trust
// コールバックが呼ばれ、false 返却 → strict モードで throw → 単純な数式まで
// プレビュー不可フォールバックに落ちる不具合が発生した。
// 現在は KaTeX の既定である false に固定 — ブラウザプレビューでは \href / \url
// はクリッカブルにならないが、PDF (LuaLaTeX) では通常通りリンクが機能する。
// 教育用途で XSS ベクトルになりうる \href{javascript:...} も無力化される。
const KATEX_TRUST: false = false;

/**
 * KaTeX が未サポート or 失敗しやすい LaTeX 記法を "意味を維持したまま" 無害化する前処理。
 *
 * 本番 PDF は LuaLaTeX なのでどんな記法も通るが、ブラウザの簡易プレビューは KaTeX 依存で、
 * 以下のコマンドは「数式の意味とは無関係」「KaTeX が知らない」ため KaTeX エラーを起こす:
 *   - `\label{...}` / `\tag{...}` / `\notag` / `\nonumber` (参照番号関連)
 *   - `% ...` コメント
 *   - `\intertext{...}` / `\shortintertext{...}` (align 内テキスト — KaTeX は align 内の
 *     \intertext を知らない)
 *   - `\allowbreak` / `\allowdisplaybreaks` / `\displaybreak`
 *   - `\qedhere` (数式記号だが KaTeX 未対応)
 *
 * これらは剥がしても数式の意味を損なわない。
 */
function preprocessForKatex(src: string): string {
  return src
    // 行末 LaTeX コメント (`%` が \% のエスケープでないことを確認)
    .replace(/(^|[^\\])%.*$/gm, "$1")
    // \label{...} / \tag*?{...} — 1 引数コマンド
    .replace(/\\label\s*\{[^}]*\}/g, "")
    .replace(/\\tag\*?\s*\{[^}]*\}/g, "")
    // \notag / \nonumber
    .replace(/\\(?:notag|nonumber)\b/g, "")
    // \intertext{...} / \shortintertext{...} — align 中のテキスト注入
    .replace(/\\(?:short)?intertext\s*\{[^}]*\}/g, "")
    // \allowbreak / \allowdisplaybreaks / \displaybreak[0-4]?
    .replace(/\\(?:allowbreak|allowdisplaybreaks|displaybreak)(?:\[[0-9]+\])?/g, "")
    // \qedhere / \qed
    .replace(/\\qed(?:here)?\b/g, "")
    // \mathstrut / \relax (空白調整で意味なし)
    .replace(/\\(?:mathstrut|relax)\b/g, "")
    // 空になった行を整える
    .replace(/[ \t]+$/gm, "")
    .trim();
}

/**
 * KaTeX の lenient 出力に含まれる `<span class="katex-error" ...>\command</span>` を
 * 「失敗トークンを完全に隠した小さな Σ 印」に置換する。
 *
 * 旧: 生 LaTeX をそのまま出す → "テンプレ駆動 / 自然言語入力" の方針に反する
 * 新: 失敗箇所は Σ ドット (data-katex-error="1") のみ。原因は title 属性 (エラーメッセージ)
 *     経由で開発者ツールから読める (UI 表面には絶対に出さない)。
 */
function sanitizeLenientKatexHtml(html: string): string {
  return html.replace(
    /<span class="katex-error"([^>]*)>([^<]*)<\/span>/g,
    (_m, attrs) => {
      // 元の token は捨て、控えめな ⟨?⟩ ドット記号だけを出す。
      // attrs (title) はエラーメッセージなのでそのまま渡し、開発時のデバッグ用に残す。
      return `<span class="katex-error-safe"${attrs} data-katex-error="1" aria-hidden="true">⟨?⟩</span>`;
    },
  );
}

/**
 * KaTeX に投げて HTML を返す。
 * 2 段階フォールバック:
 *   1. strict (throwOnError: true) — 全てが解析できた場合のクリーンな出力
 *   2. lenient (throwOnError: false) — 失敗箇所を赤スパンで描くがほぼレンダリング成功
 *      → `sanitizeLenientKatexHtml` で生 LaTeX を剥がしてから返す
 *   3. どちらも例外を投げた場合のみ placeholder
 */
export function renderMathHTML(latex: string, opts: RenderMathOptions = {}): RenderMathResult {
  const rawSrc = latex.trim();
  if (!rawSrc) return { html: "", ok: false };
  // KaTeX 互換に向けた前処理 (label/tag/コメント等の除去)
  const src = preprocessForKatex(rawSrc);
  if (!src) return { html: "", ok: false };
  const displayMode = opts.displayMode ?? false;
  try {
    const html = katex.renderToString(src, {
      throwOnError: true,
      displayMode,
      trust: KATEX_TRUST,
      strict: "ignore",
      output: "html",
      macros: PROJECT_KATEX_MACROS,
    });
    return { html, ok: true };
  } catch {
    // strict failed — fall back to lenient mode. KaTeX では `throwOnError: false`
    // のとき、問題のあった部分だけ `<span class="katex-error">` でラップして
    // その他は正しくレンダリングされる。生 LaTeX を剥がしてから返す。
    try {
      const html = katex.renderToString(src, {
        throwOnError: false,
        displayMode,
        trust: KATEX_TRUST,
        strict: "ignore",
        output: "html",
        macros: PROJECT_KATEX_MACROS,
      });
      return { html: sanitizeLenientKatexHtml(html), ok: true };
    } catch {
      return { html: "", ok: false };
    }
  }
}

/**
 * インライン数式チップに入れる「成功時 HTML」または「失敗時プレースホルダ」を返す。
 *
 * 失敗時は **絶対に** 生 LaTeX を露出しない (テンプレ駆動 / 自然言語入力の方針)。
 * 代わりに小さな Σ バッジを置き、tooltip でも raw LaTeX は出さず「クリックで編集」
 * という編集動線だけを案内する。
 */
export function renderInlineMathOrPlaceholder(latex: string): string {
  const { html, ok } = renderMathHTML(latex, { displayMode: false });
  if (ok) {
    return `<span class="math-chip-render" contenteditable="false">${html}</span>`;
  }
  // 失敗時: 生 LaTeX は隠す。Σ バッジ + 「クリックで編集」ヒント。
  return (
    `<span class="math-chip-fallback" contenteditable="false" ` +
    `title="数式 — クリックで編集 (PDF では正しく出ます)" aria-label="数式 (プレビュー不可)">` +
    `<span class="math-chip-fallback-icon" aria-hidden="true">∑</span>` +
    `<span class="math-chip-fallback-label">数式</span>` +
    `</span>`
  );
}

/**
 * 表示数式ブロック用の「成功時 HTML」または「失敗時プレースホルダ」を返す。
 *
 * 失敗時も生 LaTeX を出さない。"プレビュー不可" の控えめなカードだけを返す。
 */
export function renderDisplayMathOrPlaceholder(latex: string): string {
  const { html, ok } = renderMathHTML(latex, { displayMode: true });
  if (ok) {
    return `<span class="display-math-render" contenteditable="false">${html}</span>`;
  }
  return (
    `<span class="display-math-fallback" contenteditable="false" ` +
    `title="数式 — クリックで編集 (PDF では正しく出ます)" aria-label="数式 (プレビュー不可)">` +
    `<span class="display-math-fallback-icon" aria-hidden="true">∑</span>` +
    `<span class="display-math-fallback-label">数式 — クリックで編集</span>` +
    `<span class="display-math-fallback-hint">PDF では正しく出力されます</span>` +
    `</span>`
  );
}
