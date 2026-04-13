"use client";

/**
 * SVG renderers for each shape kind (v2 — proper proportions).
 *
 * IMPORTANT: `scale` (px per cm) is used ONLY for position/dimension transforms.
 * Line widths and font sizes use FIXED pixel values that don't blow up with zoom.
 */

import React from "react";
import type { FigureShape, Point } from "./types";

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

function dashArray(dashed: boolean, swPx: number): string | undefined {
  return dashed ? `${swPx * 4},${swPx * 3}` : undefined;
}

function arrowMarkerId(shapeId: string, end: "start" | "end"): string {
  return `arrow-${shapeId}-${end}`;
}

export function ArrowDefs({ shape, scale }: { shape: FigureShape; scale: number }) {
  const defs: React.ReactNode[] = [];
  const color = shape.style.stroke;
  const zoom = scale / 50; // approximate zoom from scale
  const size = Math.max(5, Math.min(10, lineW(shape.style.strokeWidth, zoom) * 4));

  const needEnd = shape.style.arrowEnd || shape.kind === "arrow" || shape.kind === "force-arrow" || shape.kind === "vector" || shape.kind === "reaction-arrow";
  if (needEnd) {
    defs.push(
      <marker key={`${shape.id}-end`} id={arrowMarkerId(shape.id, "end")}
        markerWidth={size} markerHeight={size} refX={size - 1} refY={size / 2} orient="auto">
        <path d={`M0,0 L${size},${size / 2} L0,${size} Z`} fill={color} />
      </marker>
    );
  }
  if (shape.style.arrowStart) {
    defs.push(
      <marker key={`${shape.id}-start`} id={arrowMarkerId(shape.id, "start")}
        markerWidth={size} markerHeight={size} refX={1} refY={size / 2} orient="auto">
        <path d={`M${size},0 L0,${size / 2} L${size},${size} Z`} fill={color} />
      </marker>
    );
  }
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

function stroke(props: ShapeRenderProps) { return props.shape.style.stroke; }
function fill(props: ShapeRenderProps) {
  return props.shape.style.fill === "none" ? "transparent" : props.shape.style.fill;
}
function fillOp(props: ShapeRenderProps) { return props.shape.style.fillOpacity; }
function dash(props: ShapeRenderProps) { return dashArray(props.shape.style.dashed, sw(props)); }

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

function needArrowEnd(kind: string, style: { arrowEnd: boolean }) {
  return style.arrowEnd || ["arrow", "force-arrow", "vector", "reaction-arrow"].includes(kind);
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
    {p.shape.label && <text x={p.cx + p.pw / 2} y={p.cy + p.ph / 2} textAnchor="middle" dominantBaseline="central"
      fontSize={fs(p)} fill={stroke(p)} pointerEvents="none">{p.shape.label}</text>}
  </>);
}

function RenderCircle(p: ShapeRenderProps) {
  const r = Math.min(p.pw, p.ph) / 2;
  const cx = p.cx + p.pw / 2, cy = p.cy + p.ph / 2;
  return wrap(p, <>
    <circle cx={cx} cy={cy} r={r} stroke={stroke(p)} strokeWidth={sw(p)} fill={fill(p)} fillOpacity={fillOp(p)} strokeDasharray={dash(p)} />
    {p.shape.label && <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
      fontSize={fs(p)} fill={stroke(p)} pointerEvents="none">{p.shape.label}</text>}
  </>);
}

function RenderEllipse(p: ShapeRenderProps) {
  const cx = p.cx + p.pw / 2, cy = p.cy + p.ph / 2;
  return wrap(p, <>
    <ellipse cx={cx} cy={cy} rx={p.pw / 2} ry={p.ph / 2}
      stroke={stroke(p)} strokeWidth={sw(p)} fill={fill(p)} fillOpacity={fillOp(p)} strokeDasharray={dash(p)} />
    {p.shape.label && <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
      fontSize={fs(p)} fill={stroke(p)} pointerEvents="none">{p.shape.label}</text>}
  </>);
}

