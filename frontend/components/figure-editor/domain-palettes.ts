/**
 * Domain palette definitions — pre-configured shape templates for each scientific domain.
 */

import type { DomainPaletteItem, DomainCategory } from "./types";

// ── Category metadata ───────────────────────────────────────────

export interface CategoryMeta {
  id: DomainCategory;
  label: string;
  labelJa: string;
  icon: string;
  color: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { id: "basic",     label: "Basic",       labelJa: "基本図形",   icon: "⬜", color: "#6b7280" },
  { id: "circuit",   label: "Circuit",     labelJa: "電気回路",   icon: "⚡", color: "#f59e0b" },
  { id: "mechanics", label: "Mechanics",   labelJa: "力学",       icon: "⚙️", color: "#3b82f6" },
  { id: "physics",   label: "Physics",     labelJa: "物理",       icon: "🔬", color: "#8b5cf6" },
  { id: "math",      label: "Math",        labelJa: "数学",       icon: "📐", color: "#10b981" },
  { id: "cs",        label: "CS",          labelJa: "情報",       icon: "💻", color: "#06b6d4" },
  { id: "chemistry", label: "Chemistry",   labelJa: "化学",       icon: "🧪", color: "#ef4444" },
  { id: "biology",   label: "Biology",     labelJa: "生物",       icon: "🧬", color: "#22c55e" },
];

// ── Palette items ───────────────────────────────────────────────

