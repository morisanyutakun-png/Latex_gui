"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Block } from "@/lib/types";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { previewBlockSVG } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CIRCUIT_PRESETS,
  CIRCUIT_CATEGORIES,
  CIRCUIT_COMPONENTS,
  DIAGRAM_PRESETS,
  CHEMISTRY_PRESETS,
  CHART_PRESETS,
} from "@/lib/presets";
import type { CircuitPreset } from "@/lib/presets";
import { MathRenderer } from "./math-editor";
import {
  Zap, GitBranch, FlaskConical, BarChart3, Sparkles,
  Code2, ChevronRight, Search, X, Puzzle, Copy, Check,
  Loader2, RefreshCw, AlertCircle,
} from "lucide-react";

// ──── Shared Preset Card ────
function PresetCard({ name, description, active, onClick, accent }: {
  name: string; description: string; active: boolean; onClick: () => void; accent: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-start p-3 rounded-xl border-2 transition-all text-left ${
        active
          ? `border-${accent}-400 bg-${accent}-50 dark:bg-${accent}-950/20 shadow-sm`
          : "border-border/50 hover:border-primary/30 hover:shadow-sm"
      }`}
    >
      <span className="text-xs font-semibold mb-0.5">{name}</span>
      <span className="text-[9px] text-muted-foreground leading-relaxed">{description}</span>
      {active && (
        <span className={`mt-1.5 inline-flex items-center gap-0.5 text-[8px] font-medium text-${accent}-600 dark:text-${accent}-400`}>
          <Sparkles className="h-2.5 w-2.5" /> 選択中
        </span>
      )}
    </button>
  );
}

// ──── Circuit Code Description ────
// Show a human-readable summary of the circuitikz components
function CircuitCodeSummary({ code, presetName }: { code: string; presetName?: string }) {
  const components = useMemo(() => {
    const found: { type: string; count: number }[] = [];
    const patterns: [RegExp, string][] = [
      [/to\[R/g, "抵抗"],
      [/to\[C/g, "コンデンサ"],
      [/to\[L/g, "インダクタ"],
      [/to\[V/g, "電圧源"],
      [/to\[sV/g, "AC電圧源"],
      [/to\[I/g, "電流源"],
      [/to\[D[\],]/g, "ダイオード"],
      [/to\[zD/g, "ツェナーD"],
      [/to\[led/g, "LED"],
      [/to\[pD/g, "フォトD"],
      [/node\[op amp/g, "オペアンプ"],
      [/node\[npn\]/g, "NPN Tr"],
      [/node\[pnp\]/g, "PNP Tr"],
      [/node\[nmos\]/g, "NMOS"],
      [/node\[pmos\]/g, "PMOS"],
      [/node\[ground\]/g, "GND"],
      [/node\[vcc\]/g, "VCC"],
      [/to\[voltmeter/g, "電圧計"],
      [/to\[thermistor/g, "サーミスタ"],
      [/to\[vR/g, "可変抵抗"],
    ];
    for (const [regexp, label] of patterns) {
      const matches = code.match(regexp);
      if (matches) {
        found.push({ type: label, count: matches.length });
      }
    }
    return found;
  }, [code]);

  if (components.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {components.map((c) => (
        <span
          key={c.type}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-cyan-100/80 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 text-[9px] font-medium"
        >
          {c.type}{c.count > 1 ? ` ×${c.count}` : ""}
        </span>
      ))}
    </div>
  );
}

// ──── Block SVG Preview ────
// Fetches and displays an SVG preview from the backend
function BlockSVGPreview({ code, blockType, className = "" }: {
  code: string; blockType: string; className?: string;
}) {
  const [svg, setSvg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastCodeRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPreview = useCallback(async (currentCode: string) => {
    if (!currentCode.trim()) {
      setSvg(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await previewBlockSVG(currentCode, blockType);
      setSvg(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "プレビュー取得に失敗");
      setSvg(null);
    } finally {
      setLoading(false);
    }
  }, [blockType]);

  // Debounced fetch: wait 800ms after code changes
  useEffect(() => {
    if (code === lastCodeRef.current) return;
    lastCodeRef.current = code;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      fetchPreview(code);
    }, 800);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [code, fetchPreview]);

  if (!code.trim()) return null;

  return (
    <div className={`relative rounded-lg overflow-hidden bg-white dark:bg-zinc-950 border border-border/30 ${className}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-zinc-950/60 z-10">
          <Loader2 className="h-5 w-5 animate-spin text-cyan-500" />
        </div>
      )}
      {svg ? (
        <div
          className="flex items-center justify-center p-3 [&>svg]:max-w-full [&>svg]:max-h-48 [&>svg]:h-auto"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-4 px-3 gap-1.5 text-center">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <span className="text-[9px] text-muted-foreground/60">{error}</span>
          <button
            onClick={() => fetchPreview(code)}
            className="text-[9px] text-cyan-600 hover:underline flex items-center gap-0.5"
          >
            <RefreshCw className="h-2.5 w-2.5" />
            再試行
          </button>
        </div>
      ) : !loading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground/30">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : null}
    </div>
  );
}

