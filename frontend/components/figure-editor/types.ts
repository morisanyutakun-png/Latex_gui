/**
 * Figure Editor — Type definitions for the SVG-based TikZ drawing editor.
 *
 * Coordinate system:
 *   Internal = TikZ cm (y-up). Canvas = screen px (y-down).
 *   Default scale: 1 cm = 40 px.
 */

// ── Basic geometry ──────────────────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

// ── Shape style ─────────────────────────────────────────────────

// ── IPE-style preset enums ──────────────────────────────────────

export type DashStyle = "solid" | "dashed" | "dotted" | "dash-dotted" | "dash-dot-dotted";

/** Arrow head style names (IPE-compatible). "none" = no arrow. */
export type ArrowHead =
  | "none"
  | "normal"      // filled triangle
  | "fnormal"     // outline triangle
  | "pointed"     // sharp barbed
  | "fpointed"    // outline barbed
  | "linear"      // open angle (no fill)
  | "double"      // two filled triangles
  | "fdouble";    // two outline triangles

export type OpacityPreset = 0.1 | 0.3 | 0.5 | 0.75 | 1;

export interface ShapeStyle {
  stroke: string;        // IPE color name or hex
  strokeWidth: number;   // in pt (TikZ "line width")
  fill: string;          // "none" or IPE color name or hex
  fillOpacity: number;   // 0–1
  dashStyle: DashStyle;  // IPE-style dash pattern
  fontSizePt: number;
  arrowStartHead: ArrowHead;
  arrowEndHead: ArrowHead;
  arrowSize: "tiny" | "small" | "normal" | "large";  // IPE arrowsize
  /** Stroke opacity (applies to stroke color independently of fill). */
  strokeOpacity: number;

  // ── Backward-compat fields (deprecated, mapped on read) ──
  /** @deprecated use dashStyle */
  dashed?: boolean;
  /** @deprecated use arrowStartHead */
  arrowStart?: boolean;
  /** @deprecated use arrowEndHead */
  arrowEnd?: boolean;
}

/** 9-way label anchor (compass points + center). */
export type LabelPosition =
  | "center"
  | "above" | "below" | "left" | "right"
  | "above-left" | "above-right" | "below-left" | "below-right";

export const LABEL_POSITIONS: LabelPosition[] = [
  "above-left", "above", "above-right",
  "left",       "center", "right",
  "below-left", "below",  "below-right",
];

export const DEFAULT_STYLE: ShapeStyle = {
  stroke: "black",
  strokeWidth: 0.8,
  fill: "none",
  fillOpacity: 1,
  strokeOpacity: 1,
  dashStyle: "solid",
  fontSizePt: 10,
  arrowStartHead: "none",
  arrowEndHead: "none",
  arrowSize: "normal",
};

// ══════════════════════════════════════════════════════════════════
//  IPE COLOR PALETTE — 25 named colors (matches TikZ xcolor names)
// ══════════════════════════════════════════════════════════════════

export interface IpeColor { name: string; rgb: string; nameJa?: string }

export const IPE_COLORS: IpeColor[] = [
  { name: "black",        rgb: "#000000", nameJa: "黒" },
  { name: "white",        rgb: "#ffffff", nameJa: "白" },
  { name: "darkgray",     rgb: "#a9a9a9", nameJa: "濃灰" },
  { name: "gray",         rgb: "#bebebe", nameJa: "灰" },
  { name: "lightgray",    rgb: "#d3d3d3", nameJa: "淡灰" },
  { name: "red",          rgb: "#ff0000", nameJa: "赤" },
  { name: "darkred",      rgb: "#8b0000", nameJa: "濃赤" },
  { name: "pink",         rgb: "#ffc0cb", nameJa: "ピンク" },
  { name: "orange",       rgb: "#ffa500", nameJa: "橙" },
  { name: "darkorange",   rgb: "#ff8c00", nameJa: "濃橙" },
  { name: "brown",        rgb: "#a52a2a", nameJa: "茶" },
  { name: "gold",         rgb: "#ffd700", nameJa: "金" },
  { name: "yellow",       rgb: "#ffff00", nameJa: "黄" },
  { name: "lightyellow",  rgb: "#ffffe0", nameJa: "淡黄" },
  { name: "green",        rgb: "#00ff00", nameJa: "緑" },
  { name: "darkgreen",    rgb: "#006400", nameJa: "濃緑" },
  { name: "lightgreen",   rgb: "#90ee90", nameJa: "淡緑" },
  { name: "seagreen",     rgb: "#2e8b57", nameJa: "海緑" },
  { name: "darkcyan",     rgb: "#008b8b", nameJa: "濃シアン" },
  { name: "turquoise",    rgb: "#40e0d0", nameJa: "ターコイズ" },
  { name: "lightblue",    rgb: "#add8e6", nameJa: "淡青" },
  { name: "lightcyan",    rgb: "#e0ffff", nameJa: "淡シアン" },
  { name: "blue",         rgb: "#0000ff", nameJa: "青" },
  { name: "darkblue",     rgb: "#00008b", nameJa: "濃青" },
  { name: "navy",         rgb: "#000080", nameJa: "ネイビー" },
  { name: "purple",       rgb: "#a020f0", nameJa: "紫" },
  { name: "violet",       rgb: "#ee82ee", nameJa: "バイオレット" },
  { name: "darkmagenta",  rgb: "#8b008b", nameJa: "濃マゼンタ" },
];

