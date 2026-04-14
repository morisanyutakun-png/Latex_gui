"use client";

/**
 * Figure Editor store — manages all drawing state via Zustand.
 */

import { create } from "zustand";
import type {
  FigureShape,
  Connection,
  ToolMode,
  CanvasViewport,
  ShapeStyle,
  Point,
  ShapeKind,
  DomainCategory,
} from "./types";
import { DEFAULT_STYLE, defaultLabelPos } from "./types";
import { getPaletteItem } from "./domain-palettes";

let _nextId = 1;
function uid(): string {
  return `s${Date.now().toString(36)}_${(_nextId++).toString(36)}`;
}

// ── Undo / redo snapshot ────────────────────────────────────────

interface Snapshot {
  shapes: FigureShape[];
  connections: Connection[];
}

// ── Store interface ─────────────────────────────────────────────

interface FigureEditorState {
  // Canvas
  shapes: FigureShape[];
  connections: Connection[];
  canvasWidth: number;
  canvasHeight: number;
  gridSize: number;
  snapToGrid: boolean;
  showGrid: boolean;

  // Selection
  selectedIds: string[];
  hoveredId: string | null;

  // Tool
  activeTool: ToolMode;
  activeCategory: DomainCategory;

  // Viewport
  viewport: CanvasViewport;

  // Default style for new shapes
  defaultStyle: ShapeStyle;

  // Undo / redo
  past: Snapshot[];
  future: Snapshot[];

  // ── Actions ──

  // Shape CRUD
  addShape: (shape: FigureShape) => void;
  addShapeFromPalette: (kind: ShapeKind, x: number, y: number) => string;
  updateShape: (id: string, updates: Partial<FigureShape>) => void;
  deleteSelected: () => void;
  deleteShape: (id: string) => void;
  duplicateSelected: () => void;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;

  // Selection
  select: (id: string, additive?: boolean) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setHovered: (id: string | null) => void;

  // Tool
  setActiveTool: (tool: ToolMode) => void;
  setActiveCategory: (cat: DomainCategory) => void;

  // Style
  setDefaultStyle: (updates: Partial<ShapeStyle>) => void;
  applyStyleToSelected: (updates: Partial<ShapeStyle>) => void;

  // Canvas
  setCanvasSize: (w: number, h: number) => void;
  setGridSize: (s: number) => void;
  toggleSnapToGrid: () => void;
  toggleShowGrid: () => void;

  // Viewport
  setViewport: (v: Partial<CanvasViewport>) => void;
  resetViewport: () => void;

  // Connections
  addConnection: (conn: Connection) => void;
  removeConnection: (id: string) => void;

  // Undo / redo
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;

  // Reset
  reset: () => void;
}

function snap(val: number, grid: number, enabled: boolean): number {
  if (!enabled || grid <= 0) return val;
  return Math.round(val / grid) * grid;
}

function makeSnapshot(s: Pick<FigureEditorState, "shapes" | "connections">): Snapshot {
  return {
    shapes: s.shapes.map((sh) => ({
      ...sh,
      style: { ...sh.style },
      tikzOptions: { ...sh.tikzOptions },
      points: sh.points.map((p) => ({ ...p })),
      labelOffset: { ...sh.labelOffset },
    })),
    connections: s.connections.map((c) => ({ ...c, style: { ...c.style }, waypoints: c.waypoints.map((p) => ({ ...p })) })),
  };
}

