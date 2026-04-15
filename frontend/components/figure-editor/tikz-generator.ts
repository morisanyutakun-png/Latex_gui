/**
 * TikZ Code Generator — converts figure shapes to LaTeX TikZ source code.
 *
 * Output is a self-contained `tikzpicture` environment that can be inserted
 * directly into a LaTeX document.
 */

import type { FigureShape, Connection, ShapeStyle, Point, ShapeKind, LabelPosition } from "./types";
import { IPE_COLORS } from "./types";

// ── Helpers ─────────────────────────────────────────────────────

function fmt(n: number): string {
  const r = Math.round(n * 100) / 100;
  return r === Math.floor(r) ? r.toFixed(0) : r.toString();
}

function coord(x: number, y: number): string {
  return `(${fmt(x)},${fmt(y)})`;
}

// Map our DashStyle to TikZ
const TIKZ_DASH: Record<string, string> = {
  "solid": "",
  "dashed": "dashed",
  "dotted": "dotted",
  "dash-dotted": "dashdotted",
  "dash-dot-dotted": "dashdotdotted",
};

// Map our ArrowHead to TikZ arrow tip name (uses arrows.meta library)
const TIKZ_ARROW: Record<string, string> = {
  "none":     "",
  "normal":   "Latex",
  "fnormal":  "Latex[open]",
  "pointed":  "Stealth",
  "fpointed": "Stealth[open]",
  "linear":   "Straight Barb",
  "double":   "Latex Latex",
  "fdouble":  "Latex[open] Latex[open]",
};

const TIKZ_ARROW_SIZE: Record<string, string> = {
  "tiny":   "scale=0.5",
  "small":  "scale=0.8",
  "normal": "",
  "large":  "scale=1.4",
};

function buildDrawOptions(style: ShapeStyle, extra: Record<string, string> = {}): string {
  const opts: string[] = [];

  if (style.stroke !== "black") opts.push(`draw=${style.stroke}`);
  else opts.push("draw");

  if ((style.strokeOpacity ?? 1) < 1) opts.push(`draw opacity=${fmt(style.strokeOpacity ?? 1)}`);

  if (style.fill !== "none") {
    opts.push(`fill=${style.fill}`);
    if (style.fillOpacity < 1) opts.push(`fill opacity=${fmt(style.fillOpacity)}`);
  }

  if (style.strokeWidth !== 0.8) {
    if (style.strokeWidth <= 0.4) opts.push("thin");
    else if (style.strokeWidth >= 1.5 && style.strokeWidth < 2.5) opts.push("thick");
    else if (style.strokeWidth >= 2.5) opts.push("very thick");
    else opts.push(`line width=${fmt(style.strokeWidth)}pt`);
  }

  // Dash style — supports IPE's 5 patterns
  const ds = style.dashStyle ?? (style.dashed ? "dashed" : "solid");
  const dashName = TIKZ_DASH[ds];
  if (dashName) opts.push(dashName);

  // Arrow heads — IPE-style with proper tip names (requires arrows.meta library)
  const startH = style.arrowStartHead ?? (style.arrowStart ? "normal" : "none");
  const endH = style.arrowEndHead ?? (style.arrowEnd ? "normal" : "none");
  const startTip = TIKZ_ARROW[startH] ?? "";
  const endTip = TIKZ_ARROW[endH] ?? "";
  const sizeOpt = TIKZ_ARROW_SIZE[style.arrowSize ?? "normal"] ?? "";
  if (startTip || endTip) {
    const sizePart = sizeOpt ? `[${sizeOpt}]` : "";
    opts.push(`${startTip ? `{${startTip}${sizePart}}` : ""}-${endTip ? `{${endTip}${sizePart}}` : ""}`);
  }

  for (const [k, v] of Object.entries(extra)) {
    opts.push(v ? `${k}=${v}` : k);
  }

  return opts.join(", ");
}

/** Map LabelPosition to TikZ node placement option. */
function tikzLabelPos(pos: LabelPosition): string {
  switch (pos) {
    case "above":       return "above";
    case "below":       return "below";
    case "left":        return "left";
    case "right":       return "right";
    case "above-left":  return "above left";
    case "above-right": return "above right";
    case "below-left":  return "below left";
    case "below-right": return "below right";
    case "center":
    default:            return "";
  }
}

/** Build the label text, applying math mode wrapping if configured. */
function labelText(s: FigureShape): string {
  if (!s.label) return "";
  if (s.labelMathMode) {
    // If user already wrapped with $, keep as-is. Otherwise wrap.
    const t = s.label.trim();
    if (t.startsWith("$") && t.endsWith("$")) return t;
    return `$${t}$`;
  }
  return s.label;
}

/** Build a `node[...]{text}` fragment for the current shape, or "" if no label. */
function labelNodeFor(s: FigureShape, fallbackPos: LabelPosition = "center"): string {
  if (!s.label) return "";
  const pos = tikzLabelPos(s.labelPos ?? fallbackPos);
  const off = s.labelOffset;
  const shiftOpt = (off && (off.x !== 0 || off.y !== 0))
    ? `, xshift=${fmt(off.x)}cm, yshift=${fmt(off.y)}cm`
    : "";
  const opts = pos ? `${pos}${shiftOpt}` : shiftOpt.replace(/^,\s*/, "");
  return ` node[${opts}] {${labelText(s)}}`;
}

