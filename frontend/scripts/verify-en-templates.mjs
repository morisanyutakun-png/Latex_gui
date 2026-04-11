#!/usr/bin/env node
// Compile every English-locale template with lualatex and report pass/fail.
// Usage: node scripts/verify-en-templates.mjs [--only id1,id2]
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createJiti } from "jiti";

const here = new URL(".", import.meta.url).pathname;
const jiti = createJiti(here, { interopDefault: true });
const tmpl = await jiti.import("../lib/templates.ts");
const { TEMPLATES, getTemplateLatex } = tmpl;

const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const only = onlyArg ? new Set(onlyArg.slice("--only=".length).split(",")) : null;
const locale = process.argv.includes("--ja") ? "ja" : "en";

const results = [];
for (const t of TEMPLATES) {
  if (only && !only.has(t.id)) continue;
  const latex = getTemplateLatex(t.id, locale);
  const dir = mkdtempSync(join(tmpdir(), `tmpl-${t.id}-`));
  const tex = join(dir, "document.tex");
  writeFileSync(tex, latex, "utf8");
  const started = Date.now();
  let ok = false;
  let tail = "";
  try {
    execFileSync(
      "lualatex",
      ["-interaction=nonstopmode", "-halt-on-error", "-file-line-error", "document.tex"],
      { cwd: dir, stdio: ["ignore", "pipe", "pipe"], timeout: 120_000 },
    );
    ok = existsSync(join(dir, "document.pdf"));
  } catch (e) {
    const out = (e.stdout?.toString?.() ?? "") + (e.stderr?.toString?.() ?? "");
    tail = out.split("\n").filter((l) => /error|Error|Undefined|Missing|! /i.test(l)).slice(-8).join("\n");
    if (!tail) tail = out.slice(-1200);
  }
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  results.push({ id: t.id, nameEn: t.nameEn, ok, secs, tail });
  console.log(`${ok ? "OK " : "FAIL"}  ${t.id.padEnd(22)}  ${secs}s  ${t.nameEn}`);
  if (!ok && tail) console.log(tail.replace(/^/gm, "    "));
  rmSync(dir, { recursive: true, force: true });
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
