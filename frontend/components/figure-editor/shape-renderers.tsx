"use client";

/**
 * SVG renderers for each shape kind (v2 — proper proportions).
 *
 * IMPORTANT: `scale` (px per cm) is used ONLY for position/dimension transforms.
 * Line widths and font sizes use FIXED pixel values that don't blow up with zoom.
 */

import React from "react";
import type { FigureShape, Point, ArrowHead, DashStyle } from "./types";
import { DASH_PATTERNS, ARROW_SIZES, colorRgb } from "./types";
import { renderInlineMathOrPlaceholder } from "@/lib/katex-render";

// ── Backward-compat helpers (handle old `dashed`/`arrowEnd`/`arrowStart` fields) ──

function getDashStyle(s: { dashStyle?: DashStyle; dashed?: boolean }): DashStyle {
  if (s.dashStyle) return s.dashStyle;
  if (s.dashed) return "dashed";
  return "solid";
}
function getArrowEndHead(s: { arrowEndHead?: ArrowHead; arrowEnd?: boolean }, fallback: ArrowHead = "none"): ArrowHead {
  // Explicit non-default head wins
  if (s.arrowEndHead && s.arrowEndHead !== "none") return s.arrowEndHead;
  // Legacy boolean (true = normal arrow)
  if (s.arrowEnd) return "normal";
  // Explicit "none" from user (only when fallback is also none — otherwise let implicit arrow kinds win)
  if (s.arrowEndHead === "none" && fallback === "none") return "none";
  return fallback;
}
function getArrowStartHead(s: { arrowStartHead?: ArrowHead; arrowStart?: boolean }): ArrowHead {
  if (s.arrowStartHead && s.arrowStartHead !== "none") return s.arrowStartHead;
  if (s.arrowStart) return "normal";
  return "none";
}
function getArrowSize(s: { arrowSize?: "tiny" | "small" | "normal" | "large" }): "tiny" | "small" | "normal" | "large" {
  return s.arrowSize ?? "normal";
}
function getStrokeColor(s: { stroke: string }): string {
  return colorRgb(s.stroke);
}

// ── Fixed visual constants (px) ─────────────────────────────────

/** Convert TikZ line-width (pt) to screen px. Independent of zoom. */
function lineW(ptWidth: number, zoom: number): number {
  // 1pt ≈ 1.33px, slightly thicken on zoom-in for visibility
  return Math.max(0.5, ptWidth * 1.33 * Math.min(Math.sqrt(zoom), 1.5));
}

/** Fixed label font size in px */
function labelFontSize(ptSize: number, _zoom: number): number {
  return Math.max(8, Math.min(ptSize * 1.1, 18));
}

// ── Helpers ─────────────────────────────────────────────────────

function dashArray(style: DashStyle, swPx: number): string | undefined {
  const p = DASH_PATTERNS.find((x) => x.style === style)?.pattern;
  if (!p) return undefined;
  // Scale the dash-array by stroke width so dashes look proportional
  return p.split(",").map((n) => (parseFloat(n) * swPx).toString()).join(",");
}

function arrowMarkerId(shapeId: string, end: "start" | "end"): string {
  return `arrow-${shapeId}-${end}`;
}

/** Build SVG path data for an arrow head shape (drawn pointing right at origin). */
function arrowPath(head: ArrowHead, size: number): { d: string; fill: string; stroke?: string } {
  const s = size;
  const filled = (color: string) => ({ fill: color });
  const outline = (color: string) => ({ fill: "white", stroke: color });

  switch (head) {
    case "normal":
      return { d: `M0,0 L${s},${s / 2} L0,${s} Z`, fill: "current" };
    case "fnormal":
      return { d: `M0,0 L${s},${s / 2} L0,${s} Z`, fill: "white", stroke: "current" };
    case "pointed":
      return { d: `M0,0 L${s},${s / 2} L${s * 0.2},${s / 2} L0,${s} Z`, fill: "current" };
    case "fpointed":
      return { d: `M0,0 L${s},${s / 2} L${s * 0.2},${s / 2} L0,${s} Z`, fill: "white", stroke: "current" };
    case "linear":
      return { d: `M0,0 L${s},${s / 2} L0,${s}`, fill: "none", stroke: "current" };
    case "double":
      return { d: `M0,0 L${s / 2},${s / 2} L0,${s} Z M${s / 2},0 L${s},${s / 2} L${s / 2},${s} Z`, fill: "current" };
    case "fdouble":
      return { d: `M0,0 L${s / 2},${s / 2} L0,${s} Z M${s / 2},0 L${s},${s / 2} L${s / 2},${s} Z`, fill: "white", stroke: "current" };
    case "none":
    default:
      return { d: "", fill: "none" };
  }
}

export function ArrowDefs({ shape, scale }: { shape: FigureShape; scale: number }) {
  const defs: React.ReactNode[] = [];
  const color = getStrokeColor(shape.style);
  const arrowSizeName = getArrowSize(shape.style);
  const sizeBase = ARROW_SIZES.find((a) => a.name === arrowSizeName)?.px ?? 8;
  const sw = lineW(shape.style.strokeWidth, scale / 50);
  const size = Math.max(4, sizeBase + sw);

  // Implicit arrow for arrow-kinds: defaults to "normal" if user didn't override
  const implicitArrowKinds = ["arrow", "force-arrow", "vector", "reaction-arrow"];
  const implicitFallback: ArrowHead = implicitArrowKinds.includes(shape.kind) ? "normal" : "none";

  const endHead = getArrowEndHead(shape.style, implicitFallback);
  const startHead = getArrowStartHead(shape.style);

  const makeMarker = (head: ArrowHead, end: "start" | "end") => {
    if (head === "none") return null;
    const p = arrowPath(head, size);
    if (!p.d) return null;
    const fill = p.fill === "current" ? color : p.fill;
    const stroke = p.stroke === "current" ? color : p.stroke;
    const isEnd = end === "end";
    return (
      <marker key={`${shape.id}-${end}`} id={arrowMarkerId(shape.id, end)}
        markerWidth={size} markerHeight={size}
        refX={isEnd ? size - 1 : 1} refY={size / 2}
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <g transform={isEnd ? "" : `translate(${size},0) scale(-1,1)`}>
          <path d={p.d} fill={fill} stroke={stroke} strokeWidth={stroke ? sw * 0.8 : 0} />
        </g>
      </marker>
    );
  };

  const startMarker = makeMarker(startHead, "start");
  const endMarker = makeMarker(endHead, "end");
  if (endMarker) defs.push(endMarker);
  if (startMarker) defs.push(startMarker);
  return defs.length > 0 ? <>{defs}</> : null;
}

// ── Common SVG props ────────────────────────────────────────────

