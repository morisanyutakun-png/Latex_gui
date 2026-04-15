"use client";

/**
 * FigureCanvas — SVG drawing canvas (v3 — start→end drag model).
 *
 * Interaction:
 *   ALL shapes (except text & freehand): drag from start to end.
 *   - Lines/arrows/circuit components: start = terminal A, end = terminal B
 *   - Rects/circles/areas: start = corner, end = opposite corner
 *   - Text: click to place
 *   - Freehand: drag continuously
 *   - Space+drag or scroll = pan.  Ctrl+scroll = discrete zoom.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useFigureStore } from "./figure-store";
import { ShapeRenderer, ArrowDefs } from "./shape-renderers";
import type { Point, FigureShape, ShapeKind, ToolMode } from "./types";
import { getPaletteItem } from "./domain-palettes";
import { ZoomIn, ZoomOut, Maximize2, HelpCircle, Grid3x3, Magnet, Layers, Trash2, Copy, Palette, RotateCw, Lock, Unlock } from "lucide-react";
import { IPE_COLORS } from "./types";
import { useI18n } from "@/lib/i18n";
import { HelpTip } from "./help-tip";

const PX_PER_CM = 50;

// ── Coordinate helpers ──────────────────────────────────────────

function tikzToCanvas(x: number, y: number, cH: number, z: number, ox: number, oy: number): [number, number] {
  return [x * PX_PER_CM * z + ox, (cH - y) * PX_PER_CM * z + oy];
}
function canvasToTikz(px: number, py: number, cH: number, z: number, ox: number, oy: number): [number, number] {
  return [(px - ox) / (PX_PER_CM * z), cH - (py - oy) / (PX_PER_CM * z)];
}
function snapV(v: number, g: number, on: boolean): number {
  return on && g > 0 ? Math.round(v / g) * g : v;
}

// ── Zoom steps ──────────────────────────────────────────────────

/** Format a cm value for the grid label: "5cm", "0.5", "-10", "50cm", "1mm" */
function formatGridLabel(cm: number): string {
  const v = Math.round(cm * 1000) / 1000;
  if (v === 0) return "0";
  const abs = Math.abs(v);
  if (abs >= 1) {
    // Integers: show as "5cm"/"10cm". Non-integer: "2.5cm"
    return (Number.isInteger(v) ? v.toString() : v.toString()) + "cm";
  }
  // Sub-cm: show as mm to avoid "0.1cm" clutter
  const mm = Math.round(v * 10 * 100) / 100;
  return (Number.isInteger(mm) ? mm.toString() : mm.toString()) + "mm";
}

const ZOOM_STEPS = [0.1, 0.15, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 6, 8, 12];
const MAX_ZOOM = 12;
const MIN_ZOOM = 0.1;
function nextZoom(cur: number, dir: 1 | -1): number {
  const i = ZOOM_STEPS.findIndex((z) => z >= cur - 0.01);
  const n = i + dir;
  return ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, n))];
}

// ── Grab zone detection ────────────────────────────────────────

/**
 * Returns true if the TikZ point is in the shape's "body center" — the inner region
 * where clicks should GRAB the shape instead of passing through. Edges/terminals
 * remain click-through for closed circuits.
 */
function isInGrabZone(shape: FigureShape, pt: Point): boolean {
  const margin = 0.25; // 25% edge margin → inner 50% is grab zone
  const innerX1 = shape.x + shape.width * margin;
  const innerX2 = shape.x + shape.width * (1 - margin);
  const innerY1 = shape.y + shape.height * margin;
  const innerY2 = shape.y + shape.height * (1 - margin);

  // For very thin shapes (horizontal/vertical lines/circuits), expand the grab zone perpendicularly
  const minGrab = 0.2; // 2mm minimum on each side
  const x1 = Math.min(innerX1, shape.x + shape.width / 2 - minGrab);
  const x2 = Math.max(innerX2, shape.x + shape.width / 2 + minGrab);
  const y1 = Math.min(innerY1, shape.y + shape.height / 2 - minGrab);
  const y2 = Math.max(innerY2, shape.y + shape.height / 2 + minGrab);

  return pt.x >= x1 && pt.x <= x2 && pt.y >= y1 && pt.y <= y2;
}

/** Find the topmost shape (highest zIndex) whose grab zone contains the point */
function findGrabTarget(shapes: FigureShape[], pt: Point): string | null {
  const sorted = [...shapes].sort((a, b) => b.zIndex - a.zIndex);
  for (const s of sorted) {
    if (s.locked) continue;
    if (isInGrabZone(s, pt)) return s.id;
  }
  return null;
}

// ── Smart snap system ──────────────────────────────────────────

type SnapPointType = "terminal" | "corner" | "center" | "mid-edge";
interface SnapPoint { x: number; y: number; type: SnapPointType; shapeId: string }

/** Collect all snap-able reference points from shapes (terminals, corners, centers, edge midpoints). */
function collectSnapPoints(shapes: FigureShape[], excludeId?: string): SnapPoint[] {
  const pts: SnapPoint[] = [];
  for (const s of shapes) {
    if (s.id === excludeId) continue;
    const cx = s.x + s.width / 2, cy = s.y + s.height / 2;
    // Center
    pts.push({ x: cx, y: cy, type: "center", shapeId: s.id });
    // Bounding box corners
    pts.push({ x: s.x, y: s.y, type: "corner", shapeId: s.id });
    pts.push({ x: s.x + s.width, y: s.y, type: "corner", shapeId: s.id });
    pts.push({ x: s.x, y: s.y + s.height, type: "corner", shapeId: s.id });
    pts.push({ x: s.x + s.width, y: s.y + s.height, type: "corner", shapeId: s.id });
    // Mid-edge points
    pts.push({ x: cx, y: s.y, type: "mid-edge", shapeId: s.id });
    pts.push({ x: cx, y: s.y + s.height, type: "mid-edge", shapeId: s.id });
    pts.push({ x: s.x, y: cy, type: "mid-edge", shapeId: s.id });
    pts.push({ x: s.x + s.width, y: cy, type: "mid-edge", shapeId: s.id });
    // Terminals (from points array)
    for (const p of s.points) {
      pts.push({ x: s.x + p.x, y: s.y + p.y, type: "terminal", shapeId: s.id });
    }
  }
  return pts;
}

/** Get this shape's own snap reference points (for snapping my-point to other-point). */
function getShapeOwnSnapPoints(s: FigureShape): Array<{ x: number; y: number; type: SnapPointType }> {
  const cx = s.x + s.width / 2, cy = s.y + s.height / 2;
  const out: Array<{ x: number; y: number; type: SnapPointType }> = [
    { x: cx, y: cy, type: "center" },
    { x: s.x, y: s.y, type: "corner" },
    { x: s.x + s.width, y: s.y, type: "corner" },
    { x: s.x, y: s.y + s.height, type: "corner" },
    { x: s.x + s.width, y: s.y + s.height, type: "corner" },
  ];
  for (const p of s.points) {
    out.push({ x: s.x + p.x, y: s.y + p.y, type: "terminal" });
  }
  return out;
}

/**
 * Find the best snap offset that would align some point of `movingShape` to
 * some reference point of other shapes. Snap priority:
 *   1. Point-to-point (terminal→terminal wins over corner→corner etc.)
 *   2. Axis alignment (same x OR same y with another shape's reference point)
 * Returns dx,dy to apply to the moving shape's position, plus the matched points (for visual).
 */
function computeSmartSnap(
  movingShape: FigureShape,
  others: SnapPoint[],
  threshold: number,
): { dx: number; dy: number; matches: Array<{ my: { x: number; y: number; type: SnapPointType }; other: SnapPoint; axis: "point" | "x" | "y" }> } | null {
  const myPts = getShapeOwnSnapPoints(movingShape);
  if (myPts.length === 0 || others.length === 0) return null;

  // 1. Point-to-point snap: pick globally closest pair within threshold.
  // Terminal-to-terminal is strongly preferred (scale distance down).
  let bestP: { dx: number; dy: number; dist: number; my: typeof myPts[0]; other: SnapPoint } | null = null;
  for (const my of myPts) {
    for (const o of others) {
      const dx = o.x - my.x, dy = o.y - my.y;
      const raw = Math.sqrt(dx * dx + dy * dy);
      // Priority weighting: terminal-to-terminal gets a bonus (smaller effective dist)
      const weight = (my.type === "terminal" && o.type === "terminal") ? 0.5
                   : (my.type === "corner"   && o.type === "corner")   ? 0.8
                   : (my.type === "center"   && o.type === "center")   ? 0.9
                   : 1.0;
      const dist = raw * weight;
      if (raw < threshold && (!bestP || dist < bestP.dist)) {
        bestP = { dx, dy, dist, my, other: o };
      }
    }
  }
  if (bestP) {
    return { dx: bestP.dx, dy: bestP.dy,
      matches: [{ my: bestP.my, other: bestP.other, axis: "point" }] };
  }

  // 2. Axis snap (horizontal/vertical alignment of centers, corners, or edges)
  let bestX: { dx: number; my: typeof myPts[0]; other: SnapPoint } | null = null;
  let bestY: { dy: number; my: typeof myPts[0]; other: SnapPoint } | null = null;
  for (const my of myPts) {
    for (const o of others) {
      const dx = o.x - my.x;
      if (Math.abs(dx) < threshold && (!bestX || Math.abs(dx) < Math.abs(bestX.dx))) {
        bestX = { dx, my, other: o };
      }
      const dy = o.y - my.y;
      if (Math.abs(dy) < threshold && (!bestY || Math.abs(dy) < Math.abs(bestY.dy))) {
        bestY = { dy, my, other: o };
      }
    }
  }
  if (bestX || bestY) {
    const matches: Array<{ my: { x: number; y: number; type: SnapPointType }; other: SnapPoint; axis: "point" | "x" | "y" }> = [];
    if (bestX) matches.push({ my: bestX.my, other: bestX.other, axis: "x" });
    if (bestY) matches.push({ my: bestY.my, other: bestY.other, axis: "y" });
    return { dx: bestX?.dx ?? 0, dy: bestY?.dy ?? 0, matches };
  }

  return null;
}

/** Fine quantization: 0.05 cm = 0.5 mm precision */
function fineQuantize(v: number): number {
  return Math.round(v * 20) / 20;
}

// ── Tool classification ─────────────────────────────────────────

/** Line-like: drag A→B, component stretches between the two terminals */
const LINE_TOOLS = new Set<string>([
  "line", "arrow", "force-arrow", "vector",
  "bond-single", "bond-double", "bond-triple", "reaction-arrow",
  // Circuit
  "resistor", "capacitor", "inductor", "voltage-source", "current-source",
  "switch", "diode", "led",
  // Mechanics
  "spring", "damper",
]);

