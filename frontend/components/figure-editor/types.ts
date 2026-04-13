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

export interface ShapeStyle {
  stroke: string;        // e.g. "black", "#dc2626"
  strokeWidth: number;   // in pt (TikZ "line width")
  fill: string;          // "none" or color
  fillOpacity: number;   // 0–1
  dashed: boolean;
  fontSizePt: number;    // for text/labels
  arrowStart: boolean;   // <- tip
  arrowEnd: boolean;     // -> tip
}

export const DEFAULT_STYLE: ShapeStyle = {
  stroke: "black",
  strokeWidth: 0.8,
  fill: "none",
  fillOpacity: 1,
  dashed: false,
  fontSizePt: 10,
  arrowStart: false,
  arrowEnd: false,
};

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
  /** Visual style */
  style: ShapeStyle;
  /** For domain-specific shapes: extra TikZ key-value pairs */
  tikzOptions: Record<string, string>;
  /** Whether this shape is locked (non-draggable) */
  locked: boolean;
  /** Z-index for layering */
  zIndex: number;
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
