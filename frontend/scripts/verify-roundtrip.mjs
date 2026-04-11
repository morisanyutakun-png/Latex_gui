#!/usr/bin/env node
// For every template, round-trip every editable inline block through the real
// browser DOM path:
//   extractInlines → buildInlinesHTML → (HTML → DOM) → serializeContentEditableDOM
// Then reinsert into the template source and compile with lualatex.
// Fails loud on any template where the round-trip corrupts the LaTeX in a way
// that breaks compilation.
import { createJiti } from "jiti";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Window } from "happy-dom";

const here = new URL(".", import.meta.url).pathname;
const jiti = createJiti(here, { interopDefault: true });
const tmpl = await jiti.import("../lib/templates.ts");
const seg = await jiti.import("../lib/latex-segments.ts");

// visual-editor.tsx imports "katex/dist/katex.min.css" which jiti can't evaluate.
// Re-implement the minimal DOM→LaTeX walker here, staying in sync with the
// browser one. If these ever diverge, the parser-segment test and the frontend
// tests both catch the drift.
const { TEMPLATES, getTemplateLatex } = tmpl;
const { parseLatexToSegments, extractInlines, replaceRange } = seg;

// --- serialization (must mirror serializeContentEditableDOM in visual-editor.tsx) ---
function serializeDOM(el) {
  let result = "";
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === 3 /* TEXT_NODE */) {
      result += (node.textContent || "").replace(/\u200B/g, "");
      continue;
    }
    if (node.nodeType !== 1 /* ELEMENT_NODE */) continue;
    const child = node;
    const tag = child.tagName.toLowerCase();
    const ds = child.dataset ?? {};

    if (ds.haitenSource) { result += ds.haitenSource; continue; }
    if (ds.mathChip === "1") {
      const body = (ds.source ?? "").trim();
      if (!body) continue;
      const wrapper = ds.wrapper || "dollar";
      result += wrapper === "paren" ? `\\(${body}\\)` : `$${body}$`;
      continue;
    }
    if (ds.ruleWidth) {
      const w = ds.ruleWidth;
      const h = ds.ruleHeight ?? "0.4pt";
      result += `\\rule{${w}}{${h}}`;
      continue;
    }
    if (ds.fboxCmd) {
      result += `\\${ds.fboxCmd}{${serializeDOM(child)}}`;
      continue;
    }
    if (ds.color) {
      result += `\\textcolor{${ds.color}}{${serializeDOM(child)}}`;
      continue;
    }
    if (ds.sizedSize !== undefined || ds.sizedWeight !== undefined || ds.sizedShape !== undefined) {
      const parts = [];
      if (ds.sizedSize) parts.push(`\\${ds.sizedSize}`);
      if (ds.sizedWeight === "bold") parts.push(`\\bfseries`);
      if (ds.sizedShape === "italic") parts.push(`\\itshape`);
      const prefix = parts.join("");
      result += `{${prefix}${prefix ? " " : ""}${serializeDOM(child)}}`;
      continue;
    }
    if (ds.latexLinebreak === "1") { result += `\\\\`; continue; }
    if (ds.cmdName) {
      const name = ds.cmdName;
      if (ds.cmdNoarg === "1") { result += `\\${name}`; continue; }
      const arg1El = child.querySelector(":scope > .latex-tcmd-arg1");
      const arg2El = child.querySelector(":scope > .latex-tcmd-arg2");
      if (arg1El && arg2El) {
        const a1 = (arg1El.textContent || "").trim();
        const a2 = (arg2El.textContent || "").trim();
        result += `\\${name}{${a1}}{${a2}}`;
      } else {
        const arg1Attr = ds.cmdArg1;
        if (arg1Attr !== undefined) result += `\\${name}{${arg1Attr}}`;
        else result += `\\${name}{${(child.textContent || "").trim()}}`;
      }
      continue;
    }
    if (tag === "strong" || tag === "b") { result += `\\textbf{${child.textContent || ""}}`; continue; }
    if (tag === "em" || tag === "i") { result += `\\textit{${child.textContent || ""}}`; continue; }
    if (tag === "code") { result += `\\texttt{${child.textContent || ""}}`; continue; }
    if (tag === "br") { result += "\n"; continue; }
    result += serializeDOM(child);
  }
  return result.replace(/\u00A0/g, " ");
}

