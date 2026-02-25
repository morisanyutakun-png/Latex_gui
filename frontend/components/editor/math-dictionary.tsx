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

export interface FormulaTemplate {
  label: string;
  latex: string;
  japanese: string;
  category: string;
}

export const FORMULA_TEMPLATES: FormulaTemplate[] = [
  // 行列
  { label: "2×2行列", latex: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}", japanese: "2×2行列", category: "行列" },
  { label: "3×3行列", latex: "\\begin{pmatrix} a & b & c \\\\ d & e & f \\\\ g & h & i \\end{pmatrix}", japanese: "3×3行列", category: "行列" },
  { label: "角括弧行列", latex: "\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}", japanese: "角括弧行列", category: "行列" },
  { label: "行列式", latex: "\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}", japanese: "行列式", category: "行列" },
  { label: "連立方程式", latex: "\\begin{cases} ax + by = c \\\\ dx + ey = f \\end{cases}", japanese: "れんりつほうていしき", category: "行列" },
  { label: "場合分け", latex: "f(x) = \\begin{cases} a & (x > 0) \\\\ b & (x \\leq 0) \\end{cases}", japanese: "ばあいわけ", category: "行列" },
  { label: "数式揃え", latex: "\\begin{aligned} a &= b + c \\\\ &= d + e \\end{aligned}", japanese: "せいれつすうしき", category: "行列" },
  { label: "対角行列", latex: "\\begin{pmatrix} a & 0 & 0 \\\\ 0 & b & 0 \\\\ 0 & 0 & c \\end{pmatrix}", japanese: "たいかくぎょうれつ", category: "行列" },
  { label: "単位行列", latex: "I = \\begin{pmatrix} 1 & 0 & 0 \\\\ 0 & 1 & 0 \\\\ 0 & 0 & 1 \\end{pmatrix}", japanese: "たんいぎょうれつ", category: "行列" },

  // 高校数学公式
  { label: "解の公式", latex: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}", japanese: "解の公式", category: "高校公式" },
  { label: "二項定理", latex: "(a+b)^n = \\sum_{k=0}^{n} \\binom{n}{k} a^{n-k} b^k", japanese: "にこうていり", category: "高校公式" },
  { label: "余弦定理", latex: "c^2 = a^2 + b^2 - 2ab\\cos C", japanese: "よげんていり", category: "高校公式" },
  { label: "正弦定理", latex: "\\frac{a}{\\sin A} = \\frac{b}{\\sin B} = \\frac{c}{\\sin C} = 2R", japanese: "せいげんていり", category: "高校公式" },
  { label: "相加相乗平均", latex: "\\frac{a+b}{2} \\geq \\sqrt{ab} \\quad (a,b \\geq 0)", japanese: "そうかそうじょうへいきん", category: "高校公式" },
  { label: "等差数列の和", latex: "S_n = \\frac{n(a_1 + a_n)}{2} = \\frac{n(2a_1 + (n-1)d)}{2}", japanese: "とうさすうれつのわ", category: "高校公式" },
  { label: "等比数列の和", latex: "S_n = a_1 \\cdot \\frac{1-r^n}{1-r}", japanese: "とうひすうれつのわ", category: "高校公式" },
  { label: "三角関数の基本", latex: "\\sin^2\\theta + \\cos^2\\theta = 1", japanese: "三角関数の基本公式", category: "高校公式" },
  { label: "加法定理 sin", latex: "\\sin(\\alpha \\pm \\beta) = \\sin\\alpha\\cos\\beta \\pm \\cos\\alpha\\sin\\beta", japanese: "かほうていり", category: "高校公式" },
  { label: "加法定理 cos", latex: "\\cos(\\alpha \\pm \\beta) = \\cos\\alpha\\cos\\beta \\mp \\sin\\alpha\\sin\\beta", japanese: "かほうていり cos", category: "高校公式" },

  // 物理公式: 力学
  { label: "運動方程式", latex: "F = ma", japanese: "ニュートンの第二法則", category: "力学公式" },
  { label: "万有引力", latex: "F = G\\frac{m_1 m_2}{r^2}", japanese: "万有引力", category: "力学公式" },
  { label: "運動エネルギー", latex: "K = \\frac{1}{2}mv^2", japanese: "うんどうえねるぎー", category: "力学公式" },
  { label: "力学的エネルギー保存", latex: "\\frac{1}{2}mv_1^2 + mgh_1 = \\frac{1}{2}mv_2^2 + mgh_2", japanese: "エネルギー保存", category: "力学公式" },
  { label: "運動量保存", latex: "m_1 v_1 + m_2 v_2 = m_1 v_1' + m_2 v_2'", japanese: "うんどうりょうほぞん", category: "力学公式" },
  { label: "等加速度運動", latex: "x = v_0 t + \\frac{1}{2}at^2, \\quad v = v_0 + at", japanese: "等加速度直線運動", category: "力学公式" },
  { label: "フックの法則", latex: "F = -kx", japanese: "ばねの法則", category: "力学公式" },
  { label: "単振動", latex: "x(t) = A\\sin(\\omega t + \\phi), \\quad \\omega = \\sqrt{\\frac{k}{m}}", japanese: "単振動", category: "力学公式" },
  { label: "単振り子", latex: "T = 2\\pi\\sqrt{\\frac{l}{g}}", japanese: "たんふりこの周期", category: "力学公式" },
  { label: "角運動量", latex: "\\vec{L} = \\vec{r} \\times \\vec{p} = I\\vec{\\omega}", japanese: "角運動量", category: "力学公式" },

  // 物理公式: 電磁気
  { label: "クーロンの法則", latex: "F = k_e \\frac{q_1 q_2}{r^2}", japanese: "クーロンの法則", category: "電磁気公式" },
  { label: "オームの法則", latex: "V = IR", japanese: "オームのほうそく", category: "電磁気公式" },
  { label: "ガウスの法則", latex: "\\oint \\vec{E} \\cdot d\\vec{A} = \\frac{Q_{\\text{enc}}}{\\varepsilon_0}", japanese: "ガウスの法則", category: "電磁気公式" },
  { label: "ローレンツ力", latex: "\\vec{F} = q(\\vec{E} + \\vec{v} \\times \\vec{B})", japanese: "ローレンツ力", category: "電磁気公式" },
  { label: "ファラデーの法則", latex: "\\mathcal{E} = -\\frac{d\\Phi_B}{dt}", japanese: "電磁誘導の法則", category: "電磁気公式" },
  { label: "マクスウェル(ガウス)", latex: "\\nabla \\cdot \\vec{E} = \\frac{\\rho}{\\varepsilon_0}", japanese: "マクスウェル方程式1", category: "電磁気公式" },
  { label: "マクスウェル(磁気)", latex: "\\nabla \\cdot \\vec{B} = 0", japanese: "マクスウェル方程式2", category: "電磁気公式" },
  { label: "マクスウェル(ファラデー)", latex: "\\nabla \\times \\vec{E} = -\\frac{\\partial \\vec{B}}{\\partial t}", japanese: "マクスウェル方程式3", category: "電磁気公式" },
  { label: "マクスウェル(アンペール)", latex: "\\nabla \\times \\vec{B} = \\mu_0 \\vec{J} + \\mu_0 \\varepsilon_0 \\frac{\\partial \\vec{E}}{\\partial t}", japanese: "マクスウェル方程式4", category: "電磁気公式" },
  { label: "インピーダンス", latex: "Z = R + j\\omega L + \\frac{1}{j\\omega C}", japanese: "RLCインピーダンス", category: "電磁気公式" },

  // 物理公式: 熱力学
  { label: "理想気体", latex: "PV = nRT", japanese: "理想気体の状態方程式", category: "熱力学公式" },
  { label: "熱力学第一法則", latex: "\\Delta U = Q - W", japanese: "熱力学第一法則", category: "熱力学公式" },
  { label: "エントロピー", latex: "S = k_B \\ln \\Omega", japanese: "ボルツマンのエントロピー", category: "熱力学公式" },
  { label: "カルノー効率", latex: "\\eta = 1 - \\frac{T_L}{T_H}", japanese: "カルノー効率", category: "熱力学公式" },

  // 物理公式: 量子・相対論
  { label: "質量エネルギー", latex: "E = mc^2", japanese: "しつりょうエネルギー等価", category: "量子・相対論" },
  { label: "シュレーディンガー", latex: "i\\hbar \\frac{\\partial}{\\partial t} \\Psi = \\hat{H} \\Psi", japanese: "シュレーディンガー方程式", category: "量子・相対論" },
  { label: "不確定性原理", latex: "\\Delta x \\cdot \\Delta p \\geq \\frac{\\hbar}{2}", japanese: "ハイゼンベルクの不確定性原理", category: "量子・相対論" },
  { label: "オイラーの公式", latex: "e^{i\\theta} = \\cos\\theta + i\\sin\\theta", japanese: "オイラーのこうしき", category: "量子・相対論" },
  { label: "ローレンツ因子", latex: "\\gamma = \\frac{1}{\\sqrt{1 - v^2/c^2}}", japanese: "ローレンツ因子", category: "量子・相対論" },
  { label: "ド・ブロイ波長", latex: "\\lambda = \\frac{h}{mv}", japanese: "ドブロイ波長", category: "量子・相対論" },
  { label: "プランクの関係式", latex: "E = h\\nu = \\hbar\\omega", japanese: "光子のエネルギー", category: "量子・相対論" },

  // 解析
  { label: "テイラー展開", latex: "f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!}(x-a)^n", japanese: "テイラーてんかい", category: "解析" },
  { label: "マクローリン展開", latex: "f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(0)}{n!} x^n", japanese: "マクローリンてんかい", category: "解析" },
  { label: "フーリエ変換", latex: "\\hat{f}(\\xi) = \\int_{-\\infty}^{\\infty} f(x) e^{-2\\pi i x \\xi} dx", japanese: "フーリエへんかん", category: "解析" },
  { label: "ラプラス変換", latex: "F(s) = \\int_0^{\\infty} f(t) e^{-st} dt", japanese: "ラプラスへんかん", category: "解析" },
  { label: "ガウス積分", latex: "\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}", japanese: "ガウスせきぶん", category: "解析" },
  { label: "コーシー積分", latex: "f(a) = \\frac{1}{2\\pi i} \\oint_C \\frac{f(z)}{z-a} dz", japanese: "コーシーせきぶんこうしき", category: "解析" },
  { label: "部分積分", latex: "\\int u \\, dv = uv - \\int v \\, du", japanese: "ぶぶんせきぶん", category: "解析" },
  { label: "ストークスの定理", latex: "\\oint_C \\vec{F} \\cdot d\\vec{r} = \\iint_S (\\nabla \\times \\vec{F}) \\cdot d\\vec{S}", japanese: "ストークスの定理", category: "解析" },
  { label: "ガウスの発散定理", latex: "\\iiint_V \\nabla \\cdot \\vec{F} \\, dV = \\oiint_S \\vec{F} \\cdot d\\vec{S}", japanese: "発散定理", category: "解析" },

  // 工学
  { label: "伝達関数", latex: "H(s) = \\frac{Y(s)}{X(s)} = \\frac{\\omega_n^2}{s^2 + 2\\zeta\\omega_n s + \\omega_n^2}", japanese: "でんたつかんすう", category: "工学" },
  { label: "離散フーリエ", latex: "X[k] = \\sum_{n=0}^{N-1} x[n] e^{-j2\\pi kn/N}", japanese: "りさんフーリエへんかん", category: "工学" },
  { label: "z変換", latex: "X(z) = \\sum_{n=0}^{\\infty} x[n] z^{-n}", japanese: "zへんかん", category: "工学" },
  { label: "状態方程式", latex: "\\dot{\\mathbf{x}} = A\\mathbf{x} + B\\mathbf{u}", japanese: "じょうたいほうていしき", category: "工学" },

  // 確率統計
  { label: "ベイズの定理", latex: "P(A|B) = \\frac{P(B|A)P(A)}{P(B)}", japanese: "ベイズのていり", category: "確率統計" },
  { label: "正規分布", latex: "f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}", japanese: "せいきぶんぷ", category: "確率統計" },
  { label: "二項分布", latex: "P(X=k) = \\binom{n}{k} p^k (1-p)^{n-k}", japanese: "にこうぶんぷ", category: "確率統計" },
  { label: "ポアソン分布", latex: "P(X=k) = \\frac{\\lambda^k e^{-\\lambda}}{k!}", japanese: "ポアソン分布", category: "確率統計" },
];

// ══════════════════════════════════════════
// 統合辞書コンポーネント
// ══════════════════════════════════════════

// カテゴリリスト (辞書カテゴリ + 公式カテゴリ)
const DICT_CATEGORIES = [
  "すべて",
  // 基本記号
  "ギリシャ文字",
  "演算",
  "関係",
  "構造",
  "括弧",
  // 高校数学
  "高校数学",
  "三角関数",
  "数列",
  "指数対数",
  "ベクトル",
  // 大学数学
  "微積分",
  "微分公式",
  "積分公式",
  "関数",
  "集合",
  "線形代数",
  "多変数解析",
  "微分方程式",
  "複素数",
  "確率統計",
  "環境",
  "特殊",
  // 物理
  "力学",
  "波動",
  "電磁気学",
  "熱力学",
  "光学",
  "量子力学",
  "相対論",
  // 公式テンプレート
  "行列",
  "高校公式",
  "力学公式",
  "電磁気公式",
  "熱力学公式",
  "量子・相対論",
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