/** Backward-compat shim for any remaining callers. */
function labelNode(label: string, pos = "center"): string {
  if (!label) return "";
  return ` node[${pos}] {${label}}`;
}

// ── Shape generators ────────────────────────────────────────────

function genRect(s: FigureShape): string {
  const opts = buildDrawOptions(s.style);
  const x2 = s.x + s.width;
  const y2 = s.y + s.height;
  const lbl = labelNodeFor(s);
  if (s.rotation) {
    return `  \\draw[${opts}, rotate around={${fmt(s.rotation)}:${coord(s.x + s.width / 2, s.y + s.height / 2)}}] ${coord(s.x, s.y)} rectangle ${coord(x2, y2)}${lbl};`;
  }
  return `  \\draw[${opts}] ${coord(s.x, s.y)} rectangle ${coord(x2, y2)}${lbl};`;
}

function genCircle(s: FigureShape): string {
  const r = s.width / 2;
  const cx = s.x + r;
  const cy = s.y + r;
  const opts = buildDrawOptions(s.style);
  const lbl = labelNodeFor(s);
  return `  \\draw[${opts}] ${coord(cx, cy)} circle (${fmt(r)})${lbl};`;
}

function genEllipse(s: FigureShape): string {
  const cx = s.x + s.width / 2;
  const cy = s.y + s.height / 2;
  const rx = s.width / 2;
  const ry = s.height / 2;
  const opts = buildDrawOptions(s.style);
  const lbl = labelNodeFor(s);
  return `  \\draw[${opts}] ${coord(cx, cy)} ellipse (${fmt(rx)} and ${fmt(ry)})${lbl};`;
}

function genLine(s: FigureShape): string {
  const pts = s.points.length >= 2 ? s.points : [{ x: 0, y: 0 }, { x: s.width, y: 0 }];
  const opts = buildDrawOptions(s.style);
  const path = pts.map((p) => coord(s.x + p.x, s.y + p.y)).join(" -- ");
  const lbl = s.label ? ` node[midway, ${tikzLabelPos(s.labelPos ?? "above") || "above"}] {${labelText(s)}}` : "";
  return `  \\draw[${opts}] ${path}${lbl};`;
}

function genArrow(s: FigureShape): string {
  const pts = s.points.length >= 2 ? s.points : [{ x: 0, y: 0 }, { x: s.width, y: 0 }];
  const style: ShapeStyle = { ...s.style, arrowEnd: true };
  const opts = buildDrawOptions(style);
  const path = pts.map((p) => coord(s.x + p.x, s.y + p.y)).join(" -- ");
  const lbl = s.label ? ` node[midway, ${tikzLabelPos(s.labelPos ?? "above") || "above"}] {${labelText(s)}}` : "";
  return `  \\draw[${opts}] ${path}${lbl};`;
}

function genPolygon(s: FigureShape): string {
  if (s.points.length < 3) return genRect(s);
  const opts = buildDrawOptions(s.style);
  const path = s.points.map((p) => coord(s.x + p.x, s.y + p.y)).join(" -- ");
  const lbl = labelNodeFor(s);
  return `  \\draw[${opts}] ${path} -- cycle${lbl};`;
}

function genText(s: FigureShape): string {
  const cx = s.x + s.width / 2;
  const cy = s.y + s.height / 2;
  const text = s.label || "Text";
  const fontSize = s.style.fontSizePt !== 10 ? `, font=\\fontsize{${s.style.fontSizePt}}{${Math.round(s.style.fontSizePt * 1.2)}}\\selectfont` : "";
  const color = s.style.stroke !== "black" ? `, text=${s.style.stroke}` : "";
  return `  \\node[anchor=center${fontSize}${color}] at ${coord(cx, cy)} {${text}};`;
}

function genArc(s: FigureShape): string {
  const opts = buildDrawOptions(s.style);
  return `  \\draw[${opts}] ${coord(s.x, s.y)} arc (0:180:${fmt(s.width / 2)});`;
}

function genFreehand(s: FigureShape): string {
  if (s.points.length < 2) return "";
  const opts = buildDrawOptions(s.style);
  const path = s.points.map((p) => coord(s.x + p.x, s.y + p.y)).join(" -- ");
  return `  \\draw[${opts}] ${path};`;
}

// ── Domain-specific generators ──────────────────────────────────

function genCircuitComponent(s: FigureShape): string {
  const componentMap: Record<string, string> = {
    "resistor": "R",
    "capacitor": "C",
    "inductor": "L",
    "voltage-source": "V",
    "current-source": "I",
    "ground": "ground",
    "switch": "nos",
    "diode": "D",
    "led": "leDo",
    "transistor-npn": "npn",
    "transistor-pnp": "pnp",
    "opamp": "op amp",
  };

  const comp = componentMap[s.kind] || "R";
  const x2 = s.x + s.width;
  const y2 = s.y;
  const lbl = s.label ? `{${s.label}}` : "";

  if (s.kind === "ground") {
    return `  \\node[ground] at ${coord(s.x, s.y)} {};`;
  }

  if (s.kind === "transistor-npn" || s.kind === "transistor-pnp") {
    return `  \\node[${comp}, anchor=center] (${s.id}) at ${coord(s.x, s.y)} ${lbl};`;
  }

  if (s.kind === "opamp") {
    return `  \\node[op amp, anchor=center] (${s.id}) at ${coord(s.x, s.y)} ${lbl};`;
  }

  return `  \\draw ${coord(s.x, s.y)} to[${comp}, l=${lbl}] ${coord(x2, y2)};`;
}

