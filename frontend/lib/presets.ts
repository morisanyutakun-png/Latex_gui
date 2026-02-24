/**
 * Presets for engineering/science block types
 * Each preset provides ready-to-use code that generates correct LaTeX output
 */

// ──── Circuit Presets (circuitikz) ────

export interface CircuitPreset {
  id: string;
  name: string;
  description: string;
  code: string;
}

export const CIRCUIT_PRESETS: CircuitPreset[] = [
  {
    id: "voltage-divider",
    name: "分圧回路",
    description: "抵抗器2つによる電圧分圧回路",
    code: `\\draw (0,0) to[V, v=$V_{in}$] (0,3)
  to[R, l=$R_1$] (3,3)
  to[R, l=$R_2$] (3,0) -- (0,0);
\\draw (3,3) to[short, -o] (4,3) node[right]{$V_{out}$};
\\draw (3,0) to[short, -o] (4,0) node[right]{GND};`,
  },
  {
    id: "rc-filter",
    name: "RC\u30d5\u30a3\u30eb\u30bf",
    description: "RC\u30ed\u30fc\u30d1\u30b9\u30d5\u30a3\u30eb\u30bf",
    code: `\\draw (0,0) to[V, v=$V_{in}$] (0,3)
  to[R, l=$R$] (3,3)
  to[C, l=$C$] (3,0) -- (0,0);
\\draw (3,3) to[short, -o] (4.5,3) node[right]{$V_{out}$};
\\draw (3,0) to[short, -o] (4.5,0) node[right]{GND};`,
  },
  {
    id: "rlc-series",
    name: "RLC\u76f4\u5217",
    description: "RLC\u76f4\u5217\u56de\u8def",
    code: `\\draw (0,0) to[V, v=$V_s$] (0,4)
  to[R, l=$R$] (3,4)
  to[L, l=$L$] (3,2)
  to[C, l=$C$] (3,0) -- (0,0);`,
  },
  {
    id: "opamp-inverting",
    name: "\u53cd\u8ee2\u5897\u5e45\u5668",
    description: "\u30aa\u30da\u30a2\u30f3\u30d7\u53cd\u8ee2\u5897\u5e45\u56de\u8def",
    code: `\\draw (0,0) node[op amp, noinv input up] (opamp) {}
  (opamp.-) -- ++(-0.5,0) to[R, l_=$R_1$] ++(-2,0) node[left]{$V_{in}$}
  (opamp.-) -- ++(0,1.5) to[R, l=$R_f$] ++(2.5,0) -| (opamp.out)
  (opamp.+) -- ++(0,-0.5) node[ground]{}
  (opamp.out) to[short, -o] ++(0.5,0) node[right]{$V_{out}$};`,
  },
  {
    id: "wheatstone-bridge",
    name: "\u30db\u30a4\u30fc\u30c8\u30b9\u30c8\u30f3\u30d6\u30ea\u30c3\u30b8",
    description: "\u30db\u30a4\u30fc\u30c8\u30b9\u30c8\u30f3\u30d6\u30ea\u30c3\u30b8\u56de\u8def",
    code: `\\draw (0,0) to[V, v=$V_s$] (0,4)
  -- (2,4) to[R, l=$R_1$] (4,2)
  to[R, l=$R_3$] (2,0) -- (0,0);
\\draw (2,4) to[R, l_=$R_2$] (0,2)
  to[R, l_=$R_4$] (2,0);
\\draw (0,2) to[voltmeter, l=$V_g$] (4,2);`,
  },
  {
    id: "transistor-ce",
    name: "CE\u589e\u5e45\u5668",
    description: "\u30c8\u30e9\u30f3\u30b8\u30b9\u30bf\u30a8\u30df\u30c3\u30bf\u63a5\u5730\u589e\u5e45\u56de\u8def",
    code: `\\draw (3,0) node[npn] (Q) {}
  (Q.B) -- ++(-1,0) to[R, l=$R_B$] ++(-2,0) node[left]{$V_{in}$}
  (Q.C) to[R, l=$R_C$] ++(0,2) -- ++(0,0.3) node[vcc]{$V_{CC}$}
  (Q.E) to[R, l=$R_E$] ++(0,-2) node[ground]{}
  (Q.C) to[short, -o] ++(1,0) node[right]{$V_{out}$};`,
  },
];

