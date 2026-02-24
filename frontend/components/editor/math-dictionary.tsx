"use client";

import React, { useState, useMemo, useCallback } from "react";
import { MathRenderer } from "./math-editor";
import {
  MATH_DICTIONARY,
  SPACING_PRESETS,
} from "@/lib/math-japanese";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search } from "lucide-react";

// ══════════════════════════════════════════
// 公式テンプレート（辞書に含まれない複合公式）
// ══════════════════════════════════════════

interface FormulaTemplate {
  label: string;
  latex: string;
  japanese: string;
  category: string;
}

const FORMULA_TEMPLATES: FormulaTemplate[] = [
  // 行列
  { label: "2×2行列", latex: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}", japanese: "2×2行列", category: "行列" },
  { label: "3×3行列", latex: "\\begin{pmatrix} a & b & c \\\\ d & e & f \\\\ g & h & i \\end{pmatrix}", japanese: "3×3行列", category: "行列" },
  { label: "角括弧行列", latex: "\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}", japanese: "角括弧行列", category: "行列" },
  { label: "行列式", latex: "\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}", japanese: "行列式", category: "行列" },
  { label: "連立方程式", latex: "\\begin{cases} ax + by = c \\\\ dx + ey = f \\end{cases}", japanese: "れんりつほうていしき", category: "行列" },
  { label: "場合分け", latex: "f(x) = \\begin{cases} a & (x > 0) \\\\ b & (x \\leq 0) \\end{cases}", japanese: "ばあいわけ", category: "行列" },
  { label: "数式揃え", latex: "\\begin{aligned} a &= b + c \\\\ &= d + e \\end{aligned}", japanese: "せいれつすうしき", category: "行列" },
  // 物理公式
  { label: "運動方程式", latex: "F = ma", japanese: "ニュートンの第二法則", category: "物理公式" },
  { label: "質量エネルギー", latex: "E = mc^2", japanese: "しつりょうエネルギー等価", category: "物理公式" },
  { label: "波動方程式", latex: "\\frac{\\partial^2 u}{\\partial t^2} = c^2 \\nabla^2 u", japanese: "はどうほうていしき", category: "物理公式" },
  { label: "シュレーディンガー", latex: "i\\hbar \\frac{\\partial}{\\partial t} \\Psi = \\hat{H} \\Psi", japanese: "シュレーディンガー方程式", category: "物理公式" },
  { label: "マクスウェル", latex: "\\nabla \\times \\vec{E} = -\\frac{\\partial \\vec{B}}{\\partial t}", japanese: "ファラデーの法則", category: "物理公式" },
  { label: "エントロピー", latex: "S = k_B \\ln \\Omega", japanese: "ボルツマンのエントロピー", category: "物理公式" },
  { label: "オイラーの公式", latex: "e^{i\\theta} = \\cos\\theta + i\\sin\\theta", japanese: "オイラーのこうしき", category: "物理公式" },
  // 解析
  { label: "テイラー展開", latex: "f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!}(x-a)^n", japanese: "テイラーてんかい", category: "解析" },
  { label: "フーリエ変換", latex: "\\hat{f}(\\xi) = \\int_{-\\infty}^{\\infty} f(x) e^{-2\\pi i x \\xi} dx", japanese: "フーリエへんかん", category: "解析" },
  { label: "ラプラス変換", latex: "F(s) = \\int_0^{\\infty} f(t) e^{-st} dt", japanese: "ラプラスへんかん", category: "解析" },
  { label: "ガウス積分", latex: "\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}", japanese: "ガウスせきぶん", category: "解析" },
  { label: "コーシー積分", latex: "f(a) = \\frac{1}{2\\pi i} \\oint_C \\frac{f(z)}{z-a} dz", japanese: "コーシーせきぶんこうしき", category: "解析" },
  // 工学
  { label: "伝達関数", latex: "H(s) = \\frac{Y(s)}{X(s)} = \\frac{\\omega_n^2}{s^2 + 2\\zeta\\omega_n s + \\omega_n^2}", japanese: "でんたつかんすう", category: "工学" },
  { label: "オームの法則", latex: "V = IR", japanese: "オームのほうそく", category: "工学" },
  { label: "インピーダンス", latex: "Z = R + j\\omega L + \\frac{1}{j\\omega C}", japanese: "RLCインピーダンス", category: "工学" },
  { label: "離散フーリエ", latex: "X[k] = \\sum_{n=0}^{N-1} x[n] e^{-j2\\pi kn/N}", japanese: "りさんフーリエへんかん", category: "工学" },
  { label: "z変換", latex: "X(z) = \\sum_{n=0}^{\\infty} x[n] z^{-n}", japanese: "zへんかん", category: "工学" },
  { label: "状態方程式", latex: "\\dot{\\mathbf{x}} = A\\mathbf{x} + B\\mathbf{u}", japanese: "じょうたいほうていしき", category: "工学" },
  // 確率統計
  { label: "ベイズの定理", latex: "P(A|B) = \\frac{P(B|A)P(A)}{P(B)}", japanese: "ベイズのていり", category: "確率統計" },
  { label: "正規分布", latex: "f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}", japanese: "せいきぶんぷ", category: "確率統計" },
  { label: "二項分布", latex: "P(X=k) = \\binom{n}{k} p^k (1-p)^{n-k}", japanese: "にこうぶんぷ", category: "確率統計" },
];