interface ShapeRenderProps {
  shape: FigureShape;
  scale: number; // px per cm
  cx: number; cy: number; pw: number; ph: number;
  pxPoints: Point[];
  selected: boolean;
  hovered: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function getZoom(scale: number) { return scale / 50; }

function sw(props: ShapeRenderProps): number {
  return lineW(props.shape.style.strokeWidth, getZoom(props.scale));
}

function fs(props: ShapeRenderProps): number {
  return labelFontSize(props.shape.style.fontSizePt, getZoom(props.scale));
}

function stroke(props: ShapeRenderProps) { return getStrokeColor(props.shape.style); }
function fill(props: ShapeRenderProps) {
  if (props.shape.style.fill === "none") return "transparent";
  return colorRgb(props.shape.style.fill);
}
function fillOp(props: ShapeRenderProps) { return props.shape.style.fillOpacity; }
function strokeOp(props: ShapeRenderProps) { return props.shape.style.strokeOpacity ?? 1; }
function dash(props: ShapeRenderProps) { return dashArray(getDashStyle(props.shape.style), sw(props)); }

function wrap(props: ShapeRenderProps, children: React.ReactNode) {
  const cls = props.selected ? "shape-selected" : props.hovered ? "shape-hovered" : "";
  return (
    <g className={cls} onMouseDown={props.onMouseDown}
      onMouseEnter={props.onMouseEnter} onMouseLeave={props.onMouseLeave}
      style={{ pointerEvents: "all" }}>
      {children}
    </g>
  );
}

function needArrowEnd(kind: string, style: { arrowEndHead?: ArrowHead; arrowEnd?: boolean }) {
  if (["arrow", "force-arrow", "vector", "reaction-arrow"].includes(kind)) return true;
  const head = getArrowEndHead(style);
  return head !== "none";
}

// ══════════════════════════════════════════════════════════════════
//  LABEL RENDERING — shared across all shape types
// ══════════════════════════════════════════════════════════════════

/**
 * Compute the anchor point (in SCREEN px) for a label, given:
 *  - bbox (or natural anchor) in screen coords
 *  - label position preset
 *  - additional user offset (cm, will be converted to px via scale)
 *  - optional "natural anchor" for line-like shapes (midpoint of terminals)
 */
interface LabelAnchorInput {
  bboxX: number; bboxY: number; bboxW: number; bboxH: number;
  scale: number;
  labelPos: import("./types").LabelPosition;
  labelOffsetCm: { x: number; y: number };
  /** If provided, labels override bbox center with this natural anchor (line midpoint) */
  naturalCenter?: { x: number; y: number };
}

type DomBaseline = "auto" | "central" | "hanging";
function computeLabelAnchor(input: LabelAnchorInput): { x: number; y: number; textAnchor: "start" | "middle" | "end"; dominantBaseline: DomBaseline } {
  const { bboxX, bboxY, bboxW, bboxH, scale, labelPos, labelOffsetCm, naturalCenter } = input;
  const cx = naturalCenter?.x ?? bboxX + bboxW / 2;
  const cy = naturalCenter?.y ?? bboxY + bboxH / 2;
  const gap = 6; // px gap between shape edge and label
  let x = cx, y = cy;
  let textAnchor: "start" | "middle" | "end" = "middle";
  let dominantBaseline: DomBaseline = "central";

  switch (labelPos) {
    case "above":
      x = cx; y = bboxY - gap; textAnchor = "middle"; dominantBaseline = "auto"; break;
    case "below":
      x = cx; y = bboxY + bboxH + gap; textAnchor = "middle"; dominantBaseline = "hanging"; break;
    case "left":
      x = bboxX - gap; y = cy; textAnchor = "end"; dominantBaseline = "central"; break;
    case "right":
      x = bboxX + bboxW + gap; y = cy; textAnchor = "start"; dominantBaseline = "central"; break;
    case "above-left":
      x = bboxX - gap; y = bboxY - gap; textAnchor = "end"; dominantBaseline = "auto"; break;
    case "above-right":
      x = bboxX + bboxW + gap; y = bboxY - gap; textAnchor = "start"; dominantBaseline = "auto"; break;
    case "below-left":
      x = bboxX - gap; y = bboxY + bboxH + gap; textAnchor = "end"; dominantBaseline = "hanging"; break;
    case "below-right":
      x = bboxX + bboxW + gap; y = bboxY + bboxH + gap; textAnchor = "start"; dominantBaseline = "hanging"; break;
    case "center":
    default:
      x = cx; y = cy; textAnchor = "middle"; dominantBaseline = "central"; break;
  }

  // Apply user offset (in cm, TikZ y-up → screen y-down)
  x += labelOffsetCm.x * scale;
  y -= labelOffsetCm.y * scale;
  return { x, y, textAnchor, dominantBaseline };
}

/**
 * Render a shape's label. Uses shape.label, shape.labelPos, shape.labelOffset.
 * For line-like shapes, pass the terminal midpoint as `naturalCenter`.
 * `bboxInScreen` is the screen bounding box of the shape's visual body
 * (for line-like: defined by terminal span; for area: the bbox rectangle).
 */
function ShapeLabel(props: {
  shape: FigureShape;
  scale: number;
  bboxInScreen: { x: number; y: number; w: number; h: number };
  naturalCenter?: { x: number; y: number };
  sizeMul?: number;
}) {
  const { shape, scale, bboxInScreen, naturalCenter, sizeMul = 1 } = props;
  if (!shape.label) return null;

  const anchor = computeLabelAnchor({
    bboxX: bboxInScreen.x, bboxY: bboxInScreen.y,
    bboxW: bboxInScreen.w, bboxH: bboxInScreen.h,
    scale,
    labelPos: shape.labelPos ?? "center",
    labelOffsetCm: shape.labelOffset ?? { x: 0, y: 0 },
    naturalCenter,
  });

  const fontSize = labelFontSize(shape.style.fontSizePt, scale / 50) * sizeMul;

  // Math mode: render via KaTeX inside a foreignObject for accurate LaTeX look
  if (shape.labelMathMode) {
    let html: string;
    try { html = renderInlineMathOrPlaceholder(shape.label); }
    catch { html = renderMathPlaceholder(shape.label); }

    // foreignObject needs a sized box; estimate generously based on text length
    const estW = Math.max(fontSize * 2, shape.label.length * fontSize * 0.7);
    const estH = fontSize * 2;
    let foX = anchor.x, foY = anchor.y - estH / 2;
    if (anchor.textAnchor === "middle") foX -= estW / 2;
    else if (anchor.textAnchor === "end") foX -= estW;
    if (anchor.dominantBaseline === "auto") foY = anchor.y - estH;
    else if (anchor.dominantBaseline === "hanging") foY = anchor.y;

    return (
      <foreignObject x={foX} y={foY} width={estW} height={estH} style={{ pointerEvents: "none", overflow: "visible" }}>
        <div
          style={{
            width: "100%", height: "100%",
            display: "flex",
            justifyContent: anchor.textAnchor === "middle" ? "center" : anchor.textAnchor === "end" ? "flex-end" : "flex-start",
            alignItems: anchor.dominantBaseline === "auto" ? "flex-end" : anchor.dominantBaseline === "hanging" ? "flex-start" : "center",
            fontSize: `${fontSize}px`,
            color: shape.style.stroke,
            lineHeight: 1,
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </foreignObject>
    );
  }

  // Plain text
  return (
    <text x={anchor.x} y={anchor.y} textAnchor={anchor.textAnchor} dominantBaseline={anchor.dominantBaseline}
      fontSize={fontSize} fill={shape.style.stroke} pointerEvents="none">
      {shape.label}
    </text>
  );
}

/** Lightweight math rendering for SVG: strip $, render symbols close to TikZ output look. */
function renderMathPlaceholder(src: string): string {
  // Strip surrounding $ if present
  let t = src.replace(/^\$+|\$+$/g, "");
  // Common LaTeX → Unicode substitutions for on-canvas preview
  const subs: Record<string, string> = {
    "\\alpha": "α", "\\beta": "β", "\\gamma": "γ", "\\delta": "δ", "\\epsilon": "ε",
    "\\theta": "θ", "\\lambda": "λ", "\\mu": "μ", "\\pi": "π", "\\rho": "ρ",
    "\\sigma": "σ", "\\tau": "τ", "\\phi": "φ", "\\omega": "ω",
    "\\Omega": "Ω", "\\Delta": "Δ", "\\Sigma": "Σ",
    "\\cdot": "·", "\\times": "×", "\\pm": "±", "\\infty": "∞",
    "\\leq": "≤", "\\geq": "≥", "\\neq": "≠",
  };
  for (const [k, v] of Object.entries(subs)) t = t.split(k).join(v);
  return t;
}

// ══════════════════════════════════════════════════════════════════
//  BASIC SHAPES
// ══════════════════════════════════════════════════════════════════

function RenderRect(p: ShapeRenderProps) {
  const w = sw(p);
  return wrap(p, <>
    <rect x={p.cx} y={p.cy} width={p.pw} height={p.ph} rx={1.5}
      stroke={stroke(p)} strokeWidth={w} fill={fill(p)} fillOpacity={fillOp(p)} strokeDasharray={dash(p)}
      transform={p.shape.rotation ? `rotate(${-p.shape.rotation}, ${p.cx + p.pw / 2}, ${p.cy + p.ph / 2})` : undefined} />
    <ShapeLabel shape={p.shape} scale={p.scale} bboxInScreen={{ x: p.cx, y: p.cy, w: p.pw, h: p.ph }} />
  </>);
}

function RenderCircle(p: ShapeRenderProps) {
  const r = Math.min(p.pw, p.ph) / 2;
  const cx = p.cx + p.pw / 2, cy = p.cy + p.ph / 2;
  return wrap(p, <>
    <circle cx={cx} cy={cy} r={r} stroke={stroke(p)} strokeWidth={sw(p)} fill={fill(p)} fillOpacity={fillOp(p)} strokeDasharray={dash(p)} />
    <ShapeLabel shape={p.shape} scale={p.scale} bboxInScreen={{ x: p.cx, y: p.cy, w: p.pw, h: p.ph }} />
  </>);
}

function RenderEllipse(p: ShapeRenderProps) {
  const cx = p.cx + p.pw / 2, cy = p.cy + p.ph / 2;
  return wrap(p, <>
    <ellipse cx={cx} cy={cy} rx={p.pw / 2} ry={p.ph / 2}
      stroke={stroke(p)} strokeWidth={sw(p)} fill={fill(p)} fillOpacity={fillOp(p)} strokeDasharray={dash(p)} />
    <ShapeLabel shape={p.shape} scale={p.scale} bboxInScreen={{ x: p.cx, y: p.cy, w: p.pw, h: p.ph }} />
  </>);
}

function RenderLine(p: ShapeRenderProps) {
  const pts = p.pxPoints.length >= 2 ? p.pxPoints : [{ x: 0, y: 0 }, { x: p.pw, y: 0 }];
  const d = pts.map((pt, i) => `${i === 0 ? "M" : "L"}${p.cx + pt.x},${p.cy + pt.y}`).join(" ");
  const w = sw(p);
  const hasEnd = needArrowEnd(p.shape.kind, p.shape.style);
  // Line label uses the midpoint of terminals as the natural anchor
  const midX = (p.cx + pts[0].x + p.cx + pts[pts.length - 1].x) / 2;
  const midY = (p.cy + pts[0].y + p.cy + pts[pts.length - 1].y) / 2;
  // For line-based labels use a thin bbox around the line itself
  const lineBboxX = Math.min(p.cx + pts[0].x, p.cx + pts[pts.length - 1].x);
  const lineBboxY = Math.min(p.cy + pts[0].y, p.cy + pts[pts.length - 1].y);
  const lineBboxW = Math.abs(pts[pts.length - 1].x - pts[0].x);
  const lineBboxH = Math.abs(pts[pts.length - 1].y - pts[0].y);
  return wrap(p, <>
    <path d={d} stroke="transparent" strokeWidth={Math.max(8, w * 4)} fill="none" />
    <path d={d} stroke={stroke(p)} strokeWidth={w} fill="none" strokeDasharray={dash(p)}
      markerEnd={hasEnd ? `url(#${arrowMarkerId(p.shape.id, "end")})` : undefined}
      markerStart={getArrowStartHead(p.shape.style) !== "none" ? `url(#${arrowMarkerId(p.shape.id, "start")})` : undefined}
      strokeLinecap="round" />
    <ShapeLabel shape={p.shape} scale={p.scale}
      bboxInScreen={{ x: lineBboxX, y: lineBboxY, w: lineBboxW, h: lineBboxH }}
      naturalCenter={{ x: midX, y: midY }} />
  </>);
}

function RenderPolygon(p: ShapeRenderProps) {
  const pts = p.pxPoints.length >= 3 ? p.pxPoints : [{ x: p.pw / 2, y: 0 }, { x: 0, y: p.ph }, { x: p.pw, y: p.ph }];
  const points = pts.map((pt) => `${p.cx + pt.x},${p.cy + pt.y}`).join(" ");
  return wrap(p, <>
    <polygon points={points} stroke={stroke(p)} strokeWidth={sw(p)} fill={fill(p)} fillOpacity={fillOp(p)} strokeDasharray={dash(p)} />
    <ShapeLabel shape={p.shape} scale={p.scale} bboxInScreen={{ x: p.cx, y: p.cy, w: p.pw, h: p.ph }} />
  </>);
}

function RenderText(p: ShapeRenderProps) {
  return wrap(p, <>
    <rect x={p.cx} y={p.cy} width={Math.max(p.pw, 30)} height={Math.max(p.ph, 16)} fill="transparent" stroke="none" />
    <text x={p.cx + p.pw / 2} y={p.cy + p.ph / 2} textAnchor="middle" dominantBaseline="central"
      fontSize={fs(p) * 1.2} fill={stroke(p)} fontFamily="serif" style={{ userSelect: "none" }}>
      {p.shape.labelMathMode ? renderMathPlaceholder(p.shape.label || "Text") : (p.shape.label || "Text")}
    </text>
  </>);
}

function RenderFreehand(p: ShapeRenderProps) {
  if (p.pxPoints.length < 2) return null;
  const d = p.pxPoints.map((pt, i) => `${i === 0 ? "M" : "L"}${p.cx + pt.x},${p.cy + pt.y}`).join(" ");
  return wrap(p, <path d={d} stroke={stroke(p)} strokeWidth={sw(p)} fill="none"
    strokeDasharray={dash(p)} strokeLinecap="round" strokeLinejoin="round" />);
}

// ══════════════════════════════════════════════════════════════════
//  CIRCUIT COMPONENTS — proper schematic-quality symbols
//
//  Convention: circuit components are drawn between two TERMINALS
//  stored in shape.points[0] and shape.points[1] (relative to x,y).
//  The component body is rendered horizontally then rotated to match.
// ══════════════════════════════════════════════════════════════════

/** Get absolute screen positions of start/end terminals */
function getTerminals(p: ShapeRenderProps): { x1: number; y1: number; x2: number; y2: number; len: number; angle: number; midX: number; midY: number } {
  if (p.pxPoints.length >= 2) {
    const x1 = p.cx + p.pxPoints[0].x, y1 = p.cy + p.pxPoints[0].y;
    const x2 = p.cx + p.pxPoints[1].x, y2 = p.cy + p.pxPoints[1].y;
    const dx = x2 - x1, dy = y2 - y1;
    return { x1, y1, x2, y2, len: Math.sqrt(dx * dx + dy * dy), angle: Math.atan2(dy, dx) * 180 / Math.PI, midX: (x1 + x2) / 2, midY: (y1 + y2) / 2 };
  }
  // Fallback: horizontal left→right
  const x1 = p.cx, y1 = p.cy + p.ph / 2, x2 = p.cx + p.pw, y2 = y1;
  return { x1, y1, x2, y2, len: p.pw, angle: 0, midX: (x1 + x2) / 2, midY: y1 };
}

/**
 * Render a two-terminal component: draws the component body horizontally
 * centered at origin, then transforms it to the correct position/angle.
 * Label uses the shared ShapeLabel system — positioned in SCREEN space based on labelPos.
 */
function TwoTerminal(p: ShapeRenderProps, bodyFn: (len: number, w: number) => React.ReactNode) {
  const t = getTerminals(p);
  const w = sw(p);
  // Compute axis-aligned bbox around the line segment (in SCREEN coords)
  const bboxX = Math.min(t.x1, t.x2), bboxY = Math.min(t.y1, t.y2);
  const bboxW = Math.abs(t.x2 - t.x1), bboxH = Math.abs(t.y2 - t.y1);
  // Expand bbox to include component body thickness (12px each side)
  const pad = 12;
  return wrap(p, <>
    <g transform={`translate(${t.midX},${t.midY}) rotate(${t.angle})`}>
      {bodyFn(t.len, w)}
      <circle cx={-t.len / 2} cy={0} r={2} fill={stroke(p)} />
      <circle cx={t.len / 2} cy={0} r={2} fill={stroke(p)} />
    </g>
    <ShapeLabel shape={p.shape} scale={p.scale} sizeMul={0.95}
      bboxInScreen={{ x: bboxX - pad, y: bboxY - pad, w: bboxW + pad * 2, h: bboxH + pad * 2 }}
      naturalCenter={{ x: t.midX, y: t.midY }} />
  </>);
}

function RenderResistor(p: ShapeRenderProps) {
  return TwoTerminal(p, (len, w) => {
    const bodyL = len * 0.6, leadL = (len - bodyL) / 2;
    const peaks = 6, segW = bodyL / peaks, amp = 6;
    let d = `M${-len / 2},0 L${-len / 2 + leadL},0`;
    for (let i = 0; i < peaks; i++) {
      d += ` L${-len / 2 + leadL + (i + 0.5) * segW},${(i % 2 === 0 ? -1 : 1) * amp}`;
    }
    d += ` L${len / 2 - leadL},0 L${len / 2},0`;
    return <path d={d} stroke={stroke(p)} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
  });
}

function RenderCapacitor(p: ShapeRenderProps) {
  return TwoTerminal(p, (len, w) => {
    const gap = Math.max(3, len * 0.04);
    const plateH = 10;
    return <>
      <line x1={-len / 2} y1={0} x2={-gap} y2={0} stroke={stroke(p)} strokeWidth={w} />
      <line x1={-gap} y1={-plateH} x2={-gap} y2={plateH} stroke={stroke(p)} strokeWidth={w * 1.8} strokeLinecap="round" />
      <line x1={gap} y1={-plateH} x2={gap} y2={plateH} stroke={stroke(p)} strokeWidth={w * 1.8} strokeLinecap="round" />
      <line x1={gap} y1={0} x2={len / 2} y2={0} stroke={stroke(p)} strokeWidth={w} />
    </>;
  });
}

function RenderInductor(p: ShapeRenderProps) {
  return TwoTerminal(p, (len, w) => {
    const leadL = len * 0.12;
    const bodyS = -len / 2 + leadL, bodyE = len / 2 - leadL;
    const coils = 4, coilW = (bodyE - bodyS) / coils, r = coilW / 2;
    let d = `M${-len / 2},0 L${bodyS},0`;
    for (let i = 0; i < coils; i++) {
      d += ` A${r},${r} 0 1,0 ${bodyS + (i + 1) * coilW},0`;
    }
    d += ` L${len / 2},0`;
    return <path d={d} stroke={stroke(p)} strokeWidth={w} fill="none" />;
  });
}

function RenderVoltageSource(p: ShapeRenderProps) {
  return TwoTerminal(p, (len, w) => {
    const r = Math.min(len * 0.22, 12);
    const ss = Math.max(3, r * 0.35);
    return <>
      <line x1={-len / 2} y1={0} x2={-r} y2={0} stroke={stroke(p)} strokeWidth={w} />
      <circle cx={0} cy={0} r={r} stroke={stroke(p)} strokeWidth={w} fill="transparent" />
      {/* + */}
      <line x1={-ss / 2} y1={-r * 0.35} x2={ss / 2} y2={-r * 0.35} stroke={stroke(p)} strokeWidth={w} />
      <line x1={0} y1={-r * 0.35 - ss / 2} x2={0} y2={-r * 0.35 + ss / 2} stroke={stroke(p)} strokeWidth={w} />
      {/* - */}
      <line x1={-ss / 2} y1={r * 0.35} x2={ss / 2} y2={r * 0.35} stroke={stroke(p)} strokeWidth={w} />
      <line x1={r} y1={0} x2={len / 2} y2={0} stroke={stroke(p)} strokeWidth={w} />
    </>;
  });
}

function RenderCurrentSource(p: ShapeRenderProps) {
  return TwoTerminal(p, (len, w) => {
    const r = Math.min(len * 0.22, 12);
    const aL = r * 0.5;
    return <>
      <line x1={-len / 2} y1={0} x2={-r} y2={0} stroke={stroke(p)} strokeWidth={w} />
      <circle cx={0} cy={0} r={r} stroke={stroke(p)} strokeWidth={w} fill="transparent" />
      <line x1={0} y1={aL} x2={0} y2={-aL} stroke={stroke(p)} strokeWidth={w} />
      <path d={`M-3,${-aL + 4} L0,${-aL} L3,${-aL + 4}`} stroke={stroke(p)} strokeWidth={w} fill="none" />
      <line x1={r} y1={0} x2={len / 2} y2={0} stroke={stroke(p)} strokeWidth={w} />
    </>;
  });
}

function RenderGround(p: ShapeRenderProps) {
  const { cx, cy, pw, ph } = p;
  const w = sw(p);
  const midX = cx + pw / 2;
  return wrap(p, <>
    <line x1={midX} y1={cy} x2={midX} y2={cy + ph * 0.25} stroke={stroke(p)} strokeWidth={w} />
    <line x1={cx + pw * 0.1} y1={cy + ph * 0.25} x2={cx + pw * 0.9} y2={cy + ph * 0.25} stroke={stroke(p)} strokeWidth={w} />
    <line x1={cx + pw * 0.22} y1={cy + ph * 0.5} x2={cx + pw * 0.78} y2={cy + ph * 0.5} stroke={stroke(p)} strokeWidth={w} />
    <line x1={cx + pw * 0.35} y1={cy + ph * 0.75} x2={cx + pw * 0.65} y2={cy + ph * 0.75} stroke={stroke(p)} strokeWidth={w} />
    <circle cx={midX} cy={cy} r={1.5} fill={stroke(p)} />
  </>);
}

function RenderSwitch(p: ShapeRenderProps) {
  return TwoTerminal(p, (len, w) => {
    const cL = len * 0.3, cR = len * 0.3;
    return <>
      <line x1={-len / 2} y1={0} x2={-len / 2 + cL} y2={0} stroke={stroke(p)} strokeWidth={w} />
      <circle cx={-len / 2 + cL} cy={0} r={2.5} fill={stroke(p)} />
      <line x1={-len / 2 + cL} y1={0} x2={len / 2 - cR * 0.5} y2={-8} stroke={stroke(p)} strokeWidth={w} strokeLinecap="round" />
      <circle cx={len / 2 - cR} cy={0} r={2.5} fill={stroke(p)} />
      <line x1={len / 2 - cR} y1={0} x2={len / 2} y2={0} stroke={stroke(p)} strokeWidth={w} />
    </>;
  });
}

function RenderDiode(p: ShapeRenderProps) {
  return TwoTerminal(p, (len, w) => {
    const triW = len * 0.15, triH = 8;
    return <>
      <line x1={-len / 2} y1={0} x2={-triW} y2={0} stroke={stroke(p)} strokeWidth={w} />
      <polygon points={`${-triW},${-triH} ${-triW},${triH} ${triW},0`}
        stroke={stroke(p)} strokeWidth={w} fill="transparent" strokeLinejoin="round" />
      <line x1={triW} y1={-triH} x2={triW} y2={triH} stroke={stroke(p)} strokeWidth={w * 1.3} />
      <line x1={triW} y1={0} x2={len / 2} y2={0} stroke={stroke(p)} strokeWidth={w} />
    </>;
  });
}

function RenderLED(p: ShapeRenderProps) {
  return TwoTerminal(p, (len, w) => {
    const triW = len * 0.15, triH = 8;
    return <>
      <line x1={-len / 2} y1={0} x2={-triW} y2={0} stroke={stroke(p)} strokeWidth={w} />
      <polygon points={`${-triW},${-triH} ${-triW},${triH} ${triW},0`}
        stroke={stroke(p)} strokeWidth={w} fill="transparent" strokeLinejoin="round" />
      <line x1={triW} y1={-triH} x2={triW} y2={triH} stroke={stroke(p)} strokeWidth={w * 1.3} />
      <line x1={triW} y1={0} x2={len / 2} y2={0} stroke={stroke(p)} strokeWidth={w} />
      {/* Light arrows */}
      <line x1={triW * 0.3} y1={-triH * 1.1} x2={triW * 1.1} y2={-triH * 1.6} stroke={stroke(p)} strokeWidth={w * 0.6} />
      <line x1={triW * 0.8} y1={-triH * 0.9} x2={triW * 1.6} y2={-triH * 1.4} stroke={stroke(p)} strokeWidth={w * 0.6} />
    </>;
  });
}

function RenderTransistor(p: ShapeRenderProps, npn: boolean) {
  const { cx, cy, pw, ph } = p;
  const w = sw(p);
  const midX = cx + pw * 0.4, midY = cy + ph / 2;
  const bodyR = Math.min(pw, ph) * 0.3;
  const baseX = midX - bodyR;

  return wrap(p, <>
    {/* Body circle */}
    <circle cx={midX} cy={midY} r={bodyR} stroke={stroke(p)} strokeWidth={w} fill="transparent" />
    {/* Base lead */}
    <line x1={cx} y1={midY} x2={baseX} y2={midY} stroke={stroke(p)} strokeWidth={w} />
    {/* Base line (vertical inside circle) */}
    <line x1={baseX + bodyR * 0.3} y1={midY - bodyR * 0.5} x2={baseX + bodyR * 0.3} y2={midY + bodyR * 0.5}
      stroke={stroke(p)} strokeWidth={w * 1.5} strokeLinecap="round" />
    {/* Collector */}
    <line x1={baseX + bodyR * 0.3} y1={midY - bodyR * 0.3}
      x2={midX + bodyR * 0.7} y2={cy + ph * 0.15} stroke={stroke(p)} strokeWidth={w} />
    <line x1={midX + bodyR * 0.7} y1={cy + ph * 0.15} x2={midX + bodyR * 0.7} y2={cy} stroke={stroke(p)} strokeWidth={w} />
    {/* Emitter */}
    <line x1={baseX + bodyR * 0.3} y1={midY + bodyR * 0.3}
      x2={midX + bodyR * 0.7} y2={cy + ph * 0.85} stroke={stroke(p)} strokeWidth={w} />
    <line x1={midX + bodyR * 0.7} y1={cy + ph * 0.85} x2={midX + bodyR * 0.7} y2={cy + ph} stroke={stroke(p)} strokeWidth={w} />
    {/* Dots */}
    <circle cx={cx} cy={midY} r={1.5} fill={stroke(p)} />
    <circle cx={midX + bodyR * 0.7} cy={cy} r={1.5} fill={stroke(p)} />
    <circle cx={midX + bodyR * 0.7} cy={cy + ph} r={1.5} fill={stroke(p)} />
    {/* Labels */}
    <text x={cx + 4} y={midY - 4} fontSize={8} fill={stroke(p)} pointerEvents="none" opacity={0.5}>B</text>
    <text x={midX + bodyR * 0.7 + 3} y={cy + 10} fontSize={8} fill={stroke(p)} pointerEvents="none" opacity={0.5}>C</text>
    <text x={midX + bodyR * 0.7 + 3} y={cy + ph - 3} fontSize={8} fill={stroke(p)} pointerEvents="none" opacity={0.5}>E</text>
    <ShapeLabel shape={p.shape} scale={p.scale} bboxInScreen={{ x: cx, y: cy, w: pw, h: ph }} />
  </>);
}

function RenderOpAmp(p: ShapeRenderProps) {
  const { cx, cy, pw, ph } = p;
  const w = sw(p);
  const points = `${cx + pw * 0.15},${cy} ${cx + pw * 0.15},${cy + ph} ${cx + pw * 0.85},${cy + ph / 2}`;
  const inpY1 = cy + ph * 0.3, inpY2 = cy + ph * 0.7;
  const inpX = cx + pw * 0.15;

  return wrap(p, <>
    <polygon points={points} stroke={stroke(p)} strokeWidth={w} fill="transparent" strokeLinejoin="round" />
    {/* + input */}
    <line x1={cx} y1={inpY2} x2={inpX} y2={inpY2} stroke={stroke(p)} strokeWidth={w} />
    <text x={inpX + 5} y={inpY2} fontSize={9} fill={stroke(p)} dominantBaseline="central" pointerEvents="none">+</text>
    {/* - input */}
    <line x1={cx} y1={inpY1} x2={inpX} y2={inpY1} stroke={stroke(p)} strokeWidth={w} />
    <text x={inpX + 5} y={inpY1} fontSize={10} fill={stroke(p)} dominantBaseline="central" pointerEvents="none">&minus;</text>
    {/* Output */}
    <line x1={cx + pw * 0.85} y1={cy + ph / 2} x2={cx + pw} y2={cy + ph / 2} stroke={stroke(p)} strokeWidth={w} />
    <circle cx={cx} cy={inpY1} r={1.5} fill={stroke(p)} />
    <circle cx={cx} cy={inpY2} r={1.5} fill={stroke(p)} />
    <circle cx={cx + pw} cy={cy + ph / 2} r={1.5} fill={stroke(p)} />
    <ShapeLabel shape={p.shape} scale={p.scale} bboxInScreen={{ x: cx, y: cy, w: pw, h: ph }} />
  </>);
}

// ══════════════════════════════════════════════════════════════════
//  MECHANICS
// ══════════════════════════════════════════════════════════════════

function RenderSpring(p: ShapeRenderProps) {
  return TwoTerminal(p, (len, w) => {
    const strokeColor = stroke(p);
    const leadL = Math.min(len * 0.04, 6);
    const bodyS = -len / 2 + leadL;
    const bodyE = len / 2 - leadL;
    const bodyLen = Math.max(1, bodyE - bodyS);

    // ── Helical coil using cubic bezier — mirrors TikZ `coil` decoration output ──
    // Each turn: the wire goes UP over the top (front of coil) then BELOW the axis
    // and loops back (visible back of coil). The below-axis segment starts BEFORE
    // the next coil begins, creating visible crossovers — this is the key "3D helix" effect.
    //
    // Parameters inspired by TikZ's `coil, aspect=0.3, segment length=~5px`:
    const targetPitch = 6;                                    // ~6px per full turn
    const coils = Math.max(8, Math.round(bodyLen / targetPitch));
    const pitch = bodyLen / coils;
    // Amplitude — tall enough to look like a proper coil
    const amp = Math.min(Math.max(pitch * 1.4, 8), 13);
    // Aspect ratio for the "look-down-the-axis" foreshortening — each turn is not a
    // simple sine wave but a true loop with visible crossover
    const crossover = pitch * 0.3;                            // how much adjacent loops overlap horizontally

    let d = `M ${-len / 2},0 L ${bodyS},0`;

    for (let i = 0; i < coils; i++) {
      const x0 = bodyS + i * pitch;
      const x1 = x0 + pitch;

      // UPPER lobe: cubic bezier from (x0, 0) peaking at center with pronounced loop feel.
      // Control points positioned INSIDE the segment so the bezier bulges up vertically.
      // Offset control points to the left/right to make the arc lean slightly — gives
      // the helix its "rolling" 3D look.
      d += ` C ${x0 - crossover * 0.1},${-amp * 1.2} ${x1 - crossover * 0.5},${-amp * 1.3} ${x1 - crossover * 0.3},0`;

      // LOWER lobe: small dip below axis that represents the "back" of the coil visible
      // between adjacent turns. Creates the classic helical crossover pattern.
      if (i < coils - 1) {
        // Dip down then back up to the next coil's upper-lobe start position
        const nextUpperStart = x1 - crossover * 0.3;
        const nextUpperEnd   = x1 + pitch - crossover * 0.3;
        const bridgeX = (nextUpperStart + x1 + crossover * 0.2) / 2;
        // cubic bezier going down-under-up
        d += ` C ${nextUpperStart + crossover * 0.2},${amp * 0.45} ${bridgeX},${amp * 0.45} ${x1 + crossover * 0.2},0`;
        // Short baseline segment bridging to the next coil's upper-lobe start
        d += ` L ${nextUpperEnd - (nextUpperEnd - x1 - crossover * 0.2) * 0},0`;
      }
    }
    d += ` L ${bodyE},0 L ${len / 2},0`;

    return <path d={d} stroke={strokeColor} strokeWidth={w} fill="none"
      strokeLinecap="round" strokeLinejoin="round" />;
  });
}

function RenderMass(p: ShapeRenderProps) {
  const w = sw(p);
  return wrap(p, <>
    <rect x={p.cx} y={p.cy} width={p.pw} height={p.ph} stroke={stroke(p)} strokeWidth={w}
      fill={fill(p) === "transparent" ? "#e5e7eb" : fill(p)} fillOpacity={fillOp(p)} />
    {/* Hatching */}
    {[0.25, 0.5, 0.75].map((f) => (
      <line key={f} x1={p.cx + p.pw * f} y1={p.cy + p.ph}
        x2={p.cx + p.pw * (f - 0.15)} y2={p.cy + p.ph * 0.7}
        stroke={stroke(p)} strokeWidth={0.5} opacity={0.3} />
    ))}
    {p.shape.label && (
      <text x={p.cx + p.pw / 2} y={p.cy + p.ph / 2} textAnchor="middle" dominantBaseline="central"
        fontSize={fs(p)} fill={stroke(p)} pointerEvents="none" fontStyle="italic">
        {p.shape.labelMathMode ? renderMathPlaceholder(p.shape.label) : p.shape.label}
      </text>
    )}
  </>);
}

function RenderPulley(p: ShapeRenderProps) {
  const r = Math.min(p.pw, p.ph) / 2;
  const cx = p.cx + p.pw / 2, cy = p.cy + p.ph / 2;
  return wrap(p, <>
    <circle cx={cx} cy={cy} r={r} stroke={stroke(p)} strokeWidth={sw(p)} fill="transparent" />
    <circle cx={cx} cy={cy} r={2} fill={stroke(p)} />
  </>);
}

/** Viscous damper (dashpot): cylinder + piston rod. Two-terminal shape. */
function RenderDamper(p: ShapeRenderProps) {
  return TwoTerminal(p, (len, w) => {
    const strokeColor = stroke(p);
    // Cylinder: covers middle 50% of length, height 60% of amp
    const cylW = len * 0.5;
    const cylX = -cylW / 2;      // left edge of cylinder
    const cylH = Math.min(len * 0.28, 12);  // cylinder height/2
    // Piston rod enters from the LEFT, piston plate inside cylinder
    const pistonX = -cylW / 2 + cylW * 0.35;  // piston plate position
    return (<>
      {/* Left lead to piston rod */}
      <line x1={-len / 2} y1={0} x2={pistonX} y2={0} stroke={strokeColor} strokeWidth={w} />
      {/* Piston plate (inside cylinder) */}
      <line x1={pistonX} y1={-cylH * 0.7} x2={pistonX} y2={cylH * 0.7}
        stroke={strokeColor} strokeWidth={w * 1.5} strokeLinecap="round" />
      {/* Cylinder: three walls (top, right, bottom) — left side is open for the rod */}
      <path d={`M ${cylX} ${-cylH}
                L ${cylX + cylW} ${-cylH}
                L ${cylX + cylW} ${cylH}
                L ${cylX} ${cylH}`}
        stroke={strokeColor} strokeWidth={w} fill="none" strokeLinejoin="round" />
      {/* Right lead out from cylinder */}
      <line x1={cylX + cylW} y1={0} x2={len / 2} y2={0} stroke={strokeColor} strokeWidth={w} />
    </>);
  });
}

/** Moment (curved rotation arrow). Uses bbox center as rotation center. */
function RenderMoment(p: ShapeRenderProps) {
  const { cx, cy, pw, ph, shape } = p;
  const w = sw(p);
  const strokeColor = stroke(p);
  const midX = cx + pw / 2, midY = cy + ph / 2;
  const r = Math.min(pw, ph) / 2 * 0.8;
  // Draw ~270° arc (3/4 circle), starting at top, going counter-clockwise
  // Arc from (midX, midY - r) → curve to (midX + r, midY)
  const startX = midX, startY = midY - r;
  const endX = midX + r * Math.cos(Math.PI * 0.1), endY = midY + r * Math.sin(Math.PI * 0.1);
  // Arrow head at end: triangle pointing tangent to the arc
  const tangentAngle = Math.PI * 0.1 + Math.PI / 2;  // perpendicular to radius at end
  const ahSize = Math.max(5, w * 4);
  const ahPath = `M ${endX - Math.cos(tangentAngle) * ahSize - Math.sin(tangentAngle) * ahSize * 0.4} ${endY - Math.sin(tangentAngle) * ahSize + Math.cos(tangentAngle) * ahSize * 0.4}
                  L ${endX} ${endY}
                  L ${endX - Math.cos(tangentAngle) * ahSize + Math.sin(tangentAngle) * ahSize * 0.4} ${endY - Math.sin(tangentAngle) * ahSize - Math.cos(tangentAngle) * ahSize * 0.4}`;
  return wrap(p, <>
    {/* 270° arc, rotating counter-clockwise */}
    <path d={`M ${startX} ${startY} A ${r} ${r} 0 1 1 ${endX} ${endY}`}
      stroke={strokeColor} strokeWidth={w} fill="none" strokeLinecap="round" />
    <path d={ahPath} stroke={strokeColor} strokeWidth={w} fill={strokeColor} strokeLinejoin="round" />
    {/* Center dot */}
    <circle cx={midX} cy={midY} r={1.5} fill={strokeColor} />
    {shape.label && (
      <text x={midX + r + 6} y={midY + 3} fontSize={fs(p) * 0.95}
        fill={strokeColor} pointerEvents="none" fontStyle="italic">
        {shape.labelMathMode ? renderMathPlaceholder(shape.label) : shape.label}
      </text>
    )}
  </>);
}

/** Roller support: triangle (with top on the object edge) + 2 rollers + ground line. */
function RenderSupportRoller(p: ShapeRenderProps) {
  const { cx, cy, pw, ph } = p;
  const w = sw(p);
  const strokeColor = stroke(p);
  // Triangle points: top (at the object), left-bottom, right-bottom
  const topY = cy;
  const baseY = cy + ph * 0.6;
  const triMidX = cx + pw / 2;
  const triBaseLeft = cx + pw * 0.2, triBaseRight = cx + pw * 0.8;
  // Rollers (circles) below triangle
  const rollerR = Math.min(pw, ph) * 0.08;
  const rollerY = baseY + rollerR + 1;
  // Ground line (with hatching) below rollers
  const groundY = rollerY + rollerR + 2;
  return wrap(p, <>
    {/* Triangle — filled white */}
    <polygon points={`${triMidX},${topY} ${triBaseLeft},${baseY} ${triBaseRight},${baseY}`}
      stroke={strokeColor} strokeWidth={w} fill="white" strokeLinejoin="round" />
    {/* Two rollers underneath */}
    <circle cx={triBaseLeft + (triBaseRight - triBaseLeft) * 0.3} cy={rollerY} r={rollerR}
      stroke={strokeColor} strokeWidth={w * 0.8} fill="white" />
    <circle cx={triBaseLeft + (triBaseRight - triBaseLeft) * 0.7} cy={rollerY} r={rollerR}
      stroke={strokeColor} strokeWidth={w * 0.8} fill="white" />
    {/* Ground line + hatching below */}
    <line x1={cx} y1={groundY} x2={cx + pw} y2={groundY} stroke={strokeColor} strokeWidth={w} />
    {hatchLines(cx, groundY, cx + pw, groundY, "below", strokeColor, w * 0.6)}
    <ShapeLabel shape={p.shape} scale={p.scale} bboxInScreen={{ x: cx, y: cy, w: pw, h: ph }} />
  </>);
}

/** Pin support: triangle (with top on object) + ground line with hatching. */
function RenderSupportPin(p: ShapeRenderProps) {
  const { cx, cy, pw, ph } = p;
  const w = sw(p);
  const strokeColor = stroke(p);
  const topY = cy;
  const baseY = cy + ph * 0.75;
  const triMidX = cx + pw / 2;
  const triBaseLeft = cx + pw * 0.2, triBaseRight = cx + pw * 0.8;
  return wrap(p, <>
    {/* Triangle with pin dot at top */}
    <polygon points={`${triMidX},${topY} ${triBaseLeft},${baseY} ${triBaseRight},${baseY}`}
      stroke={strokeColor} strokeWidth={w} fill="white" strokeLinejoin="round" />
    <circle cx={triMidX} cy={topY} r={Math.max(1.5, w * 0.8)} fill={strokeColor} />
    {/* Ground line + hatching */}
    <line x1={cx} y1={baseY} x2={cx + pw} y2={baseY} stroke={strokeColor} strokeWidth={w} />
    {hatchLines(cx, baseY, cx + pw, baseY, "below", strokeColor, w * 0.6)}
    <ShapeLabel shape={p.shape} scale={p.scale} bboxInScreen={{ x: cx, y: cy, w: pw, h: ph }} />
  </>);
}

/**
 * Shared 45° hatching generator (for wall/ground/fixed surfaces).
 * Hatches appear on the given side of a main edge.
 */
function hatchLines(
  edgeX1: number, edgeY1: number, edgeX2: number, edgeY2: number,
  side: "above" | "below" | "left" | "right",
  color: string, strokeW: number,
): React.ReactNode[] {
  const dx = edgeX2 - edgeX1, dy = edgeY2 - edgeY1;
  const edgeLen = Math.sqrt(dx * dx + dy * dy);
  if (edgeLen <= 0) return [];
  const hatchSpacing = 8;   // px between hatch lines
  const hatchDepth = 6;     // px length of each hatch
  const count = Math.max(3, Math.floor(edgeLen / hatchSpacing));
  const lines: React.ReactNode[] = [];
  // Unit vector along edge
  const ux = dx / edgeLen, uy = dy / edgeLen;
  // Normal vector (pointing to hatch side)
  let nx = 0, ny = 0;
  if (side === "above") { nx = 0; ny = -1; }
  else if (side === "below") { nx = 0; ny = 1; }
  else if (side === "left")  { nx = -1; ny = 0; }
  else                       { nx = 1; ny = 0; }
  // Hatch at 45° relative to edge — add tangent component along edge
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const bx = edgeX1 + dx * t;
    const by = edgeY1 + dy * t;
    // Hatch endpoint: move along normal + along edge direction (45° appearance)
    const ex = bx + (nx * hatchDepth + ux * hatchDepth) * 0.707;
    const ey = by + (ny * hatchDepth + uy * hatchDepth) * 0.707;
    lines.push(
      <line key={i} x1={bx} y1={by} x2={ex} y2={ey}
        stroke={color} strokeWidth={strokeW} opacity={0.9} />
    );
  }
  return lines;
}

function RenderWall(p: ShapeRenderProps) {
  // Vertical fixed wall: solid edge on the right side (where things attach),
  // hatching on the left (back side).
  const { cx, cy, pw, ph } = p;
  const w = sw(p);
  const color = stroke(p);
  const edgeX = cx + pw; // the attachment edge (right)
  return wrap(p, <>
    {/* Solid attachment edge */}
    <line x1={edgeX} y1={cy} x2={edgeX} y2={cy + ph} stroke={color} strokeWidth={w * 1.2} />
    {/* Hatching on the back (left side of the edge) */}
    {hatchLines(edgeX, cy + ph, edgeX, cy, "left", color, w * 0.7)}
    <ShapeLabel shape={p.shape} scale={p.scale} bboxInScreen={{ x: cx, y: cy, w: pw, h: ph }} />
  </>);
}

function RenderGroundHatch(p: ShapeRenderProps) {
  // Horizontal ground line with hatching below
  const { cx, cy, pw, ph } = p;
  const w = sw(p);
  const color = stroke(p);
  const edgeY = cy; // top edge (where objects sit)
  return wrap(p, <>
    {/* Solid ground line */}
    <line x1={cx} y1={edgeY} x2={cx + pw} y2={edgeY} stroke={color} strokeWidth={w * 1.2} />
    {/* Hatching below */}
    {hatchLines(cx, edgeY, cx + pw, edgeY, "below", color, w * 0.7)}
    <ShapeLabel shape={p.shape} scale={p.scale} bboxInScreen={{ x: cx, y: cy, w: pw, h: ph }} />
  </>);
}

// ══════════════════════════════════════════════════════════════════
//  CS / FLOWCHART
// ══════════════════════════════════════════════════════════════════

/**
 * Render the shape's label with math rendering if enabled.
 * Returns empty string if no label — the caller decides whether to show a fallback.
 */
function maybeMath(s: FigureShape): string {
  if (!s.label) return "";
  return s.labelMathMode ? renderMathPlaceholder(s.label) : s.label;
}

function RenderFlowchartDecision(p: ShapeRenderProps) {
  const midX = p.cx + p.pw / 2, midY = p.cy + p.ph / 2;
  const pts = `${midX},${p.cy} ${p.cx + p.pw},${midY} ${midX},${p.cy + p.ph} ${p.cx},${midY}`;
  return wrap(p, <>
    <polygon points={pts} stroke={stroke(p)} strokeWidth={sw(p)} fill={fill(p)} fillOpacity={fillOp(p)} />
    <text x={midX} y={midY} textAnchor="middle" dominantBaseline="central"
      fontSize={fs(p)} fill={stroke(p)} pointerEvents="none">{maybeMath(p.shape)}</text>
  </>);
}

function RenderFlowchartTerminal(p: ShapeRenderProps) {
  return wrap(p, <>
    <rect x={p.cx} y={p.cy} width={p.pw} height={p.ph} rx={p.ph / 2}
      stroke={stroke(p)} strokeWidth={sw(p)} fill={fill(p)} fillOpacity={fillOp(p)} />
    <text x={p.cx + p.pw / 2} y={p.cy + p.ph / 2} textAnchor="middle" dominantBaseline="central"
      fontSize={fs(p)} fill={stroke(p)} pointerEvents="none">{maybeMath(p.shape)}</text>
  </>);
}

function RenderAutomatonState(p: ShapeRenderProps) {
  const r = Math.min(p.pw, p.ph) / 2;
  const cx = p.cx + p.pw / 2, cy = p.cy + p.ph / 2;
  return wrap(p, <>
    <circle cx={cx} cy={cy} r={r} stroke={stroke(p)} strokeWidth={sw(p)} fill={fill(p)} fillOpacity={fillOp(p)} />
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
      fontSize={fs(p)} fill={stroke(p)} pointerEvents="none">{maybeMath(p.shape)}</text>
  </>);
}

function RenderAutomatonAccept(p: ShapeRenderProps) {
  const r = Math.min(p.pw, p.ph) / 2;
  const cx = p.cx + p.pw / 2, cy = p.cy + p.ph / 2;
  return wrap(p, <>
    <circle cx={cx} cy={cy} r={r} stroke={stroke(p)} strokeWidth={sw(p)} fill={fill(p)} fillOpacity={fillOp(p)} />
    <circle cx={cx} cy={cy} r={r * 0.78} stroke={stroke(p)} strokeWidth={sw(p)} fill="none" />
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
      fontSize={fs(p)} fill={stroke(p)} pointerEvents="none">{maybeMath(p.shape)}</text>
  </>);
}

// ══════════════════════════════════════════════════════════════════
//  PHYSICS — real SVG renderings for lenses, waves, prisms, mirrors
// ══════════════════════════════════════════════════════════════════

function RenderLensConvex(p: ShapeRenderProps) {
  const { cx, cy, pw, ph } = p;
  const w = sw(p);
  const midX = cx + pw / 2;
  const top = cy, bot = cy + ph;
  // Two outward-bulging arcs → biconvex lens shape
  const bulge = pw * 0.35;
  const d = `M ${midX} ${top} Q ${midX + bulge} ${cy + ph / 2}, ${midX} ${bot} Q ${midX - bulge} ${cy + ph / 2}, ${midX} ${top} Z`;
  return wrap(p, <>
    <path d={d} stroke={stroke(p)} strokeWidth={w} fill={fill(p) === "transparent" ? "rgba(135,206,250,0.15)" : fill(p)} fillOpacity={fillOp(p)} />
    {/* Optical axis dashed */}
    <line x1={cx - pw * 0.2} y1={cy + ph / 2} x2={cx + pw * 1.2} y2={cy + ph / 2}
      stroke={stroke(p)} strokeWidth={w * 0.4} strokeDasharray="4,3" opacity={0.4} />
    <ShapeLabel shape={p.shape} scale={p.scale} bboxInScreen={{ x: cx, y: cy, w: pw, h: ph }} />
  </>);
}

function RenderLensConcave(p: ShapeRenderProps) {
  const { cx, cy, pw, ph } = p;
  const w = sw(p);
  const midX = cx + pw / 2;
  const top = cy, bot = cy + ph;
  const bulge = pw * 0.35;
  // Concave: curves go INWARD (toward midX)
  const d = `M ${midX - bulge} ${top} Q ${midX} ${cy + ph / 2}, ${midX - bulge} ${bot} L ${midX + bulge} ${bot} Q ${midX} ${cy + ph / 2}, ${midX + bulge} ${top} Z`;
  return wrap(p, <>
    <path d={d} stroke={stroke(p)} strokeWidth={w} fill={fill(p) === "transparent" ? "rgba(135,206,250,0.15)" : fill(p)} fillOpacity={fillOp(p)} />
    <line x1={cx - pw * 0.2} y1={cy + ph / 2} x2={cx + pw * 1.2} y2={cy + ph / 2}
      stroke={stroke(p)} strokeWidth={w * 0.4} strokeDasharray="4,3" opacity={0.4} />
    <ShapeLabel shape={p.shape} scale={p.scale} bboxInScreen={{ x: cx, y: cy, w: pw, h: ph }} />
  </>);
}

function RenderPrism(p: ShapeRenderProps) {
  const { cx, cy, pw, ph } = p;
  const w = sw(p);
  // Equilateral-ish triangle pointing up
  const pts = `${cx + pw / 2},${cy} ${cx},${cy + ph} ${cx + pw},${cy + ph}`;
  return wrap(p, <>
    <polygon points={pts} stroke={stroke(p)} strokeWidth={w}
      fill={fill(p) === "transparent" ? "rgba(147,197,253,0.2)" : fill(p)}
      fillOpacity={fillOp(p)} strokeLinejoin="round" />
    <ShapeLabel shape={p.shape} scale={p.scale} bboxInScreen={{ x: cx, y: cy, w: pw, h: ph }} />
  </>);
}

function RenderWave(p: ShapeRenderProps) {
  const { cx, cy, pw, ph } = p;
  const w = sw(p);
  const midY = cy + ph / 2;
  const amp = ph * 0.4;
  // Smooth sine wave over 2 periods
  const periods = 2;
  const samples = 40;
  let d = `M ${cx} ${midY}`;
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const x = cx + pw * t;
    const y = midY - amp * Math.sin(t * Math.PI * 2 * periods);
    d += ` L ${x} ${y}`;
  }
  return wrap(p, <>
    <path d={d} stroke={stroke(p)} strokeWidth={w} fill="none" strokeLinecap="round" />
    <ShapeLabel shape={p.shape} scale={p.scale} bboxInScreen={{ x: cx, y: cy, w: pw, h: ph }} />
  </>);
}

function RenderVectorField(p: ShapeRenderProps) {
  const { cx, cy, pw, ph, shape } = p;
  const w = sw(p);
  const cols = 4, rows = 3;
  const arrowLen = Math.min(pw / cols, ph / rows) * 0.7;
  const arrows: React.ReactNode[] = [];
  const needArrow = needArrowEnd("vector-field", p.shape.style);
  const markerId = `arrow-${shape.id}-end`;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = cx + pw * (i + 0.5) / cols;
      const y = cy + ph * (j + 0.5) / rows;
      arrows.push(
        <line key={`${i}-${j}`} x1={x - arrowLen / 2} y1={y} x2={x + arrowLen / 2} y2={y}
          stroke={stroke(p)} strokeWidth={w * 0.7}
          markerEnd={needArrow ? `url(#${markerId})` : undefined} />
      );
    }
  }
  return wrap(p, <>
    {arrows}
    <ShapeLabel shape={p.shape} scale={p.scale} bboxInScreen={{ x: cx, y: cy, w: pw, h: ph }} />
  </>);
}

