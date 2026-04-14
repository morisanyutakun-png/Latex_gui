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
import type { FigureShape, ShapeStyle } from "./types";
import { ChevronRight, Sparkles, Tag, Move, Palette, PaintBucket, Minus, Type } from "lucide-react";
import { LabelEditor } from "./label-editor";

function useIsJa() {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem("lx-locale") === "ja"; } catch { return false; }
}

// ── Color palette (extended) ────────────────────────────────────

const COLORS = [
  { name: "black",   css: "#000000" },
  { name: "gray",    css: "#6b7280" },
  { name: "red",     css: "#dc2626" },
  { name: "orange",  css: "#ea580c" },
  { name: "yellow",  css: "#eab308" },
  { name: "green",   css: "#16a34a" },
  { name: "teal",    css: "#0d9488" },
  { name: "cyan",    css: "#06b6d4" },
  { name: "blue",    css: "#2563eb" },
  { name: "violet",  css: "#7c3aed" },
  { name: "pink",    css: "#ec4899" },
  { name: "white",   css: "#ffffff" },
];

const FILL_PRESETS = [
  { label: "None",  value: "none",    css: "transparent" },
  { label: "White", value: "white",   css: "#ffffff" },
  { label: "Blue",  value: "#dbeafe", css: "#dbeafe" },
  { label: "Green", value: "#dcfce7", css: "#dcfce7" },
  { label: "Yellow",value: "#fef3c7", css: "#fef3c7" },
  { label: "Red",   value: "#fecaca", css: "#fecaca" },
  { label: "Purple",value: "#e9d5ff", css: "#e9d5ff" },
  { label: "Gray",  value: "#e5e7eb", css: "#e5e7eb" },
];

const STROKE_WIDTHS = [
  { label: "Hair", value: 0.4 },
  { label: "Thin", value: 0.6 },
  { label: "Normal", value: 0.8 },
  { label: "Thick", value: 1.2 },
  { label: "Bold",  value: 2 },
  { label: "Heavy", value: 3 },
];

// ══════════════════════════════════════════════════════════════════
//  Collapsible section
// ══════════════════════════════════════════════════════════════════

