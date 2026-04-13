"use client";

/**
 * FigureCanvas — SVG-based drawing canvas with grid, pan, zoom, selection, drag, resize.
 *
 * Coordinate convention:
 *   TikZ: x-right, y-up (cm).
 *   Screen: x-right, y-down (px).
 *   Scale: 1 cm = PX_PER_CM * zoom px.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useFigureStore } from "./figure-store";
import { ShapeRenderer, ArrowDefs } from "./shape-renderers";
import type { Point, FigureShape, ShapeKind } from "./types";
import { DEFAULT_STYLE } from "./types";
import { getPaletteItem } from "./domain-palettes";

const PX_PER_CM = 40;

// ── Coordinate helpers ──────────────────────────────────────────

/** TikZ (cm, y-up) -> canvas px (y-down) */
function tikzToCanvas(x: number, y: number, canvasH: number, zoom: number, ox: number, oy: number): [number, number] {
  return [
    x * PX_PER_CM * zoom + ox,
    (canvasH - y) * PX_PER_CM * zoom + oy,
  ];
}

/** Canvas px -> TikZ */
function canvasToTikz(px: number, py: number, canvasH: number, zoom: number, ox: number, oy: number): [number, number] {
  return [
    (px - ox) / (PX_PER_CM * zoom),
    canvasH - (py - oy) / (PX_PER_CM * zoom),
  ];
}

// ── Snap ────────────────────────────────────────────────────────

