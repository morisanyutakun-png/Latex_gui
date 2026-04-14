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

const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3];
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
    mode: "move" | "resize" | "pan" | "draw-line" | "draw-area" | "draw-freehand";
    startPx: Point;       // screen px at drag start
    startTikz: Point;     // TikZ coords at drag start
    endTikz?: Point;      // TikZ coords of current end (updated on move)
    shapeId?: string;
    resizeDir?: ResizeDir;
    origShape?: FigureShape;
    drawPoints?: Point[]; // freehand
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
    const step = gridSize * scale;
    for (let x = 0; x <= canvasWidth / gridSize; x++) {
      const px = x * step + offsetX;
      const major = (x * gridSize) % 1 === 0;
      lines.push(<line key={`gv${x}`} x1={px} y1={offsetY} x2={px} y2={canvasHeight * scale + offsetY}
        stroke={major ? "rgba(0,0,0,0.1)" : "rgba(0,0,0,0.04)"} strokeWidth={major ? 0.7 : 0.3} />);
    }
    for (let y = 0; y <= canvasHeight / gridSize; y++) {
      const py = y * step + offsetY;
      const major = (y * gridSize) % 1 === 0;
      lines.push(<line key={`gh${y}`} x1={offsetX} y1={py} x2={canvasWidth * scale + offsetX} y2={py}
        stroke={major ? "rgba(0,0,0,0.1)" : "rgba(0,0,0,0.04)"} strokeWidth={major ? 0.7 : 0.3} />);
    }
    return <g>{lines}</g>;
  }, [showGrid, gridSize, scale, canvasWidth, canvasHeight, offsetX, offsetY]);

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

    if (activeTool === "select") { clearSelection(); return; }

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
      addShapeFromPalette(activeTool as ShapeKind, sx - w / 2, sy - h / 2);
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
      // Second click → create shape from pendingStart to this click
      const s = pendingStart, end = { x: sx, y: sy };
      const dx = end.x - s.x, dy = end.y - s.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 0.1) {
        // Same spot twice → cancel
        setPendingStart(null); setPreviewEnd(null);
        return;
      }

      if (mode === "line") {
        const minX = Math.min(s.x, end.x), minY = Math.min(s.y, end.y);
        const w = Math.abs(dx), h = Math.abs(dy) || 0.3;
        const id = addShapeFromPalette(activeTool as ShapeKind, minX, minY);
        updateShape(id, {
          width: Math.max(w, 0.3), height: Math.max(h, 0.3),
          points: [{ x: s.x - minX, y: s.y - minY }, { x: end.x - minX, y: end.y - minY }],
        });
      } else {
        // area: two corners
        const minX = Math.min(s.x, end.x), minY = Math.min(s.y, end.y);
        const w = Math.abs(dx), h = Math.abs(dy);
        const id = addShapeFromPalette(activeTool as ShapeKind, minX, minY);
        updateShape(id, { width: Math.max(w, 0.2), height: Math.max(h, 0.2) });
      }

      setPendingStart(null);
      setPreviewEnd(null);
    }
  }, [activeTool, spaceHeld, shapes, canvasHeight, zoom, offsetX, offsetY, gridSize, snapToGrid, getSvgCoords, clearSelection, addShapeFromPalette, updateShape, select, pushHistory, pendingStart]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const px = getSvgCoords(e);
    const [tx, ty] = canvasToTikz(px.x, px.y, canvasHeight, zoom, offsetX, offsetY);
    setMousePos({ x: Math.round(tx * 100) / 100, y: Math.round(ty * 100) / 100 });

    // Update grab target — only when NOT actively dragging
    if (!dragging) {
      const target = findGrabTarget(shapes, { x: tx, y: ty });
      if (target !== grabTargetId) setGrabTargetId(target);
    }

    // 2-click preview (between clicks, no drag in progress)
    if (pendingStart) {
      const sx = snapV(tx, gridSize, snapToGrid), sy = snapV(ty, gridSize, snapToGrid);
      setPreviewEnd({ x: sx, y: sy });
    }

    if (!dragging) return;

    if (dragging.mode === "pan") {
      setViewport({ offsetX: dragging.startTikz.x + (px.x - dragging.startPx.x),
                     offsetY: dragging.startTikz.y + (px.y - dragging.startPx.y) });
      return;
    }

    const sx = snapV(tx, gridSize, snapToGrid), sy = snapV(ty, gridSize, snapToGrid);

    if (dragging.mode === "move" && dragging.shapeId && dragging.origShape) {
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

  // ── Wheel ─────────────────────────────────────────────────────

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const nz = nextZoom(zoom, e.deltaY > 0 ? -1 : 1);
      if (nz !== zoom) {
        const px = getSvgCoords(e);
        const r = nz / zoom;
        setViewport({ zoom: nz, offsetX: px.x - (px.x - offsetX) * r, offsetY: px.y - (px.y - offsetY) * r });
      }
    } else {
      setViewport({ offsetX: offsetX - e.deltaX, offsetY: offsetY - e.deltaY });
    }
  }, [zoom, offsetX, offsetY, getSvgCoords, setViewport]);

  // ── Keyboard ──────────────────────────────────────────────────

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName ?? "")) return;
      if (e.key === "Delete" || e.key === "Backspace") useFigureStore.getState().deleteSelected();
      if (e.key === "Escape") {
        if (pendingStart) { setPendingStart(null); setPreviewEnd(null); }
        else { clearSelection(); setActiveTool("select"); setDragging(null); }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z") { e.preventDefault(); e.shiftKey ? useFigureStore.getState().redo() : useFigureStore.getState().undo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "a") { e.preventDefault(); useFigureStore.getState().selectAll(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "d") { e.preventDefault(); useFigureStore.getState().duplicateSelected(); }
      if (e.key === "v" || e.key === "V") setActiveTool("select");
      if (e.key === "r" || e.key === "R") setActiveTool("rect");
      if (e.key === "c" || e.key === "C") setActiveTool("circle");
      if (e.key === "l" || e.key === "L") setActiveTool("line");
      if (e.key === "t" || e.key === "T") setActiveTool("text");
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
      return (<g>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#0d9488" strokeWidth={1.5} strokeDasharray="5,3" />
        {startMarker}
        {/* End preview (follows cursor) */}
        <circle cx={x2} cy={y2} r={5} fill="white" stroke="#0d9488" strokeWidth={2} />
        <circle cx={x2} cy={y2} r={2} fill="#0d9488" />
        {dist > 0.05 && <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 10} textAnchor="middle" fontSize="10"
          fill="#0d9488" fontFamily="monospace" fontWeight="600">{dist.toFixed(2)} cm</text>}
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
    if (mode === "line")      toolHint = pendingStart ? "Click END point" : "Click START point";
    else if (mode === "area") toolHint = pendingStart ? "Click OPPOSITE corner" : "Click FIRST corner";
    else if (mode === "freehand") toolHint = "Drag to draw";
    else toolHint = "Click to place";
  }

  // ══════════════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════════════

  const svgW = containerSize.w, svgH = containerSize.h;
  const selSet = new Set(selectedIds);
  const sorted = [...shapes].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div ref={containerRef} className={`relative flex-1 overflow-hidden bg-white dark:bg-neutral-900 ${cursor}`}>
      <svg ref={svgRef} width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp} onMouseLeave={() => { handleMouseUp(); setMousePos(null); }}
        onWheel={handleWheel} className="select-none">

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
              <circle cx={ox} cy={oy} r={8} fill="#ec4899" opacity={0.15} />
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

        {/* Grab target hover indicator */}
        {grabTargetId && !dragging && (() => {
          const sh = shapes.find((s) => s.id === grabTargetId);
          if (!sh) return null;
          const { cx, cy, pw, ph } = shapeToCanvasCoords(sh);
          return (<rect x={cx - 2} y={cy - 2} width={pw + 4} height={ph + 4} rx={3}
            fill="rgba(59,130,246,0.06)" stroke="rgba(59,130,246,0.5)" strokeWidth={1}
            strokeDasharray="3,3" pointerEvents="none" />);
        })()}

        {/* Draw preview */}
        {renderDrawPreview()}

        {/* Selection handles — only interactive in select mode */}
        {activeTool === "select" && selectedIds.map((id) => {
          const sh = shapes.find((s) => s.id === id); if (!sh) return null;
          const { cx, cy, pw, ph } = shapeToCanvasCoords(sh);
          return (<g key={`h-${id}`}>
            <rect x={cx - 3} y={cy - 3} width={pw + 6} height={ph + 6}
              fill="none" stroke="#3b82f6" strokeWidth={1} strokeDasharray="4,3" rx={2} pointerEvents="none" />
            <text x={cx + pw / 2} y={cy - 7} textAnchor="middle" fontSize="9" fill="#3b82f6"
              fontFamily="monospace" pointerEvents="none" opacity={0.7}>
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
            {RESIZE_HANDLES.map((h) => (
              <rect key={h.dir} x={cx + pw * h.dx - 4} y={cy + ph * h.dy - 4} width={8} height={8}
                fill="white" stroke="#3b82f6" strokeWidth={1.5} rx={2} style={{ cursor: h.cursor }}
                onMouseDown={(e) => handleResizeDown(e, id, h.dir)} />
            ))}
          </g>);
        })}

        {renderRulers()}
      </svg>

      {/* Coordinate readout */}
      {mousePos && (
        <div className="absolute bottom-3 left-3 flex items-center gap-3 bg-black/50 backdrop-blur-sm text-white text-[10px] font-mono px-2.5 py-1 rounded-md">
          <span>x: {mousePos.x.toFixed(1)}</span>
          <span>y: {mousePos.y.toFixed(1)}</span>
          <span className="text-white/50">cm</span>
        </div>
      )}

      <div className="absolute bottom-3 right-3 bg-black/50 backdrop-blur-sm text-white text-[10px] font-mono px-2.5 py-1 rounded-md">
        {Math.round(zoom * 100)}%
      </div>

      {/* Tool hint */}
      {toolHint && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-teal-600 text-white text-[10px] font-semibold px-3 py-1 rounded-full shadow-lg shadow-teal-600/30 animate-scale-in">
          {toolHint} — Esc to cancel
        </div>
      )}
    </div>
  );
}
