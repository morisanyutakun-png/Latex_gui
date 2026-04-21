import type { PaperSize } from "@/store/ui-store";

// 注: ui-store は paper-size.ts を runtime import するが、こちらは `import type` のみ。
// TS のタイプ消去により循環参照にはならない (ビルド後は何も残らない)。

export const PAPER_OPTIONS: { value: PaperSize; label: string }[] = [
  { value: "a4", label: "A4" },
  { value: "a3", label: "A3" },
  { value: "b5", label: "B5" },
  { value: "letter", label: "Letter" },
];

const PAPER_TO_OPTION: Record<PaperSize, string> = {
  a4: "a4paper",
  a3: "a3paper",
  b5: "b5paper",
  letter: "letterpaper",
};

const OPTION_TO_PAPER: Record<string, PaperSize> = {
  a4paper: "a4",
  a3paper: "a3",
  b5paper: "b5",
  letterpaper: "letter",
};

const PAPER_OPTION_RE =
  /^(a[0-9]paper|b[0-9]paper|letterpaper|legalpaper|executivepaper|ansiapaper|ansibpaper|ansicpaper|ansidpaper|ansiepaper)$/i;

const DOC_CLASS_RE = /\\documentclass\s*(?:\[([^\]]*)\])?\s*\{([^}]+)\}/;

/** beamer / standalone 等、paper option を受け付けない / 意味をなさないクラス。 */
const CLASSES_WITHOUT_PAPER_OPT = new Set(["beamer", "standalone"]);

export function paperSizeToOption(size: PaperSize): string {
  return PAPER_TO_OPTION[size];
}

/** LaTeX ソース中の \documentclass[...] から用紙サイズを読み取る。 */
export function paperSizeFromLatex(latex: string): PaperSize | null {
  const m = latex.match(DOC_CLASS_RE);
  if (!m) return null;
  const opts = (m[1] ?? "")
    .split(",")
    .map((o) => o.trim().toLowerCase())
    .filter(Boolean);
  for (const o of opts) {
    const hit = OPTION_TO_PAPER[o];
    if (hit) return hit;
  }
  return null;
}

/**
 * LaTeX ソースの \documentclass[...] を書き換えて、指定の paper size を反映する。
 * - 既存の a4paper / b5paper / letterpaper 等は削除して新しい option に置換
 * - option が無い場合は 11pt などの後ろに追加
 * - beamer / standalone は何もしない (paper option が意味を持たないため)
 */
export function applyPaperSizeToLatex(latex: string, size: PaperSize): string {
  const m = latex.match(DOC_CLASS_RE);
  if (!m) return latex;

  const className = m[2].trim();
  if (CLASSES_WITHOUT_PAPER_OPT.has(className)) return latex;

  const targetOption = paperSizeToOption(size);
  const existing = (m[1] ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  const kept = existing.filter((o) => !PAPER_OPTION_RE.test(o));
  if (kept.length === existing.length - 1) {
    // 1 件だけ paper option があった → 同じ位置に差し替え (順序を保つ)
    const idx = existing.findIndex((o) => PAPER_OPTION_RE.test(o));
    kept.splice(idx, 0, targetOption);
  } else {
    // 0 件 or 2+ 件 (異常) → 末尾に追加
    kept.push(targetOption);
  }

  const newOpts = kept.join(",");
  const replacement = `\\documentclass[${newOpts}]{${className}}`;
  return latex.replace(DOC_CLASS_RE, replacement);
}