function RenderLine(p: ShapeRenderProps) {
  const pts = p.pxPoints.length >= 2 ? p.pxPoints : [{ x: 0, y: 0 }, { x: p.pw, y: 0 }];
  const d = pts.map((pt, i) => `${i === 0 ? "M" : "L"}${p.cx + pt.x},${p.cy + pt.y}`).join(" ");
  const w = sw(p);
  const hasEnd = needArrowEnd(p.shape.kind, p.shape.style);
  return wrap(p, <>
    <path d={d} stroke="transparent" strokeWidth={Math.max(8, w * 4)} fill="none" />
    <path d={d} stroke={stroke(p)} strokeWidth={w} fill="none" strokeDasharray={dash(p)}
      markerEnd={hasEnd ? `url(#${arrowMarkerId(p.shape.id, "end")})` : undefined}
      markerStart={p.shape.style.arrowStart ? `url(#${arrowMarkerId(p.shape.id, "start")})` : undefined}
      strokeLinecap="round" />
    {p.shape.label && pts.length >= 2 && (
      <text x={(p.cx + pts[0].x + p.cx + pts[pts.length - 1].x) / 2}
        y={(p.cy + pts[0].y + p.cy + pts[pts.length - 1].y) / 2 - 6}
        textAnchor="middle" fontSize={fs(p)} fill={stroke(p)} pointerEvents="none">{p.shape.label}</text>
    )}
  </>);
}

function RenderPolygon(p: ShapeRenderProps) {
  const pts = p.pxPoints.length >= 3 ? p.pxPoints : [{ x: p.pw / 2, y: 0 }, { x: 0, y: p.ph }, { x: p.pw, y: p.ph }];
  const points = pts.map((pt) => `${p.cx + pt.x},${p.cy + pt.y}`).join(" ");
  return wrap(p, <>
    <polygon points={points} stroke={stroke(p)} strokeWidth={sw(p)} fill={fill(p)} fillOpacity={fillOp(p)} strokeDasharray={dash(p)} />
    {p.shape.label && <text x={p.cx + p.pw / 2} y={p.cy + p.ph / 2} textAnchor="middle" dominantBaseline="central"
      fontSize={fs(p)} fill={stroke(p)} pointerEvents="none">{p.shape.label}</text>}
  </>);
}