function RenderMirror(p: ShapeRenderProps, concave: boolean) {
  const { cx, cy, pw, ph } = p;
  const w = sw(p);
  const midY = cy + ph / 2;
  const bulge = pw * 0.25;
  // Concave mirror: curves toward its focal side (left); convex curves away
  const controlX = concave ? cx + bulge : cx - bulge;
  const d = `M ${cx} ${cy} Q ${controlX} ${midY}, ${cx} ${cy + ph}`;
  // Hatching on the "back" side to indicate silvering
  const hatchSide = concave ? -1 : 1;
  const hatches: React.ReactNode[] = [];
  const hatchCount = Math.max(3, Math.floor(ph / 8));
  for (let i = 0; i < hatchCount; i++) {
    const y = cy + ph * (i + 0.5) / hatchCount;
    // Approximate x on curve at this y
    const t = (y - cy) / ph;
    const curveX = cx + bulge * Math.sin(Math.PI * t) * (concave ? 1 : -1);
    hatches.push(
      <line key={i} x1={curveX} y1={y} x2={curveX + hatchSide * 5} y2={y - 5}
        stroke={stroke(p)} strokeWidth={w * 0.5} opacity={0.6} />
    );
  }
  return wrap(p, <>
    <path d={d} stroke={stroke(p)} strokeWidth={w * 1.3} fill="none" strokeLinecap="round" />
    {hatches}
    <ShapeLabel shape={p.shape} scale={p.scale} bboxInScreen={{ x: cx, y: cy, w: pw, h: ph }} />
  </>);
}