function genSpring(s: FigureShape): string {
  // Use TikZ `coil` decoration (decorations.pathmorphing). aspect=0.5 + short
  // segment/amplitude produces a tight, recognisably-helical wire coil; small
  // pre/post leads give clean attachment room at each end.
  const opts = buildDrawOptions(s.style, {
    "decoration": "{coil, aspect=0.5, segment length=4pt, amplitude=5pt, pre length=3pt, post length=3pt}",
    "decorate": "",
  });
  const pts = s.points.length >= 2 ? s.points : [{ x: 0, y: s.height / 2 }, { x: s.width, y: s.height / 2 }];
  const p0 = { x: s.x + pts[0].x, y: s.y + pts[0].y };
  const p1 = { x: s.x + pts[pts.length - 1].x, y: s.y + pts[pts.length - 1].y };
  const lbl = s.label ? ` node[midway, ${tikzLabelPos(s.labelPos ?? "above") || "above"}] {${labelText(s)}}` : "";
  return `  \\draw[${opts}] ${coord(p0.x, p0.y)} -- ${coord(p1.x, p1.y)}${lbl};`;
}

function genDamper(s: FigureShape): string {
  // Dashpot: cylinder (open on left) + piston rod + piston plate + right lead
  const opts = buildDrawOptions(s.style);
  const pts = s.points.length >= 2 ? s.points : [{ x: 0, y: s.height / 2 }, { x: s.width, y: s.height / 2 }];
  const p0 = { x: s.x + pts[0].x, y: s.y + pts[0].y };
  const p1 = { x: s.x + pts[pts.length - 1].x, y: s.y + pts[pts.length - 1].y };
  const len = Math.sqrt((p1.x - p0.x) ** 2 + (p1.y - p0.y) ** 2) || 1;
  // Operate in a local frame along p0→p1, then rotate at the end
  const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180 / Math.PI;
  const cylW = Math.min(len * 0.45, 0.8);        // cylinder width (cm)
  const cylH = Math.min(len * 0.22, 0.35);       // cylinder half-height
  const cylL = (len - cylW) / 2;                 // cylinder left x (from p0)
  const cylR = cylL + cylW;                      // cylinder right x
  const pistonX = cylL + cylW * 0.35;            // piston plate x
  return [
    `  \\begin{scope}[shift={${coord(p0.x, p0.y)}}, rotate=${fmt(angle)}]`,
    `  \\draw[${opts}] (0,0) -- (${fmt(pistonX)},0);`,
    `  \\draw[${opts}, line width=1pt] (${fmt(pistonX)},${fmt(-cylH * 0.7)}) -- (${fmt(pistonX)},${fmt(cylH * 0.7)});`,
    `  \\draw[${opts}] (${fmt(cylL)},${fmt(-cylH)}) -- (${fmt(cylR)},${fmt(-cylH)}) -- (${fmt(cylR)},${fmt(cylH)}) -- (${fmt(cylL)},${fmt(cylH)});`,
    `  \\draw[${opts}] (${fmt(cylR)},0) -- (${fmt(len)},0);`,
    `  \\end{scope}`,
  ].join("\n");
}

function genMass(s: FigureShape): string {
  const opts = buildDrawOptions(s.style);
  const lbl = s.label || "$m$";
  return `  \\draw[${opts}] ${coord(s.x, s.y)} rectangle ${coord(s.x + s.width, s.y + s.height)} node[midway] {${lbl}};`;
}

function genPulley(s: FigureShape): string {
  const r = s.width / 2;
  const cx = s.x + r;
  const cy = s.y + r;
  return [
    `  \\draw ${coord(cx, cy)} circle (${fmt(r)});`,
    `  \\fill ${coord(cx, cy)} circle (1pt);`,
  ].join("\n");
}

/** Fixed wall (vertical edge on right side, hatching extending leftward). */
function genWall(s: FigureShape): string {
  const opts = buildDrawOptions(s.style);
  const rightX = s.x + s.width;
  // Solid right edge + pattern-fill the hatching area
  return [
    `  \\draw[${opts}, pattern=north east lines, pattern color=${s.style.stroke}!70] ${coord(s.x, s.y)} rectangle ${coord(rightX, s.y + s.height)};`,
    `  \\draw[${opts}, line width=0.8pt] ${coord(rightX, s.y)} -- ${coord(rightX, s.y + s.height)};`,
  ].join("\n");
}

/** Hatched ground line (horizontal, hatching below). */
function genGroundHatch(s: FigureShape): string {
  const opts = buildDrawOptions(s.style);
  const topY = s.y + s.height;
  return [
    `  \\draw[${opts}, pattern=north east lines, pattern color=${s.style.stroke}!70] ${coord(s.x, s.y)} rectangle ${coord(s.x + s.width, topY)};`,
    `  \\draw[${opts}, line width=0.8pt] ${coord(s.x, topY)} -- ${coord(s.x + s.width, topY)};`,
  ].join("\n");
}

