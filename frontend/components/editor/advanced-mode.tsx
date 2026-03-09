"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useDocumentStore } from "@/store/document-store";
import { getAllowedPackages } from "@/lib/api";
import {
  Code2,
  Lock,
  Unlock,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  Shield,
  Terminal,
  Package,
  Braces,
  BookOpen,
  Sparkles,
  Info,
  Check,
  Zap,
  Beaker,
  PenTool,
  LayoutGrid,
  Type,
  Calculator,
  Image,
  Table2,
  Palette,
  FileCode,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   プリセット定義
   ═══════════════════════════════════════════════════════════ */

interface PreamblePreset {
  id: string;
  name: string;
  description: string;
  code: string;
  category: "math" | "layout" | "style" | "science" | "table" | "figure";
}

const PREAMBLE_PRESETS: PreamblePreset[] = [
  // 数学系
  {
    id: "siunitx",
    name: "SI単位",
    description: "物理量の単位を美しく表記",
    code: "\\usepackage{siunitx}\n\\sisetup{locale=JP}",
    category: "math",
  },
  {
    id: "mathtools",
    name: "数式拡張",
    description: "数式の配置・装飾を強化",
    code: "\\usepackage{mathtools}",
    category: "math",
  },
  {
    id: "physics",
    name: "物理記法",
    description: "微分・ブラケット等の物理記法",
    code: "\\usepackage{physics}",
    category: "math",
  },
  {
    id: "cancel",
    name: "打ち消し線",
    description: "数式の項を取り消し線で消す",
    code: "\\usepackage{cancel}",
    category: "math",
  },
  // レイアウト系
  {
    id: "geometry-narrow",
    name: "余白縮小",
    description: "ページ余白を狭くしてスペース確保",
    code: "\\usepackage[margin=2cm]{geometry}",
    category: "layout",
  },
  {
    id: "geometry-wide",
    name: "余白拡大",
    description: "読みやすさを重視した広い余白",
    code: "\\usepackage[margin=3.5cm]{geometry}",
    category: "layout",
  },
  {
    id: "fancyhdr",
    name: "ヘッダー/フッター",
    description: "ページ番号やタイトルのカスタム配置",
    code: "\\usepackage{fancyhdr}\n\\pagestyle{fancy}\n\\fancyhf{}\n\\fancyhead[L]{\\leftmark}\n\\fancyfoot[C]{\\thepage}",
    category: "layout",
  },
  {
    id: "multicol",
    name: "段組み",
    description: "本文を2段組にレイアウト",
    code: "\\usepackage{multicol}",
    category: "layout",
  },
  // 見た目系
  {
    id: "hyperref",
    name: "ハイパーリンク",
    description: "目次や参照にリンクを自動付与",
    code: "\\usepackage[hidelinks]{hyperref}",
    category: "style",
  },
  {
    id: "enumitem",
    name: "リスト装飾",
    description: "箇条書きのマーク・間隔を柔軟に変更",
    code: "\\usepackage{enumitem}",
    category: "style",
  },
  {
    id: "xcolor-names",
    name: "拡張カラー",
    description: "色名（dvipsnames）を使えるようにする",
    code: "\\usepackage[dvipsnames]{xcolor}",
    category: "style",
  },
  // 理科系
  {
    id: "chemfig",
    name: "化学構造",
    description: "有機化学の構造式を描画",
    code: "\\usepackage{chemfig}",
    category: "science",
  },
  {
    id: "mhchem",
    name: "化学式",
    description: "化学反応式を簡潔に記述",
    code: "\\usepackage[version=4]{mhchem}",
    category: "science",
  },
  // 表
  {
    id: "booktabs",
    name: "美しい表",
    description: "プロフェッショナルな罫線スタイル",
    code: "\\usepackage{booktabs}",
    category: "table",
  },
  {
    id: "longtable",
    name: "長い表",
    description: "ページをまたぐ長い表",
    code: "\\usepackage{longtable}",
    category: "table",
  },
  // 図
  {
    id: "wrapfig",
    name: "テキスト回り込み",
    description: "図の周りにテキストを回り込ませる",
    code: "\\usepackage{wrapfig}",
    category: "figure",
  },
  {
    id: "subcaption",
    name: "サブ図",
    description: "複数の図を並べてキャプション付与",
    code: "\\usepackage{subcaption}",
    category: "figure",
  },
];

interface CommandPreset {
  id: string;
  name: string;
  description: string;
  code: string;
}

const COMMAND_PRESETS: CommandPreset[] = [
  { id: "reals", name: "\\R", description: "実数 ℝ", code: "\\newcommand{\\R}{\\mathbb{R}}" },
  { id: "naturals", name: "\\N", description: "自然数 ℕ", code: "\\newcommand{\\N}{\\mathbb{N}}" },
  { id: "integers", name: "\\Z", description: "整数 ℤ", code: "\\newcommand{\\Z}{\\mathbb{Z}}" },
  { id: "complex", name: "\\C", description: "複素数 ℂ", code: "\\newcommand{\\C}{\\mathbb{C}}" },
  { id: "norm", name: "\\norm", description: "ノルム ‖x‖", code: "\\newcommand{\\norm}[1]{\\left\\lVert #1 \\right\\rVert}" },
  { id: "abs", name: "\\abs", description: "絶対値 |x|", code: "\\newcommand{\\abs}[1]{\\left\\lvert #1 \\right\\rvert}" },
  { id: "inner", name: "\\inner", description: "内積 ⟨x,y⟩", code: "\\newcommand{\\inner}[2]{\\left\\langle #1, #2 \\right\\rangle}" },
  { id: "diff", name: "\\diff", description: "微分 d/dx", code: "\\newcommand{\\diff}[2]{\\frac{\\mathrm{d}#1}{\\mathrm{d}#2}}" },
  { id: "pdiff", name: "\\pdiff", description: "偏微分 ∂/∂x", code: "\\newcommand{\\pdiff}[2]{\\frac{\\partial #1}{\\partial #2}}" },
  { id: "floor", name: "\\floor", description: "床関数 ⌊x⌋", code: "\\newcommand{\\floor}[1]{\\left\\lfloor #1 \\right\\rfloor}" },
  { id: "ceil", name: "\\ceil", description: "天井関数 ⌈x⌉", code: "\\newcommand{\\ceil}[1]{\\left\\lceil #1 \\right\\rceil}" },
];

interface HookPreset {
  id: string;
  name: string;
  description: string;
  code: string;
  position: "pre" | "post";
}

const HOOK_PRESETS: HookPreset[] = [
  { id: "toc", name: "目次を挿入", description: "文書先頭に自動目次を生成", code: "\\tableofcontents\n\\newpage", position: "pre" },
  { id: "listfigures", name: "図目次を挿入", description: "図の一覧を自動生成", code: "\\listoffigures", position: "pre" },
  { id: "listtables", name: "表目次を挿入", description: "表の一覧を自動生成", code: "\\listoftables", position: "pre" },
  { id: "abstract", name: "概要欄を追加", description: "abstract環境を挿入", code: "\\begin{abstract}\n% ここに概要を記入\n\\end{abstract}", position: "pre" },
  { id: "appendix", name: "付録を追加", description: "\\appendix以降を付録に", code: "\\appendix\n\\section{付録}", position: "post" },
  { id: "bibliography", name: "参考文献", description: "本文末に参考文献一覧を追加", code: "\\begin{thebibliography}{99}\n\\bibitem{ref1} 著者名, タイトル, 出版社, 年.\n\\end{thebibliography}", position: "post" },
];

const CATEGORY_META: Record<PreamblePreset["category"], { label: string; icon: React.ReactNode; color: string }> = {
  math: { label: "数学", icon: <Calculator className="h-3 w-3" />, color: "text-blue-600 dark:text-blue-400" },
  layout: { label: "レイアウト", icon: <LayoutGrid className="h-3 w-3" />, color: "text-emerald-600 dark:text-emerald-400" },
  style: { label: "見た目", icon: <Palette className="h-3 w-3" />, color: "text-pink-600 dark:text-pink-400" },
  science: { label: "理科", icon: <Beaker className="h-3 w-3" />, color: "text-orange-600 dark:text-orange-400" },
  table: { label: "表", icon: <Table2 className="h-3 w-3" />, color: "text-cyan-600 dark:text-cyan-400" },
  figure: { label: "図", icon: <Image className="h-3 w-3" />, color: "text-violet-600 dark:text-violet-400" },
};

/* ═══ プリセットカード ═══ */
function PresetCard({
  name,
  description,
  active,
  onClick,
}: {
  name: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        group w-full text-left px-3 py-2 rounded-lg border text-[11px] transition-all duration-200
        ${active
          ? "bg-purple-50 dark:bg-purple-950/30 border-purple-300 dark:border-purple-700 ring-1 ring-purple-200/50 dark:ring-purple-800/50"
          : "bg-card border-border/30 hover:bg-muted/50 hover:border-border/60"
        }
      `}
    >
      <div className="flex items-center gap-2">
        <div className={`h-4 w-4 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
          active
            ? "bg-purple-600 text-white"
            : "border border-border/60 bg-background group-hover:border-purple-300"
        }`}>
          {active && <Check className="h-2.5 w-2.5" />}
        </div>
        <span className={`font-mono font-semibold ${active ? "text-purple-700 dark:text-purple-300" : "text-foreground/80"}`}>
          {name}
        </span>
      </div>
      <p className="text-[9px] text-muted-foreground mt-0.5 ml-6">{description}</p>
    </button>
  );
}

/* ═══ コマンドプリセットピル ═══ */
function CommandPill({
  preset,
  active,
  onClick,
}: {
  preset: CommandPreset;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium border transition-all duration-200
        ${active
          ? "bg-purple-50 dark:bg-purple-950/30 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300"
          : "bg-card border-border/30 text-foreground/70 hover:bg-muted/50 hover:border-border/60"
        }
      `}
      title={`${preset.code}`}
    >
      {active && <Check className="h-2.5 w-2.5 text-purple-600 dark:text-purple-400" />}
      <span className="font-mono">{preset.name}</span>
      <span className="text-[8px] text-muted-foreground">{preset.description}</span>
    </button>
  );
}

