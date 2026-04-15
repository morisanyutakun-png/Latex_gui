"use client";

/**
 * FigureProperties — Right-side panel (v2 polished UI).
 *
 * Features:
 *  - Sticky header with shape kind + primary color indicator
 *  - Collapsible sections (Label, Geometry, Stroke, Fill, Line, Font, TikZ)
 *  - Visual stroke-width slider with live preview
 *  - 3-state arrow toggle (none / end / both)
 *  - Color picker with outlined selection
 *  - 9-way label position picker with mini-previews
 *  - Clean empty state
 */

import React, { useCallback, useEffect, useState } from "react";
import { useFigureStore } from "./figure-store";
import type { FigureShape, ShapeStyle, DashStyle, ArrowHead } from "./types";
import {
  IPE_COLORS, PEN_PRESETS, DASH_PATTERNS, OPACITY_PRESETS, ARROW_SIZES, colorRgb,
} from "./types";
import { ChevronRight, SlidersHorizontal, Tag, Move, Palette, PaintBucket, Minus, Type } from "lucide-react";
import { LabelEditor } from "./label-editor";

function useIsJa() {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem("lx-locale") === "ja"; } catch { return false; }
}

// ── IPE color palette (28 named colors, TikZ-compatible) ────────

const COLORS = IPE_COLORS.map((c) => ({ name: c.name, css: c.rgb }));

// Fill presets include "none" sentinel + IPE colors (use lighter tones first)
const FILL_PRESETS = [
  { name: "none",  css: "transparent" },
  ...IPE_COLORS.map((c) => ({ name: c.name, css: c.rgb })),
];

// Pen widths from IPE presets
const STROKE_WIDTHS = PEN_PRESETS;

// ══════════════════════════════════════════════════════════════════
//  Collapsible section
// ══════════════════════════════════════════════════════════════════