function genSupportPin(s: FigureShape): string {
  const cx = s.x + s.width / 2;
  return [
    `  \\draw[fill=white] ${coord(cx, s.y)} -- ${coord(s.x, s.y - s.height)} -- ${coord(s.x + s.width, s.y - s.height)} -- cycle;`,
    `  \\draw ${coord(s.x, s.y - s.height)} -- ${coord(s.x + s.width, s.y - s.height)};`,
    `  \\foreach \\x in {0,...,3} { \\draw ${coord(s.x, s.y - s.height)} ++({\\x*${fmt(s.width / 3)}},0) -- ++(-.1,-.15); }`,
  ].join("\n");
}

function genSupportRoller(s: FigureShape): string {
  const cx = s.x + s.width / 2;
  const r = 0.12;
  return [
    `  \\draw[fill=white] ${coord(cx, s.y)} -- ${coord(s.x, s.y - s.height + 2 * r)} -- ${coord(s.x + s.width, s.y - s.height + 2 * r)} -- cycle;`,
    `  \\draw ${coord(cx - 0.15, s.y - s.height + r)} circle (${fmt(r)});`,
    `  \\draw ${coord(cx + 0.15, s.y - s.height + r)} circle (${fmt(r)});`,
    `  \\draw ${coord(s.x, s.y - s.height)} -- ${coord(s.x + s.width, s.y - s.height)};`,
  ].join("\n");
}

function genForceArrow(s: FigureShape): string {
  const pts = s.points.length >= 2 ? s.points : [{ x: 0, y: 0 }, { x: s.width, y: 0 }];
  const opts = buildDrawOptions({ ...s.style, arrowEnd: true }, { "very thick": "" });
  const lbl = s.label ? ` node[midway, ${tikzLabelPos(s.labelPos ?? "above") || "above"}] {$${s.label}$}` : "";
  return `  \\draw[${opts}] ${coord(s.x + pts[0].x, s.y + pts[0].y)} -- ${coord(s.x + pts[1].x, s.y + pts[1].y)}${lbl};`;
}

function genMoment(s: FigureShape): string {
  const cx = s.x + s.width / 2;
  const cy = s.y + s.height / 2;
  const r = Math.min(s.width, s.height) / 2 * 0.8;
  const lbl = s.label ? ` node[${tikzLabelPos(s.labelPos ?? "above-right") || "above right"}] {$${s.label}$}` : "";
  return `  \\draw[->, thick] ${coord(cx + r, cy)} arc (0:300:${fmt(r)})${lbl};`;
}

function genWave(s: FigureShape): string {
  const opts = buildDrawOptions(s.style, { domain: `0:${fmt(s.width)}`, samples: "200" });
  const amp = fmt(s.height / 2);
  return `  \\draw[${opts}] plot (\\x + ${fmt(s.x)}, {${amp}*sin(360*\\x/2) + ${fmt(s.y + s.height / 2)}});`;
}

function genLens(s: FigureShape, convex: boolean): string {
  const cx = s.x + s.width / 2;
  const cy = s.y + s.height / 2;
  const h = s.height / 2;
  const opts = buildDrawOptions(s.style);
  if (convex) {
    return `  \\draw[${opts}] ${coord(cx, cy - h)} arc (150:210:${fmt(h * 2)}) arc (-30:30:${fmt(h * 2)});`;
  }
  return `  \\draw[${opts}] ${coord(cx, cy - h)} arc (30:-30:${fmt(h * 2)}) arc (210:150:${fmt(h * 2)});`;
}

function genAxes(s: FigureShape): string {
  const lbl = s.label || "";
  const xLabel = s.tikzOptions["xlabel"] || "$x$";
  const yLabel = s.tikzOptions["ylabel"] || "$y$";
  return [
    `  \\draw[->] ${coord(s.x, s.y)} -- ${coord(s.x + s.width, s.y)} node[right] {${xLabel}};`,
    `  \\draw[->] ${coord(s.x, s.y)} -- ${coord(s.x, s.y + s.height)} node[above] {${yLabel}};`,
    `  \\node[below left] at ${coord(s.x, s.y)} {O};`,
  ].join("\n");
}

function genAngleArc(s: FigureShape): string {
  const r = Math.min(s.width, s.height) * 0.8;
  const lbl = s.label || "$\\theta$";
  const startAngle = s.tikzOptions["start"] || "0";
  const endAngle = s.tikzOptions["end"] || "45";
  return `  \\draw ${coord(s.x, s.y)} ++(${startAngle}:${fmt(r)}) arc (${startAngle}:${endAngle}:${fmt(r)}) node[midway, right] {${lbl}};`;
}

function genRightAngle(s: FigureShape): string {
  const sz = Math.min(s.width, s.height);
  return `  \\draw ${coord(s.x + sz, s.y)} -- ${coord(s.x + sz, s.y + sz)} -- ${coord(s.x, s.y + sz)};`;
}

