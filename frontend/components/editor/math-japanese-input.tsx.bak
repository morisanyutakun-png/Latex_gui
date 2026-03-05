"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { MathRenderer } from "./math-editor";
import {
  parseJapanesemath,
  getJapaneseSuggestions,
  MATH_DICTIONARY,
  SPACING_PRESETS,
  LATEX_TRANSLATIONS,
  normalizeForMatch,
  type SpacingPreset,
  type LatexTranslation,
  type MathDictEntry,
} from "@/lib/math-japanese";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, BookOpen, FlaskConical, ChevronDown } from "lucide-react";
import { FORMULA_TEMPLATES, type FormulaTemplate } from "./math-dictionary";

// ══════════════════════════════════════════
// 統合数式入力コンポーネント（日本語 + LaTeX + 辞書検索）
// ══════════════════════════════════════════

interface JapaneseMathInputProps {
  onApply: (latex: string, sourceText: string) => void;
  initialSourceText?: string;
  className?: string;
}

/** 統合候補の型 */
interface UnifiedSuggestion {
  type: "parse" | "dict" | "formula";
  display: string;
  latex: string;
  preview: string;
  category: string;
  reading?: string;
}

export function JapaneseMathInput({ onApply, initialSourceText = "", className = "" }: JapaneseMathInputProps) {
  const [inputText, setInputText] = useState(initialSourceText);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [showDictBrowser, setShowDictBrowser] = useState(true);
  const [dictCategory, setDictCategory] = useState("すべて");
  const [dictSearch, setDictSearch] = useState("");
  const [spacings, setSpacings] = useState<string[]>([]);
  // 辞書/公式選択時にLaTeXを直接保持（入力欄には日本語名を表示）
  const [overrideLatex, setOverrideLatex] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // parseの結果（日本語→LaTeX変換 or LaTeX直書きパススルー）+ スペーシング付加
  // overrideLatexが設定されていれば、パーサーを使わずそちらを使用
  const baseLatex = useMemo(() => {
    if (overrideLatex) return overrideLatex;
    if (inputText.trim()) {
      return parseJapanesemath(inputText);
    }
    return "";
  }, [inputText, overrideLatex]);

  // スペーシングを末尾に付加した最終LaTeX
  const currentLatex = useMemo(() => {
    if (!baseLatex) return "";
    if (spacings.length === 0) return baseLatex;
    return baseLatex + " " + spacings.join(" ");
  }, [baseLatex, spacings]);

  // 反映ハンドラ（Enterで呼ばれる）
  const handleApply = useCallback(() => {
    if (currentLatex.trim()) {
      onApply(currentLatex, inputText);
      setSpacings([]);
      setOverrideLatex(null);
    }
  }, [currentLatex, inputText, onApply]);

  // スペーシングを追加（入力テキストには触れない）
  const addSpacing = useCallback((spacingLatex: string) => {
    setSpacings(prev => [...prev, spacingLatex]);
  }, []);

  // 統合候補生成: Japanese suggestion + 辞書検索を統合
  const suggestions = useMemo((): UnifiedSuggestion[] => {
    if (!inputText.trim()) return [];
    const results: UnifiedSuggestion[] = [];
    const seen = new Set<string>();

    // 1. Japanese math suggestions (reading-based)
    const jpSuggestions = getJapaneseSuggestions(inputText);
    for (const s of jpSuggestions) {
      const key = s.latex;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({
          type: "parse",
          display: `${s.reading} → ${s.category}`,
          latex: s.latex,
          preview: s.preview,
          category: s.category,
          reading: s.reading,
        });
      }
    }

    // 2. Full dictionary search (broader: includes description, LaTeX code match)
    const q = inputText.trim().toLowerCase();
    const normQ = normalizeForMatch(inputText.trim());
    for (const entry of MATH_DICTIONARY) {
      const key = entry.latex;
      if (seen.has(key)) continue;
      const latexLower = entry.latex.toLowerCase();
      const descMatch = entry.description.toLowerCase().includes(q);
      const latexMatch = latexLower.includes(q) || latexLower.includes(normQ);
      const categoryMatch = entry.category.toLowerCase().includes(q);
      if (descMatch || latexMatch || categoryMatch) {
        seen.add(key);
        const preview = entry.latex.replace(/\{[AB]\}/g, "").replace(/\{N\}/g, "");
        results.push({
          type: "dict",
          display: `${entry.reading} — ${entry.description}`,
          latex: entry.kind === "binary" || entry.kind === "unary"
            ? entry.latex.replace(/\{[A-Z]\}/g, "").replace(/_\s*\^/g, "").trim()
            : entry.latex,
          preview,
          category: entry.category,
        });
      }
    }

    // 3. Formula templates search
    for (const f of FORMULA_TEMPLATES) {
      const key = f.latex;
      if (seen.has(key)) continue;
      const labelMatch = f.label.toLowerCase().includes(q);
      const jpMatch = f.japanese.toLowerCase().includes(q) || normalizeForMatch(f.japanese).includes(normQ);
      const latexMatch = f.latex.toLowerCase().includes(q);
      const catMatch = f.category.toLowerCase().includes(q);
      if (labelMatch || jpMatch || latexMatch || catMatch) {
        seen.add(key);
        results.push({
          type: "formula",
          display: `${f.label} — ${f.category}`,
          latex: f.latex,
          preview: f.latex,
          category: f.category,
        });
      }
    }

    return results.slice(0, 12);
  }, [inputText]);

  const acceptSuggestion = useCallback(
    (idx: number) => {
      const s = suggestions[idx];
      if (!s) return;
      if (s.reading) {
        // Japanese suggestion: replace last word with the reading
        const words = inputText.split(/[\s　]+/);
        words[words.length - 1] = s.reading;
        setInputText(words.join(" ") + " ");
        setOverrideLatex(null);
      } else {
        // Dictionary/formula match: 日本語の表示名を入力欄に、LaTeXはオーバーライドで保持
        const displayName = s.type === "formula"
          ? s.display.split(" — ")[0]  // "解の公式 — カテゴリ" → "解の公式"
          : s.display.split(" — ")[0]; // "reading — description" → reading
        setInputText(displayName);
        setOverrideLatex(s.latex);
      }
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [suggestions, inputText]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length > 0) {
      if (e.key === "Tab") {
        e.preventDefault();
        acceptSuggestion(selectedIdx);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((p) => Math.min(p + 1, suggestions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((p) => Math.max(p - 1, 0));
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleApply();
    }
  };

  // Auto-resize
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.max(36, inputRef.current.scrollHeight) + "px";
    }
  }, [inputText]);

  // 辞書ブラウザ用カテゴリリスト（辞書 + 公式テンプレート統合）
  const dictCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const e of MATH_DICTIONARY) cats.add(e.category);
    // 公式テンプレートカテゴリもマージ
    for (const f of FORMULA_TEMPLATES) cats.add(f.category);
    return ["すべて", ...Array.from(cats)];
  }, []);

  // 辞書ブラウザ用フィルタ（辞書 + 公式テンプレート統合、辞書検索欄のみで絞り込み）
  type DictBrowserItem = { kind: "dict"; entry: MathDictEntry } | { kind: "formula"; entry: FormulaTemplate };

  const dictBrowserItems = useMemo((): DictBrowserItem[] => {
    let dictItems: DictBrowserItem[] = MATH_DICTIONARY.map((e) => ({ kind: "dict" as const, entry: e }));
    let formulaItems: DictBrowserItem[] = FORMULA_TEMPLATES.map((f) => ({ kind: "formula" as const, entry: f }));
    let items = [...dictItems, ...formulaItems];

    if (dictCategory !== "すべて") {
      items = items.filter((item) =>
        item.kind === "dict" ? item.entry.category === dictCategory : item.entry.category === dictCategory
      );
    }
    // 辞書内検索欄のみで絞り込み（何も入力していなければ全件表示）
    const filterText = dictSearch.trim();
    if (filterText) {
      const q = filterText.toLowerCase();
      const normQ = normalizeForMatch(filterText);
      items = items.filter((item) => {
        if (item.kind === "dict") {
          const e = item.entry;
          const normR = normalizeForMatch(e.reading);
          return (
            normR.includes(normQ) ||
            e.description.toLowerCase().includes(q) ||
            e.latex.toLowerCase().includes(q) ||
            e.category.toLowerCase().includes(q) ||
            e.aliases.some((a) => normalizeForMatch(a).includes(normQ))
          );
        } else {
          const f = item.entry;
          return (
            f.label.toLowerCase().includes(q) ||
            f.japanese.toLowerCase().includes(q) ||
            normalizeForMatch(f.japanese).includes(normQ) ||
            f.latex.toLowerCase().includes(q) ||
            f.category.toLowerCase().includes(q)
          );
        }
      });
    }
    return items;
  }, [dictCategory, dictSearch]);

  const handleDictInsert = useCallback((item: DictBrowserItem) => {
    let latex: string;
    let displayName: string;
    if (item.kind === "dict") {
      const entry = item.entry;
      latex = (entry.kind === "binary" || entry.kind === "unary")
        ? entry.latex.replace(/\{[A-Z]\}/g, "").replace(/_\s*\^/g, "").trim()
        : entry.latex;
      displayName = entry.reading;
    } else {
      latex = item.entry.latex;
      displayName = item.entry.label;
    }
    // 入力欄には日本語名を表示し、LaTeXはオーバーライドで保持
    setInputText(displayName);
    setOverrideLatex(latex);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  return (
    <div className={`space-y-2 ${className}`}>
      {/* 統合入力エリア */}
      <div className="relative">
        <div className="absolute left-2.5 top-2 flex items-center gap-1">
          <Search className="h-3 w-3 text-emerald-500/70" />
          <span className="text-[9px] font-medium text-emerald-500 select-none pointer-events-none">
            数式入力
          </span>
        </div>
        <textarea
          ref={inputRef}
          value={inputText}
          onChange={(e) => { setInputText(e.target.value); setSelectedIdx(0); setOverrideLatex(null); }}
          onKeyDown={handleKeyDown}
          placeholder="日本語: 2分のx  |  LaTeX: \frac{x}{2}  |  算術: x^2 + 1  |  スペースでグループ化"
          className={`w-full pl-16 pr-3 py-2 text-sm rounded-lg border focus:ring-2 focus:outline-none bg-background resize-none overflow-hidden font-sans ${
            overrideLatex
              ? "border-amber-300 dark:border-amber-700 focus:ring-amber-400"
              : "border-emerald-200 dark:border-emerald-800 focus:ring-emerald-400"
          }`}
          rows={1}
        />

        {/* 統合候補ドロップダウン */}
        {suggestions.length > 0 && (
          <div className="absolute z-50 mt-1 w-full bg-background border border-border rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
            {suggestions.map((s, i) => (
              <button
                key={i}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                  i === selectedIdx ? "bg-emerald-50 dark:bg-emerald-950/30" : "hover:bg-muted/50"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  acceptSuggestion(i);
                }}
                onMouseEnter={() => setSelectedIdx(i)}
              >
                <div className="w-14 flex-shrink-0 flex justify-center overflow-hidden">
                  <MathRenderer latex={s.preview} displayMode={false} className="scale-[0.6] origin-center" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium truncate">{s.display}</span>
                    {s.type === "dict" && (
                      <span className="px-1 py-0 rounded text-[7px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shrink-0">
                        辞書
                      </span>
                    )}
                    {s.type === "formula" && (
                      <span className="px-1 py-0 rounded text-[7px] bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 shrink-0">
                        公式
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] text-muted-foreground">{s.category}</span>
                </div>
                {i === selectedIdx && (
                  <kbd className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono shrink-0">
                    {s.reading ? "Tab" : "Tab/Enter"}
                  </kbd>
                )}
              </button>
            ))}
            <div className="px-3 py-1.5 bg-muted/30 border-t text-[9px] text-muted-foreground">
              <kbd className="px-1 rounded bg-muted font-mono">Tab</kbd> で選択
              <kbd className="px-1 rounded bg-muted font-mono ml-2">Enter</kbd> で反映
            </div>
          </div>
        )}
      </div>

      {/* Live preview */}
      {currentLatex && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-50/50 dark:bg-violet-950/20 border border-violet-200/50 dark:border-violet-800/50">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[9px] text-violet-400 font-medium">プレビュー</span>
            {overrideLatex && (
              <span className="px-1 py-0 rounded text-[7px] bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                辞書選択
              </span>
            )}
          </div>
          <div className="flex-1 flex justify-center overflow-auto">
            <MathRenderer latex={currentLatex} displayMode={false} />
          </div>
          {spacings.length > 0 && (
            <button
              onClick={() => setSpacings([])}
              className="text-[8px] text-muted-foreground/50 hover:text-foreground transition-colors shrink-0"
            >
              スペースリセット
            </button>
          )}
        </div>
      )}

      {/* Enter で反映ヒント + クリア */}
      <div className="flex items-center gap-2">
        {inputText && (
          <button
            onClick={() => { setInputText(""); setSpacings([]); setOverrideLatex(null); }}
            className="px-2 py-1 rounded-lg text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            クリア
          </button>
        )}
        <span className="text-[9px] text-muted-foreground/50 ml-auto flex items-center gap-1">
          <kbd className="px-1 rounded bg-muted font-mono text-[8px]">Enter</kbd>
          <span>で数式を反映</span>
        </span>
      </div>

      {/* スペース区切りネスト構文ガイド（折りたたみ） */}
      <details className="group">
        <summary className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none rounded-lg hover:bg-muted/50">
          <span className="transition-transform group-open:rotate-90">&#9654;</span>
          スペース区切り構文ガイド
        </summary>
        <div className="mt-1.5 p-3 rounded-lg bg-muted/30 border border-border/50 space-y-3">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground/80">スペースは項のグループ化に使います。</span>
            スペースなしで繋げた文字列はひとまとまりの項として扱われます。
            <span className="font-medium text-foreground/80">添え字（_）や上付き（^）も日本語と混在できます。</span>
          </p>

          {/* 分数 */}
          <div className="space-y-1">
            <p className="text-[9px] font-medium text-foreground/60 border-b border-border/20 pb-0.5">分数（〇分の△）</p>
            <div className="space-y-1.5">
              {[
                { input: "R+R_2分のV", result: "\\frac{V}{R+R_{2}}", desc: "R+R₂ が分母、V が分子" },
                { input: "1+2分の3", result: "\\frac{3}{1+2}", desc: "1+2 が分母、3 が分子" },
                { input: "1+ 2分の3", result: "1+\\frac{3}{2}", desc: "スペースで分断 → 2が分母" },
                { input: "a_1+b分のc^2", result: "\\frac{c^{2}}{a_{1}+b}", desc: "添え字・上付きも項に含む" },
              ].map((ex, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px]">
                  <code className="px-1.5 py-0.5 rounded bg-background border border-border/50 font-mono text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                    {ex.input}
                  </code>
                  <span className="text-muted-foreground/50">→</span>
                  <div className="w-28 shrink-0 flex justify-center overflow-hidden">
                    <MathRenderer latex={ex.result} displayMode={false} className="scale-[0.6] origin-center" />
                  </div>
                  <span className="text-muted-foreground/70 text-[9px]">{ex.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 累乗・根号 */}
          <div className="space-y-1">
            <p className="text-[9px] font-medium text-foreground/60 border-b border-border/20 pb-0.5">累乗・根号</p>
            <div className="space-y-1.5">
              {[
                { input: "a+bのc乗", result: "(a+b)^{c}", desc: "a+b 全体が底" },
                { input: "a +bのc乗", result: "a+b^{c}", desc: "b だけが底、a は別の項" },
                { input: "ルートa+b", result: "\\sqrt{a+b}", desc: "a+b 全体が根号の中" },
                { input: "ルートa +b", result: "\\sqrt{a}+b", desc: "a だけが根号の中" },
              ].map((ex, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px]">
                  <code className="px-1.5 py-0.5 rounded bg-background border border-border/50 font-mono text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                    {ex.input}
                  </code>
                  <span className="text-muted-foreground/50">→</span>
                  <div className="w-28 shrink-0 flex justify-center overflow-hidden">
                    <MathRenderer latex={ex.result} displayMode={false} className="scale-[0.6] origin-center" />
                  </div>
                  <span className="text-muted-foreground/70 text-[9px]">{ex.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 添え字 */}
          <div className="space-y-1">
            <p className="text-[9px] font-medium text-foreground/60 border-b border-border/20 pb-0.5">添え字・上付き</p>
            <div className="space-y-1.5">
              {[
                { input: "R_2", result: "R_{2}", desc: "_ で下付き添え字" },
                { input: "x^2", result: "x^{2}", desc: "^ で上付き" },
                { input: "R添え字2", result: "R_{2}", desc: "日本語でも書ける" },
                { input: "x上付き2", result: "x^{2}", desc: "日本語でも書ける" },
              ].map((ex, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px]">
                  <code className="px-1.5 py-0.5 rounded bg-background border border-border/50 font-mono text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                    {ex.input}
                  </code>
                  <span className="text-muted-foreground/50">→</span>
                  <div className="w-28 shrink-0 flex justify-center overflow-hidden">
                    <MathRenderer latex={ex.result} displayMode={false} className="scale-[0.6] origin-center" />
                  </div>
                  <span className="text-muted-foreground/70 text-[9px]">{ex.desc}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[9px] text-muted-foreground/50 pt-1 border-t border-border/30">
            💡 <span className="font-medium">ルール:</span>{" "}
            <span className="text-emerald-600 font-medium">スペースなし</span>＝ひとまとまりの項、{" "}
            <span className="text-amber-600 font-medium">半角スペース</span>＝項の区切り。{" "}
            <span className="text-blue-600 font-medium">_</span>＝下付き添え字、{" "}
            <span className="text-blue-600 font-medium">^</span>＝上付き。日本語と自由に混在OK。
          </p>
        </div>
      </details>

      {/* スペース調整（折りたたみ） */}
      <details className="group">
        <summary className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none rounded-lg hover:bg-muted/50">
          <span className="transition-transform group-open:rotate-90">&#9654;</span>
          スペース調整
          {spacings.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[8px] bg-primary/15 text-primary">{spacings.length}</span>
          )}
        </summary>
        <div className="mt-1.5">
          <SpacingControl onInsert={addSpacing} />
        </div>
      </details>

      {/* 辞書・公式ブラウザ（常時表示） */}
      <div>
        <button
          onClick={() => setShowDictBrowser(!showDictBrowser)}
          className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none rounded-lg hover:bg-muted/50"
        >
          <BookOpen className="h-3 w-3" />
          <span>辞書・公式ブラウザ</span>
          <span className={`text-[9px] transition-transform ${showDictBrowser ? "rotate-180" : ""}`}>▼</span>
        </button>

        {showDictBrowser && (
          <div className="mt-1.5 border rounded-xl overflow-hidden bg-background shadow-sm">
            {/* 辞書内検索（絞り込み用） */}
            <div className="px-2 pt-2 pb-1.5 border-b border-border/30">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
                <input
                  type="text"
                  value={dictSearch}
                  onChange={(e) => setDictSearch(e.target.value)}
                  placeholder="絞り込み検索（読み・説明・LaTeXコマンド）"
                  className="w-full pl-7 pr-2 py-1.5 text-[11px] rounded-md border border-border/50 bg-muted/30 placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
                {dictSearch && (
                  <button
                    onClick={() => setDictSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            {/* カテゴリタブ */}
            <div className="px-2 pt-2 pb-1.5 overflow-x-auto border-b border-border/30">
              <div className="flex gap-1 min-w-max">
                {dictCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setDictCategory(cat)}
                    className={`px-2 py-1 rounded-md text-[10px] font-medium whitespace-nowrap transition-all ${
                      dictCategory === cat
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-3 py-0.5 text-[9px] text-muted-foreground/60 border-b border-border/30">
              {dictBrowserItems.length}件
              {dictSearch.trim() && " (絞り込み中)"}
              {" — クリックで入力欄に設定"}
            </div>
            <ScrollArea className="h-44">
              <div className="p-1.5 space-y-0.5">
                {dictBrowserItems.map((item, i) => {
                  const isFormula = item.kind === "formula";
                  const displayLatex = isFormula
                    ? item.entry.latex
                    : item.entry.latex.replace(/\{[AB]\}/g, "").replace(/\{N\}/g, "");
                  const title = isFormula ? item.entry.label : item.entry.reading;
                  const subtitle = isFormula ? item.entry.japanese : item.entry.description;
                  return (
                    <button
                      key={i}
                      onClick={() => handleDictInsert(item)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-primary/8 active:bg-primary/15 transition-colors group text-left"
                    >
                      <div className="w-16 shrink-0 flex justify-center overflow-hidden">
                        <MathRenderer
                          latex={displayLatex}
                          displayMode={false}
                          className={isFormula ? "scale-[0.5] origin-center" : "scale-[0.7] origin-center"}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-medium truncate">{title}</span>
                          {isFormula && (
                            <span className="px-1 py-0 rounded text-[8px] bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 shrink-0">
                              公式
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] text-muted-foreground/70 truncate block">{subtitle}</span>
                      </div>
                      <span className="text-[8px] font-mono text-muted-foreground/40 group-hover:text-muted-foreground/80 truncate max-w-[80px] shrink-0 transition-colors">
                        {displayLatex.length > 25 ? displayLatex.slice(0, 25) + "…" : displayLatex}
                      </span>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Usage hints */}
      <div className="text-[9px] text-muted-foreground/60 leading-relaxed space-y-1">
        <div>
          💡 日本語:<span className="text-emerald-600 font-medium">「2分の1」</span>→ ½ 
          <span className="text-emerald-600 font-medium">「R_2分のV」</span>→ V/(R₂) 
          | LaTeX: <span className="text-blue-600 font-medium">\frac&#123;1&#125;&#123;2&#125;</span> 
          | 算術: <span className="text-orange-600 font-medium">x^2 + 1</span>
        </div>
        <div>
          📐 <span className="font-medium text-foreground/60">スペース区切り:</span>{" "}
          <span className="text-emerald-600 font-medium">a+b分のc</span> → (a+b)分のc{" "}
          | <span className="text-amber-600 font-medium">a +b分のc</span> → a+(b分のc){" "}
          | 添え字: <span className="text-blue-600 font-medium">R_2</span> / <span className="text-blue-600 font-medium">R添え字2</span>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// スペーシングGUIコントロール
// ══════════════════════════════════════════

interface SpacingControlProps {
  onInsert: (latex: string) => void;
  className?: string;
}

export function SpacingControl({ onInsert, className = "" }: SpacingControlProps) {
  const [customPt, setCustomPt] = useState(5);

  return (
    <div className={`space-y-3 ${className}`}>
      <p className="text-[10px] font-medium text-muted-foreground">数式内スペース調整</p>

      {/* Preset buttons */}
      <div className="flex flex-wrap gap-1.5">
        <TooltipProvider delayDuration={200}>
          {SPACING_PRESETS.map((preset: SpacingPreset) => (
            <Tooltip key={preset.name}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onInsert(preset.latex)}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all text-xs"
                >
                  {/* Visual width indicator */}
                  <div className="h-3 bg-primary/30 rounded-sm" style={{ width: `${Math.max(2, Math.abs(preset.widthEm) * 16)}px` }} />
                  <span className="text-[10px] font-medium">{preset.name}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <p className="font-medium">{preset.description}</p>
                <p className="font-mono text-muted-foreground text-[10px]">{preset.latex}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </div>

      {/* Custom spacing slider */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground shrink-0 w-16">カスタム:</span>
        <input
          type="range"
          min={-10}
          max={40}
          value={customPt}
          onChange={(e) => setCustomPt(Number(e.target.value))}
          className="flex-1 h-1.5 accent-primary"
        />
        <span className="text-[10px] font-mono w-10 text-right">{customPt}pt</span>
        <button
          onClick={() => onInsert(`\\hspace{${customPt}pt}`)}
          className="text-[10px] px-2 py-1 rounded bg-primary/10 hover:bg-primary/20 text-primary font-medium transition-colors"
        >
          挿入
        </button>
      </div>

      {/* Visual preview of the spacing */}
      <div className="flex items-center gap-0 px-3 py-2 rounded-lg bg-muted/30 border">
        <span className="text-xs">a</span>
        <div
          className="bg-primary/20 border border-primary/40 rounded-sm h-4"
          style={{ width: `${Math.max(1, customPt * 1.33)}px` }}
        />
        <span className="text-xs">b</span>
        <span className="ml-3 text-[9px] text-muted-foreground">
          ← {customPt}pt のスペース
        </span>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// LaTeX日本語訳リファレンス
// ══════════════════════════════════════════

export function LatexJapaneseReference({ className = "" }: { className?: string }) {
  const [activeTab, setActiveTab] = useState("構造");
  const categories = Array.from(new Set(LATEX_TRANSLATIONS.map((t: LatexTranslation) => t.category))) as string[];

  return (
    <div className={`bg-background border rounded-xl shadow-sm ${className}`}>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="px-2 pt-2 border-b">
          <TabsList className="w-full h-7 bg-muted/50">
            {categories.map((cat: string) => (
              <TabsTrigger key={cat} value={cat} className="text-[10px] h-5 px-2">
                {cat}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <ScrollArea className="h-44 p-2">
          {categories.map((cat: string) => (
            <TabsContent key={cat} value={cat} className="mt-0 space-y-1">
              {LATEX_TRANSLATIONS.filter((t: LatexTranslation) => t.category === cat).map((t: LatexTranslation, i: number) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors"
                >
                  <div className="w-24 flex-shrink-0 flex justify-center overflow-hidden">
                    <MathRenderer
                      latex={t.latex.replace(/[AB]/g, "x").replace(/[N]/g, "n")}
                      displayMode={false}
                      className="scale-[0.65] origin-center"
                    />
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{t.japanese}</span>
                  </div>
                </div>
              ))}
            </TabsContent>
          ))}
        </ScrollArea>
      </Tabs>
    </div>
  );
}