/** Look up color RGB by IPE name (case-sensitive). Returns the input if not found. */
export function colorRgb(name: string): string {
  const c = IPE_COLORS.find((x) => x.name === name);
  return c?.rgb ?? name;
}

// ══════════════════════════════════════════════════════════════════
//  IPE PRESET COLLECTIONS
// ══════════════════════════════════════════════════════════════════

/** Pen widths (IPE: heavier 0.8, fat 1.2, ultrafat 2.0) */
export const PEN_PRESETS: { name: string; nameJa: string; value: number }[] = [
  { name: "hair",     nameJa: "極細",     value: 0.4 },
  { name: "normal",   nameJa: "標準",     value: 0.6 },
  { name: "heavier",  nameJa: "やや太",   value: 0.8 },
  { name: "fat",      nameJa: "太",       value: 1.2 },
  { name: "ultrafat", nameJa: "極太",     value: 2.0 },
  { name: "heavy",    nameJa: "ヘビー",   value: 3.0 },
];

/** Dash patterns matching IPE styles. Dasharray is in px (relative to strokeWidth). */
export const DASH_PATTERNS: { style: DashStyle; label: string; labelJa: string; pattern: string }[] = [
  { style: "solid",            label: "Solid",         labelJa: "実線",     pattern: "" },
  { style: "dashed",           label: "Dashed",        labelJa: "破線",     pattern: "5,3" },
  { style: "dotted",           label: "Dotted",        labelJa: "点線",     pattern: "1,3" },
  { style: "dash-dotted",      label: "Dash-Dotted",   labelJa: "一点鎖線", pattern: "5,2,1,2" },
  { style: "dash-dot-dotted",  label: "Dash-Dot-Dot",  labelJa: "二点鎖線", pattern: "5,2,1,2,1,2" },
];

/** Arrow head sizes (IPE: tiny 3, small 5, large 10) */
export const ARROW_SIZES: { name: "tiny" | "small" | "normal" | "large"; label: string; px: number }[] = [
  { name: "tiny",   label: "S",  px: 4 },
  { name: "small",  label: "M",  px: 6 },
  { name: "normal", label: "L",  px: 8 },
  { name: "large",  label: "XL", px: 11 },
];

/** Opacity quick presets (IPE: 10%, 30%, 50%, 75%) */
export const OPACITY_PRESETS: { value: OpacityPreset; label: string }[] = [
  { value: 0.1,  label: "10%" },
  { value: 0.3,  label: "30%" },
  { value: 0.5,  label: "50%" },
  { value: 0.75, label: "75%" },
  { value: 1,    label: "100%" },
];

/** IPE angle snap presets */
export const ANGLE_SNAPS = [22.5, 30, 45, 60, 90];

/** IPE grid sizes (in pts, converted to cm by /28.346 since 1cm = 28.346pt) */
export const GRID_SIZES = [
  { label: "4 pts",     cm: 4 / 28.346 },
  { label: "8 pts (~3 mm)",  cm: 8 / 28.346 },
  { label: "10 pts (~3.5 mm)", cm: 10 / 28.346 },
  { label: "14 pts (~5 mm)",  cm: 14 / 28.346 },
  { label: "20 pts (~7 mm)",  cm: 20 / 28.346 },
  { label: "28 pts (~10 mm)", cm: 1 },
  { label: "56 pts (~20 mm)", cm: 2 },
];

// ── Shape types ─────────────────────────────────────────────────

export type BasicShapeKind =
  | "rect"
  | "circle"
  | "ellipse"
  | "line"
  | "arrow"
  | "polyline"
  | "polygon"
  | "text"
  | "freehand"
  | "arc";