// ──── Diagram Presets (TikZ) ────

export interface DiagramPreset {
  id: string;
  name: string;
  description: string;
  diagramType: string;
  code: string;
}

export const DIAGRAM_PRESETS: DiagramPreset[] = [
  {
    id: "flowchart-basic",
    name: "\u57fa\u672c\u30d5\u30ed\u30fc\u30c1\u30e3\u30fc\u30c8",
    description: "\u958b\u59cb\u30fb\u51e6\u7406\u30fb\u5206\u5c90\u30fb\u7d42\u4e86\u306e\u57fa\u672c\u30d5\u30ed\u30fc",
    diagramType: "flowchart",
    code: `[node distance=1.5cm, auto,
  startstop/.style={rectangle, rounded corners, minimum width=3cm, minimum height=0.8cm, text centered, draw=black, fill=red!20},
  process/.style={rectangle, minimum width=3cm, minimum height=0.8cm, text centered, draw=black, fill=blue!15},
  decision/.style={diamond, minimum width=3cm, minimum height=0.8cm, text centered, draw=black, fill=green!15},
  arrow/.style={thick,->,>=stealth}]

\\node (start) [startstop] {開始};
\\node (process1) [process, below of=start] {処理A};
\\node (decision1) [decision, below of=process1, yshift=-0.5cm] {条件?};
\\node (process2) [process, below of=decision1, yshift=-0.5cm] {処理B};
\\node (stop) [startstop, below of=process2] {終了};
\\node (process3) [process, right of=decision1, xshift=3cm] {処理C};

\\draw [arrow] (start) -- (process1);
\\draw [arrow] (process1) -- (decision1);
\\draw [arrow] (decision1) -- node[left] {Yes} (process2);
\\draw [arrow] (decision1) -- node[above] {No} (process3);
\\draw [arrow] (process2) -- (stop);
\\draw [arrow] (process3) |- (stop);`,
  },
  {
    id: "block-diagram",
    name: "\u30d6\u30ed\u30c3\u30af\u56f3",
    description: "\u5236\u5fa1\u30b7\u30b9\u30c6\u30e0\u306e\u30d6\u30ed\u30c3\u30af\u56f3",
    diagramType: "block",
    code: `[auto, node distance=2cm, >=latex',
  block/.style={draw, fill=blue!10, rectangle, minimum height=2em, minimum width=4em},
  sum/.style={draw, fill=blue!10, circle, node distance=1.5cm},
  input/.style={coordinate},
  output/.style={coordinate}]

\\node [input] (input) {};
\\node [sum, right of=input] (sum) {$\\Sigma$};
\\node [block, right of=sum, node distance=2.5cm] (controller) {$G_c(s)$};
\\node [block, right of=controller, node distance=3cm] (plant) {$G_p(s)$};
\\node [output, right of=plant, node distance=2cm] (output) {};
\\node [block, below of=controller, node distance=1.5cm] (sensor) {$H(s)$};

\\draw [->] (input) -- node {$R(s)$} (sum);
\\draw [->] (sum) -- node {$E(s)$} (controller);
\\draw [->] (controller) -- node {$U(s)$} (plant);
\\draw [->] (plant) -- node [name=y] {$Y(s)$}(output);
\\draw [->] (y) |- (sensor);
\\draw [->] (sensor) -| node[pos=0.99] {$-$} (sum);`,
  },
  {
    id: "state-machine",
    name: "\u72b6\u614b\u9077\u79fb\u56f3",
    description: "\u30aa\u30fc\u30c8\u30de\u30c8\u30f3\u72b6\u614b\u9077\u79fb\u56f3",
    diagramType: "state",
    code: `[->, >=stealth', shorten >=1pt, auto, node distance=3cm, semithick,
  state/.style={circle, draw, fill=blue!10, minimum size=1.2cm}]

\\node[state, initial] (q0) {$q_0$};
\\node[state] (q1) [right of=q0] {$q_1$};
\\node[state, accepting] (q2) [right of=q1] {$q_2$};

\\path (q0) edge [bend left] node {$a$} (q1)
            edge [loop above] node {$b$} (q0)
      (q1) edge [bend left] node {$b$} (q0)
            edge node {$a$} (q2)
      (q2) edge [loop above] node {$a,b$} (q2);`,
  },
  {
    id: "tree-diagram",
    name: "\u30c4\u30ea\u30fc\u56f3",
    description: "\u968e\u5c64\u69cb\u9020\u306e\u30c4\u30ea\u30fc\u56f3",
    diagramType: "tree",
    code: `[level distance=1.5cm, sibling distance=3cm,
  every node/.style={draw, rounded corners, fill=blue!8, minimum width=2cm, minimum height=0.6cm, text centered, font=\\small}]

\\node {ルート}
  child { node {子A}
    child { node {孫A1} }
    child { node {孫A2} }
  }
  child { node {子B}
    child { node {孫B1} }
    child { node {孫B2} }
    child { node {孫B3} }
  };`,
  },
  {
    id: "network-topology",
    name: "\u30cd\u30c3\u30c8\u30ef\u30fc\u30af\u56f3",
    description: "\u30cd\u30c3\u30c8\u30ef\u30fc\u30af\u30c8\u30dd\u30ed\u30b8\u56f3",
    diagramType: "block",
    code: `[node distance=2.5cm,
  server/.style={rectangle, draw, fill=blue!15, minimum width=2cm, minimum height=1cm, text centered, font=\\small},
  client/.style={rectangle, rounded corners, draw, fill=green!15, minimum width=1.5cm, minimum height=0.8cm, text centered, font=\\small},
  switch/.style={diamond, draw, fill=orange!15, minimum width=1.5cm, text centered, font=\\small}]

\\node[server] (server) {サーバー};
\\node[switch] (sw) [below of=server] {SW};
\\node[client] (c1) [below left of=sw] {PC1};
\\node[client] (c2) [below of=sw] {PC2};
\\node[client] (c3) [below right of=sw] {PC3};

\\draw[thick] (server) -- (sw);
\\draw[thick] (sw) -- (c1);
\\draw[thick] (sw) -- (c2);
\\draw[thick] (sw) -- (c3);`,
  },
  {
    id: "sequence-diagram",
    name: "\u30b7\u30fc\u30b1\u30f3\u30b9\u56f3",
    description: "\u30e1\u30c3\u30bb\u30fc\u30b8\u30d1\u30c3\u30b7\u30f3\u30b0\u306e\u30b7\u30fc\u30b1\u30f3\u30b9\u56f3",
    diagramType: "sequence",
    code: `[node distance=3cm,
  entity/.style={rectangle, draw, fill=blue!10, minimum width=1.5cm, minimum height=0.6cm, font=\\small}]

\\node[entity] (A) {Client};
\\node[entity, right of=A] (B) {Server};
\\node[entity, right of=B] (C) {DB};

\\draw[dashed] (A) -- ++(0,-5);
\\draw[dashed] (B) -- ++(0,-5);
\\draw[dashed] (C) -- ++(0,-5);

\\draw[->,thick] ([yshift=-1cm]A.south) -- node[above,font=\\footnotesize]{Request} ([yshift=-1cm]B.south);
\\draw[->,thick] ([yshift=-2cm]B.south) -- node[above,font=\\footnotesize]{Query} ([yshift=-2cm]C.south);
\\draw[<-,thick,dashed] ([yshift=-3cm]B.south) -- node[above,font=\\footnotesize]{Result} ([yshift=-3cm]C.south);
\\draw[<-,thick,dashed] ([yshift=-4cm]A.south) -- node[above,font=\\footnotesize]{Response} ([yshift=-4cm]B.south);`,
  },
];

