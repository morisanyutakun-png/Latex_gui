"use client";

import React, { useState } from "react";
import { Block } from "@/lib/types";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
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
  DIAGRAM_PRESETS,
  CHEMISTRY_PRESETS,
  CHART_PRESETS,
} from "@/lib/presets";
import { MathRenderer } from "./math-editor";
import { Zap, GitBranch, FlaskConical, BarChart3, Sparkles, Code2, ChevronRight } from "lucide-react";

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

// ──── Circuit Editor ────

export function CircuitBlockEditor({ block }: { block: Block }) {
  const updateContent = useDocumentStore((s) => s.updateBlockContent);
  const { editingBlockId } = useUIStore();
  const content = block.content as Extract<Block["content"], { type: "circuit" }>;
  const isEditing = editingBlockId === block.id;
  const [showCode, setShowCode] = useState(false);

  return (
    <div className="space-y-2">
      {/* Preview/Placeholder */}
      <div className={`flex flex-col items-center py-4 px-4 rounded-lg ${!content.code ? "bg-cyan-50/50 dark:bg-cyan-950/20" : "bg-white dark:bg-card"}`}>
        {content.code ? (
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 text-xs">
              <Zap className="h-3 w-3" />
              {content.preset ? CIRCUIT_PRESETS.find(p => p.id === content.preset)?.name || "回路図" : "回路図"}
            </div>
            {content.caption && (
              <p className="text-[10px] text-muted-foreground">{content.caption}</p>
            )}
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

          {/* Preset Grid — always visible, Canva-style */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-cyan-500" />
              テンプレートから選択（クリックで即反映）
            </p>
            <div className="grid grid-cols-2 gap-2">
              {CIRCUIT_PRESETS.map((preset) => (
                <PresetCard
                  key={preset.id}
                  name={preset.name}
                  description={preset.description}
                  active={content.preset === preset.id}
                  accent="cyan"
                  onClick={() => updateContent(block.id, { code: preset.code, preset: preset.id })}
                />
              ))}
            </div>
          </div>

          {/* Code editor — hidden behind toggle */}
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
              className="mt-2 w-full font-mono text-xs p-2 h-28 rounded-lg border border-cyan-200 dark:border-cyan-800 focus:ring-cyan-400 bg-slate-50 dark:bg-slate-900 resize-y"
            />
          </details>
        </div>
      )}
    </div>
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
      <div className={`flex flex-col items-center py-4 px-4 rounded-lg ${!content.code ? "bg-indigo-50/50 dark:bg-indigo-950/20" : "bg-white dark:bg-card"}`}>
        {content.code ? (
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs">
              <GitBranch className="h-3 w-3" />
              {content.preset ? DIAGRAM_PRESETS.find(p => p.id === content.preset)?.name || "ダイアグラム" : "ダイアグラム"}
            </div>
            {content.caption && (
              <p className="text-[10px] text-muted-foreground">{content.caption}</p>
            )}
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
              {["->", "<=>", "^{2+}", "_{(aq)}", "->[\u89e6\u5a92]", "v", "^"].map((sym) => (
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
      <div className={`flex flex-col items-center py-4 px-4 rounded-lg ${!content.code ? "bg-rose-50/50 dark:bg-rose-950/20" : "bg-white dark:bg-card"}`}>
        {content.code ? (
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 text-xs">
              <BarChart3 className="h-3 w-3" />
              {content.preset ? CHART_PRESETS.find(p => p.id === content.preset)?.name || "グラフ" : "グラフ"}
            </div>
            {content.caption && (
              <p className="text-[10px] text-muted-foreground">{content.caption}</p>
            )}
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