function Section({
  title, icon, children, defaultOpen = true, accent,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  accent?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-foreground/[0.05]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-foreground/55 hover:text-foreground/80 hover:bg-foreground/[0.03] transition-colors"
      >
        <ChevronRight
          size={10}
          className={`transition-transform ${open ? "rotate-90" : ""}`}
        />
        <span className={accent ?? "text-foreground/55"}>{icon}</span>
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
    <div className="grid grid-cols-6 gap-1">
      {colors.map((c) => {
        const val = (c.name ?? c.value) as string;
        const active = value === val;
        const isNone = val === "none";
        return (
          <button
            key={val} title={c.name ?? c.label ?? val}
            onClick={() => onChange(val)}
            className={`relative h-7 rounded-md transition-all duration-120 ${
              active ? "ring-2 ring-blue-500 ring-offset-1 ring-offset-background scale-105" : "ring-1 ring-foreground/[0.1] hover:ring-foreground/30 hover:scale-105"
            }`}
            style={{
              backgroundColor: isNone ? "#fff" : c.css,
              backgroundImage: isNone ? "linear-gradient(135deg, transparent 45%, #ef4444 45% 55%, transparent 55%)" : undefined,
            }}
          >
            {c.css === "#ffffff" && !active && (
              <span className="absolute inset-0 rounded-md ring-1 ring-inset ring-foreground/10" />
            )}
          </button>
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
              title={`${sw.label} (${sw.value}pt)`}
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
//  Arrow style picker (4-way visual toggle)
// ══════════════════════════════════════════════════════════════════

function ArrowStylePicker({
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

  const W = "w-[240px]";

  // ══════ EMPTY STATE ══════

  if (selectedIds.length === 0) {
    return (
      <div className={`${W} shrink-0 border-l border-foreground/[0.06] bg-background/85 backdrop-blur-sm overflow-y-auto`}>
        <div className="p-6 pt-10 flex flex-col items-center text-center gap-3">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-100 to-violet-100 dark:from-blue-500/10 dark:to-violet-500/10 flex items-center justify-center shadow-inner">
            <Sparkles className="h-6 w-6 text-blue-500/60" />
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
    );
  }

  // ══════ MULTI-SELECTION ══════

  if (selectedIds.length > 1) {
    const firstShape = shapes.find((s) => s.id === selectedIds[0]);
    return (
      <div className={`${W} shrink-0 border-l border-foreground/[0.06] bg-background/85 backdrop-blur-sm overflow-y-auto`}>
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
    );
  }

  if (!selectedShape) return null;

  // ══════ SINGLE SELECTION ══════

  const strokeCss = COLORS.find((c) => c.name === selectedShape.style.stroke)?.css ?? selectedShape.style.stroke;

  return (
    <div className={`${W} shrink-0 border-l border-foreground/[0.06] bg-background/85 backdrop-blur-sm overflow-y-auto`}>

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
      <Section title={isJa ? "ラベル" : "Label"} icon={<Tag size={11} />} accent="text-blue-500">
        <LabelEditor
          shape={selectedShape}
          onUpdate={(u) => updateShape(selectedShape.id, u)}
          pushHistory={pushHistory}
        />
      </Section>

      {/* ══════ Geometry ══════ */}
      <Section title={isJa ? "位置・サイズ" : "Geometry"} icon={<Move size={11} />}>
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
      <Section title={isJa ? "線の色" : "Stroke"} icon={<Palette size={11} />}>
        <ColorPicker colors={COLORS} value={selectedShape.style.stroke}
          onChange={(v) => handleStyleChange({ stroke: v })} />
      </Section>

      {/* ══════ Fill ══════ */}
      <Section title={isJa ? "塗りつぶし" : "Fill"} icon={<PaintBucket size={11} />}>
        <ColorPicker colors={FILL_PRESETS} value={selectedShape.style.fill}
          onChange={(v) => handleStyleChange({ fill: v })} allowNone />
        {selectedShape.style.fill !== "none" && (
          <InputRow label={isJa ? "Opa" : "Opa"}>
            <div className="flex items-center gap-2">
              <input type="range" min="0" max="1" step="0.05" value={selectedShape.style.fillOpacity}
                onChange={(e) => handleStyleChange({ fillOpacity: parseFloat(e.target.value) })}
                className="flex-1 h-1 accent-blue-500" />
              <span className="text-[10px] font-mono text-foreground/50 w-8 text-right">
                {Math.round(selectedShape.style.fillOpacity * 100)}%
              </span>
            </div>
          </InputRow>
        )}
      </Section>

      {/* ══════ Line ══════ */}
      <Section title={isJa ? "線のスタイル" : "Line"} icon={<Minus size={11} />}>
        <StrokeWidthPicker value={selectedShape.style.strokeWidth}
          onChange={(v) => handleStyleChange({ strokeWidth: v })} color={strokeCss} />

        <div className="pt-1">
          <div className="text-[9px] text-foreground/40 font-medium uppercase tracking-wider mb-1">
            {isJa ? "矢印" : "Arrows"}
          </div>
          <ArrowStylePicker
            start={selectedShape.style.arrowStart} end={selectedShape.style.arrowEnd}
            color={strokeCss}
            onChange={(s, e) => handleStyleChange({ arrowStart: s, arrowEnd: e })}
          />
        </div>

        <label className="flex items-center gap-1.5 text-[10px] text-foreground/60 cursor-pointer hover:text-foreground/85 transition-colors pt-1">
          <input type="checkbox" checked={selectedShape.style.dashed}
            onChange={(e) => handleStyleChange({ dashed: e.target.checked })}
            className="rounded border-foreground/20 accent-blue-500 w-3 h-3" />
          <span>{isJa ? "破線" : "Dashed"}</span>
        </label>
      </Section>

      {/* ══════ Font ══════ */}
      <Section title={isJa ? "フォント" : "Font"} icon={<Type size={11} />} defaultOpen={false}>
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
        <Section title={isJa ? "TikZオプション" : "TikZ"} icon={<span className="text-[10px] font-bold font-mono">{'{}'}</span>} defaultOpen={false}>
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
  );
}