// ──── Component Palette ────
function ComponentPalette({ onInsert }: { onInsert: (snippet: string) => void }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const categories = useMemo(() => {
    const cats = new Map<string, typeof CIRCUIT_COMPONENTS>();
    for (const comp of CIRCUIT_COMPONENTS) {
      if (!cats.has(comp.category)) cats.set(comp.category, []);
      cats.get(comp.category)!.push(comp);
    }
    return cats;
  }, []);

  const handleClick = (comp: typeof CIRCUIT_COMPONENTS[0]) => {
    onInsert(comp.snippet);
    setCopiedId(comp.id);
    setTimeout(() => setCopiedId(null), 1200);
  };

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
        <Puzzle className="h-3 w-3 text-cyan-500" />
        部品パレット（クリックでコードに挿入）
      </p>
      <div className="space-y-2">
        {Array.from(categories.entries()).map(([cat, comps]) => (
          <div key={cat}>
            <p className="text-[8px] uppercase font-bold text-muted-foreground/60 mb-1 tracking-wider">
              {cat}
            </p>
            <div className="flex flex-wrap gap-1">
              {comps.map((comp) => (
                <button
                  key={comp.id}
                  onClick={() => handleClick(comp)}
                  title={`${comp.description}\n${comp.snippet}`}
                  className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] rounded-lg border transition-all ${
                    copiedId === comp.id
                      ? "border-green-400 bg-green-50 dark:bg-green-950/20 text-green-700"
                      : "border-border/40 bg-background hover:border-cyan-300 hover:bg-cyan-50/50 dark:hover:bg-cyan-950/20"
                  }`}
                >
                  <span className="font-mono font-bold text-[9px] w-5 text-center">{comp.icon}</span>
                  <span className="text-[9px]">{comp.name}</span>
                  {copiedId === comp.id && <Check className="h-2.5 w-2.5" />}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ──── Circuit Editor ────

export function CircuitBlockEditor({ block }: { block: Block }) {
  const updateContent = useDocumentStore((s) => s.updateBlockContent);
  const { editingBlockId } = useUIStore();
  const content = block.content as Extract<Block["content"], { type: "circuit" }>;
  const isEditing = editingBlockId === block.id;
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("すべて");
  const [showPalette, setShowPalette] = useState(false);

  // Filter presets by category and search
  const filteredPresets = useMemo(() => {
    let results = CIRCUIT_PRESETS;

    // Category filter
    if (selectedCategory !== "すべて") {
      results = results.filter((p) => p.category === selectedCategory);
    }

    // Search filter — matches name, description, tags
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      results = results.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q)) ||
          p.id.toLowerCase().includes(q)
      );
    }

    return results;
  }, [selectedCategory, searchQuery]);

  const activePreset = CIRCUIT_PRESETS.find((p) => p.id === content.preset);

  const handleInsertSnippet = (snippet: string) => {
    const current = content.code || "";
    const newCode = current ? `${current}\n${snippet}` : snippet;
    updateContent(block.id, { code: newCode });
  };

  return (
    <div className="space-y-2">
      {/* Preview/Placeholder — SVG rendering of the circuit */}
      <div
        className={`flex flex-col items-center rounded-lg ${
          !content.code ? "py-4 px-4 bg-cyan-50/50 dark:bg-cyan-950/20" : "bg-white dark:bg-card"
        }`}
      >
        {content.code ? (
          <div className="w-full space-y-2">
            <div className="flex items-center justify-center gap-2 pt-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 text-xs font-medium">
                <Zap className="h-3 w-3" />
                {activePreset?.name || "カスタム回路図"}
              </div>
              {activePreset?.category && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-muted-foreground">
                  {activePreset.category}
                </span>
              )}
            </div>
            {content.caption && (
              <p className="text-[10px] text-muted-foreground text-center">{content.caption}</p>
            )}
            {/* SVG Preview — rendered by backend */}
            <BlockSVGPreview code={content.code} blockType="circuit" />
            {/* Component summary badges */}
            <div className="flex justify-center pb-1">
              <CircuitCodeSummary code={content.code} presetName={activePreset?.name} />
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground/40 text-sm italic flex items-center gap-2">
            <Zap className="h-4 w-4" />
            ダブルクリックして回路図を選択
          </span>
        )}
      </div>

      {isEditing && (
        <div className="space-y-3 border rounded-xl p-3 bg-background shadow-sm">
          {/* Caption */}
          <Input
            value={content.caption || ""}
            onChange={(e) => updateContent(block.id, { caption: e.target.value })}
            placeholder="キャプション（図のタイトル）"
            className="h-8 text-xs"
          />

          {/* Search + Category filter */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="回路を検索... (例: オペアンプ, フィルタ, MOSFET)"
                  className="h-8 text-xs pl-7 pr-7"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                {filteredPresets.length}件
              </span>
            </div>

            {/* Category pills */}
            <div className="flex gap-1 flex-wrap">
              {CIRCUIT_CATEGORIES.map((cat) => {
                const count =
                  cat === "すべて"
                    ? CIRCUIT_PRESETS.length
                    : CIRCUIT_PRESETS.filter((p) => p.category === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2 py-0.5 text-[9px] rounded-full transition-all ${
                      selectedCategory === cat
                        ? "bg-cyan-500 text-white font-semibold"
                        : "bg-slate-100 dark:bg-slate-800 text-muted-foreground hover:bg-cyan-100 dark:hover:bg-cyan-900/30"
                    }`}
                  >
                    {cat}
                    <span className="ml-0.5 opacity-60">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preset Grid with scroll */}
          <ScrollArea className="max-h-64">
            <div className="grid grid-cols-2 gap-2 pr-2">
              {filteredPresets.length > 0 ? (
                filteredPresets.map((preset) => (
                  <CircuitPresetCard
                    key={preset.id}
                    preset={preset}
                    active={content.preset === preset.id}
                    onClick={() =>
                      updateContent(block.id, {
                        code: preset.code,
                        preset: preset.id,
                      })
                    }
                  />
                ))
              ) : (
                <div className="col-span-2 text-center py-6 text-muted-foreground/50 text-xs">
                  <Search className="h-5 w-5 mx-auto mb-1 opacity-50" />
                  該当する回路が見つかりません
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Component Palette */}
          <details className="group" open={showPalette}>
            <summary
              onClick={(e) => { e.preventDefault(); setShowPalette(!showPalette); }}
              className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground/60 cursor-pointer hover:text-muted-foreground transition-colors select-none"
            >
              <ChevronRight className={`h-3 w-3 transition-transform ${showPalette ? "rotate-90" : ""}`} />
              <Puzzle className="h-3 w-3" />
              部品パレット（コードに追記）
            </summary>
            {showPalette && (
              <div className="mt-2">
                <ComponentPalette onInsert={handleInsertSnippet} />
              </div>
            )}
          </details>

          {/* Code editor */}
          <details className="group">
            <summary className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground/60 cursor-pointer hover:text-muted-foreground transition-colors select-none">
              <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
              <Code2 className="h-3 w-3" />
              コードを直接編集（上級者向け）
            </summary>
            <textarea
              value={content.code}
              onChange={(e) => updateContent(block.id, { code: e.target.value })}
              placeholder="circuitikz コードを入力..."
              className="mt-2 w-full font-mono text-xs p-2 h-36 rounded-lg border border-cyan-200 dark:border-cyan-800 focus:ring-cyan-400 bg-slate-50 dark:bg-slate-900 resize-y"
            />
          </details>
        </div>
      )}
    </div>
  );
}

// Circuit-specific preset card with tags and component info
function CircuitPresetCard({ preset, active, onClick }: {
  preset: CircuitPreset; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-start p-3 rounded-xl border-2 transition-all text-left ${
        active
          ? "border-cyan-400 bg-cyan-50 dark:bg-cyan-950/20 shadow-sm"
          : "border-border/50 hover:border-cyan-300 hover:shadow-sm"
      }`}
    >
      <div className="flex items-center gap-1.5 w-full">
        <span className="text-xs font-semibold flex-1">{preset.name}</span>
        <span className="text-[7px] px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-muted-foreground shrink-0">
          {preset.category}
        </span>
      </div>
      <span className="text-[9px] text-muted-foreground leading-relaxed mt-0.5">
        {preset.description}
      </span>
      <div className="flex flex-wrap gap-0.5 mt-1.5">
        {preset.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="px-1 py-0 text-[7px] rounded bg-cyan-50 dark:bg-cyan-950/20 text-cyan-600 dark:text-cyan-400"
          >
            {tag}
          </span>
        ))}
      </div>
      {active && (
        <span className="mt-1.5 inline-flex items-center gap-0.5 text-[8px] font-medium text-cyan-600 dark:text-cyan-400">
          <Sparkles className="h-2.5 w-2.5" /> 選択中
        </span>
      )}
    </button>
  );
}

// ──── Diagram Editor ────

export function DiagramBlockEditor({ block }: { block: Block }) {
  const updateContent = useDocumentStore((s) => s.updateBlockContent);
  const { editingBlockId } = useUIStore();
  const content = block.content as Extract<Block["content"], { type: "diagram" }>;
  const isEditing = editingBlockId === block.id;

  const filteredPresets = content.diagramType === "custom"
    ? DIAGRAM_PRESETS
    : DIAGRAM_PRESETS.filter((p) => p.diagramType === content.diagramType || content.diagramType === "flowchart");

  const displayPresets = filteredPresets.length > 0 ? filteredPresets : DIAGRAM_PRESETS;

  return (
    <div className="space-y-2">
      {/* Preview */}
      <div className={`flex flex-col items-center rounded-lg ${!content.code ? "py-4 px-4 bg-indigo-50/50 dark:bg-indigo-950/20" : "bg-white dark:bg-card"}`}>
        {content.code ? (
          <div className="w-full space-y-2">
            <div className="flex items-center justify-center gap-2 pt-2">
              <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs">
                <GitBranch className="h-3 w-3" />
                {content.preset ? DIAGRAM_PRESETS.find(p => p.id === content.preset)?.name || "ダイアグラム" : "ダイアグラム"}
              </div>
            </div>
            {content.caption && (
              <p className="text-[10px] text-muted-foreground text-center">{content.caption}</p>
            )}
            <BlockSVGPreview code={content.code} blockType="diagram" />
          </div>
        ) : (
          <span className="text-muted-foreground/40 text-sm italic flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            ダブルクリックしてダイアグラムを選択
          </span>
        )}
      </div>

      {isEditing && (
        <div className="space-y-3 border rounded-xl p-3 bg-background shadow-sm">
          {/* Type selector + Caption */}
          <div className="flex items-center gap-2">
            <Select
              value={content.diagramType}
              onValueChange={(v) => updateContent(block.id, { diagramType: v as "flowchart" | "sequence" | "block" | "state" | "tree" | "custom" })}
            >
              <SelectTrigger className="h-8 text-xs w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flowchart">フローチャート</SelectItem>
                <SelectItem value="block">ブロック図</SelectItem>
                <SelectItem value="state">状態遷移図</SelectItem>
                <SelectItem value="tree">ツリー図</SelectItem>
                <SelectItem value="sequence">シーケンス図</SelectItem>
                <SelectItem value="custom">カスタム</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={content.caption || ""}
              onChange={(e) => updateContent(block.id, { caption: e.target.value })}
              placeholder="キャプション（図のタイトル）"
              className="h-8 text-xs flex-1"
            />
          </div>

          {/* Preset Grid */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-indigo-500" />
              テンプレートから選択
            </p>
            <div className="grid grid-cols-2 gap-2">
              {displayPresets.map((preset) => (
                <PresetCard
                  key={preset.id}
                  name={preset.name}
                  description={preset.description}
                  active={content.preset === preset.id}
                  accent="indigo"
                  onClick={() => updateContent(block.id, {
                    code: preset.code,
                    diagramType: preset.diagramType as "flowchart" | "sequence" | "block" | "state" | "tree" | "custom",
                    preset: preset.id,
                  })}
                />
              ))}
            </div>
          </div>

          {/* Code editor (collapsed) */}
          <details className="group">
            <summary className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground/60 cursor-pointer hover:text-muted-foreground transition-colors select-none">
              <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
              <Code2 className="h-3 w-3" />
              コードを直接編集（上級者向け）
            </summary>
            <textarea
              value={content.code}
              onChange={(e) => updateContent(block.id, { code: e.target.value })}
              placeholder="TikZコードを入力..."
              className="mt-2 w-full font-mono text-xs p-2 h-28 rounded-lg border border-indigo-200 dark:border-indigo-800 focus:ring-indigo-400 bg-slate-50 dark:bg-slate-900 resize-y"
            />
          </details>
        </div>
      )}
    </div>
  );
}

// ──── Chemistry Editor ────

export function ChemistryBlockEditor({ block }: { block: Block }) {
  const updateContent = useDocumentStore((s) => s.updateBlockContent);
  const { editingBlockId } = useUIStore();
  const content = block.content as Extract<Block["content"], { type: "chemistry" }>;
  const isEditing = editingBlockId === block.id;

  return (
    <div className="space-y-2">
      {/* Preview */}
      <div className={`flex justify-center py-3 px-4 rounded-lg ${!content.formula ? "bg-lime-50/50 dark:bg-lime-950/20" : ""}`}>
        {content.formula ? (
          <MathRenderer latex={`\\ce{${content.formula}}`} displayMode={content.displayMode} />
        ) : (
          <span className="text-muted-foreground/40 text-sm italic flex items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            ダブルクリックして化学式を入力
          </span>
        )}
      </div>

      {isEditing && (
        <div className="space-y-3 border rounded-xl p-3 bg-background shadow-sm">
          {/* Caption */}
          <Input
            value={content.caption || ""}
            onChange={(e) => updateContent(block.id, { caption: e.target.value })}
            placeholder="キャプション（任意）"
            className="h-8 text-xs"
          />

          {/* Preset Grid */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-lime-500" />
              よく使う化学反応式
            </p>
            <div className="grid grid-cols-2 gap-2">
              {CHEMISTRY_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => updateContent(block.id, { formula: preset.formula })}
                  className={`flex flex-col items-start p-3 rounded-xl border-2 transition-all text-left ${
                    content.formula === preset.formula
                      ? "border-lime-400 bg-lime-50 dark:bg-lime-950/20 shadow-sm"
                      : "border-border/50 hover:border-lime-300 hover:shadow-sm"
                  }`}
                >
                  <span className="text-xs font-semibold mb-0.5">{preset.name}</span>
                  <span className="text-[9px] text-muted-foreground">{preset.description}</span>
                  <span className="text-[9px] font-mono text-lime-600 dark:text-lime-400 mt-1">{preset.formula}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Direct input */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
              <FlaskConical className="h-3 w-3 text-lime-500" />
              直接入力
            </p>
            <Input
              value={content.formula}
              onChange={(e) => updateContent(block.id, { formula: e.target.value })}
              placeholder="例: 2H2 + O2 -> 2H2O"
              className="font-mono text-sm h-9 rounded-lg border-lime-200 dark:border-lime-800 focus-visible:ring-lime-400"
            />
            {/* Quick-insert symbols */}
            <div className="flex gap-1 flex-wrap">
              {["->", "<=>", "^{2+}", "_{(aq)}", "->[触媒]", "v", "^"].map((sym) => (
                <button
                  key={sym}
                  onClick={() => updateContent(block.id, { formula: content.formula + " " + sym + " " })}
                  className="px-2 py-1 text-[10px] font-mono rounded-lg bg-lime-100 dark:bg-lime-900/30 text-lime-700 dark:text-lime-300 hover:bg-lime-200 transition-colors"
                >
                  {sym}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ──── Chart Editor ────

export function ChartBlockEditor({ block }: { block: Block }) {
  const updateContent = useDocumentStore((s) => s.updateBlockContent);
  const { editingBlockId } = useUIStore();
  const content = block.content as Extract<Block["content"], { type: "chart" }>;
  const isEditing = editingBlockId === block.id;

  return (
    <div className="space-y-2">
      <div className={`flex flex-col items-center rounded-lg ${!content.code ? "py-4 px-4 bg-rose-50/50 dark:bg-rose-950/20" : "bg-white dark:bg-card"}`}>
        {content.code ? (
          <div className="w-full space-y-2">
            <div className="flex items-center justify-center gap-2 pt-2">
              <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 text-xs">
                <BarChart3 className="h-3 w-3" />
                {content.preset ? CHART_PRESETS.find(p => p.id === content.preset)?.name || "グラフ" : "グラフ"}
              </div>
            </div>
            {content.caption && (
              <p className="text-[10px] text-muted-foreground text-center">{content.caption}</p>
            )}
            <BlockSVGPreview code={content.code} blockType="chart" />
          </div>
        ) : (
          <span className="text-muted-foreground/40 text-sm italic flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            ダブルクリックしてグラフを選択
          </span>
        )}
      </div>

      {isEditing && (
        <div className="space-y-3 border rounded-xl p-3 bg-background shadow-sm">
          {/* Type + Caption */}
          <div className="flex items-center gap-2">
            <Select
              value={content.chartType}
              onValueChange={(v) => updateContent(block.id, { chartType: v as "line" | "bar" | "scatter" | "histogram" })}
            >
              <SelectTrigger className="h-8 text-xs w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="line">折れ線</SelectItem>
                <SelectItem value="bar">棒グラフ</SelectItem>
                <SelectItem value="scatter">散布図</SelectItem>
                <SelectItem value="histogram">ヒストグラム</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={content.caption || ""}
              onChange={(e) => updateContent(block.id, { caption: e.target.value })}
              placeholder="キャプション（図のタイトル）"
              className="h-8 text-xs flex-1"
            />
          </div>

          {/* Preset Grid */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-rose-500" />
              テンプレートから選択
            </p>
            <div className="grid grid-cols-2 gap-2">
              {CHART_PRESETS.map((preset) => (
                <PresetCard
                  key={preset.id}
                  name={preset.name}
                  description={preset.description}
                  active={content.preset === preset.id}
                  accent="rose"
                  onClick={() => updateContent(block.id, {
                    code: preset.code,
                    chartType: preset.chartType as "line" | "bar" | "scatter" | "histogram",
                    preset: preset.id,
                  })}
                />
              ))}
            </div>
          </div>

          {/* Code editor (collapsed) */}
          <details className="group">
            <summary className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground/60 cursor-pointer hover:text-muted-foreground transition-colors select-none">
              <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
              <Code2 className="h-3 w-3" />
              コードを直接編集（上級者向け）
            </summary>
            <textarea
              value={content.code}
              onChange={(e) => updateContent(block.id, { code: e.target.value })}
              placeholder="pgfplots コードを入力..."
              className="mt-2 w-full font-mono text-xs p-2 h-28 rounded-lg border border-rose-200 dark:border-rose-800 focus:ring-rose-400 bg-slate-50 dark:bg-slate-900 resize-y"
            />
          </details>
        </div>
      )}
    </div>
  );
}