function RenderText(p: ShapeRenderProps) {
  return wrap(p, <>
    <rect x={p.cx} y={p.cy} width={Math.max(p.pw, 30)} height={Math.max(p.ph, 16)} fill="transparent" stroke="none" />
    <text x={p.cx + p.pw / 2} y={p.cy + p.ph / 2} textAnchor="middle" dominantBaseline="central"
      fontSize={fs(p) * 1.2} fill={stroke(p)} fontFamily="serif" style={{ userSelect: "none" }}>
      {p.shape.label || "Text"}
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
// ══════════════════════════════════════════════════════════════════

function RenderResistor(p: ShapeRenderProps) {
  const { cx, cy, pw, ph } = p;
  const w = sw(p);
  const midY = cy + ph / 2;
  // Leads
  const leadL = pw * 0.15;
  const bodyStart = cx + leadL;
  const bodyEnd = cx + pw - leadL;
  const bodyW = bodyEnd - bodyStart;
  // Zigzag: 6 peaks
  const peaks = 6;
  const segW = bodyW / peaks;
  const amp = Math.min(ph * 0.35, 8); // amplitude in px, capped

  let d = `M${cx},${midY} L${bodyStart},${midY}`;
  for (let i = 0; i < peaks; i++) {
    const xMid = bodyStart + (i + 0.5) * segW;
    const yDir = i % 2 === 0 ? -1 : 1;
    d += ` L${xMid},${midY + yDir * amp}`;
  }
  d += ` L${bodyEnd},${midY} L${cx + pw},${midY}`;

  return wrap(p, <>
    <path d={d} stroke={stroke(p)} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    {/* Lead dots */}
    <circle cx={cx} cy={midY} r={1.5} fill={stroke(p)} />
    <circle cx={cx + pw} cy={midY} r={1.5} fill={stroke(p)} />
    {p.shape.label && <text x={cx + pw / 2} y={cy + 2} textAnchor="middle" fontSize={fs(p) * 0.85}
      fill={stroke(p)} pointerEvents="none">{p.shape.label}</text>}
  </>);
}

function RenderCapacitor(p: ShapeRenderProps) {
  const { cx, cy, pw, ph } = p;
  const w = sw(p);
  const midX = cx + pw / 2;
  const midY = cy + ph / 2;
  const gap = Math.max(3, pw * 0.06); // gap between plates
  const plateH = ph * 0.65;

  return wrap(p, <>
    {/* Left lead */}
    <line x1={cx} y1={midY} x2={midX - gap} y2={midY} stroke={stroke(p)} strokeWidth={w} />
    {/* Left plate */}
    <line x1={midX - gap} y1={midY - plateH / 2} x2={midX - gap} y2={midY + plateH / 2}
      stroke={stroke(p)} strokeWidth={w * 1.8} strokeLinecap="round" />
    {/* Right plate */}
    <line x1={midX + gap} y1={midY - plateH / 2} x2={midX + gap} y2={midY + plateH / 2}
      stroke={stroke(p)} strokeWidth={w * 1.8} strokeLinecap="round" />
    {/* Right lead */}
    <line x1={midX + gap} y1={midY} x2={cx + pw} y2={midY} stroke={stroke(p)} strokeWidth={w} />
    {/* Lead dots */}
    <circle cx={cx} cy={midY} r={1.5} fill={stroke(p)} />
    <circle cx={cx + pw} cy={midY} r={1.5} fill={stroke(p)} />
    {p.shape.label && <text x={midX} y={cy + 2} textAnchor="middle" fontSize={fs(p) * 0.85}
      fill={stroke(p)} pointerEvents="none">{p.shape.label}</text>}
  </>);
}

function RenderInductor(p: ShapeRenderProps) {
  const { cx, cy, pw, ph } = p;
  const w = sw(p);
  const midY = cy + ph / 2;
  const leadL = pw * 0.12;
  const bodyStart = cx + leadL;
  const bodyEnd = cx + pw - leadL;
  const coils = 4;
  const coilW = (bodyEnd - bodyStart) / coils;
  const r = coilW / 2;

  let d = `M${cx},${midY} L${bodyStart},${midY}`;
  for (let i = 0; i < coils; i++) {
    const sx = bodyStart + i * coilW;
    // Semi-circle bump upward
    d += ` A${r},${r} 0 1,1 ${sx + coilW},${midY}`;
  }
  d += ` L${cx + pw},${midY}`;

  return wrap(p, <>
    <path d={d} stroke={stroke(p)} strokeWidth={w} fill="none" />
    <circle cx={cx} cy={midY} r={1.5} fill={stroke(p)} />
    <circle cx={cx + pw} cy={midY} r={1.5} fill={stroke(p)} />
    {p.shape.label && <text x={cx + pw / 2} y={cy + 2} textAnchor="middle" fontSize={fs(p) * 0.85}
      fill={stroke(p)} pointerEvents="none">{p.shape.label}</text>}
  </>);
}

function RenderVoltageSource(p: ShapeRenderProps) {
  const { cx, cy, pw, ph } = p;
  const w = sw(p);
  const r = Math.min(pw, ph) / 2;
  const midX = cx + pw / 2, midY = cy + ph / 2;
  const symbolSize = Math.max(6, r * 0.35);

  return wrap(p, <>
    <circle cx={midX} cy={midY} r={r} stroke={stroke(p)} strokeWidth={w} fill="transparent" />
    {/* + sign */}
    <line x1={midX - symbolSize / 2} y1={midY - r * 0.35} x2={midX + symbolSize / 2} y2={midY - r * 0.35} stroke={stroke(p)} strokeWidth={w} />
    <line x1={midX} y1={midY - r * 0.35 - symbolSize / 2} x2={midX} y2={midY - r * 0.35 + symbolSize / 2} stroke={stroke(p)} strokeWidth={w} />
    {/* - sign */}
    <line x1={midX - symbolSize / 2} y1={midY + r * 0.35} x2={midX + symbolSize / 2} y2={midY + r * 0.35} stroke={stroke(p)} strokeWidth={w} />
    {/* Leads */}
    <line x1={midX} y1={cy} x2={midX} y2={midY - r} stroke={stroke(p)} strokeWidth={w} />
    <line x1={midX} y1={midY + r} x2={midX} y2={cy + ph} stroke={stroke(p)} strokeWidth={w} />
    <circle cx={midX} cy={cy} r={1.5} fill={stroke(p)} />
    <circle cx={midX} cy={cy + ph} r={1.5} fill={stroke(p)} />
    {p.shape.label && <text x={midX + r + 4} y={midY} textAnchor="start" dominantBaseline="central"
      fontSize={fs(p) * 0.85} fill={stroke(p)} pointerEvents="none">{p.shape.label}</text>}
  </>);
}

function RenderCurrentSource(p: ShapeRenderProps) {
  const { cx, cy, pw, ph } = p;
  const w = sw(p);
  const r = Math.min(pw, ph) / 2;
  const midX = cx + pw / 2, midY = cy + ph / 2;
  const arrLen = r * 0.5;

  return wrap(p, <>
    <circle cx={midX} cy={midY} r={r} stroke={stroke(p)} strokeWidth={w} fill="transparent" />
    {/* Arrow inside */}
    <line x1={midX} y1={midY + arrLen} x2={midX} y2={midY - arrLen} stroke={stroke(p)} strokeWidth={w} />
    <path d={`M${midX - 3},${midY - arrLen + 4} L${midX},${midY - arrLen} L${midX + 3},${midY - arrLen + 4}`}
      stroke={stroke(p)} strokeWidth={w} fill="none" />
    {/* Leads */}
    <line x1={midX} y1={cy} x2={midX} y2={midY - r} stroke={stroke(p)} strokeWidth={w} />
    <line x1={midX} y1={midY + r} x2={midX} y2={cy + ph} stroke={stroke(p)} strokeWidth={w} />
    <circle cx={midX} cy={cy} r={1.5} fill={stroke(p)} />
    <circle cx={midX} cy={cy + ph} r={1.5} fill={stroke(p)} />
    {p.shape.label && <text x={midX + r + 4} y={midY} textAnchor="start" dominantBaseline="central"
      fontSize={fs(p) * 0.85} fill={stroke(p)} pointerEvents="none">{p.shape.label}</text>}
  </>);
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
  const { cx, cy, pw, ph } = p;
  const w = sw(p);
  const midY = cy + ph / 2;
  const dotR = 2.5;

  return wrap(p, <>
    {/* Left lead */}
    <line x1={cx} y1={midY} x2={cx + pw * 0.3} y2={midY} stroke={stroke(p)} strokeWidth={w} />
    {/* Left contact dot */}
    <circle cx={cx + pw * 0.3} cy={midY} r={dotR} fill={stroke(p)} />
    {/* Switch arm (open) */}
    <line x1={cx + pw * 0.3} y1={midY} x2={cx + pw * 0.65} y2={midY - ph * 0.4}
      stroke={stroke(p)} strokeWidth={w} strokeLinecap="round" />
    {/* Right contact dot */}
    <circle cx={cx + pw * 0.7} cy={midY} r={dotR} fill={stroke(p)} />
    {/* Right lead */}
    <line x1={cx + pw * 0.7} y1={midY} x2={cx + pw} y2={midY} stroke={stroke(p)} strokeWidth={w} />
    <circle cx={cx} cy={midY} r={1.5} fill={stroke(p)} />
    <circle cx={cx + pw} cy={midY} r={1.5} fill={stroke(p)} />
    {p.shape.label && <text x={cx + pw / 2} y={cy + 2} textAnchor="middle" fontSize={fs(p) * 0.85}
      fill={stroke(p)} pointerEvents="none">{p.shape.label}</text>}
  </>);
}

function RenderDiode(p: ShapeRenderProps) {
  const { cx, cy, pw, ph } = p;
  const w = sw(p);
  const midX = cx + pw / 2, midY = cy + ph / 2;
  const triW = pw * 0.2, triH = ph * 0.5;

  return wrap(p, <>
    <line x1={cx} y1={midY} x2={midX - triW} y2={midY} stroke={stroke(p)} strokeWidth={w} />
    {/* Triangle */}
    <polygon points={`${midX - triW},${midY - triH / 2} ${midX - triW},${midY + triH / 2} ${midX + triW},${midY}`}
      stroke={stroke(p)} strokeWidth={w} fill="transparent" strokeLinejoin="round" />
    {/* Bar */}
    <line x1={midX + triW} y1={midY - triH / 2} x2={midX + triW} y2={midY + triH / 2} stroke={stroke(p)} strokeWidth={w * 1.3} />
    <line x1={midX + triW} y1={midY} x2={cx + pw} y2={midY} stroke={stroke(p)} strokeWidth={w} />
    <circle cx={cx} cy={midY} r={1.5} fill={stroke(p)} />
    <circle cx={cx + pw} cy={midY} r={1.5} fill={stroke(p)} />
    {p.shape.label && <text x={midX} y={cy + 2} textAnchor="middle" fontSize={fs(p) * 0.85}
      fill={stroke(p)} pointerEvents="none">{p.shape.label}</text>}
  </>);
}

function RenderLED(p: ShapeRenderProps) {
  const { cx, cy, pw, ph } = p;
  const w = sw(p);
  const midX = cx + pw / 2, midY = cy + ph / 2;
  const triW = pw * 0.2, triH = ph * 0.5;

  return wrap(p, <>
    <line x1={cx} y1={midY} x2={midX - triW} y2={midY} stroke={stroke(p)} strokeWidth={w} />
    <polygon points={`${midX - triW},${midY - triH / 2} ${midX - triW},${midY + triH / 2} ${midX + triW},${midY}`}
      stroke={stroke(p)} strokeWidth={w} fill="transparent" strokeLinejoin="round" />
    <line x1={midX + triW} y1={midY - triH / 2} x2={midX + triW} y2={midY + triH / 2} stroke={stroke(p)} strokeWidth={w * 1.3} />
    <line x1={midX + triW} y1={midY} x2={cx + pw} y2={midY} stroke={stroke(p)} strokeWidth={w} />
    {/* Light arrows */}
    <line x1={midX + triW * 0.5} y1={midY - triH * 0.6} x2={midX + triW * 1.2} y2={midY - triH * 0.9}
      stroke={stroke(p)} strokeWidth={w * 0.7} markerEnd={`url(#${arrowMarkerId(p.shape.id, "end")})`} />
    <line x1={midX + triW * 0.8} y1={midY - triH * 0.5} x2={midX + triW * 1.5} y2={midY - triH * 0.8}
      stroke={stroke(p)} strokeWidth={w * 0.7} />
    <circle cx={cx} cy={midY} r={1.5} fill={stroke(p)} />
    <circle cx={cx + pw} cy={midY} r={1.5} fill={stroke(p)} />
    {p.shape.label && <text x={midX} y={cy + 2} textAnchor="middle" fontSize={fs(p) * 0.85}
      fill={stroke(p)} pointerEvents="none">{p.shape.label}</text>}
  </>);
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
    {p.shape.label && <text x={cx + pw / 2} y={cy - 3} textAnchor="middle" fontSize={fs(p) * 0.85}
      fill={stroke(p)} pointerEvents="none">{p.shape.label}</text>}
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
    {p.shape.label && <text x={cx + pw / 2} y={cy - 3} textAnchor="middle" fontSize={fs(p) * 0.85}
      fill={stroke(p)} pointerEvents="none">{p.shape.label}</text>}
  </>);
}

// ══════════════════════════════════════════════════════════════════
//  MECHANICS
// ══════════════════════════════════════════════════════════════════

function RenderSpring(p: ShapeRenderProps) {
  const { cx, cy, pw, ph } = p;
  const w = sw(p);
  const midY = cy + ph / 2;
  const coils = 8;
  const amp = Math.min(ph * 0.35, 6);
  const leadL = pw * 0.08;
  const bodyS = cx + leadL, bodyE = cx + pw - leadL;
  const segW = (bodyE - bodyS) / coils;

  let d = `M${cx},${midY} L${bodyS},${midY}`;
  for (let i = 0; i < coils; i++) {
    const x = bodyS + (i + 0.5) * segW;
    d += ` L${x},${midY + (i % 2 === 0 ? -amp : amp)}`;
  }
  d += ` L${bodyE},${midY} L${cx + pw},${midY}`;

  return wrap(p, <>
    <path d={d} stroke={stroke(p)} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    {p.shape.label && <text x={cx + pw / 2} y={cy + 2} textAnchor="middle" fontSize={fs(p) * 0.85}
      fill={stroke(p)} pointerEvents="none">{p.shape.label}</text>}
  </>);
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
    <text x={p.cx + p.pw / 2} y={p.cy + p.ph / 2} textAnchor="middle" dominantBaseline="central"
      fontSize={fs(p)} fill={stroke(p)} pointerEvents="none" fontStyle="italic">{p.shape.label || "m"}</text>
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

// ══════════════════════════════════════════════════════════════════
//  CS / FLOWCHART
// ══════════════════════════════════════════════════════════════════

function RenderFlowchartDecision(p: ShapeRenderProps) {
  const midX = p.cx + p.pw / 2, midY = p.cy + p.ph / 2;
  const pts = `${midX},${p.cy} ${p.cx + p.pw},${midY} ${midX},${p.cy + p.ph} ${p.cx},${midY}`;
  return wrap(p, <>
    <polygon points={pts} stroke={stroke(p)} strokeWidth={sw(p)} fill={fill(p)} fillOpacity={fillOp(p)} />
    <text x={midX} y={midY} textAnchor="middle" dominantBaseline="central"
      fontSize={fs(p)} fill={stroke(p)} pointerEvents="none">{p.shape.label || "?"}</text>
  </>);
}

function RenderFlowchartTerminal(p: ShapeRenderProps) {
  return wrap(p, <>
    <rect x={p.cx} y={p.cy} width={p.pw} height={p.ph} rx={p.ph / 2}
      stroke={stroke(p)} strokeWidth={sw(p)} fill={fill(p)} fillOpacity={fillOp(p)} />
    <text x={p.cx + p.pw / 2} y={p.cy + p.ph / 2} textAnchor="middle" dominantBaseline="central"
      fontSize={fs(p)} fill={stroke(p)} pointerEvents="none">{p.shape.label || "Start"}</text>
  </>);
}

function RenderAutomatonState(p: ShapeRenderProps) {
  const r = Math.min(p.pw, p.ph) / 2;
  const cx = p.cx + p.pw / 2, cy = p.cy + p.ph / 2;
  return wrap(p, <>
    <circle cx={cx} cy={cy} r={r} stroke={stroke(p)} strokeWidth={sw(p)} fill={fill(p)} fillOpacity={fillOp(p)} />
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
      fontSize={fs(p)} fill={stroke(p)} pointerEvents="none">{p.shape.label || "q"}</text>
  </>);
}

function RenderAutomatonAccept(p: ShapeRenderProps) {
  const r = Math.min(p.pw, p.ph) / 2;
  const cx = p.cx + p.pw / 2, cy = p.cy + p.ph / 2;
  return wrap(p, <>
    <circle cx={cx} cy={cy} r={r} stroke={stroke(p)} strokeWidth={sw(p)} fill={fill(p)} fillOpacity={fillOp(p)} />
    <circle cx={cx} cy={cy} r={r * 0.78} stroke={stroke(p)} strokeWidth={sw(p)} fill="none" />
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
      fontSize={fs(p)} fill={stroke(p)} pointerEvents="none">{p.shape.label || "q"}</text>
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

function RenderGenericDomain(p: ShapeRenderProps, label: string) {
  const w = sw(p);
  return wrap(p, <>
    <rect x={p.cx} y={p.cy} width={p.pw} height={p.ph} rx={3}
      stroke={stroke(p)} strokeWidth={w} fill="#f0f9ff" fillOpacity={0.3} strokeDasharray={`${w * 3},${w * 2}`} />
    <text x={p.cx + p.pw / 2} y={p.cy + p.ph / 2 - (p.shape.label ? 5 : 0)}
      textAnchor="middle" dominantBaseline="central" fontSize={9} fill="#6b7280" pointerEvents="none" fontWeight="500">
      {label}
    </text>
    {p.shape.label && <text x={p.cx + p.pw / 2} y={p.cy + p.ph / 2 + 7}
      textAnchor="middle" dominantBaseline="central" fontSize={fs(p) * 0.85}
      fill={stroke(p)} pointerEvents="none">{p.shape.label}</text>}
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
    case "polygon": case "prism": return <RenderPolygon {...p} />;
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
    case "damper": return RenderGenericDomain(p, "Damper");
    case "support-pin": return RenderGenericDomain(p, "Pin");
    case "support-roller": return RenderGenericDomain(p, "Roller");
    case "moment": return RenderGenericDomain(p, "M");

    // Physics
    case "wave": return RenderGenericDomain(p, "~Wave~");
    case "lens-convex": return RenderGenericDomain(p, "Convex");
    case "lens-concave": return RenderGenericDomain(p, "Concave");
    case "vector-field": return RenderGenericDomain(p, "Field");

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
