"use client";

/**
 * FigureCanvas — SVG-based drawing canvas.
 *
 * Interaction philosophy (v2 — ergonomic redesign):
 *   - Click to place shapes at default size → resize afterwards with handles
 *   - No scroll zoom (disorienting). Zoom only via Ctrl+scroll (discrete steps)
 *   - Space+drag = pan. Pan tool removed from toolbar
 *   - Ruler along edges shows cm scale
 *   - Coordinate readout at cursor position
 *   - Snap guide lines during drag
 *
 * Coordinate convention:
 *   TikZ: x-right, y-up (cm).  Screen: x-right, y-down (px).
 *   Scale: 1 cm = PX_PER_CM * zoom px.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useFigureStore } from "./figure-store";
import { ShapeRenderer, ArrowDefs } from "./shape-renderers";
import type { Point, FigureShape, ShapeKind } from "./types";
import { getPaletteItem } from "./domain-palettes";

const PX_PER_CM = 50; // bigger default for clarity

// ── Coordinate helpers ──────────────────────────────────────────

function tikzToCanvas(x: number, y: number, canvasH: number, zoom: number, ox: number, oy: number): [number, number] {
  return [
    x * PX_PER_CM * zoom + ox,
    (canvasH - y) * PX_PER_CM * zoom + oy,
  ];
}

function canvasToTikz(px: number, py: number, canvasH: number, zoom: number, ox: number, oy: number): [number, number] {
  return [
    (px - ox) / (PX_PER_CM * zoom),
    canvasH - (py - oy) / (PX_PER_CM * zoom),
  ];
}

function snapVal(v: number, grid: number, enabled: boolean): number {
  if (!enabled || grid <= 0) return v;
  return Math.round(v / grid) * grid;
}

// ── Discrete zoom levels ────────────────────────────────────────

const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3];

function nextZoom(current: number, direction: 1 | -1): number {
  const idx = ZOOM_STEPS.findIndex((z) => z >= current - 0.01);
  const next = idx + direction;
  if (next < 0) return ZOOM_STEPS[0];
  if (next >= ZOOM_STEPS.length) return ZOOM_STEPS[ZOOM_STEPS.length - 1];
  return ZOOM_STEPS[next];
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

  // ── Space key state (hold space to pan) ─────────────────────

  const [spaceHeld, setSpaceHeld] = useState(false);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceHeld(false);
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, []);

  // ── Drag state ──────────────────────────────────────────────

  const [dragging, setDragging] = useState<{
    mode: "move" | "resize" | "pan" | "draw-freehand";
    startPx: Point;
    startTikz: Point;
    shapeId?: string;
    resizeDir?: ResizeDir;
    origShape?: FigureShape;
    drawPoints?: Point[];
  } | null>(null);

  // Freehand preview
  const [freehandPreview, setFreehandPreview] = useState<{ x: number; y: number; points: Point[] } | null>(null);

  // Mouse position readout (TikZ coords)
  const [mousePos, setMousePos] = useState<Point | null>(null);

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
      const isMajor = (x * gridSize) % 1 === 0;
      lines.push(
        <line key={`gv${x}`} x1={px} y1={offsetY} x2={px} y2={ch + offsetY}
          stroke={isMajor ? "rgba(0,0,0,0.1)" : "rgba(0,0,0,0.04)"}
          strokeWidth={isMajor ? 0.7 : 0.3} />
      );
    }
    for (let y = 0; y <= canvasHeight / gridSize; y++) {
      const py = y * step + offsetY;
      const isMajor = (y * gridSize) % 1 === 0;
      lines.push(
        <line key={`gh${y}`} x1={offsetX} y1={py} x2={cw + offsetX} y2={py}
          stroke={isMajor ? "rgba(0,0,0,0.1)" : "rgba(0,0,0,0.04)"}
          strokeWidth={isMajor ? 0.7 : 0.3} />
      );
    }
    return <g className="grid-lines">{lines}</g>;
  }, [showGrid, gridSize, scale, canvasWidth, canvasHeight, offsetX, offsetY]);

  // ── Rulers ────────────────────────────────────────────────────

  const RULER_SIZE = 22;

  const renderRulers = useCallback(() => {
    const ticks: React.ReactNode[] = [];
    // Horizontal ruler
    for (let cm = 0; cm <= canvasWidth; cm++) {
      const px = cm * scale + offsetX;
      if (px < RULER_SIZE || px > containerSize.w) continue;
      ticks.push(
        <g key={`rh${cm}`}>
          <line x1={px} y1={0} x2={px} y2={cm % 5 === 0 ? RULER_SIZE : RULER_SIZE * 0.5}
            stroke="rgba(0,0,0,0.25)" strokeWidth={0.5} />
          {cm % 2 === 0 && (
            <text x={px + 2} y={RULER_SIZE - 4} fontSize="8" fill="rgba(0,0,0,0.35)" fontFamily="monospace">{cm}</text>
          )}
        </g>
      );
    }
    // Vertical ruler
    for (let cm = 0; cm <= canvasHeight; cm++) {
      const py = cm * scale + offsetY;
      if (py < RULER_SIZE || py > containerSize.h) continue;
      ticks.push(
        <g key={`rv${cm}`}>
          <line x1={0} y1={py} x2={cm % 5 === 0 ? RULER_SIZE : RULER_SIZE * 0.5} y2={py}
            stroke="rgba(0,0,0,0.25)" strokeWidth={0.5} />
          {cm % 2 === 0 && (
            <text x={3} y={py - 2} fontSize="8" fill="rgba(0,0,0,0.35)" fontFamily="monospace">{canvasHeight - cm}</text>
          )}
        </g>
      );
    }
    return (
      <g className="rulers">
        {/* Ruler backgrounds */}
        <rect x={0} y={0} width={containerSize.w} height={RULER_SIZE}
          fill="rgba(245,244,240,0.95)" className="dark:fill-neutral-800/95" />
        <rect x={0} y={0} width={RULER_SIZE} height={containerSize.h}
          fill="rgba(245,244,240,0.95)" className="dark:fill-neutral-800/95" />
        <rect x={0} y={0} width={RULER_SIZE} height={RULER_SIZE}
          fill="rgba(240,240,236,1)" className="dark:fill-neutral-700" />
        <text x={RULER_SIZE / 2} y={RULER_SIZE / 2 + 3} fontSize="7" fill="rgba(0,0,0,0.3)"
          textAnchor="middle" fontFamily="monospace">cm</text>
        {ticks}
        {/* Ruler border lines */}
        <line x1={RULER_SIZE} y1={0} x2={RULER_SIZE} y2={containerSize.h}
          stroke="rgba(0,0,0,0.08)" strokeWidth={0.5} />
        <line x1={0} y1={RULER_SIZE} x2={containerSize.w} y2={RULER_SIZE}
          stroke="rgba(0,0,0,0.08)" strokeWidth={0.5} />
      </g>
    );
  }, [scale, offsetX, offsetY, canvasWidth, canvasHeight, containerSize]);

  // ── Snap alignment guides ─────────────────────────────────────

  const renderSnapGuides = useCallback(() => {
    if (selectedIds.length !== 1 || !dragging || dragging.mode !== "move") return null;
    const movingShape = shapes.find((s) => s.id === selectedIds[0]);
    if (!movingShape) return null;

    const guides: React.ReactNode[] = [];
    const mcx = movingShape.x + movingShape.width / 2;
    const mcy = movingShape.y + movingShape.height / 2;
    const threshold = 0.15; // cm

    for (const other of shapes) {
      if (other.id === movingShape.id) continue;
      const ocx = other.x + other.width / 2;
      const ocy = other.y + other.height / 2;

      // Vertical center alignment
      if (Math.abs(mcx - ocx) < threshold) {
        const [px] = tikzToCanvas(ocx, 0, canvasHeight, zoom, offsetX, offsetY);
        guides.push(
          <line key={`vg-${other.id}`} x1={px} y1={offsetY} x2={px} y2={canvasHeight * scale + offsetY}
            stroke="#3b82f6" strokeWidth={0.6} strokeDasharray="3,3" opacity={0.6} />
        );
      }
      // Horizontal center alignment
      if (Math.abs(mcy - ocy) < threshold) {
        const [, py] = tikzToCanvas(0, ocy, canvasHeight, zoom, offsetX, offsetY);
        guides.push(
          <line key={`hg-${other.id}`} x1={offsetX} y1={py} x2={canvasWidth * scale + offsetX} y2={py}
            stroke="#3b82f6" strokeWidth={0.6} strokeDasharray="3,3" opacity={0.6} />
        );
      }
    }
    return guides.length > 0 ? <g className="snap-guides">{guides}</g> : null;
  }, [selectedIds, dragging, shapes, canvasHeight, canvasWidth, zoom, offsetX, offsetY, scale]);

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

  // ── SVG coords helper ────────────────────────────────────────

  const getSvgCoords = useCallback((e: React.MouseEvent): Point => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  // ── Mouse handlers ────────────────────────────────────────────

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    // Middle click or Space+click → pan
    if (e.button === 1 || (e.button === 0 && spaceHeld)) {
      const px = getSvgCoords(e);
      setDragging({ mode: "pan", startPx: px, startTikz: { x: offsetX, y: offsetY } });
      return;
    }
    if (e.button !== 0) return;

    const px = getSvgCoords(e);
    const [tx, ty] = canvasToTikz(px.x, px.y, canvasHeight, zoom, offsetX, offsetY);

    // Pan mode tool
    if (activeTool === "pan") {
      setDragging({ mode: "pan", startPx: px, startTikz: { x: offsetX, y: offsetY } });
      return;
    }

    // Freehand — needs drag
    if (activeTool === "freehand") {
      const snappedX = snapVal(tx, gridSize, snapToGrid);
      const snappedY = snapVal(ty, gridSize, snapToGrid);
      setDragging({
        mode: "draw-freehand",
        startPx: px,
        startTikz: { x: snappedX, y: snappedY },
        drawPoints: [{ x: 0, y: 0 }],
      });
      setFreehandPreview({ x: snappedX, y: snappedY, points: [{ x: 0, y: 0 }] });
      return;
    }

    // All other tools → click to place at default size
    if (activeTool !== "select") {
      const snappedX = snapVal(tx, gridSize, snapToGrid);
      const snappedY = snapVal(ty, gridSize, snapToGrid);
      const palette = getPaletteItem(activeTool);
      const halfW = (palette?.defaultWidth ?? 2) / 2;
      const halfH = (palette?.defaultHeight ?? 1) / 2;
      // Center the shape on click point
      addShapeFromPalette(activeTool as ShapeKind, snappedX - halfW, snappedY - halfH);
      return;
    }

    // Select tool — click on empty space deselects
    clearSelection();
  }, [activeTool, canvasHeight, zoom, offsetX, offsetY, gridSize, snapToGrid, getSvgCoords, clearSelection, addShapeFromPalette, spaceHeld]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    const px = getSvgCoords(e);
    const [tx, ty] = canvasToTikz(px.x, px.y, canvasHeight, zoom, offsetX, offsetY);
    setMousePos({ x: Math.round(tx * 100) / 100, y: Math.round(ty * 100) / 100 });

    if (!dragging) return;

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

    if (dragging.mode === "draw-freehand") {
      const dx = tx - dragging.startTikz.x;
      const dy = ty - dragging.startTikz.y;
      const newPoints = [...(dragging.drawPoints || []), { x: dx, y: dy }];
      dragging.drawPoints = newPoints;
      setFreehandPreview((prev) => prev ? { ...prev, points: newPoints } : null);
      return;
    }
  }, [dragging, getSvgCoords, canvasHeight, zoom, offsetX, offsetY, gridSize, snapToGrid, updateShape, setViewport]);

  const handleCanvasMouseUp = useCallback(() => {
    if (!dragging) return;

    if (dragging.mode === "draw-freehand" && freehandPreview && freehandPreview.points.length >= 3) {
      const id = addShapeFromPalette("freehand", freehandPreview.x, freehandPreview.y);
      updateShape(id, { points: freehandPreview.points });
    }

    setDragging(null);
    setFreehandPreview(null);
  }, [dragging, freehandPreview, addShapeFromPalette, updateShape]);

  // ── Shape mouse handlers ──────────────────────────────────────

  const handleShapeMouseDown = useCallback((e: React.MouseEvent, shapeId: string) => {
    e.stopPropagation();
    if (spaceHeld) {
      // Space+click on shape = pan, not select
      const px = getSvgCoords(e);
      setDragging({ mode: "pan", startPx: px, startTikz: { x: offsetX, y: offsetY } });
      return;
    }
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
  }, [activeTool, shapes, select, pushHistory, getSvgCoords, canvasHeight, zoom, offsetX, offsetY, spaceHeld]);

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

  // ── Wheel → Ctrl+scroll = zoom (discrete steps), plain scroll = pan ──

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      // Discrete zoom
      const dir = e.deltaY > 0 ? -1 : 1;
      const newZoom = nextZoom(zoom, dir as 1 | -1);
      if (newZoom !== zoom) {
        // Zoom toward cursor position
        const px = getSvgCoords(e);
        const ratio = newZoom / zoom;
        const newOx = px.x - (px.x - offsetX) * ratio;
        const newOy = px.y - (px.y - offsetY) * ratio;
        setViewport({ zoom: newZoom, offsetX: newOx, offsetY: newOy });
      }
    } else {
      // Plain scroll = pan
      setViewport({
        offsetX: offsetX - e.deltaX,
        offsetY: offsetY - e.deltaY,
      });
    }
  }, [zoom, offsetX, offsetY, getSvgCoords, setViewport]);

  // ── Keyboard shortcuts ────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;

      if (e.key === "Delete" || e.key === "Backspace") {
        useFigureStore.getState().deleteSelected();
      }
      if (e.key === "Escape") {
        clearSelection();
        setActiveTool("select");
        setFreehandPreview(null);
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
      // Quick tool shortcuts
      if (e.key === "v" || e.key === "V") setActiveTool("select");
      if (e.key === "r" || e.key === "R") setActiveTool("rect");
      if (e.key === "c" || e.key === "C") setActiveTool("circle");
      if (e.key === "l" || e.key === "L") setActiveTool("line");
      if (e.key === "t" || e.key === "T") setActiveTool("text");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [clearSelection, setActiveTool]);

  // ── Cursor style ──────────────────────────────────────────────

  let cursorClass = "cursor-default";
  if (spaceHeld || activeTool === "pan") cursorClass = dragging?.mode === "pan" ? "cursor-grabbing" : "cursor-grab";
  else if (activeTool === "select") cursorClass = "cursor-default";
  else if (activeTool === "freehand") cursorClass = "cursor-crosshair";
  else cursorClass = "cursor-cell"; // click-to-place

  // ── Render ────────────────────────────────────────────────────

  const svgW = containerSize.w;
  const svgH = containerSize.h;
  const selectedSet = new Set(selectedIds);
  const sortedShapes = [...shapes].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div ref={containerRef} className={`relative flex-1 overflow-hidden bg-white dark:bg-neutral-900 ${cursorClass}`}>

      <svg
        ref={svgRef}
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={() => { handleCanvasMouseUp(); setMousePos(null); }}
        onWheel={handleWheel}
        className="select-none"
      >
        {/* Definitions */}
        <defs>
          {shapes.map((s) => (
            <ArrowDefs key={`defs-${s.id}`} shape={s} scale={scale} />
          ))}
        </defs>

        {/* Canvas background */}
        <rect x={offsetX} y={offsetY}
          width={canvasWidth * scale} height={canvasHeight * scale}
          fill="white" stroke="rgba(0,0,0,0.12)" strokeWidth={1} rx={2} className="dark:fill-neutral-800" />

        {/* Grid */}
        {gridLines()}

        {/* Snap alignment guides */}
        {renderSnapGuides()}

        {/* Shapes */}
        {sortedShapes.map((shape) => {
          const { cx, cy, pw, ph, pxPoints } = shapeToCanvasCoords(shape);
          return (
            <ShapeRenderer
              key={shape.id}
              shape={shape}
              scale={scale}
              cx={cx} cy={cy} pw={pw} ph={ph}
              pxPoints={pxPoints}
              selected={selectedSet.has(shape.id)}
              hovered={hoveredId === shape.id}
              onMouseDown={(e) => handleShapeMouseDown(e, shape.id)}
              onMouseEnter={() => setHovered(shape.id)}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}

        {/* Freehand preview */}
        {freehandPreview && freehandPreview.points.length >= 2 && (() => {
          const [px, py] = tikzToCanvas(freehandPreview.x, freehandPreview.y, canvasHeight, zoom, offsetX, offsetY);
          const d = freehandPreview.points.map((p, i) =>
            `${i === 0 ? "M" : "L"}${px + p.x * scale},${py + (-p.y) * scale}`
          ).join(" ");
          return <path d={d} stroke="#3b82f6" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
        })()}

        {/* Selection handles */}
        {selectedIds.map((id) => {
          const shape = shapes.find((s) => s.id === id);
          if (!shape) return null;
          const { cx, cy, pw, ph } = shapeToCanvasCoords(shape);
          const pad = 3;
          return (
            <g key={`handles-${id}`}>
              <rect x={cx - pad} y={cy - pad} width={pw + pad * 2} height={ph + pad * 2}
                fill="none" stroke="#3b82f6" strokeWidth={1} strokeDasharray="4,3" rx={2} />
              {/* Size label */}
              <text x={cx + pw / 2} y={cy - pad - 4} textAnchor="middle" fontSize="9" fill="#3b82f6"
                fontFamily="monospace" pointerEvents="none" opacity={0.7}>
                {shape.width.toFixed(1)} x {shape.height.toFixed(1)} cm
              </text>
              {RESIZE_HANDLES.map((h) => (
                <rect
                  key={h.dir}
                  x={cx + pw * h.dx - 4}
                  y={cy + ph * h.dy - 4}
                  width={8} height={8}
                  fill="white" stroke="#3b82f6" strokeWidth={1.5} rx={2}
                  style={{ cursor: h.cursor }}
                  onMouseDown={(e) => handleResizeMouseDown(e, id, h.dir)}
                />
              ))}
            </g>
          );
        })}

        {/* Rulers */}
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

      {/* Zoom level */}
      <div className="absolute bottom-3 right-3 bg-black/50 backdrop-blur-sm text-white text-[10px] font-mono px-2.5 py-1 rounded-md">
        {Math.round(zoom * 100)}%
      </div>

      {/* Active tool indicator */}
      {activeTool !== "select" && activeTool !== "pan" && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-[10px] font-semibold px-3 py-1 rounded-full shadow-lg shadow-blue-500/30 animate-scale-in">
          {activeTool === "freehand" ? "Drag to draw" : "Click to place"} — Esc to cancel
        </div>
      )}
    </div>
  );
}