export const useFigureStore = create<FigureEditorState>((set, get) => ({
  shapes: [],
  connections: [],
  canvasWidth: 14,
  canvasHeight: 10,
  gridSize: 0.5,
  snapToGrid: true,
  showGrid: true,

  selectedIds: [],
  hoveredId: null,

  activeTool: "select",
  activeCategory: "basic",

  viewport: { offsetX: 0, offsetY: 0, zoom: 1 },

  defaultStyle: { ...DEFAULT_STYLE },

  past: [],
  future: [],

  // ── Shape CRUD ────────────────────────────────────────────────

  addShape: (shape) => {
    const s = get();
    set({
      shapes: [...s.shapes, shape],
      past: [...s.past, makeSnapshot(s)].slice(-50),
      future: [],
    });
  },

  addShapeFromPalette: (kind, x, y) => {
    const s = get();
    const palette = getPaletteItem(kind);
    const gx = snap(x, s.gridSize, s.snapToGrid);
    const gy = snap(y, s.gridSize, s.snapToGrid);
    const id = uid();

    const baseStyle: ShapeStyle = { ...s.defaultStyle, ...(palette?.defaultStyle ?? {}) };
    const shape: FigureShape = {
      id,
      kind,
      x: gx,
      y: gy,
      width: palette?.defaultWidth ?? 2,
      height: palette?.defaultHeight ?? 1,
      rotation: 0,
      points: palette?.defaultPoints?.map((p) => ({ ...p })) ?? [],
      label: "",
      labelPos: defaultLabelPos(kind),
      labelOffset: { x: 0, y: 0 },
      labelMathMode: false,
      style: baseStyle,
      tikzOptions: { ...(palette?.defaultTikzOptions ?? {}) },
      locked: false,
      zIndex: s.shapes.length,
    };

    set({
      shapes: [...s.shapes, shape],
      selectedIds: [id],
      activeTool: "select",
      past: [...s.past, makeSnapshot(s)].slice(-50),
      future: [],
    });
    return id;
  },

  updateShape: (id, updates) => {
    set((s) => ({
      shapes: s.shapes.map((sh) =>
        sh.id === id ? { ...sh, ...updates, style: updates.style ? { ...sh.style, ...updates.style } : sh.style } : sh
      ),
    }));
  },

  deleteSelected: () => {
    const s = get();
    if (s.selectedIds.length === 0) return;
    const ids = new Set(s.selectedIds);
    set({
      shapes: s.shapes.filter((sh) => !ids.has(sh.id)),
      connections: s.connections.filter((c) => !ids.has(c.fromShapeId) && !ids.has(c.toShapeId)),
      selectedIds: [],
      past: [...s.past, makeSnapshot(s)].slice(-50),
      future: [],
    });
  },

  deleteShape: (id) => {
    const s = get();
    set({
      shapes: s.shapes.filter((sh) => sh.id !== id),
      connections: s.connections.filter((c) => c.fromShapeId !== id && c.toShapeId !== id),
      selectedIds: s.selectedIds.filter((sid) => sid !== id),
      past: [...s.past, makeSnapshot(s)].slice(-50),
      future: [],
    });
  },

  duplicateSelected: () => {
    const s = get();
    if (s.selectedIds.length === 0) return;
    const ids = new Set(s.selectedIds);
    const clones: FigureShape[] = [];
    const newIds: string[] = [];
    for (const sh of s.shapes) {
      if (!ids.has(sh.id)) continue;
      const id = uid();
      newIds.push(id);
      clones.push({
        ...sh,
        id,
        x: sh.x + 0.5,
        y: sh.y - 0.5,
        style: { ...sh.style },
        tikzOptions: { ...sh.tikzOptions },
        points: sh.points.map((p) => ({ ...p })),
        labelOffset: { ...sh.labelOffset },
        zIndex: s.shapes.length + clones.length,
      });
    }
    set({
      shapes: [...s.shapes, ...clones],
      selectedIds: newIds,
      past: [...s.past, makeSnapshot(s)].slice(-50),
      future: [],
    });
  },

  bringForward: (id) => {
    set((s) => {
      const idx = s.shapes.findIndex((sh) => sh.id === id);
      if (idx < 0 || idx >= s.shapes.length - 1) return s;
      const arr = [...s.shapes];
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      return { shapes: arr.map((sh, i) => ({ ...sh, zIndex: i })) };
    });
  },

  sendBackward: (id) => {
    set((s) => {
      const idx = s.shapes.findIndex((sh) => sh.id === id);
      if (idx <= 0) return s;
      const arr = [...s.shapes];
      [arr[idx], arr[idx - 1]] = [arr[idx - 1], arr[idx]];
      return { shapes: arr.map((sh, i) => ({ ...sh, zIndex: i })) };
    });
  },

  // ── Selection ─────────────────────────────────────────────────

  select: (id, additive) => {
    set((s) => ({
      selectedIds: additive
        ? s.selectedIds.includes(id)
          ? s.selectedIds.filter((i) => i !== id)
          : [...s.selectedIds, id]
        : [id],
    }));
  },

  selectAll: () => set((s) => ({ selectedIds: s.shapes.map((sh) => sh.id) })),
  clearSelection: () => set({ selectedIds: [] }),
  setHovered: (id) => set({ hoveredId: id }),

  // ── Tool ──────────────────────────────────────────────────────

  setActiveTool: (tool) => set({ activeTool: tool }),
  setActiveCategory: (cat) => set({ activeCategory: cat }),

  // ── Style ─────────────────────────────────────────────────────

  setDefaultStyle: (updates) =>
    set((s) => ({ defaultStyle: { ...s.defaultStyle, ...updates } })),

  applyStyleToSelected: (updates) => {
    const s = get();
    if (s.selectedIds.length === 0) return;
    const ids = new Set(s.selectedIds);
    set({
      shapes: s.shapes.map((sh) =>
        ids.has(sh.id) ? { ...sh, style: { ...sh.style, ...updates } } : sh
      ),
      past: [...s.past, makeSnapshot(s)].slice(-50),
      future: [],
    });
  },

  // ── Canvas ────────────────────────────────────────────────────

  setCanvasSize: (w, h) => set({ canvasWidth: w, canvasHeight: h }),
  setGridSize: (s) => set({ gridSize: s }),
  toggleSnapToGrid: () => set((s) => ({ snapToGrid: !s.snapToGrid })),
  toggleShowGrid: () => set((s) => ({ showGrid: !s.showGrid })),

  // ── Viewport ──────────────────────────────────────────────────

  setViewport: (v) => set((s) => ({ viewport: { ...s.viewport, ...v } })),
  resetViewport: () => set({ viewport: { offsetX: 0, offsetY: 0, zoom: 1 } }),

  // ── Connections ───────────────────────────────────────────────

  addConnection: (conn) =>
    set((s) => ({ connections: [...s.connections, conn] })),
  removeConnection: (id) =>
    set((s) => ({ connections: s.connections.filter((c) => c.id !== id) })),

  // ── Undo / redo ───────────────────────────────────────────────

  pushHistory: () => {
    set((s) => ({
      past: [...s.past, makeSnapshot(s)].slice(-50),
      future: [],
    }));
  },

  undo: () => {
    const s = get();
    if (s.past.length === 0) return;
    const prev = s.past[s.past.length - 1];
    set({
      past: s.past.slice(0, -1),
      future: [makeSnapshot(s), ...s.future].slice(0, 50),
      shapes: prev.shapes,
      connections: prev.connections,
      selectedIds: [],
    });
  },

  redo: () => {
    const s = get();
    if (s.future.length === 0) return;
    const next = s.future[0];
    set({
      future: s.future.slice(1),
      past: [...s.past, makeSnapshot(s)].slice(-50),
      shapes: next.shapes,
      connections: next.connections,
      selectedIds: [],
    });
  },

  // ── Reset ─────────────────────────────────────────────────────

  reset: () =>
    set({
      shapes: [],
      connections: [],
      selectedIds: [],
      hoveredId: null,
      activeTool: "select",
      activeCategory: "basic",
      viewport: { offsetX: 0, offsetY: 0, zoom: 1 },
      past: [],
      future: [],
    }),
}));