// --- build HTML (must mirror buildInlinesHTML in visual-editor.tsx) ---
function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function mathChipHTML(source, wrapper) {
  return `<span data-math-chip="1" data-wrapper="${wrapper}" data-source="${escHtml(source)}" contenteditable="false">math</span>`;
}

function buildHTML(inlines, src) {
  let html = "";
  for (const inline of inlines) {
    const k = inline.kind;
    if (k === "text") { html += escHtml(inline.body); continue; }
    if (k === "inlineMath") { html += mathChipHTML(inline.body, "dollar"); continue; }
    if (k === "bold") { html += `<strong>${escHtml(inline.body)}</strong>`; continue; }
    if (k === "italic") { html += `<em>${escHtml(inline.body)}</em>`; continue; }
    if (k === "code") { html += `<code>${escHtml(inline.body)}</code>`; continue; }
    if (k === "scoreBadge") {
      const orig = src.slice(inline.range.start, inline.range.end);
      html += `<span data-haiten-source="${escHtml(orig)}">${escHtml(inline.body)}</span>`;
      continue;
    }
    if (k === "linebreak") { html += `<br data-latex-linebreak="1"/>`; continue; }
    if (k === "rule") {
      const w = inline.meta?.width ?? "1em";
      const h = inline.meta?.height ?? "0.4pt";
      html += `<span data-rule-width="${escHtml(w)}" data-rule-height="${escHtml(h)}">&nbsp;</span>`;
      continue;
    }
    if (k === "framed") {
      const cmd = inline.meta?.cmd ?? "fbox";
      html += `<span data-fbox-cmd="${escHtml(cmd)}">${buildRichHTML(inline.body)}</span>`;
      continue;
    }
    if (k === "colored") {
      const color = inline.meta?.color ?? "inherit";
      html += `<span data-color="${escHtml(color)}">${buildRichHTML(inline.body)}</span>`;
      continue;
    }
    if (k === "sized") {
      const meta = inline.meta ?? {};
      const attrs = Object.entries(meta).map(([k, v]) => `data-sized-${k}="${escHtml(v)}"`).join(" ");
      html += `<span ${attrs}>${buildRichHTML(inline.body)}</span>`;
      continue;
    }
    if (k === "templateCmd") {
      const name = inline.meta?.name ?? "text";
      const arg2 = inline.meta?.arg2;
      const noarg = inline.meta?.noarg === "1";
      if (noarg) {
        html += `<span data-cmd-name="${escHtml(name)}" data-cmd-noarg="1">${escHtml(inline.body)}</span>`;
        continue;
      }
      if (arg2 !== undefined) {
        html += `<span data-cmd-name="${escHtml(name)}" data-cmd-arg2="${escHtml(arg2)}"><span class="latex-tcmd-arg1">${buildRichHTML(inline.body)}</span><span class="latex-tcmd-arg2">${buildRichHTML(arg2)}</span></span>`;
      } else {
        html += `<span data-cmd-name="${escHtml(name)}">${buildRichHTML(inline.body)}</span>`;
      }
    }
  }
  return html;
}

function buildRichHTML(body) {
  if (!body) return "";
  let s = body;
  // $..$ chips
  const parts = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === "$" && s[i + 1] !== "$") {
      let j = i + 1;
      while (j < s.length) {
        if (s[j] === "\\" && j + 1 < s.length) { j += 2; continue; }
        if (s[j] === "$") break;
        j++;
      }
      if (j < s.length && s[j] === "$") {
        parts.push(mathChipHTML(s.slice(i + 1, j), "dollar"));
        i = j + 1;
        continue;
      }
    }
    parts.push(escHtml(s[i]));
    i++;
  }
  return parts.join("");
}