function genFunctionPlot(s: FigureShape): string {
  const func = s.tikzOptions["function"] || "x^2";
  const domain = s.tikzOptions["domain"] || "-2:2";
  const samples = s.tikzOptions["samples"] || "100";
  const opts = buildDrawOptions(s.style, { domain, samples, smooth: "" });
  return [
    `  \\draw[->] ${coord(s.x, s.y + s.height / 2)} -- ${coord(s.x + s.width, s.y + s.height / 2)} node[right] {$x$};`,
    `  \\draw[->] ${coord(s.x + s.width / 2, s.y)} -- ${coord(s.x + s.width / 2, s.y + s.height)} node[above] {$y$};`,
    `  \\draw[${opts}] plot ({\\x + ${fmt(s.x + s.width / 2)}}, {(${func}) + ${fmt(s.y + s.height / 2)}});`,
  ].join("\n");
}

function genVector(s: FigureShape): string {
  const pts = s.points.length >= 2 ? s.points : [{ x: 0, y: 0 }, { x: s.width, y: s.height }];
  const opts = buildDrawOptions({ ...s.style, arrowEnd: true }, { "very thick": "" });
  const lbl = s.label ? ` node[midway, ${tikzLabelPos(s.labelPos ?? "above") || "above"}] {$\\vec{${s.label}}$}` : "";
  return `  \\draw[${opts}] ${coord(s.x + pts[0].x, s.y + pts[0].y)} -- ${coord(s.x + pts[1].x, s.y + pts[1].y)}${lbl};`;
}

function genBrace(s: FigureShape): string {
  const lbl = s.label || "";
  return `  \\draw[decorate, decoration={brace, amplitude=5pt}] ${coord(s.x, s.y)} -- ${coord(s.x, s.y + s.height)} node[midway, left=5pt] {${lbl}};`;
}

// CS shapes
function genFlowchartProcess(s: FigureShape): string {
  const opts = buildDrawOptions(s.style, { "rounded corners": "2pt" });
  const lbl = s.label || "Process";
  return `  \\node[draw, ${opts}, minimum width=${fmt(s.width)}cm, minimum height=${fmt(s.height)}cm] (${s.id}) at ${coord(s.x + s.width / 2, s.y + s.height / 2)} {${lbl}};`;
}

function genFlowchartDecision(s: FigureShape): string {
  const opts = buildDrawOptions(s.style, { diamond: "", "aspect": "2" });
  const lbl = s.label || "?";
  return `  \\node[draw, ${opts}, minimum width=${fmt(s.width)}cm, minimum height=${fmt(s.height)}cm] (${s.id}) at ${coord(s.x + s.width / 2, s.y + s.height / 2)} {${lbl}};`;
}

function genFlowchartIO(s: FigureShape): string {
  const opts = buildDrawOptions(s.style, { "trapezium": "", "trapezium left angle": "70", "trapezium right angle": "110" });
  const lbl = s.label || "I/O";
  return `  \\node[draw, ${opts}, minimum width=${fmt(s.width)}cm, minimum height=${fmt(s.height)}cm] (${s.id}) at ${coord(s.x + s.width / 2, s.y + s.height / 2)} {${lbl}};`;
}

function genFlowchartTerminal(s: FigureShape): string {
  const opts = buildDrawOptions(s.style, { "rounded rectangle": "" });
  const lbl = s.label || "Start";
  return `  \\node[draw, ${opts}, rounded corners=${fmt(s.height / 2)}cm, minimum width=${fmt(s.width)}cm, minimum height=${fmt(s.height)}cm] (${s.id}) at ${coord(s.x + s.width / 2, s.y + s.height / 2)} {${lbl}};`;
}

function genAutomatonState(s: FigureShape): string {
  const r = s.width / 2;
  const cx = s.x + r;
  const cy = s.y + r;
  const opts = buildDrawOptions(s.style);
  const lbl = s.label || "$q$";
  return `  \\node[draw, circle, ${opts}, minimum size=${fmt(s.width)}cm] (${s.id}) at ${coord(cx, cy)} {${lbl}};`;
}

function genAutomatonAccept(s: FigureShape): string {
  const r = s.width / 2;
  const cx = s.x + r;
  const cy = s.y + r;
  const opts = buildDrawOptions(s.style);
  const lbl = s.label || "$q$";
  return [
    `  \\node[draw, circle, ${opts}, minimum size=${fmt(s.width)}cm] (${s.id}) at ${coord(cx, cy)} {${lbl}};`,
    `  \\draw ${coord(cx, cy)} circle (${fmt(r * 0.8)});`,
  ].join("\n");
}

// Chemistry shapes
function genBenzene(s: FigureShape): string {
  const cx = s.x + s.width / 2;
  const cy = s.y + s.height / 2;
  const r = s.width / 2;
  const pts = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 2) + (i * Math.PI * 2) / 6;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });
  const hex = pts.map((p) => coord(p.x, p.y)).join(" -- ");
  const innerR = r * 0.6;
  return [
    `  \\draw ${hex} -- cycle;`,
    `  \\draw ${coord(cx, cy)} circle (${fmt(innerR)});`,
  ].join("\n");
}

