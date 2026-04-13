"use client";

/**
 * FigureToolbar — Left sidebar with tool selection and domain palettes.
 * Inspired by IguanaTex's category-based tool organization.
 */

import React, { useState } from "react";
import { useFigureStore } from "./figure-store";
import { CATEGORIES, getItemsByCategory, type CategoryMeta } from "./domain-palettes";
import type { DomainCategory, DomainPaletteItem, ToolMode } from "./types";
import {
  MousePointer2, Square, Circle, Minus, ArrowRight,
  Type, Triangle, Pen, Undo2, Redo2, Trash2, Copy,
  Grid3x3, Magnet, MoveVertical, MoveDown,
} from "lucide-react";

// ── Locale hook ─────────────────────────────────────────────────

function useIsJa() {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem("lx-locale") === "ja";
  } catch { return false; }
}

// ── Shape icon SVGs ─────────────────────────────────────────────

function ShapeIcon({ kind, size = 18 }: { kind: string; size?: number }) {
  const s = size;
  switch (kind) {
    case "rect":
    case "flowchart-process":
    case "mass":
      return <Square size={s} />;
    case "circle":
    case "automaton-state":
    case "orbital-s":
    case "nucleus":
    case "pulley":
      return <Circle size={s} />;
    case "ellipse":
    case "cell":
    case "mitochondria":
    case "orbital-p":
      return (
        <svg width={s} height={s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <ellipse cx="10" cy="10" rx="9" ry="6" />
        </svg>
      );
    case "line":
    case "bond-single":
      return <Minus size={s} />;
    case "arrow":
    case "force-arrow":
    case "vector":
    case "reaction-arrow":
      return <ArrowRight size={s} />;
    case "text":
      return <Type size={s} />;
    case "polygon":
    case "prism":
      return <Triangle size={s} />;
    case "freehand":
      return <Pen size={s} />;
    case "resistor":
      return (
        <svg width={s} height={s} viewBox="0 0 24 14" fill="none" stroke="currentColor" strokeWidth="1.3">
          <path d="M0,7 L4,7 L5,2 L7,12 L9,2 L11,12 L13,2 L15,12 L16,7 L24,7" />
        </svg>
      );
    case "capacitor":
      return (
        <svg width={s} height={s} viewBox="0 0 24 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="0" y1="8" x2="9" y2="8" /><line x1="9" y1="2" x2="9" y2="14" />
          <line x1="15" y1="2" x2="15" y2="14" /><line x1="15" y1="8" x2="24" y2="8" />
        </svg>
      );
    case "inductor":
      return (
        <svg width={s} height={s} viewBox="0 0 24 14" fill="none" stroke="currentColor" strokeWidth="1.3">
          <path d="M0,10 L3,10 C3,4 7,4 7,10 C7,4 11,4 11,10 C11,4 15,4 15,10 C15,4 19,4 19,10 L24,10" />
        </svg>
      );
    case "voltage-source":
    case "current-source":
      return (
        <svg width={s} height={s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3">
          <circle cx="10" cy="10" r="8" />
          <text x="10" y="8" textAnchor="middle" fontSize="8" fill="currentColor" stroke="none">+</text>
          <text x="10" y="16" textAnchor="middle" fontSize="10" fill="currentColor" stroke="none">-</text>
        </svg>
      );
    case "ground":
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
          <line x1="8" y1="0" x2="8" y2="5" />
          <line x1="2" y1="5" x2="14" y2="5" />
          <line x1="4" y1="8" x2="12" y2="8" />
          <line x1="6" y1="11" x2="10" y2="11" />
        </svg>
      );
    case "spring":
      return (
        <svg width={s} height={s} viewBox="0 0 24 12" fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M0,6 L3,6 L4,2 L6,10 L8,2 L10,10 L12,2 L14,10 L16,2 L18,10 L19,6 L24,6" />
        </svg>
      );
    case "flowchart-decision":
      return (
        <svg width={s} height={s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3">
          <polygon points="10,1 19,10 10,19 1,10" />
        </svg>
      );
    case "flowchart-terminal":
      return (
        <svg width={s} height={s} viewBox="0 0 24 14" fill="none" stroke="currentColor" strokeWidth="1.3">
          <rect x="1" y="1" width="22" height="12" rx="6" />
        </svg>
      );
    case "automaton-accept":
      return (
        <svg width={s} height={s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3">
          <circle cx="10" cy="10" r="9" /><circle cx="10" cy="10" r="7" />
        </svg>
      );
    case "benzene":
      return (
        <svg width={s} height={s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.2">
          <polygon points="10,1 18,5 18,15 10,19 2,15 2,5" />
          <circle cx="10" cy="10" r="4" />
        </svg>
      );
    case "bond-double":
      return (
        <svg width={s} height={s} viewBox="0 0 20 12" fill="none" stroke="currentColor" strokeWidth="1.3">
          <line x1="1" y1="4" x2="19" y2="4" /><line x1="1" y1="8" x2="19" y2="8" />
        </svg>
      );
    case "bond-triple":
      return (
        <svg width={s} height={s} viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.2">
          <line x1="1" y1="3" x2="19" y2="3" /><line x1="1" y1="7" x2="19" y2="7" /><line x1="1" y1="11" x2="19" y2="11" />
        </svg>
      );
    case "axes":
      return (
        <svg width={s} height={s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="3" y1="17" x2="19" y2="17" /><line x1="3" y1="17" x2="3" y2="1" />
          <polygon points="19,17 16,15 16,19" fill="currentColor" stroke="none" />
          <polygon points="3,1 1,4 5,4" fill="currentColor" stroke="none" />
        </svg>
      );
    case "function-plot":
      return (
        <svg width={s} height={s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3">
          <line x1="2" y1="18" x2="18" y2="18" /><line x1="2" y1="18" x2="2" y2="2" />
          <path d="M3,16 Q8,0 12,10 Q16,20 18,4" strokeWidth="1.5" />
        </svg>
      );
    default:
      return <Square size={s} />;
  }
}

// ── Tool button ─────────────────────────────────────────────────

function ToolBtn({
  tool,
  icon,
  label,
  active,
  onClick,
}: {
  tool: ToolMode;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-150 ${
        active
          ? "bg-blue-500 text-white shadow-sm shadow-blue-500/30"
          : "text-foreground/50 hover:bg-foreground/[0.06] hover:text-foreground/80"
      }`}
    >
      {icon}
    </button>
  );
}

// ── Palette item button ─────────────────────────────────────────

function PaletteItemBtn({
  item,
  active,
  isJa,
  onClick,
}: {
  item: DomainPaletteItem;
  active: boolean;
  isJa: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={isJa ? (item.descriptionJa || item.labelJa) : (item.description || item.label)}
      className={`flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all duration-150 min-w-[56px] ${
        active
          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/30"
          : "text-foreground/60 hover:bg-foreground/[0.05] hover:text-foreground/80"
      }`}
    >
      <div className="h-6 w-6 flex items-center justify-center">
        <ShapeIcon kind={item.kind} size={16} />
      </div>
      <span className="text-[9px] font-medium leading-tight text-center truncate max-w-[56px]">
        {isJa ? item.labelJa : item.label}
      </span>
    </button>
  );
}

// ── Main component ──────────────────────────────────────────────

export function FigureToolbar() {
  const isJa = useIsJa();

  const activeTool = useFigureStore((s) => s.activeTool);
  const activeCategory = useFigureStore((s) => s.activeCategory);
  const setActiveTool = useFigureStore((s) => s.setActiveTool);
  const setActiveCategory = useFigureStore((s) => s.setActiveCategory);
  const undo = useFigureStore((s) => s.undo);
  const redo = useFigureStore((s) => s.redo);
  const deleteSelected = useFigureStore((s) => s.deleteSelected);
  const duplicateSelected = useFigureStore((s) => s.duplicateSelected);
  const selectedIds = useFigureStore((s) => s.selectedIds);
  const past = useFigureStore((s) => s.past);
  const future = useFigureStore((s) => s.future);
  const snapToGrid = useFigureStore((s) => s.snapToGrid);
  const showGrid = useFigureStore((s) => s.showGrid);
  const toggleSnapToGrid = useFigureStore((s) => s.toggleSnapToGrid);
  const toggleShowGrid = useFigureStore((s) => s.toggleShowGrid);
  const bringForward = useFigureStore((s) => s.bringForward);
  const sendBackward = useFigureStore((s) => s.sendBackward);

  const paletteItems = getItemsByCategory(activeCategory);

  return (
    <div className="w-[240px] shrink-0 flex flex-col border-r border-foreground/[0.06] bg-background/80 backdrop-blur-sm overflow-hidden">

      {/* ── Top tools ── */}
      <div className="px-2.5 py-2 border-b border-foreground/[0.06]">
        <div className="flex items-center gap-0.5 flex-wrap">
          <ToolBtn tool="select" icon={<MousePointer2 size={16} />} label={isJa ? "選択 (V)" : "Select (V)"} active={activeTool === "select"} onClick={() => setActiveTool("select")} />
          <div className="w-px h-5 bg-foreground/[0.08] mx-0.5" />
          <ToolBtn tool="rect" icon={<Square size={16} />} label={isJa ? "四角形 (R)" : "Rect (R)"} active={activeTool === "rect"} onClick={() => setActiveTool("rect")} />
          <ToolBtn tool="circle" icon={<Circle size={16} />} label={isJa ? "円 (C)" : "Circle (C)"} active={activeTool === "circle"} onClick={() => setActiveTool("circle")} />
          <ToolBtn tool="line" icon={<Minus size={16} />} label={isJa ? "直線 (L)" : "Line (L)"} active={activeTool === "line"} onClick={() => setActiveTool("line")} />
          <ToolBtn tool="arrow" icon={<ArrowRight size={16} />} label={isJa ? "矢印" : "Arrow"} active={activeTool === "arrow"} onClick={() => setActiveTool("arrow")} />
          <ToolBtn tool="text" icon={<Type size={16} />} label={isJa ? "テキスト (T)" : "Text (T)"} active={activeTool === "text"} onClick={() => setActiveTool("text")} />
          <ToolBtn tool="freehand" icon={<Pen size={16} />} label={isJa ? "フリー" : "Free"} active={activeTool === "freehand"} onClick={() => setActiveTool("freehand")} />
        </div>
      </div>

      {/* ── Actions bar ── */}
      <div className="px-2.5 py-1.5 border-b border-foreground/[0.06] flex items-center gap-0.5">
        <button onClick={undo} disabled={past.length === 0} title={isJa ? "元に戻す" : "Undo"}
          className="p-1.5 rounded-md text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <Undo2 size={14} />
        </button>
        <button onClick={redo} disabled={future.length === 0} title={isJa ? "やり直し" : "Redo"}
          className="p-1.5 rounded-md text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <Redo2 size={14} />
        </button>
        <div className="w-px h-4 bg-foreground/[0.08] mx-0.5" />
        <button onClick={duplicateSelected} disabled={selectedIds.length === 0} title={isJa ? "複製" : "Duplicate"}
          className="p-1.5 rounded-md text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <Copy size={14} />
        </button>
        <button onClick={deleteSelected} disabled={selectedIds.length === 0} title={isJa ? "削除" : "Delete"}
          className="p-1.5 rounded-md text-foreground/40 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <Trash2 size={14} />
        </button>
        <div className="w-px h-4 bg-foreground/[0.08] mx-0.5" />
        <button onClick={() => selectedIds[0] && bringForward(selectedIds[0])} disabled={selectedIds.length === 0} title={isJa ? "前面へ" : "Bring Forward"}
          className="p-1.5 rounded-md text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <MoveVertical size={14} />
        </button>
        <button onClick={() => selectedIds[0] && sendBackward(selectedIds[0])} disabled={selectedIds.length === 0} title={isJa ? "背面へ" : "Send Backward"}
          className="p-1.5 rounded-md text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <MoveDown size={14} />
        </button>
        <div className="flex-1" />
        <button onClick={toggleShowGrid} title={isJa ? "グリッド表示" : "Toggle Grid"}
          className={`p-1.5 rounded-md transition-colors ${showGrid ? "text-blue-500 bg-blue-50 dark:bg-blue-500/10" : "text-foreground/30 hover:text-foreground/60"}`}>
          <Grid3x3 size={14} />
        </button>
        <button onClick={toggleSnapToGrid} title={isJa ? "グリッドスナップ" : "Snap to Grid"}
          className={`p-1.5 rounded-md transition-colors ${snapToGrid ? "text-blue-500 bg-blue-50 dark:bg-blue-500/10" : "text-foreground/30 hover:text-foreground/60"}`}>
          <Magnet size={14} />
        </button>
      </div>

      {/* ── Category tabs ── */}
      <div className="px-1.5 py-1.5 border-b border-foreground/[0.06] overflow-x-auto scrollbar-none">
        <div className="flex gap-0.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-semibold whitespace-nowrap transition-all duration-150 ${
                activeCategory === cat.id
                  ? "bg-foreground/[0.08] text-foreground shadow-sm"
                  : "text-foreground/40 hover:text-foreground/65 hover:bg-foreground/[0.04]"
              }`}
            >
              <span className="text-[11px]">{cat.icon}</span>
              <span>{isJa ? cat.labelJa : cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Palette items ── */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        <div className="grid grid-cols-3 gap-1">
          {paletteItems.map((item) => (
            <PaletteItemBtn
              key={item.kind}
              item={item}
              active={activeTool === item.kind}
              isJa={isJa}
              onClick={() => setActiveTool(item.kind)}
            />
          ))}
        </div>
        {paletteItems.length === 0 && (
          <div className="text-center text-foreground/30 text-xs py-8">
            {isJa ? "カテゴリを選択してください" : "Select a category"}
          </div>
        )}
      </div>
    </div>
  );
}