// ──── Chemistry Presets ────

export interface ChemistryPreset {
  id: string;
  name: string;
  description: string;
  formula: string;
}

export const CHEMISTRY_PRESETS: ChemistryPreset[] = [
  { id: "water", name: "水の生成", description: "水素と酸素から水", formula: "2H2 + O2 -> 2H2O" },
  { id: "combustion", name: "メタン燃焼", description: "メタンの完全燃焼", formula: "CH4 + 2O2 -> CO2 + 2H2O" },
  { id: "photosynthesis", name: "光合成", description: "光合成の化学反応", formula: "6CO2 + 6H2O ->[\u5149] C6H12O6 + 6O2" },
  { id: "acid-base", name: "酸塩基反応", description: "塩酸と水酸化ナトリウム", formula: "HCl + NaOH -> NaCl + H2O" },
  { id: "redox", name: "酸化還元", description: "鉄の酸化還元反応", formula: "Fe^{2+} -> Fe^{3+} + e-" },
  { id: "equilibrium", name: "化学平衡", description: "可逆反応の平衡", formula: "N2 + 3H2 <=> 2NH3" },
  { id: "sulfuric-acid", name: "硫酸生成", description: "硫酸の工業的製法", formula: "2SO2 + O2 ->[\u89e6\u5a92] 2SO3" },
  { id: "ester", name: "エステル化", description: "エステル化反応", formula: "CH3COOH + C2H5OH <=>[\u9178\u89e6\u5a92] CH3COOC2H5 + H2O" },
];