/* ═══ フックプリセットカード ═══ */
function HookCard({
  preset,
  active,
  onClick,
}: {
  preset: HookPreset;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left px-3 py-2 rounded-lg border text-[11px] transition-all duration-200
        ${active
          ? "bg-purple-50 dark:bg-purple-950/30 border-purple-300 dark:border-purple-700"
          : "bg-card border-border/30 hover:bg-muted/50 hover:border-border/60"
        }
      `}
    >
      <div className="flex items-center gap-2">
        <div className={`h-4 w-4 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
          active
            ? "bg-purple-600 text-white"
            : "border border-border/60 bg-background"
        }`}>
          {active && <Check className="h-2.5 w-2.5" />}
        </div>
        <span className={`font-semibold ${active ? "text-purple-700 dark:text-purple-300" : "text-foreground/80"}`}>
          {preset.name}
        </span>
        <span className={`ml-auto px-1.5 py-0.5 rounded text-[8px] font-medium ${
          preset.position === "pre"
            ? "bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400"
            : "bg-amber-100 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400"
        }`}>
          {preset.position === "pre" ? "文書前" : "文書後"}
        </span>
      </div>
      <p className="text-[9px] text-muted-foreground mt-0.5 ml-6">{preset.description}</p>
    </button>
  );
}

/* ═══ 折りたたみセクション (改良版) ═══ */
function CollapsibleSection({
  title,
  icon,
  children,
  defaultOpen = false,
  badge,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border/30 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-foreground/70 hover:text-foreground hover:bg-muted/30 transition-colors"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        )}
        {icon}
        <span className="flex-1 text-left">{title}</span>
        {badge !== undefined && badge > 0 && (
          <span className="px-1.5 py-0.5 text-[9px] bg-purple-100 text-purple-700 rounded-md dark:bg-purple-900/40 dark:text-purple-300 font-bold">
            {badge} 選択
          </span>
        )}
      </button>
      {open && (
        <div className="px-3 pb-3 animate-in fade-in slide-in-from-top-2 duration-200">
          {children}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   メインパネル
   ═══════════════════════════════════════════════════════════ */
export function AdvancedModePanel() {
  const document = useDocumentStore((s) => s.document);
  const updateAdvanced = useDocumentStore((s) => s.updateAdvanced);
  const toggleAdvancedMode = useDocumentStore((s) => s.toggleAdvancedMode);

  const [allowedPackages, setAllowedPackages] = useState<string[]>([]);
  const [allowedTikzLibs, setAllowedTikzLibs] = useState<string[]>([]);
  const [packageSearch, setPackageSearch] = useState("");

  const advanced = document?.advanced || {
    enabled: false,
    customPreamble: "",
    preDocument: "",
    postDocument: "",
    customCommands: [],
  };

  // 許可パッケージ一覧を取得
  useEffect(() => {
    if (advanced.enabled && allowedPackages.length === 0) {
      getAllowedPackages()
        .then((data) => {
          setAllowedPackages(data.packages);
          setAllowedTikzLibs(data.tikzLibraries);
        })
        .catch(() => {});
    }
  }, [advanced.enabled, allowedPackages.length]);

  /* ── プリセットのON/OFF管理 ── */
  const activePreamblePresets = useMemo(() => {
    const active = new Set<string>();
    PREAMBLE_PRESETS.forEach((p) => {
      if (advanced.customPreamble.includes(p.code.split("\n")[0])) {
        active.add(p.id);
      }
    });
    return active;
  }, [advanced.customPreamble]);

  const togglePreamblePreset = useCallback(
    (preset: PreamblePreset) => {
      if (activePreamblePresets.has(preset.id)) {
        const lines = advanced.customPreamble.split("\n");
        const presetLines = preset.code.split("\n");
        const filtered = lines.filter(
          (line) => !presetLines.some((pl) => line.trim() === pl.trim())
        );
        updateAdvanced({ customPreamble: filtered.filter(Boolean).join("\n") });
      } else {
        const current = advanced.customPreamble.trim();
        updateAdvanced({
          customPreamble: current ? `${current}\n${preset.code}` : preset.code,
        });
      }
    },
    [activePreamblePresets, advanced.customPreamble, updateAdvanced]
  );

  const activeCommandPresets = useMemo(() => {
    const active = new Set<string>();
    COMMAND_PRESETS.forEach((p) => {
      if (advanced.customCommands.some((cmd) => cmd.includes(p.code.split("{")[1]?.split("}")[0] || p.id))) {
        active.add(p.id);
      }
    });
    return active;
  }, [advanced.customCommands]);

  const toggleCommandPreset = useCallback(
    (preset: CommandPreset) => {
      if (activeCommandPresets.has(preset.id)) {
        updateAdvanced({
          customCommands: advanced.customCommands.filter(
            (cmd) => !cmd.includes(preset.code.split("{")[1]?.split("}")[0] || preset.id)
          ),
        });
      } else {
        updateAdvanced({
          customCommands: [...advanced.customCommands, preset.code],
        });
      }
    },
    [activeCommandPresets, advanced.customCommands, updateAdvanced]
  );

  const activeHookPresets = useMemo(() => {
    const active = new Set<string>();
    HOOK_PRESETS.forEach((p) => {
      const target = p.position === "pre" ? advanced.preDocument : advanced.postDocument;
      if (target.includes(p.code.split("\n")[0])) {
        active.add(p.id);
      }
    });
    return active;
  }, [advanced.preDocument, advanced.postDocument]);

  const toggleHookPreset = useCallback(
    (preset: HookPreset) => {
      const key = preset.position === "pre" ? "preDocument" : "postDocument";
      const current = preset.position === "pre" ? advanced.preDocument : advanced.postDocument;

      if (activeHookPresets.has(preset.id)) {
        const lines = current.split("\n");
        const presetLines = preset.code.split("\n");
        const filtered = lines.filter(
          (line) => !presetLines.some((pl) => line.trim() === pl.trim())
        );
        updateAdvanced({ [key]: filtered.filter(Boolean).join("\n") });
      } else {
        const trimmed = current.trim();
        updateAdvanced({
          [key]: trimmed ? `${trimmed}\n${preset.code}` : preset.code,
        });
      }
    },
    [activeHookPresets, advanced.preDocument, advanced.postDocument, updateAdvanced]
  );

  const groupedPresets = useMemo(() => {
    const groups = new Map<PreamblePreset["category"], PreamblePreset[]>();
    PREAMBLE_PRESETS.forEach((p) => {
      const list = groups.get(p.category) || [];
      list.push(p);
      groups.set(p.category, list);
    });
    return groups;
  }, []);

  const filteredPackages = packageSearch
    ? allowedPackages.filter((p) =>
        p.toLowerCase().includes(packageSearch.toLowerCase())
      )
    : allowedPackages;

  const totalActiveCount = activePreamblePresets.size + activeCommandPresets.size + activeHookPresets.size;

  if (!document) return null;

  return (
    <div className="space-y-3">
      {/* ── メインスイッチ ── */}
      <button
        onClick={toggleAdvancedMode}
        className={`
          w-full group flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-300
          ${
            advanced.enabled
              ? "bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30 border border-purple-200/50 dark:border-purple-700/30 shadow-sm shadow-purple-100/50 dark:shadow-purple-900/20"
              : "bg-muted/30 border border-border/30 hover:bg-muted/50 hover:border-border/50"
          }
        `}
      >
        <div
          className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-300 ${
            advanced.enabled
              ? "bg-purple-600 text-white shadow-md shadow-purple-500/30"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {advanced.enabled ? (
            <Unlock className="h-4 w-4" />
          ) : (
            <Lock className="h-4 w-4" />
          )}
        </div>
        <div className="flex-1 text-left">
          <div className="font-semibold text-xs tracking-tight">
            上級者モード
          </div>
          <div className="text-[10px] text-muted-foreground">
            {advanced.enabled
              ? `プリセット${totalActiveCount > 0 ? ` ${totalActiveCount}個` : ""}適用中`
              : "クリックで LaTeX カスタマイズを有効化"}
          </div>
        </div>
        {advanced.enabled && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-semibold bg-purple-600 text-white rounded-full">
            <Sparkles className="h-2.5 w-2.5" />
            ON
          </span>
        )}
      </button>

      {/* ── 展開コンテンツ ── */}
      {advanced.enabled && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
          {/* セキュリティ情報 */}
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-purple-50/60 dark:bg-purple-950/15 border border-purple-200/30 dark:border-purple-700/20">
            <Shield className="h-3 w-3 text-purple-500 mt-0.5 flex-shrink-0" />
            <p className="text-[9px] text-purple-700/80 dark:text-purple-300/70 leading-relaxed">
              プリセットから選択するだけで LaTeX をカスタマイズできます。安全な構文のみ許可されています。
            </p>
          </div>

          {/* ═══ 1. パッケージプリセット ═══ */}
          <CollapsibleSection
            title="パッケージ追加"
            icon={<Package className="h-3 w-3 text-purple-500" />}
            defaultOpen={activePreamblePresets.size > 0 || true}
            badge={activePreamblePresets.size}
          >
            <div className="space-y-3">
              {Array.from(groupedPresets.entries()).map(([cat, presets]) => {
                const meta = CATEGORY_META[cat];
                return (
                  <div key={cat} className="space-y-1.5">
                    <div className="flex items-center gap-1.5 px-0.5">
                      <span className={meta.color}>{meta.icon}</span>
                      <span className="text-[9px] font-semibold text-foreground/60">{meta.label}</span>
                    </div>
                    <div className="space-y-1">
                      {presets.map((preset) => (
                        <PresetCard
                          key={preset.id}
                          name={preset.name}
                          description={preset.description}
                          active={activePreamblePresets.has(preset.id)}
                          onClick={() => togglePreamblePreset(preset)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>

          {/* ═══ 2. コマンドプリセット ═══ */}
          <CollapsibleSection
            title="数学記号ショートカット"
            icon={<Braces className="h-3 w-3 text-purple-500" />}
            defaultOpen={activeCommandPresets.size > 0}
            badge={activeCommandPresets.size}
          >
            <div className="space-y-2">
              <p className="text-[9px] text-muted-foreground/60 leading-relaxed">
                よく使う数学記号のショートカットコマンドをワンクリックで追加
              </p>
              <div className="flex flex-wrap gap-1.5">
                {COMMAND_PRESETS.map((preset) => (
                  <CommandPill
                    key={preset.id}
                    preset={preset}
                    active={activeCommandPresets.has(preset.id)}
                    onClick={() => toggleCommandPreset(preset)}
                  />
                ))}
              </div>
            </div>
          </CollapsibleSection>

          {/* ═══ 3. フックプリセット ═══ */}
          <CollapsibleSection
            title="文書構成オプション"
            icon={<BookOpen className="h-3 w-3 text-purple-500" />}
            defaultOpen={activeHookPresets.size > 0}
            badge={activeHookPresets.size}
          >
            <div className="space-y-2">
              <p className="text-[9px] text-muted-foreground/60 leading-relaxed">
                目次や参考文献など、文書の構成要素を追加
              </p>
              <div className="space-y-1">
                {HOOK_PRESETS.map((preset) => (
                  <HookCard
                    key={preset.id}
                    preset={preset}
                    active={activeHookPresets.has(preset.id)}
                    onClick={() => toggleHookPreset(preset)}
                  />
                ))}
              </div>
            </div>
          </CollapsibleSection>

          {/* ═══ 4. カスタムコード (上級者向け、デフォルト折りたたみ) ═══ */}
          <CollapsibleSection
            title="カスタムコード"
            icon={<FileCode className="h-3 w-3 text-purple-500" />}
            defaultOpen={false}
          >
            <div className="space-y-3">
              <div className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-amber-50/60 dark:bg-amber-950/15 border border-amber-200/30 dark:border-amber-700/20">
                <Info className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-[9px] text-amber-700/80 dark:text-amber-300/70 leading-relaxed">
                  プリセットにない独自の設定が必要な場合のみ使用してください。
                  <code className="px-0.5 bg-amber-100 dark:bg-amber-900/50 rounded text-[8px]">\input</code>,
                  <code className="px-0.5 bg-amber-100 dark:bg-amber-900/50 rounded text-[8px]">\write18</code>
                  等は禁止です。
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-foreground/60 flex items-center gap-1">
                  <Terminal className="h-3 w-3 text-purple-500" />
                  プリアンブル追記
                </label>
                <textarea
                  value={advanced.customPreamble}
                  onChange={(e) => updateAdvanced({ customPreamble: e.target.value })}
                  placeholder="% プリセットに無いカスタム設定をここに"
                  rows={3}
                  spellCheck={false}
                  className="w-full px-3 py-2 text-[10px] font-mono leading-relaxed bg-slate-950 text-emerald-400 border border-slate-800/80 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all placeholder:text-slate-600"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-foreground/60 flex items-center gap-1">
                  <Terminal className="h-3 w-3 text-purple-500" />
                  文書前フック
                </label>
                <textarea
                  value={advanced.preDocument}
                  onChange={(e) => updateAdvanced({ preDocument: e.target.value })}
                  placeholder="% \\maketitle 直後に挿入"
                  rows={2}
                  spellCheck={false}
                  className="w-full px-3 py-2 text-[10px] font-mono leading-relaxed bg-slate-950 text-emerald-400 border border-slate-800/80 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all placeholder:text-slate-600"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-foreground/60 flex items-center gap-1">
                  <Terminal className="h-3 w-3 text-purple-500" />
                  文書後フック
                </label>
                <textarea
                  value={advanced.postDocument}
                  onChange={(e) => updateAdvanced({ postDocument: e.target.value })}
                  placeholder="% \\end{document} 直前に挿入"
                  rows={2}
                  spellCheck={false}
                  className="w-full px-3 py-2 text-[10px] font-mono leading-relaxed bg-slate-950 text-emerald-400 border border-slate-800/80 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all placeholder:text-slate-600"
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* ═══ 5. 利用可能パッケージ参照 ═══ */}
          <CollapsibleSection
            title="パッケージ一覧(参照)"
            icon={<Package className="h-3 w-3 text-purple-500" />}
            badge={allowedPackages.length > 0 ? allowedPackages.length : undefined}
          >
            <div className="space-y-2">
              {allowedPackages.length > 0 && (
                <>
                  <input
                    type="text"
                    value={packageSearch}
                    onChange={(e) => setPackageSearch(e.target.value)}
                    placeholder="パッケージを検索..."
                    className="w-full px-2.5 py-1.5 text-[11px] bg-muted/20 border border-border/30 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500/30 transition-all placeholder:text-muted-foreground/30"
                  />
                  <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto">
                    {filteredPackages.map((pkg) => (
                      <span
                        key={pkg}
                        className="px-1.5 py-0.5 text-[9px] bg-muted/40 border border-border/20 rounded-md font-mono text-foreground/60 hover:bg-muted/60 hover:text-foreground/80 transition-colors cursor-default"
                      >
                        {pkg}
                      </span>
                    ))}
                  </div>
                </>
              )}

              {allowedTikzLibs.length > 0 && (
                <div className="pt-2 border-t border-border/20">
                  <p className="text-[9px] text-muted-foreground/60 mb-1.5 font-medium">
                    TikZ ライブラリ
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {allowedTikzLibs.map((lib) => (
                      <span
                        key={lib}
                        className="px-1.5 py-0.5 text-[9px] bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200/30 dark:border-cyan-700/30 rounded-md font-mono text-cyan-700 dark:text-cyan-300 cursor-default"
                      >
                        {lib}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {allowedPackages.length === 0 && (
                <p className="text-[10px] text-muted-foreground/50 text-center py-2">
                  読み込み中...
                </p>
              )}
            </div>
          </CollapsibleSection>
        </div>
      )}
    </div>
  );
}
