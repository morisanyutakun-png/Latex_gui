"use client";

import React, { useState } from "react";
import { MathRenderer } from "./math-editor";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface MathSymbol {
  label: string;
  latex: string;
  description: string;
}

interface MathTemplate {
  label: string;
  latex: string;
  description: string;
  cursorOffset?: number; // how many chars from end to place cursor
}

// ──── Symbol Categories ────

const GREEK_LETTERS: MathSymbol[] = [
  { label: "α", latex: "\\alpha", description: "アルファ" },
  { label: "β", latex: "\\beta", description: "ベータ" },
  { label: "γ", latex: "\\gamma", description: "ガンマ" },
  { label: "δ", latex: "\\delta", description: "デルタ" },
  { label: "ε", latex: "\\epsilon", description: "イプシロン" },
  { label: "ζ", latex: "\\zeta", description: "ゼータ" },
  { label: "η", latex: "\\eta", description: "イータ" },
  { label: "θ", latex: "\\theta", description: "シータ" },
  { label: "ι", latex: "\\iota", description: "イオタ" },
  { label: "κ", latex: "\\kappa", description: "カッパ" },
  { label: "λ", latex: "\\lambda", description: "ラムダ" },
  { label: "μ", latex: "\\mu", description: "ミュー" },
  { label: "ν", latex: "\\nu", description: "ニュー" },
  { label: "ξ", latex: "\\xi", description: "クサイ" },
  { label: "π", latex: "\\pi", description: "パイ" },
  { label: "ρ", latex: "\\rho", description: "ロー" },
  { label: "σ", latex: "\\sigma", description: "シグマ" },
  { label: "τ", latex: "\\tau", description: "タウ" },
  { label: "φ", latex: "\\phi", description: "ファイ" },
  { label: "χ", latex: "\\chi", description: "カイ" },
  { label: "ψ", latex: "\\psi", description: "プサイ" },
  { label: "ω", latex: "\\omega", description: "オメガ" },
  { label: "Γ", latex: "\\Gamma", description: "大文字ガンマ" },
  { label: "Δ", latex: "\\Delta", description: "大文字デルタ" },
  { label: "Θ", latex: "\\Theta", description: "大文字シータ" },
  { label: "Λ", latex: "\\Lambda", description: "大文字ラムダ" },
  { label: "Σ", latex: "\\Sigma", description: "大文字シグマ" },
  { label: "Φ", latex: "\\Phi", description: "大文字ファイ" },
  { label: "Ψ", latex: "\\Psi", description: "大文字プサイ" },
  { label: "Ω", latex: "\\Omega", description: "大文字オメガ" },
];

const OPERATORS: MathSymbol[] = [
  { label: "±", latex: "\\pm", description: "プラスマイナス" },
  { label: "∓", latex: "\\mp", description: "マイナスプラス" },
  { label: "×", latex: "\\times", description: "掛ける" },
  { label: "÷", latex: "\\div", description: "割る" },
  { label: "·", latex: "\\cdot", description: "中点" },
  { label: "∘", latex: "\\circ", description: "合成" },
  { label: "≤", latex: "\\leq", description: "小なりイコール" },
  { label: "≥", latex: "\\geq", description: "大なりイコール" },
  { label: "≠", latex: "\\neq", description: "等しくない" },
  { label: "≈", latex: "\\approx", description: "近似" },
  { label: "≡", latex: "\\equiv", description: "合同" },
  { label: "∝", latex: "\\propto", description: "比例" },
  { label: "∈", latex: "\\in", description: "属する" },
  { label: "∉", latex: "\\notin", description: "属さない" },
  { label: "⊂", latex: "\\subset", description: "部分集合" },
  { label: "⊃", latex: "\\supset", description: "上位集合" },
  { label: "∪", latex: "\\cup", description: "和集合" },
  { label: "∩", latex: "\\cap", description: "共通集合" },
  { label: "∧", latex: "\\wedge", description: "論理積" },
  { label: "∨", latex: "\\vee", description: "論理和" },
  { label: "¬", latex: "\\neg", description: "否定" },
  { label: "→", latex: "\\to", description: "矢印" },
  { label: "⇒", latex: "\\Rightarrow", description: "ならば" },
  { label: "⇔", latex: "\\Leftrightarrow", description: "同値" },
  { label: "∀", latex: "\\forall", description: "任意の" },
  { label: "∃", latex: "\\exists", description: "存在する" },
  { label: "∞", latex: "\\infty", description: "無限大" },
  { label: "∂", latex: "\\partial", description: "偏微分" },
  { label: "∇", latex: "\\nabla", description: "ナブラ" },
  { label: "ℏ", latex: "\\hbar", description: "ディラック定数" },
];