// ──── Chart Presets (pgfplots) ────

export interface ChartPreset {
  id: string;
  name: string;
  description: string;
  chartType: string;
  code: string;
}

export const CHART_PRESETS: ChartPreset[] = [
  {
    id: "sine-wave",
    name: "正弦波",
    description: "sin関数のグラフ",
    chartType: "line",
    code: `\\addplot[blue, thick, domain=0:360, samples=100] {sin(x)};
\\addlegendentry{$\\sin(x)$}`,
  },
  {
    id: "multi-function",
    name: "複数関数",
    description: "sin/cos 複数プロット",
    chartType: "line",
    code: `\\addplot[blue, thick, domain=0:360, samples=100] {sin(x)};
\\addlegendentry{$\\sin(x)$}
\\addplot[red, thick, domain=0:360, samples=100] {cos(x)};
\\addlegendentry{$\\cos(x)$}`,
  },
  {
    id: "bar-chart",
    name: "棒グラフ",
    description: "カテゴリ別の棒グラフ",
    chartType: "bar",
    code: `\\addplot[ybar, fill=blue!30, draw=blue] coordinates {
  (1, 20) (2, 35) (3, 28) (4, 45) (5, 32)
};`,
  },
  {
    id: "scatter-plot",
    name: "散布図",
    description: "データの散布図",
    chartType: "scatter",
    code: `\\addplot[only marks, mark=*, blue] coordinates {
  (1,2) (2,3.5) (3,3) (4,5.5) (5,4.8) (6,6.2) (7,5.5) (8,7.8) (9,8.2) (10,9)
};`,
  },
  {
    id: "exp-decay",
    name: "指数減衰",
    description: "指数減衰グラフ",
    chartType: "line",
    code: `\\addplot[red, thick, domain=0:5, samples=100] {exp(-x)};
\\addlegendentry{$e^{-x}$}`,
  },
  {
    id: "bode-plot",
    name: "ボード線図 (概略)",
    description: "周波数応答の概略",
    chartType: "line",
    code: `\\addplot[blue, thick] coordinates {
  (0.1, 0) (1, 0) (10, -20) (100, -40) (1000, -60)
};
\\addlegendentry{Gain [dB]}`,
  },
];
