"use client";

/**
 * SVG renderers for each shape kind.
 * Maps FigureShape -> SVG elements at screen-pixel coordinates.
 *
 * Convention:
 *   Props receive shape already transformed to canvas (px, y-down).
 *   The caller handles coordinate conversion.
 */

import React from "react";
import type { FigureShape, Point } from "./types";

// ── Helpers ─────────────────────────────────────────────────────

function dashArray(dashed: boolean, sw: number): string | undefined {
  return dashed ? `${sw * 4},${sw * 3}` : undefined;
}

function arrowMarkerId(shapeId: string, end: "start" | "end"): string {
  return `arrow-${shapeId}-${end}`;
}

/** Generate <defs> for arrow markers if needed */
export function ArrowDefs({ shape, scale }: { shape: FigureShape; scale: number }) {
  const defs: React.ReactNode[] = [];
  const color = shape.style.stroke;
  const size = Math.max(6, shape.style.strokeWidth * scale * 3);

  if (shape.style.arrowEnd || shape.kind === "arrow" || shape.kind === "force-arrow" || shape.kind === "vector" || shape.kind === "reaction-arrow") {
    defs.push(
      <marker
        key={`${shape.id}-end`}
        id={arrowMarkerId(shape.id, "end")}
        markerWidth={size}
        markerHeight={size}
        refX={size - 1}
        refY={size / 2}
        orient="auto"
      >
        <path
          d={`M0,0 L${size},${size / 2} L0,${size} Z`}
          fill={color}
        />
      </marker>
    );
  }
  if (shape.style.arrowStart) {
    defs.push(
      <marker
        key={`${shape.id}-start`}
        id={arrowMarkerId(shape.id, "start")}
        markerWidth={size}
        markerHeight={size}
        refX={1}
        refY={size / 2}
        orient="auto"
      >
        <path
          d={`M${size},0 L0,${size / 2} L${size},${size} Z`}
          fill={color}
        />
      </marker>
    );
  }

  return defs.length > 0 ? <>{defs}</> : null;
}

// ── Common SVG props ────────────────────────────────────────────

