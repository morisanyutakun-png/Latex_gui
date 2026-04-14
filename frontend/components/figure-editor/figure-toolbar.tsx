"use client";

/**
 * FigureToolbar — Left sidebar (v2 polished UI).
 *
 * Layout:
 *   ┌────────────────────────────┐
 *   │ Search                     │  filter palette items
 *   ├────────────────────────────┤
 *   │ Primary tools (row)        │  select + main shapes
 *   │ Actions (undo/del/…)       │  editing actions
 *   ├────────────────────────────┤
 *   │ Category tabs (scroll)     │  8 domains
 *   ├────────────────────────────┤
 *   │ Palette grid (3 cols)      │  filtered items with real preview
 *   │  [icon]  [icon]  [icon]    │
 *   │  name    name    name      │
 *   └────────────────────────────┘
 */

import React, { useMemo, useState } from "react";
import { useFigureStore } from "./figure-store";
import { CATEGORIES, getItemsByCategory, PALETTE_ITEMS } from "./domain-palettes";
import type { DomainPaletteItem, ToolMode } from "./types";
import {
  MousePointer2, Square, Circle, Minus, ArrowRight, Type, Pen,
  Undo2, Redo2, Trash2, Copy, Grid3x3, Magnet, MoveVertical, MoveDown,
  Search, X,
} from "lucide-react";
import { HelpTip } from "./help-tip";

function useIsJa() {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem("lx-locale") === "ja"; } catch { return false; }
}

// ══════════════════════════════════════════════════════════════════
//  SHAPE MINI-PREVIEW — accurate SVG icons matching the actual shape
// ══════════════════════════════════════════════════════════════════

interface PreviewProps { size?: number; color?: string }

const S = (n: number) => ({ width: n, height: n, viewBox: `0 0 ${n} ${n}`, fill: "none" });