function genBond(s: FigureShape, count: number): string {
  const pts = s.points.length >= 2 ? s.points : [{ x: 0, y: 0 }, { x: s.width, y: 0 }];
  const x1 = s.x + pts[0].x, y1 = s.y + pts[0].y;
  const x2 = s.x + pts[1].x, y2 = s.y + pts[1].y;
  if (count === 1) {
    return `  \\draw ${coord(x1, y1)} -- ${coord(x2, y2)};`;
  }
  const dx = y2 - y1, dy = -(x2 - x1);
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const off = 0.06;
  const nx = (dx / len) * off, ny = (dy / len) * off;
  const lines: string[] = [];
  if (count === 2) {
    lines.push(`  \\draw ${coord(x1 + nx, y1 + ny)} -- ${coord(x2 + nx, y2 + ny)};`);
    lines.push(`  \\draw ${coord(x1 - nx, y1 - ny)} -- ${coord(x2 - nx, y2 - ny)};`);
  } else {
    lines.push(`  \\draw ${coord(x1, y1)} -- ${coord(x2, y2)};`);
    lines.push(`  \\draw ${coord(x1 + nx * 1.5, y1 + ny * 1.5)} -- ${coord(x2 + nx * 1.5, y2 + ny * 1.5)};`);
    lines.push(`  \\draw ${coord(x1 - nx * 1.5, y1 - ny * 1.5)} -- ${coord(x2 - nx * 1.5, y2 - ny * 1.5)};`);
  }
  return lines.join("\n");
}

function genReactionArrow(s: FigureShape): string {
  const pts = s.points.length >= 2 ? s.points : [{ x: 0, y: 0 }, { x: s.width, y: 0 }];
  const lbl = s.label ? ` node[midway, ${tikzLabelPos(s.labelPos ?? "above") || "above"}] {${labelText(s)}}` : "";
  return `  \\draw[->, thick] ${coord(s.x + pts[0].x, s.y + pts[0].y)} -- ${coord(s.x + pts[1].x, s.y + pts[1].y)}${lbl};`;
}

function genOrbitalS(s: FigureShape): string {
  const cx = s.x + s.width / 2;
  const cy = s.y + s.height / 2;
  const r = s.width / 2;
  return `  \\draw[fill=blue!20] ${coord(cx, cy)} circle (${fmt(r)});`;
}

function genOrbitalP(s: FigureShape): string {
  const cx = s.x + s.width / 2;
  const cy = s.y + s.height / 2;
  const ry = s.height / 4;
  const rx = s.width / 2;
  return [
    `  \\draw[fill=red!20] ${coord(cx, cy)} ellipse (${fmt(rx)} and ${fmt(ry)});`,
    `  \\draw[fill=blue!20] ${coord(cx, cy)} ellipse (${fmt(rx)} and ${fmt(ry)});`,
  ].join("\n");
}

// Biology shapes
function genCell(s: FigureShape): string {
  const cx = s.x + s.width / 2;
  const cy = s.y + s.height / 2;
  const opts = buildDrawOptions(s.style);
  const lbl = labelNodeFor(s);
  return `  \\draw[${opts}] ${coord(cx, cy)} ellipse (${fmt(s.width / 2)} and ${fmt(s.height / 2)})${lbl};`;
}

function genNucleus(s: FigureShape): string {
  const cx = s.x + s.width / 2;
  const cy = s.y + s.height / 2;
  const opts = buildDrawOptions(s.style);
  return `  \\draw[${opts}] ${coord(cx, cy)} circle (${fmt(s.width / 2)}) node {${s.label || "Nucleus"}};`;
}

function genMitochondria(s: FigureShape): string {
  const cx = s.x + s.width / 2;
  const cy = s.y + s.height / 2;
  const opts = buildDrawOptions(s.style);
  return [
    `  \\draw[${opts}] ${coord(cx, cy)} ellipse (${fmt(s.width / 2)} and ${fmt(s.height / 2)});`,
    `  % inner membrane folds (cristae)`,
    `  \\draw ${coord(s.x + s.width * 0.3, s.y)} sin ${coord(s.x + s.width * 0.4, cy)} cos ${coord(s.x + s.width * 0.5, s.y + s.height)};`,
  ].join("\n");
}

function genMembrane(s: FigureShape): string {
  const n = Math.floor(s.width / 0.3);
  const lines: string[] = [`  % Phospholipid bilayer`];
  for (let i = 0; i < n; i++) {
    const x = s.x + i * 0.3 + 0.15;
    lines.push(`  \\draw[fill=yellow!30] ${coord(x, s.y + s.height * 0.6)} circle (0.08);`);
    lines.push(`  \\draw ${coord(x, s.y + s.height * 0.6)} -- ${coord(x, s.y + s.height)};`);
    lines.push(`  \\draw[fill=yellow!30] ${coord(x, s.y + s.height * 0.4)} circle (0.08);`);
    lines.push(`  \\draw ${coord(x, s.y + s.height * 0.4)} -- ${coord(x, s.y)};`);
  }
  return lines.join("\n");
}