interface ShapeRenderProps {
  shape: FigureShape;
  /** pixels per cm */
  scale: number;
  /** Canvas-transformed x (px) */
  cx: number;
  /** Canvas-transformed y (px) */
  cy: number;
  /** Width in px */
  pw: number;
  /** Height in px */
  ph: number;
  /** Points transformed to px relative to (cx, cy) */
  pxPoints: Point[];
  selected: boolean;
  hovered: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function commonStyle(props: ShapeRenderProps) {
  const { shape, scale } = props;
  return {
    stroke: shape.style.stroke,
    strokeWidth: shape.style.strokeWidth * scale * 0.5,
    fill: shape.style.fill === "none" ? "transparent" : shape.style.fill,
    fillOpacity: shape.style.fillOpacity,
    strokeDasharray: dashArray(shape.style.dashed, shape.style.strokeWidth * scale * 0.5),
    cursor: "move",
  };
}

function selectionOutline(props: ShapeRenderProps, children: React.ReactNode) {
  const cls = props.selected ? "shape-selected" : props.hovered ? "shape-hovered" : "";
  return (
    <g
      className={cls}
      onMouseDown={props.onMouseDown}
      onMouseEnter={props.onMouseEnter}
      onMouseLeave={props.onMouseLeave}
      style={{ pointerEvents: "all" }}
    >
      {children}
    </g>
  );
}

// ── Renderers ───────────────────────────────────────────────────

function RenderRect(props: ShapeRenderProps) {
  const style = commonStyle(props);
  return selectionOutline(props,
    <>
      <rect x={props.cx} y={props.cy} width={props.pw} height={props.ph} rx={2} {...style}
        transform={props.shape.rotation ? `rotate(${-props.shape.rotation}, ${props.cx + props.pw / 2}, ${props.cy + props.ph / 2})` : undefined}
      />
      {props.shape.label && (
        <text x={props.cx + props.pw / 2} y={props.cy + props.ph / 2} textAnchor="middle" dominantBaseline="central"
          fontSize={props.shape.style.fontSizePt * props.scale * 0.3} fill={props.shape.style.stroke} pointerEvents="none">
          {props.shape.label}
        </text>
      )}
    </>
  );
}

function RenderCircle(props: ShapeRenderProps) {
  const style = commonStyle(props);
  const r = props.pw / 2;
  return selectionOutline(props,
    <>
      <circle cx={props.cx + r} cy={props.cy + r} r={r} {...style} />
      {props.shape.label && (
        <text x={props.cx + r} y={props.cy + r} textAnchor="middle" dominantBaseline="central"
          fontSize={props.shape.style.fontSizePt * props.scale * 0.3} fill={props.shape.style.stroke} pointerEvents="none">
          {props.shape.label}
        </text>
      )}
    </>
  );
}

function RenderEllipse(props: ShapeRenderProps) {
  const style = commonStyle(props);
  return selectionOutline(props,
    <>
      <ellipse cx={props.cx + props.pw / 2} cy={props.cy + props.ph / 2} rx={props.pw / 2} ry={props.ph / 2} {...style} />
      {props.shape.label && (
        <text x={props.cx + props.pw / 2} y={props.cy + props.ph / 2} textAnchor="middle" dominantBaseline="central"
          fontSize={props.shape.style.fontSizePt * props.scale * 0.3} fill={props.shape.style.stroke} pointerEvents="none">
          {props.shape.label}
        </text>
      )}
    </>
  );
}

function RenderLine(props: ShapeRenderProps) {
  const style = commonStyle(props);
  const pts = props.pxPoints.length >= 2 ? props.pxPoints : [{ x: 0, y: 0 }, { x: props.pw, y: 0 }];
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${props.cx + p.x},${props.cy + p.y}`).join(" ");
  const hasArrowEnd = props.shape.style.arrowEnd || props.shape.kind === "arrow" || props.shape.kind === "force-arrow" || props.shape.kind === "vector" || props.shape.kind === "reaction-arrow";
  return selectionOutline(props,
    <>
      {/* Hit area */}
      <path d={d} stroke="transparent" strokeWidth={Math.max(12, (style.strokeWidth as number) * 3)} fill="none" />
      <path d={d}
        stroke={style.stroke as string}
        strokeWidth={style.strokeWidth as number}
        fill="none"
        strokeDasharray={style.strokeDasharray}
        markerEnd={hasArrowEnd ? `url(#${arrowMarkerId(props.shape.id, "end")})` : undefined}
        markerStart={props.shape.style.arrowStart ? `url(#${arrowMarkerId(props.shape.id, "start")})` : undefined}
      />
      {props.shape.label && pts.length >= 2 && (
        <text
          x={(props.cx + pts[0].x + props.cx + pts[pts.length - 1].x) / 2}
          y={(props.cy + pts[0].y + props.cy + pts[pts.length - 1].y) / 2 - 8}
          textAnchor="middle" fontSize={props.shape.style.fontSizePt * props.scale * 0.3}
          fill={props.shape.style.stroke} pointerEvents="none"
        >
          {props.shape.label}
        </text>
      )}
    </>
  );
}

function RenderPolygon(props: ShapeRenderProps) {
  const style = commonStyle(props);
  const pts = props.pxPoints.length >= 3 ? props.pxPoints : [{ x: props.pw / 2, y: 0 }, { x: 0, y: props.ph }, { x: props.pw, y: props.ph }];
  const points = pts.map((p) => `${props.cx + p.x},${props.cy + p.y}`).join(" ");
  return selectionOutline(props,
    <>
      <polygon points={points} {...style} />
      {props.shape.label && (
        <text x={props.cx + props.pw / 2} y={props.cy + props.ph / 2} textAnchor="middle" dominantBaseline="central"
          fontSize={props.shape.style.fontSizePt * props.scale * 0.3} fill={props.shape.style.stroke} pointerEvents="none">
          {props.shape.label}
        </text>
      )}
    </>
  );
}

function RenderText(props: ShapeRenderProps) {
  const fontSize = props.shape.style.fontSizePt * props.scale * 0.4;
  return selectionOutline(props,
    <>
      {/* Hit area */}
      <rect x={props.cx} y={props.cy} width={Math.max(props.pw, 40)} height={Math.max(props.ph, 20)}
        fill="transparent" stroke="none" />
      <text x={props.cx + props.pw / 2} y={props.cy + props.ph / 2}
        textAnchor="middle" dominantBaseline="central"
        fontSize={fontSize} fill={props.shape.style.stroke}
        fontFamily="serif" style={{ userSelect: "none" }}>
        {props.shape.label || "Text"}
      </text>
    </>
  );
}

function RenderFreehand(props: ShapeRenderProps) {
  if (props.pxPoints.length < 2) return null;
  const style = commonStyle(props);
  const d = props.pxPoints.map((p, i) => `${i === 0 ? "M" : "L"}${props.cx + p.x},${props.cy + p.y}`).join(" ");
  return selectionOutline(props,
    <path d={d} stroke={style.stroke as string} strokeWidth={style.strokeWidth as number} fill="none"
      strokeDasharray={style.strokeDasharray} strokeLinecap="round" strokeLinejoin="round" />
  );
}

// ── Domain shape renderers (simplified SVG representations) ─────

function RenderResistor(props: ShapeRenderProps) {
  const { cx, cy, pw, ph, shape, scale } = props;
  const style = commonStyle(props);
  const sw = style.strokeWidth as number;
  const midY = cy + ph / 2;
  const zigW = pw * 0.6;
  const zigStart = cx + pw * 0.2;
  const zigH = ph * 0.4;
  const segments = 5;
  const segW = zigW / segments;

  let d = `M${cx},${midY} L${zigStart},${midY}`;
  for (let i = 0; i < segments; i++) {
    const x1 = zigStart + i * segW + segW * 0.25;
    const x2 = zigStart + i * segW + segW * 0.75;
    const yOff = i % 2 === 0 ? -zigH : zigH;
    d += ` L${x1},${midY + yOff} L${x2},${midY - yOff}`;
  }
  d += ` L${zigStart + zigW},${midY} L${cx + pw},${midY}`;

  return selectionOutline(props,
    <>
      <path d={d} stroke={style.stroke as string} strokeWidth={sw} fill="none" />
      {shape.label && <text x={cx + pw / 2} y={cy + ph * 0.15} textAnchor="middle" fontSize={10 * scale * 0.3} fill={style.stroke as string} pointerEvents="none">{shape.label}</text>}
    </>
  );
}

function RenderCapacitor(props: ShapeRenderProps) {
  const { cx, cy, pw, ph } = props;
  const style = commonStyle(props);
  const sw = style.strokeWidth as number;
  const midY = cy + ph / 2;
  const gap = pw * 0.1;
  const plateH = ph * 0.7;
  const midX = cx + pw / 2;

  return selectionOutline(props,
    <>
      <line x1={cx} y1={midY} x2={midX - gap} y2={midY} stroke={style.stroke as string} strokeWidth={sw} />
      <line x1={midX - gap} y1={midY - plateH / 2} x2={midX - gap} y2={midY + plateH / 2} stroke={style.stroke as string} strokeWidth={sw * 1.5} />
      <line x1={midX + gap} y1={midY - plateH / 2} x2={midX + gap} y2={midY + plateH / 2} stroke={style.stroke as string} strokeWidth={sw * 1.5} />
      <line x1={midX + gap} y1={midY} x2={cx + pw} y2={midY} stroke={style.stroke as string} strokeWidth={sw} />
      {props.shape.label && <text x={midX} y={cy + ph * 0.1} textAnchor="middle" fontSize={10 * props.scale * 0.3} fill={style.stroke as string} pointerEvents="none">{props.shape.label}</text>}
    </>
  );
}

function RenderInductor(props: ShapeRenderProps) {
  const { cx, cy, pw, ph } = props;
  const style = commonStyle(props);
  const midY = cy + ph / 2;
  const coils = 4;
  const coilW = pw * 0.6 / coils;
  const startX = cx + pw * 0.2;
  const r = coilW / 2;

  let d = `M${cx},${midY} L${startX},${midY}`;
  for (let i = 0; i < coils; i++) {
    const arcCx = startX + i * coilW + r;
    d += ` A${r},${r} 0 1,1 ${arcCx + r},${midY}`;
  }
  d += ` L${cx + pw},${midY}`;

  return selectionOutline(props,
    <>
      <path d={d} stroke={style.stroke as string} strokeWidth={style.strokeWidth as number} fill="none" />
      {props.shape.label && <text x={cx + pw / 2} y={cy + ph * 0.1} textAnchor="middle" fontSize={10 * props.scale * 0.3} fill={style.stroke as string} pointerEvents="none">{props.shape.label}</text>}
    </>
  );
}

function RenderVoltageSource(props: ShapeRenderProps) {
  const { cx, cy, pw, ph, scale } = props;
  const style = commonStyle(props);
  const r = Math.min(pw, ph) / 2;
  const midX = cx + pw / 2;
  const midY = cy + ph / 2;

  return selectionOutline(props,
    <>
      <circle cx={midX} cy={midY} r={r} stroke={style.stroke as string} strokeWidth={style.strokeWidth as number} fill="transparent" />
      <text x={midX} y={midY - r * 0.15} textAnchor="middle" dominantBaseline="central" fontSize={r * 0.7} fill={style.stroke as string} pointerEvents="none">+</text>
      <text x={midX} y={midY + r * 0.4} textAnchor="middle" dominantBaseline="central" fontSize={r * 0.9} fill={style.stroke as string} pointerEvents="none">-</text>
      {props.shape.label && <text x={midX + r + 4} y={midY} textAnchor="start" dominantBaseline="central" fontSize={10 * scale * 0.3} fill={style.stroke as string} pointerEvents="none">{props.shape.label}</text>}
    </>
  );
}

function RenderGround(props: ShapeRenderProps) {
  const { cx, cy, pw, ph } = props;
  const style = commonStyle(props);
  const sw = style.strokeWidth as number;
  const midX = cx + pw / 2;

  return selectionOutline(props,
    <>
      <line x1={midX} y1={cy} x2={midX} y2={cy + ph * 0.3} stroke={style.stroke as string} strokeWidth={sw} />
      <line x1={cx + pw * 0.1} y1={cy + ph * 0.3} x2={cx + pw * 0.9} y2={cy + ph * 0.3} stroke={style.stroke as string} strokeWidth={sw} />
      <line x1={cx + pw * 0.25} y1={cy + ph * 0.55} x2={cx + pw * 0.75} y2={cy + ph * 0.55} stroke={style.stroke as string} strokeWidth={sw} />
      <line x1={cx + pw * 0.38} y1={cy + ph * 0.8} x2={cx + pw * 0.62} y2={cy + ph * 0.8} stroke={style.stroke as string} strokeWidth={sw} />
    </>
  );
}

function RenderGenericDomain(props: ShapeRenderProps, label: string) {
  const { cx, cy, pw, ph, scale, shape } = props;
  const style = commonStyle(props);
  return selectionOutline(props,
    <>
      <rect x={cx} y={cy} width={pw} height={ph} rx={4}
        stroke={style.stroke as string} strokeWidth={style.strokeWidth as number}
        fill={style.fill === "transparent" ? "#f0f9ff" : style.fill as string}
        fillOpacity={0.3} strokeDasharray={style.strokeDasharray} />
      <text x={cx + pw / 2} y={cy + ph / 2 - 6} textAnchor="middle" dominantBaseline="central"
        fontSize={Math.min(10, pw * 0.15)} fill="#6b7280" pointerEvents="none" fontWeight="500">
        {label}
      </text>
      {shape.label && (
        <text x={cx + pw / 2} y={cy + ph / 2 + 8} textAnchor="middle" dominantBaseline="central"
          fontSize={shape.style.fontSizePt * scale * 0.3} fill={style.stroke as string} pointerEvents="none">
          {shape.label}
        </text>
      )}
    </>
  );
}

// Flowchart decision (diamond)
function RenderFlowchartDecision(props: ShapeRenderProps) {
  const { cx, cy, pw, ph, shape, scale } = props;
  const style = commonStyle(props);
  const midX = cx + pw / 2;
  const midY = cy + ph / 2;
  const points = `${midX},${cy} ${cx + pw},${midY} ${midX},${cy + ph} ${cx},${midY}`;
  return selectionOutline(props,
    <>
      <polygon points={points} {...style} />
      <text x={midX} y={midY} textAnchor="middle" dominantBaseline="central"
        fontSize={shape.style.fontSizePt * scale * 0.3} fill={shape.style.stroke} pointerEvents="none">
        {shape.label || "?"}
      </text>
    </>
  );
}

// Flowchart terminal (rounded rect)
function RenderFlowchartTerminal(props: ShapeRenderProps) {
  const { cx, cy, pw, ph, shape, scale } = props;
  const style = commonStyle(props);
  return selectionOutline(props,
    <>
      <rect x={cx} y={cy} width={pw} height={ph} rx={ph / 2} {...style} />
      <text x={cx + pw / 2} y={cy + ph / 2} textAnchor="middle" dominantBaseline="central"
        fontSize={shape.style.fontSizePt * scale * 0.3} fill={shape.style.stroke} pointerEvents="none">
        {shape.label || "Start"}
      </text>
    </>
  );
}

// Automaton state (circle with label)
function RenderAutomatonState(props: ShapeRenderProps) {
  const { cx, cy, pw, ph, shape, scale } = props;
  const style = commonStyle(props);
  const r = Math.min(pw, ph) / 2;
  const midX = cx + pw / 2;
  const midY = cy + ph / 2;
  return selectionOutline(props,
    <>
      <circle cx={midX} cy={midY} r={r} {...style} />
      <text x={midX} y={midY} textAnchor="middle" dominantBaseline="central"
        fontSize={shape.style.fontSizePt * scale * 0.3} fill={shape.style.stroke} pointerEvents="none">
        {shape.label || "q"}
      </text>
    </>
  );
}

// Automaton accept state (double circle)
function RenderAutomatonAccept(props: ShapeRenderProps) {
  const { cx, cy, pw, ph, shape, scale } = props;
  const style = commonStyle(props);
  const r = Math.min(pw, ph) / 2;
  const midX = cx + pw / 2;
  const midY = cy + ph / 2;
  return selectionOutline(props,
    <>
      <circle cx={midX} cy={midY} r={r} {...style} />
      <circle cx={midX} cy={midY} r={r * 0.8} stroke={style.stroke as string} strokeWidth={style.strokeWidth as number} fill="none" />
      <text x={midX} y={midY} textAnchor="middle" dominantBaseline="central"
        fontSize={shape.style.fontSizePt * scale * 0.3} fill={shape.style.stroke} pointerEvents="none">
        {shape.label || "q"}
      </text>
    </>
  );
}

// Benzene ring
function RenderBenzene(props: ShapeRenderProps) {
  const { cx, cy, pw, ph } = props;
  const style = commonStyle(props);
  const r = Math.min(pw, ph) / 2;
  const midX = cx + pw / 2;
  const midY = cy + ph / 2;
  const hex = Array.from({ length: 6 }, (_, i) => {
    const angle = (-Math.PI / 2) + (i * Math.PI * 2) / 6;
    return `${midX + r * Math.cos(angle)},${midY + r * Math.sin(angle)}`;
  }).join(" ");
  return selectionOutline(props,
    <>
      <polygon points={hex} stroke={style.stroke as string} strokeWidth={style.strokeWidth as number} fill="transparent" />
      <circle cx={midX} cy={midY} r={r * 0.55} stroke={style.stroke as string} strokeWidth={style.strokeWidth as number} fill="none" />
    </>
  );
}

// Spring
function RenderSpring(props: ShapeRenderProps) {
  const { cx, cy, pw, ph } = props;
  const style = commonStyle(props);
  const midY = cy + ph / 2;
  const coils = 6;
  const amp = ph * 0.4;
  const startX = cx + pw * 0.1;
  const endX = cx + pw * 0.9;
  const coilW = (endX - startX) / coils;

  let d = `M${cx},${midY} L${startX},${midY}`;
  for (let i = 0; i < coils; i++) {
    const x1 = startX + i * coilW + coilW * 0.25;
    const x2 = startX + i * coilW + coilW * 0.75;
    d += ` L${x1},${midY - amp} L${x2},${midY + amp}`;
  }
  d += ` L${endX},${midY} L${cx + pw},${midY}`;

  return selectionOutline(props,
    <path d={d} stroke={style.stroke as string} strokeWidth={style.strokeWidth as number} fill="none" />
  );
}

// Mass block
function RenderMass(props: ShapeRenderProps) {
  const { cx, cy, pw, ph, shape, scale } = props;
  const style = commonStyle(props);
  return selectionOutline(props,
    <>
      <rect x={cx} y={cy} width={pw} height={ph}
        stroke={style.stroke as string} strokeWidth={style.strokeWidth as number}
        fill={style.fill === "transparent" ? "#e5e7eb" : style.fill as string}
        fillOpacity={style.fillOpacity as number}
      />
      {/* Hatching */}
      <line x1={cx} y1={cy + ph} x2={cx + pw * 0.3} y2={cy + ph * 0.7} stroke={style.stroke as string} strokeWidth={0.5} opacity={0.4} />
      <line x1={cx + pw * 0.3} y1={cy + ph} x2={cx + pw * 0.6} y2={cy + ph * 0.7} stroke={style.stroke as string} strokeWidth={0.5} opacity={0.4} />
      <line x1={cx + pw * 0.6} y1={cy + ph} x2={cx + pw * 0.9} y2={cy + ph * 0.7} stroke={style.stroke as string} strokeWidth={0.5} opacity={0.4} />
      <text x={cx + pw / 2} y={cy + ph / 2} textAnchor="middle" dominantBaseline="central"
        fontSize={shape.style.fontSizePt * scale * 0.3} fill={style.stroke as string} pointerEvents="none" fontStyle="italic">
        {shape.label || "m"}
      </text>
    </>
  );
}

// Pulley
function RenderPulley(props: ShapeRenderProps) {
  const { cx, cy, pw, ph } = props;
  const style = commonStyle(props);
  const r = Math.min(pw, ph) / 2;
  const midX = cx + pw / 2;
  const midY = cy + ph / 2;
  return selectionOutline(props,
    <>
      <circle cx={midX} cy={midY} r={r} stroke={style.stroke as string} strokeWidth={style.strokeWidth as number} fill="transparent" />
      <circle cx={midX} cy={midY} r={3} fill={style.stroke as string} />
    </>
  );
}

// ── Main dispatcher ─────────────────────────────────────────────

export function ShapeRenderer(props: ShapeRenderProps) {
  const { shape } = props;

  switch (shape.kind) {
    case "rect": return <RenderRect {...props} />;
    case "circle": return <RenderCircle {...props} />;
    case "ellipse": return <RenderEllipse {...props} />;
    case "line":
    case "polyline":
    case "arrow":
    case "force-arrow":
    case "vector":
    case "reaction-arrow":
    case "bond-single":
    case "bond-double":
    case "bond-triple":
      return <RenderLine {...props} />;
    case "polygon":
    case "prism":
      return <RenderPolygon {...props} />;
    case "text": return <RenderText {...props} />;
    case "freehand": return <RenderFreehand {...props} />;
    case "arc": return <RenderCircle {...props} />;

    // Circuit
    case "resistor": return <RenderResistor {...props} />;
    case "capacitor": return <RenderCapacitor {...props} />;
    case "inductor": return <RenderInductor {...props} />;
    case "voltage-source":
    case "current-source":
      return <RenderVoltageSource {...props} />;
    case "ground": return <RenderGround {...props} />;
    case "switch": return RenderGenericDomain(props, "SW");
    case "diode":
    case "led":
      return RenderGenericDomain(props, shape.kind.toUpperCase());
    case "transistor-npn": return RenderGenericDomain(props, "NPN");
    case "transistor-pnp": return RenderGenericDomain(props, "PNP");
    case "opamp": return RenderGenericDomain(props, "Op-Amp");

    // Mechanics
    case "spring": return <RenderSpring {...props} />;
    case "damper": return RenderGenericDomain(props, "Damper");
    case "mass": return <RenderMass {...props} />;
    case "pulley": return <RenderPulley {...props} />;
    case "support-pin": return RenderGenericDomain(props, "Pin");
    case "support-roller": return RenderGenericDomain(props, "Roller");
    case "moment": return RenderGenericDomain(props, "M");

    // Physics
    case "wave": return RenderGenericDomain(props, "Wave");
    case "lens-convex": return RenderGenericDomain(props, "Convex");
    case "lens-concave": return RenderGenericDomain(props, "Concave");
    case "vector-field": return RenderGenericDomain(props, "Field");

    // Math
    case "axes": return RenderGenericDomain(props, "Axes");
    case "angle-arc": return RenderGenericDomain(props, "Angle");
    case "right-angle": return RenderGenericDomain(props, "90deg");
    case "function-plot": return RenderGenericDomain(props, "f(x)");
    case "brace": return RenderGenericDomain(props, "Brace");

    // CS
    case "flowchart-process": return <RenderRect {...props} />;
    case "flowchart-decision": return <RenderFlowchartDecision {...props} />;
    case "flowchart-io": return <RenderRect {...props} />;
    case "flowchart-terminal": return <RenderFlowchartTerminal {...props} />;
    case "automaton-state": return <RenderAutomatonState {...props} />;
    case "automaton-accept": return <RenderAutomatonAccept {...props} />;

    // Chemistry
    case "benzene": return <RenderBenzene {...props} />;
    case "orbital-s": return <RenderCircle {...props} />;
    case "orbital-p": return <RenderEllipse {...props} />;

    // Biology
    case "cell": return <RenderEllipse {...props} />;
    case "nucleus": return <RenderCircle {...props} />;
    case "mitochondria": return <RenderEllipse {...props} />;
    case "membrane": return RenderGenericDomain(props, "Membrane");
    case "neuron": return RenderGenericDomain(props, "Neuron");
    case "synapse": return RenderGenericDomain(props, "Synapse");

    default:
      return RenderGenericDomain(props, shape.kind);
  }
}