// --- roundtrip runner ---
function roundtripSegment(window, segment, latex) {
  const bodyStart = Number(segment.meta?.bodyStart);
  const bodyEnd = Number(segment.meta?.bodyEnd);
  const hasBodyRange = Number.isFinite(bodyStart) && Number.isFinite(bodyEnd);
  const range = hasBodyRange ? { start: bodyStart, end: bodyEnd } : segment.range;
  const inlines = segment.inlines ?? extractInlines(latex, range.start, range.end);
  const html = buildHTML(inlines, latex);
  const div = window.document.createElement("div");
  div.innerHTML = html;
  const serialized = serializeDOM(div);
  return { range, serialized, original: latex.slice(range.start, range.end) };
}

function walk(segs, fn, latex) {
  for (const s of segs) {
    fn(s, latex);
    if (s.children && s.children.length > 0) walk(s.children, fn, latex);
  }
}

const window = new Window();
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const only = onlyArg ? new Set(onlyArg.slice("--only=".length).split(",")) : null;
const locale = process.argv.includes("--ja") ? "ja" : "en";

let total = 0, fail = 0;
for (const t of TEMPLATES) {
  if (only && !only.has(t.id)) continue;
  total++;
  const latex = getTemplateLatex(t.id, locale);
  const segments = parseLatexToSegments(latex);
  // Apply a no-op roundtrip to every paragraph / item segment
  const edits = [];
  walk(segments, (s) => {
    if (s.kind !== "paragraph" && s.kind !== "item") return;
    const rt = roundtripSegment(window, s, latex);
    if (rt.serialized.trim() !== rt.original.trim()) {
      edits.push(rt);
    }
  });

  // Apply all diff edits to the source (back-to-front to keep ranges valid)
  let patched = latex;
  edits.sort((a, b) => b.range.start - a.range.start);
  for (const e of edits) {
    patched = replaceRange(patched, e.range, e.serialized);
  }

  // Compile the patched source
  const dir = mkdtempSync(join(tmpdir(), `rt-${t.id}-`));
  const tex = join(dir, "document.tex");
  writeFileSync(tex, patched, "utf8");
  let ok = false;
  let tail = "";
  try {
    execFileSync("lualatex", ["-interaction=nonstopmode", "-halt-on-error", "-file-line-error", "document.tex"], {
      cwd: dir, stdio: ["ignore", "pipe", "pipe"], timeout: 120_000,
    });
    ok = existsSync(join(dir, "document.pdf"));
  } catch (e) {
    const out = (e.stdout?.toString?.() ?? "") + (e.stderr?.toString?.() ?? "");
    tail = out.split("\n").filter((l) => /error|Error|! /i.test(l)).slice(-10).join("\n");
  }

  console.log(`${ok ? "OK " : "FAIL"}  ${locale} ${t.id.padEnd(22)}  edits=${edits.length}`);
  if (!ok) {
    fail++;
    // Show one sample diff to help debugging
    if (edits.length > 0) {
      const e = edits[0];
      console.log("  first diff:");
      console.log("    original :", JSON.stringify(e.original.slice(0, 200)));
      console.log("    round-trip:", JSON.stringify(e.serialized.slice(0, 200)));
    }
    if (tail) console.log(tail.replace(/^/gm, "    "));
    // Dump patched source for offline inspection
    const keep = join("/tmp", `rt-broken-${locale}-${t.id}.tex`);
    writeFileSync(keep, patched, "utf8");
    console.log(`  → patched source saved to ${keep}`);
  }
  rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${total - fail}/${total} passed`);
process.exit(fail ? 1 : 0);