/** Area-like: drag corner→opposite-corner */
const AREA_TOOLS = new Set<string>([
  "rect", "circle", "ellipse", "polygon", "arc",
  // CS
  "flowchart-process", "flowchart-decision", "flowchart-io", "flowchart-terminal",
  "automaton-state", "automaton-accept",
  // Mechanics
  "mass", "pulley", "support-pin", "support-roller", "moment",
  // Chemistry
  "benzene", "orbital-s", "orbital-p",
  // Biology
  "cell", "nucleus", "mitochondria", "membrane", "neuron", "synapse",
  // Math
  "axes", "angle-arc", "right-angle", "function-plot", "brace",
  // Physics
  "wave", "lens-convex", "lens-concave", "prism", "vector-field",
]);

/** Click to place (complex multi-terminal or special) */
const CLICK_TOOLS = new Set<string>([
  "text", "ground", "transistor-npn", "transistor-pnp", "opamp",
]);

type DrawMode = "line" | "area" | "freehand" | "click";
function classifyTool(t: ToolMode): DrawMode {
  if (t === "freehand") return "freehand";
  if (LINE_TOOLS.has(t)) return "line";
  if (AREA_TOOLS.has(t)) return "area";
  return "click";
}

// ── Resize handles ──────────────────────────────────────────────

type ResizeDir = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
const RESIZE_HANDLES: { dir: ResizeDir; dx: number; dy: number; cursor: string }[] = [
  { dir: "nw", dx: 0, dy: 0, cursor: "nwse-resize" },
  { dir: "n",  dx: 0.5, dy: 0, cursor: "ns-resize" },
  { dir: "ne", dx: 1, dy: 0, cursor: "nesw-resize" },
  { dir: "e",  dx: 1, dy: 0.5, cursor: "ew-resize" },
  { dir: "se", dx: 1, dy: 1, cursor: "nwse-resize" },
  { dir: "s",  dx: 0.5, dy: 1, cursor: "ns-resize" },
  { dir: "sw", dx: 0, dy: 1, cursor: "nesw-resize" },
  { dir: "w",  dx: 0, dy: 0.5, cursor: "ew-resize" },
];

// ══════════════════════════════════════════════════════════════════
//  COMPONENT
// ══════════════════════════════════════════════════════════════════

