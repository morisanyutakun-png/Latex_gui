import type { PaperSize } from "@/store/ui-store";

// 注: ui-store は paper-size.ts を runtime import するが、こちらは `import type` のみ。
// TS のタイプ消去により循環参照にはならない (ビルド後は何も残らない)。

// 学会ポスター用の A0〜A2 と、日本で使われる B4 を追加。
// A0 (841×1189mm) は学会発表用、A1/A2 は小型ポスター、B4 はテスト用紙向け。
export const PAPER_OPTIONS: { value: PaperSize; label: string }[] = [
  { value: "a0", label: "A0 (841×1189mm)" },
  { value: "a1", label: "A1 (594×841mm)" },
  { value: "a2", label: "A2 (420×594mm)" },
  { value: "a3", label: "A3" },
  { value: "a4", label: "A4" },
  { value: "b4", label: "B4" },
  { value: "b5", label: "B5" },
  { value: "letter", label: "Letter" },
];

const PAPER_TO_OPTION: Record<PaperSize, string> = {
  a0: "a0paper",
  a1: "a1paper",
  a2: "a2paper",
  a3: "a3paper",
  a4: "a4paper",
  b4: "b4paper",
  b5: "b5paper",
  letter: "letterpaper",
};

const OPTION_TO_PAPER: Record<string, PaperSize> = {
  a0paper: "a0",
  a1paper: "a1",
  a2paper: "a2",
  a3paper: "a3",
  a4paper: "a4",
  b4paper: "b4",
  b5paper: "b5",
  letterpaper: "letter",
};

const PAPER_OPTION_RE =
  /^(a[0-9]paper|b[0-9]paper|letterpaper|legalpaper|executivepaper|ansiapaper|ansibpaper|ansicpaper|ansidpaper|ansiepaper)$/i;

const DOC_CLASS_RE = /\\documentclass\s*(?:\[([^\]]*)\])?\s*\{([^}]+)\}/;

/** beamer / standalone 等、paper option を受け付けない / 意味をなさないクラス。 */
const CLASSES_WITHOUT_PAPER_OPT = new Set(["beamer", "standalone"]);

// ── Physical dimensions (portrait, mm) ────────────────────────────────────
// 学会ポスターなど geometry で paperwidth/paperheight を直接指定する
// テンプレから用紙サイズを復元するための対応表。JIS B を採用 (日本の慣行)。
const PAPER_DIMS_MM: Array<{ size: PaperSize; w: number; h: number }> = [
  { size: "a0",     w: 841, h: 1189 },
  { size: "a1",     w: 594, h: 841  },
  { size: "a2",     w: 420, h: 594  },
  { size: "a3",     w: 297, h: 420  },
  { size: "a4",     w: 210, h: 297  },
  { size: "b4",     w: 257, h: 364  },  // JIS B4
  { size: "b5",     w: 182, h: 257  },  // JIS B5
  { size: "letter", w: 216, h: 279  },
];

const GEOMETRY_RE = /\\usepackage\s*(?:\[([^\]]*)\])?\s*\{geometry\}/;

/** paperwidth/paperheight の数値 (mm) からサイズ名を決める。±3mm の許容。
 *  縦横どちらの向きでも一致を試す (portrait / landscape 両対応)。 */
function matchPaperByDims(widthMm: number, heightMm: number): PaperSize | null {
  const tolerance = 3;
  for (const { size, w, h } of PAPER_DIMS_MM) {
    const portraitMatch =
      Math.abs(widthMm - w) <= tolerance && Math.abs(heightMm - h) <= tolerance;
    const landscapeMatch =
      Math.abs(widthMm - h) <= tolerance && Math.abs(heightMm - w) <= tolerance;
    if (portraitMatch || landscapeMatch) return size;
  }
  return null;
}

/** geometry パッケージの option から paperwidth/paperheight を抜き、サイズ名を推定する。
 *  対応単位: mm / cm / in (それ以外は null)。 */