const STRUCTURES: MathTemplate[] = [
  { label: "分数", latex: "\\frac{a}{b}", description: "分数 a/b", cursorOffset: 4 },
  { label: "上付き", latex: "x^{n}", description: "累乗 x^n", cursorOffset: 1 },
  { label: "下付き", latex: "x_{i}", description: "添字 x_i", cursorOffset: 1 },
  { label: "平方根", latex: "\\sqrt{x}", description: "平方根", cursorOffset: 1 },
  { label: "n乗根", latex: "\\sqrt[n]{x}", description: "n乗根", cursorOffset: 1 },
  { label: "総和", latex: "\\sum_{i=1}^{n}", description: "総和 Σ", cursorOffset: 0 },
  { label: "積分", latex: "\\int_{a}^{b}", description: "定積分", cursorOffset: 0 },
  { label: "二重積分", latex: "\\iint_{D}", description: "二重積分", cursorOffset: 0 },
  { label: "極限", latex: "\\lim_{x \\to a}", description: "極限", cursorOffset: 0 },
  { label: "微分", latex: "\\frac{d}{dx}", description: "微分 d/dx", cursorOffset: 0 },
  { label: "偏微分", latex: "\\frac{\\partial}{\\partial x}", description: "偏微分", cursorOffset: 0 },
  { label: "ベクトル", latex: "\\vec{a}", description: "ベクトル", cursorOffset: 1 },
  { label: "ハット", latex: "\\hat{a}", description: "ハット記号", cursorOffset: 1 },
  { label: "バー", latex: "\\bar{x}", description: "上線", cursorOffset: 1 },
  { label: "ドット", latex: "\\dot{x}", description: "時間微分", cursorOffset: 1 },
  { label: "括弧大", latex: "\\left( \\right)", description: "自動サイズ括弧", cursorOffset: 8 },
  { label: "絶対値", latex: "\\left| \\right|", description: "絶対値", cursorOffset: 8 },
  { label: "ノルム", latex: "\\left\\| \\right\\|", description: "ノルム", cursorOffset: 9 },
];

const MATRICES: MathTemplate[] = [
  { label: "2×2行列", latex: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}", description: "2×2丸括弧行列" },
  { label: "3×3行列", latex: "\\begin{pmatrix} a & b & c \\\\ d & e & f \\\\ g & h & i \\end{pmatrix}", description: "3×3丸括弧行列" },
  { label: "角行列", latex: "\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}", description: "2×2角括弧行列" },
  { label: "行列式", latex: "\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}", description: "2×2行列式" },
  { label: "連立方程式", latex: "\\begin{cases} ax + by = c \\\\ dx + ey = f \\end{cases}", description: "連立方程式" },
  { label: "場合分け", latex: "f(x) = \\begin{cases} a & (x > 0) \\\\ b & (x \\leq 0) \\end{cases}", description: "条件分岐" },
  { label: "数式揃え", latex: "\\begin{aligned} a &= b + c \\\\ &= d + e \\end{aligned}", description: "aligned環境" },
];

const PHYSICS: MathTemplate[] = [
  { label: "運動方程式", latex: "F = ma", description: "ニュートンの第二法則" },
  { label: "エネルギー", latex: "E = mc^2", description: "質量エネルギー等価" },
  { label: "波動方程式", latex: "\\frac{\\partial^2 u}{\\partial t^2} = c^2 \\nabla^2 u", description: "波動方程式" },
  { label: "シュレーディンガー", latex: "i\\hbar \\frac{\\partial}{\\partial t} \\Psi = \\hat{H} \\Psi", description: "シュレーディンガー方程式" },
  { label: "マクスウェル", latex: "\\nabla \\times \\vec{E} = -\\frac{\\partial \\vec{B}}{\\partial t}", description: "ファラデーの法則" },
  { label: "熱力学第一", latex: "dU = \\delta Q - \\delta W", description: "熱力学第一法則" },
  { label: "エントロピー", latex: "S = k_B \\ln \\Omega", description: "ボルツマンのエントロピー" },
  { label: "オイラー", latex: "e^{i\\theta} = \\cos\\theta + i\\sin\\theta", description: "オイラーの公式" },
  { label: "フーリエ変換", latex: "\\hat{f}(\\xi) = \\int_{-\\infty}^{\\infty} f(x) e^{-2\\pi i x \\xi} dx", description: "フーリエ変換" },
  { label: "ラプラス変換", latex: "F(s) = \\int_0^{\\infty} f(t) e^{-st} dt", description: "ラプラス変換" },
  { label: "テイラー展開", latex: "f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!}(x-a)^n", description: "テイラー展開" },
  { label: "ガウス積分", latex: "\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}", description: "ガウス積分" },
];

