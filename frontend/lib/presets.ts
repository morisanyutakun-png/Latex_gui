/**
 * Presets for engineering/science block types
 * Each preset provides ready-to-use code that generates correct LaTeX output
 */

// ──── Circuit Presets (circuitikz) ────

export interface CircuitPreset {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  code: string;
}

export const CIRCUIT_CATEGORIES = [
  "すべて",
  "基本回路",
  "フィルタ",
  "増幅器",
  "電源",
  "デジタル",
  "センサ・計測",
  "通信",
] as const;

export const CIRCUIT_PRESETS: CircuitPreset[] = [
  // ── 基本回路 ──
  {
    id: "voltage-divider",
    name: "分圧回路",
    description: "抵抗器2つによる電圧分圧回路",
    category: "基本回路",
    tags: ["抵抗", "分圧", "電圧", "基本"],
    code: `\\draw (0,0) to[V, v=$V_{in}$] (0,3)
  to[R, l=$R_1$] (3,3)
  to[R, l=$R_2$] (3,0) -- (0,0);
\\draw (3,3) to[short, -o] (4,3) node[right]{$V_{out}$};
\\draw (3,0) to[short, -o] (4,0) node[right]{GND};`,
  },
  {
    id: "current-divider",
    name: "分流回路",
    description: "並列抵抗による電流分流",
    category: "基本回路",
    tags: ["抵抗", "並列", "電流", "分流"],
    code: `\\draw (0,0) to[I, l=$I_s$] (0,3) -- (3,3);
\\draw (1,3) to[R, l=$R_1$] (1,0);
\\draw (3,3) to[R, l=$R_2$] (3,0);
\\draw (0,0) -- (3,0);`,
  },
  {
    id: "series-parallel",
    name: "直並列回路",
    description: "直列と並列の組み合わせ",
    category: "基本回路",
    tags: ["直列", "並列", "抵抗", "組み合わせ"],
    code: `\\draw (0,0) to[V, v=$V$] (0,4)
  to[R, l=$R_1$] (3,4) -- (3,3.5);
\\draw (3,3.5) -- (2,3.5) to[R, l=$R_2$] (2,0.5) -- (3,0.5);
\\draw (3,3.5) -- (4,3.5) to[R, l=$R_3$] (4,0.5) -- (3,0.5);
\\draw (3,0.5) -- (3,0) -- (0,0);`,
  },
  {
    id: "wheatstone-bridge",
    name: "ホイートストンブリッジ",
    description: "ブリッジ回路（精密抵抗測定）",
    category: "基本回路",
    tags: ["ブリッジ", "測定", "抵抗", "精密"],
    code: `\\draw (0,0) to[V, v=$V_s$] (0,4)
  -- (2,4) to[R, l=$R_1$] (4,2)
  to[R, l=$R_3$] (2,0) -- (0,0);
\\draw (2,4) to[R, l_=$R_2$] (0,2)
  to[R, l_=$R_4$] (2,0);
\\draw (0,2) to[voltmeter, l=$V_g$] (4,2);`,
  },
  {
    id: "rc-series",
    name: "RC直列回路",
    description: "RC直列（充放電）",
    category: "基本回路",
    tags: ["RC", "充電", "放電", "過渡応答"],
    code: `\\draw (0,0) to[V, v=$V$] (0,3)
  to[R, l=$R$] (3,3)
  to[C, l=$C$] (3,0) -- (0,0);
\\draw (3,3) to[short, -o] (4.5,3) node[right]{$V_C$};`,
  },
  {
    id: "rl-series",
    name: "RL直列回路",
    description: "RL直列（過渡応答）",
    category: "基本回路",
    tags: ["RL", "コイル", "過渡応答"],
    code: `\\draw (0,0) to[V, v=$V$] (0,3)
  to[R, l=$R$] (3,3)
  to[L, l=$L$] (3,0) -- (0,0);`,
  },
  // ── フィルタ ──
  {
    id: "rc-lowpass",
    name: "RCローパス",
    description: "RCローパスフィルタ",
    category: "フィルタ",
    tags: ["RC", "ローパス", "フィルタ", "コンデンサ"],
    code: `\\draw (0,0) to[V, v=$V_{in}$] (0,3)
  to[R, l=$R$] (3,3)
  to[C, l=$C$] (3,0) -- (0,0);
\\draw (3,3) to[short, -o] (4.5,3) node[right]{$V_{out}$};
\\draw (3,0) to[short, -o] (4.5,0) node[right]{GND};`,
  },
  {
    id: "rc-highpass",
    name: "RCハイパス",
    description: "RCハイパスフィルタ",
    category: "フィルタ",
    tags: ["RC", "ハイパス", "フィルタ", "コンデンサ"],
    code: `\\draw (0,0) to[V, v=$V_{in}$] (0,3)
  to[C, l=$C$] (3,3)
  to[R, l=$R$] (3,0) -- (0,0);
\\draw (3,3) to[short, -o] (4.5,3) node[right]{$V_{out}$};
\\draw (3,0) to[short, -o] (4.5,0) node[right]{GND};`,
  },
  {
    id: "rl-lowpass",
    name: "RLローパス",
    description: "RLローパスフィルタ",
    category: "フィルタ",
    tags: ["RL", "ローパス", "コイル", "インダクタ"],
    code: `\\draw (0,0) to[V, v=$V_{in}$] (0,3)
  to[L, l=$L$] (3,3)
  to[R, l=$R$] (3,0) -- (0,0);
\\draw (3,3) to[short, -o] (4.5,3) node[right]{$V_{out}$};
\\draw (3,0) to[short, -o] (4.5,0) node[right]{GND};`,
  },
  {
    id: "rlc-series",
    name: "RLC直列共振",
    description: "RLC直列共振回路",
    category: "フィルタ",
    tags: ["RLC", "共振", "直列", "バンドパス"],
    code: `\\draw (0,0) to[V, v=$V_s$] (0,4)
  to[R, l=$R$] (3,4)
  to[L, l=$L$] (3,2)
  to[C, l=$C$] (3,0) -- (0,0);`,
  },
  {
    id: "rlc-parallel",
    name: "RLC並列共振",
    description: "RLC並列共振回路（タンク回路）",
    category: "フィルタ",
    tags: ["RLC", "並列", "タンク", "共振"],
    code: `\\draw (0,0) to[I, l=$I_s$] (0,4) -- (4,4);
\\draw (1,4) to[R, l=$R$] (1,0);
\\draw (2.5,4) to[L, l=$L$] (2.5,0);
\\draw (4,4) to[C, l=$C$] (4,0);
\\draw (0,0) -- (4,0);
\\draw (4,4) to[short, -o] (5,4) node[right]{$V_{out}$};
\\draw (4,0) to[short, -o] (5,0) node[right]{GND};`,
  },
  {
    id: "bandpass-filter",
    name: "バンドパスフィルタ",
    description: "二段RC構成のバンドパス",
    category: "フィルタ",
    tags: ["バンドパス", "RC", "フィルタ", "二段"],
    code: `\\draw (0,0) to[V, v=$V_{in}$] (0,3)
  to[C, l=$C_1$] (2,3)
  to[R, l=$R_1$] (2,0) -- (0,0);
\\draw (2,3) to[R, l=$R_2$] (4,3)
  to[C, l=$C_2$] (4,0) -- (2,0);
\\draw (4,3) to[short, -o] (5.5,3) node[right]{$V_{out}$};
\\draw (4,0) to[short, -o] (5.5,0);`,
  },
  // ── 増幅器 ──
  {
    id: "opamp-inverting",
    name: "反転増幅器",
    description: "オペアンプ反転増幅回路",
    category: "増幅器",
    tags: ["オペアンプ", "反転", "増幅"],
    code: `\\draw (0,0) node[op amp, noinv input up] (opamp) {}
  (opamp.-) -- ++(-0.5,0) to[R, l_=$R_1$] ++(-2,0) node[left]{$V_{in}$}
  (opamp.-) -- ++(0,1.5) to[R, l=$R_f$] ++(2.5,0) -| (opamp.out)
  (opamp.+) -- ++(0,-0.5) node[ground]{}
  (opamp.out) to[short, -o] ++(0.5,0) node[right]{$V_{out}$};`,
  },
  {
    id: "opamp-noninverting",
    name: "非反転増幅器",
    description: "オペアンプ非反転増幅回路",
    category: "増幅器",
    tags: ["オペアンプ", "非反転", "増幅"],
    code: `\\draw (0,0) node[op amp, noinv input up] (opamp) {}
  (opamp.+) -- ++(-1,0) node[left]{$V_{in}$}
  (opamp.-) -- ++(0,-1) coordinate(fb)
  (fb) to[R, l=$R_1$] ++(0,-1.5) node[ground]{}
  (fb) to[R, l=$R_f$] ++(2.5,0) -| (opamp.out)
  (opamp.out) to[short, -o] ++(0.5,0) node[right]{$V_{out}$};`,
  },
  {
    id: "opamp-buffer",
    name: "ボルテージフォロワ",
    description: "オペアンプバッファ（電圧フォロワ）",
    category: "増幅器",
    tags: ["オペアンプ", "バッファ", "フォロワ"],
    code: `\\draw (0,0) node[op amp, noinv input up] (opamp) {}
  (opamp.+) -- ++(-1,0) node[left]{$V_{in}$}
  (opamp.-) -- ++(0,-1) -| (opamp.out)
  (opamp.out) to[short, -o] ++(0.5,0) node[right]{$V_{out}$};`,
  },
  {
    id: "opamp-diff",
    name: "差動増幅器",
    description: "オペアンプ差動増幅回路",
    category: "増幅器",
    tags: ["オペアンプ", "差動", "減算"],
    code: `\\draw (0,0) node[op amp, noinv input up] (opamp) {}
  (opamp.-) -- ++(-0.5,0) to[R, l_=$R_1$] ++(-2,0) node[left]{$V_1$}
  (opamp.-) -- ++(0,1.5) to[R, l=$R_f$] ++(2.5,0) -| (opamp.out)
  (opamp.+) -- ++(-0.5,0) to[R, l=$R_2$] ++(-2,0) node[left]{$V_2$}
  (opamp.+) -- ++(0,-0.8) to[R, l=$R_3$] ++(0,-1) node[ground]{}
  (opamp.out) to[short, -o] ++(0.5,0) node[right]{$V_{out}$};`,
  },
  {
    id: "opamp-integrator",
    name: "積分回路",
    description: "オペアンプ積分器",
    category: "増幅器",
    tags: ["オペアンプ", "積分", "コンデンサ"],
    code: `\\draw (0,0) node[op amp, noinv input up] (opamp) {}
  (opamp.-) -- ++(-0.5,0) to[R, l_=$R$] ++(-2,0) node[left]{$V_{in}$}
  (opamp.-) -- ++(0,1.5) to[C, l=$C$] ++(2.5,0) -| (opamp.out)
  (opamp.+) -- ++(0,-0.5) node[ground]{}
  (opamp.out) to[short, -o] ++(0.5,0) node[right]{$V_{out}$};`,
  },
  {
    id: "opamp-differentiator",
    name: "微分回路",
    description: "オペアンプ微分器",
    category: "増幅器",
    tags: ["オペアンプ", "微分", "コンデンサ"],
    code: `\\draw (0,0) node[op amp, noinv input up] (opamp) {}
  (opamp.-) -- ++(-0.5,0) to[C, l_=$C$] ++(-2,0) node[left]{$V_{in}$}
  (opamp.-) -- ++(0,1.5) to[R, l=$R$] ++(2.5,0) -| (opamp.out)
  (opamp.+) -- ++(0,-0.5) node[ground]{}
  (opamp.out) to[short, -o] ++(0.5,0) node[right]{$V_{out}$};`,
  },
  {
    id: "opamp-summing",
    name: "加算回路",
    description: "オペアンプ加算（反転加算）回路",
    category: "増幅器",
    tags: ["オペアンプ", "加算", "ミキサー"],
    code: `\\draw (0,0) node[op amp, noinv input up] (opamp) {}
  (opamp.-) -- ++(-0.5,0) coordinate(jn)
  (jn) to[R, l_=$R_1$] ++(-2,0) node[left]{$V_1$}
  (jn) ++(0,0.8) to[R, l_=$R_2$] ++(-2,0) node[left]{$V_2$}
  (opamp.-) -- ++(0,1.8) to[R, l=$R_f$] ++(2.5,0) -| (opamp.out)
  (opamp.+) -- ++(0,-0.5) node[ground]{}
  (opamp.out) to[short, -o] ++(0.5,0) node[right]{$V_{out}$};`,
  },
  {
    id: "transistor-ce",
    name: "CE増幅器",
    description: "トランジスタエミッタ接地増幅回路",
    category: "増幅器",
    tags: ["トランジスタ", "CE", "エミッタ接地", "NPN"],
    code: `\\draw (3,0) node[npn] (Q) {}
  (Q.B) -- ++(-1,0) to[R, l=$R_B$] ++(-2,0) node[left]{$V_{in}$}
  (Q.C) to[R, l=$R_C$] ++(0,2) -- ++(0,0.3) node[vcc]{$V_{CC}$}
  (Q.E) to[R, l=$R_E$] ++(0,-2) node[ground]{}
  (Q.C) to[short, -o] ++(1,0) node[right]{$V_{out}$};`,
  },
  {
    id: "transistor-cc",
    name: "エミッタフォロワ",
    description: "コレクタ接地回路（CC増幅器）",
    category: "増幅器",
    tags: ["トランジスタ", "CC", "エミッタフォロワ", "NPN"],
    code: `\\draw (3,0) node[npn] (Q) {}
  (Q.B) -- ++(-1,0) to[R, l=$R_B$] ++(-2,0) node[left]{$V_{in}$}
  (Q.C) -- ++(0,0.5) node[vcc]{$V_{CC}$}
  (Q.E) to[R, l=$R_E$] ++(0,-2) node[ground]{}
  (Q.E) to[short, -o] ++(1.5,0) node[right]{$V_{out}$};`,
  },
  {
    id: "mosfet-cs",
    name: "MOSFETソース接地",
    description: "NMOSソース接地増幅回路",
    category: "増幅器",
    tags: ["MOSFET", "NMOS", "ソース接地", "FET"],
    code: `\\draw (3,0) node[nmos] (M) {}
  (M.G) -- ++(-1,0) to[R, l=$R_G$] ++(-2,0) node[left]{$V_{in}$}
  (M.D) to[R, l=$R_D$] ++(0,2) -- ++(0,0.3) node[vcc]{$V_{DD}$}
  (M.S) to[R, l=$R_S$] ++(0,-2) node[ground]{}
  (M.D) to[short, -o] ++(1,0) node[right]{$V_{out}$};`,
  },
  // ── 電源 ──
  {
    id: "half-wave-rectifier",
    name: "半波整流回路",
    description: "ダイオードによる半波整流",
    category: "電源",
    tags: ["ダイオード", "整流", "半波", "電源"],
    code: `\\draw (0,0) to[sV, v=$V_{ac}$] (0,3)
  to[D, l=$D$] (3,3)
  to[R, l=$R_L$] (3,0) -- (0,0);
\\draw (3,3) to[short, -o] (4.5,3) node[right]{$V_{out}$};
\\draw (3,0) to[short, -o] (4.5,0);`,
  },
  {
    id: "full-bridge-rectifier",
    name: "全波整流回路",
    description: "ダイオードブリッジ全波整流",
    category: "電源",
    tags: ["ダイオード", "整流", "全波", "ブリッジ"],
    code: `\\draw (0,2) to[sV, v=$V_{ac}$] (0,4);
\\draw (0,4) -- (2,4);
\\draw (2,4) to[D] (4,3);
\\draw (2,4) to[D] (4,5);
\\draw (0,2) -- (2,2);
\\draw (2,2) to[D] (4,3);
\\draw (2,2) to[D] (4,1);
\\draw (4,5) -- (5,5) to[R, l=$R_L$] (5,1) -- (4,1);
\\draw (5,5) to[short, -o] (6,5) node[right]{$+$};
\\draw (5,1) to[short, -o] (6,1) node[right]{$-$};`,
  },
  {
    id: "voltage-regulator",
    name: "三端子レギュレータ",
    description: "7805系三端子レギュレータ回路",
    category: "電源",
    tags: ["レギュレータ", "電源", "安定化", "7805"],
    code: `\\draw (0,0) node[left]{$V_{in}$} to[short, o-] (1,0)
  to[C, l=$C_1$] (1,-2);
\\draw (1,0) -- (2.5,0);
\\draw (2.5,0.5) rectangle (4,-0.5) node[midway]{REG};
\\draw (4,0) -- (5,0) to[C, l=$C_2$] (5,-2);
\\draw (5,0) to[short, -o] (6,0) node[right]{$V_{out}$};
\\draw (3.25,-0.5) -- (3.25,-2);
\\draw (0,-2) -- (6,-2);
\\draw (3,-2) node[ground]{};`,
  },
  {
    id: "smoothing-cap",
    name: "平滑回路",
    description: "整流後のコンデンサ平滑回路",
    category: "電源",
    tags: ["平滑", "コンデンサ", "フィルタ", "電源"],
    code: `\\draw (0,0) to[sV, v=$V_{ac}$] (0,3)
  to[D, l=$D$] (2,3) -- (3,3);
\\draw (3,3) to[C, l=$C$] (3,0);
\\draw (3,3) -- (5,3) to[R, l=$R_L$] (5,0);
\\draw (0,0) -- (5,0);
\\draw (5,3) to[short, -o] (6,3) node[right]{$V_{out}$};`,
  },
  {
    id: "zener-regulator",
    name: "ツェナーダイオード安定化",
    description: "ツェナーダイオードによる電圧安定化",
    category: "電源",
    tags: ["ツェナー", "ダイオード", "安定化", "電圧"],
    code: `\\draw (0,0) to[V, v=$V_{in}$] (0,3)
  to[R, l=$R$] (3,3)
  to[zD, l=$D_Z$] (3,0) -- (0,0);
\\draw (3,3) -- (5,3) to[R, l=$R_L$] (5,0) -- (3,0);
\\draw (5,3) to[short, -o] (6,3) node[right]{$V_{out}$};`,
  },
  // ── デジタル ──
  {
    id: "led-driver",
    name: "LED駆動回路",
    description: "抵抗付きLED駆動回路",
    category: "デジタル",
    tags: ["LED", "駆動", "抵抗", "デジタル"],
    code: `\\draw (0,3) node[vcc]{$V_{CC}$} -- (0,2.5) to[R, l=$R$] (0,1) to[led, l=$LED$] (0,-0.5) node[ground]{};`,
  },
  {
    id: "transistor-switch",
    name: "トランジスタスイッチ",
    description: "NPNトランジスタによるスイッチング回路",
    category: "デジタル",
    tags: ["トランジスタ", "スイッチ", "NPN", "デジタル"],
    code: `\\draw (3,0) node[npn] (Q) {}
  (Q.B) to[R, l=$R_B$] ++(-2,0) node[left]{$V_{in}$}
  (Q.C) to[R, l=$R_C$] ++(0,2) node[vcc]{$V_{CC}$}
  (Q.E) node[ground]{}
  (Q.C) to[short, -o] ++(1.5,0) node[right]{$V_{out}$};`,
  },
  {
    id: "schmitt-trigger",
    name: "シュミットトリガ",
    description: "オペアンプによるシュミットトリガ回路",
    category: "デジタル",
    tags: ["シュミット", "ヒステリシス", "比較器"],
    code: `\\draw (0,0) node[op amp, noinv input up] (opamp) {}
  (opamp.+) -- ++(-1,0) node[left]{$V_{in}$}
  (opamp.-) -- ++(0,-1) to[R, l=$R_2$] ++(0,-1.5) node[ground]{}
  (opamp.out) to[short, -o] ++(0.5,0) node[right]{$V_{out}$};
\\draw (opamp.out) -- ++(0,1.5) to[R, l=$R_1$] ++(-3,0) |- (opamp.-);`,
  },
  {
    id: "h-bridge",
    name: "Hブリッジ",
    description: "モーター駆動用Hブリッジ回路",
    category: "デジタル",
    tags: ["Hブリッジ", "モーター", "駆動", "PWM"],
    code: `\\draw (0,4) node[vcc]{$V_{CC}$} -- (0,3.5);
\\draw (0,3.5) -- (-1.5,3.5) to[Tnmos] (-1.5,2);
\\draw (0,3.5) -- (1.5,3.5) to[Tnmos] (1.5,2);
\\draw (-1.5,2) -- (-1.5,1.5);
\\draw (1.5,2) -- (1.5,1.5);
\\draw (-1.5,1.5) to[Tnmos] (-1.5,0);
\\draw (1.5,1.5) to[Tnmos] (1.5,0);
\\draw (-1.5,0) -- (0,0) -- (1.5,0);
\\draw (0,0) node[ground]{};
\\draw (-1.5,1.5) -- (-0.5,1.5);
\\draw (1.5,1.5) -- (0.5,1.5);
\\draw (-0.5,1.5) to[Telmech=M] (0.5,1.5);`,
  },
  // ── センサ・計測 ──
  {
    id: "thermistor-bridge",
    name: "サーミスタブリッジ",
    description: "温度センサ用ブリッジ回路",
    category: "センサ・計測",
    tags: ["サーミスタ", "温度", "ブリッジ", "センサ"],
    code: `\\draw (0,0) to[V, v=$V_s$] (0,4)
  -- (2,4) to[R, l=$R_1$] (4,2)
  to[R, l=$R_3$] (2,0) -- (0,0);
\\draw (2,4) to[thermistor, l_=$R_{th}$] (0,2)
  to[R, l_=$R_4$] (2,0);
\\draw (0,2) to[voltmeter] (4,2);`,
  },
  {
    id: "photodiode-amp",
    name: "フォトダイオード回路",
    description: "フォトダイオード光検出回路",
    category: "センサ・計測",
    tags: ["フォトダイオード", "光", "センサ", "検出"],
    code: `\\draw (0,0) node[op amp, noinv input up] (opamp) {}
  (opamp.-) -- ++(-0.5,0) to[pD, l_=$PD$] ++(-2,0) -- ++(0,-1.5) node[ground]{}
  (opamp.-) -- ++(0,1.5) to[R, l=$R_f$] ++(2.5,0) -| (opamp.out)
  (opamp.+) -- ++(0,-0.5) node[ground]{}
  (opamp.out) to[short, -o] ++(0.5,0) node[right]{$V_{out}$};`,
  },
  {
    id: "current-sense",
    name: "電流センス回路",
    description: "シャント抵抗による電流検出",
    category: "センサ・計測",
    tags: ["電流", "シャント", "測定", "センス"],
    code: `\\draw (0,0) to[V, v=$V$] (0,3)
  to[R, l=$R_{shunt}$, v=$V_s$] (3,3)
  to[R, l=$R_{load}$] (3,0) -- (0,0);
\\draw (0,3) to[short, -o] (0,4) node[above]{$A$};
\\draw (3,3) to[short, -o] (3,4) node[above]{$B$};`,
  },
  // ── 通信 ──
  {
    id: "lc-oscillator",
    name: "LC発振回路",
    description: "LC発振回路（コルピッツ型概略）",
    category: "通信",
    tags: ["LC", "発振", "コルピッツ", "通信"],
    code: `\\draw (0,0) to[V, v=$V_{CC}$] (0,4) -- (3,4)
  to[L, l=$L$] (3,2)
  to[C, l=$C_1$] (3,0) -- (0,0);
\\draw (3,2) to[short, -o] (4.5,2) node[right]{OUT};
\\draw (3,4) to[C, l=$C_2$] (5,4) -- (5,0) -- (3,0);`,
  },
  {
    id: "crystal-osc",
    name: "水晶発振回路",
    description: "水晶振動子による発振回路",
    category: "通信",
    tags: ["水晶", "発振", "クロック", "通信"],
    code: `\\draw (0,0) node[op amp, noinv input up] (opamp) {}
  (opamp.+) -- ++(-0.5,0) to[R, l=$R_1$] ++(-2,0) node[ground]{}
  (opamp.-) -- ++(0,1.5) to[R, l=$R_f$] ++(2.5,0) -| (opamp.out)
  (opamp.+) -- ++(0,-1.2) to[cute inductor, l=$XTAL$] ++(2.5,0) -| (opamp.out)
  (opamp.out) to[short, -o] ++(0.5,0) node[right]{CLK};`,
  },
  {
    id: "impedance-match",
    name: "インピーダンス整合",
    description: "L型インピーダンス整合回路",
    category: "通信",
    tags: ["インピーダンス", "整合", "マッチング", "RF"],
    code: `\\draw (0,0) to[sV, v=$V_s$] (0,3)
  to[R, l=$R_s$] (2,3)
  to[L, l=$L$] (4,3)
  to[R, l=$R_L$] (4,0) -- (0,0);
\\draw (4,3) to[C, l=$C$] (4,1.5);`,
  },
];