function paperSizeFromGeometry(latex: string): PaperSize | null {
  const m = latex.match(GEOMETRY_RE);
  if (!m) return null;
  const opts = m[1] ?? "";
  const wm = opts.match(/paperwidth\s*=\s*(\d+(?:\.\d+)?)\s*(mm|cm|in)/i);
  const hm = opts.match(/paperheight\s*=\s*(\d+(?:\.\d+)?)\s*(mm|cm|in)/i);
  if (!wm || !hm) return null;
  const toMm = (v: string, unit: string): number => {
    const n = parseFloat(v);
    const u = unit.toLowerCase();
    return u === "mm" ? n : u === "cm" ? n * 10 : u === "in" ? n * 25.4 : NaN;
  };
  const widthMm = toMm(wm[1], wm[2]);
  const heightMm = toMm(hm[1], hm[2]);
  if (!isFinite(widthMm) || !isFinite(heightMm)) return null;
  return matchPaperByDims(widthMm, heightMm);
}

export function paperSizeToOption(size: PaperSize): string {
  return PAPER_TO_OPTION[size];
}

/** LaTeX ソースから用紙サイズを読み取る。
 *   1. \documentclass[...] の a0paper/b5paper/letterpaper 等を優先
 *   2. 見つからなければ \usepackage[paperwidth=... ,paperheight=...]{geometry} の実寸から推定
 *      (学会ポスター等、geometry で紙サイズを直接指定するテンプレ向け)
 */
export function paperSizeFromLatex(latex: string): PaperSize | null {
  const m = latex.match(DOC_CLASS_RE);
  if (m) {
    const opts = (m[1] ?? "")
      .split(",")
      .map((o) => o.trim().toLowerCase())
      .filter(Boolean);
    for (const o of opts) {
      const hit = OPTION_TO_PAPER[o];
      if (hit) return hit;
    }
  }
  // documentclass 側に paper option が無い場合は geometry の実寸にフォールバック
  return paperSizeFromGeometry(latex);
}

/** `\usepackage[..., paperwidth=..., paperheight=..., ...]{geometry}` 内の
 *  paperwidth / paperheight を指定サイズに書き換える。他の option (margin 等) は保持。
 *  geometry がそもそも無い / paperwidth/paperheight が無い場合は何もしない。 */
function rewriteGeometryPaper(latex: string, size: PaperSize): string {
  const m = latex.match(GEOMETRY_RE);
  if (!m) return latex;
  const opts = m[1] ?? "";
  if (!/paperwidth/.test(opts) || !/paperheight/.test(opts)) return latex;

  const dim = PAPER_DIMS_MM.find((d) => d.size === size);
  if (!dim) return latex;

  const newOpts = opts
    .replace(/paperwidth\s*=\s*\d+(?:\.\d+)?\s*(?:mm|cm|in)/i, `paperwidth=${dim.w}mm`)
    .replace(/paperheight\s*=\s*\d+(?:\.\d+)?\s*(?:mm|cm|in)/i, `paperheight=${dim.h}mm`);

  const replacement = `\\usepackage[${newOpts}]{geometry}`;
  return latex.replace(GEOMETRY_RE, replacement);
}

/**
 * LaTeX ソースを書き換えて、指定の paper size を反映する。
 * 2 経路で紙サイズを変える:
 *   - \documentclass[...] の paper option を差し替え (a4paper → a0paper 等)
 *   - \usepackage[paperwidth=...,paperheight=...]{geometry} があれば実寸も書き換え
 * どちらか一方だけのテンプレでも正しく動く。beamer / standalone は documentclass は触らず、
 * geometry だけ (あれば) 書き換える。
 */
export function applyPaperSizeToLatex(latex: string, size: PaperSize): string {
  let result = latex;

  // (1) geometry の paperwidth/paperheight を書き換え (存在すれば)
  result = rewriteGeometryPaper(result, size);

  // (2) \documentclass の paper option を書き換え (対応クラスのみ)
  const m = result.match(DOC_CLASS_RE);
  if (!m) return result;

  const className = m[2].trim();
  if (CLASSES_WITHOUT_PAPER_OPT.has(className)) return result;

  const targetOption = paperSizeToOption(size);
  const existing = (m[1] ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  const kept = existing.filter((o) => !PAPER_OPTION_RE.test(o));
  if (kept.length === existing.length - 1) {
    const idx = existing.findIndex((o) => PAPER_OPTION_RE.test(o));
    kept.splice(idx, 0, targetOption);
  } else {
    kept.push(targetOption);
  }

  const newOpts = kept.join(",");
  const replacement = `\\documentclass[${newOpts}]{${className}}`;
  return result.replace(DOC_CLASS_RE, replacement);
}
