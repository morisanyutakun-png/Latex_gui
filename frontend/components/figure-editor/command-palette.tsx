"use client";

/**
 * CommandPalette — Cmd+K searchable command list.
 * Provides instant access to every tool, shape, and action.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useFigureStore } from "./figure-store";
import { PALETTE_ITEMS, CATEGORIES } from "./domain-palettes";
import type { ToolMode } from "./types";
import {
  Search, MousePointer2, Square, Circle, Minus, ArrowRight, Type, Pen,
  Trash2, Copy, Undo2, Redo2, ZoomIn, ZoomOut, Maximize2, Grid3x3, Magnet, Layers,
} from "lucide-react";

function useIsJa() {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem("lx-locale") === "ja"; } catch { return false; }
}

interface Command {
  id: string;
  title: string;
  titleJa: string;
  /** Short one-line description shown beneath the title */
  description?: string;
  descriptionJa?: string;
  category: string;
  icon: React.ReactNode;
  kbd?: string;
  run: () => void;
  /** Search keywords for fuzzy matching */
  keywords?: string;
}

export function CommandPalette({
  open, onClose, onOpenLayers, onFitToContent, onZoomIn, onZoomOut, onResetZoom,
}: {
  open: boolean;
  onClose: () => void;
  onOpenLayers: () => void;
  onFitToContent: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
}) {
  const isJa = useIsJa();
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const setActiveTool = useFigureStore((s) => s.setActiveTool);
  const setActiveCategory = useFigureStore((s) => s.setActiveCategory);

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Build all commands
  const commands: Command[] = useMemo(() => {
    const list: Command[] = [];

    // Core tools
    list.push(
      { id: "tool-select",   title: "Select", titleJa: "選択ツール",
        description: "Click to grab shapes, drag empty space for marquee selection",
        descriptionJa: "クリックで掴む、空の場所をドラッグで複数選択",
        category: "Tool", icon: <MousePointer2 size={13} />, kbd: "V", run: () => setActiveTool("select"), keywords: "pointer cursor move" },
      { id: "tool-rect",     title: "Rectangle", titleJa: "四角形",
        description: "Click two opposite corners to draw",
        descriptionJa: "対角の2点をクリックして描画", category: "Tool", icon: <Square size={13} />, kbd: "R", run: () => setActiveTool("rect") },
      { id: "tool-circle",   title: "Circle", titleJa: "円",
        description: "Click two points on a bounding box",
        descriptionJa: "外接矩形の2点をクリック", category: "Tool", icon: <Circle size={13} />, kbd: "C", run: () => setActiveTool("circle") },
      { id: "tool-line",     title: "Line", titleJa: "直線",
        description: "Click start and end (Shift to snap angles)",
        descriptionJa: "始点・終点をクリック (Shift で角度スナップ)", category: "Tool", icon: <Minus size={13} />, kbd: "L", run: () => setActiveTool("line") },
      { id: "tool-arrow",    title: "Arrow", titleJa: "矢印",
        description: "Directed line from start to end",
        descriptionJa: "始点から終点への矢印", category: "Tool", icon: <ArrowRight size={13} />, kbd: "A", run: () => setActiveTool("arrow") },
      { id: "tool-text",     title: "Text", titleJa: "テキスト",
        description: "Click to place a text label",
        descriptionJa: "クリックでテキストラベルを配置", category: "Tool", icon: <Type size={13} />, kbd: "T", run: () => setActiveTool("text") },
      { id: "tool-freehand", title: "Freehand", titleJa: "フリーハンド",
        description: "Drag to draw a custom path",
        descriptionJa: "ドラッグで自由に描画", category: "Tool", icon: <Pen size={13} />, run: () => setActiveTool("freehand") },
    );

    // Edit actions
    list.push(
      { id: "act-undo",      title: "Undo", titleJa: "元に戻す",
        description: "Revert the last change",
        descriptionJa: "直前の変更を取り消す", category: "Edit", icon: <Undo2 size={13} />, kbd: "⌘Z", run: () => useFigureStore.getState().undo() },
      { id: "act-redo",      title: "Redo", titleJa: "やり直し",
        description: "Re-apply the undone change",
        descriptionJa: "取り消した変更を再適用", category: "Edit", icon: <Redo2 size={13} />, kbd: "⇧⌘Z", run: () => useFigureStore.getState().redo() },
      { id: "act-duplicate", title: "Duplicate", titleJa: "複製",
        description: "Make a copy of the selected shapes",
        descriptionJa: "選択中の図形を複製", category: "Edit", icon: <Copy size={13} />, kbd: "⌘D", run: () => useFigureStore.getState().duplicateSelected() },
      { id: "act-delete",    title: "Delete selection", titleJa: "選択を削除",
        description: "Remove the selected shapes from the canvas",
        descriptionJa: "選択中の図形を削除", category: "Edit", icon: <Trash2 size={13} />, kbd: "Del", run: () => useFigureStore.getState().deleteSelected() },
      { id: "act-selectAll", title: "Select all", titleJa: "全選択",
        description: "Select every shape on the canvas",
        descriptionJa: "キャンバス上の全図形を選択", category: "Edit", icon: <Layers size={13} />, kbd: "⌘A", run: () => useFigureStore.getState().selectAll() },
      { id: "act-deselect",  title: "Deselect", titleJa: "選択解除",
        description: "Clear the current selection",
        descriptionJa: "現在の選択をクリア", category: "Edit", icon: <MousePointer2 size={13} />, kbd: "Esc", run: () => useFigureStore.getState().clearSelection() },
    );

    // View
    list.push(
      { id: "view-zoom-in",  title: "Zoom in", titleJa: "拡大",
        description: "Discrete zoom step toward the canvas center",
        descriptionJa: "段階的に拡大", category: "View", icon: <ZoomIn size={13} />, kbd: "⌘+", run: onZoomIn },
      { id: "view-zoom-out", title: "Zoom out", titleJa: "縮小",
        description: "Discrete zoom step away from the canvas center",
        descriptionJa: "段階的に縮小", category: "View", icon: <ZoomOut size={13} />, kbd: "⌘−", run: onZoomOut },
      { id: "view-zoom-reset", title: "Reset zoom to 100%", titleJa: "ズームを100%に戻す",
        description: "Returns to the default 1:1 view",
        descriptionJa: "等倍表示に戻す", category: "View", icon: <Maximize2 size={13} />, kbd: "⌘0", run: onResetZoom },
      { id: "view-fit",      title: "Fit all shapes to view", titleJa: "全図形に合わせて表示",
        description: "Auto-zoom and center so every shape is visible",
        descriptionJa: "全ての図形が見えるよう自動ズーム+センタリング", category: "View", icon: <Maximize2 size={13} />, run: onFitToContent },
      { id: "view-grid",     title: "Toggle grid", titleJa: "グリッド表示切替",
        description: "Show or hide the background grid lines",
        descriptionJa: "背景のグリッド線を表示/非表示", category: "View", icon: <Grid3x3 size={13} />, run: () => useFigureStore.getState().toggleShowGrid() },
      { id: "view-snap",     title: "Toggle snap to grid", titleJa: "スナップ切替",
        description: "Enable or disable smart snapping while moving",
        descriptionJa: "移動時のスマートスナップを有効/無効", category: "View", icon: <Magnet size={13} />, run: () => useFigureStore.getState().toggleSnapToGrid() },
      { id: "view-layers",   title: "Open layers panel", titleJa: "レイヤーパネルを開く",
        description: "List, reorder, lock, and toggle visibility for all shapes",
        descriptionJa: "全図形の一覧・並び替え・ロック・表示切替", category: "View", icon: <Layers size={13} />, run: onOpenLayers },
    );

    // Categories
    for (const cat of CATEGORIES) {
      list.push({
        id: `cat-${cat.id}`,
        title: `Category: ${cat.label}`,
        titleJa: `カテゴリ: ${cat.labelJa}`,
        category: "Category",
        icon: <span className="text-xs">{cat.icon}</span>,
        run: () => setActiveCategory(cat.id),
      });
    }

    // All palette items
    for (const item of PALETTE_ITEMS) {
      list.push({
        id: `shape-${item.kind}`,
        title: `Insert: ${item.label}`,
        titleJa: `挿入: ${item.labelJa}`,
        category: "Shape",
        icon: <span className="text-xs opacity-60">●</span>,
        run: () => setActiveTool(item.kind as ToolMode),
        keywords: `${item.description ?? ""} ${item.descriptionJa ?? ""} ${item.category}`,
      });
    }

    return list;
  }, [setActiveTool, setActiveCategory, onOpenLayers, onFitToContent, onZoomIn, onZoomOut, onResetZoom]);

  // Filter
  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter((c) =>
      c.title.toLowerCase().includes(q) ||
      c.titleJa.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q) ||
      (c.keywords ?? "").toLowerCase().includes(q)
    );
  }, [commands, query]);

  useEffect(() => {
    if (selectedIdx >= filtered.length) setSelectedIdx(0);
  }, [filtered.length, selectedIdx]);

  // Keyboard nav
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = filtered[selectedIdx];
      if (cmd) { cmd.run(); onClose(); }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] bg-black/40 backdrop-blur-sm animate-page-fade-in"
      onClick={onClose}
    >
      <div
        className="w-[560px] max-w-[90vw] bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-foreground/[0.08] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search box */}
        <div className="flex items-center gap-2 px-3 h-11 border-b border-foreground/[0.06]">
          <Search size={14} className="text-foreground/40" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder={isJa
              ? "コマンドや図形を検索…  例: 抵抗 / 複製 / 円 / レイヤー"
              : "Search commands, shapes, or actions…  e.g. resistor, duplicate, circle, layer"}
            className="flex-1 h-full text-[13px] bg-transparent focus:outline-none placeholder:text-foreground/30"
          />
          <kbd className="text-[9px] font-mono bg-foreground/[0.06] px-1.5 py-0.5 rounded text-foreground/55">Esc</kbd>
        </div>

        {/* Results list */}
        <div className="max-h-[50vh] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="text-center text-[11px] text-foreground/35 py-8">
              {isJa ? "該当なし" : "No matches"}
            </div>
          ) : (
            filtered.slice(0, 80).map((cmd, i) => {
              const active = i === selectedIdx;
              const desc = isJa ? cmd.descriptionJa : cmd.description;
              return (
                <button
                  key={cmd.id}
                  onClick={() => { cmd.run(); onClose(); }}
                  onMouseEnter={() => setSelectedIdx(i)}
                  className={`w-full flex items-start gap-2.5 px-3 py-2 text-left transition-colors ${
                    active ? "bg-blue-500/10" : "hover:bg-foreground/[0.04]"
                  }`}
                >
                  <span className={`shrink-0 mt-0.5 ${active ? "text-blue-600" : "text-foreground/55"}`}>
                    {cmd.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[11.5px] truncate ${active ? "text-foreground font-medium" : "text-foreground/80"}`}>
                        {isJa ? cmd.titleJa : cmd.title}
                      </span>
                      <span className={`text-[9px] uppercase tracking-wider font-bold shrink-0 ${active ? "text-blue-600/70" : "text-foreground/35"}`}>
                        {cmd.category}
                      </span>
                    </div>
                    {desc && (
                      <div className={`text-[10px] truncate mt-0.5 ${active ? "text-foreground/65" : "text-foreground/40"}`}>
                        {desc}
                      </div>
                    )}
                  </div>
                  {cmd.kbd && (
                    <kbd className={`text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0 mt-1 ${
                      active ? "bg-blue-500/15 text-blue-700" : "bg-foreground/[0.06] text-foreground/55"
                    }`}>{cmd.kbd}</kbd>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-foreground/[0.06] text-[9px] text-foreground/40 bg-foreground/[0.02]">
          <div className="flex items-center gap-3">
            <span><kbd className="bg-foreground/[0.08] px-1 rounded">↑↓</kbd> {isJa ? "選択移動" : "Navigate"}</span>
            <span><kbd className="bg-foreground/[0.08] px-1 rounded">↵</kbd> {isJa ? "実行" : "Run"}</span>
            <span><kbd className="bg-foreground/[0.08] px-1 rounded">Esc</kbd> {isJa ? "閉じる" : "Close"}</span>
          </div>
          <span>{filtered.length} {isJa ? "件" : filtered.length === 1 ? "result" : "results"}</span>
        </div>
      </div>
    </div>
  );
}
