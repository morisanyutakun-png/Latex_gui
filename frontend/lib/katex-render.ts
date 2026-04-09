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
  // よく使う環境の代用 (KaTeX が知らない環境を text として描く場合の安全弁ではないが、
  // \begin{align*} 等は KaTeX が標準対応しているのでここでは特に何もしない)
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

/**
 * KaTeX に投げて HTML を返す。
 * 失敗時は ok=false を返すが、html は空文字にしておく
 * (呼び元で「[数式]」プレースホルダを差し込むため)。
 *
 * `throwOnError: true` にしてあるのは、`false` だと KaTeX が
 * `<span class="katex-error">SOURCE</span>` を返してしまい
 * **生 LaTeX が画面に出る**ため。throwOnError: true なら例外を catch して
 * こちらで安全なフォールバックを返せる。
 */
export function renderMathHTML(latex: string, opts: RenderMathOptions = {}): RenderMathResult {
  const src = latex.trim();
  if (!src) return { html: "", ok: false };
  try {
    const html = katex.renderToString(src, {
      throwOnError: true,
      displayMode: opts.displayMode ?? false,
      trust: true,
      strict: "ignore",
      output: "html",
      macros: PROJECT_KATEX_MACROS,
    });
    return { html, ok: true };
  } catch {
    return { html: "", ok: false };
  }
}

/**
 * インライン数式チップに入れる「成功時 HTML」または「失敗時プレースホルダ」を返す。
 * 生 LaTeX は絶対に返さない。
 */
export function renderInlineMathOrPlaceholder(latex: string): string {
  const { html, ok } = renderMathHTML(latex, { displayMode: false });
  if (ok) {
    return `<span class="math-chip-render" contenteditable="false">${html}</span>`;
  }
  return `<span class="math-chip-placeholder" contenteditable="false" aria-label="math expression">\u2329 math \u232A</span>`;
}

/**
 * 表示数式ブロック用の「成功時 HTML」または「失敗時プレースホルダ」を返す。
 */
export function renderDisplayMathOrPlaceholder(latex: string): string {
  const { html, ok } = renderMathHTML(latex, { displayMode: true });
  if (ok) {
    return `<span class="display-math-render" contenteditable="false">${html}</span>`;
  }
  return `<span class="display-math-placeholder" contenteditable="false" aria-label="display math">\u2329 math expression \u232A</span>`;
}