export const PALETTE_ITEMS: DomainPaletteItem[] = [
  // ═══════════ BASIC ═══════════
  {
    kind: "rect", label: "Rectangle", labelJa: "四角形",
    icon: "rect", category: "basic",
    defaultWidth: 2, defaultHeight: 1.5,
    description: "Basic rectangle", descriptionJa: "基本の四角形",
  },
  {
    kind: "circle", label: "Circle", labelJa: "円",
    icon: "circle", category: "basic",
    defaultWidth: 1.5, defaultHeight: 1.5,
    description: "Circle", descriptionJa: "円",
  },
  {
    kind: "ellipse", label: "Ellipse", labelJa: "楕円",
    icon: "ellipse", category: "basic",
    defaultWidth: 2, defaultHeight: 1.2,
    description: "Ellipse", descriptionJa: "楕円",
  },
  {
    kind: "line", label: "Line", labelJa: "直線",
    icon: "line", category: "basic",
    defaultWidth: 3, defaultHeight: 0,
    defaultPoints: [{ x: 0, y: 0 }, { x: 3, y: 0 }],
    description: "Straight line", descriptionJa: "直線",
  },
  {
    kind: "arrow", label: "Arrow", labelJa: "矢印",
    icon: "arrow", category: "basic",
    defaultWidth: 3, defaultHeight: 0,
    defaultPoints: [{ x: 0, y: 0 }, { x: 3, y: 0 }],
    defaultStyle: { arrowEnd: true, arrowEndHead: "normal" },
    description: "Arrow", descriptionJa: "矢印",
  },
  {
    kind: "text", label: "Text", labelJa: "テキスト",
    icon: "text", category: "basic",
    defaultWidth: 2, defaultHeight: 0.8,
    description: "Text label", descriptionJa: "テキストラベル",
  },
  {
    kind: "polygon", label: "Triangle", labelJa: "三角形",
    icon: "polygon", category: "basic",
    defaultWidth: 2, defaultHeight: 1.7,
    defaultPoints: [{ x: 1, y: 1.7 }, { x: 0, y: 0 }, { x: 2, y: 0 }],
    description: "Triangle / polygon", descriptionJa: "三角形・多角形",
  },
  {
    kind: "arc", label: "Arc", labelJa: "弧",
    icon: "arc", category: "basic",
    defaultWidth: 2, defaultHeight: 1,
    description: "Circular arc", descriptionJa: "円弧",
  },
  {
    kind: "freehand", label: "Freehand", labelJa: "フリーハンド",
    icon: "freehand", category: "basic",
    defaultWidth: 3, defaultHeight: 2,
    description: "Freehand drawing", descriptionJa: "フリーハンド描画",
  },

  // ═══════════ CIRCUIT ═══════════
  {
    kind: "resistor", label: "Resistor", labelJa: "抵抗",
    icon: "resistor", category: "circuit",
    defaultWidth: 1.8, defaultHeight: 0.5,
    defaultTikzOptions: { "bipoles/length": "1cm" },
    description: "Resistor (R)", descriptionJa: "抵抗器",
  },
  {
    kind: "capacitor", label: "Capacitor", labelJa: "コンデンサ",
    icon: "capacitor", category: "circuit",
    defaultWidth: 1.4, defaultHeight: 0.5,
    description: "Capacitor (C)", descriptionJa: "コンデンサ",
  },
  {
    kind: "inductor", label: "Inductor", labelJa: "コイル",
    icon: "inductor", category: "circuit",
    defaultWidth: 1.8, defaultHeight: 0.5,
    description: "Inductor (L)", descriptionJa: "インダクタ（コイル）",
  },
  {
    kind: "voltage-source", label: "Voltage Source", labelJa: "電圧源",
    icon: "vsource", category: "circuit",
    defaultWidth: 0.8, defaultHeight: 1.2,
    description: "DC voltage source", descriptionJa: "直流電圧源",
  },
  {
    kind: "current-source", label: "Current Source", labelJa: "電流源",
    icon: "isource", category: "circuit",
    defaultWidth: 0.8, defaultHeight: 1.2,
    description: "Current source", descriptionJa: "電流源",
  },
  {
    kind: "ground", label: "Ground", labelJa: "接地",
    icon: "ground", category: "circuit",
    defaultWidth: 0.6, defaultHeight: 0.5,
    description: "Ground symbol", descriptionJa: "接地記号",
  },
  {
    kind: "switch", label: "Switch", labelJa: "スイッチ",
    icon: "switch", category: "circuit",
    defaultWidth: 1.4, defaultHeight: 0.5,
    description: "Switch", descriptionJa: "スイッチ",
  },
  {
    kind: "diode", label: "Diode", labelJa: "ダイオード",
    icon: "diode", category: "circuit",
    defaultWidth: 1.4, defaultHeight: 0.5,
    description: "Diode", descriptionJa: "ダイオード",
  },
  {
    kind: "led", label: "LED", labelJa: "LED",
    icon: "led", category: "circuit",
    defaultWidth: 1.4, defaultHeight: 0.6,
    description: "Light-emitting diode", descriptionJa: "発光ダイオード",
  },
  {
    kind: "transistor-npn", label: "NPN Transistor", labelJa: "NPNトランジスタ",
    icon: "npn", category: "circuit",
    defaultWidth: 1.2, defaultHeight: 1.4,
    description: "NPN bipolar junction transistor", descriptionJa: "NPNバイポーラトランジスタ",
  },
  {
    kind: "transistor-pnp", label: "PNP Transistor", labelJa: "PNPトランジスタ",
    icon: "pnp", category: "circuit",
    defaultWidth: 1.2, defaultHeight: 1.4,
    description: "PNP bipolar junction transistor", descriptionJa: "PNPバイポーラトランジスタ",
  },
  {
    kind: "opamp", label: "Op-Amp", labelJa: "オペアンプ",
    icon: "opamp", category: "circuit",
    defaultWidth: 1.5, defaultHeight: 1.2,
    description: "Operational amplifier", descriptionJa: "オペアンプ（演算増幅器）",
  },

  // ═══════════ MECHANICS ═══════════
  {
    kind: "spring", label: "Spring", labelJa: "ばね",
    icon: "spring", category: "mechanics",
    defaultWidth: 2.5, defaultHeight: 0.6,
    description: "Coil spring", descriptionJa: "コイルばね",
  },
  {
    kind: "damper", label: "Damper", labelJa: "ダンパー",
    icon: "damper", category: "mechanics",
    defaultWidth: 2.5, defaultHeight: 0.6,
    description: "Viscous damper", descriptionJa: "粘性ダンパー",
  },
  {
    kind: "mass", label: "Mass", labelJa: "質量",
    icon: "mass", category: "mechanics",
    defaultWidth: 1.5, defaultHeight: 1,
    defaultStyle: { fill: "#e5e7eb", fillOpacity: 1 },
    description: "Mass block", descriptionJa: "質量ブロック",
  },
  {
    kind: "pulley", label: "Pulley", labelJa: "滑車",
    icon: "pulley", category: "mechanics",
    defaultWidth: 1.2, defaultHeight: 1.2,
    description: "Pulley wheel", descriptionJa: "滑車",
  },
  {
    kind: "support-pin", label: "Pin Support", labelJa: "ピン支持",
    icon: "pin", category: "mechanics",
    defaultWidth: 1, defaultHeight: 0.8,
    description: "Pin (hinge) support", descriptionJa: "ピン支持（回転支点）",
  },
  {
    kind: "support-roller", label: "Roller Support", labelJa: "ローラー支持",
    icon: "roller", category: "mechanics",
    defaultWidth: 1, defaultHeight: 0.8,
    description: "Roller support", descriptionJa: "ローラー支持",
  },
  {
    kind: "wall", label: "Wall (fixed)", labelJa: "壁 (固定端)",
    icon: "wall", category: "mechanics",
    defaultWidth: 0.4, defaultHeight: 2.5,
    description: "Fixed wall with hatching — attach springs/beams here", descriptionJa: "固定壁 (ハッチング付き) — バネや梁の端を固定",
  },
  {
    kind: "ground-hatch", label: "Ground", labelJa: "床・地面",
    icon: "ground", category: "mechanics",
    defaultWidth: 4, defaultHeight: 0.4,
    description: "Hatched ground line — place under objects", descriptionJa: "ハッチング付き床面 — 物体の下に配置",
  },
  {
    kind: "force-arrow", label: "Force", labelJa: "力",
    icon: "force", category: "mechanics",
    defaultWidth: 2, defaultHeight: 0,
    defaultPoints: [{ x: 0, y: 0 }, { x: 2, y: 0 }],
    defaultStyle: { arrowEnd: true, arrowEndHead: "normal", strokeWidth: 1.5, stroke: "red" },
    description: "Force vector", descriptionJa: "力ベクトル",
  },
  {
    kind: "moment", label: "Moment", labelJa: "モーメント",
    icon: "moment", category: "mechanics",
    defaultWidth: 1.5, defaultHeight: 1.5,
    description: "Moment / torque", descriptionJa: "モーメント（トルク）",
  },

  // ═══════════ PHYSICS ═══════════
  {
    kind: "wave", label: "Wave", labelJa: "波",
    icon: "wave", category: "physics",
    defaultWidth: 4, defaultHeight: 1,
    description: "Sinusoidal wave", descriptionJa: "正弦波",
  },
  {
    kind: "lens-convex", label: "Convex Lens", labelJa: "凸レンズ",
    icon: "lens", category: "physics",
    defaultWidth: 0.6, defaultHeight: 2,
    description: "Convex (converging) lens", descriptionJa: "凸レンズ（収束レンズ）",
  },
  {
    kind: "lens-concave", label: "Concave Lens", labelJa: "凹レンズ",
    icon: "lens", category: "physics",
    defaultWidth: 0.6, defaultHeight: 2,
    description: "Concave (diverging) lens", descriptionJa: "凹レンズ（発散レンズ）",
  },
  {
    kind: "prism", label: "Prism", labelJa: "プリズム",
    icon: "prism", category: "physics",
    defaultWidth: 2, defaultHeight: 1.7,
    defaultPoints: [{ x: 1, y: 1.7 }, { x: 0, y: 0 }, { x: 2, y: 0 }],
    description: "Triangular prism", descriptionJa: "三角プリズム",
  },
  {
    kind: "vector-field", label: "Field Lines", labelJa: "電場/磁場線",
    icon: "field", category: "physics",
    defaultWidth: 3, defaultHeight: 2,
    description: "Electric/magnetic field lines", descriptionJa: "電場・磁場線",
  },

  // ═══════════ MATH ═══════════
  {
    kind: "axes", label: "Axes", labelJa: "座標軸",
    icon: "axes", category: "math",
    defaultWidth: 4, defaultHeight: 3,
    defaultStyle: { arrowEnd: true, arrowEndHead: "normal" },
    description: "Coordinate axes with labels", descriptionJa: "座標軸（ラベル付き）",
  },
  {
    kind: "angle-arc", label: "Angle", labelJa: "角度",
    icon: "angle", category: "math",
    defaultWidth: 1, defaultHeight: 1,
    description: "Angle arc with label", descriptionJa: "角度弧（ラベル付き）",
  },
  {
    kind: "right-angle", label: "Right Angle", labelJa: "直角",
    icon: "rightangle", category: "math",
    defaultWidth: 0.4, defaultHeight: 0.4,
    description: "Right angle marker", descriptionJa: "直角記号",
  },
  {
    kind: "function-plot", label: "Function", labelJa: "関数グラフ",
    icon: "plot", category: "math",
    defaultWidth: 4, defaultHeight: 3,
    defaultTikzOptions: { domain: "-2:2", samples: "100" },
    description: "Function graph (y=f(x))", descriptionJa: "関数グラフ y=f(x)",
  },
  {
    kind: "vector", label: "Vector", labelJa: "ベクトル",
    icon: "vector", category: "math",
    defaultWidth: 2, defaultHeight: 1,
    defaultPoints: [{ x: 0, y: 0 }, { x: 2, y: 1 }],
    defaultStyle: { arrowEnd: true, arrowEndHead: "normal", strokeWidth: 1.2 },
    description: "Mathematical vector", descriptionJa: "数学ベクトル",
  },
  {
    kind: "brace", label: "Brace", labelJa: "波括弧",
    icon: "brace", category: "math",
    defaultWidth: 0.3, defaultHeight: 2,
    description: "Decorative brace", descriptionJa: "装飾括弧",
  },

  // ═══════════ CS / INFORMATION ═══════════
  {
    kind: "flowchart-process", label: "Process", labelJa: "処理",
    icon: "process", category: "cs",
    defaultWidth: 2.5, defaultHeight: 1,
    defaultStyle: { fill: "#dbeafe", fillOpacity: 1 },
    description: "Flowchart process box", descriptionJa: "フローチャート処理ボックス",
  },
  {
    kind: "flowchart-decision", label: "Decision", labelJa: "判断",
    icon: "decision", category: "cs",
    defaultWidth: 2, defaultHeight: 2,
    defaultStyle: { fill: "#fef3c7", fillOpacity: 1 },
    description: "Flowchart decision diamond", descriptionJa: "フローチャート判断ひし形",
  },
  {
    kind: "flowchart-io", label: "I/O", labelJa: "入出力",
    icon: "io", category: "cs",
    defaultWidth: 2.5, defaultHeight: 1,
    defaultStyle: { fill: "#d1fae5", fillOpacity: 1 },
    description: "Flowchart I/O parallelogram", descriptionJa: "フローチャート入出力",
  },
  {
    kind: "flowchart-terminal", label: "Terminal", labelJa: "端子",
    icon: "terminal", category: "cs",
    defaultWidth: 2, defaultHeight: 0.8,
    defaultStyle: { fill: "#fce7f3", fillOpacity: 1 },
    description: "Flowchart start/end", descriptionJa: "フローチャート開始・終了",
  },
  {
    kind: "automaton-state", label: "State", labelJa: "状態",
    icon: "state", category: "cs",
    defaultWidth: 1.2, defaultHeight: 1.2,
    description: "Automaton state (DFA/NFA)", descriptionJa: "オートマトン状態",
  },
  {
    kind: "automaton-accept", label: "Accept State", labelJa: "受理状態",
    icon: "accept", category: "cs",
    defaultWidth: 1.2, defaultHeight: 1.2,
    description: "Automaton accepting state", descriptionJa: "オートマトン受理状態",
  },

  // ═══════════ CHEMISTRY ═══════════
  {
    kind: "benzene", label: "Benzene", labelJa: "ベンゼン環",
    icon: "benzene", category: "chemistry",
    defaultWidth: 1.5, defaultHeight: 1.5,
    description: "Benzene ring", descriptionJa: "ベンゼン環",
  },
  {
    kind: "bond-single", label: "Single Bond", labelJa: "単結合",
    icon: "bond1", category: "chemistry",
    defaultWidth: 1, defaultHeight: 0,
    defaultPoints: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
    description: "Single covalent bond", descriptionJa: "単結合",
  },
  {
    kind: "bond-double", label: "Double Bond", labelJa: "二重結合",
    icon: "bond2", category: "chemistry",
    defaultWidth: 1, defaultHeight: 0,
    defaultPoints: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
    description: "Double covalent bond", descriptionJa: "二重結合",
  },
  {
    kind: "bond-triple", label: "Triple Bond", labelJa: "三重結合",
    icon: "bond3", category: "chemistry",
    defaultWidth: 1, defaultHeight: 0,
    defaultPoints: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
    description: "Triple covalent bond", descriptionJa: "三重結合",
  },
  {
    kind: "reaction-arrow", label: "Reaction Arrow", labelJa: "反応矢印",
    icon: "rxn", category: "chemistry",
    defaultWidth: 2.5, defaultHeight: 0,
    defaultPoints: [{ x: 0, y: 0 }, { x: 2.5, y: 0 }],
    defaultStyle: { arrowEnd: true, arrowEndHead: "normal", strokeWidth: 1.2 },
    description: "Chemical reaction arrow", descriptionJa: "化学反応矢印",
  },
  {
    kind: "orbital-s", label: "s Orbital", labelJa: "s軌道",
    icon: "orbital-s", category: "chemistry",
    defaultWidth: 1, defaultHeight: 1,
    description: "Spherical s orbital", descriptionJa: "球形s軌道",
  },
  {
    kind: "orbital-p", label: "p Orbital", labelJa: "p軌道",
    icon: "orbital-p", category: "chemistry",
    defaultWidth: 0.8, defaultHeight: 1.6,
    description: "Dumbbell p orbital", descriptionJa: "ダンベル型p軌道",
  },

  // ═══════════ BIOLOGY ═══════════
  {
    kind: "cell", label: "Cell", labelJa: "細胞",
    icon: "cell", category: "biology",
    defaultWidth: 3, defaultHeight: 2,
    defaultStyle: { fill: "#dcfce7", fillOpacity: 0.5 },
    description: "Biological cell", descriptionJa: "生物細胞",
  },
  {
    kind: "nucleus", label: "Nucleus", labelJa: "細胞核",
    icon: "nucleus", category: "biology",
    defaultWidth: 1.2, defaultHeight: 1.2,
    defaultStyle: { fill: "#c4b5fd", fillOpacity: 0.6 },
    description: "Cell nucleus", descriptionJa: "細胞核",
  },
  {
    kind: "mitochondria", label: "Mitochondria", labelJa: "ミトコンドリア",
    icon: "mito", category: "biology",
    defaultWidth: 1.5, defaultHeight: 0.8,
    defaultStyle: { fill: "#fecaca", fillOpacity: 0.5 },
    description: "Mitochondrion", descriptionJa: "ミトコンドリア",
  },
  {
    kind: "membrane", label: "Membrane", labelJa: "細胞膜",
    icon: "membrane", category: "biology",
    defaultWidth: 4, defaultHeight: 0.6,
    description: "Phospholipid bilayer", descriptionJa: "リン脂質二重層",
  },
  {
    kind: "neuron", label: "Neuron", labelJa: "ニューロン",
    icon: "neuron", category: "biology",
    defaultWidth: 4, defaultHeight: 2,
    description: "Nerve cell", descriptionJa: "神経細胞",
  },
  {
    kind: "synapse", label: "Synapse", labelJa: "シナプス",
    icon: "synapse", category: "biology",
    defaultWidth: 2, defaultHeight: 1.5,
    description: "Synaptic junction", descriptionJa: "シナプス接合部",
  },
];

/** Look up a palette item by kind */
export function getPaletteItem(kind: string): DomainPaletteItem | undefined {
  return PALETTE_ITEMS.find((p) => p.kind === kind);
}

/** Get all items for a category */
export function getItemsByCategory(cat: DomainCategory): DomainPaletteItem[] {
  return PALETTE_ITEMS.filter((p) => p.category === cat);
}