function ShapePreview({ kind, size = 24, color = "currentColor" }: PreviewProps & { kind: string }) {
  const n = size;
  const c = color;
  const sw = 1.3;

  switch (kind) {
    // ── Basic ──
    case "rect": return <svg {...S(n)}><rect x="3" y="6" width={n - 6} height={n - 12} rx="1.5" stroke={c} strokeWidth={sw} /></svg>;
    case "circle": return <svg {...S(n)}><circle cx={n / 2} cy={n / 2} r={n / 2 - 3} stroke={c} strokeWidth={sw} /></svg>;
    case "ellipse": return <svg {...S(n)}><ellipse cx={n / 2} cy={n / 2} rx={n / 2 - 2} ry={n / 3} stroke={c} strokeWidth={sw} /></svg>;
    case "line": return <svg {...S(n)}><line x1="3" y1={n - 5} x2={n - 3} y2="5" stroke={c} strokeWidth={sw} strokeLinecap="round" /></svg>;
    case "arrow": return <svg {...S(n)}>
      <defs><marker id={`ah-${n}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill={c} /></marker></defs>
      <line x1="3" y1={n - 5} x2={n - 5} y2="5" stroke={c} strokeWidth={sw} markerEnd={`url(#ah-${n})`} strokeLinecap="round" />
    </svg>;
    case "text": return <svg {...S(n)}><text x={n / 2} y={n / 2 + 4} textAnchor="middle" fontSize="13" fill={c} fontFamily="serif" fontStyle="italic">T</text></svg>;
    case "polygon": case "prism": return <svg {...S(n)}><polygon points={`${n / 2},3 ${n - 3},${n - 4} 3,${n - 4}`} stroke={c} strokeWidth={sw} /></svg>;
    case "arc": return <svg {...S(n)}><path d={`M 3 ${n - 5} A ${n / 2 - 3} ${n / 2 - 3} 0 0 1 ${n - 3} ${n - 5}`} stroke={c} strokeWidth={sw} /></svg>;
    case "freehand": return <svg {...S(n)}><path d={`M 3 ${n - 6} Q ${n * 0.3} 3, ${n * 0.5} ${n * 0.6} T ${n - 3} 5`} stroke={c} strokeWidth={sw} strokeLinecap="round" /></svg>;

    // ── Circuit ──
    case "resistor": return <svg {...S(n)}><path
      d={`M 2 ${n / 2} L 5 ${n / 2} L 7 ${n / 2 - 4} L 10 ${n / 2 + 4} L 13 ${n / 2 - 4} L 16 ${n / 2 + 4} L 18 ${n / 2} L ${n - 2} ${n / 2}`}
      stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case "capacitor": return <svg {...S(n)}>
      <line x1="2" y1={n / 2} x2={n / 2 - 2} y2={n / 2} stroke={c} strokeWidth={sw} />
      <line x1={n / 2 - 2} y1={n / 2 - 5} x2={n / 2 - 2} y2={n / 2 + 5} stroke={c} strokeWidth={sw * 1.5} />
      <line x1={n / 2 + 2} y1={n / 2 - 5} x2={n / 2 + 2} y2={n / 2 + 5} stroke={c} strokeWidth={sw * 1.5} />
      <line x1={n / 2 + 2} y1={n / 2} x2={n - 2} y2={n / 2} stroke={c} strokeWidth={sw} />
    </svg>;
    case "inductor": return <svg {...S(n)}>
      <path d={`M 2 ${n / 2} L 5 ${n / 2} A 2 2 0 1 1 9 ${n / 2} A 2 2 0 1 1 13 ${n / 2} A 2 2 0 1 1 17 ${n / 2} L ${n - 2} ${n / 2}`}
        stroke={c} strokeWidth={sw} />
    </svg>;
    case "voltage-source": return <svg {...S(n)}>
      <circle cx={n / 2} cy={n / 2} r={n / 2 - 3} stroke={c} strokeWidth={sw} />
      <text x={n / 2} y={n / 2 - 1} textAnchor="middle" fontSize="7" fill={c}>+</text>
      <text x={n / 2} y={n / 2 + 6} textAnchor="middle" fontSize="9" fill={c}>−</text>
    </svg>;
    case "current-source": return <svg {...S(n)}>
      <circle cx={n / 2} cy={n / 2} r={n / 2 - 3} stroke={c} strokeWidth={sw} />
      <line x1={n / 2} y1={n / 2 + 4} x2={n / 2} y2={n / 2 - 4} stroke={c} strokeWidth={sw} />
      <path d={`M ${n / 2 - 2} ${n / 2 - 2} L ${n / 2} ${n / 2 - 4} L ${n / 2 + 2} ${n / 2 - 2}`} stroke={c} strokeWidth={sw} fill="none" />
    </svg>;
    case "ground": return <svg {...S(n)}>
      <line x1={n / 2} y1="3" x2={n / 2} y2={n / 2} stroke={c} strokeWidth={sw} />
      <line x1="4" y1={n / 2} x2={n - 4} y2={n / 2} stroke={c} strokeWidth={sw} />
      <line x1="7" y1={n / 2 + 4} x2={n - 7} y2={n / 2 + 4} stroke={c} strokeWidth={sw} />
      <line x1="10" y1={n / 2 + 8} x2={n - 10} y2={n / 2 + 8} stroke={c} strokeWidth={sw} />
    </svg>;
    case "switch": return <svg {...S(n)}>
      <line x1="2" y1={n / 2} x2="7" y2={n / 2} stroke={c} strokeWidth={sw} />
      <circle cx="7" cy={n / 2} r="1.5" fill={c} />
      <line x1="7" y1={n / 2} x2={n - 8} y2="5" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <circle cx={n - 7} cy={n / 2} r="1.5" fill={c} />
      <line x1={n - 7} y1={n / 2} x2={n - 2} y2={n / 2} stroke={c} strokeWidth={sw} />
    </svg>;
    case "diode": return <svg {...S(n)}>
      <line x1="2" y1={n / 2} x2="7" y2={n / 2} stroke={c} strokeWidth={sw} />
      <polygon points={`7,${n / 2 - 4} 7,${n / 2 + 4} 13,${n / 2}`} stroke={c} strokeWidth={sw} />
      <line x1="13" y1={n / 2 - 4} x2="13" y2={n / 2 + 4} stroke={c} strokeWidth={sw * 1.3} />
      <line x1="13" y1={n / 2} x2={n - 2} y2={n / 2} stroke={c} strokeWidth={sw} />
    </svg>;
    case "led": return <svg {...S(n)}>
      <line x1="2" y1={n / 2} x2="7" y2={n / 2} stroke={c} strokeWidth={sw} />
      <polygon points={`7,${n / 2 - 3} 7,${n / 2 + 3} 12,${n / 2}`} stroke={c} strokeWidth={sw} />
      <line x1="12" y1={n / 2 - 3} x2="12" y2={n / 2 + 3} stroke={c} strokeWidth={sw} />
      <line x1="12" y1={n / 2} x2={n - 2} y2={n / 2} stroke={c} strokeWidth={sw} />
      <line x1="15" y1="5" x2="19" y2="2" stroke={c} strokeWidth={sw * 0.8} />
      <line x1="17" y1="7" x2="21" y2="4" stroke={c} strokeWidth={sw * 0.8} />
    </svg>;
    case "transistor-npn": case "transistor-pnp": return <svg {...S(n)}>
      <circle cx={n / 2} cy={n / 2} r="6" stroke={c} strokeWidth={sw} />
      <line x1="3" y1={n / 2} x2={n / 2 - 4} y2={n / 2} stroke={c} strokeWidth={sw} />
      <line x1={n / 2 - 3} y1={n / 2 - 3} x2={n / 2 - 3} y2={n / 2 + 3} stroke={c} strokeWidth={sw * 1.3} />
      <line x1={n / 2 - 3} y1={n / 2 - 2} x2={n / 2 + 3} y2={n / 2 - 5} stroke={c} strokeWidth={sw} />
      <line x1={n / 2 - 3} y1={n / 2 + 2} x2={n / 2 + 3} y2={n / 2 + 5} stroke={c} strokeWidth={sw} />
      <line x1={n / 2 + 3} y1={n / 2 - 5} x2={n / 2 + 3} y2="3" stroke={c} strokeWidth={sw} />
      <line x1={n / 2 + 3} y1={n / 2 + 5} x2={n / 2 + 3} y2={n - 3} stroke={c} strokeWidth={sw} />
    </svg>;
    case "opamp": return <svg {...S(n)}>
      <polygon points={`4,3 4,${n - 3} ${n - 3},${n / 2}`} stroke={c} strokeWidth={sw} />
      <text x="6" y={n / 2 - 2} fontSize="6" fill={c}>+</text>
      <text x="6" y={n / 2 + 5} fontSize="7" fill={c}>−</text>
    </svg>;

    // ── Mechanics ──
    case "spring": return <svg {...S(n)}><path
      d={`M 2 ${n / 2} L 4 ${n / 2} L 5 ${n / 2 - 4} L 7 ${n / 2 + 4} L 9 ${n / 2 - 4} L 11 ${n / 2 + 4} L 13 ${n / 2 - 4} L 15 ${n / 2 + 4} L 17 ${n / 2} L ${n - 2} ${n / 2}`}
      stroke={c} strokeWidth={sw} strokeLinecap="round" /></svg>;
    case "mass": return <svg {...S(n)}>
      <rect x="4" y="6" width={n - 8} height={n - 12} stroke={c} strokeWidth={sw} fill={c} fillOpacity={0.1} />
      <text x={n / 2} y={n / 2 + 4} textAnchor="middle" fontSize="9" fill={c} fontStyle="italic">m</text>
    </svg>;
    case "pulley": return <svg {...S(n)}>
      <circle cx={n / 2} cy={n / 2} r={n / 2 - 4} stroke={c} strokeWidth={sw} />
      <circle cx={n / 2} cy={n / 2} r="1.5" fill={c} />
    </svg>;
    case "support-pin": return <svg {...S(n)}>
      <polygon points={`${n / 2},6 5,${n - 6} ${n - 5},${n - 6}`} stroke={c} strokeWidth={sw} fill="white" />
      <line x1="3" y1={n - 6} x2={n - 3} y2={n - 6} stroke={c} strokeWidth={sw} />
    </svg>;
    case "support-roller": return <svg {...S(n)}>
      <polygon points={`${n / 2},6 5,${n - 8} ${n - 5},${n - 8}`} stroke={c} strokeWidth={sw} fill="white" />
      <circle cx="8" cy={n - 5} r="1.5" stroke={c} strokeWidth={sw * 0.8} />
      <circle cx={n - 8} cy={n - 5} r="1.5" stroke={c} strokeWidth={sw * 0.8} />
    </svg>;
    case "force-arrow": case "vector": return <svg {...S(n)}>
      <defs><marker id={`fa-${kind}-${n}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill={c} /></marker></defs>
      <line x1="3" y1={n - 4} x2={n - 5} y2="4" stroke={c} strokeWidth={sw * 1.3} markerEnd={`url(#fa-${kind}-${n})`} />
    </svg>;
    case "moment": return <svg {...S(n)}>
      <path d={`M ${n - 5} ${n / 2} A ${n / 2 - 4} ${n / 2 - 4} 0 1 0 ${n / 2} 5`} stroke={c} strokeWidth={sw} fill="none" />
      <polygon points={`${n / 2 - 2},3 ${n / 2 + 2},5 ${n / 2},8`} fill={c} />
    </svg>;
    case "damper": return <svg {...S(n)}>
      <line x1="2" y1={n / 2} x2="9" y2={n / 2} stroke={c} strokeWidth={sw} />
      <rect x="9" y={n / 2 - 4} width="6" height="8" stroke={c} strokeWidth={sw} fill="none" />
      <line x1="15" y1={n / 2} x2={n - 2} y2={n / 2} stroke={c} strokeWidth={sw} />
    </svg>;

    // ── Physics ──
    case "wave": return <svg {...S(n)}>
      <path d={`M 2 ${n / 2} Q 5 3, 9 ${n / 2} T 16 ${n / 2} T ${n - 2} ${n / 2}`} stroke={c} strokeWidth={sw} />
    </svg>;
    case "lens-convex": return <svg {...S(n)}>
      <path d={`M ${n / 2} 3 Q ${n / 2 + 3} ${n / 2}, ${n / 2} ${n - 3} Q ${n / 2 - 3} ${n / 2}, ${n / 2} 3 Z`} stroke={c} strokeWidth={sw} fill="none" />
    </svg>;
    case "lens-concave": return <svg {...S(n)}>
      <path d={`M ${n / 2 - 2} 3 Q ${n / 2 + 2} ${n / 2}, ${n / 2 - 2} ${n - 3}`} stroke={c} strokeWidth={sw} fill="none" />
      <path d={`M ${n / 2 + 2} 3 Q ${n / 2 - 2} ${n / 2}, ${n / 2 + 2} ${n - 3}`} stroke={c} strokeWidth={sw} fill="none" />
    </svg>;
    case "vector-field": return <svg {...S(n)}>
      <defs><marker id={`vf-${n}`} markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 z" fill={c} /></marker></defs>
      <line x1="3" y1="6" x2={n - 4} y2="6" stroke={c} strokeWidth={sw * 0.8} markerEnd={`url(#vf-${n})`} />
      <line x1="3" y1={n / 2} x2={n - 4} y2={n / 2} stroke={c} strokeWidth={sw * 0.8} markerEnd={`url(#vf-${n})`} />
      <line x1="3" y1={n - 6} x2={n - 4} y2={n - 6} stroke={c} strokeWidth={sw * 0.8} markerEnd={`url(#vf-${n})`} />
    </svg>;

    // ── Math ──
    case "axes": return <svg {...S(n)}>
      <defs><marker id={`ax-${n}`} markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 z" fill={c} /></marker></defs>
      <line x1="4" y1={n - 4} x2={n - 3} y2={n - 4} stroke={c} strokeWidth={sw} markerEnd={`url(#ax-${n})`} />
      <line x1="4" y1={n - 4} x2="4" y2="3" stroke={c} strokeWidth={sw} markerEnd={`url(#ax-${n})`} />
    </svg>;
    case "angle-arc": return <svg {...S(n)}>
      <line x1="4" y1={n - 4} x2={n - 3} y2={n - 4} stroke={c} strokeWidth={sw} />
      <line x1="4" y1={n - 4} x2={n - 4} y2="4" stroke={c} strokeWidth={sw * 0.7} />
      <path d={`M ${n - 8} ${n - 4} A 4 4 0 0 0 4 ${n - 8}`} stroke={c} strokeWidth={sw * 0.8} fill="none" />
    </svg>;
    case "right-angle": return <svg {...S(n)}>
      <line x1="4" y1={n - 4} x2={n - 3} y2={n - 4} stroke={c} strokeWidth={sw} />
      <line x1="4" y1={n - 4} x2="4" y2="4" stroke={c} strokeWidth={sw} />
      <rect x="4" y={n - 9} width="5" height="5" stroke={c} strokeWidth={sw * 0.8} fill="none" />
    </svg>;
    case "function-plot": return <svg {...S(n)}>
      <line x1="3" y1={n - 3} x2={n - 3} y2={n - 3} stroke={c} strokeWidth={sw * 0.7} />
      <line x1="3" y1={n - 3} x2="3" y2="3" stroke={c} strokeWidth={sw * 0.7} />
      <path d={`M 3 ${n - 5} Q ${n / 3} 3, ${n / 2} ${n / 2} T ${n - 3} 4`} stroke={c} strokeWidth={sw} fill="none" />
    </svg>;
    case "brace": return <svg {...S(n)}>
      <path d={`M 6 4 Q 3 4, 3 ${n / 2 - 2} Q 3 ${n / 2}, 0 ${n / 2} Q 3 ${n / 2}, 3 ${n / 2 + 2} Q 3 ${n - 4}, 6 ${n - 4}`}
        stroke={c} strokeWidth={sw} fill="none" />
    </svg>;

    // ── CS ──
    case "flowchart-process": return <svg {...S(n)}><rect x="3" y="6" width={n - 6} height={n - 12} rx="2" stroke={c} strokeWidth={sw} /></svg>;
    case "flowchart-decision": return <svg {...S(n)}>
      <polygon points={`${n / 2},3 ${n - 3},${n / 2} ${n / 2},${n - 3} 3,${n / 2}`} stroke={c} strokeWidth={sw} />
    </svg>;
    case "flowchart-io": return <svg {...S(n)}>
      <polygon points={`6,6 ${n - 3},6 ${n - 6},${n - 6} 3,${n - 6}`} stroke={c} strokeWidth={sw} />
    </svg>;
    case "flowchart-terminal": return <svg {...S(n)}><rect x="3" y="7" width={n - 6} height={n - 14} rx={(n - 14) / 2} stroke={c} strokeWidth={sw} /></svg>;
    case "automaton-state": return <svg {...S(n)}><circle cx={n / 2} cy={n / 2} r={n / 2 - 3} stroke={c} strokeWidth={sw} /><text x={n / 2} y={n / 2 + 3} textAnchor="middle" fontSize="8" fill={c} fontStyle="italic">q</text></svg>;
    case "automaton-accept": return <svg {...S(n)}>
      <circle cx={n / 2} cy={n / 2} r={n / 2 - 3} stroke={c} strokeWidth={sw} />
      <circle cx={n / 2} cy={n / 2} r={n / 2 - 5} stroke={c} strokeWidth={sw} />
    </svg>;

    // ── Chemistry ──
    case "benzene": return <svg {...S(n)}>
      <polygon points={`${n / 2},3 ${n - 4},${n / 3} ${n - 4},${n * 2 / 3} ${n / 2},${n - 3} 4,${n * 2 / 3} 4,${n / 3}`} stroke={c} strokeWidth={sw} />
      <circle cx={n / 2} cy={n / 2} r={n / 4} stroke={c} strokeWidth={sw * 0.8} fill="none" />
    </svg>;
    case "bond-single": return <svg {...S(n)}><line x1="3" y1={n / 2} x2={n - 3} y2={n / 2} stroke={c} strokeWidth={sw} /></svg>;
    case "bond-double": return <svg {...S(n)}>
      <line x1="3" y1={n / 2 - 3} x2={n - 3} y2={n / 2 - 3} stroke={c} strokeWidth={sw} />
      <line x1="3" y1={n / 2 + 3} x2={n - 3} y2={n / 2 + 3} stroke={c} strokeWidth={sw} />
    </svg>;
    case "bond-triple": return <svg {...S(n)}>
      <line x1="3" y1={n / 2 - 4} x2={n - 3} y2={n / 2 - 4} stroke={c} strokeWidth={sw} />
      <line x1="3" y1={n / 2} x2={n - 3} y2={n / 2} stroke={c} strokeWidth={sw} />
      <line x1="3" y1={n / 2 + 4} x2={n - 3} y2={n / 2 + 4} stroke={c} strokeWidth={sw} />
    </svg>;
    case "reaction-arrow": return <svg {...S(n)}>
      <defs><marker id={`rx-${n}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill={c} /></marker></defs>
      <line x1="3" y1={n / 2} x2={n - 5} y2={n / 2} stroke={c} strokeWidth={sw * 1.2} markerEnd={`url(#rx-${n})`} />
    </svg>;
    case "orbital-s": return <svg {...S(n)}><circle cx={n / 2} cy={n / 2} r={n / 2 - 3} fill="#3b82f6" opacity={0.25} stroke={c} strokeWidth={sw * 0.6} /></svg>;
    case "orbital-p": return <svg {...S(n)}>
      <ellipse cx={n / 2} cy={n / 2 - 3} rx="3" ry="4" fill="#ef4444" opacity={0.3} stroke={c} strokeWidth={sw * 0.6} />
      <ellipse cx={n / 2} cy={n / 2 + 3} rx="3" ry="4" fill="#3b82f6" opacity={0.3} stroke={c} strokeWidth={sw * 0.6} />
    </svg>;

    // ── Biology ──
    case "cell": return <svg {...S(n)}>
      <ellipse cx={n / 2} cy={n / 2} rx={n / 2 - 2} ry={n / 3} stroke={c} strokeWidth={sw} fill="#dcfce7" fillOpacity={0.4} />
      <circle cx={n / 2} cy={n / 2} r="2.5" fill="#c4b5fd" />
    </svg>;
    case "nucleus": return <svg {...S(n)}>
      <circle cx={n / 2} cy={n / 2} r={n / 2 - 3} stroke={c} strokeWidth={sw} fill="#c4b5fd" fillOpacity={0.5} />
    </svg>;
    case "mitochondria": return <svg {...S(n)}>
      <ellipse cx={n / 2} cy={n / 2} rx={n / 2 - 2} ry="4" stroke={c} strokeWidth={sw} fill="#fecaca" fillOpacity={0.4} />
      <path d={`M 6 ${n / 2 - 4} Q 7 ${n / 2}, 6 ${n / 2 + 4}`} stroke={c} strokeWidth={sw * 0.6} fill="none" />
      <path d={`M ${n - 6} ${n / 2 - 4} Q ${n - 7} ${n / 2}, ${n - 6} ${n / 2 + 4}`} stroke={c} strokeWidth={sw * 0.6} fill="none" />
    </svg>;
    case "membrane": return <svg {...S(n)}>
      {[4, 8, 12, 16, 20].map((x) => <g key={x}>
        <circle cx={x} cy={n / 2 - 3} r="1.3" fill={c} opacity={0.5} />
        <line x1={x} y1={n / 2 - 3} x2={x} y2="5" stroke={c} strokeWidth={sw * 0.5} />
        <circle cx={x} cy={n / 2 + 3} r="1.3" fill={c} opacity={0.5} />
        <line x1={x} y1={n / 2 + 3} x2={x} y2={n - 5} stroke={c} strokeWidth={sw * 0.5} />
      </g>)}
    </svg>;
    case "neuron": return <svg {...S(n)}>
      <circle cx="7" cy={n / 2} r="3.5" stroke={c} strokeWidth={sw} fill="#dbeafe" />
      <line x1="11" y1={n / 2} x2={n - 3} y2={n / 2} stroke={c} strokeWidth={sw * 0.8} />
      <line x1={n - 4} y1={n / 2} x2={n - 1} y2={n / 2 - 3} stroke={c} strokeWidth={sw * 0.6} />
      <line x1={n - 4} y1={n / 2} x2={n - 1} y2={n / 2 + 3} stroke={c} strokeWidth={sw * 0.6} />
      <line x1="4" y1={n / 2} x2="1" y2={n / 2 - 4} stroke={c} strokeWidth={sw * 0.6} />
      <line x1="4" y1={n / 2} x2="1" y2={n / 2 + 4} stroke={c} strokeWidth={sw * 0.6} />
    </svg>;
    case "synapse": return <svg {...S(n)}>
      <circle cx="6" cy={n / 2} r="3" stroke={c} strokeWidth={sw} fill="#dbeafe" />
      <circle cx={n - 6} cy={n / 2} r="3" stroke={c} strokeWidth={sw} fill="#fecaca" />
      <line x1={n / 2 - 2} y1="3" x2={n / 2 - 2} y2={n - 3} stroke={c} strokeWidth={sw * 0.5} strokeDasharray="2,1" />
      <line x1={n / 2 + 2} y1="3" x2={n / 2 + 2} y2={n - 3} stroke={c} strokeWidth={sw * 0.5} strokeDasharray="2,1" />
      <circle cx={n / 2} cy={n / 2 - 2} r="0.7" fill={c} />
      <circle cx={n / 2} cy={n / 2 + 2} r="0.7" fill={c} />
    </svg>;

    default: return <svg {...S(n)}><rect x="3" y="6" width={n - 6} height={n - 12} rx="2" stroke={c} strokeWidth={sw} strokeDasharray="3,2" /></svg>;
  }
}

// ══════════════════════════════════════════════════════════════════
//  TOOL BUTTON (for primary shape tools at the top)
// ══════════════════════════════════════════════════════════════════

function ToolBtn({
  icon, label, description, active, onClick, kbd,
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  active: boolean;
  onClick: () => void;
  kbd?: string;
}) {
  return (
    <HelpTip title={label} description={description} kbd={kbd} side="bottom">
      <button
        onClick={onClick}
        className={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-150 group ${
          active
            ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/30 scale-105"
            : "text-foreground/55 hover:bg-foreground/[0.06] hover:text-foreground/85"
        }`}
      >
        {icon}
        {kbd && !active && (
          <span className="absolute -bottom-0.5 right-0.5 text-[7px] font-mono font-semibold text-foreground/25 group-hover:text-foreground/50 transition-colors">
            {kbd}
          </span>
        )}
      </button>
    </HelpTip>
  );
}

// ══════════════════════════════════════════════════════════════════
//  PALETTE ITEM CARD (grid cell)
// ══════════════════════════════════════════════════════════════════

function PaletteItemBtn({
  item, active, isJa, onClick,
}: {
  item: DomainPaletteItem;
  active: boolean;
  isJa: boolean;
  onClick: () => void;
}) {
  return (
    <HelpTip
      title={isJa ? item.labelJa : item.label}
      description={isJa ? item.descriptionJa : item.description}
      side="right"
    >
    <button
      onClick={onClick}
      className={`group relative flex flex-col items-center gap-0.5 p-1.5 rounded-lg transition-all duration-150 ${
        active
          ? "bg-blue-500/10 ring-1 ring-blue-500/50 shadow-sm"
          : "hover:bg-foreground/[0.05] border border-transparent hover:border-foreground/[0.08]"
      }`}
    >
      <div className={`h-8 w-8 flex items-center justify-center rounded-md transition-colors ${
        active ? "bg-white dark:bg-white/10" : "bg-white/60 dark:bg-white/[0.03] group-hover:bg-white dark:group-hover:bg-white/[0.08]"
      }`}>
        <ShapePreview kind={item.kind} size={22} color={active ? "#2563eb" : "currentColor"} />
      </div>
      <span className={`text-[9px] font-medium leading-tight text-center truncate w-full transition-colors ${
        active ? "text-blue-600 dark:text-blue-400" : "text-foreground/55 group-hover:text-foreground/80"
      }`}>
        {isJa ? item.labelJa : item.label}
      </span>
    </button>
    </HelpTip>
  );
}

// ══════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════

export function FigureToolbar() {
  const isJa = useIsJa();

  const activeTool = useFigureStore((s) => s.activeTool);
  const activeCategory = useFigureStore((s) => s.activeCategory);
  const setActiveTool = useFigureStore((s) => s.setActiveTool);
  const setActiveCategory = useFigureStore((s) => s.setActiveCategory);
  const undo = useFigureStore((s) => s.undo);
  const redo = useFigureStore((s) => s.redo);
  const deleteSelected = useFigureStore((s) => s.deleteSelected);
  const duplicateSelected = useFigureStore((s) => s.duplicateSelected);
  const selectedIds = useFigureStore((s) => s.selectedIds);
  const past = useFigureStore((s) => s.past);
  const future = useFigureStore((s) => s.future);
  const snapToGrid = useFigureStore((s) => s.snapToGrid);
  const showGrid = useFigureStore((s) => s.showGrid);
  const toggleSnapToGrid = useFigureStore((s) => s.toggleSnapToGrid);
  const toggleShowGrid = useFigureStore((s) => s.toggleShowGrid);
  const bringForward = useFigureStore((s) => s.bringForward);
  const sendBackward = useFigureStore((s) => s.sendBackward);

  const [query, setQuery] = useState("");

  const paletteItems = useMemo(() => {
    if (query.trim()) {
      // Filter across ALL categories when searching
      const q = query.toLowerCase();
      return PALETTE_ITEMS.filter((p) =>
        p.label.toLowerCase().includes(q) ||
        p.labelJa.toLowerCase().includes(q) ||
        p.kind.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q) ||
        (p.descriptionJa ?? "").toLowerCase().includes(q)
      );
    }
    return getItemsByCategory(activeCategory);
  }, [query, activeCategory]);

  return (
    <div className="w-[256px] shrink-0 my-2 ml-2 mr-0 flex flex-col rounded-xl border border-foreground/[0.08] bg-background/95 backdrop-blur-md shadow-lg shadow-foreground/[0.05] overflow-hidden ring-1 ring-foreground/[0.03]">

      {/* ══════ Search ══════ */}
      <div className="px-2.5 pt-2.5 pb-1.5">
        <div className="relative">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground/30 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isJa ? "図形を検索..." : "Search shapes..."}
            className="w-full h-7 pl-7 pr-7 text-[11px] rounded-md border border-foreground/[0.08] bg-white/70 dark:bg-white/5 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all placeholder:text-foreground/25"
          />
          {query && (
            <button onClick={() => setQuery("")}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-foreground/10 text-foreground/40 hover:text-foreground/70">
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* ══════ Primary tools ══════ */}
      <div className="px-2.5 pb-1.5 flex items-center gap-0.5 flex-wrap">
        <ToolBtn icon={<MousePointer2 size={16} />} label={isJa ? "選択" : "Select"} kbd="V"
          description={isJa ? "クリックで掴む、空白をドラッグで複数選択" : "Click to grab shapes, drag empty space to marquee-select"}
          active={activeTool === "select"} onClick={() => setActiveTool("select")} />
        <div className="w-px h-5 bg-foreground/[0.08] mx-0.5" />
        <ToolBtn icon={<Square size={15} />} label={isJa ? "四角形" : "Rectangle"} kbd="R"
          description={isJa ? "対角の2点をクリックして描画" : "Click two opposite corners"}
          active={activeTool === "rect"} onClick={() => setActiveTool("rect")} />
        <ToolBtn icon={<Circle size={15} />} label={isJa ? "円" : "Circle"} kbd="C"
          description={isJa ? "外接矩形の2点をクリック" : "Click two points of the bounding box"}
          active={activeTool === "circle"} onClick={() => setActiveTool("circle")} />
        <ToolBtn icon={<Minus size={15} />} label={isJa ? "直線" : "Line"} kbd="L"
          description={isJa ? "始点・終点をクリック (Shiftで15°刻み)" : "Click start, then end (Shift to snap 15°)"}
          active={activeTool === "line"} onClick={() => setActiveTool("line")} />
        <ToolBtn icon={<ArrowRight size={15} />} label={isJa ? "矢印" : "Arrow"} kbd="A"
          description={isJa ? "始点から終点への矢印" : "Directional arrow between two clicks"}
          active={activeTool === "arrow"} onClick={() => setActiveTool("arrow")} />
        <ToolBtn icon={<Type size={15} />} label={isJa ? "テキスト" : "Text"} kbd="T"
          description={isJa ? "クリックしてテキストを配置" : "Click to drop a text label"}
          active={activeTool === "text"} onClick={() => setActiveTool("text")} />
        <ToolBtn icon={<Pen size={15} />} label={isJa ? "フリーハンド" : "Freehand"}
          description={isJa ? "ドラッグで自由に描画" : "Drag to sketch a custom path"}
          active={activeTool === "freehand"} onClick={() => setActiveTool("freehand")} />
      </div>

      {/* ══════ Actions ══════ */}
      <div className="mx-2.5 mb-1.5 h-8 flex items-center gap-0.5 px-1 rounded-md bg-foreground/[0.03] border border-foreground/[0.05]">
        <IconBtn onClick={undo} disabled={past.length === 0}
          title={isJa ? "元に戻す" : "Undo"} kbd="⌘Z"
          description={isJa ? "直前の操作を取り消す" : "Revert the last change"}><Undo2 size={13} /></IconBtn>
        <IconBtn onClick={redo} disabled={future.length === 0}
          title={isJa ? "やり直し" : "Redo"} kbd="⇧⌘Z"
          description={isJa ? "取り消した操作を再適用" : "Re-apply the undone change"}><Redo2 size={13} /></IconBtn>
        <div className="w-px h-4 bg-foreground/[0.1] mx-0.5" />
        <IconBtn onClick={duplicateSelected} disabled={selectedIds.length === 0}
          title={isJa ? "複製" : "Duplicate"} kbd="⌘D"
          description={isJa ? "選択中の図形をコピー" : "Copy the selected shapes"}><Copy size={13} /></IconBtn>
        <IconBtn onClick={deleteSelected} disabled={selectedIds.length === 0} danger
          title={isJa ? "削除" : "Delete"} kbd="Del"
          description={isJa ? "選択中の図形を削除" : "Remove the selected shapes"}><Trash2 size={13} /></IconBtn>
        <div className="w-px h-4 bg-foreground/[0.1] mx-0.5" />
        <IconBtn onClick={() => selectedIds[0] && bringForward(selectedIds[0])} disabled={selectedIds.length === 0}
          title={isJa ? "前面へ" : "Bring forward"}
          description={isJa ? "1段上のレイヤーに移動" : "Move 1 step up in the z-stack"}><MoveVertical size={13} /></IconBtn>
        <IconBtn onClick={() => selectedIds[0] && sendBackward(selectedIds[0])} disabled={selectedIds.length === 0}
          title={isJa ? "背面へ" : "Send backward"}
          description={isJa ? "1段下のレイヤーに移動" : "Move 1 step down in the z-stack"}><MoveDown size={13} /></IconBtn>
        <div className="flex-1" />
        <IconBtn onClick={toggleShowGrid} toggled={showGrid}
          title={isJa ? "グリッド表示" : "Grid"}
          description={isJa ? "背景の方眼を表示/非表示" : "Show or hide background grid"}><Grid3x3 size={13} /></IconBtn>
        <IconBtn onClick={toggleSnapToGrid} toggled={snapToGrid}
          title={isJa ? "スナップ" : "Snap"}
          description={isJa ? "移動時にスナップを有効化" : "Enable smart snapping while moving"}><Magnet size={13} /></IconBtn>
      </div>

      {/* ══════ Category tabs ══════ */}
      {!query && (
        <div className="px-1.5 py-1 border-t border-foreground/[0.06] overflow-x-auto scrollbar-none">
          <div className="flex gap-0.5">
            {CATEGORIES.map((cat) => {
              const active = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`relative flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-semibold whitespace-nowrap transition-all duration-150 ${
                    active
                      ? "bg-foreground/[0.08] text-foreground shadow-sm"
                      : "text-foreground/45 hover:text-foreground/75 hover:bg-foreground/[0.04]"
                  }`}
                >
                  <span className="text-[12px]">{cat.icon}</span>
                  <span>{isJa ? cat.labelJa : cat.label}</span>
                  {active && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-0.5 w-5 rounded-full bg-blue-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════ Palette grid (scrollable) ══════ */}
      <div className="flex-1 overflow-y-auto px-2 py-2 border-t border-foreground/[0.04]">
        {query && (
          <div className="text-[10px] text-foreground/40 font-medium mb-1.5 px-1">
            {paletteItems.length} {isJa ? "件の結果" : paletteItems.length === 1 ? "result" : "results"}
          </div>
        )}
        <div className="grid grid-cols-3 gap-1">
          {paletteItems.map((item) => (
            <PaletteItemBtn
              key={item.kind}
              item={item}
              active={activeTool === item.kind}
              isJa={isJa}
              onClick={() => setActiveTool(item.kind)}
            />
          ))}
        </div>
        {paletteItems.length === 0 && (
          <div className="text-center text-foreground/30 text-xs py-8">
            {isJa ? "該当なし" : "No results"}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  IconBtn (reusable small icon button for the action bar)
// ══════════════════════════════════════════════════════════════════

function IconBtn({
  children, onClick, disabled, title, kbd, description, toggled, danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  kbd?: string;
  description?: string;
  toggled?: boolean;
  danger?: boolean;
}) {
  const base = "h-6 w-6 flex items-center justify-center rounded transition-all duration-120";
  const state = disabled
    ? "text-foreground/20 cursor-not-allowed"
    : toggled
    ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/15"
    : danger
    ? "text-foreground/50 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
    : "text-foreground/50 hover:text-foreground/85 hover:bg-foreground/[0.06]";
  return (
    <HelpTip title={title} description={description} kbd={kbd} disabled={disabled}>
      <button onClick={onClick} disabled={disabled} className={`${base} ${state}`}>
        {children}
      </button>
    </HelpTip>
  );
}