const ENGINEERING: MathTemplate[] = [
  { label: "伝達関数", latex: "H(s) = \\frac{Y(s)}{X(s)} = \\frac{\\omega_n^2}{s^2 + 2\\zeta\\omega_n s + \\omega_n^2}", description: "2次系伝達関数" },
  { label: "オームの法則", latex: "V = IR", description: "オームの法則" },
  { label: "インピーダンス", latex: "Z = R + j\\omega L + \\frac{1}{j\\omega C}", description: "RLCインピーダンス" },
  { label: "dB変換", latex: "G_{dB} = 20 \\log_{10} \\left| H(j\\omega) \\right|", description: "デシベル変換" },
  { label: "ナイキスト", latex: "N = Z - P", description: "ナイキストの安定判別法" },
  { label: "離散フーリエ", latex: "X[k] = \\sum_{n=0}^{N-1} x[n] e^{-j2\\pi kn/N}", description: "DFT" },
  { label: "z変換", latex: "X(z) = \\sum_{n=0}^{\\infty} x[n] z^{-n}", description: "z変換" },
  { label: "状態方程式", latex: "\\dot{\\mathbf{x}} = A\\mathbf{x} + B\\mathbf{u}", description: "状態方程式" },
  { label: "出力方程式", latex: "\\mathbf{y} = C\\mathbf{x} + D\\mathbf{u}", description: "出力方程式" },
];

// ──── Component ────

interface MathPaletteProps {
  onInsert: (latex: string) => void;
  className?: string;
}

export function MathPalette({ onInsert, className = "" }: MathPaletteProps) {
  const [activeTab, setActiveTab] = useState("structures");

  const SymbolGrid = ({ items, cols = 6 }: { items: MathSymbol[]; cols?: number }) => (
    <div className={`grid gap-1`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      <TooltipProvider delayDuration={200}>
        {items.map((sym, i) => (
          <Tooltip key={i}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onInsert(sym.latex)}
                className="flex items-center justify-center h-8 rounded-md hover:bg-primary/10 active:bg-primary/20 transition-colors text-sm border border-transparent hover:border-border/50"
              >
                <MathRenderer latex={sym.latex} displayMode={false} className="scale-90" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <p className="font-medium">{sym.description}</p>
              <p className="font-mono text-muted-foreground text-[10px]">{sym.latex}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </TooltipProvider>
    </div>
  );

  const TemplateGrid = ({ items }: { items: MathTemplate[] }) => (
    <div className="grid grid-cols-2 gap-1.5">
      <TooltipProvider delayDuration={200}>
        {items.map((tmpl, i) => (
          <Tooltip key={i}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onInsert(tmpl.latex)}
                className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-primary/10 active:bg-primary/20 transition-colors border border-transparent hover:border-border/50"
              >
                <div className="overflow-hidden max-w-full">
                  <MathRenderer latex={tmpl.latex} displayMode={false} className="scale-[0.7] origin-center" />
                </div>
                <span className="text-[9px] text-muted-foreground leading-none">{tmpl.label}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs max-w-xs">
              <p className="font-medium">{tmpl.description}</p>
              <p className="font-mono text-muted-foreground text-[10px] break-all">{tmpl.latex}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </TooltipProvider>
    </div>
  );

  return (
    <div className={`w-full bg-background border rounded-xl shadow-sm ${className}`}>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="px-2 pt-2 border-b">
          <TabsList className="w-full h-7 bg-muted/50">
            <TabsTrigger value="structures" className="text-[10px] h-5 px-2">構造</TabsTrigger>
            <TabsTrigger value="greek" className="text-[10px] h-5 px-2">ギリシャ</TabsTrigger>
            <TabsTrigger value="operators" className="text-[10px] h-5 px-2">演算子</TabsTrigger>
            <TabsTrigger value="matrices" className="text-[10px] h-5 px-2">行列</TabsTrigger>
            <TabsTrigger value="physics" className="text-[10px] h-5 px-2">物理</TabsTrigger>
            <TabsTrigger value="engineering" className="text-[10px] h-5 px-2">工学</TabsTrigger>
          </TabsList>
        </div>
        <ScrollArea className="h-48 p-2">
          <TabsContent value="structures" className="mt-0">
            <TemplateGrid items={STRUCTURES} />
          </TabsContent>
          <TabsContent value="greek" className="mt-0">
            <SymbolGrid items={GREEK_LETTERS} cols={6} />
          </TabsContent>
          <TabsContent value="operators" className="mt-0">
            <SymbolGrid items={OPERATORS} cols={6} />
          </TabsContent>
          <TabsContent value="matrices" className="mt-0">
            <TemplateGrid items={MATRICES} />
          </TabsContent>
          <TabsContent value="physics" className="mt-0">
            <TemplateGrid items={PHYSICS} />
          </TabsContent>
          <TabsContent value="engineering" className="mt-0">
            <TemplateGrid items={ENGINEERING} />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