// ──── Circuit Component Snippets for GUI palette ────

export interface CircuitComponent {
  id: string;
  name: string;
  icon: string;
  category: string;
  snippet: string;
  description: string;
}

export const CIRCUIT_COMPONENTS: CircuitComponent[] = [
  // 受動部品
  { id: "resistor", name: "抵抗", icon: "R", category: "受動部品", snippet: "to[R, l=$R$]", description: "抵抗器" },
  { id: "capacitor", name: "コンデンサ", icon: "C", category: "受動部品", snippet: "to[C, l=$C$]", description: "コンデンサ" },
  { id: "inductor", name: "インダクタ", icon: "L", category: "受動部品", snippet: "to[L, l=$L$]", description: "コイル/インダクタ" },
  { id: "variable-r", name: "可変抵抗", icon: "VR", category: "受動部品", snippet: "to[vR, l=$R$]", description: "可変抵抗器" },
  // 電源
  { id: "voltage-src", name: "電圧源", icon: "V", category: "電源", snippet: "to[V, v=$V$]", description: "DC電圧源" },
  { id: "current-src", name: "電流源", icon: "I", category: "電源", snippet: "to[I, l=$I$]", description: "DC電流源" },
  { id: "ac-voltage", name: "AC電圧源", icon: "~V", category: "電源", snippet: "to[sV, v=$V_{ac}$]", description: "AC電圧源" },
  { id: "ground", name: "GND", icon: "⏚", category: "電源", snippet: "node[ground]{}", description: "グランド" },
  { id: "vcc", name: "VCC", icon: "△", category: "電源", snippet: "node[vcc]{$V_{CC}$}", description: "電源ノード" },
  // 半導体
  { id: "diode", name: "ダイオード", icon: "D", category: "半導体", snippet: "to[D, l=$D$]", description: "ダイオード" },
  { id: "zener", name: "ツェナーD", icon: "ZD", category: "半導体", snippet: "to[zD, l=$D_Z$]", description: "ツェナーダイオード" },
  { id: "led", name: "LED", icon: "💡", category: "半導体", snippet: "to[led, l=$LED$]", description: "発光ダイオード" },
  { id: "npn", name: "NPN Tr", icon: "NPN", category: "半導体", snippet: "node[npn] (Q) {}", description: "NPNトランジスタ" },
  { id: "pnp", name: "PNP Tr", icon: "PNP", category: "半導体", snippet: "node[pnp] (Q) {}", description: "PNPトランジスタ" },
  { id: "nmos", name: "NMOS", icon: "NM", category: "半導体", snippet: "node[nmos] (M) {}", description: "NチャネルMOSFET" },
  { id: "pmos", name: "PMOS", icon: "PM", category: "半導体", snippet: "node[pmos] (M) {}", description: "PチャネルMOSFET" },
  // IC
  { id: "opamp", name: "オペアンプ", icon: "▷", category: "IC", snippet: "node[op amp, noinv input up] (opamp) {}", description: "オペアンプ" },
  // 接続
  { id: "wire", name: "導線", icon: "─", category: "接続", snippet: "--", description: "導線接続" },
  { id: "short-o", name: "端子", icon: "○", category: "接続", snippet: "to[short, -o]", description: "開放端子" },
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
    name: "基本フローチャート",
    description: "開始・処理・分岐・終了の基本フロー",
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
    name: "ブロック図",
    description: "制御システムのブロック図",
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
    name: "状態遷移図",
    description: "オートマトン状態遷移図",
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
    name: "ツリー図",
    description: "階層構造のツリー図",
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
    name: "ネットワーク図",
    description: "ネットワークトポロジ図",
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
    name: "シーケンス図",
    description: "メッセージパッシングのシーケンス図",
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
  { id: "photosynthesis", name: "光合成", description: "光合成の化学反応", formula: "6CO2 + 6H2O ->[光] C6H12O6 + 6O2" },
  { id: "acid-base", name: "酸塩基反応", description: "塩酸と水酸化ナトリウム", formula: "HCl + NaOH -> NaCl + H2O" },
  { id: "redox", name: "酸化還元", description: "鉄の酸化還元反応", formula: "Fe^{2+} -> Fe^{3+} + e-" },
  { id: "equilibrium", name: "化学平衡", description: "可逆反応の平衡", formula: "N2 + 3H2 <=> 2NH3" },
  { id: "sulfuric-acid", name: "硫酸生成", description: "硫酸の工業的製法", formula: "2SO2 + O2 ->[触媒] 2SO3" },
  { id: "ester", name: "エステル化", description: "エステル化反応", formula: "CH3COOH + C2H5OH <=>[酸触媒] CH3COOC2H5 + H2O" },
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