// ══════════════════════════════════════════
// 統合辞書コンポーネント
// ══════════════════════════════════════════

// カテゴリリスト (辞書カテゴリ + 公式カテゴリ)
const DICT_CATEGORIES = [
  "すべて",
  "ギリシャ文字",
  "演算",
  "関係",
  "構造",
  "微積分",
  "関数",
  "集合",
  "線形代数",
  "確率統計",
  "環境",
  "特殊",
  "行列",
  "物理公式",
  "解析",
  "工学",
  "スペース",
];

interface MathDictionaryProps {
  onInsert: (latex: string) => void;
  className?: string;
}

export function MathDictionary({ onInsert, className = "" }: MathDictionaryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("すべて");

  // 検索結果
  const filteredItems = useMemo(() => {
    // 辞書エントリを統一型に変換
    type UnifiedItem = {
      key: string;
      latex: string;
      japanese: string;
      description: string;
      category: string;
      isFormula: boolean;
    };

    const dictItems: UnifiedItem[] = MATH_DICTIONARY.map((e, i) => ({
      key: `d-${i}`,
      latex: e.latex.replace(/\{[AB]\}/g, "").replace(/\{N\}/g, ""),
      japanese: e.reading,
      description: e.description,
      category: e.category,
      isFormula: false,
    }));

    const formulaItems: UnifiedItem[] = FORMULA_TEMPLATES.map((f, i) => ({
      key: `f-${i}`,
      latex: f.latex,
      japanese: f.japanese,
      description: f.label,
      category: f.category,
      isFormula: true,
    }));

    const spacingItems: UnifiedItem[] = SPACING_PRESETS.map((s, i) => ({
      key: `s-${i}`,
      latex: s.latex,
      japanese: s.name,
      description: s.description,
      category: "スペース",
      isFormula: false,
    }));

    let all = [...dictItems, ...formulaItems, ...spacingItems];

    // カテゴリフィルタ
    if (activeCategory !== "すべて") {
      all = all.filter((item) => item.category === activeCategory);
    }

    // 検索フィルタ
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      all = all.filter(
        (item) =>
          item.japanese.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.latex.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
      );
    }

    return all;
  }, [searchQuery, activeCategory]);

  const handleInsertItem = useCallback(
    (latex: string) => {
      onInsert(latex);
    },
    [onInsert]
  );

  return (
    <div className={`flex flex-col bg-background border rounded-xl shadow-sm overflow-hidden ${className}`}>
      {/* 検索バー */}
      <div className="px-2 pt-2 pb-1.5">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="検索… (日本語 / LaTeX / 記号)"
            className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-border/60 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 bg-muted/30 outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* カテゴリタブ（横スクロール） */}
      <div className="px-2 pb-1.5 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {DICT_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-2 py-1 rounded-md text-[10px] font-medium whitespace-nowrap transition-all ${
                activeCategory === cat
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 件数 */}
      <div className="px-3 py-0.5 text-[9px] text-muted-foreground/60 border-t border-b border-border/30">
        {filteredItems.length}件
      </div>

      {/* アイテムリスト */}
      <ScrollArea className="h-52">
        <div className="p-1.5 space-y-0.5">
          {filteredItems.map((item) => (
            <button
              key={item.key}
              onClick={() => handleInsertItem(item.latex)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-primary/8 active:bg-primary/15 transition-colors group text-left"
            >
              {/* プレビュー */}
              <div className="w-16 shrink-0 flex justify-center overflow-hidden">
                <MathRenderer
                  latex={item.latex}
                  displayMode={false}
                  className={item.isFormula ? "scale-[0.5] origin-center" : "scale-[0.7] origin-center"}
                />
              </div>
              {/* 情報 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium truncate">{item.japanese}</span>
                  {item.isFormula && (
                    <span className="px-1 py-0 rounded text-[8px] bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                      公式
                    </span>
                  )}
                </div>
                <span className="text-[9px] text-muted-foreground/70 truncate block">{item.description}</span>
              </div>
              {/* LaTeXコード（ホバー表示） */}
              <span className="text-[8px] font-mono text-muted-foreground/40 group-hover:text-muted-foreground/80 truncate max-w-[80px] shrink-0 transition-colors">
                {item.latex.length > 25 ? item.latex.slice(0, 25) + "…" : item.latex}
              </span>
            </button>
          ))}
          {filteredItems.length === 0 && (
            <div className="py-8 text-center text-xs text-muted-foreground/50">
              該当する数式が見つかりません
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
