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
import { Zap, GitBranch, FlaskConical, BarChart3, Sparkles, Code2 } from "lucide-react";

// ──── Circuit Editor ────

export function CircuitBlockEditor({ block }: { block: Block }) {
  const updateContent = useDocumentStore((s) => s.updateBlockContent);
  const { editingBlockId } = useUIStore();
  const content = block.content as Extract<Block["content"], { type: "circuit" }>;
  const isEditing = editingBlockId === block.id;
  const [showPresets, setShowPresets] = useState(!content.code);

  return (
    <div className="space-y-2">
      {/* Preview/Placeholder */}
      <div className={`flex flex-col items-center py-4 px-4 rounded-lg ${!content.code ? "bg-cyan-50/50 dark:bg-cyan-950/20" : "bg-white dark:bg-gray-50"}`}>
        {content.code ? (
          <div className="text-center">
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 text-xs mb-2">
              <Zap className="h-3 w-3" />
              回路図 (circuitikz)
            </div>
            <div className="font-mono text-[10px] text-muted-foreground bg-muted/30 p-2 rounded max-h-32 overflow-auto text-left whitespace-pre">
              {content.code.slice(0, 300)}{content.code.length > 300 ? "..." : ""}
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground/40 text-sm italic flex items-center gap-2">
            <Zap className="h-4 w-4" />
            回路図を選択または入力
          </span>
        )}
      </div>

      {isEditing && (
        <div className="space-y-2">
          {/* Preset selector */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7 gap-1"
              onClick={() => setShowPresets(!showPresets)}
            >
              <Sparkles className="h-3 w-3" />
              テンプレート
            </Button>
            <Input
              value={content.caption || ""}
              onChange={(e) => updateContent(block.id, { caption: e.target.value })}
              placeholder="キャプション（任意）"
              className="h-7 text-xs flex-1"
            />
          </div>

          {showPresets && (
            <ScrollArea className="h-40 border rounded-lg p-2">
              <div className="grid grid-cols-2 gap-1.5">
                {CIRCUIT_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      updateContent(block.id, { code: preset.code, preset: preset.id });
                      setShowPresets(false);
                    }}
                    className="flex flex-col items-start p-2 rounded-lg border border-border/50 hover:bg-cyan-50 dark:hover:bg-cyan-950/20 hover:border-cyan-300 transition-colors text-left"
                  >
                    <span className="text-xs font-medium">{preset.name}</span>
                    <span className="text-[9px] text-muted-foreground">{preset.description}</span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Code editor */}
          <div className="relative">
            <div className="absolute left-2 top-1.5 text-[9px] font-mono text-cyan-400 select-none pointer-events-none flex items-center gap-1">
              <Code2 className="h-3 w-3" />
              circuitikz
            </div>
            <textarea
              value={content.code}
              onChange={(e) => updateContent(block.id, { code: e.target.value })}
              placeholder="\\draw (0,0) to[R, l=$R$] (2,0);"
              className="w-full font-mono text-xs pl-20 pt-1.5 h-24 rounded-lg border border-cyan-200 dark:border-cyan-800 focus:ring-cyan-400 bg-slate-50 dark:bg-slate-900 resize-y"
            />
          </div>
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
  const [showPresets, setShowPresets] = useState(!content.code);

  const filteredPresets = content.diagramType === "custom"
    ? DIAGRAM_PRESETS
    : DIAGRAM_PRESETS.filter((p) => p.diagramType === content.diagramType || content.diagramType === "flowchart");

  return (
    <div className="space-y-2">
      {/* Preview */}
      <div className={`flex flex-col items-center py-4 px-4 rounded-lg ${!content.code ? "bg-indigo-50/50 dark:bg-indigo-950/20" : "bg-white dark:bg-gray-50"}`}>
        {content.code ? (
          <div className="text-center">
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs mb-2">
              <GitBranch className="h-3 w-3" />
              ダイアグラム (TikZ)
            </div>
            <div className="font-mono text-[10px] text-muted-foreground bg-muted/30 p-2 rounded max-h-32 overflow-auto text-left whitespace-pre">
              {content.code.slice(0, 300)}{content.code.length > 300 ? "..." : ""}
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground/40 text-sm italic flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            ダイアグラムを選択または入力
          </span>
        )}
      </div>

      {isEditing && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Select
              value={content.diagramType}
              onValueChange={(v) => updateContent(block.id, { diagramType: v as "flowchart" | "sequence" | "block" | "state" | "tree" | "custom" })}
            >
              <SelectTrigger className="h-7 text-xs w-32">
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
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7 gap-1"
              onClick={() => setShowPresets(!showPresets)}
            >
              <Sparkles className="h-3 w-3" />
              テンプレート
            </Button>
            <Input
              value={content.caption || ""}
              onChange={(e) => updateContent(block.id, { caption: e.target.value })}
              placeholder="キャプション"
              className="h-7 text-xs flex-1"
            />
          </div>

          {showPresets && (
            <ScrollArea className="h-40 border rounded-lg p-2">
              <div className="grid grid-cols-2 gap-1.5">
                {(filteredPresets.length > 0 ? filteredPresets : DIAGRAM_PRESETS).map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      updateContent(block.id, {
                        code: preset.code,
                        diagramType: preset.diagramType as "flowchart" | "sequence" | "block" | "state" | "tree" | "custom",
                        preset: preset.id,
                      });
                      setShowPresets(false);
                    }}
                    className="flex flex-col items-start p-2 rounded-lg border border-border/50 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 hover:border-indigo-300 transition-colors text-left"
                  >
                    <span className="text-xs font-medium">{preset.name}</span>
                    <span className="text-[9px] text-muted-foreground">{preset.description}</span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}

          <textarea
            value={content.code}
            onChange={(e) => updateContent(block.id, { code: e.target.value })}
            placeholder="TikZコードを入力..."
            className="w-full font-mono text-xs p-2 h-24 rounded-lg border border-indigo-200 dark:border-indigo-800 focus:ring-indigo-400 bg-slate-50 dark:bg-slate-900 resize-y"
          />
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
  const [showPresets, setShowPresets] = useState(!content.formula);

  return (
    <div className="space-y-2">
      {/* Preview */}
      <div className={`flex justify-center py-3 px-4 rounded-lg ${!content.formula ? "bg-lime-50/50 dark:bg-lime-950/20" : ""}`}>
        {content.formula ? (
          <MathRenderer latex={`\\ce{${content.formula}}`} displayMode={content.displayMode} />
        ) : (
          <span className="text-muted-foreground/40 text-sm italic flex items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            化学式を入力 (mhchem)
          </span>
        )}
      </div>

      {isEditing && (
        <div className="space-y-2">
          <div className="flex gap-2 items-center">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7 gap-1"
              onClick={() => setShowPresets(!showPresets)}
            >
              <Sparkles className="h-3 w-3" />
              テンプレート
            </Button>
            <Input
              value={content.caption || ""}
              onChange={(e) => updateContent(block.id, { caption: e.target.value })}
              placeholder="キャプション"
              className="h-7 text-xs flex-1"
            />
          </div>

          {showPresets && (
            <ScrollArea className="h-36 border rounded-lg p-2">
              <div className="grid grid-cols-2 gap-1.5">
                {CHEMISTRY_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      updateContent(block.id, { formula: preset.formula });
                      setShowPresets(false);
                    }}
                    className="flex flex-col items-start p-2 rounded-lg border border-border/50 hover:bg-lime-50 dark:hover:bg-lime-950/20 hover:border-lime-300 transition-colors text-left"
                  >
                    <span className="text-xs font-medium">{preset.name}</span>
                    <span className="text-[9px] text-muted-foreground">{preset.description}</span>
                    <span className="text-[9px] font-mono text-lime-600 mt-0.5">{preset.formula}</span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}

          <div className="relative">
            <div className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-mono text-lime-500 select-none pointer-events-none flex items-center gap-1">
              <FlaskConical className="h-3 w-3" />
              \\ce
            </div>
            <Input
              value={content.formula}
              onChange={(e) => updateContent(block.id, { formula: e.target.value })}
              placeholder="2H2 + O2 -> 2H2O"
              className="font-mono text-sm pl-14 h-9 rounded-lg border-lime-200 dark:border-lime-800 focus-visible:ring-lime-400"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {["->", "<=>", "^{2+}", "_{(aq)}", "->[\u89e6\u5a92]", "v", "^"].map((sym) => (
              <button
                key={sym}
                onClick={() => updateContent(block.id, { formula: content.formula + " " + sym + " " })}
                className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-lime-100 dark:bg-lime-900/30 text-lime-700 dark:text-lime-300 hover:bg-lime-200 transition-colors"
              >
                {sym}
              </button>
            ))}
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
  const [showPresets, setShowPresets] = useState(!content.code);

  return (
    <div className="space-y-2">
      <div className={`flex flex-col items-center py-4 px-4 rounded-lg ${!content.code ? "bg-rose-50/50 dark:bg-rose-950/20" : "bg-white dark:bg-gray-50"}`}>
        {content.code ? (
          <div className="text-center">
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 text-xs mb-2">
              <BarChart3 className="h-3 w-3" />
              グラフ (pgfplots)
            </div>
            <div className="font-mono text-[10px] text-muted-foreground bg-muted/30 p-2 rounded max-h-32 overflow-auto text-left whitespace-pre">
              {content.code.slice(0, 300)}{content.code.length > 300 ? "..." : ""}
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground/40 text-sm italic flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            グラフを選択または入力
          </span>
        )}
      </div>

      {isEditing && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Select
              value={content.chartType}
              onValueChange={(v) => updateContent(block.id, { chartType: v as "line" | "bar" | "scatter" | "histogram" })}
            >
              <SelectTrigger className="h-7 text-xs w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="line">折れ線</SelectItem>
                <SelectItem value="bar">棒グラフ</SelectItem>
                <SelectItem value="scatter">散布図</SelectItem>
                <SelectItem value="histogram">ヒストグラム</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7 gap-1"
              onClick={() => setShowPresets(!showPresets)}
            >
              <Sparkles className="h-3 w-3" />
              テンプレート
            </Button>
            <Input
              value={content.caption || ""}
              onChange={(e) => updateContent(block.id, { caption: e.target.value })}
              placeholder="キャプション"
              className="h-7 text-xs flex-1"
            />
          </div>

          {showPresets && (
            <ScrollArea className="h-40 border rounded-lg p-2">
              <div className="grid grid-cols-2 gap-1.5">
                {CHART_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      updateContent(block.id, { code: preset.code, chartType: preset.chartType as "line" | "bar" | "scatter" | "histogram", preset: preset.id });
                      setShowPresets(false);
                    }}
                    className="flex flex-col items-start p-2 rounded-lg border border-border/50 hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:border-rose-300 transition-colors text-left"
                  >
                    <span className="text-xs font-medium">{preset.name}</span>
                    <span className="text-[9px] text-muted-foreground">{preset.description}</span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}

          <textarea
            value={content.code}
            onChange={(e) => updateContent(block.id, { code: e.target.value })}
            placeholder="\\addplot[blue, thick, domain=0:360, samples=100] {sin(x)};"
            className="w-full font-mono text-xs p-2 h-24 rounded-lg border border-rose-200 dark:border-rose-800 focus:ring-rose-400 bg-slate-50 dark:bg-slate-900 resize-y"
          />
        </div>
      )}
    </div>
  );
}