export function FigureCanvas() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { locale } = useI18n();
  const isJa = locale === "ja";

  const shapes        = useFigureStore((s) => s.shapes);
  const selectedIds   = useFigureStore((s) => s.selectedIds);
  const hoveredId     = useFigureStore((s) => s.hoveredId);
  const viewport      = useFigureStore((s) => s.viewport);
  const activeTool    = useFigureStore((s) => s.activeTool);
  const canvasWidth   = useFigureStore((s) => s.canvasWidth);
  const canvasHeight  = useFigureStore((s) => s.canvasHeight);
  const gridSize      = useFigureStore((s) => s.gridSize);
  const snapToGrid    = useFigureStore((s) => s.snapToGrid);
  const showGrid      = useFigureStore((s) => s.showGrid);

  const select           = useFigureStore((s) => s.select);
  const clearSelection   = useFigureStore((s) => s.clearSelection);
  const setHovered       = useFigureStore((s) => s.setHovered);
  const updateShape      = useFigureStore((s) => s.updateShape);
  const addShapeFromPalette = useFigureStore((s) => s.addShapeFromPalette);
  const pushHistory      = useFigureStore((s) => s.pushHistory);
  const setViewport      = useFigureStore((s) => s.setViewport);
  const setActiveTool    = useFigureStore((s) => s.setActiveTool);

  const { zoom, offsetX, offsetY } = viewport;
  const scale = PX_PER_CM * zoom;

  // ── Space key for pan ─────────────────────────────────────────

  const [spaceHeld, setSpaceHeld] = useState(false);
  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName ?? "")) {
        e.preventDefault(); setSpaceHeld(true);
      }
    };
    const up = (e: KeyboardEvent) => { if (e.code === "Space") setSpaceHeld(false); };
    window.addEventListener("keydown", dn); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); };
  }, []);

  // ── Drag state ────────────────────────────────────────────────

  interface DragState {
    mode: "move" | "resize" | "pan" | "draw-line" | "draw-area" | "draw-freehand" | "marquee";
    startPx: Point;       // screen px at drag start
    startTikz: Point;     // TikZ coords at drag start
    endTikz?: Point;      // TikZ coords of current end (updated on move)
    shapeId?: string;
    resizeDir?: ResizeDir;
    origShape?: FigureShape;
    drawPoints?: Point[]; // freehand
    /** For multi-select move: original positions for each selected shape */
    multiOrigPositions?: Map<string, Point>;
  }

  const [dragging, setDragging] = useState<DragState | null>(null);
  const [mousePos, setMousePos] = useState<Point | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });

  /** 2-click mode: first click point. Null = waiting for first click. */
  const [pendingStart, setPendingStart] = useState<Point | null>(null);
  /** 2-click mode: preview end (cursor position) */
  const [previewEnd, setPreviewEnd] = useState<Point | null>(null);
  /** ID of shape whose grab-zone the cursor is currently over (null = cursor not on any shape body) */
  const [grabTargetId, setGrabTargetId] = useState<string | null>(null);
  /** Active snap visualization (while moving) */
  const [activeSnap, setActiveSnap] = useState<ReturnType<typeof computeSmartSnap>>(null);
  /** Help popover visibility */
  const [showHelp, setShowHelp] = useState(false);
  /** Floating action bar color picker visibility */
  const [showQuickColors, setShowQuickColors] = useState(false);
  /** Pulse trigger — increments on each new selection to re-fire the CSS animation */
  const [pulseToken, setPulseToken] = useState(0);
  /** IPE auto-angle mode: when on, line-drawing always snaps to multiples of 15° */
  const [autoAngle, setAutoAngle] = useState(false);
  const autoAngleRef = useRef(false);
  useEffect(() => { autoAngleRef.current = autoAngle; }, [autoAngle]);

  // Pulse on selection change (only for newly added shapes — not when clearing)
  useEffect(() => {
    if (selectedIds.length > 0) setPulseToken((t) => t + 1);
  }, [selectedIds]);

  // Zoom control helpers (used by floating buttons + keyboard) — smooth animated
  const zoomBy = useCallback((dir: 1 | -1) => {
    const { zoom: z, offsetX: ox, offsetY: oy } = useFigureStore.getState().viewport;
    const nz = nextZoom(z, dir);
    if (nz === z) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.width / 2, cy = rect.height / 2;
    const r = nz / z;
    const targetOx = cx - (cx - ox) * r, targetOy = cy - (cy - oy) * r;
    // Smooth zoom animation (180ms ease-out)
    const t0 = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = () => {
      const t = Math.min(1, (performance.now() - t0) / 180);
      const k = ease(t);
      useFigureStore.getState().setViewport({
        zoom: z + (nz - z) * k,
        offsetX: ox + (targetOx - ox) * k,
        offsetY: oy + (targetOy - oy) * k,
      });
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, []);

  const zoomIn  = useCallback(() => zoomBy(1),  [zoomBy]);
  const zoomOut = useCallback(() => zoomBy(-1), [zoomBy]);

  // ── Listen for cross-component events from CommandPalette ──
  useEffect(() => {
    const onFit = () => { fitToContentRef.current?.(); };
    const onZIn = () => { zoomInRef.current?.(); };
    const onZOut = () => { zoomOutRef.current?.(); };
    const onReset = () => { centerCanvasRef.current?.(1); };
    window.addEventListener("figure-editor:fit-content", onFit);
    window.addEventListener("figure-editor:zoom-in", onZIn);
    window.addEventListener("figure-editor:zoom-out", onZOut);
    window.addEventListener("figure-editor:reset-center", onReset);
    return () => {
      window.removeEventListener("figure-editor:fit-content", onFit);
      window.removeEventListener("figure-editor:zoom-in", onZIn);
      window.removeEventListener("figure-editor:zoom-out", onZOut);
      window.removeEventListener("figure-editor:reset-center", onReset);
    };
  }, []);

  // Refs to break the chicken-and-egg: define refs first, assign in useEffect below
  const fitToContentRef = useRef<(() => void) | null>(null);
  const zoomInRef = useRef<(() => void) | null>(null);
  const zoomOutRef = useRef<(() => void) | null>(null);
  const centerCanvasRef = useRef<((z?: number) => void) | null>(null);

  // ── Auto-pan when dragging near canvas edge ──────────────────
  // Tracks last cursor position so the rAF loop knows where to push from
  const lastMousePxRef = useRef<Point | null>(null);
  const autoPanRafRef = useRef<number | null>(null);

  const stopAutoPan = useCallback(() => {
    if (autoPanRafRef.current !== null) {
      cancelAnimationFrame(autoPanRafRef.current);
      autoPanRafRef.current = null;
    }
  }, []);

  const startAutoPan = useCallback(() => {
    if (autoPanRafRef.current !== null) return;
    const tick = () => {
      const cursor = lastMousePxRef.current;
      const drag = dragging;
      const rect = svgRef.current?.getBoundingClientRect();
      if (!cursor || !drag || !rect || (drag.mode !== "move" && drag.mode !== "marquee")) {
        autoPanRafRef.current = null;
        return;
      }
      // Edge zone: 40px from each edge. Pan speed proportional to depth.
      const EDGE = 40;
      const MAX_SPEED = 14; // px per frame
      let dx = 0, dy = 0;
      if (cursor.x < EDGE) dx = (EDGE - cursor.x) / EDGE * MAX_SPEED;
      else if (cursor.x > rect.width - EDGE) dx = -(cursor.x - (rect.width - EDGE)) / EDGE * MAX_SPEED;
      if (cursor.y < EDGE) dy = (EDGE - cursor.y) / EDGE * MAX_SPEED;
      else if (cursor.y > rect.height - EDGE) dy = -(cursor.y - (rect.height - EDGE)) / EDGE * MAX_SPEED;

      if (dx !== 0 || dy !== 0) {
        const vp = useFigureStore.getState().viewport;
        useFigureStore.getState().setViewport({ offsetX: vp.offsetX + dx, offsetY: vp.offsetY + dy });
      }
      autoPanRafRef.current = requestAnimationFrame(tick);
    };
    autoPanRafRef.current = requestAnimationFrame(tick);
  }, [dragging]);

  useEffect(() => {
    if (dragging?.mode === "move" || dragging?.mode === "marquee") {
      startAutoPan();
    } else {
      stopAutoPan();
    }
    return () => stopAutoPan();
  }, [dragging?.mode, startAutoPan, stopAutoPan]);

  /** Smoothly animate the viewport from current state to a target state. */
  const animateViewport = useCallback((target: { zoom: number; offsetX: number; offsetY: number }, durationMs = 250) => {
    const start = useFigureStore.getState().viewport;
    const t0 = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);  // ease-out-cubic
    const step = () => {
      const elapsed = performance.now() - t0;
      const t = Math.min(1, elapsed / durationMs);
      const k = ease(t);
      useFigureStore.getState().setViewport({
        zoom: start.zoom + (target.zoom - start.zoom) * k,
        offsetX: start.offsetX + (target.offsetX - start.offsetX) * k,
        offsetY: start.offsetY + (target.offsetY - start.offsetY) * k,
      });
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, []);

  /**
   * Smoothly center the paper (canvas rectangle) in the viewport at the given zoom level.
   * Used by the 100% / reset button — always returns to a predictable "home" view.
   */
  const centerCanvas = useCallback((targetZoom = 1) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const { canvasWidth: cW, canvasHeight: cH } = useFigureStore.getState();
    const paperPxW = cW * PX_PER_CM * targetZoom;
    const paperPxH = cH * PX_PER_CM * targetZoom;
    const ox = (rect.width - paperPxW) / 2;
    const oy = (rect.height - paperPxH) / 2;
    animateViewport({ zoom: targetZoom, offsetX: ox, offsetY: oy });
  }, [animateViewport]);

  /** Smoothly zoom & center on a single shape (used by double-click). */
  const focusShape = useCallback((shapeId: string) => {
    const sh = useFigureStore.getState().shapes.find((s) => s.id === shapeId);
    const rect = svgRef.current?.getBoundingClientRect();
    if (!sh || !rect) return;
    const padCm = 1.5;
    const w = sh.width + padCm * 2, h = sh.height + padCm * 2;
    const targetScale = Math.min(rect.width / (w * PX_PER_CM), rect.height / (h * PX_PER_CM));
    const nz = Math.max(0.5, Math.min(3, targetScale));
    const cH = useFigureStore.getState().canvasHeight;
    const cxCm = sh.x + sh.width / 2, cyCm = sh.y + sh.height / 2;
    const ox = rect.width / 2 - cxCm * PX_PER_CM * nz;
    const oy = rect.height / 2 - (cH - cyCm) * PX_PER_CM * nz;
    animateViewport({ zoom: nz, offsetX: ox, offsetY: oy });
  }, [animateViewport]);

  /** Fit all shapes to view — if no shapes, fit the canvas frame. */
  const fitToContent = useCallback(() => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const { shapes: allShapes, canvasWidth: cW, canvasHeight: cH } = useFigureStore.getState();
    let minX = 0, minY = 0, maxX = cW, maxY = cH;
    if (allShapes.length > 0) {
      minX = Infinity; minY = Infinity; maxX = -Infinity; maxY = -Infinity;
      for (const s of allShapes) {
        minX = Math.min(minX, s.x);
        minY = Math.min(minY, s.y);
        maxX = Math.max(maxX, s.x + s.width);
        maxY = Math.max(maxY, s.y + s.height);
      }
      const pad = 1; minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    }
    const w = maxX - minX, h = maxY - minY;
    if (w <= 0 || h <= 0) return;
    const targetScale = Math.min(rect.width / (w * PX_PER_CM), rect.height / (h * PX_PER_CM));
    const nz = Math.max(0.25, Math.min(3, targetScale));
    const targetPxW = w * PX_PER_CM * nz;
    const targetPxH = h * PX_PER_CM * nz;
    const ox = (rect.width - targetPxW) / 2 - minX * PX_PER_CM * nz;
    const oy = (rect.height - targetPxH) / 2 - (cH - maxY) * PX_PER_CM * nz;
    useFigureStore.getState().setViewport({ zoom: nz, offsetX: ox, offsetY: oy });
  }, []);

  // Wire refs for cross-component event handlers
  useEffect(() => {
    fitToContentRef.current = fitToContent;
    zoomInRef.current = zoomIn;
    zoomOutRef.current = zoomOut;
    centerCanvasRef.current = centerCanvas;
  }, [fitToContent, zoomIn, zoomOut, centerCanvas]);

  // Cancel pending start when tool changes
  useEffect(() => { setPendingStart(null); setPreviewEnd(null); }, [activeTool]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setContainerSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Clear selection when switching away from select mode — keeps the canvas clean for drawing
  useEffect(() => {
    if (activeTool !== "select") clearSelection();
  }, [activeTool, clearSelection]);

  // ── Helpers ───────────────────────────────────────────────────

  const getSvgCoords = useCallback((e: React.MouseEvent): Point => {
    const r = svgRef.current?.getBoundingClientRect();
    return r ? { x: e.clientX - r.left, y: e.clientY - r.top } : { x: 0, y: 0 };
  }, []);

  function shapeToCanvasCoords(s: FigureShape) {
    const [cx, cy] = tikzToCanvas(s.x, s.y + s.height, canvasHeight, zoom, offsetX, offsetY);
    return { cx, cy, pw: s.width * scale, ph: s.height * scale,
      // Convert TikZ-relative (bottom-left origin, y-up) to screen-relative (top-left origin, y-down)
      pxPoints: s.points.map((p) => ({ x: p.x * scale, y: (s.height - p.y) * scale })) };
  }

  // ── Grid ──────────────────────────────────────────────────────

  const gridLines = useCallback(() => {
    if (!showGrid) return null;
    const lines: React.ReactNode[] = [];

    // ── Adaptive grid spacing based on zoom level ──
    // Target: fine lines 6–20px apart, major every integer cm (or scaled unit).
    const minPxStep = 6;
    let fineCm = gridSize;
    while (fineCm * scale < minPxStep && fineCm < 1000) fineCm *= 2;
    // Major lines: adapt based on zoom — at 100x zoom, majors are 1mm; at 0.1x zoom, every 10cm
    let majorCm = 1; // default: integer cm
    if (scale < 20) majorCm = 5;          // zoomed out — every 5cm
    if (scale < 5)  majorCm = 10;         // very zoomed out — every 10cm
    if (scale < 1.5) majorCm = 50;        // extremely zoomed out
    if (scale > 200) majorCm = 0.5;       // zoomed in — every 5mm
    if (scale > 500) majorCm = 0.1;       // very zoomed in — every 1mm
    // Big marker (for distance reference): roughly every major*5
    const bigCm = majorCm * 5;

    const viewW = containerSize.w;
    const viewH = containerSize.h;
    const tikzXMin = -offsetX / scale;
    const tikzXMax = (viewW - offsetX) / scale;
    const tikzYMin = canvasHeight - (viewH - offsetY) / scale;
    const tikzYMax = canvasHeight - (-offsetY) / scale;

    const xStart = Math.floor(tikzXMin / fineCm) * fineCm;
    const xEnd   = Math.ceil(tikzXMax / fineCm) * fineCm;
    const yStart = Math.floor(tikzYMin / fineCm) * fineCm;
    const yEnd   = Math.ceil(tikzYMax / fineCm) * fineCm;

    const MAX_LINES = 400;

    // Helper to check if x is near a multiple (handles floating point)
    const isMultiple = (v: number, step: number) =>
      Math.abs(v - Math.round(v / step) * step) < step * 0.01;

    const labelNodes: React.ReactNode[] = [];

    let count = 0;
    for (let x = xStart; x <= xEnd && count < MAX_LINES; x += fineCm, count++) {
      const px = x * scale + offsetX;
      const isBig = isMultiple(x, bigCm);
      const isMajor = isBig || isMultiple(x, majorCm);
      lines.push(<line key={`gv${x.toFixed(3)}`} x1={px} y1={0} x2={px} y2={viewH}
        stroke={isBig ? "rgba(0,0,0,0.22)" : isMajor ? "rgba(0,0,0,0.11)" : "rgba(0,0,0,0.035)"}
        strokeWidth={isBig ? 0.9 : isMajor ? 0.55 : 0.3} />);
      // cm label on big lines (only a horizontal reference row just below top ruler)
      if (isBig && px > 26 && px < viewW - 20) {
        const label = formatGridLabel(x);
        labelNodes.push(
          <g key={`lx${x.toFixed(3)}`} pointerEvents="none">
            <rect x={px - 14} y={26} width={28} height={13} rx={3}
              fill="rgba(255,255,255,0.9)" stroke="rgba(0,0,0,0.08)" strokeWidth={0.5} />
            <text x={px} y={35} textAnchor="middle" fontSize="9" fontFamily="monospace"
              fill="rgba(0,0,0,0.55)" fontWeight="600">{label}</text>
          </g>
        );
      }
    }
    count = 0;
    for (let y = yStart; y <= yEnd && count < MAX_LINES; y += fineCm, count++) {
      const py = (canvasHeight - y) * scale + offsetY;
      const isBig = isMultiple(y, bigCm);
      const isMajor = isBig || isMultiple(y, majorCm);
      lines.push(<line key={`gh${y.toFixed(3)}`} x1={0} y1={py} x2={viewW} y2={py}
        stroke={isBig ? "rgba(0,0,0,0.22)" : isMajor ? "rgba(0,0,0,0.11)" : "rgba(0,0,0,0.035)"}
        strokeWidth={isBig ? 0.9 : isMajor ? 0.55 : 0.3} />);
      if (isBig && py > 40 && py < viewH - 8) {
        const label = formatGridLabel(y);
        labelNodes.push(
          <g key={`ly${y.toFixed(3)}`} pointerEvents="none">
            <rect x={26} y={py - 6.5} width={30} height={13} rx={3}
              fill="rgba(255,255,255,0.9)" stroke="rgba(0,0,0,0.08)" strokeWidth={0.5} />
            <text x={41} y={py + 2.5} textAnchor="middle" fontSize="9" fontFamily="monospace"
              fill="rgba(0,0,0,0.55)" fontWeight="600">{label}</text>
          </g>
        );
      }
    }

    // Origin axes
    const [ox, oy] = tikzToCanvas(0, 0, canvasHeight, zoom, offsetX, offsetY);
    if (ox >= 0 && ox <= viewW) lines.push(
      <line key="axis-y" x1={ox} y1={0} x2={ox} y2={viewH} stroke="rgba(59,130,246,0.28)" strokeWidth={1.2} />);
    if (oy >= 0 && oy <= viewH) lines.push(
      <line key="axis-x" x1={0} y1={oy} x2={viewW} y2={oy} stroke="rgba(59,130,246,0.28)" strokeWidth={1.2} />);

    return <g>{lines}<g>{labelNodes}</g></g>;
  }, [showGrid, gridSize, scale, canvasHeight, zoom, offsetX, offsetY, containerSize]);

  // ── Rulers ────────────────────────────────────────────────────

  const RS = 22;
  const renderRulers = useCallback(() => {
    const t: React.ReactNode[] = [];
    for (let cm = 0; cm <= canvasWidth; cm++) {
      const px = cm * scale + offsetX;
      if (px < RS || px > containerSize.w) continue;
      t.push(<g key={`rh${cm}`}><line x1={px} y1={0} x2={px} y2={cm % 5 === 0 ? RS : RS * 0.5} stroke="rgba(0,0,0,0.25)" strokeWidth={0.5} />
        {cm % 2 === 0 && <text x={px + 2} y={RS - 4} fontSize="8" fill="rgba(0,0,0,0.35)" fontFamily="monospace">{cm}</text>}</g>);
    }
    for (let cm = 0; cm <= canvasHeight; cm++) {
      const py = cm * scale + offsetY;
      if (py < RS || py > containerSize.h) continue;
      t.push(<g key={`rv${cm}`}><line x1={0} y1={py} x2={cm % 5 === 0 ? RS : RS * 0.5} y2={py} stroke="rgba(0,0,0,0.25)" strokeWidth={0.5} />
        {cm % 2 === 0 && <text x={3} y={py - 2} fontSize="8" fill="rgba(0,0,0,0.35)" fontFamily="monospace">{canvasHeight - cm}</text>}</g>);
    }
    return (<g>
      <rect x={0} y={0} width={containerSize.w} height={RS} fill="rgba(245,244,240,0.95)" />
      <rect x={0} y={0} width={RS} height={containerSize.h} fill="rgba(245,244,240,0.95)" />
      <rect x={0} y={0} width={RS} height={RS} fill="rgba(240,240,236,1)" />
      <text x={RS / 2} y={RS / 2 + 3} fontSize="7" fill="rgba(0,0,0,0.3)" textAnchor="middle" fontFamily="monospace">cm</text>
      {t}
      <line x1={RS} y1={0} x2={RS} y2={containerSize.h} stroke="rgba(0,0,0,0.08)" strokeWidth={0.5} />
      <line x1={0} y1={RS} x2={containerSize.w} y2={RS} stroke="rgba(0,0,0,0.08)" strokeWidth={0.5} />
    </g>);
  }, [scale, offsetX, offsetY, canvasWidth, canvasHeight, containerSize]);

  // ── Snap guides ───────────────────────────────────────────────

  const renderSnapGuides = useCallback(() => {
    if (selectedIds.length !== 1 || !dragging || dragging.mode !== "move") return null;
    const mv = shapes.find((s) => s.id === selectedIds[0]);
    if (!mv) return null;
    const guides: React.ReactNode[] = [];
    const mcx = mv.x + mv.width / 2, mcy = mv.y + mv.height / 2;
    for (const o of shapes) {
      if (o.id === mv.id) continue;
      const ocx = o.x + o.width / 2, ocy = o.y + o.height / 2;
      if (Math.abs(mcx - ocx) < 0.15) {
        const [px] = tikzToCanvas(ocx, 0, canvasHeight, zoom, offsetX, offsetY);
        guides.push(<line key={`vg-${o.id}`} x1={px} y1={offsetY} x2={px} y2={canvasHeight * scale + offsetY}
          stroke="#3b82f6" strokeWidth={0.6} strokeDasharray="3,3" opacity={0.6} />);
      }
      if (Math.abs(mcy - ocy) < 0.15) {
        const [, py] = tikzToCanvas(0, ocy, canvasHeight, zoom, offsetX, offsetY);
        guides.push(<line key={`hg-${o.id}`} x1={offsetX} y1={py} x2={canvasWidth * scale + offsetX} y2={py}
          stroke="#3b82f6" strokeWidth={0.6} strokeDasharray="3,3" opacity={0.6} />);
      }
    }
    return guides.length > 0 ? <g>{guides}</g> : null;
  }, [selectedIds, dragging, shapes, canvasHeight, canvasWidth, zoom, offsetX, offsetY, scale]);

  // ══════════════════════════════════════════════════════════════
  //  MOUSE HANDLERS
  // ══════════════════════════════════════════════════════════════

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Pan: middle click or Space+click
    if (e.button === 1 || (e.button === 0 && (spaceHeld || activeTool === "pan"))) {
      const px = getSvgCoords(e);
      setDragging({ mode: "pan", startPx: px, startTikz: { x: offsetX, y: offsetY } });
      return;
    }
    if (e.button !== 0) return;

    const px = getSvgCoords(e);
    const [tx, ty] = canvasToTikz(px.x, px.y, canvasHeight, zoom, offsetX, offsetY);
    const sx = snapV(tx, gridSize, snapToGrid), sy = snapV(ty, gridSize, snapToGrid);

    // ─ Grab zone: clicking on a shape's body center GRABS it, regardless of active tool ─
    // Edges/terminals still pass through so users can start new shapes from existing endpoints
    // (essential for closed circuits).
    const grabId = findGrabTarget(shapes, { x: tx, y: ty });
    if (grabId) {
      const sh = shapes.find((s) => s.id === grabId);
      if (sh) {
        select(grabId, e.shiftKey); pushHistory();
        setDragging({
          mode: "move", startPx: px, startTikz: { x: tx, y: ty }, shapeId: grabId,
          origShape: { ...sh, style: { ...sh.style }, points: sh.points.map((p) => ({ ...p })), tikzOptions: { ...sh.tikzOptions } },
        });
        // Cancel any pending 2-click draw since user is now grabbing
        if (pendingStart) { setPendingStart(null); setPreviewEnd(null); }
        return;
      }
    }

    if (activeTool === "select") {
      // Start drag-to-multiselect (marquee) — clear selection first unless Shift held
      if (!e.shiftKey) clearSelection();
      setDragging({ mode: "marquee", startPx: px, startTikz: { x: tx, y: ty }, endTikz: { x: tx, y: ty } });
      return;
    }

    const mode = classifyTool(activeTool);

    // Freehand uses drag
    if (mode === "freehand") {
      setDragging({ mode: "draw-freehand", startPx: px, startTikz: { x: sx, y: sy }, drawPoints: [{ x: 0, y: 0 }] });
      return;
    }

    // Click-to-place single-click tools (text, ground, transistor, opamp)
    if (mode === "click") {
      const pal = getPaletteItem(activeTool);
      const w = pal?.defaultWidth ?? 1, h = pal?.defaultHeight ?? 1;
      const targetX = sx - w / 2, targetY = sy - h / 2;
      const id = addShapeFromPalette(activeTool as ShapeKind, targetX, targetY);
      // Override grid snap from addShapeFromPalette so the shape sits exactly under the cursor
      updateShape(id, { x: targetX, y: targetY });
      return;
    }

    // Line/Area: 2-click mode
    if (mode === "line" || mode === "area") {
      if (!pendingStart) {
        // First click → record start
        setPendingStart({ x: sx, y: sy });
        setPreviewEnd({ x: sx, y: sy });
        return;
      }
      // Second click → create shape from pendingStart to this click.
      // If Shift is held & tool is line-like, prefer the angle-snapped previewEnd.
      // Always prefer the snap-adjusted previewEnd if available — it already accounts for
      // Shift (forced), auto-angle mode, and auto-pull to cardinal/15° multiples.
      const useEnd = (previewEnd && classifyTool(activeTool) === "line" && !e.altKey)
        ? previewEnd : { x: sx, y: sy };
      const s = pendingStart, end = useEnd;
      const dx = end.x - s.x, dy = end.y - s.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 0.1) {
        // Same spot twice → cancel
        setPendingStart(null); setPreviewEnd(null);
        return;
      }

      if (mode === "line") {
        // Center the bbox on the line — avoids visual offset when min width/height is applied.
        // NOTE: addShapeFromPalette snaps x,y to grid, which would shift the line away from
        // the click points. We override x,y via updateShape to restore exact terminal positions.
        const rawW = Math.abs(dx), rawH = Math.abs(dy);
        const w = Math.max(rawW, 0.3), h = Math.max(rawH, 0.3);
        const centerX = (s.x + end.x) / 2, centerY = (s.y + end.y) / 2;
        const bboxX = centerX - w / 2, bboxY = centerY - h / 2;
        const id = addShapeFromPalette(activeTool as ShapeKind, bboxX, bboxY);
        updateShape(id, {
          x: bboxX, y: bboxY,  // restore exact position (override grid-snap from addShapeFromPalette)
          width: w, height: h,
          points: [{ x: s.x - bboxX, y: s.y - bboxY }, { x: end.x - bboxX, y: end.y - bboxY }],
        });
      } else {
        // area: two corners
        const minX = Math.min(s.x, end.x), minY = Math.min(s.y, end.y);
        const w = Math.abs(dx), h = Math.abs(dy);
        const id = addShapeFromPalette(activeTool as ShapeKind, minX, minY);
        updateShape(id, {
          x: minX, y: minY, // override grid snap → exact corner-to-corner bbox
          width: Math.max(w, 0.2), height: Math.max(h, 0.2),
        });
      }

      setPendingStart(null);
      setPreviewEnd(null);
    }
  }, [activeTool, spaceHeld, shapes, canvasHeight, zoom, offsetX, offsetY, gridSize, snapToGrid, getSvgCoords, clearSelection, addShapeFromPalette, updateShape, select, pushHistory, pendingStart, previewEnd]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const px = getSvgCoords(e);
    lastMousePxRef.current = px;  // for auto-pan rAF loop
    const [tx, ty] = canvasToTikz(px.x, px.y, canvasHeight, zoom, offsetX, offsetY);
    setMousePos({ x: Math.round(tx * 100) / 100, y: Math.round(ty * 100) / 100 });

    // Update grab target — only when NOT actively dragging
    if (!dragging) {
      const target = findGrabTarget(shapes, { x: tx, y: ty });
      if (target !== grabTargetId) setGrabTargetId(target);
    }

    // 2-click preview (between clicks, no drag in progress)
    if (pendingStart) {
      let sx = snapV(tx, gridSize, snapToGrid), sy = snapV(ty, gridSize, snapToGrid);
      const isLineTool = classifyTool(activeTool) === "line";
      const dx = sx - pendingStart.x, dy = sy - pendingStart.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const rawAngle = Math.atan2(dy, dx) * 180 / Math.PI;

      if (isLineTool && dist > 0.01) {
        // IPE auto-angle: every 15°, within ±2° tolerance even without modifier
        // Shift: tight-snap to every 15° regardless of distance from angle
        // Alt: disable all angle snap (free rotation)
        const SNAP_STEP = 15;
        let targetAngle: number | null = null;
        if (e.altKey) {
          targetAngle = null;  // free angle
        } else if (e.shiftKey || autoAngleRef.current) {
          // Hard snap to nearest multiple of 15° (IPE: Shift forces this)
          targetAngle = Math.round(rawAngle / SNAP_STEP) * SNAP_STEP;
        } else {
          // Auto-pull: only snap if close (within ±2.5°) to a 15° multiple → gentle assist
          const nearest = Math.round(rawAngle / SNAP_STEP) * SNAP_STEP;
          if (Math.abs(rawAngle - nearest) < 2.5) targetAngle = nearest;
          // Stronger pull for cardinal/common angles (0/45/90) with wider tolerance
          const strongCardinals = [0, 45, 90, 135, 180, -45, -90, -135];
          for (const c of strongCardinals) {
            const d1 = Math.min(Math.abs(rawAngle - c), Math.abs(rawAngle - c + 360), Math.abs(rawAngle - c - 360));
            if (d1 < 4) { targetAngle = c; break; }
          }
        }

        if (targetAngle !== null) {
          const rad = targetAngle * Math.PI / 180;
          sx = pendingStart.x + dist * Math.cos(rad);
          sy = pendingStart.y + dist * Math.sin(rad);
        }
      }
      setPreviewEnd({ x: sx, y: sy });
    }

    if (!dragging) return;

    if (dragging.mode === "pan") {
      setViewport({ offsetX: dragging.startTikz.x + (px.x - dragging.startPx.x),
                     offsetY: dragging.startTikz.y + (px.y - dragging.startPx.y) });
      return;
    }

    // Marquee select — update end & live-select intersecting shapes
    if (dragging.mode === "marquee") {
      setDragging((prev) => prev ? { ...prev, endTikz: { x: tx, y: ty } } : null);
      const x1 = Math.min(dragging.startTikz.x, tx), x2 = Math.max(dragging.startTikz.x, tx);
      const y1 = Math.min(dragging.startTikz.y, ty), y2 = Math.max(dragging.startTikz.y, ty);
      const hits = shapes.filter((s) => {
        const sx1 = s.x, sx2 = s.x + s.width;
        const sy1 = s.y, sy2 = s.y + s.height;
        return sx1 < x2 && sx2 > x1 && sy1 < y2 && sy2 > y1;
      }).map((s) => s.id);
      // Replace selection with marquee hits (keeping original if Shift held would be nicer but simpler: replace)
      useFigureStore.setState({ selectedIds: hits });
      return;
    }

    const sx = snapV(tx, gridSize, snapToGrid), sy = snapV(ty, gridSize, snapToGrid);

    if (dragging.mode === "move" && dragging.shapeId && dragging.origShape) {
      // Click-vs-drag threshold: ignore tiny movements (< 3 px screen) — feels "decisive"
      const movedPx = Math.hypot(px.x - dragging.startPx.x, px.y - dragging.startPx.y);
      if (movedPx < 3) return;

      const dtx = tx - dragging.startTikz.x, dty = ty - dragging.startTikz.y;
      // Start with fine-granularity (0.05 cm) — ergonomic pixel-level control
      let nx = fineQuantize(dragging.origShape.x + dtx);
      let ny = fineQuantize(dragging.origShape.y + dty);

      // Smart snap to other shapes' terminals/corners/centers/edges
      // Shift key disables smart snap for free movement
      if (!e.shiftKey) {
        const moving = { ...dragging.origShape, x: nx, y: ny };
        const otherPts = collectSnapPoints(shapes, dragging.shapeId);
        // Threshold: ~0.3 cm (screen ~15 px at 1x zoom) — feels natural without being aggressive
        const snap = computeSmartSnap(moving, otherPts, 0.3);
        if (snap) {
          nx = fineQuantize(nx + snap.dx);
          ny = fineQuantize(ny + snap.dy);
          setActiveSnap(snap);
        } else {
          // Fallback: coarse grid snap IF enabled AND no smart snap available
          if (snapToGrid) {
            nx = snapV(nx, gridSize, true);
            ny = snapV(ny, gridSize, true);
          }
          setActiveSnap(null);
        }
      } else {
        setActiveSnap(null);
      }

      updateShape(dragging.shapeId, { x: nx, y: ny });
      return;
    }

    if (dragging.mode === "resize" && dragging.shapeId && dragging.origShape && dragging.resizeDir) {
      const o = dragging.origShape, d = dragging.resizeDir;
      let nx = o.x, ny = o.y, nw = o.width, nh = o.height;
      if (d.includes("e")) nw = Math.max(0.2, sx - o.x);
      if (d.includes("w")) { nw = Math.max(0.2, o.x + o.width - sx); nx = sx; }
      if (d.includes("n")) nh = Math.max(0.2, sy - o.y);
      if (d.includes("s")) { nh = Math.max(0.2, o.y + o.height - sy); ny = sy; }
      updateShape(dragging.shapeId, { x: nx, y: ny, width: nw, height: nh });
      return;
    }

    if (dragging.mode === "draw-freehand") {
      const dx = tx - dragging.startTikz.x, dy = ty - dragging.startTikz.y;
      const pts = [...(dragging.drawPoints || []), { x: dx, y: dy }];
      dragging.drawPoints = pts;
      setDragging((prev) => prev ? { ...prev } : null); // trigger re-render
      return;
    }
  }, [dragging, pendingStart, shapes, grabTargetId, getSvgCoords, canvasHeight, zoom, offsetX, offsetY, gridSize, snapToGrid, updateShape, setViewport]);

  const handleMouseUp = useCallback(() => {
    if (!dragging) return;

    if (dragging.mode === "draw-freehand" && dragging.drawPoints && dragging.drawPoints.length >= 3) {
      const id = addShapeFromPalette("freehand", dragging.startTikz.x, dragging.startTikz.y);
      updateShape(id, { points: dragging.drawPoints });
    }

    setDragging(null);
    setActiveSnap(null);
  }, [dragging, addShapeFromPalette, updateShape]);

  // ── Shape interaction ─────────────────────────────────────────

  const handleShapeMouseDown = useCallback((_e: React.MouseEvent, _id: string) => {
    // Grab/pass-through is now fully handled by canvas handleMouseDown via findGrabTarget().
    // Always let the event bubble — don't stopPropagation here.
  }, []);

  const handleResizeDown = useCallback((e: React.MouseEvent, id: string, dir: ResizeDir) => {
    // Pass through when drawing tool active (so users can click through selection handles)
    if (activeTool !== "select") return;
    e.stopPropagation();
    const sh = shapes.find((s) => s.id === id); if (!sh) return; pushHistory();
    const px = getSvgCoords(e);
    const [tx, ty] = canvasToTikz(px.x, px.y, canvasHeight, zoom, offsetX, offsetY);
    setDragging({ mode: "resize", startPx: px, startTikz: { x: tx, y: ty }, shapeId: id, resizeDir: dir,
      origShape: { ...sh, style: { ...sh.style }, points: sh.points.map((p) => ({ ...p })), tikzOptions: { ...sh.tikzOptions } } });
  }, [activeTool, shapes, pushHistory, getSvgCoords, canvasHeight, zoom, offsetX, offsetY]);

  // ── Wheel (non-passive, attached natively to prevent browser zoom/scroll) ─────

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      // Always preventDefault: stops browser zoom (Ctrl+scroll) and horizontal nav (trackpad swipe)
      e.preventDefault();
      e.stopPropagation();

      if (e.ctrlKey || e.metaKey) {
        // Discrete zoom
        const dir = e.deltaY > 0 ? -1 : 1;
        const { zoom: curZ, offsetX: curOx, offsetY: curOy } = useFigureStore.getState().viewport;
        const nz = nextZoom(curZ, dir as 1 | -1);
        if (nz === curZ) return;
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return;
        const px = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        const r = nz / curZ;
        useFigureStore.getState().setViewport({
          zoom: nz,
          offsetX: px.x - (px.x - curOx) * r,
          offsetY: px.y - (px.y - curOy) * r,
        });
      } else {
        // Pan with trackpad / mouse wheel (deltaX + deltaY)
        const { offsetX: curOx, offsetY: curOy } = useFigureStore.getState().viewport;
        useFigureStore.getState().setViewport({
          offsetX: curOx - e.deltaX,
          offsetY: curOy - e.deltaY,
        });
      }
    };

    // non-passive so preventDefault() actually works
    el.addEventListener("wheel", onWheel, { passive: false });

    // Block right-click menu (user often right-clicks accidentally)
    const onContextMenu = (e: MouseEvent) => { e.preventDefault(); };
    el.addEventListener("contextmenu", onContextMenu);

    // Block browser back/forward trackpad swipe (horizontal overscroll)
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    el.addEventListener("touchmove", onTouchMove, { passive: false });

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("contextmenu", onContextMenu);
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  // ── Keyboard ──────────────────────────────────────────────────

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      // Skip when typing in an input/textarea
      const t = document.activeElement?.tagName ?? "";
      if (["INPUT", "TEXTAREA"].includes(t) || (document.activeElement as HTMLElement)?.isContentEditable) return;

      // Arrow keys → nudge selected shapes (Shift = larger step)
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        const sel = useFigureStore.getState().selectedIds;
        if (sel.length === 0) return;
        e.preventDefault();
        const step = e.shiftKey ? 0.5 : 0.05;
        const dx = e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0;
        const dy = e.key === "ArrowUp" ? step : e.key === "ArrowDown" ? -step : 0;
        const allShapes = useFigureStore.getState().shapes;
        useFigureStore.getState().pushHistory();
        for (const id of sel) {
          const sh = allShapes.find((s) => s.id === id);
          if (!sh || sh.locked) continue;
          useFigureStore.getState().updateShape(id, { x: sh.x + dx, y: sh.y + dy });
        }
        return;
      }

      // Browser-shortcut interceptions — always preventDefault before acting
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        useFigureStore.getState().deleteSelected();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        if (pendingStart) { setPendingStart(null); setPreviewEnd(null); }
        else { clearSelection(); setActiveTool("select"); setDragging(null); }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        e.shiftKey ? useFigureStore.getState().redo() : useFigureStore.getState().undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        useFigureStore.getState().redo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        useFigureStore.getState().selectAll();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "d" || e.key === "D")) {
        e.preventDefault();  // Stops browser bookmark dialog
        useFigureStore.getState().duplicateSelected();
        return;
      }
      // Browser zoom — intercept so user stays in app
      if ((e.metaKey || e.ctrlKey) && (e.key === "+" || e.key === "=" || e.key === "-" || e.key === "0")) {
        e.preventDefault();
        const { zoom, offsetX, offsetY } = useFigureStore.getState().viewport;
        if (e.key === "0") centerCanvas(1);
        else {
          const dir = (e.key === "-") ? -1 : 1;
          const nz = nextZoom(zoom, dir as 1 | -1);
          const rect = svgRef.current?.getBoundingClientRect();
          if (rect) {
            const cx = rect.width / 2, cy = rect.height / 2;
            const r = nz / zoom;
            useFigureStore.getState().setViewport({ zoom: nz, offsetX: cx - (cx - offsetX) * r, offsetY: cy - (cy - offsetY) * r });
          }
        }
        return;
      }
      // Tool hotkeys (no modifier)
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "v") setActiveTool("select");
      else if (k === "r") setActiveTool("rect");
      else if (k === "c") setActiveTool("circle");
      else if (k === "l") setActiveTool("line");
      else if (k === "t") setActiveTool("text");
      else if (k === "a") setActiveTool("arrow");
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [clearSelection, setActiveTool, pendingStart]);

  // ══════════════════════════════════════════════════════════════
  //  DRAW PREVIEW
  // ══════════════════════════════════════════════════════════════

  const renderDrawPreview = useCallback(() => {
    // Freehand drag preview
    if (dragging && dragging.mode === "draw-freehand" && dragging.drawPoints && dragging.drawPoints.length >= 2) {
      const [bx, by] = tikzToCanvas(dragging.startTikz.x, dragging.startTikz.y, canvasHeight, zoom, offsetX, offsetY);
      const d = dragging.drawPoints.map((p, i) => `${i === 0 ? "M" : "L"}${bx + p.x * scale},${by + (-p.y) * scale}`).join(" ");
      return <path d={d} stroke="#0d9488" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
    }

    // 2-click mode preview
    if (!pendingStart) return null;
    const mode = classifyTool(activeTool);
    const [x1, y1] = tikzToCanvas(pendingStart.x, pendingStart.y, canvasHeight, zoom, offsetX, offsetY);

    // Start marker (shown after first click)
    const startMarker = (<g>
      <circle cx={x1} cy={y1} r={7} fill="#0d9488" opacity={0.12} />
      <circle cx={x1} cy={y1} r={4} fill="#0d9488" />
      <circle cx={x1} cy={y1} r={1.5} fill="white" />
      <text x={x1 + 10} y={y1 - 8} fontSize="10" fill="#0d9488" fontFamily="monospace" fontWeight="700">
        ({pendingStart.x.toFixed(1)}, {pendingStart.y.toFixed(1)})
      </text>
    </g>);

    if (!previewEnd) return startMarker;

    const [x2, y2] = tikzToCanvas(previewEnd.x, previewEnd.y, canvasHeight, zoom, offsetX, offsetY);
    const dx = previewEnd.x - pendingStart.x, dy = previewEnd.y - pendingStart.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (mode === "line") {
      // Show angle (0..360) in addition to length
      const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
      const angleDisplay = ((angleDeg + 360) % 360).toFixed(0);
      // Is the angle an exact multiple of 15°? → show in highlight color
      const isAngleSnapped = Math.abs(angleDeg - Math.round(angleDeg / 15) * 15) < 0.01;
      const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
      return (<g>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#0d9488" strokeWidth={1.5} strokeDasharray="5,3" />
        {startMarker}
        {/* End preview (follows cursor) */}
        <circle cx={x2} cy={y2} r={5} fill="white" stroke="#0d9488" strokeWidth={2} />
        <circle cx={x2} cy={y2} r={2} fill="#0d9488" />
        {dist > 0.05 && (<>
          {/* Length badge */}
          <rect x={midX - 36} y={midY - 22} width={72} height={14} rx={3}
            fill="white" stroke="#0d9488" strokeWidth={0.6} opacity={0.9} />
          <text x={midX} y={midY - 12} textAnchor="middle" fontSize="10"
            fill="#0d9488" fontFamily="monospace" fontWeight="700">
            {dist.toFixed(2)}cm · {angleDisplay}°{isAngleSnapped ? " ⦿" : ""}
          </text>
        </>)}
      </g>);
    }

    if (mode === "area") {
      const minX = Math.min(pendingStart.x, previewEnd.x), maxY = Math.max(pendingStart.y, previewEnd.y);
      const [rx, ry] = tikzToCanvas(minX, maxY, canvasHeight, zoom, offsetX, offsetY);
      const w = Math.abs(dx) * scale, h = Math.abs(dy) * scale;
      return (<g>
        <rect x={rx} y={ry} width={w} height={h} stroke="#0d9488" strokeWidth={1.5}
          fill="rgba(13,148,136,0.06)" strokeDasharray="5,3" rx={2} />
        {startMarker}
        <circle cx={x2} cy={y2} r={5} fill="white" stroke="#0d9488" strokeWidth={2} />
        <circle cx={x2} cy={y2} r={2} fill="#0d9488" />
        {(Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) && (
          <text x={rx + w / 2} y={ry - 6} textAnchor="middle" fontSize="10"
            fill="#0d9488" fontFamily="monospace" fontWeight="600">
            {Math.abs(dx).toFixed(2)} x {Math.abs(dy).toFixed(2)} cm
          </text>
        )}
      </g>);
    }

    return startMarker;
  }, [dragging, pendingStart, previewEnd, activeTool, canvasHeight, zoom, offsetX, offsetY, scale]);

  // ── Cursor ────────────────────────────────────────────────────

  let cursor = "cursor-default";
  if (dragging?.mode === "move") cursor = "cursor-grabbing";
  else if (spaceHeld || activeTool === "pan") cursor = dragging?.mode === "pan" ? "cursor-grabbing" : "cursor-grab";
  else if (grabTargetId) cursor = "cursor-grab";
  else if (activeTool !== "select") cursor = "cursor-crosshair";

  // ── Tool hint ─────────────────────────────────────────────────

  let toolHint = "";
  if (activeTool !== "select" && activeTool !== "pan") {
    const mode = classifyTool(activeTool);
    if (mode === "line")
      toolHint = pendingStart
        ? (isJa ? "終点をクリック (Shiftで15°刻み · Altで自由)" : "Click END point (Shift: 15° snap · Alt: free)")
        : (isJa ? "始点をクリック" : "Click START point");
    else if (mode === "area")
      toolHint = pendingStart
        ? (isJa ? "対角の点をクリック" : "Click OPPOSITE corner")
        : (isJa ? "最初の角をクリック" : "Click FIRST corner");
    else if (mode === "freehand") toolHint = isJa ? "ドラッグで自由に描画" : "Drag to draw freely";
    else toolHint = isJa ? "クリックして配置" : "Click to place";
  }

  // ── Context bar (bottom, persistent) — mode-aware hints ───────
  const contextBarItems: { label: string; value: string }[] = [];
  if (activeTool === "select") {
    if (selectedIds.length === 0) {
      contextBarItems.push({
        label: isJa ? "選択モード" : "Select",
        value: isJa ? "図形をクリックで選択 · 空白をドラッグで複数選択 · ダブルクリックでフォーカス"
                    : "Click shape to select · drag empty area for marquee · dbl-click to focus",
      });
    } else {
      contextBarItems.push({
        label: selectedIds.length === 1 ? (isJa ? "1個選択中" : "1 shape selected") : (isJa ? `${selectedIds.length}個選択中` : `${selectedIds.length} shapes selected`),
        value: isJa ? "矢印キー 0.5mm · ⇧+矢印 5mm · ⌘D 複製 · Del 削除"
                    : "Arrows: 0.5mm · ⇧+arrows: 5mm · ⌘D duplicate · Del remove",
      });
    }
  } else if (classifyTool(activeTool) === "line") {
    contextBarItems.push({
      label: isJa ? "線描画モード" : "Line drawing",
      value: isJa ? "2点クリック · Shiftで15°刻みスナップ · Altで自由角度 · Escでキャンセル"
                  : "Click 2 points · Shift: 15° snap · Alt: free angle · Esc: cancel",
    });
  } else if (classifyTool(activeTool) === "area") {
    contextBarItems.push({
      label: isJa ? "領域描画モード" : "Area drawing",
      value: isJa ? "対角の2点をクリックで矩形の大きさを指定"
                  : "Click two opposite corners to define the bounding box",
    });
  } else if (activeTool === "freehand") {
    contextBarItems.push({
      label: isJa ? "フリーハンド" : "Freehand",
      value: isJa ? "マウスボタンを押しながらドラッグして描画"
                  : "Hold the mouse button and drag to sketch",
    });
  } else {
    contextBarItems.push({
      label: isJa ? "配置モード" : "Placement",
      value: isJa ? "キャンバスをクリックして図形を配置"
                  : "Click on the canvas to drop the shape",
    });
  }

  // ══════════════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════════════

  const svgW = containerSize.w, svgH = containerSize.h;
  const selSet = new Set(selectedIds);
  const sorted = [...shapes].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div
      ref={containerRef}
      className={`relative flex-1 overflow-hidden my-2 rounded-xl border border-black/[0.08] ${cursor}`}
      style={{
        // Canvas: very slightly warm off-white so it reads as "drawing paper" vs the workspace
        background: "#fcfcfa",
        touchAction: "none",
        overscrollBehavior: "contain",
        userSelect: "none",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.8) inset, " +
          "0 8px 24px -10px rgba(0,0,0,0.18), " +
          "0 1px 4px rgba(0,0,0,0.06)",
      }}
    >
      <svg ref={svgRef} width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp} onMouseLeave={() => { handleMouseUp(); setMousePos(null); }}
        onDoubleClick={(e) => {
          const px = getSvgCoords(e);
          const [tx, ty] = canvasToTikz(px.x, px.y, canvasHeight, zoom, offsetX, offsetY);
          // Find topmost shape under cursor
          const sorted = [...shapes].sort((a, b) => b.zIndex - a.zIndex);
          const hit = sorted.find((s) =>
            tx >= s.x && tx <= s.x + s.width && ty >= s.y && ty <= s.y + s.height);
          if (hit) focusShape(hit.id);
          else fitToContent();  // Empty space dbl-click → fit all
        }}
        className="select-none" style={{ display: "block" }}>

        <defs>{shapes.map((s) => <ArrowDefs key={`d-${s.id}`} shape={s} scale={scale} />)}</defs>

        {/* Canvas bg */}
        <rect x={offsetX} y={offsetY} width={canvasWidth * scale} height={canvasHeight * scale}
          fill="white" stroke="rgba(0,0,0,0.12)" strokeWidth={1} rx={2} />

        {gridLines()}
        {renderSnapGuides()}

        {/* Shapes */}
        {sorted.map((sh) => {
          const c = shapeToCanvasCoords(sh);
          return <ShapeRenderer key={sh.id} shape={sh} scale={scale} {...c}
            selected={selSet.has(sh.id)} hovered={hoveredId === sh.id}
            onMouseDown={(e) => handleShapeMouseDown(e, sh.id)}
            onMouseEnter={() => setHovered(sh.id)} onMouseLeave={() => setHovered(null)} />;
        })}

        {/* Active snap indicator — visual feedback while smart-snapping during move */}
        {activeSnap && dragging?.mode === "move" && activeSnap.matches.map((m, i) => {
          const [ox, oy] = tikzToCanvas(m.other.x, m.other.y, canvasHeight, zoom, offsetX, offsetY);
          const [mx, my] = tikzToCanvas(m.my.x + activeSnap.dx, m.my.y + activeSnap.dy, canvasHeight, zoom, offsetX, offsetY);
          // Point snap: dot + short guide
          if (m.axis === "point") {
            return (<g key={`snap-${i}`} pointerEvents="none">
              <circle className="snap-pulse" cx={ox} cy={oy} r={8} fill="#ec4899" opacity={0.15} />
              <circle cx={ox} cy={oy} r={5} fill="none" stroke="#ec4899" strokeWidth={1.5} />
              <circle cx={ox} cy={oy} r={2} fill="#ec4899" />
              <text x={ox + 10} y={oy - 8} fontSize="9" fill="#ec4899" fontFamily="monospace" fontWeight="700">
                {m.other.type}
              </text>
            </g>);
          }
          // Axis snap: dashed guide line
          if (m.axis === "x") {
            return (<line key={`snap-${i}`} x1={ox} y1={offsetY} x2={ox} y2={canvasHeight * scale + offsetY}
              stroke="#ec4899" strokeWidth={1} strokeDasharray="4,3" opacity={0.7} pointerEvents="none" />);
          }
          return (<line key={`snap-${i}`} x1={offsetX} y1={oy} x2={canvasWidth * scale + offsetX} y2={oy}
            stroke="#ec4899" strokeWidth={1} strokeDasharray="4,3" opacity={0.7} pointerEvents="none" />);
        })}

        {/* Grab target hover indicator — expanded padding + corner ticks for clarity */}
        {grabTargetId && !dragging && (() => {
          const sh = shapes.find((s) => s.id === grabTargetId);
          if (!sh) return null;
          const { cx, cy, pw, ph } = shapeToCanvasCoords(sh);
          const pad = 6; // breathing room around tight bboxes
          const x = cx - pad, y = cy - pad, w = pw + pad * 2, h = ph + pad * 2;
          const tick = 8;
          return (<g pointerEvents="none">
            {/* Soft background to make it visually obvious */}
            <rect x={x} y={y} width={w} height={h} rx={4}
              fill="rgba(59,130,246,0.04)" stroke="rgba(59,130,246,0.45)"
              strokeWidth={1} strokeDasharray="4,3" />
            {/* Corner tick marks — solid, clearly indicate bbox extent */}
            {[[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]].map(([px, py, sx, sy], i) => (
              <path key={i} d={`M${px + sx * tick},${py} L${px},${py} L${px},${py + sy * tick}`}
                stroke="#3b82f6" strokeWidth={1.6} fill="none" strokeLinecap="round" />
            ))}
          </g>);
        })()}

        {/* Draw preview */}
        {renderDrawPreview()}

        {/* Marquee selection rectangle */}
        {dragging?.mode === "marquee" && dragging.endTikz && (() => {
          const s = dragging.startTikz, e = dragging.endTikz;
          const minX = Math.min(s.x, e.x), maxY = Math.max(s.y, e.y);
          const [rx, ry] = tikzToCanvas(minX, maxY, canvasHeight, zoom, offsetX, offsetY);
          const w = Math.abs(e.x - s.x) * scale, h = Math.abs(e.y - s.y) * scale;
          return (
            <rect x={rx} y={ry} width={w} height={h}
              fill="rgba(59,130,246,0.08)" stroke="#3b82f6"
              strokeWidth={1} strokeDasharray="4,3" pointerEvents="none" />
          );
        })()}

        {/* Selection handles — only interactive in select mode */}
        {activeTool === "select" && selectedIds.map((id) => {
          const sh = shapes.find((s) => s.id === id); if (!sh) return null;
          const { cx, cy, pw, ph } = shapeToCanvasCoords(sh);
          const pad = 6;
          const x = cx - pad, y = cy - pad, w = pw + pad * 2, h = ph + pad * 2;
          return (<g key={`h-${id}`}>
            {/* Selection pulse — brief attention-getter on new selection */}
            <rect key={`pulse-${id}-${pulseToken}`} className="selection-pulse"
              x={x} y={y} width={w} height={h} rx={4}
              fill="none" stroke="#3b82f6" pointerEvents="none" />
            {/* Soft tint + dashed rect */}
            <rect x={x} y={y} width={w} height={h} rx={4}
              fill="rgba(59,130,246,0.04)" stroke="#3b82f6" strokeWidth={1}
              strokeDasharray="4,3" pointerEvents="none" />
            <text x={cx + pw / 2} y={y - 6} textAnchor="middle" fontSize="9" fill="#3b82f6"
              fontFamily="monospace" pointerEvents="none" opacity={0.75} fontWeight="600">
              {sh.width.toFixed(1)} x {sh.height.toFixed(1)} cm
            </text>
            {/* Terminal dots for line-like shapes */}
            {sh.points.length >= 2 && (<>
              <circle cx={cx + sh.points[0].x * scale} cy={cy + (sh.height - sh.points[0].y) * scale}
                r={4} fill="#3b82f6" opacity={0.6} pointerEvents="none" />
              <circle cx={cx + sh.points[sh.points.length - 1].x * scale}
                cy={cy + (sh.height - sh.points[sh.points.length - 1].y) * scale}
                r={4} fill="white" stroke="#3b82f6" strokeWidth={1.5} pointerEvents="none" />
            </>)}
            {/* Resize handles on the PADDED bbox so they don't overlap the shape itself */}
            {RESIZE_HANDLES.map((rh) => (
              <rect key={rh.dir} x={x + w * rh.dx - 4} y={y + h * rh.dy - 4} width={8} height={8}
                fill="white" stroke="#3b82f6" strokeWidth={1.5} rx={2} style={{ cursor: rh.cursor }}
                onMouseDown={(e) => handleResizeDown(e, id, rh.dir)} />
            ))}
          </g>);
        })}

        {renderRulers()}
      </svg>

      {/* ══════════════════════════════════════════════════════════════
           FLOATING QUICK ACTIONS — appears above selected shape
        ══════════════════════════════════════════════════════════════ */}
      {selectedIds.length > 0 && activeTool === "select" && !dragging && (() => {
        const ids = selectedIds;
        // Compute bounding box of all selected shapes in screen coords
        let minX = Infinity, minY = Infinity, maxX = -Infinity;
        for (const id of ids) {
          const sh = shapes.find((s) => s.id === id);
          if (!sh) continue;
          const c = shapeToCanvasCoords(sh);
          minX = Math.min(minX, c.cx);
          minY = Math.min(minY, c.cy);
          maxX = Math.max(maxX, c.cx + c.pw);
        }
        if (!isFinite(minX)) return null;
        const barX = Math.max(8, Math.min(containerSize.w - 280, (minX + maxX) / 2 - 140));
        const barY = Math.max(8, minY - 44); // 44px above the selection
        const firstSh = shapes.find((s) => s.id === ids[0]);
        const isLocked = firstSh?.locked ?? false;
        return (
          <div
            className="absolute z-20 flex items-center gap-0.5 bg-white dark:bg-neutral-800 rounded-lg shadow-2xl border border-foreground/[0.08] p-1 animate-scale-in pointer-events-auto"
            style={{ left: barX, top: barY }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Color quick-pick */}
            <button
              onClick={() => setShowQuickColors(!showQuickColors)}
              title={isJa ? "線の色を変更" : "Change stroke color"}
              className="h-7 w-7 flex items-center justify-center rounded text-foreground/60 hover:bg-foreground/[0.06] hover:text-foreground transition-colors"
            >
              <Palette size={13} />
            </button>
            {showQuickColors && (
              <div className="absolute top-9 left-0 bg-white dark:bg-neutral-800 rounded-lg shadow-xl border border-foreground/[0.08] p-1.5 grid grid-cols-7 gap-1 z-30">
                {IPE_COLORS.slice(0, 21).map((c) => (
                  <button key={c.name} title={c.name}
                    onClick={() => {
                      useFigureStore.getState().pushHistory();
                      useFigureStore.getState().applyStyleToSelected({ stroke: c.name });
                      setShowQuickColors(false);
                    }}
                    className="h-5 w-5 rounded ring-1 ring-foreground/[0.1] hover:scale-110 hover:ring-2 hover:ring-blue-500 transition-all"
                    style={{ backgroundColor: c.rgb }}
                  />
                ))}
              </div>
            )}
            <div className="w-px h-4 bg-foreground/[0.08] mx-0.5" />
            {/* Duplicate */}
            <button
              onClick={() => useFigureStore.getState().duplicateSelected()}
              title={isJa ? "選択を複製 (⌘D)" : "Duplicate selection (⌘D)"}
              className="h-7 w-7 flex items-center justify-center rounded text-foreground/60 hover:bg-foreground/[0.06] hover:text-foreground transition-colors"
            ><Copy size={13} /></button>
            {/* Rotate 90° */}
            <button
              onClick={() => {
                useFigureStore.getState().pushHistory();
                for (const id of ids) {
                  const sh = useFigureStore.getState().shapes.find((s) => s.id === id);
                  if (sh) useFigureStore.getState().updateShape(id, { rotation: ((sh.rotation ?? 0) + 90) % 360 });
                }
              }}
              title={isJa ? "90°回転" : "Rotate 90° clockwise"}
              className="h-7 w-7 flex items-center justify-center rounded text-foreground/60 hover:bg-foreground/[0.06] hover:text-foreground transition-colors"
            ><RotateCw size={13} /></button>
            {/* Lock toggle */}
            <button
              onClick={() => {
                useFigureStore.getState().pushHistory();
                for (const id of ids) {
                  useFigureStore.getState().updateShape(id, { locked: !isLocked });
                }
              }}
              title={isLocked
                ? (isJa ? "ロック解除 (移動可能に)" : "Unlock (allow moving)")
                : (isJa ? "ロック (誤操作防止)" : "Lock (prevent accidental edits)")}
              className={`h-7 w-7 flex items-center justify-center rounded transition-colors ${
                isLocked ? "text-amber-600 bg-amber-50 dark:bg-amber-500/10" : "text-foreground/60 hover:bg-foreground/[0.06] hover:text-foreground"
              }`}
            >{isLocked ? <Lock size={13} /> : <Unlock size={13} />}</button>
            <div className="w-px h-4 bg-foreground/[0.08] mx-0.5" />
            {/* Delete */}
            <button
              onClick={() => useFigureStore.getState().deleteSelected()}
              title={isJa ? "削除 (Del)" : "Delete selection (Del)"}
              className="h-7 w-7 flex items-center justify-center rounded text-foreground/60 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 transition-colors"
            ><Trash2 size={13} /></button>
            {/* Selection count badge */}
            {ids.length > 1 && (
              <span className="ml-1 px-1.5 py-0.5 rounded bg-blue-500 text-white text-[9px] font-bold">
                {ids.length}
              </span>
            )}
          </div>
        );
      })()}

      {/* ══════════════════════════════════════════════════════════════
           CONTEXT BAR — mode-aware hints (IPE-inspired, always visible)
        ══════════════════════════════════════════════════════════════ */}
      {contextBarItems.length > 0 && (
        <div className="absolute bottom-[38px] left-2 right-2 pointer-events-none flex justify-center">
          <div className="bg-white/90 dark:bg-neutral-800/95 backdrop-blur-md border border-foreground/[0.08] rounded-full px-3 py-1 shadow-md flex items-center gap-2 pointer-events-auto">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 shrink-0">
              {contextBarItems[0].label}
            </span>
            <span className="w-px h-3 bg-foreground/[0.1]" />
            <span className="text-[10px] text-foreground/65 truncate">
              {contextBarItems[0].value}
            </span>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
           STATUS BAR (bottom) — coordinates + selection + snap + grid state
        ══════════════════════════════════════════════════════════════ */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2 pointer-events-none">
        {/* Left: coordinate readout */}
        <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md text-white text-[10px] font-mono px-2.5 py-1 rounded-md pointer-events-auto shadow-lg">
          {mousePos ? (
            <>
              <span className="text-white/60">x</span><span className="font-semibold">{mousePos.x.toFixed(1)}</span>
              <span className="text-white/60">y</span><span className="font-semibold">{mousePos.y.toFixed(1)}</span>
              <span className="text-white/40 text-[9px]">cm</span>
            </>
          ) : (
            <span className="text-white/50">{isJa ? "— カーソルを動かすと座標表示 —" : "— move cursor to see coordinates —"}</span>
          )}
        </div>

        {/* Center: active selection info */}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-1.5 bg-blue-500/90 backdrop-blur-md text-white text-[10px] font-semibold px-2.5 py-1 rounded-md pointer-events-auto shadow-lg">
            <Layers size={11} />
            <span>
              {isJa
                ? `${selectedIds.length} 個選択中`
                : `${selectedIds.length} ${selectedIds.length === 1 ? "shape" : "shapes"} selected`}
            </span>
          </div>
        )}

        {/* Right: snap + grid state indicators (compact, clickable) */}
        <div className="flex items-center gap-1 pointer-events-auto">
          <button onClick={() => setAutoAngle(!autoAngle)}
            title={isJa
              ? "自動角度スナップ (線描画時に15°単位で自動整列 · Alt押下で一時無効)"
              : "Auto-angle: snap every 15° while drawing lines (hold Alt to override)"}
            className={`flex items-center gap-1 backdrop-blur-md text-[9.5px] font-mono px-2 py-1 rounded-md shadow-sm transition-colors ${
              autoAngle ? "bg-pink-500/90 text-white" : "bg-black/40 text-white/60 hover:bg-black/55"
            }`}>
            <span className="font-semibold">∠</span>
            {autoAngle ? (isJa ? "15°" : "15° snap") : (isJa ? "自由角度" : "free angle")}
          </button>
          <button onClick={() => useFigureStore.getState().toggleSnapToGrid()}
            title={isJa ? "スマートスナップ (Shift で一時無効)" : "Smart snap (hold Shift to disable)"}
            className={`flex items-center gap-1 backdrop-blur-md text-[9.5px] font-mono px-2 py-1 rounded-md shadow-sm transition-colors ${
              snapToGrid ? "bg-emerald-500/90 text-white" : "bg-black/40 text-white/60 hover:bg-black/55"
            }`}>
            <Magnet size={10} /> {snapToGrid ? (isJa ? "スナップ" : "snap on") : (isJa ? "自由" : "free")}
          </button>
          <button onClick={() => useFigureStore.getState().toggleShowGrid()}
            title={isJa ? "グリッド表示 (クリックで切替)" : "Toggle grid visibility"}
            className={`flex items-center gap-1 backdrop-blur-md text-[9.5px] font-mono px-2 py-1 rounded-md shadow-sm transition-colors ${
              showGrid ? "bg-black/60 text-white" : "bg-black/40 text-white/60 hover:bg-black/55"
            }`}>
            <Grid3x3 size={10} /> {showGrid ? (isJa ? "グリッド" : "grid on") : (isJa ? "なし" : "off")}
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
           FLOATING ZOOM CONTROLS (right edge, vertically centered)
        ══════════════════════════════════════════════════════════════ */}
      <div className="absolute top-1/2 right-3 -translate-y-1/2 flex flex-col gap-1 bg-white/95 dark:bg-neutral-800/95 backdrop-blur-md rounded-lg shadow-lg border border-foreground/[0.06] p-1">
        <HelpTip side="left" title={isJa ? "拡大" : "Zoom in"} kbd="⌘+"
          description={isJa ? "1段階拡大 (滑らかアニメーション)" : "Step up with smooth animation"}>
          <button onClick={zoomIn}
            className="h-8 w-8 flex items-center justify-center rounded-md text-foreground/60 hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
          ><ZoomIn size={14} /></button>
        </HelpTip>
        <HelpTip side="left" title={isJa ? "現在のズーム率" : "Current zoom"}
          description={isJa ? `最大1200%まで拡大可能` : `Zoom range 10% – 1200%`}>
          <div className="text-[10px] font-mono text-center text-foreground/50 py-0.5 select-none cursor-help">
            {Math.round(zoom * 100)}%
          </div>
        </HelpTip>
        <HelpTip side="left" title={isJa ? "縮小" : "Zoom out"} kbd="⌘−"
          description={isJa ? "1段階縮小" : "Step down with smooth animation"}>
          <button onClick={zoomOut}
            className="h-8 w-8 flex items-center justify-center rounded-md text-foreground/60 hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
          ><ZoomOut size={14} /></button>
        </HelpTip>
        <div className="h-px bg-foreground/[0.08] mx-1" />
        <HelpTip side="left" title={isJa ? "全体表示" : "Fit to content"}
          description={isJa ? "全ての図形が画面に収まるよう自動ズーム" : "Auto-zoom so every shape fits in view"}>
          <button onClick={fitToContent}
            className="h-8 w-8 flex items-center justify-center rounded-md text-foreground/60 hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
          ><Maximize2 size={13} /></button>
        </HelpTip>
        <HelpTip side="left" title={isJa ? "中央に戻す (100%)" : "Re-center (100%)"} kbd="⌘0"
          description={isJa ? "キャンバスの中心を画面中央に配置・等倍表示に戻す" : "Center the canvas paper on screen at 1:1 zoom"}>
          <button onClick={() => centerCanvas(1)}
            className="h-7 w-8 flex items-center justify-center rounded-md text-foreground/60 hover:text-foreground hover:bg-foreground/[0.06] transition-colors text-[9px] font-mono font-semibold"
          >100%</button>
        </HelpTip>
      </div>

      {/* ══════════════════════════════════════════════════════════════
           HELP BUTTON + POPOVER (top-right)
        ══════════════════════════════════════════════════════════════ */}
      <div className="absolute top-3 right-3">
        <button
          onClick={() => setShowHelp(!showHelp)}
          className={`h-8 w-8 flex items-center justify-center rounded-full backdrop-blur-md transition-all shadow-sm ${
            showHelp ? "bg-blue-500 text-white shadow-blue-500/30" : "bg-white/90 dark:bg-neutral-800/90 text-foreground/60 hover:text-foreground border border-foreground/[0.08]"
          }`}
          title={isJa ? "ショートカット・使い方ヘルプ" : "Keyboard shortcuts & usage guide"}
        ><HelpCircle size={14} /></button>
        {showHelp && (
          <div className="absolute top-10 right-0 w-[340px] max-h-[80vh] overflow-y-auto bg-white dark:bg-neutral-800 rounded-lg shadow-2xl border border-foreground/[0.1] p-3 text-[11px] animate-scale-in">
            {/* Section: Tools */}
            <HelpSection title={isJa ? "ツール" : "Tools"}>
              <HelpRow kbd="V" label={isJa ? "選択モード — クリックで掴む、ドラッグで複数選択" : "Select tool — click to grab, drag to multi-select"} />
              <HelpRow kbd="R / C" label={isJa ? "四角・円ツール" : "Rectangle / Circle tool"} />
              <HelpRow kbd="L / A" label={isJa ? "直線・矢印ツール" : "Line / Arrow tool"} />
              <HelpRow kbd="T" label={isJa ? "テキストツール" : "Text tool"} />
            </HelpSection>

            {/* Section: Drawing */}
            <HelpSection title={isJa ? "描画" : "Drawing"}>
              <HelpRow kbd={isJa ? "クリック" : "Click"} label={isJa ? "始点を設定 → 2回目クリックで完成" : "Set start point — second click finishes shape"} />
              <HelpRow kbd={isJa ? "Shift+クリック" : "Shift+click"} label={isJa ? "角度を 22.5° / 30° / 45° / 90° にスナップ" : "Snap angle to 22.5° / 30° / 45° / 90°"} />
              <HelpRow kbd="Esc" label={isJa ? "描画キャンセル / 選択モードへ" : "Cancel drawing / return to select"} />
            </HelpSection>

            {/* Section: Move & Edit */}
            <HelpSection title={isJa ? "移動・編集" : "Move & Edit"}>
              <HelpRow kbd={isJa ? "ドラッグ (中央)" : "Drag (center)"} label={isJa ? "図形を掴んで移動 (端子はクリックスルー)" : "Grab shape body to move (terminals pass through)"} />
              <HelpRow kbd={isJa ? "矢印キー" : "Arrow keys"} label={isJa ? "0.5mm 単位で微調整" : "Nudge selection by 0.5mm"} />
              <HelpRow kbd={isJa ? "Shift+矢印" : "Shift+Arrow"} label={isJa ? "5mm 単位で大きく移動" : "Move by 5mm (larger step)"} />
              <HelpRow kbd={isJa ? "Shift+ドラッグ" : "Shift+drag"} label={isJa ? "スマートスナップを一時無効化" : "Disable smart snap temporarily"} />
              <HelpRow kbd="⌘D" label={isJa ? "選択を複製" : "Duplicate selection"} />
              <HelpRow kbd="⌘A" label={isJa ? "全図形を選択" : "Select all shapes"} />
              <HelpRow kbd="Del" label={isJa ? "選択を削除" : "Delete selected shapes"} />
              <HelpRow kbd="⌘Z / ⇧⌘Z" label={isJa ? "元に戻す / やり直し" : "Undo / Redo"} />
            </HelpSection>

            {/* Section: View */}
            <HelpSection title={isJa ? "表示" : "View"}>
              <HelpRow kbd={isJa ? "Space+ドラッグ" : "Space+drag"} label={isJa ? "キャンバスを移動 (パン)" : "Pan around the canvas"} />
              <HelpRow kbd={isJa ? "スクロール" : "Scroll"} label={isJa ? "縦・横にパン (トラックパッド対応)" : "Pan vertically/horizontally (trackpad-friendly)"} />
              <HelpRow kbd={isJa ? "⌘+スクロール" : "⌘+scroll"} label={isJa ? "カーソル位置を中心にズーム" : "Zoom in/out toward cursor"} />
              <HelpRow kbd="⌘+ / ⌘−" label={isJa ? "中央でズーム" : "Zoom in/out from center"} />
              <HelpRow kbd="⌘0" label={isJa ? "ズームを100%に戻す" : "Reset zoom to 100%"} />
            </HelpSection>

            {/* Section: Power features */}
            <HelpSection title={isJa ? "パワー機能" : "Power Features"}>
              <HelpRow kbd="⌘K" label={isJa ? "コマンドパレット (全機能を検索)" : "Command palette — search any action"} />
              <HelpRow kbd={isJa ? "レイヤーアイコン" : "Layers icon"} label={isJa ? "全図形を一覧 / 表示・ロック・順序操作" : "List all shapes / toggle visibility, lock, z-order"} />
              <HelpRow kbd={isJa ? "図形を選択" : "Select a shape"} label={isJa ? "上にクイックアクションバーが出現" : "Floating action bar appears above selection"} />
            </HelpSection>

            <div className="mt-2 pt-2 border-t border-foreground/[0.06] text-[9.5px] text-foreground/40 leading-relaxed">
              {isJa
                ? "💡 キャンバス内では右クリック・ブラウザズーム・スワイプナビは無効化され、誤って画面が切り替わるのを防いでいます。"
                : "💡 Right-click, browser-zoom, and swipe-navigation are disabled inside the canvas to prevent accidental window changes."}
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
           TOOL HINT (top-center) — shows when a drawing tool is active
        ══════════════════════════════════════════════════════════════ */}
      {toolHint && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-teal-600 text-white text-[11px] font-semibold px-3.5 py-1.5 rounded-full shadow-lg shadow-teal-600/30 animate-scale-in pointer-events-none">
          <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
          <span>{toolHint}</span>
          <kbd className="ml-1 px-1.5 py-0.5 rounded bg-white/20 text-[9px] font-mono">Esc</kbd>
        </div>
      )}
    </div>
  );
}

// ── Small helper component ──
function HelpRow({ kbd, label }: { kbd: string; label: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-0.5">
      <span className="text-foreground/75 flex-1 leading-snug text-[10.5px]">{label}</span>
      <span className="shrink-0 font-mono text-[9px] bg-foreground/[0.06] px-1.5 py-0.5 rounded text-foreground/65 whitespace-nowrap">
        {kbd}
      </span>
    </div>
  );
}

function HelpSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="text-[9px] font-bold uppercase tracking-wider text-blue-500/70 mb-1">{title}</div>
      <div className="space-y-px">{children}</div>
    </div>
  );
}
