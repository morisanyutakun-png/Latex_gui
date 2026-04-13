"use client";

/**
 * FigureProperties — Right-side panel for editing selected shape properties.
 * Color, stroke, fill, label, rotation, size, TikZ options, etc.
 */

import React, { useCallback, useEffect, useState } from "react";
import { useFigureStore } from "./figure-store";
import type { FigureShape, ShapeStyle } from "./types";

// ── Locale helper ───────────────────────────────────────────────

function useIsJa() {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem("lx-locale") === "ja"; } catch { return false; }
}

// ── Color presets ───────────────────────────────────────────────

const COLORS = [
  { name: "black",   css: "#000000" },
  { name: "red",     css: "#dc2626" },
  { name: "orange",  css: "#ea580c" },
  { name: "green",   css: "#16a34a" },
  { name: "blue",    css: "#2563eb" },
  { name: "violet",  css: "#7c3aed" },
  { name: "cyan",    css: "#06b6d4" },
  { name: "pink",    css: "#ec4899" },
  { name: "gray",    css: "#6b7280" },
  { name: "white",   css: "#ffffff" },
];

const FILL_PRESETS = [
  { label: "None", value: "none", css: "transparent" },
  { label: "White", value: "white", css: "#ffffff" },
  { label: "Light Blue", value: "#dbeafe", css: "#dbeafe" },
  { label: "Light Green", value: "#dcfce7", css: "#dcfce7" },
  { label: "Light Yellow", value: "#fef3c7", css: "#fef3c7" },
  { label: "Light Red", value: "#fecaca", css: "#fecaca" },
  { label: "Light Purple", value: "#e9d5ff", css: "#e9d5ff" },
  { label: "Light Gray", value: "#e5e7eb", css: "#e5e7eb" },
];

// ── Section component ───────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-foreground/30 px-0.5">
        {title}
      </h4>
      {children}
    </div>
  );
}

// ── Input row ───────────────────────────────────────────────────

function InputRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-foreground/50 w-14 shrink-0 font-medium">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────

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

  const [labelValue, setLabelValue] = useState("");

  useEffect(() => {
    setLabelValue(selectedShape?.label ?? "");
  }, [selectedShape?.id, selectedShape?.label]);

  const commitLabel = useCallback(() => {
    if (!selectedShape) return;
    if (labelValue !== selectedShape.label) {
      pushHistory();
      updateShape(selectedShape.id, { label: labelValue });
    }
  }, [selectedShape, labelValue, pushHistory, updateShape]);

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

  // ── No selection ──

  if (selectedIds.length === 0) {
    return (
      <div className="w-[200px] shrink-0 border-l border-foreground/[0.06] bg-background/80 backdrop-blur-sm p-3">
        <div className="text-center text-foreground/25 text-xs py-10">
          {isJa ? "図形を選択してプロパティを編集" : "Select a shape to edit properties"}
        </div>
      </div>
    );
  }

  // ── Multi-selection (style only) ──

  if (selectedIds.length > 1) {
    const firstShape = shapes.find((s) => s.id === selectedIds[0]);
    return (
      <div className="w-[200px] shrink-0 border-l border-foreground/[0.06] bg-background/80 backdrop-blur-sm overflow-y-auto">
        <div className="p-3 space-y-4">
          <div className="text-[11px] font-semibold text-foreground/60">
            {selectedIds.length} {isJa ? "個選択中" : "selected"}
          </div>

          <Section title={isJa ? "線の色" : "Stroke"}>
            <div className="flex flex-wrap gap-1">
              {COLORS.map((c) => (
                <button key={c.name} title={c.name} onClick={() => handleStyleChange({ stroke: c.name })}
                  className={`w-6 h-6 rounded-md border-2 transition-all ${firstShape?.style.stroke === c.name ? "border-blue-500 scale-110" : "border-foreground/10 hover:border-foreground/30"}`}
                  style={{ backgroundColor: c.css }} />
              ))}
            </div>
          </Section>

          <Section title={isJa ? "塗り" : "Fill"}>
            <div className="flex flex-wrap gap-1">
              {FILL_PRESETS.map((f) => (
                <button key={f.value} title={f.label} onClick={() => handleStyleChange({ fill: f.value })}
                  className={`w-6 h-6 rounded-md border-2 transition-all ${firstShape?.style.fill === f.value ? "border-blue-500 scale-110" : "border-foreground/10 hover:border-foreground/30"}`}
                  style={{ backgroundColor: f.css, backgroundImage: f.value === "none" ? "linear-gradient(45deg, #ef4444 0%, #ef4444 50%, transparent 50%)" : undefined }} />
              ))}
            </div>
          </Section>
        </div>
      </div>
    );
  }

  // ── Single selection (full properties) ──

  if (!selectedShape) return null;

  return (
    <div className="w-[200px] shrink-0 border-l border-foreground/[0.06] bg-background/80 backdrop-blur-sm overflow-y-auto">
      <div className="p-3 space-y-4">

        {/* Shape kind badge */}
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full bg-foreground/[0.06] text-[10px] font-semibold text-foreground/60">
            {selectedShape.kind}
          </span>
        </div>

        {/* Label */}
        <Section title={isJa ? "ラベル" : "Label"}>
          <input
            value={labelValue}
            onChange={(e) => setLabelValue(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => { if (e.key === "Enter") commitLabel(); }}
            placeholder={isJa ? "テキストを入力..." : "Enter text..."}
            className="w-full h-7 px-2 text-[11px] rounded-md border border-foreground/[0.08] bg-white/70 dark:bg-white/5 focus:outline-none focus:ring-1 focus:ring-blue-500/40 transition-all"
          />
        </Section>

        {/* Position & Size */}
        <Section title={isJa ? "位置・サイズ" : "Position & Size"}>
          <div className="grid grid-cols-2 gap-1.5">
            <InputRow label="X">
              <input type="number" step="0.1" value={selectedShape.x}
                onChange={(e) => handleDimensionChange("x", parseFloat(e.target.value) || 0)}
                className="w-full h-6 px-1.5 text-[10px] font-mono rounded border border-foreground/[0.08] bg-white/70 dark:bg-white/5 focus:outline-none focus:ring-1 focus:ring-blue-500/40" />
            </InputRow>
            <InputRow label="Y">
              <input type="number" step="0.1" value={selectedShape.y}
                onChange={(e) => handleDimensionChange("y", parseFloat(e.target.value) || 0)}
                className="w-full h-6 px-1.5 text-[10px] font-mono rounded border border-foreground/[0.08] bg-white/70 dark:bg-white/5 focus:outline-none focus:ring-1 focus:ring-blue-500/40" />
            </InputRow>
            <InputRow label={isJa ? "幅" : "W"}>
              <input type="number" step="0.1" min="0.1" value={selectedShape.width}
                onChange={(e) => handleDimensionChange("width", Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                className="w-full h-6 px-1.5 text-[10px] font-mono rounded border border-foreground/[0.08] bg-white/70 dark:bg-white/5 focus:outline-none focus:ring-1 focus:ring-blue-500/40" />
            </InputRow>
            <InputRow label={isJa ? "高" : "H"}>
              <input type="number" step="0.1" min="0.1" value={selectedShape.height}
                onChange={(e) => handleDimensionChange("height", Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                className="w-full h-6 px-1.5 text-[10px] font-mono rounded border border-foreground/[0.08] bg-white/70 dark:bg-white/5 focus:outline-none focus:ring-1 focus:ring-blue-500/40" />
            </InputRow>
          </div>
          <InputRow label={isJa ? "回転" : "Rot"}>
            <input type="number" step="15" value={selectedShape.rotation}
              onChange={(e) => handleDimensionChange("rotation", parseFloat(e.target.value) || 0)}
              className="w-full h-6 px-1.5 text-[10px] font-mono rounded border border-foreground/[0.08] bg-white/70 dark:bg-white/5 focus:outline-none focus:ring-1 focus:ring-blue-500/40" />
          </InputRow>
        </Section>

        {/* Stroke color */}
        <Section title={isJa ? "線の色" : "Stroke Color"}>
          <div className="flex flex-wrap gap-1">
            {COLORS.map((c) => (
              <button key={c.name} title={c.name} onClick={() => handleStyleChange({ stroke: c.name })}
                className={`w-6 h-6 rounded-md border-2 transition-all ${selectedShape.style.stroke === c.name ? "border-blue-500 scale-110" : "border-foreground/10 hover:border-foreground/30"}`}
                style={{ backgroundColor: c.css }} />
            ))}
          </div>
        </Section>

        {/* Fill color */}
        <Section title={isJa ? "塗りつぶし" : "Fill"}>
          <div className="flex flex-wrap gap-1">
            {FILL_PRESETS.map((f) => (
              <button key={f.value} title={f.label} onClick={() => handleStyleChange({ fill: f.value })}
                className={`w-6 h-6 rounded-md border-2 transition-all ${selectedShape.style.fill === f.value ? "border-blue-500 scale-110" : "border-foreground/10 hover:border-foreground/30"}`}
                style={{ backgroundColor: f.css, backgroundImage: f.value === "none" ? "linear-gradient(45deg, #ef4444 0%, #ef4444 50%, transparent 50%)" : undefined }} />
            ))}
          </div>
          {selectedShape.style.fill !== "none" && (
            <InputRow label={isJa ? "透明度" : "Opacity"}>
              <input type="range" min="0" max="1" step="0.1" value={selectedShape.style.fillOpacity}
                onChange={(e) => handleStyleChange({ fillOpacity: parseFloat(e.target.value) })}
                className="w-full h-1.5 accent-blue-500" />
            </InputRow>
          )}
        </Section>

        {/* Line style */}
        <Section title={isJa ? "線のスタイル" : "Line Style"}>
          <InputRow label={isJa ? "太さ" : "Width"}>
            <select value={selectedShape.style.strokeWidth}
              onChange={(e) => handleStyleChange({ strokeWidth: parseFloat(e.target.value) })}
              className="w-full h-6 px-1 text-[10px] rounded border border-foreground/[0.08] bg-white/70 dark:bg-white/5 focus:outline-none">
              <option value="0.4">Thin (0.4pt)</option>
              <option value="0.8">Normal (0.8pt)</option>
              <option value="1.2">Thick (1.2pt)</option>
              <option value="2">Very Thick (2pt)</option>
              <option value="3">Ultra Thick (3pt)</option>
            </select>
          </InputRow>
          <div className="flex gap-2 mt-1">
            <label className="flex items-center gap-1 text-[10px] text-foreground/60 cursor-pointer">
              <input type="checkbox" checked={selectedShape.style.dashed}
                onChange={(e) => handleStyleChange({ dashed: e.target.checked })}
                className="rounded border-foreground/20 accent-blue-500 w-3 h-3" />
              {isJa ? "破線" : "Dashed"}
            </label>
            <label className="flex items-center gap-1 text-[10px] text-foreground/60 cursor-pointer">
              <input type="checkbox" checked={selectedShape.style.arrowEnd}
                onChange={(e) => handleStyleChange({ arrowEnd: e.target.checked })}
                className="rounded border-foreground/20 accent-blue-500 w-3 h-3" />
              {isJa ? "矢印→" : "Arrow ->"}
            </label>
            <label className="flex items-center gap-1 text-[10px] text-foreground/60 cursor-pointer">
              <input type="checkbox" checked={selectedShape.style.arrowStart}
                onChange={(e) => handleStyleChange({ arrowStart: e.target.checked })}
                className="rounded border-foreground/20 accent-blue-500 w-3 h-3" />
              {isJa ? "←矢印" : "<- Arrow"}
            </label>
          </div>
        </Section>

        {/* Font */}
        <Section title={isJa ? "フォント" : "Font"}>
          <InputRow label={isJa ? "サイズ" : "Size"}>
            <select value={selectedShape.style.fontSizePt}
              onChange={(e) => handleStyleChange({ fontSizePt: parseFloat(e.target.value) })}
              className="w-full h-6 px-1 text-[10px] rounded border border-foreground/[0.08] bg-white/70 dark:bg-white/5 focus:outline-none">
              <option value="6">6pt</option>
              <option value="8">8pt</option>
              <option value="10">10pt</option>
              <option value="12">12pt</option>
              <option value="14">14pt</option>
              <option value="18">18pt</option>
              <option value="24">24pt</option>
            </select>
          </InputRow>
        </Section>

        {/* TikZ options (for domain shapes with extra options) */}
        {Object.keys(selectedShape.tikzOptions).length > 0 && (
          <Section title={isJa ? "TikZオプション" : "TikZ Options"}>
            {Object.entries(selectedShape.tikzOptions).map(([key, value]) => (
              <InputRow key={key} label={key}>
                <input value={value}
                  onChange={(e) => handleTikzOptionChange(key, e.target.value)}
                  className="w-full h-6 px-1.5 text-[10px] font-mono rounded border border-foreground/[0.08] bg-white/70 dark:bg-white/5 focus:outline-none focus:ring-1 focus:ring-blue-500/40" />
              </InputRow>
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}