function snapVal(v: number, grid: number, enabled: boolean): number {
  if (!enabled || grid <= 0) return v;
  return Math.round(v / grid) * grid;
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

export function FigureCanvas() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const shapes = useFigureStore((s) => s.shapes);
  const selectedIds = useFigureStore((s) => s.selectedIds);
  const hoveredId = useFigureStore((s) => s.hoveredId);
  const viewport = useFigureStore((s) => s.viewport);
  const activeTool = useFigureStore((s) => s.activeTool);
  const canvasWidth = useFigureStore((s) => s.canvasWidth);
  const canvasHeight = useFigureStore((s) => s.canvasHeight);
  const gridSize = useFigureStore((s) => s.gridSize);
  const snapToGrid = useFigureStore((s) => s.snapToGrid);
  const showGrid = useFigureStore((s) => s.showGrid);

  const select = useFigureStore((s) => s.select);
  const clearSelection = useFigureStore((s) => s.clearSelection);
  const setHovered = useFigureStore((s) => s.setHovered);
  const updateShape = useFigureStore((s) => s.updateShape);
  const addShapeFromPalette = useFigureStore((s) => s.addShapeFromPalette);
  const pushHistory = useFigureStore((s) => s.pushHistory);
  const setViewport = useFigureStore((s) => s.setViewport);
  const setActiveTool = useFigureStore((s) => s.setActiveTool);

  const { zoom, offsetX, offsetY } = viewport;
  const scale = PX_PER_CM * zoom;

  // ── Drag state ──────────────────────────────────────────────

  const [dragging, setDragging] = useState<{
    mode: "move" | "resize" | "pan" | "draw-line" | "draw-rect" | "draw-freehand";
    startPx: Point;
    startTikz: Point;
    shapeId?: string;
    resizeDir?: ResizeDir;
    origShape?: FigureShape;
    drawPoints?: Point[];
  } | null>(null);

  const [drawPreview, setDrawPreview] = useState<{ kind: ShapeKind; x: number; y: number; w: number; h: number; points: Point[] } | null>(null);

  // Container dimensions
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Grid rendering ────────────────────────────────────────────

  const gridLines = useCallback(() => {
    if (!showGrid) return null;
    const lines: React.ReactNode[] = [];
    const step = gridSize * scale;
    const cw = canvasWidth * scale;
    const ch = canvasHeight * scale;

    for (let x = 0; x <= canvasWidth / gridSize; x++) {
      const px = x * step + offsetX;
      const isMajor = x % (1 / gridSize) === 0;
      lines.push(
        <line key={`gv${x}`} x1={px} y1={offsetY} x2={px} y2={ch + offsetY}
          stroke={isMajor ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.05)"}
          strokeWidth={isMajor ? 0.8 : 0.4} />
      );
    }
    for (let y = 0; y <= canvasHeight / gridSize; y++) {
      const py = y * step + offsetY;
      const isMajor = y % (1 / gridSize) === 0;
      lines.push(
        <line key={`gh${y}`} x1={offsetX} y1={py} x2={cw + offsetX} y2={py}
          stroke={isMajor ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.05)"}
          strokeWidth={isMajor ? 0.8 : 0.4} />
      );
    }
    return <g className="grid-lines">{lines}</g>;
  }, [showGrid, gridSize, scale, canvasWidth, canvasHeight, offsetX, offsetY]);

  // ── Shape transform helpers ───────────────────────────────────

  function shapeToCanvasCoords(s: FigureShape) {
    const [cx, cy] = tikzToCanvas(s.x, s.y + s.height, canvasHeight, zoom, offsetX, offsetY);
    const pw = s.width * scale;
    const ph = s.height * scale;
    const pxPoints = s.points.map((p) => ({
      x: p.x * scale,
      y: -p.y * scale,
    }));
    return { cx, cy, pw, ph, pxPoints };
  }

  // ── Mouse handlers ────────────────────────────────────────────

  const getSvgCoords = useCallback((e: React.MouseEvent): Point => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    // Middle click → always pan
    if (e.button === 1) {
      const px = getSvgCoords(e);
      setDragging({ mode: "pan", startPx: px, startTikz: { x: offsetX, y: offsetY } });
      return;
    }
    if (e.button !== 0) return;
    const px = getSvgCoords(e);
    const [tx, ty] = canvasToTikz(px.x, px.y, canvasHeight, zoom, offsetX, offsetY);

    // Pan mode
    if (activeTool === "pan") {
      setDragging({ mode: "pan", startPx: px, startTikz: { x: offsetX, y: offsetY } });
      return;
    }

    // Drawing tools
    if (activeTool !== "select") {
      const snappedX = snapVal(tx, gridSize, snapToGrid);
      const snappedY = snapVal(ty, gridSize, snapToGrid);

      const isLineLike = ["line", "arrow", "force-arrow", "vector", "bond-single", "bond-double", "bond-triple", "reaction-arrow"].includes(activeTool);
      const isFreehand = activeTool === "freehand";

      if (isLineLike) {
        setDragging({
          mode: "draw-line",
          startPx: px,
          startTikz: { x: snappedX, y: snappedY },
          drawPoints: [{ x: snappedX, y: snappedY }],
        });
        setDrawPreview({ kind: activeTool as ShapeKind, x: snappedX, y: snappedY, w: 0, h: 0, points: [{ x: 0, y: 0 }] });
      } else if (isFreehand) {
        setDragging({
          mode: "draw-freehand",
          startPx: px,
          startTikz: { x: snappedX, y: snappedY },
          drawPoints: [{ x: 0, y: 0 }],
        });
        setDrawPreview({ kind: "freehand", x: snappedX, y: snappedY, w: 0, h: 0, points: [{ x: 0, y: 0 }] });
      } else {
        // Rect-like shapes (rect, circle, ellipse, all domain shapes)
        setDragging({
          mode: "draw-rect",
          startPx: px,
          startTikz: { x: snappedX, y: snappedY },
        });
        setDrawPreview({ kind: activeTool as ShapeKind, x: snappedX, y: snappedY, w: 0, h: 0, points: [] });
      }
      return;
    }

    // Select tool — click on empty space deselects
    clearSelection();
  }, [activeTool, canvasHeight, zoom, offsetX, offsetY, gridSize, snapToGrid, getSvgCoords, clearSelection]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    const px = getSvgCoords(e);
    const [tx, ty] = canvasToTikz(px.x, px.y, canvasHeight, zoom, offsetX, offsetY);

    if (dragging.mode === "pan") {
      const dx = px.x - dragging.startPx.x;
      const dy = px.y - dragging.startPx.y;
      setViewport({ offsetX: dragging.startTikz.x + dx, offsetY: dragging.startTikz.y + dy });
      return;
    }

    if (dragging.mode === "move" && dragging.shapeId && dragging.origShape) {
      const dtx = tx - dragging.startTikz.x;
      const dty = ty - dragging.startTikz.y;
      const newX = snapVal(dragging.origShape.x + dtx, gridSize, snapToGrid);
      const newY = snapVal(dragging.origShape.y + dty, gridSize, snapToGrid);
      updateShape(dragging.shapeId, { x: newX, y: newY });
      return;
    }

    if (dragging.mode === "resize" && dragging.shapeId && dragging.origShape && dragging.resizeDir) {
      const orig = dragging.origShape;
      const snappedTx = snapVal(tx, gridSize, snapToGrid);
      const snappedTy = snapVal(ty, gridSize, snapToGrid);
      let newX = orig.x, newY = orig.y, newW = orig.width, newH = orig.height;
      const dir = dragging.resizeDir;

      if (dir.includes("e")) { newW = Math.max(0.2, snappedTx - orig.x); }
      if (dir.includes("w")) { newW = Math.max(0.2, orig.x + orig.width - snappedTx); newX = snappedTx; }
      if (dir.includes("n")) { newH = Math.max(0.2, snappedTy - orig.y); }
      if (dir.includes("s")) { newH = Math.max(0.2, orig.y + orig.height - snappedTy); newY = snappedTy; }

      updateShape(dragging.shapeId, { x: newX, y: newY, width: newW, height: newH });
      return;
    }

    if (dragging.mode === "draw-rect") {
      const snappedTx = snapVal(tx, gridSize, snapToGrid);
      const snappedTy = snapVal(ty, gridSize, snapToGrid);
      const x1 = Math.min(dragging.startTikz.x, snappedTx);
      const y1 = Math.min(dragging.startTikz.y, snappedTy);
      const w = Math.abs(snappedTx - dragging.startTikz.x);
      const h = Math.abs(snappedTy - dragging.startTikz.y);
      setDrawPreview((prev) => prev ? { ...prev, x: x1, y: y1, w, h } : null);
      return;
    }

    if (dragging.mode === "draw-line") {
      const snappedTx = snapVal(tx, gridSize, snapToGrid);
      const snappedTy = snapVal(ty, gridSize, snapToGrid);
      const dx = snappedTx - dragging.startTikz.x;
      const dy = snappedTy - dragging.startTikz.y;
      setDrawPreview((prev) => prev ? { ...prev, w: Math.abs(dx), h: Math.abs(dy), points: [{ x: 0, y: 0 }, { x: dx, y: dy }] } : null);
      return;
    }

    if (dragging.mode === "draw-freehand") {
      const dx = tx - dragging.startTikz.x;
      const dy = ty - dragging.startTikz.y;
      const newPoints = [...(dragging.drawPoints || []), { x: dx, y: dy }];
      dragging.drawPoints = newPoints;
      setDrawPreview((prev) => prev ? { ...prev, points: newPoints } : null);
      return;
    }
  }, [dragging, getSvgCoords, canvasHeight, zoom, offsetX, offsetY, gridSize, snapToGrid, updateShape, setViewport]);

  const handleCanvasMouseUp = useCallback(() => {
    if (!dragging) return;

    if (dragging.mode === "move" || dragging.mode === "resize") {
      // Already committed via updateShape during drag
    }

    if (dragging.mode === "draw-rect" && drawPreview) {
      const w = drawPreview.w || getPaletteItem(drawPreview.kind)?.defaultWidth || 2;
      const h = drawPreview.h || getPaletteItem(drawPreview.kind)?.defaultHeight || 1;
      if (w > 0.1 || h > 0.1) {
        const palette = getPaletteItem(drawPreview.kind);
        addShapeFromPalette(drawPreview.kind, drawPreview.x, drawPreview.y);
        // Update width/height if user dragged a custom size
        if (drawPreview.w > 0.2 && drawPreview.h > 0.2) {
          const lastShape = useFigureStore.getState().shapes[useFigureStore.getState().shapes.length - 1];
          if (lastShape) updateShape(lastShape.id, { width: w, height: h });
        }
      }
    }

    if (dragging.mode === "draw-line" && drawPreview && drawPreview.points.length >= 2) {
      const p1 = drawPreview.points[0];
      const p2 = drawPreview.points[drawPreview.points.length - 1];
      const dx = Math.abs(p2.x - p1.x);
      const dy = Math.abs(p2.y - p1.y);
      if (dx > 0.1 || dy > 0.1) {
        const id = addShapeFromPalette(drawPreview.kind, drawPreview.x, drawPreview.y);
        updateShape(id, { points: drawPreview.points, width: dx, height: dy });
      }
    }

    if (dragging.mode === "draw-freehand" && drawPreview && drawPreview.points.length >= 2) {
      const id = addShapeFromPalette("freehand", drawPreview.x, drawPreview.y);
      updateShape(id, { points: drawPreview.points });
    }

    setDragging(null);
    setDrawPreview(null);
  }, [dragging, drawPreview, addShapeFromPalette, updateShape]);

  // ── Shape mouse handlers ──────────────────────────────────────

  const handleShapeMouseDown = useCallback((e: React.MouseEvent, shapeId: string) => {
    e.stopPropagation();
    if (activeTool !== "select") return;

    const shape = shapes.find((s) => s.id === shapeId);
    if (!shape || shape.locked) return;

    select(shapeId, e.shiftKey);
    pushHistory();

    const px = getSvgCoords(e);
    const [tx, ty] = canvasToTikz(px.x, px.y, canvasHeight, zoom, offsetX, offsetY);

    setDragging({
      mode: "move",
      startPx: px,
      startTikz: { x: tx, y: ty },
      shapeId,
      origShape: { ...shape, style: { ...shape.style }, points: shape.points.map((p) => ({ ...p })), tikzOptions: { ...shape.tikzOptions } },
    });
  }, [activeTool, shapes, select, pushHistory, getSvgCoords, canvasHeight, zoom, offsetX, offsetY]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, shapeId: string, dir: ResizeDir) => {
    e.stopPropagation();
    const shape = shapes.find((s) => s.id === shapeId);
    if (!shape) return;
    pushHistory();

    const px = getSvgCoords(e);
    const [tx, ty] = canvasToTikz(px.x, px.y, canvasHeight, zoom, offsetX, offsetY);

    setDragging({
      mode: "resize",
      startPx: px,
      startTikz: { x: tx, y: ty },
      shapeId,
      resizeDir: dir,
      origShape: { ...shape, style: { ...shape.style }, points: shape.points.map((p) => ({ ...p })), tikzOptions: { ...shape.tikzOptions } },
    });
  }, [shapes, pushHistory, getSvgCoords, canvasHeight, zoom, offsetX, offsetY]);

  // ── Wheel zoom ────────────────────────────────────────────────

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.2, Math.min(5, zoom * delta));
    setViewport({ zoom: newZoom });
  }, [zoom, setViewport]);

  // ── Keyboard shortcuts ────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
        useFigureStore.getState().deleteSelected();
      }
      if (e.key === "Escape") {
        clearSelection();
        setActiveTool("select");
        setDrawPreview(null);
        setDragging(null);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) useFigureStore.getState().redo();
        else useFigureStore.getState().undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault();
        useFigureStore.getState().selectAll();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "d") {
        e.preventDefault();
        useFigureStore.getState().duplicateSelected();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [clearSelection, setActiveTool]);

  // ── Render ────────────────────────────────────────────────────

  const svgW = containerSize.w;
  const svgH = containerSize.h;
  const selectedSet = new Set(selectedIds);

  // Sort shapes by z-index
  const sortedShapes = [...shapes].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div ref={containerRef} className="relative flex-1 overflow-hidden bg-white dark:bg-neutral-900"
      style={{ cursor: activeTool === "pan" ? "grab" : activeTool === "select" ? "default" : "crosshair" }}>

      <svg
        ref={svgRef}
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
        onWheel={handleWheel}
        className="select-none"
      >
        {/* Definitions (arrow markers etc.) */}
        <defs>
          {shapes.map((s) => (
            <ArrowDefs key={`defs-${s.id}`} shape={s} scale={scale} />
          ))}
        </defs>

        {/* Canvas background */}
        <rect x={offsetX} y={offsetY}
          width={canvasWidth * scale} height={canvasHeight * scale}
          fill="white" stroke="rgba(0,0,0,0.15)" strokeWidth={1} className="dark:fill-neutral-800" />

        {/* Grid */}
        {gridLines()}

        {/* Shapes */}
        {sortedShapes.map((shape) => {
          const { cx, cy, pw, ph, pxPoints } = shapeToCanvasCoords(shape);
          return (
            <ShapeRenderer
              key={shape.id}
              shape={shape}
              scale={scale}
              cx={cx}
              cy={cy}
              pw={pw}
              ph={ph}
              pxPoints={pxPoints}
              selected={selectedSet.has(shape.id)}
              hovered={hoveredId === shape.id}
              onMouseDown={(e) => handleShapeMouseDown(e, shape.id)}
              onMouseEnter={() => setHovered(shape.id)}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}

        {/* Draw preview */}
        {drawPreview && drawPreview.kind && (() => {
          const [px, py] = tikzToCanvas(drawPreview.x, drawPreview.y + drawPreview.h, canvasHeight, zoom, offsetX, offsetY);
          const pw = drawPreview.w * scale;
          const ph = drawPreview.h * scale;
          if (drawPreview.points.length >= 2) {
            const d = drawPreview.points.map((p, i) =>
              `${i === 0 ? "M" : "L"}${px + p.x * scale},${py + (-p.y) * scale}`
            ).join(" ");
            return <path d={d} stroke="#3b82f6" strokeWidth={1.5} fill="none" strokeDasharray="4,3" />;
          }
          if (pw > 1 || ph > 1) {
            return <rect x={px} y={py} width={pw} height={ph} stroke="#3b82f6" strokeWidth={1.5} fill="rgba(59,130,246,0.08)" strokeDasharray="4,3" rx={2} />;
          }
          return null;
        })()}

        {/* Selection handles */}
        {selectedIds.map((id) => {
          const shape = shapes.find((s) => s.id === id);
          if (!shape) return null;
          const { cx, cy, pw, ph } = shapeToCanvasCoords(shape);
          return (
            <g key={`handles-${id}`}>
              {/* Selection box */}
              <rect x={cx - 1} y={cy - 1} width={pw + 2} height={ph + 2}
                fill="none" stroke="#3b82f6" strokeWidth={1.2} strokeDasharray="4,3" rx={1} />
              {/* Resize handles */}
              {RESIZE_HANDLES.map((h) => (
                <rect
                  key={h.dir}
                  x={cx + pw * h.dx - 4}
                  y={cy + ph * h.dy - 4}
                  width={8}
                  height={8}
                  fill="white"
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                  rx={1.5}
                  style={{ cursor: h.cursor }}
                  onMouseDown={(e) => handleResizeMouseDown(e, id, h.dir)}
                />
              ))}
            </g>
          );
        })}
      </svg>

      {/* Zoom indicator */}
      <div className="absolute bottom-3 right-3 bg-black/60 text-white text-[10px] font-mono px-2 py-1 rounded-md">
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}
