"use client";

import React, { useState } from "react";
import { MathRenderer } from "./math-editor";
import { Sigma, BookOpen, Keyboard, ChevronDown, ChevronRight } from "lucide-react";

const INLINE_SYNTAX = [
  { input: "ルートx",         output: "\\sqrt{x}",            latex: "\\sqrt{x}" },
  { input: "a/b",             output: "\\frac{a}{b}",          latex: "\\frac{a}{b}" },
  { input: "xの2乗",          output: "x^{2}",                 latex: "x^{2}" },
  { input: "x_n",             output: "x_{n}",                 latex: "x_{n}" },
  { input: "2分の1",          output: "\\frac{1}{2}",          latex: "\\frac{1}{2}" },
  { input: "0からπまで積分",  output: "\\int_0^{\\pi}",        latex: "\\int_0^{\\pi}" },
  { input: "i=1からnまで総和", output: "\\sum_{i=1}^{n}",      latex: "\\sum_{i=1}^{n}" },
  { input: "sin(x)",          output: "\\sin(x)",              latex: "\\sin(x)" },
  { input: "かっこa+b",       output: "\\left(a+b\\right)",    latex: "\\left(a+b\\right)" },
  { input: "絶対値x",         output: "\\left|x\\right|",      latex: "\\left|x\\right|" },
];

const SYMBOL_GROUPS = [
  {
    label: "ギリシャ文字",
    color: "text-violet-500",
    items: [
      { sym: "α", latex: "\\alpha" }, { sym: "β", latex: "\\beta" }, { sym: "γ", latex: "\\gamma" },
      { sym: "δ", latex: "\\delta" }, { sym: "θ", latex: "\\theta" }, { sym: "λ", latex: "\\lambda" },
      { sym: "μ", latex: "\\mu" },   { sym: "π", latex: "\\pi" },   { sym: "σ", latex: "\\sigma" },
      { sym: "φ", latex: "\\phi" },  { sym: "ω", latex: "\\omega" }, { sym: "Σ", latex: "\\Sigma" },
      { sym: "Δ", latex: "\\Delta" }, { sym: "Ω", latex: "\\Omega" }, { sym: "Λ", latex: "\\Lambda" },
    ],
  },
  {
    label: "演算・関係",
    color: "text-blue-500",
    items: [
      { sym: "×", latex: "\\times" }, { sym: "÷", latex: "\\div" }, { sym: "±", latex: "\\pm" },
      { sym: "≤", latex: "\\leq" },   { sym: "≥", latex: "\\geq" }, { sym: "≠", latex: "\\neq" },
      { sym: "≈", latex: "\\approx" }, { sym: "∝", latex: "\\propto" }, { sym: "∈", latex: "\\in" },
      { sym: "⊂", latex: "\\subset" }, { sym: "∪", latex: "\\cup" }, { sym: "∩", latex: "\\cap" },
    ],
  },
  {
    label: "矢印・その他",
    color: "text-emerald-500",
    items: [
      { sym: "→", latex: "\\to" }, { sym: "⇒", latex: "\\Rightarrow" }, { sym: "↔", latex: "\\leftrightarrow" },
      { sym: "∞", latex: "\\infty" }, { sym: "∂", latex: "\\partial" }, { sym: "∇", latex: "\\nabla" },
      { sym: "∀", latex: "\\forall" }, { sym: "∃", latex: "\\exists" }, { sym: "∅", latex: "\\emptyset" },
    ],
  },
];

const FORMULA_EXAMPLES = [
  { label: "二次方程式の解", latex: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}" },
  { label: "オイラーの公式", latex: "e^{i\\theta} = \\cos\\theta + i\\sin\\theta" },
  { label: "定積分", latex: "\\int_a^b f(x)\\,dx = F(b) - F(a)" },
  { label: "テイラー展開", latex: "f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!}(x-a)^n" },
  { label: "ガウス積分", latex: "\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}" },
  { label: "行列式 2×2", latex: "\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix} = ad - bc" },
];

function SectionHeader({ icon: Icon, label, color }: { icon: React.ElementType; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className={`h-3.5 w-3.5 ${color} shrink-0`} />
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{label}</span>
    </div>
  );
}

function CollapsibleGroup({ label, color, children }: { label: string; color: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        className="flex items-center gap-1.5 w-full mb-2 group"
        onClick={() => setOpen((v) => !v)}
      >
        {open
          ? <ChevronDown className="h-3 w-3 text-muted-foreground/40" />
          : <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
        <span className={`text-[10px] font-medium ${color}`}>{label}</span>
      </button>
      {open && children}
    </div>
  );
}

export function MathReferencePanel() {
  return (
    <div className="flex flex-col gap-5 p-4 text-sm">
      {/* 入力構文 */}
      <section>
        <SectionHeader icon={Keyboard} label="日本語入力構文" color="text-violet-500" />
        <p className="text-[11px] text-muted-foreground/50 mb-3 leading-relaxed">
          テキスト内で <span className="font-mono bg-violet-100 dark:bg-violet-900/30 px-1 rounded text-violet-600 dark:text-violet-300">$</span> で囲んで数式を入力。日本語で以下の変換が使えます。
        </p>
        <div className="space-y-1.5">
          {INLINE_SYNTAX.map((row, i) => (
            <div key={i} className="flex items-center gap-2 py-1 border-b border-border/10 last:border-0">
              <code className="text-[10px] font-mono text-sky-600 dark:text-sky-400 w-36 shrink-0 leading-tight">{row.input}</code>
              <div className="flex-1 flex justify-end">
                <MathRenderer latex={row.latex} displayMode={false} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="h-px bg-border/20" />

      {/* クイック記号 */}
      <section>
        <SectionHeader icon={Sigma} label="記号リファレンス" color="text-violet-500" />
        <div className="space-y-4">
          {SYMBOL_GROUPS.map((group) => (
            <CollapsibleGroup key={group.label} label={group.label} color={group.color}>
              <div className="flex flex-wrap gap-1.5">
                {group.items.map((item) => (
                  <div
                    key={item.latex}
                    className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg bg-muted/30 border border-border/20 hover:bg-muted/60 transition-colors cursor-default min-w-[36px]"
                    title={item.latex}
                  >
                    <MathRenderer latex={item.latex} displayMode={false} />
                    <span className="text-[8px] font-mono text-muted-foreground/40 leading-none">{item.sym}</span>
                  </div>
                ))}
              </div>
            </CollapsibleGroup>
          ))}
        </div>
      </section>

      <div className="h-px bg-border/20" />

      {/* よく使う数式 */}
      <section>
        <SectionHeader icon={BookOpen} label="よく使う数式" color="text-violet-500" />
        <div className="space-y-3">
          {FORMULA_EXAMPLES.map((f) => (
            <div key={f.label} className="group rounded-lg border border-border/20 bg-muted/15 hover:bg-muted/30 transition-colors overflow-hidden">
              <div className="px-3 pt-2 pb-1">
                <span className="text-[10px] text-muted-foreground/50 font-medium">{f.label}</span>
              </div>
              <div className="px-3 pb-2 flex justify-center overflow-x-auto">
                <MathRenderer latex={f.latex} displayMode={true} />
              </div>
              <div className="px-3 pb-2">
                <code className="text-[9px] font-mono text-muted-foreground/30 break-all">{f.latex}</code>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