export type DomainShapeKind =
  // Circuitikz components
  | "resistor" | "capacitor" | "inductor" | "voltage-source"
  | "current-source" | "ground" | "switch" | "led" | "diode"
  | "transistor-npn" | "transistor-pnp" | "opamp"
  // Mechanics
  | "spring" | "damper" | "mass" | "pulley"
  | "support-pin" | "support-roller" | "force-arrow" | "moment"
  | "wall" | "ground-hatch"
  // Physics
  | "vector-field" | "wave" | "lens-convex" | "lens-concave"
  | "mirror-concave" | "mirror-convex" | "prism"
  // Math
  | "axes" | "angle-arc" | "right-angle" | "function-plot"
  | "vector" | "brace"
  // CS / Information
  | "flowchart-process" | "flowchart-decision" | "flowchart-io"
  | "flowchart-terminal" | "automaton-state" | "automaton-accept"
  // Chemistry
  | "benzene" | "bond-single" | "bond-double" | "bond-triple"
  | "reaction-arrow" | "orbital-s" | "orbital-p"
  // Biology
  | "cell" | "nucleus" | "mitochondria" | "membrane"
  | "neuron" | "synapse";

export type ShapeKind = BasicShapeKind | DomainShapeKind;

// ── Shape model ─────────────────────────────────────────────────

export interface FigureShape {
  id: string;
  kind: ShapeKind;
  /** Position of the shape origin in TikZ coordinates (cm, y-up) */
  x: number;
  y: number;
  /** Dimensions — meaning varies by kind */
  width: number;
  height: number;
  /** Rotation in degrees (counter-clockwise) */
  rotation: number;
  /** For line/arrow/polyline: array of relative points from (x,y) */
  points: Point[];
  /** Text label (rendered inside or beside the shape) */
  label: string;
  /** Label anchor position relative to shape */
  labelPos: LabelPosition;
  /** Additional offset applied AFTER labelPos (cm) */
  labelOffset: Point;
  /** Wrap label in $...$ for LaTeX math rendering */
  labelMathMode: boolean;
  /** Visual style */
  style: ShapeStyle;
  /** For domain-specific shapes: extra TikZ key-value pairs */
  tikzOptions: Record<string, string>;
  /** Whether this shape is locked (non-draggable) */
  locked: boolean;
  /** Z-index for layering */
  zIndex: number;
}

/** Default label position per shape kind (ergonomic heuristics). */
export function defaultLabelPos(kind: ShapeKind): LabelPosition {
  // Circuit / mechanics / line-like: label goes above the midpoint
  const abovePos: string[] = [
    "line", "arrow", "force-arrow", "vector", "polyline",
    "bond-single", "bond-double", "bond-triple", "reaction-arrow",
    "resistor", "capacitor", "inductor", "voltage-source", "current-source",
    "switch", "diode", "led", "transistor-npn", "transistor-pnp", "opamp",
    "spring", "damper",
  ];
  if (abovePos.includes(kind)) return "above";
  // Text is already its own label (content centered)
  if (kind === "text") return "center";
  // Ground symbol: label to the right
  if (kind === "ground") return "right";
  // Most area shapes: center
  return "center";
}

// ── Tool state ──────────────────────────────────────────────────

export type ToolMode =
  | "select"
  | "pan"
  | ShapeKind;

// ── Domain category ─────────────────────────────────────────────

export type DomainCategory =
  | "basic"
  | "circuit"
  | "mechanics"
  | "physics"
  | "math"
  | "cs"
  | "chemistry"
  | "biology";

// ── Domain palette item ─────────────────────────────────────────

export interface DomainPaletteItem {
  kind: ShapeKind;
  label: string;
  labelJa: string;
  icon: string;       // SVG path or emoji
  category: DomainCategory;
  defaultWidth: number;
  defaultHeight: number;
  defaultStyle?: Partial<ShapeStyle>;
  defaultPoints?: Point[];
  defaultTikzOptions?: Record<string, string>;
  description?: string;
  descriptionJa?: string;
}

// ── Canvas state ────────────────────────────────────────────────

export interface CanvasViewport {
  offsetX: number;   // pan offset in px
  offsetY: number;
  zoom: number;      // 1 = 40px/cm
}

// ── Connection (for circuit wires etc.) ─────────────────────────

export interface Connection {
  id: string;
  fromShapeId: string;
  fromAnchor: string; // "n" | "s" | "e" | "w" | "center"
  toShapeId: string;
  toAnchor: string;
  style: ShapeStyle;
  waypoints: Point[];
}

// ── Figure document ─────────────────────────────────────────────

export interface FigureDocument {
  shapes: FigureShape[];
  connections: Connection[];
  canvasWidth: number;   // in cm
  canvasHeight: number;
  gridSize: number;      // in cm (e.g. 0.5)
  snapToGrid: boolean;
}