function genNeuron(s: FigureShape): string {
  const cx = s.x + s.width * 0.2;
  const cy = s.y + s.height / 2;
  return [
    `  % Cell body (soma)`,
    `  \\draw[fill=blue!10] ${coord(cx, cy)} circle (${fmt(s.height * 0.3)});`,
    `  \\node at ${coord(cx, cy)} {${s.label || "soma"}};`,
    `  % Axon`,
    `  \\draw[thick] ${coord(cx + s.height * 0.3, cy)} -- ${coord(s.x + s.width * 0.8, cy)};`,
    `  % Axon terminal`,
    `  \\draw ${coord(s.x + s.width * 0.8, cy)} -- ++(0.3, 0.2);`,
    `  \\draw ${coord(s.x + s.width * 0.8, cy)} -- ++(0.3, -0.2);`,
    `  \\draw ${coord(s.x + s.width * 0.8, cy)} -- ++(0.3, 0);`,
    `  % Dendrites`,
    `  \\draw ${coord(cx - s.height * 0.3, cy)} -- ++(-.4, .3);`,
    `  \\draw ${coord(cx - s.height * 0.3, cy)} -- ++(-.4, -.3);`,
    `  \\draw ${coord(cx - s.height * 0.3, cy)} -- ++(-.5, 0);`,
  ].join("\n");
}

function genSynapse(s: FigureShape): string {
  return [
    `  % Pre-synaptic terminal`,
    `  \\draw[fill=blue!10] ${coord(s.x, s.y + s.height / 2)} circle (${fmt(s.height * 0.3)});`,
    `  % Synaptic cleft`,
    `  \\draw[dashed] ${coord(s.x + s.width * 0.4, s.y)} -- ${coord(s.x + s.width * 0.4, s.y + s.height)};`,
    `  \\draw[dashed] ${coord(s.x + s.width * 0.6, s.y)} -- ${coord(s.x + s.width * 0.6, s.y + s.height)};`,
    `  % Post-synaptic terminal`,
    `  \\draw[fill=red!10] ${coord(s.x + s.width, s.y + s.height / 2)} circle (${fmt(s.height * 0.3)});`,
    `  % Neurotransmitters`,
    `  \\foreach \\y in {0.3, 0.5, 0.7} { \\fill ${coord(s.x + s.width * 0.5, s.y)} ++(0, {\\y*${fmt(s.height)}}) circle (0.04); }`,
  ].join("\n");
}

// ── Dispatcher ──────────────────────────────────────────────────

function generateShapeTikZ(s: FigureShape): string {
  switch (s.kind) {
    case "rect": return genRect(s);
    case "circle": return genCircle(s);
    case "ellipse": return genEllipse(s);
    case "line": return genLine(s);
    case "arrow": return genArrow(s);
    case "polygon": return genPolygon(s);
    case "text": return genText(s);
    case "arc": return genArc(s);
    case "freehand": return genFreehand(s);
    case "polyline": return genLine(s);

    // Circuits
    case "resistor":
    case "capacitor":
    case "inductor":
    case "voltage-source":
    case "current-source":
    case "ground":
    case "switch":
    case "diode":
    case "led":
    case "transistor-npn":
    case "transistor-pnp":
    case "opamp":
      return genCircuitComponent(s);

    // Mechanics
    case "spring": return genSpring(s);
    case "damper": return genDamper(s);
    case "mass": return genMass(s);
    case "pulley": return genPulley(s);
    case "support-pin": return genSupportPin(s);
    case "support-roller": return genSupportRoller(s);
    case "wall": return genWall(s);
    case "ground-hatch": return genGroundHatch(s);
    case "force-arrow": return genForceArrow(s);
    case "moment": return genMoment(s);

    // Physics
    case "wave": return genWave(s);
    case "lens-convex": return genLens(s, true);
    case "lens-concave": return genLens(s, false);
    case "prism": return genPolygon(s);
    case "vector-field": return genLine(s);
    case "mirror-concave": return genArc(s);
    case "mirror-convex": return genArc(s);

    // Math
    case "axes": return genAxes(s);
    case "angle-arc": return genAngleArc(s);
    case "right-angle": return genRightAngle(s);
    case "function-plot": return genFunctionPlot(s);
    case "vector": return genVector(s);
    case "brace": return genBrace(s);

    // CS
    case "flowchart-process": return genFlowchartProcess(s);
    case "flowchart-decision": return genFlowchartDecision(s);
    case "flowchart-io": return genFlowchartIO(s);
    case "flowchart-terminal": return genFlowchartTerminal(s);
    case "automaton-state": return genAutomatonState(s);
    case "automaton-accept": return genAutomatonAccept(s);

    // Chemistry
    case "benzene": return genBenzene(s);
    case "bond-single": return genBond(s, 1);
    case "bond-double": return genBond(s, 2);
    case "bond-triple": return genBond(s, 3);
    case "reaction-arrow": return genReactionArrow(s);
    case "orbital-s": return genOrbitalS(s);
    case "orbital-p": return genOrbitalP(s);

    // Biology
    case "cell": return genCell(s);
    case "nucleus": return genNucleus(s);
    case "mitochondria": return genMitochondria(s);
    case "membrane": return genMembrane(s);
    case "neuron": return genNeuron(s);
    case "synapse": return genSynapse(s);

    default: return `  % Unknown shape: ${s.kind}`;
  }
}

function generateConnectionTikZ(c: Connection): string {
  const opts = buildDrawOptions(c.style);
  if (c.waypoints.length > 0) {
    const path = [coord(0, 0), ...c.waypoints.map((p) => coord(p.x, p.y))].join(" -- ");
    return `  \\draw[${opts}] (${c.fromShapeId}.${c.fromAnchor}) ${path} -- (${c.toShapeId}.${c.toAnchor});`;
  }
  return `  \\draw[${opts}] (${c.fromShapeId}.${c.fromAnchor}) -- (${c.toShapeId}.${c.toAnchor});`;
}