function Section({
  title, icon, children, defaultOpen = true, color = "amber",
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  /** Section accent color — subtle tint for the header */
  color?: "amber" | "blue" | "violet" | "emerald" | "rose" | "pink" | "gray";
}) {
  const [open, setOpen] = useState(defaultOpen);
  const colorClasses: Record<string, { text: string; bg: string; iconBg: string }> = {
    amber:   { text: "text-amber-700 dark:text-amber-400",   bg: "hover:bg-amber-50/60 dark:hover:bg-amber-500/5",    iconBg: "bg-amber-100 dark:bg-amber-500/15 text-amber-600" },
    blue:    { text: "text-blue-700 dark:text-blue-400",     bg: "hover:bg-blue-50/60 dark:hover:bg-blue-500/5",      iconBg: "bg-blue-100 dark:bg-blue-500/15 text-blue-600" },
    violet:  { text: "text-violet-700 dark:text-violet-400", bg: "hover:bg-violet-50/60 dark:hover:bg-violet-500/5",  iconBg: "bg-violet-100 dark:bg-violet-500/15 text-violet-600" },
    emerald: { text: "text-emerald-700 dark:text-emerald-400", bg: "hover:bg-emerald-50/60 dark:hover:bg-emerald-500/5", iconBg: "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600" },
    rose:    { text: "text-rose-700 dark:text-rose-400",     bg: "hover:bg-rose-50/60 dark:hover:bg-rose-500/5",      iconBg: "bg-rose-100 dark:bg-rose-500/15 text-rose-600" },
    pink:    { text: "text-pink-700 dark:text-pink-400",     bg: "hover:bg-pink-50/60 dark:hover:bg-pink-500/5",      iconBg: "bg-pink-100 dark:bg-pink-500/15 text-pink-600" },
    gray:    { text: "text-foreground/65",                   bg: "hover:bg-foreground/[0.03]",                        iconBg: "bg-foreground/[0.06] text-foreground/60" },
  };
  const c = colorClasses[color];
  return (
    <div className="border-b border-foreground/[0.05]">
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${c.text} ${c.bg}`}
      >
        <ChevronRight size={10} className={`transition-transform ${open ? "rotate-90" : ""} opacity-60`} />
        <span className={`h-5 w-5 rounded-md flex items-center justify-center ${c.iconBg}`}>
          {icon}
        </span>
        <span className="flex-1 text-left">{title}</span>
      </button>
      {open && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </div>
  );
}

function InputRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-foreground/45 w-10 shrink-0 font-mono uppercase">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  Color picker (shared for stroke & fill)
// ══════════════════════════════════════════════════════════════════

function ColorPicker({
  colors, value, onChange, allowNone = false,
}: {
  colors: { name?: string; label?: string; value?: string; css: string }[];
  value: string;
  onChange: (v: string) => void;
  allowNone?: boolean;
}) {
  return (
    <div>
      <div className="grid grid-cols-7 gap-1">
        {colors.map((c) => {
          const val = (c.name ?? c.value) as string;
          const active = value === val;
          const isNone = val === "none";
          return (
            <button
              key={val} title={c.name ?? c.label ?? val}
              onClick={() => onChange(val)}
              className={`relative h-6 w-6 rounded transition-all duration-120 ${
                active ? "ring-2 ring-blue-500 ring-offset-1 ring-offset-background scale-110 z-10" : "ring-1 ring-foreground/[0.12] hover:ring-foreground/40 hover:scale-110"
              }`}
              style={{
                backgroundColor: isNone ? "#fff" : c.css,
                backgroundImage: isNone ? "linear-gradient(135deg, transparent 44%, #ef4444 44% 56%, transparent 56%)" : undefined,
              }}
            >
              {c.css === "#ffffff" && !active && (
                <span className="absolute inset-0 rounded ring-1 ring-inset ring-foreground/15" />
              )}
            </button>
          );
        })}
      </div>
      <div className="text-[9px] text-foreground/40 mt-1 font-mono">{value === "none" ? "(none)" : value}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  Dash style picker (5 IPE patterns with line previews)
// ══════════════════════════════════════════════════════════════════

function DashStylePicker({ value, onChange, color }: { value: DashStyle; onChange: (s: DashStyle) => void; color: string }) {
  return (
    <div className="grid grid-cols-5 gap-1">
      {DASH_PATTERNS.map((p) => {
        const active = value === p.style;
        return (
          <button
            key={p.style}
            onClick={() => onChange(p.style)}
            title={p.label}
            className={`h-7 rounded-md flex items-center justify-center transition-all ${
              active
                ? "bg-blue-500/10 ring-1 ring-blue-500/60"
                : "bg-foreground/[0.03] hover:bg-foreground/[0.07] ring-1 ring-foreground/[0.05]"
            }`}
          >
            <svg width="32" height="6" viewBox="0 0 32 6">
              <line x1="2" y1="3" x2="30" y2="3"
                stroke={active ? "#2563eb" : color} strokeWidth="1.5"
                strokeDasharray={p.pattern || undefined} />
            </svg>
          </button>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  Arrow head picker (per-end, with shape preview)
// ══════════════════════════════════════════════════════════════════

const ARROW_HEAD_OPTIONS: { head: ArrowHead; label: string }[] = [
  { head: "none",     label: "—" },
  { head: "normal",   label: "▶" },
  { head: "fnormal",  label: "▷" },
  { head: "pointed",  label: "➤" },
  { head: "fpointed", label: "▻" },
  { head: "linear",   label: ">" },
  { head: "double",   label: "▶▶" },
  { head: "fdouble",  label: "▷▷" },
];

function ArrowHeadPicker({ value, onChange, side }: { value: ArrowHead; onChange: (h: ArrowHead) => void; side: "start" | "end" }) {
  return (
    <div className="grid grid-cols-4 gap-1">
      {ARROW_HEAD_OPTIONS.map((o) => {
        const active = value === o.head;
        return (
          <button key={o.head} onClick={() => onChange(o.head)} title={`${side}: ${o.head}`}
            className={`h-7 rounded-md flex items-center justify-center text-[11px] transition-all ${
              active ? "bg-blue-500 text-white shadow-sm" : "bg-foreground/[0.03] hover:bg-foreground/[0.08] text-foreground/70 ring-1 ring-foreground/[0.05]"
            }`}
            style={{ transform: side === "start" ? "scaleX(-1)" : undefined }}
          >{o.label}</button>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  Opacity quick chips
// ══════════════════════════════════════════════════════════════════

function OpacityChips({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="grid grid-cols-5 gap-1">
      {OPACITY_PRESETS.map((p) => {
        const active = Math.abs(value - p.value) < 0.01;
        return (
          <button key={p.value} onClick={() => onChange(p.value)}
            className={`h-7 rounded-md text-[10px] font-mono font-semibold transition-all ${
              active ? "bg-blue-500 text-white shadow-sm" : "bg-foreground/[0.03] hover:bg-foreground/[0.08] text-foreground/65 ring-1 ring-foreground/[0.05]"
            }`}
          >{p.label}</button>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  Arrow size selector
// ══════════════════════════════════════════════════════════════════

function ArrowSizePicker({ value, onChange }: { value: "tiny" | "small" | "normal" | "large"; onChange: (v: "tiny" | "small" | "normal" | "large") => void }) {
  return (
    <div className="grid grid-cols-4 gap-1">
      {ARROW_SIZES.map((s) => {
        const active = value === s.name;
        return (
          <button key={s.name} onClick={() => onChange(s.name)} title={s.name}
            className={`h-7 rounded-md text-[10px] font-mono font-semibold transition-all ${
              active ? "bg-blue-500 text-white shadow-sm" : "bg-foreground/[0.03] hover:bg-foreground/[0.08] text-foreground/65 ring-1 ring-foreground/[0.05]"
            }`}
          >{s.label}</button>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  Stroke width slider with live preview
// ══════════════════════════════════════════════════════════════════

function StrokeWidthPicker({ value, onChange, color }: { value: number; onChange: (v: number) => void; color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-6 gap-1">
        {STROKE_WIDTHS.map((sw) => {
          const active = Math.abs(value - sw.value) < 0.01;
          return (
            <button
              key={sw.value}
              title={`${sw.name} (${sw.value}pt)`}
              onClick={() => onChange(sw.value)}
              className={`h-7 rounded-md flex items-center justify-center transition-all ${
                active
                  ? "bg-blue-500/10 ring-1 ring-blue-500/60"
                  : "bg-foreground/[0.03] hover:bg-foreground/[0.07] ring-1 ring-foreground/[0.05]"
              }`}
            >
              <div style={{
                width: "60%",
                height: Math.max(1, sw.value * 1.4),
                backgroundColor: active ? "#2563eb" : color,
                borderRadius: "1px",
              }} />
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <input type="range" min="0.2" max="4" step="0.1" value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="flex-1 h-1 accent-blue-500" />
        <span className="text-[10px] font-mono text-foreground/50 w-10 text-right">{value.toFixed(1)}pt</span>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  Legacy 4-way arrow toggle (kept for compatibility, unused now)
// ══════════════════════════════════════════════════════════════════
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _ArrowStylePicker({
  start, end, onChange, color,
}: {
  start: boolean; end: boolean;
  onChange: (start: boolean, end: boolean) => void;
  color: string;
}) {
  const options: { start: boolean; end: boolean; label: string }[] = [
    { start: false, end: false, label: "—" },
    { start: false, end: true,  label: "→" },
    { start: true,  end: false, label: "←" },
    { start: true,  end: true,  label: "↔" },
  ];
  return (
    <div className="grid grid-cols-4 gap-1">
      {options.map((o, i) => {
        const active = start === o.start && end === o.end;
        return (
          <button key={i}
            onClick={() => onChange(o.start, o.end)}
            className={`h-7 rounded-md flex items-center justify-center text-sm transition-all ${
              active
                ? "bg-blue-500/10 ring-1 ring-blue-500/60 text-blue-600 dark:text-blue-400"
                : "bg-foreground/[0.03] hover:bg-foreground/[0.07] text-foreground/60 ring-1 ring-foreground/[0.05]"
            }`}
          >
            <span style={{ color: active ? "#2563eb" : color, fontWeight: 600 }}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  Number spinner (with keyboard support)
// ══════════════════════════════════════════════════════════════════

function NumberInput({
  value, onChange, step = 0.1, min, max,
}: {
  value: number; onChange: (v: number) => void;
  step?: number; min?: number; max?: number;
}) {
  return (
    <input type="number" step={step} min={min} max={max} value={value}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        if (!isNaN(v)) onChange(v);
      }}
      className="w-full h-6 px-1.5 text-[10px] font-mono rounded border border-foreground/[0.08] bg-white/70 dark:bg-white/5 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40" />
  );
}

// ══════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════

export function FigureProperties() {
  const isJa = useIsJa();
  const shapes = useFigureStore((s) => s.shapes);
  const selectedIds = useFigureStore((s) => s.selectedIds);
  const updateShape = useFigureStore((s) => s.updateShape);
  const applyStyleToSelected = useFigureStore((s) => s.applyStyleToSelected);
  const pushHistory = useFigureStore((s) => s.pushHistory);

  const selectedShape = selectedIds.length === 1
    ? shapes.find((s) => s.id === selectedIds[0]) ?? null
    : null;

  const handleStyleChange = useCallback((updates: Partial<ShapeStyle>) => {
    pushHistory();
    applyStyleToSelected(updates);
  }, [pushHistory, applyStyleToSelected]);

  const handleDimensionChange = useCallback((key: "x" | "y" | "width" | "height" | "rotation", value: number) => {
    if (!selectedShape) return;
    pushHistory();
    updateShape(selectedShape.id, { [key]: value });
  }, [selectedShape, pushHistory, updateShape]);

  const handleTikzOptionChange = useCallback((key: string, value: string) => {
    if (!selectedShape) return;
    pushHistory();
    const newOpts = { ...selectedShape.tikzOptions, [key]: value };
    updateShape(selectedShape.id, { tikzOptions: newOpts });
  }, [selectedShape, pushHistory, updateShape]);

  const W = "w-[252px]";

  // ══════ EMPTY STATE ══════

  if (selectedIds.length === 0) {
    return (
      <div className={`${W} shrink-0 my-2 mr-2 ml-0 rounded-xl flex flex-col relative`}
        style={{
          background:
            "linear-gradient(180deg, rgba(245,158,11,0.06) 0%, rgba(255,255,255,0.98) 14%, rgba(255,255,255,1) 100%)",
          border: "1px solid rgba(217, 119, 6, 0.18)",
          boxShadow:
            "0 1px 0 rgba(255,255,255,0.9) inset, " +
            "0 10px 30px -12px rgba(217, 119, 6, 0.22), " +
            "0 2px 8px -2px rgba(0,0,0,0.08)",
          overflow: "hidden",
        }}>
        {/* Top accent stripe indicating "properties" */}
        <div className="shrink-0 h-[3px] bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 rounded-t-xl" />
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 pt-10 flex flex-col items-center text-center gap-3">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-500/10 dark:to-orange-500/10 flex items-center justify-center shadow-inner">
              <SlidersHorizontal className="h-6 w-6 text-amber-500/70" />
            </div>
            <div>
              <h4 className="text-[12px] font-bold text-foreground/70">
                {isJa ? "プロパティ" : "Properties"}
              </h4>
              <p className="text-[10.5px] text-foreground/35 leading-relaxed mt-1 max-w-[200px]">
                {isJa ? "図形を選択すると、ここでラベル・色・サイズなどを編集できます"
                      : "Select a shape to edit its label, colors, size, and more."}
              </p>
            </div>
            <div className="mt-2 text-[9px] text-foreground/30 space-y-0.5">
              <div><kbd className="kbd">V</kbd> {isJa ? "選択モード" : "Select mode"}</div>
              <div>{isJa ? "ドラッグで範囲選択" : "Drag to select"}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ══════ MULTI-SELECTION ══════

  if (selectedIds.length > 1) {
    const firstShape = shapes.find((s) => s.id === selectedIds[0]);
    return (
      <div className={`${W} shrink-0 my-2 mr-2 ml-0 rounded-xl flex flex-col relative`}
        style={{
          background:
            "linear-gradient(180deg, rgba(245,158,11,0.06) 0%, rgba(255,255,255,0.98) 14%, rgba(255,255,255,1) 100%)",
          border: "1px solid rgba(217, 119, 6, 0.18)",
          boxShadow:
            "0 1px 0 rgba(255,255,255,0.9) inset, " +
            "0 10px 30px -12px rgba(217, 119, 6, 0.22), " +
            "0 2px 8px -2px rgba(0,0,0,0.08)",
          overflow: "hidden",
        }}>
        {/* Top accent stripe indicating "properties" */}
        <div className="shrink-0 h-[3px] bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 rounded-t-xl" />
        <div className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-foreground/[0.06] px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center">
              {selectedIds.length}
            </div>
            <span className="text-[11px] font-semibold text-foreground/70">
              {isJa ? "選択中" : "selected"}
            </span>
          </div>
        </div>
        <Section title={isJa ? "線の色" : "Stroke"} icon={<Palette size={11} />}>
          <ColorPicker colors={COLORS} value={firstShape?.style.stroke ?? "black"} onChange={(v) => handleStyleChange({ stroke: v })} />
        </Section>
        <Section title={isJa ? "塗り" : "Fill"} icon={<PaintBucket size={11} />}>
          <ColorPicker colors={FILL_PRESETS} value={firstShape?.style.fill ?? "none"} onChange={(v) => handleStyleChange({ fill: v })} allowNone />
        </Section>
        <Section title={isJa ? "線の太さ" : "Stroke Width"} icon={<Minus size={11} />}>
          <StrokeWidthPicker value={firstShape?.style.strokeWidth ?? 0.8} onChange={(v) => handleStyleChange({ strokeWidth: v })} color={firstShape?.style.stroke ?? "black"} />
        </Section>
        </div>
      </div>
    );
  }

  if (!selectedShape) return null;

  // ══════ SINGLE SELECTION ══════

  const strokeCss = COLORS.find((c) => c.name === selectedShape.style.stroke)?.css ?? selectedShape.style.stroke;

  return (
    <div className={`${W} shrink-0 my-2 mr-2 ml-0 rounded-xl flex flex-col relative`}
      style={{
        background: "linear-gradient(180deg, rgba(245,158,11,0.06) 0%, rgba(255,255,255,0.98) 14%, rgba(255,255,255,1) 100%)",
        border: "1px solid rgba(217, 119, 6, 0.18)",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.9) inset, " +
          "0 10px 30px -12px rgba(217, 119, 6, 0.22), " +
          "0 2px 8px -2px rgba(0,0,0,0.08)",
        overflow: "hidden",
      }}>
      {/* Top accent stripe indicating "properties" */}
      <div className="shrink-0 h-[3px] bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 rounded-t-xl" />
      <div className="flex-1 overflow-y-auto">

      {/* ══════ Sticky Header ══════ */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-foreground/[0.06] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div
            className="h-6 w-6 rounded-md flex items-center justify-center shrink-0 shadow-inner"
            style={{
              backgroundColor: selectedShape.style.fill === "none" ? "transparent" : selectedShape.style.fill,
              border: `1.5px solid ${strokeCss}`,
            }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold text-foreground/80 truncate">
              {selectedShape.label || selectedShape.kind}
            </div>
            <div className="text-[9px] font-mono text-foreground/35 uppercase tracking-wider truncate">
              {selectedShape.kind}
            </div>
          </div>
        </div>
      </div>

      {/* ══════ Label ══════ */}
      <Section title={isJa ? "ラベル" : "Label"} icon={<Tag size={11} />} color="blue">
        <LabelEditor
          shape={selectedShape}
          onUpdate={(u) => updateShape(selectedShape.id, u)}
          pushHistory={pushHistory}
        />
      </Section>

      {/* ══════ Geometry ══════ */}
      <Section title={isJa ? "位置・サイズ" : "Geometry"} icon={<Move size={11} />} color="emerald">
        <div className="grid grid-cols-2 gap-1.5">
          <InputRow label="X">
            <NumberInput value={selectedShape.x} onChange={(v) => handleDimensionChange("x", v)} />
          </InputRow>
          <InputRow label="Y">
            <NumberInput value={selectedShape.y} onChange={(v) => handleDimensionChange("y", v)} />
          </InputRow>
          <InputRow label={isJa ? "W" : "W"}>
            <NumberInput min={0.1} value={selectedShape.width} onChange={(v) => handleDimensionChange("width", Math.max(0.1, v))} />
          </InputRow>
          <InputRow label={isJa ? "H" : "H"}>
            <NumberInput min={0.1} value={selectedShape.height} onChange={(v) => handleDimensionChange("height", Math.max(0.1, v))} />
          </InputRow>
        </div>
        <InputRow label={isJa ? "Rot" : "Rot"}>
          <div className="flex items-center gap-2">
            <input type="range" min="-180" max="180" step="15" value={selectedShape.rotation}
              onChange={(e) => handleDimensionChange("rotation", parseFloat(e.target.value))}
              className="flex-1 h-1 accent-blue-500" />
            <span className="text-[10px] font-mono text-foreground/50 w-8 text-right">{selectedShape.rotation}°</span>
          </div>
        </InputRow>
      </Section>

      {/* ══════ Stroke ══════ */}
      <Section title={isJa ? "線の色" : "Stroke"} icon={<Palette size={11} />} color="violet">
        <ColorPicker colors={COLORS} value={selectedShape.style.stroke}
          onChange={(v) => handleStyleChange({ stroke: v })} />
      </Section>

      {/* ══════ Fill ══════ */}
      <Section title={isJa ? "塗りつぶし" : "Fill"} icon={<PaintBucket size={11} />} color="pink">
        <ColorPicker colors={FILL_PRESETS} value={selectedShape.style.fill}
          onChange={(v) => handleStyleChange({ fill: v })} allowNone />
        {selectedShape.style.fill !== "none" && (
          <div className="pt-1">
            <div className="text-[9px] text-foreground/40 font-medium uppercase tracking-wider mb-1">
              {isJa ? "塗りの不透明度" : "Fill opacity"}
            </div>
            <OpacityChips value={selectedShape.style.fillOpacity}
              onChange={(v) => handleStyleChange({ fillOpacity: v })} />
          </div>
        )}
      </Section>

      {/* ══════ Line / Pen (IPE-style) ══════ */}
      <Section title={isJa ? "線(ペン)" : "Line / Pen"} icon={<Minus size={11} />} color="amber">
        <div>
          <div className="text-[9px] text-foreground/40 font-medium uppercase tracking-wider mb-1">
            {isJa ? "太さ" : "Width"}
          </div>
          <StrokeWidthPicker value={selectedShape.style.strokeWidth}
            onChange={(v) => handleStyleChange({ strokeWidth: v })} color={strokeCss} />
        </div>

        <div className="pt-1">
          <div className="text-[9px] text-foreground/40 font-medium uppercase tracking-wider mb-1">
            {isJa ? "破線パターン" : "Dash pattern"}
          </div>
          <DashStylePicker
            value={(selectedShape.style.dashStyle ?? (selectedShape.style.dashed ? "dashed" : "solid")) as DashStyle}
            color={strokeCss}
            onChange={(s) => handleStyleChange({ dashStyle: s })}
          />
        </div>

        <div className="pt-1">
          <div className="text-[9px] text-foreground/40 font-medium uppercase tracking-wider mb-1">
            {isJa ? "線の不透明度" : "Stroke opacity"}
          </div>
          <OpacityChips value={selectedShape.style.strokeOpacity ?? 1}
            onChange={(v) => handleStyleChange({ strokeOpacity: v })} />
        </div>
      </Section>

      {/* ══════ Arrows (IPE-style: per-end shape + size) ══════ */}
      <Section title={isJa ? "矢印" : "Arrows"} icon={<span className="text-[11px]">→</span>} color="rose">
        <div>
          <div className="text-[9px] text-foreground/40 font-medium uppercase tracking-wider mb-1">
            {isJa ? "始点" : "Start"}
          </div>
          <ArrowHeadPicker side="start"
            value={selectedShape.style.arrowStartHead ?? (selectedShape.style.arrowStart ? "normal" : "none")}
            onChange={(h) => handleStyleChange({ arrowStartHead: h })}
          />
        </div>
        <div className="pt-1">
          <div className="text-[9px] text-foreground/40 font-medium uppercase tracking-wider mb-1">
            {isJa ? "終点" : "End"}
          </div>
          <ArrowHeadPicker side="end"
            value={selectedShape.style.arrowEndHead ?? (selectedShape.style.arrowEnd ? "normal" : "none")}
            onChange={(h) => handleStyleChange({ arrowEndHead: h })}
          />
        </div>
        <div className="pt-1">
          <div className="text-[9px] text-foreground/40 font-medium uppercase tracking-wider mb-1">
            {isJa ? "サイズ" : "Size"}
          </div>
          <ArrowSizePicker value={selectedShape.style.arrowSize ?? "normal"}
            onChange={(v) => handleStyleChange({ arrowSize: v })} />
        </div>
      </Section>

      {/* ══════ Font ══════ */}
      <Section title={isJa ? "フォント" : "Font"} icon={<Type size={11} />} color="gray" defaultOpen={false}>
        <InputRow label={isJa ? "Size" : "Size"}>
          <select value={selectedShape.style.fontSizePt}
            onChange={(e) => handleStyleChange({ fontSizePt: parseFloat(e.target.value) })}
            className="w-full h-6 px-1 text-[10px] rounded border border-foreground/[0.08] bg-white/70 dark:bg-white/5 focus:outline-none">
            {[6, 8, 9, 10, 11, 12, 14, 16, 18, 22, 28].map((s) => (
              <option key={s} value={s}>{s}pt</option>
            ))}
          </select>
        </InputRow>
      </Section>

      {/* ══════ TikZ options (shown only if present) ══════ */}
      {Object.keys(selectedShape.tikzOptions).length > 0 && (
        <Section title={isJa ? "TikZオプション" : "TikZ"} icon={<span className="text-[9px] font-bold font-mono">{'{}'}</span>} color="gray" defaultOpen={false}>
          {Object.entries(selectedShape.tikzOptions).map(([key, value]) => (
            <InputRow key={key} label={key.length > 6 ? key.slice(0, 6) : key}>
              <input value={value}
                onChange={(e) => handleTikzOptionChange(key, e.target.value)}
                className="w-full h-6 px-1.5 text-[10px] font-mono rounded border border-foreground/[0.08] bg-white/70 dark:bg-white/5 focus:outline-none focus:ring-1 focus:ring-blue-500/40" />
            </InputRow>
          ))}
        </Section>
      )}

      {/* Bottom spacer */}
      <div className="h-4" />
      </div>
    </div>
  );
}