// ══════════════════════════════════════════════════════════════════
//  CHEMISTRY
// ══════════════════════════════════════════════════════════════════

function RenderBenzene(p: ShapeRenderProps) {
  const r = Math.min(p.pw, p.ph) / 2;
  const midX = p.cx + p.pw / 2, midY = p.cy + p.ph / 2;
  const hex = Array.from({ length: 6 }, (_, i) => {
    const a = (-Math.PI / 2) + (i * Math.PI * 2) / 6;
    return `${midX + r * Math.cos(a)},${midY + r * Math.sin(a)}`;
  }).join(" ");
  return wrap(p, <>
    <polygon points={hex} stroke={stroke(p)} strokeWidth={sw(p)} fill="transparent" />
    <circle cx={midX} cy={midY} r={r * 0.55} stroke={stroke(p)} strokeWidth={sw(p) * 0.7} fill="none" />
  </>);
}

// ══════════════════════════════════════════════════════════════════
//  Generic domain placeholder (for shapes without custom SVG)
// ══════════════════════════════════════════════════════════════════

function RenderGenericDomain(p: ShapeRenderProps, kindLabel: string) {
  const w = sw(p);
  return wrap(p, <>
    <rect x={p.cx} y={p.cy} width={p.pw} height={p.ph} rx={3}
      stroke={stroke(p)} strokeWidth={w} fill="#f0f9ff" fillOpacity={0.3} strokeDasharray={`${w * 3},${w * 2}`} />
    <text x={p.cx + p.pw / 2} y={p.cy + p.ph / 2}
      textAnchor="middle" dominantBaseline="central" fontSize={9} fill="#6b7280" pointerEvents="none" fontWeight="500">
      {kindLabel}
    </text>
    <ShapeLabel shape={p.shape} scale={p.scale} bboxInScreen={{ x: p.cx, y: p.cy, w: p.pw, h: p.ph }} />
  </>);
}