// ── Detect required packages ────────────────────────────────────

function detectPackages(shapes: FigureShape[]): string[] {
  const pkgs = new Set<string>();
  pkgs.add("tikz");

  for (const s of shapes) {
    // Circuits
    if (["resistor", "capacitor", "inductor", "voltage-source", "current-source",
      "ground", "switch", "diode", "led", "transistor-npn", "transistor-pnp", "opamp"].includes(s.kind)) {
      pkgs.add("circuitikz");
    }
    // Decorations (springs, braces)
    if (["spring", "brace"].includes(s.kind)) {
      pkgs.add("tikz-decorations");
    }
    // pgfplots
    if (s.kind === "function-plot") {
      pkgs.add("pgfplots");
    }
    // Automata
    if (["automaton-state", "automaton-accept"].includes(s.kind)) {
      pkgs.add("tikz-automata");
    }
    // Flowchart shapes
    if (["flowchart-decision", "flowchart-io", "flowchart-terminal"].includes(s.kind)) {
      pkgs.add("tikz-shapes");
    }
    // Wall / ground hatching uses the patterns library
    if (["wall", "ground-hatch"].includes(s.kind)) {
      pkgs.add("tikz-patterns");
    }
  }

  return Array.from(pkgs);
}

// ── Main export ─────────────────────────────────────────────────

export function generateTikZ(shapes: FigureShape[], connections: Connection[]): string {
  const sorted = [...shapes].sort((a, b) => a.zIndex - b.zIndex);

  const lines: string[] = [];
  lines.push("\\begin{tikzpicture}");

  for (const s of sorted) {
    const code = generateShapeTikZ(s);
    if (code) lines.push(code);
  }

  for (const c of connections) {
    lines.push(generateConnectionTikZ(c));
  }

  lines.push("\\end{tikzpicture}");

  return lines.join("\n");
}

/**
 * Build `\definecolor{...}{HTML}{hex}` lines for every color actually used by the
 * figure. Many IPE palette names (`seagreen`, `turquoise`, `navy`, `darkmagenta`,
 * `lightblue`, `darkorange`, `darkred`, `lightgreen`, `gold`, `pink`, `violet`,
 * …) are NOT defined in base xcolor, so passing them verbatim to TikZ — as
 * `draw=seagreen` — causes "undefined color" compile errors and a broken
 * preview. We emit explicit HTML-value definitions so LaTeX accepts them
 * regardless of which xcolor option the document is using.
 */
function collectUsedColors(shapes: FigureShape[]): Set<string> {
  const used = new Set<string>();
  for (const s of shapes) {
    if (s.style.stroke && s.style.stroke !== "none") used.add(s.style.stroke);
    if (s.style.fill && s.style.fill !== "none") used.add(s.style.fill);
  }
  return used;
}

function generateColorDefs(shapes: FigureShape[]): string[] {
  const used = collectUsedColors(shapes);
  if (used.size === 0) return [];
  const lines: string[] = [];
  for (const c of IPE_COLORS) {
    if (!used.has(c.name)) continue;
    // Skip plain `black`/`white` — every LaTeX xcolor variant provides them.
    if (c.name === "black" || c.name === "white") continue;
    // Skip the few names that happen to be in base xcolor to avoid "already defined" warnings.
    // base xcolor: red, green, blue, cyan, magenta, yellow, gray, brown, orange,
    // pink, purple, violet, lime, olive, teal.
    if (["red", "green", "blue", "cyan", "magenta", "yellow", "gray",
         "brown", "orange", "pink", "purple", "violet"].includes(c.name)) {
      continue;
    }
    const hex = c.rgb.replace("#", "").toUpperCase();
    lines.push(`\\definecolor{${c.name}}{HTML}{${hex}}`);
  }
  return lines;
}

export function generateFullLatex(shapes: FigureShape[], connections: Connection[]): string {
  const pkgs = detectPackages(shapes);
  const tikz = generateTikZ(shapes, connections);

  const preamble: string[] = [];
  // Always include arrows.meta for IPE-style arrow heads
  preamble.push("\\usetikzlibrary{arrows.meta}");
  if (pkgs.includes("circuitikz")) preamble.push("\\usepackage{circuitikz}");
  if (pkgs.includes("tikz-decorations")) {
    preamble.push("\\usetikzlibrary{decorations.pathmorphing}");
    preamble.push("\\usetikzlibrary{decorations.pathreplacing}");
  }
  if (pkgs.includes("pgfplots")) preamble.push("\\usepackage{pgfplots}");
  if (pkgs.includes("tikz-automata")) preamble.push("\\usetikzlibrary{automata, positioning}");
  if (pkgs.includes("tikz-shapes")) preamble.push("\\usetikzlibrary{shapes.geometric}");
  if (pkgs.includes("tikz-patterns")) preamble.push("\\usetikzlibrary{patterns}");

  // Inject \definecolor lines for IPE palette colours that are not in base xcolor.
  const colorDefs = generateColorDefs(shapes);
  preamble.push(...colorDefs);

  return preamble.length > 0
    ? `% Required packages:\n${preamble.join("\n")}\n\n${tikz}`
    : tikz;
}
