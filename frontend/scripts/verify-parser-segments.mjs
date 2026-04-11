#!/usr/bin/env node
// For each template in templates.ts, parse its LaTeX and verify the parser
// produces the expected high-level segments (titleBlock, toc, bibliography, etc.).
// This catches runtime errors that tsc can't see.
import { createJiti } from "jiti";

const here = new URL(".", import.meta.url).pathname;
const jiti = createJiti(here, { interopDefault: true });
const tmpl = await jiti.import("../lib/templates.ts");
const seg = await jiti.import("../lib/latex-segments.ts");
const { TEMPLATES, getTemplateLatex } = tmpl;
const { parseLatexToSegments, extractInlines } = seg;

function walk(segs, fn) {
  for (const s of segs) {
    fn(s);
    if (s.children && s.children.length > 0) walk(s.children, fn);
  }
}

let total = 0;
let failed = 0;
for (const locale of ["ja", "en"]) {
  for (const t of TEMPLATES) {
    total++;
    const latex = getTemplateLatex(t.id, locale);
    let segments;
    try {
      segments = parseLatexToSegments(latex);
    } catch (e) {
      console.log(`FAIL ${locale} ${t.id}: parser threw: ${e.message}`);
      failed++;
      continue;
    }
    const kinds = new Set();
    let sawTodayInline = false;
    const checkInlines = (inlines) => {
      for (const inl of inlines ?? []) {
        if (inl.kind === "templateCmd" && inl.meta?.name === "today" && inl.meta?.noarg === "1") {
          sawTodayInline = true;
        }
      }
    };
    walk(segments, (s) => {
      kinds.add(s.kind);
      checkInlines(s.inlines);
      // titleBlock は preamble 上のフィールド range を meta に保持しているので、
      // 各フィールドに対して extractInlines をかけて実際に render 時と同じ結果を得る。
      if (s.kind === "titleBlock" && s.meta) {
        for (const key of ["title", "subtitle", "author", "institute", "date"]) {
          const start = Number(s.meta[`${key}Start`]);
          const end = Number(s.meta[`${key}End`]);
          if (Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start) {
            checkInlines(extractInlines(latex, start, end));
          }
        }
      }
    });

    const hasMaketitle = latex.includes("\\maketitle");
    const hasToc = latex.includes("\\tableofcontents");
    const hasBib = latex.includes("\\begin{thebibliography}");
    const hasToday = latex.includes("\\today");

    const issues = [];
    if (hasMaketitle && !kinds.has("titleBlock")) issues.push("missing titleBlock");
    if (hasToc && !kinds.has("toc")) issues.push("missing toc");
    if (hasBib && !kinds.has("bibliography")) issues.push("missing bibliography");
    if (hasToday && !sawTodayInline) issues.push("\\today not recognized as inline templateCmd");

    if (issues.length > 0) {
      failed++;
      console.log(`FAIL ${locale} ${t.id}: ${issues.join("; ")}`);
    } else {
      console.log(`OK   ${locale} ${t.id.padEnd(22)}  kinds=${[...kinds].sort().join(",")}`);
    }
  }
}

console.log(`\n${total - failed}/${total} passed`);
process.exit(failed ? 1 : 0);
