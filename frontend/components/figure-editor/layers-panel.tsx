"use client";

/**
 * LayersPanel — compact list of all shapes, with visibility/lock toggles,
 * z-index reordering, and click-to-select. Toggleable from the editor header.
 */

import React, { useState } from "react";
import { useFigureStore } from "./figure-store";
import type { FigureShape } from "./types";
import { Eye, EyeOff, Lock, Unlock, ChevronUp, ChevronDown, Layers, X } from "lucide-react";
import { getPaletteItem } from "./domain-palettes";

function useIsJa() {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem("lx-locale") === "ja"; } catch { return false; }
}

export function LayersPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const isJa = useIsJa();
  const shapes = useFigureStore((s) => s.shapes);
  const selectedIds = useFigureStore((s) => s.selectedIds);
  const select = useFigureStore((s) => s.select);
  const updateShape = useFigureStore((s) => s.updateShape);
  const deleteShape = useFigureStore((s) => s.deleteShape);
  const bringForward = useFigureStore((s) => s.bringForward);
  const sendBackward = useFigureStore((s) => s.sendBackward);
  const pushHistory = useFigureStore((s) => s.pushHistory);

  const [filter, setFilter] = useState("");

  if (!open) return null;

  // Sort by z-index descending (top layer first)
  const sorted = [...shapes].sort((a, b) => b.zIndex - a.zIndex);
  const filtered = filter
    ? sorted.filter((s) => (s.label || s.kind).toLowerCase().includes(filter.toLowerCase()))
    : sorted;

  return (
    <div className="absolute right-[244px] top-12 bottom-2 w-[260px] bg-background/95 backdrop-blur-md rounded-lg shadow-2xl border border-foreground/[0.1] flex flex-col overflow-hidden z-40 animate-scale-in">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-foreground/[0.06]">
        <Layers size={13} className="text-foreground/55" />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold text-foreground/75 leading-tight">
            {isJa ? "レイヤー" : "Layers"}
            <span className="ml-1.5 text-[9px] font-mono text-foreground/35">{shapes.length}</span>
          </div>
          <div className="text-[9px] text-foreground/35 leading-tight">
            {isJa ? "上にあるほど前面" : "Top entries are in front"}
          </div>
        </div>
        <button onClick={onClose}
          title={isJa ? "閉じる" : "Close panel"}
          className="p-1 rounded hover:bg-foreground/[0.06] text-foreground/40 hover:text-foreground/70">
          <X size={12} />
        </button>
      </div>

      {/* Search */}
      {shapes.length > 5 && (
        <div className="px-2.5 py-1.5 border-b border-foreground/[0.04]">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={isJa ? "ラベル・種類で検索…" : "Filter by label or kind…"}
            className="w-full h-6 px-2 text-[10px] rounded border border-foreground/[0.08] bg-white/70 dark:bg-white/5 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
          />
        </div>
      )}

      {/* Layer list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center text-[10px] text-foreground/30 py-8 px-3 leading-relaxed">
            {shapes.length === 0
              ? (isJa
                  ? "まだ図形がありません\n左パレットから図形を選んでキャンバスをクリック"
                  : "No shapes yet.\nPick a shape from the left palette and click the canvas to add one.")
              : (isJa ? "該当する図形がありません" : "No shapes match this filter")}
          </div>
        ) : (
          filtered.map((sh) => {
            const isSelected = selectedIds.includes(sh.id);
            const palette = getPaletteItem(sh.kind);
            const displayName = sh.label || (isJa ? palette?.labelJa : palette?.label) || sh.kind;
            return (
              <LayerRow
                key={sh.id}
                shape={sh}
                displayName={displayName}
                isJa={isJa}
                selected={isSelected}
                onClick={(ev) => select(sh.id, ev.shiftKey)}
                onToggleLock={() => {
                  pushHistory();
                  updateShape(sh.id, { locked: !sh.locked });
                }}
                onDelete={() => deleteShape(sh.id)}
                onUp={() => bringForward(sh.id)}
                onDown={() => sendBackward(sh.id)}
              />
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-2.5 py-1.5 border-t border-foreground/[0.06] text-[9px] text-foreground/40 leading-snug">
        {isJa
          ? "💡 クリックで選択 · ⇧ + クリックで複数選択 · ⌃⌄ で重なり順を変更"
          : "💡 Click to select · ⇧+click for multi · ⌃⌄ reorders z-stack"}
      </div>
    </div>
  );
}

function LayerRow({
  shape, displayName, isJa, selected, onClick, onToggleLock, onUp, onDown,
}: {
  shape: FigureShape;
  displayName: string;
  isJa: boolean;
  selected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onToggleLock: () => void;
  onDelete: () => void;
  onUp: () => void;
  onDown: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`group flex items-center gap-1.5 px-2.5 py-1.5 cursor-pointer transition-colors ${
        selected
          ? "bg-blue-500/10 hover:bg-blue-500/15"
          : "hover:bg-foreground/[0.04]"
      }`}
    >
      {/* Color swatch */}
      <div
        className="h-3.5 w-3.5 rounded-sm shrink-0 ring-1 ring-foreground/[0.1]"
        style={{
          backgroundColor: shape.style.fill === "none" ? "transparent" : shape.style.fill,
          borderTop: `2px solid ${shape.style.stroke}`,
        }}
      />

      {/* Name + kind */}
      <div className="flex-1 min-w-0">
        <div className={`text-[10.5px] truncate leading-tight ${
          selected ? "text-blue-700 dark:text-blue-300 font-semibold" : "text-foreground/75"
        }`}>
          {displayName}
        </div>
        <div className="text-[8.5px] font-mono text-foreground/30 truncate leading-tight">
          {shape.kind} · z={shape.zIndex}
        </div>
      </div>

      {/* Actions (visible on hover or selection) */}
      <div className={`flex items-center gap-0.5 transition-opacity ${
        selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
      }`}>
        <button
          onClick={(e) => { e.stopPropagation(); onUp(); }}
          title={isJa ? "1段前面へ" : "Move 1 step toward front"}
          className="h-5 w-5 flex items-center justify-center rounded hover:bg-foreground/10 text-foreground/40 hover:text-foreground/70"
        ><ChevronUp size={11} /></button>
        <button
          onClick={(e) => { e.stopPropagation(); onDown(); }}
          title={isJa ? "1段背面へ" : "Move 1 step toward back"}
          className="h-5 w-5 flex items-center justify-center rounded hover:bg-foreground/10 text-foreground/40 hover:text-foreground/70"
        ><ChevronDown size={11} /></button>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleLock(); }}
          title={shape.locked
            ? (isJa ? "ロック解除 (移動・編集可能に)" : "Unlock — allow editing")
            : (isJa ? "ロック (誤操作防止)" : "Lock — prevent accidental edits")}
          className={`h-5 w-5 flex items-center justify-center rounded ${
            shape.locked ? "text-amber-600" : "text-foreground/40 hover:text-foreground/70 hover:bg-foreground/10"
          }`}
        >{shape.locked ? <Lock size={10} /> : <Unlock size={10} />}</button>
      </div>

      {/* Persistent lock indicator (always shown when locked) */}
      {shape.locked && !selected && (
        <Lock size={10} className="text-amber-500 shrink-0 group-hover:hidden" />
      )}
    </div>
  );
}