// ══════════════════════════════════════════════════════════════════
//  MAIN DISPATCHER
// ══════════════════════════════════════════════════════════════════

export function ShapeRenderer(p: ShapeRenderProps) {
  switch (p.shape.kind) {
    // Basic
    case "rect": return <RenderRect {...p} />;
    case "circle": return <RenderCircle {...p} />;
    case "ellipse": return <RenderEllipse {...p} />;
    case "line": case "polyline": case "arrow": case "force-arrow": case "vector":
    case "reaction-arrow": case "bond-single": case "bond-double": case "bond-triple":
      return <RenderLine {...p} />;
    case "polygon": return <RenderPolygon {...p} />;
    case "prism": return <RenderPrism {...p} />;
    case "text": return <RenderText {...p} />;
    case "freehand": return <RenderFreehand {...p} />;
    case "arc": return <RenderCircle {...p} />;

    // Circuit
    case "resistor": return <RenderResistor {...p} />;
    case "capacitor": return <RenderCapacitor {...p} />;
    case "inductor": return <RenderInductor {...p} />;
    case "voltage-source": return <RenderVoltageSource {...p} />;
    case "current-source": return <RenderCurrentSource {...p} />;
    case "ground": return <RenderGround {...p} />;
    case "switch": return <RenderSwitch {...p} />;
    case "diode": return <RenderDiode {...p} />;
    case "led": return <RenderLED {...p} />;
    case "transistor-npn": return RenderTransistor(p, true);
    case "transistor-pnp": return RenderTransistor(p, false);
    case "opamp": return <RenderOpAmp {...p} />;

    // Mechanics
    case "spring": return <RenderSpring {...p} />;
    case "mass": return <RenderMass {...p} />;
    case "pulley": return <RenderPulley {...p} />;
    case "support-pin": return <RenderSupportPin {...p} />;
    case "support-roller": return <RenderSupportRoller {...p} />;
    case "moment": return <RenderMoment {...p} />;
    case "damper": return <RenderDamper {...p} />;
    case "wall": return <RenderWall {...p} />;
    case "ground-hatch": return <RenderGroundHatch {...p} />;

    // Physics
    case "wave": return <RenderWave {...p} />;
    case "lens-convex": return <RenderLensConvex {...p} />;
    case "lens-concave": return <RenderLensConcave {...p} />;
    case "vector-field": return <RenderVectorField {...p} />;
    case "mirror-concave": return RenderMirror(p, true);
    case "mirror-convex": return RenderMirror(p, false);

    // Math
    case "axes": return RenderGenericDomain(p, "Axes");
    case "angle-arc": return RenderGenericDomain(p, "Angle");
    case "right-angle": return RenderGenericDomain(p, "90deg");
    case "function-plot": return RenderGenericDomain(p, "f(x)");
    case "brace": return RenderGenericDomain(p, "Brace");

    // CS
    case "flowchart-process": return <RenderRect {...p} />;
    case "flowchart-decision": return <RenderFlowchartDecision {...p} />;
    case "flowchart-io": return <RenderRect {...p} />;
    case "flowchart-terminal": return <RenderFlowchartTerminal {...p} />;
    case "automaton-state": return <RenderAutomatonState {...p} />;
    case "automaton-accept": return <RenderAutomatonAccept {...p} />;

    // Chemistry
    case "benzene": return <RenderBenzene {...p} />;
    case "orbital-s": return <RenderCircle {...p} />;
    case "orbital-p": return <RenderEllipse {...p} />;

    // Biology
    case "cell": return <RenderEllipse {...p} />;
    case "nucleus": return <RenderCircle {...p} />;
    case "mitochondria": return <RenderEllipse {...p} />;
    case "membrane": return RenderGenericDomain(p, "Membrane");
    case "neuron": return RenderGenericDomain(p, "Neuron");
    case "synapse": return RenderGenericDomain(p, "Synapse");

    default: return RenderGenericDomain(p, p.shape.kind);
  }
}
