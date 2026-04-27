"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDocumentStore } from "@/store/document-store";
import { createDefaultDocument } from "@/lib/types";
import { getTemplateLatex } from "@/lib/templates";
import { loadFromLocalStorage } from "@/lib/storage";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useVisibleInterval } from "@/hooks/use-visible-interval";
import { MobileLanding } from "./mobile-landing";
import { AnonymousTrialModal } from "./anonymous-trial-modal";
import { hasUsedAnonymousTrial } from "@/lib/anonymous-trial";
import { trackFreeGenerateLimitReached } from "@/lib/gtag";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { UserMenu } from "@/components/auth/user-menu";
import { toast } from "sonner";
import { usePlanStore } from "@/store/plan-store";
import { PLANS, type PlanId } from "@/lib/plans";
import "katex/dist/katex.min.css";
import { renderMathHTML } from "@/lib/katex-render";
import {
  ArrowRight,
  ChevronRight,
  FileText,
  Sparkles,
  Printer,
  BookOpen,
  CheckSquare,
  Upload,
  Copy,
  Code2,
  ChevronDown,
  PenLine,
  GraduationCap,
  Users,
  RefreshCw,
  FileDown,
  Layers,
  Pencil,
  Zap,
  Shield,
  Star,
  Check,
  Crown,
  Brain,
  Wrench,
  Hammer,
  Play,
  Plus,
  ClipboardCheck,
  MousePointer2,
  Square,
  Circle as CircleIcon,
  Minus as MinusIcon,
  Type as TypeIcon,
  Pen as PenIcon,
  ImagePlus,
  Eye,
  X,
} from "lucide-react";

/* ── Floating math formulas background ── */
const FLOAT_FORMULAS = [
  "x²+3x−4=0", "∫₀^π sin x dx", "∑ₙ₌₁^∞ 1/n²", "√(a²+b²)",
  "lim x→0", "f'(x)=2x", "Δy/Δx", "∂f/∂x",
  "∠ABC=60°", "πr²", "eⁱᶿ", "log₂8=3",
  "sin²θ+cos²θ=1", "n!", "∇×F", "∮",
  "det(A)", "∥v∥", "∞", "⊆",
];

function FloatingFormulas() {
  // Pause animations off-screen + reduced-motion を尊重 (パフォーマンス + a11y)
  // モバイル幅では数を半分 (10 個) に削減して DOM サイズと paint コストを抑制
  const ref = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(true);
  const [formulas, setFormulas] = useState<typeof FLOAT_FORMULAS>(FLOAT_FORMULAS);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(max-width: 767px)").matches) {
      setFormulas(FLOAT_FORMULAS.slice(0, 10));
    }
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setPaused(true);
      return;
    }
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setPaused(false);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setPaused(!entry.isIntersecting);
      },
      { threshold: 0.01 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      {formulas.map((formula, i) => (
        <div
          key={i}
          className="absolute animate-float-formula"
          style={{
            left: `${(i * 17 + 5) % 92}%`,
            top: `${(i * 23 + 10) % 88}%`,
            animationDelay: `${i * 0.7}s`,
            animationDuration: `${20 + (i % 6) * 4}s`,
            animationPlayState: paused ? "paused" : "running",
            willChange: paused ? "auto" : "transform",
          }}
        >
          <span className="text-[11px] sm:text-[13px] font-mono text-foreground/[0.055] dark:text-white/[0.045] font-medium whitespace-nowrap">
            {formula}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Ambient glow orb ── */
function GlowOrb({ className }: { className: string }) {
  return (
    <div
      className={`absolute rounded-full blur-[120px] pointer-events-none ${className}`}
    />
  );
}

/* ── Intersection Observer fade-in ── */
function useFadeIn(delay = 0) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setVisible(true), delay);
          observer.unobserve(el);
        }
      },
      { threshold: 0.06 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);
  return { ref, isVisible };
}

/* ── Animated counter ── */
function AnimatedCounter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const { ref, isVisible } = useFadeIn(0);
  useEffect(() => {
    if (!isVisible) return;
    let start = 0;
    const step = value / 40;
    const timer = setInterval(() => {
      start += step;
      if (start >= value) { setCount(value); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 30);
    return () => clearInterval(timer);
  }, [isVisible, value]);
  return (
    <span ref={ref}>
      {count.toLocaleString()}{suffix}
    </span>
  );
}

/* ── Step card ──
 * `planBadge` で「この手順はどのプランから使えるか」を明示する。
 * LP 上の整合性を保つためのラベルで、Free で完結するフローは "Freeでも" と書く。
 */
type StepPlanBadge = "free" | "starter-plus" | "pro-plus";

function StepCard({ num, icon, title, desc, color, planBadge }: {
  num: string; icon: React.ReactNode; title: string; desc: string; color: string;
  planBadge?: StepPlanBadge;
}) {
  // 各バッジのラベル + 配色。Free = エメラルド、Starter+ = エメラルド濃色、Pro+ = 紫
  const badgeMeta: Record<StepPlanBadge, { ja: string; en: string; className: string }> = {
    "free":         { ja: "Freeでも",     en: "Free",        className: "text-emerald-700 bg-emerald-500/12 border-emerald-500/30 dark:text-emerald-300" },
    "starter-plus": { ja: "Starter〜",    en: "Starter+",    className: "text-emerald-700 bg-emerald-500/15 border-emerald-500/40 dark:text-emerald-300" },
    "pro-plus":     { ja: "Pro〜",        en: "Pro+",        className: "text-violet-700 bg-gradient-to-r from-blue-500/15 to-violet-500/15 border-violet-500/35 dark:text-violet-300" },
  };

  return (
    <div className="relative flex flex-col items-start gap-3 p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-foreground/[0.06] hover:border-foreground/[0.12] hover:shadow-xl hover:-translate-y-0.5 transition-all duration-400 group">
      {planBadge && (
        <span className={`absolute top-3 right-3 inline-flex items-center gap-1 text-[9px] font-bold tracking-wide px-1.5 py-0.5 rounded-md border ${badgeMeta[planBadge].className}`}>
          {badgeMeta[planBadge].ja}
        </span>
      )}
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-white shadow-md group-hover:scale-110 group-hover:shadow-lg transition-all duration-300 ${color}`}>
        {icon}
      </div>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-mono text-muted-foreground/40 font-bold tracking-wider">{num}</span>
          <h3 className="text-[14px] font-semibold tracking-tight">{title}</h3>
        </div>
        <p className="text-[12px] text-muted-foreground leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

/* ── Pro 解放フローカード ──
 * Workflow セクションの「Pro で解放」ブロック内で使う、小さめのカード。
 * Free の 4 ステップと視覚的に差別化 (紫グラデ枠 + 小さめの装飾)。
 */
function ProWorkflowCard({
  icon, title, desc, color,
}: {
  icon: React.ReactNode; title: string; desc: string; color: string;
}) {
  return (
    <div className="relative flex flex-col items-start gap-2.5 p-4 rounded-xl bg-card/70 backdrop-blur-sm border border-foreground/[0.05] hover:border-violet-500/25 hover:shadow-lg hover:shadow-violet-500/[0.08] transition-all duration-300 group">
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform duration-300 ${color}`}>
        {icon}
      </div>
      <h4 className="text-[13px] font-bold tracking-tight">{title}</h4>
      <p className="text-[11.5px] text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}

/* ── Typing animation for hero subtitle ── */
function TypingLine({ lines }: { lines: string[] }) {
  const [lineIdx, setLineIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);
  // Adjust state during render when `lines` changes (language switch) —
  // official React pattern that avoids a useEffect-triggered extra render.
  const [prevLines, setPrevLines] = useState(lines);
  if (prevLines !== lines) {
    setPrevLines(lines);
    setLineIdx(0);
    setCharIdx(0);
    setDeleting(false);
  }

  // lineIdx が範囲外にならないよう安全にクランプ
  const safeLineIdx = lineIdx < lines.length ? lineIdx : 0;
  const current = lines[safeLineIdx] ?? "";

  useEffect(() => {
    const delay = deleting ? 30 : charIdx === current.length ? 2200 : 45;
    const t = setTimeout(() => {
      if (!deleting && charIdx < current.length) {
        setCharIdx((c) => c + 1);
      } else if (!deleting && charIdx === current.length) {
        setDeleting(true);
      } else if (deleting && charIdx > 0) {
        setCharIdx((c) => c - 1);
      } else {
        setDeleting(false);
        setLineIdx((i) => (i + 1) % lines.length);
      }
    }, delay);
    return () => clearTimeout(t);
  }, [charIdx, deleting, current, lines, safeLineIdx]);

  return (
    <span className="inline-block">
      <span className="bg-gradient-to-r from-blue-500 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent font-semibold">
        {current.slice(0, charIdx)}
      </span>
      <span className="animate-pulse text-violet-400">|</span>
    </span>
  );
}

/* ── Editor Workspace Mockup ── */
/* ── 30-second looping demo ── */
function EditorMockup({ isJa }: { isJa: boolean }) {
  const CYCLE = 30000; // 30 s
  // 可視時のみ tick を回す (off-screen / 非表示タブでは完全停止 → TBT を抑える)
  const containerRef = useRef<HTMLDivElement>(null);
  const [tick] = useVisibleInterval(containerRef, 100);

  const e = (tick * 100) % CYCLE; // elapsed ms in current cycle

  // ── Text content ──
  const p1 = isJa ? "二次方程式の練習問題を5問作って" : "Make 5 quadratic equation problems";
  const p2 = isJa ? "もう少し難しくして" : "Make them harder";
  const a1 = isJa ? "5問作成しました。紙面に反映しました。" : "Done — 5 problems created and applied!";
  const a2 = isJa ? "難易度を上げて更新しました。" : "Updated with harder variants.";

  // ── Timeline (ms) — paced to fill ~30 s cycle ──
  const T = {
    type1: 2000,  send1: 2000 + p1.length * 130 + 500,
    think1: 0,    ai1: 0,      content1: 0,  applied1: 0,
    type2: 0,     send2: 0,
    think2: 0,    ai2: 0,      content2: 0,  applied2: 0,
    fadeOut: 27500,
  };
  T.think1 = T.send1 + 400;
  T.ai1    = T.think1 + 3000;
  T.content1 = T.ai1 + 400;
  T.applied1 = T.content1 + 3500;
  T.type2    = T.applied1 + 3000;
  T.send2    = T.type2 + p2.length * 150 + 500;
  T.think2   = T.send2 + 400;
  T.ai2      = T.think2 + 2800;
  T.content2 = T.ai2 + 400;
  T.applied2 = T.content2 + 2000;

  // ── Derived state ──
  const typingProgress = (start: number, text: string, charMs: number) => {
    if (e < start) return 0;
    return Math.min(text.length, Math.floor((e - start) / charMs));
  };
  const typing1 = e >= T.type1 && e < T.send1 ? typingProgress(T.type1, p1, 130) : 0;
  const typing2 = e >= T.type2 && e < T.send2 ? typingProgress(T.type2, p2, 150) : 0;
  const inputText = typing2 > 0 ? p2.slice(0, typing2) : typing1 > 0 ? p1.slice(0, typing1) : "";
  const showInputCursor = typing1 > 0 || typing2 > 0;

  const showUser1    = e >= T.send1;
  const showAi1      = e >= T.ai1;
  const showApplied1 = e >= T.applied1;
  const showUser2    = e >= T.send2;
  const showAi2      = e >= T.ai2;
  const showApplied2 = e >= T.applied2;
  const showThink1   = e >= T.think1 && e < T.ai1;
  const showThink2   = e >= T.think2 && e < T.ai2;

  // ── Activity log steps (mirrors real ThinkingIndicator) ──
  // Each step appears in sequence during the thinking phase, mimicking the
  // real product's tool-call timeline (analyze → read → edit → compile).
  type Step = { icon: React.ElementType; label: string; tone: "thinking" | "tool" | "done" };
  const buildSteps = (start: number, end: number): { steps: Step[]; elapsedSec: number } => {
    const dur = end - start;
    const t = Math.max(0, e - start);
    const stepDefs: Step[] = [
      { icon: Brain,    label: isJa ? "リクエストを分析中..."     : "Analyzing request...",   tone: "thinking" },
      { icon: BookOpen, label: isJa ? "文書を読み込み中"          : "Reading document",       tone: "tool" },
      { icon: Wrench,   label: isJa ? "文書を編集中"              : "Editing document",       tone: "tool" },
      { icon: Hammer,   label: isJa ? "コンパイルを検証中"        : "Compiling preview",      tone: "tool" },
    ];
    const per = dur / stepDefs.length;
    const visible = Math.min(stepDefs.length, Math.floor(t / per) + 1);
    return {
      steps: stepDefs.slice(0, visible).map((s, i) => ({
        ...s,
        tone: i < visible - 1 ? "done" : s.tone,
      })),
      elapsedSec: Math.floor(t / 1000),
    };
  };
  const think1Data = showThink1 ? buildSteps(T.think1, T.ai1) : null;
  const think2Data = showThink2 ? buildSteps(T.think2, T.ai2) : null;

  // Content: 7 blocks staggered over 3.5s
  const contentBlocks = e >= T.content1
    ? Math.min(7, Math.floor((e - T.content1) / 500) + 1)
    : 0;
  const showHarder = e >= T.content2;
  const harderFlash = e >= T.content2 && e < T.content2 + 600;

  // Fade in/out for loop
  const opacity = e >= T.fadeOut ? Math.max(0, 1 - (e - T.fadeOut) / 1800)
                : e < 600 ? e / 600 : 1;

  // Step label for progress bar
  const stepLabel =
    e < T.type1    ? (isJa ? "デモ開始..." : "Starting...") :
    e < T.send1    ? (isJa ? "ユーザーが入力中" : "User typing...") :
    e < T.ai1      ? (isJa ? "AIが分析中..." : "AI thinking...") :
    e < T.applied1 ? (isJa ? "紙面に反映中" : "Applying to page...") :
    e < T.type2    ? (isJa ? "問題が完成" : "Problems created") :
    e < T.send2    ? (isJa ? "追加指示を入力中" : "New instruction...") :
    e < T.ai2      ? (isJa ? "AIが更新中..." : "AI updating...") :
    e < T.fadeOut   ? (isJa ? "更新完了" : "Updated") :
    (isJa ? "もう一度再生..." : "Replaying...");

  // ── Activity log card (mirrors real ThinkingIndicator) ──
  // Lowercase render helper — not a component — so it doesn't retrigger mount
  // on every parent render (and avoids the static-components lint rule).
  const renderActivityLog = (data: { steps: { icon: React.ElementType; label: string; tone: "thinking" | "tool" | "done" }[]; elapsedSec: number }) => (
    <div className="flex gap-1.5 items-start">
      <div className="h-4 w-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-sm"
           style={{ background: "linear-gradient(135deg, #8b5cf6, #d946ef)" }}>
        <Sparkles className="h-2 w-2 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 mb-1">
          <span className="text-[8px] font-semibold uppercase tracking-wide text-foreground/55">EddivomAI</span>
          <span className="flex items-center gap-0.5 text-[8px] font-medium text-violet-500/80">
            <span className="w-1 h-1 rounded-full bg-violet-500 animate-pulse" />
            {isJa ? "考えています…" : "Thinking…"}
          </span>
          <span className="ml-auto text-[7.5px] text-muted-foreground/40 tabular-nums">{data.elapsedSec}s</span>
        </div>
        <div className="rounded-lg rounded-tl-sm border bg-white/90 dark:bg-black/30 px-2 py-1.5 space-y-1 shadow-sm"
             style={{ borderColor: "rgba(139,92,246,0.18)" }}>
          {data.steps.map((s, i) => {
            const Icon = s.icon;
            const isDone = s.tone === "done";
            const isThinking = s.tone === "thinking";
            return (
              <div key={i} className="flex items-center gap-1.5">
                <div className={`h-3 w-3 rounded flex items-center justify-center shrink-0 ${
                  isDone ? "bg-emerald-100/80 dark:bg-emerald-500/15"
                  : isThinking ? "bg-violet-100/70 dark:bg-violet-500/15"
                  : "bg-indigo-100/70 dark:bg-indigo-500/15"
                }`}>
                  <Icon className={`h-2 w-2 ${
                    isDone ? "text-emerald-500"
                    : isThinking ? "text-violet-400"
                    : "text-indigo-400 animate-pulse"
                  }`} />
                </div>
                <span className={`text-[8.5px] leading-tight ${
                  isDone ? "text-emerald-600/85 dark:text-emerald-400/75"
                  : isThinking ? "text-muted-foreground/55"
                  : "text-indigo-500/85 dark:text-indigo-400/75"
                }`}>{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ── Chat message bubble ──
  // Lowercase render helper (see renderActivityLog note).
  const renderBubble = ({ role, text, applied, show }: { role: string; text: string; applied?: boolean; show: boolean }) => (
    <div className={`flex transition-all duration-500 ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 h-0 overflow-hidden"} ${role === "user" ? "justify-end" : "justify-start"}`}>
      <div className={`rounded-xl px-2.5 py-1.5 max-w-[90%] ${role === "user" ? "rounded-tr-sm" : "rounded-tl-sm border shadow-sm"}`}
           style={role === "user" ? { background: "linear-gradient(135deg, #b45309, #d97706)" } : { background: "white", borderColor: "rgba(245,158,11,0.18)" }}>
        <p className={`text-[9px] leading-relaxed ${role === "user" ? "text-white/90" : "text-gray-600"}`}>{text}</p>
        {applied && (
          <span className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 font-medium mt-1 inline-block">
            {isJa ? "✓ 反映済み" : "✓ Applied"}
          </span>
        )}
      </div>
    </div>
  );

  // ── Animated worksheet content (left pane) ──
  const wsBlock = (idx: number, node: React.ReactNode) => (
    <div key={idx}
         className="transition-all duration-500"
         style={{ opacity: contentBlocks >= idx ? 1 : 0, transform: contentBlocks >= idx ? "translateY(0)" : "translateY(8px)" }}>
      {node}
    </div>
  );

  return (
    <div ref={containerRef} className="relative w-full max-w-4xl mx-auto" style={{ opacity }}>
      <div className="absolute -inset-4 bg-gradient-to-b from-violet-500/[0.05] to-fuchsia-500/[0.03] rounded-3xl blur-2xl pointer-events-none" />
      <div className="relative rounded-2xl border border-foreground/[0.08] bg-card/90 backdrop-blur-xl shadow-2xl shadow-foreground/[0.06] overflow-hidden">

        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-foreground/[0.06] bg-foreground/[0.02]">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
          </div>
          <div className="h-5 w-5 rounded-md bg-gradient-to-br from-violet-700 via-violet-500 to-fuchsia-500 flex items-center justify-center ml-2 shadow shadow-violet-500/30">
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none">
              <path d="M5 6h10M5 12h7M5 18h10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="18" cy="12" r="3" stroke="white" strokeWidth="2" fill="white" fillOpacity="0.3" />
            </svg>
          </div>
          <span className="text-[11px] text-muted-foreground/60 font-medium">Eddivom</span>
          <div className="w-px h-4 bg-border/30 mx-1" />
          <span className="hidden sm:block text-[10px] text-muted-foreground/35 px-2 py-0.5 border border-foreground/[0.05] rounded">
            {isJa ? "数学Ⅰ　確認テスト" : "Math I — Quiz"}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <span className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 font-bold border border-violet-500/15">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
              {isJa ? "デモ再生中" : "LIVE DEMO"}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/15">
              {isJa ? "PDF出力" : "Export PDF"}
            </span>
          </div>
        </div>

        {/* 2-pane + activity bar */}
        <div className="flex" style={{ minHeight: "340px" }}>

          {/* Left: animated worksheet */}
          <div className="flex-1 bg-gray-100/60 dark:bg-gray-950/40 flex justify-center items-start py-4 px-3 overflow-hidden">
            <div className="overflow-hidden rounded-md shadow-xl" style={{ width: "248px", height: "308px" }}>
              <div style={{ transform: "scale(0.645)", transformOrigin: "top left", width: "385px", pointerEvents: "none" }}>
                <div className={`bg-white rounded-lg shadow-2xl border border-gray-300/50 overflow-hidden select-none transition-all duration-500 ${harderFlash ? "ring-2 ring-amber-400/40" : ""}`} style={SERIF}>
                  {/* Title */}
                  {wsBlock(1, <>
                    <div className="px-6 pt-5 pb-3 border-b-2 border-gray-800">
                      <h1 className="text-[18px] font-bold text-center text-gray-900 tracking-widest">
                        {isJa ? "数学Ⅰ　確認テスト" : "Math I — Quiz"}
                      </h1>
                    </div>
                    <div className="px-6 pt-2 pb-1.5 flex items-center justify-between text-[10px] text-gray-600">
                      <span>{isJa ? "各10点・計50点" : "10 pts each · 50 pts total"}</span>
                      <span className="flex items-end gap-2">
                        {isJa ? "組" : "Class"}<span className="border-b border-gray-500 w-7 inline-block mb-0.5" />
                        {isJa ? "番" : "#"}<span className="border-b border-gray-500 w-7 inline-block mb-0.5" />
                        {isJa ? "名前" : "Name"}<span className="border-b border-gray-500 w-20 inline-block mb-0.5" />
                      </span>
                    </div>
                    <div className="mx-6 border-b border-gray-400 mb-3" />
                  </>)}

                  <div className="px-6 pb-4 space-y-4">
                    {/* Q1 header */}
                    {wsBlock(2,
                      <p className="text-[12px] font-bold text-gray-900 mb-1.5">
                        {isJa ? "第１問　計算問題" : "Q1 — Calculations"}
                      </p>
                    )}
                    {wsBlock(3,
                      <p className="text-[10px] text-gray-600 mb-2.5">{isJa ? "次の計算をせよ。" : "Solve each."}</p>
                    )}
                    {/* Q1 problems */}
                    {wsBlock(4,
                      <div className="space-y-3">
                        <div>
                          <p className="text-[11.5px] text-gray-800 leading-relaxed flex items-baseline gap-1">
                            <span className="text-gray-500 mr-1">(1)</span>
                            <M t={showHarder ? "5x^2 - 7x + 1 = 0" : "3x^2 + 5x - 2 = 0"} />{isJa ? "　を解け。" : ""}
                          </p>
                          <div className="ml-6 mt-1 h-10 border-b border-dashed border-gray-200" />
                        </div>
                        <div>
                          <p className="text-[11.5px] text-gray-800 leading-relaxed flex items-baseline gap-1">
                            <span className="text-gray-500 mr-1">(2)</span>
                            <M t={showHarder ? "\\log_3 27 \\cdot \\log_2 16" : "\\log_2 8 + \\log_2 4"} />{isJa ? "　の値を求めよ。" : " = ?"}
                          </p>
                          <div className="ml-6 mt-1 h-10 border-b border-dashed border-gray-200" />
                        </div>
                      </div>
                    )}
                    {/* Q2 header */}
                    {wsBlock(5,
                      <div className="mt-2">
                        <p className="text-[12px] font-bold text-gray-900 mb-1.5">
                          {isJa ? "第２問　関数" : "Q2 — Functions"}
                        </p>
                        <p className="text-[10px] text-gray-600 mb-2.5">
                          {isJa
                            ? <span>関数 <M t={showHarder ? "f(x) = 2x^2 - 8x + 5" : "f(x) = x^2 - 4x + 3"} /> について、次の問いに答えよ。</span>
                            : <span><M t={showHarder ? "f(x) = 2x^2 - 8x + 5" : "f(x) = x^2 - 4x + 3"} /> — answer the following.</span>}
                        </p>
                      </div>
                    )}
                    {/* Q2 problems */}
                    {wsBlock(6,
                      <div>
                        <p className="text-[11.5px] text-gray-800">
                          <span className="text-gray-500 mr-2">(1)</span>
                          {isJa ? "頂点の座標を求めよ。" : "Find the vertex."}
                        </p>
                        <div className="ml-6 mt-1 h-9 border-b border-dashed border-gray-200" />
                      </div>
                    )}
                    {wsBlock(7,
                      <div>
                        <p className="text-[11.5px] text-gray-800">
                          <span className="text-gray-500 mr-2">(2)</span>
                          {isJa ? "f(x) = 0 となる x の値を全て求めよ。" : "Solve f(x) = 0."}
                        </p>
                        <div className="ml-6 mt-1 h-8 border-b border-dashed border-gray-200" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: AI chat panel */}
          <div className="w-[196px] sm:w-[230px] border-l border-foreground/[0.06] flex flex-col dark:bg-[#100e03]"
               style={{ background: "rgba(255,253,245,0.98)" }}>
            {/* Header */}
            <div className="px-3 py-2 border-b flex items-center gap-2"
                 style={{ borderColor: "rgba(245,158,11,0.18)", background: "rgba(255,251,235,0.85)" }}>
              <div className="h-4 w-4 rounded bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-sm">
                <Sparkles className="h-2.5 w-2.5 text-white" />
              </div>
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 tracking-wide">EddivomAI</span>
              <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            {/* Messages */}
            <div className="flex-1 p-2.5 space-y-2 overflow-hidden">
              {renderBubble({ role: "user", text: p1, show: showUser1 })}
              {think1Data && renderActivityLog(think1Data)}
              {renderBubble({ role: "ai", text: a1, applied: showApplied1, show: showAi1 })}
              {renderBubble({ role: "user", text: p2, show: showUser2 })}
              {think2Data && renderActivityLog(think2Data)}
              {renderBubble({ role: "ai", text: a2, applied: showApplied2, show: showAi2 })}
            </div>
            {/* Input */}
            <div className="p-2 border-t" style={{ borderColor: "rgba(245,158,11,0.15)" }}>
              <div className="flex items-center gap-1.5 bg-white dark:bg-black/20 rounded-lg px-2.5 py-1.5 border shadow-sm"
                   style={{ borderColor: inputText ? "rgba(245,158,11,0.5)" : "rgba(245,158,11,0.28)" }}>
                <span className="text-[9px] flex-1 truncate min-w-0">
                  {inputText ? (
                    <span className="text-gray-700">
                      {inputText}
                      {showInputCursor && <span className="inline-block w-px h-3 bg-amber-500 ml-px align-middle" style={{ animation: "stream-cursor 0.9s step-end infinite" }} />}
                    </span>
                  ) : (
                    <span className="text-gray-400">{isJa ? "指示を入力…" : "Type a prompt…"}</span>
                  )}
                </span>
                <div className={`h-4 w-4 rounded-full flex items-center justify-center shrink-0 transition-transform duration-200 ${inputText ? "scale-110" : ""}`}
                     style={{ background: "linear-gradient(135deg, #d97706, #f59e0b)" }}>
                  <ArrowRight className="h-2.5 w-2.5 text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Activity Bar — 実エディタと同じ 2 項目 (AI / 採点) */}
          <div className="w-8 border-l border-foreground/[0.06] bg-foreground/[0.02] flex flex-col items-center py-2 gap-2">
            <div className="w-5 h-5 rounded flex items-center justify-center border-l-2 border-amber-500"
                 style={{ background: "rgba(245,158,11,0.10)" }}>
              <Sparkles className="h-3 w-3 text-amber-500" />
            </div>
            <div className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/25">
              <CheckSquare className="h-3 w-3" />
            </div>
          </div>
        </div>

        {/* Demo progress bar */}
        <div className="border-t border-foreground/[0.06] bg-foreground/[0.015] px-4 py-1.5 flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[10px] text-violet-500/60 shrink-0">
            <Play className="h-2.5 w-2.5 fill-current" />
            <span className="font-medium">{stepLabel}</span>
          </div>
          <div className="flex-1 h-[3px] bg-foreground/[0.04] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500/70 to-fuchsia-500/70 rounded-full"
              style={{ width: `${(e / CYCLE) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Figure Draw Mockup ──
 * 実機の図エディタ (frontend/components/figure-editor) のスクリーンショットを
 * そのまま再現した 14 秒ループ。2 フェーズ:
 *   (A) 矩形を描画中 — Rect ツール active、破線プレビュー、緑の「対角の点をクリック」
 *       ヒント、座標コールアウト、下中央に「領域描画モード」の青ピル
 *   (B) 矩形が選択された — 実線の矩形 + 8 個の青ハンドル + バブルツールバー、上部に
 *       キャプションバー、右側にプロパティパネル (rect / RECT)、下中央に青い「1 個選択中」
 *       ピル + キーボードショートカットのヒントバー、挿入プレビューボタンに ring 強調
 *
 * 実機チラ見えの細部:
 *  - 上端の rainbow accent strip (blue → violet → pink → amber → emerald)
 *  - Header: ImagePlus teal→cyan ロゴ + 図形数 pill / 中央: 挿入サイズ 小/中/原寸/大/全幅 (原寸 active) /
 *    右: JA · ⌘K · Layers · Keyboard · TikZ · コピー · PDF · 末尾 · 挿入プレビュー · ×
 *  - Left toolbar (244px): 検索 → 主要ツール 1 行 + フリーハンド → アクションバー →
 *    2×4 カテゴリ (基本図形/電気回路/力学/物理 / 数学/情報/化学/生物) → 3×3 パレット
 *  - Canvas: 白 + 細グリッド + cm ruler + 青 x-axis + 右下に縦並びズームパネル +
 *    左下に「x ? y ? cm」の座標チップ + 右下の「自由角度 / スナップ / グリッド」ピル
 */
function FigureDrawMockup({ isJa }: { isJa: boolean }) {
  const CYCLE = 22000; // 22 s — 物理の力学図を組み立てる長めのループ
  // 可視時のみ tick を回す。off-screen / 非表示タブでは setInterval を完全停止 → TBT 抑制
  const containerRef = useRef<HTMLDivElement>(null);
  const [tick] = useVisibleInterval(containerRef, 80);
  const e = (tick * 80) % CYCLE;

  // ── Phase timeline (ms) ──
  //  A) 0 - 4000   : Rect ツールで質量ブロックを描画
  //  B) 4000 - 8500 : Arrow ツールで力ベクトルを描画
  //  C) 8500 - 12500 : Select に切替 → 矢印を選択し、右の Properties パネルで
  //                   ラベル "F" を入力 (実機: ラベル入力は右サイドバーで行う)
  //  D) 12500 - 20000 : 完成した図の showcase (質量が選択された状態)
  //  E) 20000 - 22000 : フェードアウト → ループ
  const T = {
    rectDrawStart:   500,    rectDrawEnd:    4000,
    arrowToolStart: 4400,    arrowDrawStart: 5000,  arrowDrawEnd:  8500,
    selectArrowAt:  8900,    labelTypeStart: 9500,  labelTypeEnd: 12500,
    showcaseStart:  12500,
    fadeOut:        20000,
  };

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const progress = (start: number, end: number) => clamp((e - start) / (end - start), 0, 1);

  const rectP   = progress(T.rectDrawStart,  T.rectDrawEnd);
  const arrowP  = progress(T.arrowDrawStart, T.arrowDrawEnd);
  const labelP  = progress(T.labelTypeStart, T.labelTypeEnd);

  const isDrawingRect   = e >= T.rectDrawStart  && e < T.rectDrawEnd;
  const isDrawingArrow  = e >= T.arrowDrawStart && e < T.arrowDrawEnd;
  // 矢印を選択中 → Properties パネルが矢印の編集 UI を出す
  const isArrowSelected = e >= T.selectArrowAt && e < T.showcaseStart;
  // Properties パネルのラベル入力欄に "F" がタイプされていく期間
  const isTypingLabel   = e >= T.labelTypeStart && e < T.labelTypeEnd;
  const isShowcase      = e >= T.showcaseStart  && e < T.fadeOut;
  // showcase 中は質量 (rect) が選択された状態に切り替わる
  const isRectSelected  = isShowcase;

  // 完成済みの図形はサイクルの後段ではすべて表示を維持
  const rectDone   = e >= T.rectDrawEnd;
  const arrowDone  = e >= T.arrowDrawEnd;
  const labelDone  = e >= T.labelTypeEnd;

  // 現在 active なツール (toolbar ハイライト + cursor 位置誘導用)
  // 実機にない Text ツールフローは廃止 — Arrow 後は Select に直接戻る。
  const activeTool: "select" | "rect" | "arrow" =
      e < T.arrowToolStart ? "rect"
    : e < T.arrowDrawEnd   ? "arrow"
    : "select";

  // ラベル: 右サイドバーで "F" を 1 文字ずつタイピング
  const labelFull = "F";
  const labelTypedLen = isTypingLabel
    ? Math.min(labelFull.length, Math.floor(labelP * (labelFull.length + 0.5)))
    : (labelDone ? labelFull.length : 0);

  const opacity =
    e >= T.fadeOut ? Math.max(0, 1 - (e - T.fadeOut) / 1800)
    : e < 400      ? e / 400
    : 1;

  // ── Primary tools (実機と同じ並び、ラベル・ショートカット含む) ──
  const tools = [
    { id: "select",  Icon: MousePointer2, label: isJa ? "選択"       : "Select",   kbd: "V" },
    { id: "rect",    Icon: Square,        label: isJa ? "四角形"     : "Rectangle", kbd: "R" },
    { id: "circle",  Icon: CircleIcon,    label: isJa ? "円"         : "Circle",   kbd: "C" },
    { id: "line",    Icon: MinusIcon,     label: isJa ? "直線"       : "Line",     kbd: "L" },
    { id: "arrow",   Icon: ArrowRight,    label: isJa ? "矢印"       : "Arrow",    kbd: "A" },
    { id: "text",    Icon: TypeIcon,      label: isJa ? "テキスト"   : "Text",     kbd: "T" },
  ] as const;

  // 2 行 4 列カテゴリ (実機 domain-palettes.ts と同じ)
  const categories = [
    { id: "basic",     ja: "基本図形", en: "Basic",     icon: "⬜" },
    { id: "circuit",   ja: "電気回路", en: "Circuit",   icon: "⚡" },
    { id: "mechanics", ja: "力学",     en: "Mechanics", icon: "⚙️" },
    { id: "physics",   ja: "物理",     en: "Physics",   icon: "🔬" },
    { id: "math",      ja: "数学",     en: "Math",      icon: "📐" },
    { id: "cs",        ja: "情報",     en: "CS",        icon: "💻" },
    { id: "chemistry", ja: "化学",     en: "Chemistry", icon: "🧪" },
    { id: "biology",   ja: "生物",     en: "Biology",   icon: "🧬" },
  ] as const;

  // 挿入サイズ preset (実機と同じ)
  const sizes: Array<{ ja: string; en: string }> = [
    { ja: "小", en: "S" },
    { ja: "中", en: "M" },
    { ja: "原寸", en: "1×" },
    { ja: "大", en: "L" },
    { ja: "全幅", en: "Full" },
  ];
  const activeSizeIdx = 2; // 原寸 active

  // 3 列パレット (基本図形のアイテム 9 つ)
  const paletteItems = [
    { ja: "四角形",   en: "Rect",   Ic: () => <Square size={12} /> },
    { ja: "円",       en: "Circle", Ic: () => <CircleIcon size={12} /> },
    { ja: "楕円",     en: "Ellipse",Ic: () => <span className="text-[11px] leading-none">⬭</span> },
    { ja: "直線",     en: "Line",   Ic: () => <MinusIcon size={12} /> },
    { ja: "矢印",     en: "Arrow",  Ic: () => <ArrowRight size={12} /> },
    { ja: "テキスト", en: "Text",   Ic: () => <TypeIcon size={12} /> },
    { ja: "三角形",   en: "Tri",    Ic: () => <span className="text-[11px] leading-none">△</span> },
    { ja: "弧",       en: "Arc",    Ic: () => <span className="text-[11px] leading-none">⌒</span> },
    { ja: "フリーハンド", en: "Free", Ic: () => <PenIcon size={12} /> },
  ] as const;

  // 図形数: 質量(rect) + 力ベクトル(arrow) の 2 つだけ。ラベルは矢印の付属プロパティ。
  const shapeCount =
      (rectP > 0  ? 1 : 0)
    + (arrowDone || isDrawingArrow ? 1 : 0);

  // ── Canvas 座標系 (viewBox 480 x 300) ──
  // 質量ブロック: X=4→7cm, Y=4→5cm
  const RECT = { x: 140, y: 130, w: 110, h: 50 };
  // 力の矢印: 質量の右辺中央から右斜め上に伸びる F ベクトル
  const ARROW = {
    x1: RECT.x + RECT.w,      y1: RECT.y + RECT.h / 2,
    x2: RECT.x + RECT.w + 110, y2: RECT.y + RECT.h / 2 - 36,
  };
  // テキスト "F" の配置位置 (矢印の中ほど上)
  const TEXT = { x: ARROW.x1 + (ARROW.x2 - ARROW.x1) * 0.55, y: ARROW.y1 + (ARROW.y2 - ARROW.y1) * 0.55 - 6 };

  // 描画中の破線矩形は rectP に比例して伸びる
  const drawW = RECT.w * rectP;
  const drawH = RECT.h * rectP;
  // 矢印の進捗描画 — 始点から end までを arrowP で伸ばす
  const arrowEndX = ARROW.x1 + (ARROW.x2 - ARROW.x1) * arrowP;
  const arrowEndY = ARROW.y1 + (ARROW.y2 - ARROW.y1) * arrowP;

  // 8 個の選択ハンドル位置 (矩形の四隅 + 辺中点)
  const handles = [
    [RECT.x,           RECT.y],
    [RECT.x + RECT.w/2, RECT.y],
    [RECT.x + RECT.w,  RECT.y],
    [RECT.x,           RECT.y + RECT.h/2],
    [RECT.x + RECT.w,  RECT.y + RECT.h/2],
    [RECT.x,           RECT.y + RECT.h],
    [RECT.x + RECT.w/2, RECT.y + RECT.h],
    [RECT.x + RECT.w,  RECT.y + RECT.h],
  ] as const;

  return (
    <div ref={containerRef} className="relative w-full max-w-4xl mx-auto" style={{ opacity }}>
      <div className="absolute -inset-4 bg-gradient-to-b from-teal-500/[0.06] to-cyan-500/[0.04] rounded-3xl blur-2xl pointer-events-none" />

      {/* 実機 workspace 背景: 薄グレー + 青/ピンク radial */}
      <div
        className="relative rounded-2xl border border-foreground/[0.08] shadow-2xl shadow-foreground/[0.08] overflow-hidden"
        style={{
          background:
            "radial-gradient(circle at 30% 20%, rgba(99,102,241,0.05), transparent 40%), " +
            "radial-gradient(circle at 80% 90%, rgba(236,72,153,0.04), transparent 50%), " +
            "linear-gradient(180deg, #e5e7ec 0%, #dfe0e6 100%)",
        }}
      >
        {/* 上端 rainbow accent */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-violet-500 via-pink-500 via-amber-500 to-emerald-500 opacity-70 z-20" />

        {/* ══════ HEADER ══════ */}
        <div
          className="flex items-center gap-2 px-3 h-11 border-b border-black/[0.06] relative z-10"
          style={{
            background:
              "linear-gradient(90deg, rgba(59,130,246,0.06) 0%, rgba(255,255,255,0.95) 30%, rgba(255,255,255,0.95) 70%, rgba(245,158,11,0.06) 100%)",
          }}
        >
          {/* ロゴ + "図エディタ" + 図形数 pill */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="h-6 w-6 rounded-md bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-sm">
              <ImagePlus className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-[12px] font-bold text-foreground/80">
              {isJa ? "図エディタ" : "Figure Editor"}
            </span>
            <span className="hidden sm:inline-block px-1.5 py-0.5 rounded-full bg-foreground/[0.05] text-[9.5px] font-semibold text-foreground/45 tabular-nums">
              {shapeCount} {isJa ? "個" : shapeCount === 1 ? "object" : "objects"}
            </span>
          </div>

          {/* 中央: 挿入サイズ 小/中/原寸/大/全幅 (原寸 active) */}
          <div className="flex-1 hidden md:flex items-center justify-center gap-0.5">
            <span className="text-[9.5px] text-foreground/35 mr-1.5 font-medium">
              {isJa ? "挿入サイズ" : "Insert size"}:
            </span>
            {sizes.map((s, i) => (
              <span
                key={i}
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                  i === activeSizeIdx
                    ? "bg-teal-500/15 text-teal-700 dark:text-teal-400 ring-1 ring-teal-500/30"
                    : "text-foreground/35"
                }`}
              >
                {isJa ? s.ja : s.en}
              </span>
            ))}
          </div>

          {/* 右: JA / ⌘K / TikZ / コピー / PDF / 末尾 dropdown / 挿入プレビュー / × */}
          <div className="ml-auto flex items-center gap-1 shrink-0">
            <span className="hidden xl:inline-flex items-center gap-1 h-6 px-2 rounded-lg border border-foreground/[0.08] text-[9.5px] font-bold text-foreground/50">
              <span>🌐</span> JA
            </span>
            <span className="hidden xl:inline-flex items-center gap-1 h-6 px-1.5 rounded-lg text-foreground/40">
              <span className="text-[9px]">⌘</span>
              <kbd className="text-[8.5px] font-mono bg-foreground/[0.06] px-1 py-px rounded">⌘K</kbd>
            </span>
            <span className="hidden lg:inline-flex items-center gap-1 h-6 px-2 rounded-lg text-[9.5px] font-semibold text-foreground/45">
              <Code2 className="h-3 w-3" /> TikZ
            </span>
            <span className="hidden lg:inline-flex items-center gap-1 h-6 px-2 rounded-lg text-[9.5px] font-semibold text-foreground/45">
              <Copy className="h-3 w-3" /> {isJa ? "コピー" : "Copy"}
            </span>
            <span className="hidden lg:inline-flex items-center gap-1 h-6 px-2 rounded-lg text-[9.5px] font-semibold text-foreground/45">
              <FileDown className="h-3 w-3" /> PDF
            </span>
            <div className="hidden lg:block w-px h-4 bg-foreground/10 mx-0.5" />
            {/* 挿入位置 dropdown */}
            <span className="hidden md:inline-flex items-center gap-1 h-6 px-2 rounded-lg border border-foreground/[0.08] bg-white/70 text-[9.5px] font-semibold text-foreground/60">
              {isJa ? "末尾" : "End"} <ChevronDown className="h-2.5 w-2.5" />
            </span>
            {/* 挿入プレビュー ボタン (teal→cyan) — 選択状態で ring 強調 */}
            <span
              className={`inline-flex items-center gap-1 h-7 px-3 rounded-full text-[10px] font-bold bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-md shadow-teal-500/30 transition-all ${
                isShowcase ? "ring-2 ring-teal-300/70 scale-[1.03]" : ""
              }`}
            >
              <Eye className="h-3 w-3" />
              {isJa ? "挿入プレビュー" : "Preview insert"}
            </span>
            <span className="ml-0.5 hidden sm:inline-flex h-6 w-6 items-center justify-center rounded-md text-foreground/35">
              <X className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>

        {/* ══════ CAPTION BAR (図形が 1 個以上あれば表示・実機どおり) ══════ */}
        {(isArrowSelected || isRectSelected) && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 border-b border-black/[0.05] bg-gradient-to-r from-teal-50/60 to-cyan-50/30">
            <span className="text-[9px] font-bold uppercase tracking-wider text-teal-700 shrink-0">
              {isJa ? "キャプション" : "Caption"}
            </span>
            <div className="flex-1 h-5 rounded border border-teal-500/20 bg-white/80 flex items-center px-2 text-[10px] text-foreground/35 italic truncate">
              {isJa ? "図の下に表示されます (空欄なら図のみ)" : "Shown below the figure (leave empty for no caption)"}
            </div>
          </div>
        )}

        {/* ══════ MAIN: toolbar + canvas + properties ══════ */}
        <div className="flex gap-2 p-2 relative" style={{ minHeight: "340px" }}>

          {/* ───── LEFT TOOLBAR ───── */}
          <div
            className="hidden sm:flex w-[188px] lg:w-[220px] shrink-0 flex-col rounded-xl overflow-hidden"
            style={{
              background:
                "linear-gradient(180deg, rgba(59,130,246,0.06) 0%, rgba(255,255,255,0.98) 14%, rgba(255,255,255,1) 100%)",
              border: "1px solid rgba(59, 130, 246, 0.18)",
            }}
          >
            {/* Search */}
            <div className="px-2 pt-2 pb-1.5">
              <div className="relative h-6 rounded-md border border-foreground/[0.08] bg-white/70 flex items-center px-2 gap-1.5">
                <span className="text-foreground/40 text-[11px]">⌕</span>
                <span className="text-[10px] text-foreground/30">
                  {isJa ? "図形を検索..." : "Search shapes..."}
                </span>
              </div>
            </div>

            {/* Primary tools: Select | Rect Circle Line Arrow Text */}
            <div className="px-2 pb-1 flex items-center gap-0.5">
              {tools.map(({ id, Icon, label, kbd }, i) => {
                const isActive = id === activeTool;
                return (
                  <React.Fragment key={id}>
                    {i === 1 && <div className="w-px h-4 bg-foreground/[0.08] mx-0.5" />}
                    <div
                      title={label}
                      className={`relative flex flex-col items-center gap-0 h-9 w-[26px] rounded-md justify-center ${
                        isActive
                          ? "bg-blue-500/15 text-blue-700 ring-1 ring-blue-500/40"
                          : "text-foreground/55"
                      }`}
                    >
                      <Icon size={12} />
                      <span className="text-[7px] font-mono text-foreground/30 mt-px leading-none">{kbd}</span>
                      {isActive && (
                        <span className="absolute inset-0 rounded-md ring-1 ring-blue-500/30 animate-ping pointer-events-none" />
                      )}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>

            {/* 2 段目: freehand */}
            <div className="px-2 pb-1.5">
              <div className="h-7 w-7 rounded-md flex items-center justify-center text-foreground/55">
                <PenIcon size={12} />
              </div>
            </div>

            {/* Action bar */}
            <div className="mx-2 mb-1.5 h-7 flex items-center gap-0.5 px-1 rounded-md bg-foreground/[0.03] border border-foreground/[0.05]">
              <span className="text-foreground/35 text-[11px] px-1">↶</span>
              <span className="text-foreground/35 text-[11px] px-1">↷</span>
              <span className="text-foreground/35 text-[11px] px-1">⧉</span>
              <span className="text-foreground/35 text-[11px] px-1">🗑</span>
              <div className="flex-1" />
              <span className="text-foreground/35 text-[11px] px-1">↕</span>
              <span className="text-foreground/35 text-[11px] px-1">↓</span>
              <span className="text-foreground/55 text-[11px] px-1 bg-blue-500/10 rounded">▦</span>
              <span className="text-foreground/35 text-[11px] px-1">🧲</span>
            </div>

            {/* 2 段 4 列 カテゴリ */}
            <div className="px-1.5 py-1.5 border-t border-foreground/[0.06]">
              <div className="grid grid-cols-4 gap-0.5">
                {categories.map((c, i) => {
                  const catActive = i === 0;
                  return (
                    <span
                      key={c.id}
                      className={`flex flex-col items-center py-1 rounded-md text-[8.5px] font-semibold ${
                        catActive
                          ? "bg-blue-500/10 text-blue-700 ring-1 ring-blue-500/30"
                          : "text-foreground/50"
                      }`}
                    >
                      <span className="text-[12px] leading-none mb-0.5">{c.icon}</span>
                      <span className="truncate max-w-full px-0.5 leading-tight">
                        {isJa ? c.ja : c.en}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>

            {/* 3 列 パレット (画像に合わせて 9 アイテム) — 現在ツールに応じて active を切替 */}
            <div className="flex-1 px-1.5 py-1.5 border-t border-black/[0.04]">
              <div className="grid grid-cols-3 gap-1">
                {paletteItems.map((item, i) => {
                  const itemId =
                      i === 0 ? "rect"
                    : i === 4 ? "arrow"
                    : null;
                  const itemActive = itemId !== null && itemId === activeTool;
                  return (
                    <span
                      key={i}
                      className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded ${
                        itemActive
                          ? "bg-blue-500/10 ring-1 ring-blue-500/30 text-blue-700"
                          : "text-foreground/55 border border-transparent"
                      }`}
                    >
                      <item.Ic />
                      <span className="text-[8px] leading-none truncate max-w-full">
                        {isJa ? item.ja : item.en}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ───── CENTER: CANVAS ───── */}
          <div className="flex-1 relative bg-white rounded-xl overflow-hidden border border-black/[0.06]">
            {/* 細グリッド */}
            <div
              className="absolute inset-0 opacity-60"
              style={{
                backgroundImage:
                  "linear-gradient(to right, rgba(0,0,0,0.055) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.055) 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
            />
            {/* 太グリッド */}
            <div
              className="absolute inset-0 opacity-50 pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(to right, rgba(0,0,0,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.10) 1px, transparent 1px)",
                backgroundSize: "100px 100px",
              }}
            />

            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 480 300"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* cm ruler (上端に数字) */}
              {["cm", "2", "4", "6", "8", "10", "12", "14"].map((label, i) => (
                <text key={i}
                  x={20 + i * 60} y={18}
                  textAnchor="middle" fontSize="9"
                  fill={label === "cm" ? "#9ca3af" : "#6b7280"}
                  fontFamily="system-ui">{label}</text>
              ))}
              {/* 「5cm」と「10cm」は強調 */}
              <text x={170} y={36} textAnchor="middle" fontSize="9" fill="#374151" fontWeight="600">5cm</text>
              <text x={290} y={36} textAnchor="middle" fontSize="9" fill="#374151" fontWeight="600">10cm</text>
              <text x={410} y={36} textAnchor="middle" fontSize="9" fill="#374151" fontWeight="600">15cm</text>

              {/* 左側 Y ruler ラベル */}
              <text x={12} y={95}  textAnchor="middle" fontSize="9" fill="#374151" fontWeight="600">5cm</text>
              <text x={12} y={215} textAnchor="middle" fontSize="9" fill="#6b7280">0</text>

              {/* x-axis baseline (青) */}
              <line x1="0" y1={215} x2="480" y2={215} stroke="#3b82f6" strokeWidth="1" opacity="0.8" />

              <defs>
                {/* 矢印の頭 — 描画中 (teal dashed preview) と確定後 (黒) で 2 種類 */}
                <marker id="fdmHeadDraft" viewBox="0 0 10 10" refX="9" refY="5"
                  markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill="#14b8a6" />
                </marker>
                <marker id="fdmHeadFinal" viewBox="0 0 10 10" refX="9" refY="5"
                  markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill="#0f172a" />
                </marker>
              </defs>

              {/* ── Rect (描画中: 破線、完成後: 実線) ── */}
              {rectP > 0 && !rectDone && (
                <>
                  <rect
                    x={RECT.x} y={RECT.y}
                    width={drawW} height={drawH}
                    fill="rgba(20,184,166,0.08)"
                    stroke="#14b8a6"
                    strokeWidth={1.8}
                    strokeDasharray="5 3"
                  />
                  <circle cx={RECT.x + drawW} cy={RECT.y + drawH} r="4"
                    fill="white" stroke="#14b8a6" strokeWidth="1.5" />
                  {/* 描画中の座標コールアウト */}
                  <text
                    x={RECT.x + drawW / 2} y={RECT.y - 6}
                    textAnchor="middle" fontSize="10" fontFamily="ui-monospace, monospace"
                    fill="#0f766e">
                    ({(4 + 3 * rectP).toFixed(2)}, {(5 - rectP).toFixed(2)}) {(rectP * 1.0).toFixed(2)} cm
                  </text>
                </>
              )}
              {rectDone && (
                <rect
                  x={RECT.x} y={RECT.y}
                  width={RECT.w} height={RECT.h}
                  fill="white" stroke="#0f172a" strokeWidth="1.6"
                />
              )}
              {/* 質量ラベル "m" は完成した矩形の中央に */}
              {rectDone && (
                <text x={RECT.x + RECT.w / 2} y={RECT.y + RECT.h / 2 + 5}
                  textAnchor="middle" fontSize="15" fontStyle="italic"
                  fontWeight="600" fill="#0f172a" fontFamily="serif">m</text>
              )}

              {/* ── 床のハッチング (質量が完成後に表示) ── */}
              {rectDone && (
                <g opacity="0.85">
                  <line x1={RECT.x - 24} y1={RECT.y + RECT.h}
                    x2={RECT.x + RECT.w + 24} y2={RECT.y + RECT.h}
                    stroke="#0f172a" strokeWidth="1.4" />
                  {Array.from({ length: 10 }).map((_, i) => (
                    <line key={i}
                      x1={RECT.x - 18 + i * 16} y1={RECT.y + RECT.h}
                      x2={RECT.x - 24 + i * 16} y2={RECT.y + RECT.h + 8}
                      stroke="#0f172a" strokeWidth="1" />
                  ))}
                </g>
              )}

              {/* ── Arrow (力ベクトル) ── */}
              {arrowP > 0 && !arrowDone && (
                <line
                  x1={ARROW.x1} y1={ARROW.y1}
                  x2={arrowEndX} y2={arrowEndY}
                  stroke="#14b8a6" strokeWidth="2.4"
                  strokeDasharray="5 3"
                  markerEnd={arrowP > 0.85 ? "url(#fdmHeadDraft)" : undefined}
                />
              )}
              {arrowDone && (
                <line
                  x1={ARROW.x1} y1={ARROW.y1}
                  x2={ARROW.x2} y2={ARROW.y2}
                  stroke="#0f172a" strokeWidth="2.4"
                  markerEnd="url(#fdmHeadFinal)"
                />
              )}
              {/* 矢印の始点ドット (アンカー) */}
              {(arrowP > 0 || arrowDone) && (
                <circle cx={ARROW.x1} cy={ARROW.y1} r="3"
                  fill="white" stroke={arrowDone ? "#0f172a" : "#14b8a6"} strokeWidth="1.4" />
              )}

              {/* ── 矢印のラベル "F" (右パネルで入力された値が反映される) ── */}
              {labelTypedLen > 0 && (
                <text
                  x={TEXT.x} y={TEXT.y}
                  textAnchor="middle" fontSize="16"
                  fontStyle="italic" fontWeight="700"
                  fill="#0f172a" fontFamily="serif"
                  opacity={isTypingLabel ? Math.max(0.6, labelP) : 1}
                >
                  {labelFull.slice(0, labelTypedLen)}
                </text>
              )}

              {/* ── Arrow 選択時の selection outline (矢印を囲む細い破線) ── */}
              {isArrowSelected && arrowDone && (
                <>
                  {(() => {
                    const minX = Math.min(ARROW.x1, ARROW.x2) - 6;
                    const minY = Math.min(ARROW.y1, ARROW.y2) - 6;
                    const w = Math.abs(ARROW.x2 - ARROW.x1) + 12;
                    const h = Math.abs(ARROW.y2 - ARROW.y1) + 12;
                    return (
                      <rect x={minX} y={minY} width={w} height={h}
                        fill="none" stroke="#3b82f6" strokeWidth="1"
                        strokeDasharray="4 2" opacity="0.7" />
                    );
                  })()}
                  {/* Arrow の両端ハンドル */}
                  {[[ARROW.x1, ARROW.y1], [ARROW.x2, ARROW.y2]].map(([hx, hy], i) => (
                    <rect key={i}
                      x={hx - 3.5} y={hy - 3.5} width="7" height="7"
                      fill="#3b82f6" stroke="white" strokeWidth="1.2" rx="0.5" />
                  ))}
                </>
              )}

              {/* ── showcase 中: 質量 (rect) が選択された状態 ── */}
              {isRectSelected && (
                <rect
                  x={RECT.x - 3} y={RECT.y - 3}
                  width={RECT.w + 6} height={RECT.h + 6}
                  fill="none" stroke="#3b82f6" strokeWidth="1"
                  strokeDasharray="4 2" opacity="0.7"
                />
              )}
              {isRectSelected && handles.map(([hx, hy], i) => (
                <rect key={i}
                  x={hx - 3.5} y={hy - 3.5} width="7" height="7"
                  fill="#3b82f6" stroke="white" strokeWidth="1.2" rx="0.5" />
              ))}
            </svg>

            {/* 描画中ヒントピル (上中央) — Rect / Arrow 描画中にだけ出す */}
            {(isDrawingRect || isDrawingArrow) && (
              <div className="absolute left-1/2 -translate-x-1/2 top-2 px-2.5 py-1 rounded-full bg-teal-600/95 text-white text-[10px] font-semibold shadow-md shadow-teal-600/30 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                {isDrawingRect && (isJa ? "対角の点をクリック" : "Click the opposite corner")}
                {isDrawingArrow && (isJa ? "終点をクリック" : "Click the arrow end")}
                <kbd className="ml-1 text-[8.5px] font-mono bg-white/20 px-1 py-px rounded">Esc</kbd>
              </div>
            )}

            {/* 選択時: バブルツールバー (選択中の図形の上に表示) */}
            {(isArrowSelected || isRectSelected) && (() => {
              const cx = isArrowSelected
                ? (ARROW.x1 + ARROW.x2) / 2
                : (RECT.x + RECT.w / 2);
              const ty = isArrowSelected
                ? Math.min(ARROW.y1, ARROW.y2) - 30
                : RECT.y - 30;
              return (
                <div
                  className="absolute flex items-center gap-0 rounded-md bg-white shadow-lg border border-black/10 overflow-hidden"
                  style={{
                    left: `${(cx / 480) * 100}%`,
                    top:  `${(ty / 300) * 100}%`,
                    transform: "translateX(-50%)",
                  }}
                >
                  {["🎨", "⧉", "↻", "🔓", "🗑"].map((g, i) => (
                    <span key={i} className="h-6 w-6 flex items-center justify-center text-[11px] text-foreground/60">
                      {g}
                    </span>
                  ))}
                </div>
              );
            })()}

            {/* アニメーション cursor — フェーズに応じて適切な位置に。
                ラベル入力中は cursor は canvas 外 (右の Properties パネルへ) なので非表示。 */}
            {!isTypingLabel && (
              <div
                className="absolute pointer-events-none transition-all duration-500 ease-out"
                style={{
                  left: `${(
                    isDrawingRect    ? (RECT.x + drawW) / 480 :
                    isDrawingArrow   ? arrowEndX / 480 :
                    isArrowSelected  ? (ARROW.x1 + ARROW.x2) / 2 / 480 :
                    isRectSelected   ? (RECT.x + RECT.w - 10) / 480 :
                    /* idle */         0.22
                  ) * 100}%`,
                  top: `${(
                    isDrawingRect    ? (RECT.y + drawH) / 300 :
                    isDrawingArrow   ? arrowEndY / 300 :
                    isArrowSelected  ? (ARROW.y1 + ARROW.y2) / 2 / 300 :
                    isRectSelected   ? (RECT.y + RECT.h / 2) / 300 :
                    /* idle */         0.40
                  ) * 100}%`,
                }}
              >
                <svg width="18" height="20" viewBox="0 0 20 22">
                  <path d="M2,2 L2,16 L6,12 L9,18 L11,17 L8,11 L14,11 z"
                    fill="white" stroke="#0f172a" strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
              </div>
            )}

            {/* 右下 zoom パネル (縦並び) */}
            <div className="absolute right-2 bottom-20 flex flex-col gap-0.5 items-center px-1 py-1 rounded-md bg-white/85 border border-black/[0.06] shadow-sm">
              <span className="text-[9px] text-foreground/55">🔍+</span>
              <span className="text-[8.5px] font-mono text-foreground/70">100%</span>
              <span className="text-[9px] text-foreground/55">🔍−</span>
              <span className="text-[9px] text-foreground/55">⤢</span>
            </div>

            {/* 左下 座標チップ — マウス位置に同期 */}
            <div className="absolute left-2 bottom-2 px-2 py-0.5 rounded-md bg-foreground/[0.75] text-white text-[9.5px] font-mono">
              x {(
                  isDrawingRect    ? 4 + 3 * rectP
                : isDrawingArrow   ? 7 + 3 * arrowP
                : isArrowSelected  ? 8.6
                : 7.7
              ).toFixed(1)}{" "}
              y {(
                  isDrawingRect    ? 5 - rectP
                : isDrawingArrow   ? 4 + 1.2 * arrowP
                : isArrowSelected  ? 4.4
                : 5.3
              ).toFixed(1)} cm
            </div>

            {/* 右下 自由角度 / スナップ / グリッド */}
            <div className="absolute right-2 bottom-2 hidden md:flex items-center gap-1">
              <span className="px-1.5 py-0.5 rounded bg-white/85 border border-black/[0.06] text-[9px] text-foreground/60">
                ∡ {isJa ? "自由角度" : "Free angle"}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[9px] text-emerald-700 font-semibold">
                ◈ {isJa ? "スナップ" : "Snap"}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[9px] text-emerald-700 font-semibold">
                ▦ {isJa ? "グリッド" : "Grid"}
              </span>
            </div>

            {/* 下中央: モード/選択状態のピル */}
            {isDrawingRect && (
              <div className="absolute left-1/2 -translate-x-1/2 bottom-9 px-2.5 py-1 rounded-full bg-blue-500/95 text-white text-[9.5px] font-semibold shadow-md flex items-center gap-1.5">
                ▦ {isJa ? "領域描画モード" : "Drag-draw mode"}
                <span className="w-px h-3 bg-white/40" />
                <span className="font-normal opacity-90">
                  {isJa ? "対角の 2 点をクリックで矩形の大きさを指定" : "Click two opposite corners"}
                </span>
              </div>
            )}
            {isDrawingArrow && (
              <div className="absolute left-1/2 -translate-x-1/2 bottom-9 px-2.5 py-1 rounded-full bg-blue-500/95 text-white text-[9.5px] font-semibold shadow-md flex items-center gap-1.5">
                → {isJa ? "矢印描画モード" : "Arrow mode"}
                <span className="w-px h-3 bg-white/40" />
                <span className="font-normal opacity-90">
                  {isJa ? "始点 → 終点を指定 (Shift で 15° 刻み)" : "Click start, then end (Shift = snap 15°)"}
                </span>
              </div>
            )}
            {(isArrowSelected || isRectSelected) && (
              <>
                <div className="absolute left-1/2 -translate-x-1/2 bottom-9 px-2.5 py-1 rounded-full bg-blue-500/95 text-white text-[9.5px] font-semibold shadow-md flex items-center gap-1.5">
                  ◈ {isJa ? "1 個選択中" : "1 selected"}
                </div>
                <div className="absolute left-1/2 -translate-x-1/2 bottom-[76px] px-2 py-0.5 rounded-md bg-foreground/[0.75] text-white text-[8.5px] font-mono whitespace-nowrap hidden sm:block">
                  {isJa
                    ? "1 個選択中 · 矢印キー 0.5mm · ⇧+矢印 5mm · ⌘D 複製 · Del 削除"
                    : "1 selected · arrows 0.5mm · ⇧+arrows 5mm · ⌘D dup · Del delete"}
                </div>
              </>
            )}
          </div>

          {/* ───── RIGHT: PROPERTIES PANEL (選択時のみ) ───── */}
          {(() => {
            const propsActive = isArrowSelected || isRectSelected;
            const titleLow  = isArrowSelected ? "arrow" : "rect";
            const titleHigh = isArrowSelected ? "ARROW" : "RECT";
            const pos = isArrowSelected
              ? [["X1", "7"], ["Y1", "4"], ["X2", "10"], ["Y2", "5"]] as const
              : [["X", "5"], ["Y", "5"], ["W", "3"], ["H", "1"]] as const;
            return (
          <div
            className={`hidden lg:flex w-[208px] shrink-0 flex-col rounded-xl overflow-hidden transition-opacity duration-500 ${
              propsActive ? "opacity-100" : "opacity-40"
            }`}
            style={{
              background:
                "linear-gradient(180deg, rgba(245,158,11,0.06) 0%, rgba(255,255,255,0.98) 14%, rgba(255,255,255,1) 100%)",
              border: "1px solid rgba(245, 158, 11, 0.18)",
            }}
          >
            {/* Title: 選択中の図形種別を表示 */}
            <div className="px-2.5 pt-2 pb-1.5 flex items-center gap-1.5 border-b border-black/[0.05]">
              <span className="h-5 w-5 rounded border border-foreground/20 bg-white inline-block" />
              <div className="flex flex-col leading-tight">
                <span className="text-[10.5px] font-bold text-foreground/80">{titleLow}</span>
                <span className="text-[8.5px] font-mono text-foreground/40">{titleHigh}</span>
              </div>
            </div>

            {propsActive ? (
              <div className="flex flex-col gap-2 p-2 overflow-hidden">
                {/* ラベル — 矢印選択中はここに "F" がタイピングされる */}
                <div>
                  <div className="flex items-center gap-1 text-[9.5px] font-bold text-foreground/60 mb-1">
                    🏷 {isJa ? "ラベル" : "Label"}
                  </div>
                  <div className={`h-6 rounded border flex items-center px-2 text-[10px] ${
                    isArrowSelected
                      ? "border-blue-500/40 bg-white ring-1 ring-blue-500/30"
                      : "border-foreground/[0.08] bg-white text-foreground/30"
                  }`}>
                    {isArrowSelected && labelTypedLen > 0 ? (
                      <span className="text-foreground/85 font-mono italic">
                        {labelFull.slice(0, labelTypedLen)}
                        {isTypingLabel && labelTypedLen < labelFull.length && (
                          <span className="ml-px text-blue-500" style={{ opacity: Math.floor(e / 250) % 2 === 0 ? 1 : 0.2 }}>|</span>
                        )}
                      </span>
                    ) : isArrowSelected && isTypingLabel ? (
                      <span className="text-blue-500" style={{ opacity: Math.floor(e / 250) % 2 === 0 ? 1 : 0.2 }}>|</span>
                    ) : (
                      <span className="text-foreground/30">{isJa ? "テキストを入力..." : "Enter text..."}</span>
                    )}
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-1">
                    <span className="h-6 rounded bg-blue-500/10 text-blue-700 text-[9px] font-bold flex items-center justify-center ring-1 ring-blue-500/30">
                      Aa {isJa ? "テキスト" : "Text"}
                    </span>
                    <span className="h-6 rounded bg-white text-foreground/50 text-[9px] font-semibold flex items-center justify-center border border-foreground/[0.08]">
                      𝑥 {isJa ? "数式" : "Math"}
                    </span>
                  </div>
                </div>

                {/* 配置 3x3 (rect 選択時のみ — arrow には alignment 概念はない) */}
                {isRectSelected && (
                  <div>
                    <div className="text-[9.5px] font-bold text-foreground/60 mb-1">{isJa ? "配置" : "Alignment"}</div>
                    <div className="grid grid-cols-3 gap-0.5 w-[72px]">
                      {Array.from({ length: 9 }).map((_, i) => (
                        <span key={i}
                          className={`h-5 w-5 rounded border ${
                            i === 4
                              ? "bg-blue-500/80 border-blue-600"
                              : "bg-white border-foreground/[0.10]"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* 位置・サイズ */}
                <div>
                  <div className="text-[9.5px] font-bold text-foreground/60 mb-1">📐 {isJa ? "位置・サイズ" : "Position · Size"}</div>
                  <div className="grid grid-cols-2 gap-1 text-[9.5px] font-mono">
                    {pos.map(([k, v], i) => (
                      <div key={i} className="flex items-center gap-1">
                        <span className="text-foreground/45">{k}</span>
                        <span className="flex-1 h-5 rounded border border-foreground/[0.08] bg-white text-foreground/75 flex items-center justify-center">{v}</span>
                      </div>
                    ))}
                  </div>
                  {isRectSelected && (
                    <div className="mt-1.5 flex items-center gap-1 text-[9px]">
                      <span className="text-foreground/45 font-mono">ROT</span>
                      <span className="flex-1 h-1.5 rounded-full bg-foreground/[0.08] relative">
                        <span className="absolute left-0 top-0 h-1.5 w-3 rounded-full bg-blue-500" />
                        <span className="absolute left-3 -top-1 h-3 w-3 rounded-full bg-white ring-2 ring-blue-500" />
                      </span>
                      <span className="font-mono text-foreground/50 text-[8.5px]">0°</span>
                    </div>
                  )}
                </div>

                {/* 線の色 palette */}
                <div>
                  <div className="text-[9.5px] font-bold text-foreground/60 mb-1">🎨 {isJa ? "線の色" : "Stroke color"}</div>
                  <div className="grid grid-cols-6 gap-0.5">
                    {[
                      "#000000", "#ffffff", "#737373", "#a3a3a3", "#dc2626", "#7f1d1d",
                      "#fbcfe8", "#f97316", "#fb923c", "#b91c1c", "#fde047", "#fef08a",
                      "#22c55e", "#166534", "#bbf7d0", "#0d9488", "#67e8f9", "#bfdbfe",
                    ].map((c, i) => (
                      <span key={i}
                        className={`h-3.5 w-3.5 rounded-sm border ${
                          i === 0 ? "ring-1 ring-blue-500 ring-offset-1" : "border-foreground/10"
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <div className="text-[8.5px] font-mono text-foreground/45 mt-0.5">black</div>
                </div>
              </div>
            ) : (
              // 未選択状態: 実機の空 state
              <div className="flex-1 flex flex-col items-center justify-center gap-2 px-3 text-center">
                <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <span className="text-[14px]">⚙</span>
                </div>
                <div className="text-[10px] font-bold text-foreground/60">{isJa ? "プロパティ" : "Properties"}</div>
                <p className="text-[9px] text-foreground/45 leading-relaxed px-1">
                  {isJa
                    ? "図形を選択すると、ここでラベル・色・サイズなどを編集できます"
                    : "Select a shape to edit its label, color, and size here."}
                </p>
                <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-foreground/[0.08] bg-white/60 text-[8.5px] font-mono text-foreground/50">
                  V {isJa ? "選択モード" : "Select mode"}
                </div>
              </div>
            )}
          </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

/* ── Persona card ── */
function PersonaCard({ icon, title, desc, gradient }: {
  icon: React.ReactNode; title: string; desc: string; gradient: string;
}) {
  return (
    <div className="group flex items-start gap-4 p-6 rounded-2xl bg-card/60 backdrop-blur-sm border border-foreground/[0.06] hover:border-foreground/[0.12] hover:shadow-xl hover:-translate-y-0.5 transition-all duration-400">
      <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-lg shrink-0 group-hover:scale-110 transition-transform duration-300`}>
        {icon}
      </div>
      <div>
        <h4 className="text-[14px] font-semibold tracking-tight mb-1.5">{title}</h4>
        <p className="text-[12px] text-muted-foreground leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

/* ── Trust badge ── */
function TrustBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-foreground/[0.03] border border-foreground/[0.06] text-[12px] text-muted-foreground/70">
      <span className="text-primary/70">{icon}</span>
      {label}
    </div>
  );
}

/* ── FAQ Accordion Item ──
 * SEO の FAQPage JSON-LD と完全に対応する Q&A をユーザーに見せる。
 * Google のリッチリザルトは「JSON-LD と画面の表示が一致していること」を要求するため、
 * このコンポーネントの Q/A 文字列は app/layout.tsx の ld-faq と必ず揃える。
 */
function FAQItem({ question, answer }: { question: string; answer: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="group rounded-xl border border-foreground/[0.06] bg-card/50 backdrop-blur-sm hover:border-foreground/[0.12] transition-colors overflow-hidden"
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span className="text-[14px] sm:text-[15px] font-semibold tracking-tight text-foreground/90 leading-snug">
          {question}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform duration-300 ${open ? "rotate-180 text-violet-500" : ""}`}
        />
      </summary>
      <div className="px-5 pb-5 pt-1 text-[13px] sm:text-[13.5px] text-muted-foreground leading-relaxed">
        {answer}
      </div>
    </details>
  );
}

/* ── Realistic Worksheet Paper Mock ── */
type PrintVariant = "exam" | "worksheet" | "answer";

const SERIF: React.CSSProperties = {
  fontFamily: '"Hiragino Mincho ProN", "Yu Mincho", "Times New Roman", Georgia, serif',
};

const PaperFooter = () => (
  <div className="px-5 pb-3 pt-2 border-t border-gray-100 flex justify-between">
    <span className="text-[7px] text-gray-300 font-mono">Created with Eddivom</span>
    <span className="text-[7px] text-gray-300 font-mono">─ 1 ─</span>
  </div>
);

/* KaTeX inline math — renders exactly like real LaTeX output.
 * 中央集約レンダラを通すことで生 LaTeX 漏れを防ぐ。 */
function M({ t }: { t: string }) {
  const { html, ok } = renderMathHTML(t, { displayMode: false });
  if (ok) {
    return <span className="align-middle" dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return <span className="text-muted-foreground/70 text-[0.85em]">{"\u2329 math \u232A"}</span>;
}

function WorksheetPaper({ variant, isJa }: { variant: PrintVariant; isJa: boolean }) {
  if (variant === "exam") {
    return (
      <div className="bg-white rounded-lg shadow-2xl border border-gray-300/50 overflow-hidden select-none" style={SERIF}>
        {/* タイトルブロック */}
        <div className="px-6 pt-5 pb-3 border-b-2 border-gray-800">
          <h1 className="text-[18px] font-bold text-center text-gray-900 tracking-widest">
            {isJa ? "数学Ⅰ　確認テスト" : "Math I — Quiz"}
          </h1>
        </div>
        {/* 組・番・名前 行 */}
        <div className="px-6 pt-2 pb-1.5 flex items-center justify-between text-[10px] text-gray-600">
          <span>{isJa ? "各10点・計50点" : "10 pts each · 50 pts total"}</span>
          <span className="flex items-end gap-2">
            {isJa ? "組" : "Class"}<span className="border-b border-gray-500 w-7 inline-block mb-0.5" />
            {isJa ? "番" : "#"}<span className="border-b border-gray-500 w-7 inline-block mb-0.5" />
            {isJa ? "名前" : "Name"}<span className="border-b border-gray-500 w-20 inline-block mb-0.5" />
          </span>
        </div>
        <div className="mx-6 border-b border-gray-400 mb-3" />
        {/* 問題本文 */}
        <div className="px-6 pb-4 space-y-4">
          <div>
            <p className="text-[12px] font-bold text-gray-900 mb-1.5">
              {isJa ? "第１問　計算問題" : "Q1 — Calculations"}
            </p>
            <p className="text-[10px] text-gray-600 mb-2.5">{isJa ? "次の計算をせよ。" : "Solve each."}</p>
            <div className="space-y-3">
              <div>
                <p className="text-[11.5px] text-gray-800 leading-relaxed flex items-baseline gap-1">
                  <span className="text-gray-500 mr-1">(1)</span>
                  <M t="3x^2 + 5x - 2 = 0" />{isJa ? "　を解け。" : ""}
                </p>
                <div className="ml-6 mt-1 h-10 border-b border-dashed border-gray-200" />
              </div>
              <div>
                <p className="text-[11.5px] text-gray-800 leading-relaxed flex items-baseline gap-1">
                  <span className="text-gray-500 mr-1">(2)</span>
                  <M t="\log_2 8 + \log_2 4" />{isJa ? "　の値を求めよ。" : " = ?"}
                </p>
                <div className="ml-6 mt-1 h-10 border-b border-dashed border-gray-200" />
              </div>
            </div>
          </div>
          <div>
            <p className="text-[12px] font-bold text-gray-900 mb-1.5">
              {isJa ? "第２問　関数" : "Q2 — Functions"}
            </p>
            <p className="text-[10px] text-gray-600 mb-2.5">
              {isJa
                ? <span>関数 <M t="f(x) = x^2 - 4x + 3" /> について、次の問いに答えよ。</span>
                : <span><M t="f(x) = x^2 - 4x + 3" /> — answer the following.</span>}
            </p>
            <div className="space-y-3">
              <div>
                <p className="text-[11.5px] text-gray-800">
                  <span className="text-gray-500 mr-2">(1)</span>
                  {isJa ? "頂点の座標を求めよ。" : "Find the vertex."}
                </p>
                <div className="ml-6 mt-1 h-9 border-b border-dashed border-gray-200" />
              </div>
              <div>
                <p className="text-[11.5px] text-gray-800">
                  <span className="text-gray-500 mr-2">(2)</span>
                  {isJa ? "f(x) = 0 となる x の値を全て求めよ。" : "Solve f(x) = 0."}
                </p>
                <div className="ml-6 mt-1 h-8 border-b border-dashed border-gray-200" />
              </div>
            </div>
          </div>
        </div>
        <PaperFooter />
      </div>
    );
  }

  if (variant === "worksheet") {
    const problems: React.ReactNode[] = [
      <M key="p1" t="y = x^2 - 6x + 5" />,
      <M key="p2" t="y = -2x^2 + 8x - 3" />,
      <M key="p3" t="y = 3(x-1)^2 + 4" />,
    ];
    return (
      <div className="bg-white rounded-lg shadow-2xl border border-gray-300/50 overflow-hidden select-none" style={SERIF}>
        <div className="px-6 pt-5 pb-3 border-b-2 border-gray-800">
          <h1 className="text-[18px] font-bold text-center text-gray-900 tracking-widest">
            {isJa ? "練習問題プリント" : "Practice Worksheet"}
          </h1>
        </div>
        <div className="px-6 pt-2 pb-1.5 flex items-center justify-between text-[10px] text-gray-600">
          <span>{isJa ? "単元：二次関数" : "Unit: Quadratic Functions"}</span>
          <span className="flex items-end gap-1">
            {isJa ? "年　組　番　名前" : "Class　Name"}
            <span className="border-b border-gray-500 w-24 inline-block mb-0.5" />
          </span>
        </div>
        <div className="mx-6 border-b border-gray-400 mb-3" />
        <div className="px-6 pb-4 space-y-4">
          <div>
            <p className="text-[12px] font-bold text-gray-900 mb-1.5">{isJa ? "基本問題" : "Basic"}</p>
            <p className="text-[10px] text-gray-600 mb-2.5">
              {isJa ? "次の二次関数のグラフの頂点と軸を求めなさい。" : "Find the vertex and axis of each parabola."}
            </p>
            <div className="space-y-3">
              {problems.map((q, i) => (
                <div key={i}>
                  <p className="text-[11.5px] text-gray-800">
                    <span className="text-gray-500 mr-2">({i + 1})</span>{q}
                  </p>
                  <div className="ml-6 mt-1 h-9 border-b border-dashed border-gray-200" />
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[12px] font-bold text-gray-900 mb-1.5">{isJa ? "応用問題" : "Applied"}</p>
            <p className="text-[10px] text-gray-600 mb-2.5">
              {isJa ? "途中の計算過程も書くこと。" : "Show all working."}
            </p>
            <div>
              <p className="text-[11.5px] text-gray-800 flex items-baseline gap-1">
                <span className="text-gray-500 mr-1">(1)</span>
                <M t="x^2 - 2x - 3 > 0" />{isJa ? "　を満たす x の範囲を求めよ。" : " find range of x."}
              </p>
              <div className="ml-6 mt-1 h-10 border-b border-dashed border-gray-200" />
            </div>
          </div>
        </div>
        <PaperFooter />
      </div>
    );
  }

  // answer variant
  return (
    <div className="bg-white rounded-lg shadow-2xl border border-gray-300/50 overflow-hidden select-none" style={SERIF}>
      <div className="px-6 pt-5 pb-3 border-b-2 border-gray-800">
        <div className="flex items-center justify-center gap-3">
          <h1 className="text-[17px] font-bold text-gray-900 tracking-widest">
            {isJa ? "数学Ⅰ　確認テスト" : "Math I — Quiz"}
          </h1>
          <span className="text-[9px] px-1.5 py-0.5 border border-red-500 text-red-600 font-bold rounded shrink-0">
            {isJa ? "解答" : "KEY"}
          </span>
        </div>
      </div>
      <div className="mx-6 mt-3 border-b border-gray-300 mb-3" />
      <div className="px-6 pb-4 space-y-4">
        <div>
          <p className="text-[12px] font-bold text-gray-900 mb-2">
            {isJa ? "第１問　計算問題" : "Q1 — Calculations"}
          </p>
          <div className="space-y-2.5">
            <div>
              <p className="text-[11px] text-gray-600 flex items-baseline gap-1">
                <span className="text-gray-400">(1)</span>
                <M t="3x^2 + 5x - 2 = 0" />
              </p>
              <div className="ml-5 mt-1 bg-red-50/80 border-l-2 border-red-400 px-2.5 py-1.5 overflow-x-auto">
                <p className="text-[10.5px] text-red-700 whitespace-nowrap">
                  <M t="(3x-1)(x+2)=0,\ x=\tfrac13,-2" />
                </p>
              </div>
            </div>
            <div>
              <p className="text-[11px] text-gray-600 flex items-baseline gap-1">
                <span className="text-gray-400">(2)</span>
                <M t="\log_2 8 + \log_2 4" />
              </p>
              <div className="ml-5 mt-1 bg-red-50/80 border-l-2 border-red-400 px-2.5 py-1.5 overflow-x-auto">
                <p className="text-[10.5px] text-red-700 whitespace-nowrap">
                  <M t="=\log_2 32=\mathbf{5}" />
                </p>
              </div>
            </div>
          </div>
        </div>
        <div>
          <p className="text-[12px] font-bold text-gray-900 mb-2">
            {isJa ? "第２問　関数" : "Q2 — Functions"}
          </p>
          <div className="space-y-2.5">
            <div>
              <p className="text-[11px] text-gray-600 flex items-baseline gap-1">
                <span className="text-gray-400">(1)</span>
                <span>{isJa ? "頂点の座標" : "Vertex"}</span>
              </p>
              <div className="ml-5 mt-1 bg-red-50/80 border-l-2 border-red-400 px-2.5 py-1.5 overflow-x-auto">
                <p className="text-[10.5px] text-red-700 whitespace-nowrap">
                  <M t="f(x)=(x-2)^2-1,\ \therefore\ (2,-1)" />
                </p>
              </div>
            </div>
            <div>
              <p className="text-[11px] text-gray-600 flex items-baseline gap-1">
                <span className="text-gray-400">(2)</span>
                <M t="f(x)=0" />
              </p>
              <div className="ml-5 mt-1 bg-red-50/80 border-l-2 border-red-400 px-2.5 py-1.5 overflow-x-auto">
                <p className="text-[10.5px] text-red-700 whitespace-nowrap">
                  <M t="(x-1)(x-3)=0,\ \therefore\ x=1,3" />
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <PaperFooter />
    </div>
  );
}

/* ── Sample Output Showcase ── */
function SampleShowcase({ isJa, onTryNow, ctaLabel }: { isJa: boolean; onTryNow: () => void; ctaLabel?: string }) {
  const fadeIn = useFadeIn(0);
  const [active, setActive] = useState<PrintVariant>("exam");

  const tabs: Array<{ id: PrintVariant; ja: string; en: string }> = [
    { id: "exam", ja: "確認テスト", en: "Exam Sheet" },
    { id: "worksheet", ja: "演習プリント", en: "Worksheet" },
    { id: "answer", ja: "解答付き版", en: "Answer Key" },
  ];

  return (
    // eslint-disable-next-line react-hooks/refs
    <section id="sample-output" ref={fadeIn.ref} className={`relative py-24 overflow-hidden transition-all duration-1000 ${fadeIn.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_50%,hsl(var(--primary)/0.03),transparent_70%)]" />
      <div className="relative max-w-2xl mx-auto px-6">
        <div className="text-center mb-10">
          <p className="text-[11px] font-bold tracking-[0.25em] uppercase bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent mb-4">
            {isJa ? "完成した紙面を見てみる" : "See the finished output"}
          </p>
          <h2 className="text-[clamp(1.5rem,4vw,2.4rem)] font-bold tracking-tight mb-4">
            {isJa ? "こんなプリントが、数分で完成。" : "This is what prints in minutes."}
          </h2>
          <p className="text-muted-foreground text-[15px] max-w-lg mx-auto">
            {isJa
              ? "AIが問題を生成し、LuaLaTeXが美しく組版。印刷品質のPDFが即座に完成します。"
              : "AI generates the content, LuaLaTeX typesets it. Print-ready PDF in seconds."}
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-8 flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={`px-4 py-1.5 rounded-full text-[12px] font-semibold transition-all duration-200 ${
                active === tab.id
                  ? "bg-foreground text-background shadow-md scale-105"
                  : "bg-foreground/[0.04] text-muted-foreground hover:bg-foreground/[0.08] border border-foreground/[0.06]"
              }`}
            >
              {isJa ? tab.ja : tab.en}
            </button>
          ))}
        </div>

        <div className="flex justify-center">
          <div className="relative w-full max-w-sm">
            <div className="absolute inset-0 translate-x-2 translate-y-2 bg-gray-200/60 dark:bg-gray-800/40 rounded-xl opacity-50" />
            <div className="absolute inset-0 translate-x-1 translate-y-1 bg-gray-100/80 dark:bg-gray-800/25 rounded-xl opacity-70" />
            <div className="relative">
              <WorksheetPaper variant={active} isJa={isJa} />
            </div>
          </div>
        </div>

        <div className="text-center mt-12">
          <button
            onClick={onTryNow}
            className="group inline-flex items-center gap-2.5 px-8 py-3.5 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 text-white font-bold text-[14px] shadow-xl shadow-blue-500/20 hover:shadow-blue-500/35 hover:scale-[1.03] active:scale-[0.98] transition-all duration-300"
          >
            {ctaLabel ?? (isJa ? "このプリントを自分で作る" : "Make this worksheet yourself")}
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
          </button>
        </div>
      </div>
    </section>
  );
}

/* ── Before / After ── */
function BeforeAfterSection({ isJa }: { isJa: boolean }) {
  const fadeIn = useFadeIn(0);

  return (
    // eslint-disable-next-line react-hooks/refs
    <section ref={fadeIn.ref} className={`relative py-28 border-t border-foreground/[0.04] overflow-hidden transition-all duration-1000 ${fadeIn.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_50%,hsl(var(--primary)/0.025),transparent_70%)]" />
      <div className="relative max-w-5xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-[11px] font-bold tracking-[0.25em] uppercase bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent mb-4">
            Before / After
          </p>
          <h2 className="text-[clamp(1.5rem,4vw,2.5rem)] font-bold tracking-tight mb-4">
            {isJa ? "古い教材が、3ステップで新品に。" : "Old worksheet → polished printout in 3 steps."}
          </h2>
          <p className="text-muted-foreground text-[15px] max-w-md mx-auto mb-4">
            {isJa
              ? "過去問・スキャン・古いPDF。何からでも始められます。"
              : "Start from any old worksheet, scan, or PDF — Eddivom handles the rest."}
          </p>
          {/* 整合性: PDF/画像取り込みは Pro+ 機能のため、LP 上で明示する。
              Free ユーザーは AI プロンプト or テンプレートから始める動線を利用する。 */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-blue-500/10 to-violet-500/10 border border-violet-500/25 text-[11px] font-semibold text-violet-700 dark:text-violet-300">
            <Crown className="h-3 w-3" />
            {isJa
              ? "このPDF取り込みフローは Pro プラン以上でご利用いただけます"
              : "PDF ingestion flow available on Pro plan and above"}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-8 md:gap-6 items-center">
          {/* Before */}
          <div className="flex flex-col items-center gap-4">
            <span className="text-[10px] font-bold tracking-wider uppercase px-3 py-1 rounded-full border border-foreground/[0.08] text-muted-foreground/50 bg-foreground/[0.02]">
              {isJa ? "元の教材" : "Before"}
            </span>
            <div className="relative w-full max-w-[270px] mx-auto group">
              {/* Desk shadow */}
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-[65%] h-5 bg-black/[0.06] dark:bg-black/15 rounded-[50%] blur-lg" />
              {/* Paper */}
              <div
                className="relative rounded-sm overflow-hidden transition-transform duration-500 group-hover:rotate-0"
                style={{
                  aspectRatio: "210/297",
                  transform: "rotate(-2deg)",
                  background: "linear-gradient(160deg, #f2ead0 0%, #ebe1c0 50%, #e4d8b4 100%)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.3)",
                  border: "1px solid rgba(180,160,120,0.25)",
                }}
              >
                {/* Age spots */}
                <div className="absolute right-[15%] top-[8%] h-14 w-14 rounded-full bg-amber-800/[0.04] blur-lg pointer-events-none" />
                <div className="absolute left-[10%] bottom-[20%] h-10 w-10 rounded-full bg-amber-700/[0.03] blur-md pointer-events-none" />
                {/* Fold crease */}
                <div className="absolute left-0 right-0 top-[48%] h-[2px] pointer-events-none"
                  style={{ background: "linear-gradient(90deg, transparent 3%, rgba(140,120,70,0.06) 15%, rgba(140,120,70,0.1) 50%, rgba(140,120,70,0.06) 85%, transparent 97%)" }} />
                {/* Scan lines */}
                <div className="absolute inset-0 pointer-events-none opacity-[0.025]"
                  style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.12) 3px, rgba(0,0,0,0.12) 4px)" }} />
                {/* Vignette */}
                <div className="absolute inset-0 pointer-events-none rounded-sm"
                  style={{ boxShadow: "inset 0 0 30px rgba(0,0,0,0.04)" }} />

                {/* Content skeleton */}
                <div className="relative h-full p-[9%] flex flex-col">
                  {/* Title */}
                  <div className="mb-[5%] pb-[4%] border-b-[1.5px] border-gray-700/15">
                    <div className="h-2.5 bg-gray-800/18 rounded-[1px] w-[50%] mx-auto mb-2" />
                    <div className="h-1.5 bg-gray-600/10 rounded-[1px] w-[30%] mx-auto" />
                  </div>
                  {/* Info row */}
                  <div className="flex items-center gap-2 mb-[5%]">
                    <div className="h-1 bg-gray-500/12 rounded-[1px] w-[15%]" />
                    <div className="flex-1 border-b border-gray-400/15" />
                  </div>
                  {/* Section 1 */}
                  <div className="h-2 bg-gray-700/15 rounded-[1px] w-[35%] mb-1.5" />
                  <div className="h-1 bg-gray-500/10 rounded-[1px] w-[55%] mb-[4%]" />
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="mb-[5%]">
                      <div className="flex gap-[3%] mb-1">
                        <span className="text-[5px] text-gray-600/25 shrink-0">({n})</span>
                        <div className="flex-1 space-y-1">
                          <div className="h-1 bg-gray-600/12 rounded-[1px]" style={{ width: `${60 + n * 10}%` }} />
                          <div className="h-1 bg-gray-500/8 rounded-[1px]" style={{ width: `${40 + n * 12}%` }} />
                        </div>
                      </div>
                      <div className="ml-[7%] h-5 border-b border-dashed border-gray-400/12 mt-0.5" />
                    </div>
                  ))}
                  {/* Section 2 */}
                  <div className="h-2 bg-gray-700/15 rounded-[1px] w-[30%] mb-1.5 mt-[2%]" />
                  <div className="mb-[3%]">
                    <div className="flex gap-[3%] mb-1">
                      <span className="text-[5px] text-gray-600/25 shrink-0">(1)</span>
                      <div className="flex-1">
                        <div className="h-1 bg-gray-600/12 rounded-[1px] w-[70%]" />
                      </div>
                    </div>
                    <div className="ml-[7%] h-4 border-b border-dashed border-gray-400/12 mt-0.5" />
                  </div>
                  {/* Footer */}
                  <div className="mt-auto pt-2 border-t border-gray-400/8 flex justify-center">
                    <div className="h-0.5 bg-gray-500/8 rounded-[1px] w-[10%]" />
                  </div>
                </div>
              </div>
            </div>
            <p className="text-[12px] text-muted-foreground/60 text-center">
              {isJa ? "過去問・古いプリント・スキャンPDF" : "Old exams, scanned worksheets, PDFs"}
            </p>
          </div>

          {/* Steps connector — mobile */}
          <div className="flex md:hidden items-center justify-center gap-3 py-2">
            {[
              { Icon: Upload, from: "from-blue-500", to: "to-violet-600" },
              { Icon: PenLine, from: "from-violet-500", to: "to-fuchsia-500" },
              { Icon: FileDown, from: "from-emerald-500", to: "to-teal-500" },
            ].map(({ Icon, from, to }, i) => (
              <React.Fragment key={i}>
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/25" />}
                <div className={`h-9 w-9 rounded-full bg-gradient-to-br ${from} ${to} flex items-center justify-center shadow-md`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
              </React.Fragment>
            ))}
          </div>
          {/* Steps connector — desktop */}
          <div className="hidden md:flex flex-col items-center justify-center min-w-[130px]">
            {[
              { Icon: Upload, label: isJa ? "アップロード\nAI抽出" : "Upload\nAI extract", from: "from-blue-500", to: "to-violet-600", shadow: "shadow-violet-500/20" },
              { Icon: PenLine, label: isJa ? "編集・類題\n追加" : "Edit &\nadd variants", from: "from-violet-500", to: "to-fuchsia-500", shadow: "shadow-fuchsia-500/20" },
              { Icon: FileDown, label: isJa ? "PDF出力" : "Export PDF", from: "from-emerald-500", to: "to-teal-500", shadow: "shadow-emerald-500/20" },
            ].map(({ Icon, label, from, to, shadow }, i) => (
              <React.Fragment key={i}>
                {i > 0 && (
                  <div className="flex flex-col items-center my-0.5">
                    <div className="h-4 w-px bg-foreground/[0.08]" />
                    <ChevronDown className="h-3 w-3 text-muted-foreground/20 -my-0.5" />
                  </div>
                )}
                <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${from} ${to} flex items-center justify-center shadow-lg ${shadow}`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <p className="text-[8px] text-muted-foreground/45 text-center leading-tight mt-1.5 whitespace-pre-line">{label}</p>
              </React.Fragment>
            ))}
          </div>

          {/* After */}
          <div className="flex flex-col items-center gap-4">
            <span className="text-[10px] font-bold tracking-wider uppercase px-3 py-1 rounded-full border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 bg-emerald-500/[0.06]">
              {isJa ? "完成品" : "After"}
            </span>
            <div className="relative w-full max-w-[270px] mx-auto">
              {/* Ambient glow */}
              <div className="absolute -inset-4 -z-10 bg-gradient-to-br from-blue-400/[0.06] via-violet-400/[0.06] to-emerald-400/[0.06] dark:from-blue-400/[0.03] dark:via-violet-400/[0.03] dark:to-emerald-400/[0.03] rounded-3xl blur-2xl" />
              {/* Stacked pages */}
              <div className="absolute inset-0 translate-x-3 translate-y-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200/40 dark:border-gray-700/25 shadow-sm" />
              <div className="absolute inset-0 translate-x-1.5 translate-y-1.5 bg-white dark:bg-gray-900 rounded-lg border border-gray-200/50 dark:border-gray-700/35 shadow-md" />
              {/* Main paper */}
              <div className="relative" style={{ transform: "perspective(1200px) rotateY(-2deg)" }}>
                <WorksheetPaper variant="answer" isJa={isJa} />
              </div>
              {/* Desk shadow */}
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-[70%] h-5 bg-black/[0.05] dark:bg-black/15 rounded-[50%] blur-lg" />
            </div>
            <p className="text-[12px] text-muted-foreground/60 text-center">
              {isJa ? "美しく組版された印刷品質のPDF" : "Beautifully typeset, print-ready PDF"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// プラン別の UI 状態。サーバ判定が最終権限なので、ここは UX だけに使う。
const PLAN_RANK_UI: Record<PlanId, number> = { free: 0, starter: 1, pro: 2, premium: 3 };
function planButtonState(current: PlanId, target: PlanId): "upgrade" | "current" | "lower" {
  if (current === target) return "current";
  if (PLAN_RANK_UI[target] > PLAN_RANK_UI[current]) return "upgrade";
  return "lower";
}

export function TemplateGallery() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setDocument = useDocumentStore((s) => s.setDocument);
  const currentPlan = usePlanStore((s) => s.currentPlan);
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [powerOpen, setPowerOpen] = useState(false);
  // 「ログインなしで試す」モーダル。CTA から開く。
  // alreadyUsed は CTA を押したそのフレームで評価して固定する (モーダル中に書き込まれた
  // localStorage の影響をモーダル UI 側に再注入しない設計)。
  const [trialOpen, setTrialOpen] = useState(false);
  const [trialAlreadyUsed, setTrialAlreadyUsed] = useState(false);

  /**
   * 「ログインなしで試す」CTA の挙動。
   * すでに本ブラウザで試行済み (= 1 回使い切り) の場合は CTA 押下時点で
   * GA4 の `free_generate_limit_reached` を発火し、モーダル側で登録誘導を出す。
   */
  const openTrialOrLimit = () => {
    const used = hasUsedAnonymousTrial();
    setTrialAlreadyUsed(used);
    if (used) {
      trackFreeGenerateLimitReached();
    }
    setTrialOpen(true);
  };

  const handleTrialLoginRequested = () => {
    setTrialOpen(false);
    // 既存のプラン選択フロー (Google サインインへ) に乗せる。
    handlePlanSelect("free");
  };


  const personaFade = useFadeIn(0);
  const workflowFade = useFadeIn(0);
  const featuresFade = useFadeIn(0);
  const diffFade = useFadeIn(0);
  const pricingFade = useFadeIn(0);
  const powerFade = useFadeIn(0);
  const faqFade = useFadeIn(0);
  const ctaFade = useFadeIn(0);

  const scrollToPricing = () => {
    document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
  };
  const scrollToSample = () => {
    document.getElementById("sample-output")?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const t = setTimeout(() => setHeroLoaded(true), 60);
    return () => clearTimeout(t);
  }, []);

  const handlePlanSelect = async (planId: "free" | "starter" | "pro" | "premium") => {
    // 認証チェック → 未ログインならログインへ
    try {
      const { getSession, signIn } = await import("next-auth/react");
      const session = await getSession();
      if (!session) {
        sessionStorage.setItem("pending_plan", planId);
        signIn("google", { callbackUrl: "/?plan=" + planId });
        return;
      }
    } catch (e) {
      console.error("[handlePlanSelect] auth error:", e);
      toast.error("ログインの確認に失敗しました");
      return;
    }
    // Stripe Checkout へリダイレクト（Free含む全プラン）
    await redirectToCheckout(planId);
  };

  const redirectToCheckout = async (planId: string) => {
    try {
      const { createCheckoutSession } = await import("@/lib/subscription-api");
      const result = await createCheckoutSession(planId as "starter" | "pro" | "premium");
      if (result.action === "already_on_plan") {
        // サーバ判定で「既に同じ or 上位プラン契約中」。Stripe は挟まない。
        toast.success(
          isJa
            ? `すでに${PLANS[(result.currentPlan || "free") as keyof typeof PLANS]?.name ?? ""}プランをご契約中です。エディタに移動します。`
            : `You already have the ${PLANS[(result.currentPlan || "free") as keyof typeof PLANS]?.name ?? ""} plan. Taking you to the editor.`,
        );
        // 自前ドキュメントを確実に用意してからエディタへ
        const doc = loadFromLocalStorage() || createDefaultDocument("blank", getTemplateLatex("blank"));
        setDocument(doc);
        router.push("/editor");
        return;
      }
      window.location.href = result.url;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[redirectToCheckout] error:", msg);
      toast.error("決済ページの取得に失敗しました: " + msg);
    }
  };

  // ログイン後に ?plan=pro 等で戻ってきた場合、自動でStripe Checkoutへ
  // また ?checkout=success で戻ってきた場合は editor へリダイレクト
  useEffect(() => {
    // checkout 完了ハンドリング (旧 success_url が / を向いていた場合のフォールバック)
    if (searchParams.get("checkout") === "success") {
      const plan = searchParams.get("plan") || "";
      // ★ session_id は絶対に落とさない。verify → DB upsert → GA4 purchase の
      //   全フローがこの値に依存する。ここで消すと「購入しても反映されない」に直結する。
      const sid = searchParams.get("session_id") || "";
      window.history.replaceState({}, "", "/");
      const doc = loadFromLocalStorage() || createDefaultDocument("blank", getTemplateLatex("blank"));
      setDocument(doc);
      const qs = new URLSearchParams({ checkout: "success" });
      if (plan) qs.set("plan", plan);
      if (sid) qs.set("session_id", sid);
      router.push(`/editor?${qs.toString()}`);
      return;
    }

    const planFromUrl = searchParams.get("plan");
    const planFromStorage = sessionStorage.getItem("pending_plan");
    const pendingPlan = planFromUrl || planFromStorage;
    if (pendingPlan && ["free", "starter", "pro", "premium"].includes(pendingPlan)) {
      sessionStorage.removeItem("pending_plan");
      // URLパラメータをクリーン
      window.history.replaceState({}, "", "/");
      redirectToCheckout(pendingPlan);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleResume = () => {
    const doc = loadFromLocalStorage();
    if (doc) { setDocument(doc); router.push("/editor"); }
  };

  /** 新規ドキュメントで即エディタを開く (Stripe を挟まない)。有料プラン or 保存済みユーザー向け。 */
  const openEditorBlank = () => {
    setDocument(createDefaultDocument("blank", getTemplateLatex("blank")));
    router.push("/editor?new=1");
  };

  const { locale } = useI18n();
  const saved = typeof window !== "undefined" ? loadFromLocalStorage() : null;
  const isJa = locale !== "en";

  /**
   * プラン・保存ドキュメントの有無を踏まえて「LP 上の主要 CTA の文言と動作」を決める。
   *
   *   · ログアウト / Free:
   *       - 保存なし → "無料で始める"  (Stripe で Free プランを有効化 → /editor)
   *       - 保存あり → "続きから編集"   (/editor に直行、Stripe を挟まない)
   *   · 有料プラン (Starter / Pro / Premium):
   *       - 保存あり → "続きから編集"
   *       - 保存なし → "白紙で始める"   (既に課金済みなので "無料で試す" は見せない)
   *
   * Stripe の Free 経路を踏まない有料・保存済みユーザーに、「登録しろ」感を
   * 出さないのが目的。(= ユーザーの要望: Starter 以上や保存済みは別文言)
   */
  const primaryCta = React.useMemo(() => {
    const planName = PLANS[currentPlan]?.name ?? "";
    if (currentPlan === "free") {
      if (saved) {
        return {
          label: isJa ? "続きから編集" : "Resume editing",
          subLabel: isJa ? saved.metadata.title || "無題の教材" : saved.metadata.title || "Untitled",
          onClick: handleResume,
          variant: "resume" as const,
        };
      }
      // 未ログイン (= プラン未取得時の既定 free) のヒーロー CTA は
      // 「ログインなしお試しモーダル」を直接開く。以前は handlePlanSelect("free") 経由で
      // signIn → Stripe Free checkout に飛ばしていたが、広告流入ユーザにはここで
      // 触らせることが先 (CVR 検証用)。登録動線は結果画面の登録 CTA に集約する。
      return {
        label: isJa ? "無料で1枚作ってみる" : "Generate one free",
        subLabel: isJa ? "ログインなし · 30〜60秒で1枚" : "No signup · 30–60s per sheet",
        onClick: openTrialOrLimit,
        variant: "free" as const,
      };
    }
    // 有料プラン: Stripe は挟まず /editor に直行する
    if (saved) {
      return {
        label: isJa ? `続きから編集 (${planName})` : `Resume editing (${planName})`,
        subLabel: isJa ? saved.metadata.title || "無題の教材" : saved.metadata.title || "Untitled",
        onClick: handleResume,
        variant: "resume" as const,
      };
    }
    return {
      label: isJa ? "白紙で始める" : "Start a new worksheet",
      subLabel: isJa ? `${planName}プランでエディタへ` : `Open editor on ${planName}`,
      onClick: openEditorBlank,
      variant: "paid-new" as const,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlan, saved, isJa]);

  const heroTypingLines = React.useMemo(() => isJa
    ? ["教材を、もっと速く。", "ワークシートを、今夜中に。", "問題集を、AIと一緒に。"]
    : ["Worksheets, faster.", "Answer keys, automatic.", "Variants, one click."],
    [isJa]);

  // ── モバイル分岐 — PC 版 LP には一切手を入れず、こちらは別 LP コンポーネント
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <>
        <MobileLanding
          primaryCta={primaryCta}
          scrollToPricing={scrollToPricing}
          scrollToSample={scrollToSample}
          EditorMockup={EditorMockup}
          FigureDrawMockup={FigureDrawMockup}
          onPlanSelect={handlePlanSelect}
        />
        <AnonymousTrialModal
          open={trialOpen}
          onOpenChange={setTrialOpen}
          onLoginRequested={handleTrialLoginRequested}
          alreadyUsed={trialAlreadyUsed}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">

      {/* ━━ Navigation ━━ */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-foreground/[0.06]">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-12">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-600 via-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
                <path d="M5 6h10M5 12h7M5 18h10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="18" cy="12" r="3" stroke="white" strokeWidth="2" fill="white" fillOpacity="0.3" />
              </svg>
            </div>
            <span className="text-[15px] font-bold tracking-tight">Eddivom</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={scrollToPricing}
              className="hidden sm:block text-[13px] text-muted-foreground hover:text-foreground transition-colors font-medium"
            >
              {isJa ? "料金" : "Pricing"}
            </button>
            <LanguageSwitcher />
            <ThemeToggle />
            <UserMenu />
            <button
              onClick={primaryCta.onClick}
              className="hidden sm:flex items-center gap-2 px-4 py-1.5 rounded-full bg-foreground text-background text-[13px] font-semibold hover:opacity-90 transition-opacity"
            >
              {primaryCta.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </nav>

      {/* ━━ Hero ━━
          1 画面目で「何ができるか」を即伝えるため、テキストを圧縮して
          30 秒の実機デモ (EditorMockup) を上げてある。 */}
      <section className="relative pt-16 sm:pt-20 pb-10 overflow-hidden">
        {/* Ambient gradient mesh */}
        <div className="absolute inset-0 pointer-events-none">
          <GlowOrb className="top-[-15%] left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-b from-blue-500/[0.06] to-violet-500/[0.06]" />
          <GlowOrb className="bottom-[10%] right-[5%] w-[400px] h-[300px] bg-fuchsia-500/[0.05]" />
          <GlowOrb className="top-[30%] left-[5%] w-[300px] h-[250px] bg-blue-500/[0.04]" />
          {/* Grid */}
          <div className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]"
            style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '44px 44px' }} />
        </div>

        <FloatingFormulas />

        {/* Hero content — 配置順:
            1) Badge / Headline / Subtitle (テキスト訴求)
            2) EditorMockup (30 秒の実機デモ ─ 説得材料)
            3) CTAs (続きから編集 等 ─ 説得後にクリック誘導)
            ──── 動画→ボタンの順にした方がコンバージョン理論的に強い。 */}
        <div className="relative z-10 max-w-5xl mx-auto text-center px-4 sm:px-6">
          <div className={`transition-all duration-1000 ease-out ${heroLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>

            {/* Badge — タイトな単一行 */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-blue-500/[0.08] to-violet-500/[0.08] border border-violet-500/[0.15] mb-4 sm:mb-5 shadow-sm">
              <Sparkles className="h-3 w-3 text-violet-500" />
              <span className="bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent text-[11px] font-bold tracking-wide">
                Eddivom — {isJa ? "AI教材作成IDE" : "AI-powered worksheet IDE"}
              </span>
            </div>

            {/* Headline — 1 画面に納めるためにスケールを抑制 */}
            <h1 className="text-[clamp(1.6rem,4.2vw,3.4rem)] leading-[1.08] font-bold tracking-[-0.035em] mb-4 sm:mb-5 whitespace-nowrap">
              <TypingLine lines={heroTypingLines} />
            </h1>

            <p className="text-muted-foreground text-[14px] sm:text-[16px] leading-relaxed max-w-xl mx-auto mb-7 sm:mb-8 font-light">
              {isJa
                ? "AIが問題を生成し、類題を量産し、解答付きPDFを自動で作成。"
                : "AI generates problems, multiplies variants, and auto-creates answer-key PDFs."}
            </p>
          </div>

          {/* 30 秒の実機デモ ─ CTA より先に "どう動くのか" を見せる */}
          <div className={`relative transition-all duration-1000 delay-200 ${heroLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <p className="inline-flex items-center gap-1.5 text-[11px] text-violet-500/80 font-semibold mb-3">
              <Play className="h-3 w-3 fill-current" />
              {isJa ? "30 秒で実際の画面を見る" : "Watch the real app — 30s"}
            </p>
            <EditorMockup isJa={isJa} />

            {/* 機能チップ — モバイルでは折り返し */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
              {[
                { icon: <Sparkles className="h-3 w-3" />, label: isJa ? "AIに指示→即反映" : "Prompt → instant result" },
                { icon: <FileText className="h-3 w-3" />, label: isJa ? "コンパイル済みPDF" : "Compiled PDF" },
                { icon: <Pencil className="h-3 w-3" />, label: isJa ? "紙面を直接編集" : "Edit on page" },
                { icon: <RefreshCw className="h-3 w-3" />, label: isJa ? "類題を一瞬で量産" : "Variants in 1 click" },
              ].map((chip) => (
                <div key={chip.label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-foreground/[0.03] border border-foreground/[0.06] text-[10.5px] text-muted-foreground">
                  <span className="text-primary/70">{chip.icon}</span>
                  {chip.label}
                </div>
              ))}
            </div>
          </div>

          {/* CTA ─ デモを見せた後に置いて「やってみよう」を誘発する */}
          <div className={`mt-10 sm:mt-12 transition-all duration-1000 delay-500 ${heroLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-3">
              <button
                onClick={primaryCta.onClick}
                className="group relative flex items-center gap-2.5 px-8 py-3.5 rounded-full bg-foreground text-background font-bold text-[15px] shadow-2xl shadow-foreground/10 hover:shadow-foreground/20 hover:scale-[1.03] active:scale-[0.98] transition-all duration-300 overflow-hidden"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600 opacity-0 group-hover:opacity-[0.08] transition-opacity duration-300" />
                {primaryCta.variant === "resume" && <FileText className="h-4 w-4" />}
                {primaryCta.label}
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
              </button>
              {primaryCta.variant === "resume" && currentPlan !== "free" && (
                <button
                  onClick={openEditorBlank}
                  className="group flex items-center gap-2.5 px-6 py-3 rounded-full border border-foreground/[0.12] text-foreground font-medium text-[14px] hover:bg-foreground/[0.04] hover:border-foreground/[0.2] active:scale-[0.98] transition-all duration-300"
                >
                  {isJa ? "白紙で始める" : "Start blank"}
                  <ChevronRight className="h-4 w-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </button>
              )}
              <button
                onClick={scrollToSample}
                className="group flex items-center gap-2.5 px-6 py-3 rounded-full border border-foreground/[0.12] text-foreground font-medium text-[14px] hover:bg-foreground/[0.04] hover:border-foreground/[0.2] active:scale-[0.98] transition-all duration-300"
              >
                {isJa ? "完成イメージを見る" : "See sample"}
                <ChevronRight className="h-4 w-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </button>
            </div>

            <p className="text-[11px] text-muted-foreground/40 mb-3">
              {primaryCta.subLabel}
            </p>

            {/* モバイル限定の PC 推奨ヒント */}
            <div className="sm:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-amber-500/25 bg-amber-500/[0.06] text-amber-700 dark:text-amber-300 text-[11px] font-medium">
              <span aria-hidden="true">💻</span>
              <span>{isJa ? "編集は PC ブラウザを推奨" : "Use a desktop browser to edit"}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ━━ Trust signals bar ━━ */}
      <section className="border-y border-foreground/[0.04] bg-foreground/[0.008] dark:bg-white/[0.01] py-5">
        <div className="max-w-5xl mx-auto px-6 flex flex-wrap items-center justify-center gap-3">
          <TrustBadge icon={<Zap className="h-3.5 w-3.5" />} label={isJa ? "LuaLaTeX 組版エンジン" : "LuaLaTeX typesetting"} />
          <TrustBadge icon={<Shield className="h-3.5 w-3.5" />} label={isJa ? "無料プランあり・登録不要" : "Free plan · No signup"} />
          <TrustBadge icon={<Printer className="h-3.5 w-3.5" />} label={isJa ? "A4/B5 印刷対応" : "Print-ready PDF"} />
          <TrustBadge icon={<Star className="h-3.5 w-3.5" />} label={isJa ? "数式・図・化学式対応" : "Math, diagrams, chemistry"} />
        </div>
      </section>

      <SampleShowcase isJa={isJa} onTryNow={primaryCta.onClick} ctaLabel={primaryCta.label} />

      {/* ━━ Who is this for ━━ */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_50%,hsl(var(--primary)/0.025),transparent_70%)]" />
        <div
          ref={personaFade.ref}
          className={`relative max-w-4xl mx-auto px-6 transition-all duration-1000 ${personaFade.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          <div className="text-center mb-14">
            <p className="text-[11px] font-bold tracking-[0.25em] uppercase bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent mb-4">
              {isJa ? "こんな先生に使われています" : "Built for tutors like you"}
            </p>
            <h2 className="text-[clamp(1.6rem,4vw,2.6rem)] font-bold tracking-tight mb-4">
              {isJa ? "毎週、生徒ごとにプリントを作る先生へ。" : "For tutors who build custom worksheets every week."}
            </h2>
            <p className="text-muted-foreground text-[15px] max-w-lg mx-auto">
              {isJa
                ? "生徒に合わせた教材を毎週手作りしていませんか？ Eddivom なら、過去問の再利用も類題の量産も数分で完了します。"
                : "Tired of spending hours building custom problem sets for each student? Eddivom turns that into minutes."}
            </p>
          </div>

          {/* Primary persona — individual tutors */}
          <div className="relative p-8 rounded-[24px] bg-gradient-to-b from-violet-500/[0.05] to-blue-500/[0.03] border-2 border-violet-500/[0.15] shadow-xl shadow-violet-500/[0.06] mb-6">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white shadow-lg shrink-0">
                <GraduationCap className="h-7 w-7" strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <h4 className="text-[17px] font-bold tracking-tight mb-3">{isJa ? "個人塾・家庭教師" : "Tutors & Private Instructors"}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    isJa ? "生徒ごとに違うプリントを毎週作る" : "Custom problem sets for each student, weekly",
                    isJa ? "過去のプリントを数値だけ変えて再利用" : "Reuse past worksheets with different numbers",
                    isJa ? "「あと5問」で類題を一瞬で追加" : "\"5 more like this\" generates variants instantly",
                    isJa ? "解答付きPDFで採点・保護者説明も楽" : "Answer-key PDFs make grading and parent reports easy",
                  ].map((text) => (
                    <div key={text} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-violet-500 mt-0.5 shrink-0" />
                      <span className="text-[13px] text-foreground/80">{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Secondary personas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PersonaCard
              icon={<Users className="h-5 w-5" strokeWidth={1.5} />}
              gradient="from-blue-500 to-cyan-500"
              title={isJa ? "学校の教科担当" : "Math & STEM Teachers"}
              desc={isJa
                ? "小テスト・定期テストを効率よく作成。解答付きPDFで採点も楽に。"
                : "Create quizzes and assessments efficiently. Answer-key PDFs make grading painless."}
            />
            <PersonaCard
              icon={<BookOpen className="h-5 w-5" strokeWidth={1.5} />}
              gradient="from-emerald-500 to-teal-500"
              title={isJa ? "教材制作・販売" : "Worksheet Creators & Sellers"}
              desc={isJa
                ? "問題集やドリルを作って配布・販売。印刷品質のPDFを大量に。"
                : "Build and sell problem sets. Export print-ready PDFs at scale."}
            />
          </div>
        </div>
      </section>

      {/* ━━ Outcome stats ━━ */}
      <section className="relative border-y border-foreground/[0.04] bg-foreground/[0.015] dark:bg-white/[0.02] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_100%_at_50%_50%,hsl(var(--primary)/0.03),transparent_70%)]" />
        <div className="relative max-w-4xl mx-auto px-6 py-16">
          <p className="text-center text-[11px] font-bold tracking-[0.2em] uppercase text-primary/60 mb-10">
            {isJa ? "Eddivom なら" : "With Eddivom"}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: 30, suffix: isJa ? "秒" : "s",   label: isJa ? "で問題セットを生成" : "to generate a problem set" },
              { value: 1,  suffix: isJa ? "クリック" : " click", label: isJa ? "で類題を量産" : "to spin up variants" },
              { value: 500, suffix: isJa ? "ページ" : "p",    label: isJa ? "まで対応" : "max document size" },
              { value: 100, suffix: "%",  label: isJa ? "ブラウザだけで完結" : "browser-based, no install" },
            ].map((s) => (
              <div key={s.label} className="group">
                <p className="text-[clamp(2rem,5vw,3rem)] font-black tracking-tight bg-gradient-to-b from-foreground to-foreground/50 bg-clip-text text-transparent">
                  <AnimatedCounter value={s.value} suffix={s.suffix} />
                </p>
                <p className="text-[12px] text-muted-foreground mt-1.5 leading-snug">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <BeforeAfterSection isJa={isJa} />

      {/* ━━ Workflow ━━
        Free で完結する 4 ステップをメインに置き、
        その下に「Pro で解放される拡張機能」を別ブロックで見せる構成。
        (以前は 5 ステップで PDF 取り込み=OCR を最初に置いていたが、
        OCR は Pro+ 機能なので Free ユーザーが実行できず LP の整合性を損ねていた) */}
      <section className="relative py-28 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_100%,hsl(var(--primary)/0.03),transparent_70%)]" />
        <div
          ref={workflowFade.ref}
          className={`relative max-w-5xl mx-auto px-6 transition-all duration-1000 ${workflowFade.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          <div className="text-center mb-14">
            <p className="text-[11px] font-bold tracking-[0.25em] uppercase bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent mb-4">
              {isJa ? "Eddivom のワークフロー" : "How Eddivom works"}
            </p>
            <h2 className="text-[clamp(1.5rem,4vw,2.6rem)] font-bold tracking-tight mb-4">
              {isJa ? "Free でも 4 ステップで 1 枚完成。" : "A worksheet in 4 steps — even on Free."}
            </h2>
            <p className="text-muted-foreground text-[15px] max-w-lg mx-auto">
              {isJa
                ? "AIに指示してから PDF 印刷まで、ブラウザだけで完結。Pro にアップグレードすれば PDF 取り込み・採点・バッチ量産が解放されます。"
                : "From AI prompt to print-ready PDF, entirely in the browser. Upgrade to Pro to unlock PDF ingestion, grading, and batch generation."}
            </p>
          </div>

          {/* ── Free で完結する 4 ステップ (主動線) ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-3">
            <StepCard num="01" icon={<Sparkles className="h-5 w-5" strokeWidth={1.5} />}
              title={isJa ? "AIにお願い" : "Ask the AI"}
              desc={isJa ? "「二次方程式のプリントを10問」など自然言語で指示。テンプレ選択でもOK。" : "Describe what you need (e.g. \"10 quadratic problems\") or pick a template."}
              color="bg-gradient-to-br from-blue-500 to-violet-500"
              planBadge="free" />
            <StepCard num="02" icon={<PenLine className="h-5 w-5" strokeWidth={1.5} />}
              title={isJa ? "紙面で直接編集" : "Edit on the page"}
              desc={isJa ? "数式・配点・設問を紙面でクリック編集。LaTeX の知識は不要。" : "Click and edit equations, points, prompts — no LaTeX knowledge required."}
              color="bg-gradient-to-br from-emerald-500 to-teal-500"
              planBadge="free" />
            <StepCard num="03" icon={<Copy className="h-5 w-5" strokeWidth={1.5} />}
              title={isJa ? "AIで類題を追加" : "AI adds variants"}
              desc={isJa ? "「もう5問」で数値・難易度を変えた類題が即追加。AI回数はプラン別。" : "\"5 more like this\" spawns fresh variants. AI call count depends on plan."}
              color="bg-gradient-to-br from-amber-500 to-orange-500"
              planBadge="free" />
            <StepCard num="04" icon={<FileDown className="h-5 w-5" strokeWidth={1.5} />}
              title={isJa ? "PDF出力・印刷" : "Export & print"}
              desc={isJa ? "生徒用・解答付きの2種類を PDF で書き出し。A4/B5 で即印刷。" : "Export student sheet + answer key. Print-ready A4/B5 PDF."}
              color="bg-gradient-to-br from-slate-500 to-gray-600"
              planBadge="free" />
          </div>

          {/* ── Pro で解放される拡張フロー (副動線) ── */}
          <div className="mt-10 relative rounded-[24px] p-7 bg-gradient-to-br from-blue-500/[0.04] via-violet-500/[0.05] to-fuchsia-500/[0.04] border border-violet-500/[0.18] overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-violet-500/[0.08] blur-3xl pointer-events-none" />
            <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 text-white text-[10.5px] font-bold tracking-wide shadow-md">
                <Crown className="h-3 w-3" />
                {isJa ? "Pro で解放" : "Unlocked on Pro"}
              </span>
              <h3 className="text-[15px] font-bold tracking-tight">
                {isJa ? "Pro にアップグレードで、さらに以下のフローが追加されます。" : "Upgrading to Pro unlocks these extra workflows."}
              </h3>
            </div>
            <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-3">
              <ProWorkflowCard
                icon={<Upload className="h-4 w-4" strokeWidth={1.6} />}
                color="bg-gradient-to-br from-blue-500 to-cyan-500"
                title={isJa ? "PDF・画像から取り込み" : "PDF / image ingest"}
                desc={isJa ? "過去問スキャンや古い PDF を AI が自動で問題に変換 (OCR)。" : "Scanned exams or old PDFs → editable problems via OCR."}
              />
              <ProWorkflowCard
                icon={<ClipboardCheck className="h-4 w-4" strokeWidth={1.6} />}
                color="bg-gradient-to-br from-rose-500 to-pink-600"
                title={isJa ? "採点・自動赤入れ" : "AI grading & markup"}
                desc={isJa ? "答案画像 → AI採点 → TikZ オーバーレイ赤入れ PDF を生成。" : "Answer images → AI grading → marked-up PDF with TikZ overlay."}
              />
              <ProWorkflowCard
                icon={<Layers className="h-4 w-4" strokeWidth={1.6} />}
                color="bg-gradient-to-br from-violet-500 to-fuchsia-600"
                title={isJa ? "バッチ量産 100〜300 行" : "Batch generate 100–300 rows"}
                desc={isJa ? "CSV の変数データからクラス別・生徒別 PDF を一括出力。" : "Generate per-student or per-class PDFs from CSV variables."}
              />
            </div>
          </div>

          {/* Workflow 下の主要 CTA — ユーザー状態に応じてラベル/動作が切り替わる */}
          <div className="text-center mt-12">
            <button
              onClick={primaryCta.onClick}
              className="group inline-flex items-center gap-3 px-10 py-4 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 text-white font-bold text-[14px] shadow-2xl shadow-blue-500/25 hover:shadow-blue-500/35 hover:scale-[1.03] active:scale-[0.98] transition-all duration-300"
            >
              {primaryCta.variant === "resume"
                ? (isJa ? "このワークフローで続きから編集" : "Continue with this workflow")
                : primaryCta.variant === "paid-new"
                ? (isJa ? "このワークフローで1枚作ってみる" : "Run this workflow now")
                : (isJa ? "このワークフローを無料で試す" : "Try this workflow free")}
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
            </button>
            <p className="text-[12px] text-muted-foreground/50 mt-3">
              {isJa
                ? "アップロード・画像・テキスト、どれからでもスタートできます。"
                : "Start from PDF, photo, or plain text — your choice."}
            </p>
          </div>
        </div>
      </section>

      {/* ━━ Figure Drawing — Free でも使える図形描画 ━━
          AI 生成だけでは伝わらない「TikZ 図形を直接描ける」差別化ポイント。
          回路・幾何・力学・化学・生物まで対応する domain palette が無料プランで利用可能。 */}
      <section className="relative py-24 overflow-hidden border-t border-foreground/[0.04]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(16,185,129,0.06),transparent_70%)]" />
        <div className="relative max-w-5xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.22em] uppercase mb-3">
              <span className="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
                {isJa ? "図形描画モード" : "Figure mode"}
              </span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[9.5px] font-extrabold tracking-wider shadow-sm shadow-emerald-500/30">
                <Check className="h-2.5 w-2.5" />
                FREE
              </span>
            </p>
            <h2 className="text-[clamp(1.5rem,3.6vw,2.4rem)] font-bold tracking-tight mb-3">
              {isJa ? "図も、Free で描ける。" : "Draw figures, free of charge."}
            </h2>
            <p className="text-muted-foreground text-[14px] sm:text-[15px] max-w-xl mx-auto leading-relaxed">
              {isJa
                ? "回路図・力学・幾何・化学・生物・フローチャートまで。専用の図形パレットで、TikZ コードを書かずに教材用の図を直感的に描けます。無料プランで制限なく利用可能。"
                : "Circuits, mechanics, geometry, chemistry, biology, flowcharts. A built-in shape palette lets you draw textbook-quality figures without writing TikZ — and it's all free."}
            </p>
          </div>

          <FigureDrawMockup isJa={isJa} />

          {/* 補足チップ — 何が描けるかを列挙 (SEO 兼 ユーザー安心材料) */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-7">
            {(isJa
              ? ["回路図 (Circuitikz)", "力学・てこ・ばね", "幾何・座標・関数", "化学式・分子", "生物・細胞", "フローチャート"]
              : ["Circuits (Circuitikz)", "Mechanics", "Geometry & functions", "Chemistry", "Biology", "Flowcharts"]
            ).map((label) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/[0.06] border border-emerald-500/20 text-[11px] text-emerald-700 dark:text-emerald-300 font-medium"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ━━ Features ━━ */}
      <section className="relative py-24 overflow-hidden border-t border-foreground/[0.04]">
        <div
          ref={featuresFade.ref}
          className={`relative max-w-5xl mx-auto px-6 transition-all duration-1000 ${featuresFade.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          <div className="text-center mb-16">
            <p className="text-[11px] font-bold tracking-[0.25em] uppercase bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent mb-4">
              {isJa ? "Eddivom の機能" : "Eddivom features"}
            </p>
            <h2 className="text-[clamp(1.5rem,4vw,2.5rem)] font-bold tracking-tight mb-4">
              {isJa ? "問題作成から配布まで、全部ここで。" : "Everything between \"I need a worksheet\" and \"it's printing.\""}
            </h2>
            <p className="text-muted-foreground text-[15px] max-w-md mx-auto">
              {isJa ? "LaTeXの知識は不要。Eddivom が数式をきれいに仕上げます。" : "No LaTeX knowledge needed. Eddivom handles the typesetting."}
            </p>
          </div>

          {/* Big 3 cards — プラン整合性のため各カードに利用可能プランを明示 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
            {[
              {
                icon: <Upload className="h-6 w-6" strokeWidth={1.5} />,
                gradient: "from-blue-500 to-cyan-500",
                shadow: "shadow-blue-500/20",
                title: isJa ? "PDF・画像から教材を再利用" : "Reuse your existing worksheets",
                desc: isJa
                  ? "既存の教材PDF・過去問・画像をアップロードするだけ。問題を自動で認識・抽出し、そのまま編集できます。"
                  : "Upload a PDF you already made or a past exam photo. Problems are auto-extracted — equations intact — and ready to edit.",
                // OCR は Pro+ なので明示
                planBadge: "pro" as const,
              },
              {
                icon: <PenLine className="h-6 w-6" strokeWidth={1.5} />,
                gradient: "from-emerald-500 to-teal-500",
                shadow: "shadow-emerald-500/20",
                title: isJa ? "問題ごとにWord感覚で編集" : "Edit problem by problem",
                desc: isJa
                  ? "数式・選択肢・配点・解説をクリックして直接編集。問題の入れ替え・並べ替えも自在です。"
                  : "Click any equation, answer choice, or point value and just type. Reorder and rearrange problems freely.",
                planBadge: "free" as const,
              },
              {
                icon: <Copy className="h-6 w-6" strokeWidth={1.5} />,
                gradient: "from-violet-500 to-fuchsia-500",
                shadow: "shadow-violet-500/20",
                title: isJa ? "類題を即座に量産" : "Spin up variants instantly",
                desc: isJa
                  ? "1問から数値・条件・難易度を変えたバリエーションを一括生成。演習量を一気に増やせます。"
                  : "One problem becomes five — or fifty. Different numbers, different difficulty, same skill.",
                planBadge: "free" as const,
              },
            ].map((f) => (
              <div
                key={f.title}
                className="group relative p-7 rounded-[20px] bg-card/70 backdrop-blur-xl border border-foreground/[0.05] hover:border-foreground/[0.1] hover:shadow-2xl hover:-translate-y-1 transition-all duration-500"
              >
                {/* 利用プランバッジ */}
                {f.planBadge === "pro" ? (
                  <span className="absolute top-4 right-4 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-to-r from-blue-500/12 to-violet-500/12 border border-violet-500/30 text-[10px] font-bold text-violet-700 dark:text-violet-300">
                    <Crown className="h-2.5 w-2.5" />
                    {isJa ? "Pro〜" : "Pro+"}
                  </span>
                ) : (
                  <span className="absolute top-4 right-4 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/12 border border-emerald-500/30 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                    {isJa ? "Freeでも" : "Free"}
                  </span>
                )}
                <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${f.gradient} flex items-center justify-center mb-6 text-white shadow-lg ${f.shadow} group-hover:scale-110 group-hover:shadow-xl transition-all duration-500`}>
                  {f.icon}
                </div>
                <h4 className="text-[15px] font-semibold mb-2.5 tracking-tight">{f.title}</h4>
                <p className="text-[12px] text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Smaller 3 cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              {
                icon: <CheckSquare className="h-5 w-5" strokeWidth={1.5} />,
                gradient: "from-amber-500 to-orange-500",
                title: isJa ? "解答付きPDFをワンクリック" : "Answer key included automatically",
                desc: isJa ? "生徒用と解答付きの2種類をボタン一つで書き出し。採点・配布がすぐできます。" : "Student version and answer key export separately with one click.",
              },
              {
                icon: <Printer className="h-5 w-5" strokeWidth={1.5} />,
                gradient: "from-slate-500 to-zinc-500",
                title: isJa ? "印刷に強いA4/B5レイアウト" : "Print-ready, every time",
                desc: isJa ? "プロ品質の組版で印刷配布に最適。余白・フォント・レイアウトも調整可能。" : "Professional typesetting with clean margins and crisp equations. Prints beautifully.",
              },
              {
                icon: <Sparkles className="h-5 w-5" strokeWidth={1.5} />,
                gradient: "from-pink-500 to-rose-500",
                title: isJa ? "テキストからも問題を生成" : "Generate problems from scratch",
                desc: isJa ? "「二次方程式を5問」のように指示するだけで問題を自動生成。ゼロからでも始められます。" : "Type \"10 factoring problems, medium difficulty\" and get a full worksheet.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="group relative p-6 rounded-[18px] bg-card/50 backdrop-blur-xl border border-foreground/[0.05] hover:border-foreground/[0.1] hover:shadow-lg hover:-translate-y-0.5 transition-all duration-500"
              >
                <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${f.gradient} flex items-center justify-center mb-4 text-white shadow-md group-hover:scale-110 transition-all duration-500`}>
                  {f.icon}
                </div>
                <h4 className="text-[13px] font-semibold mb-1.5 tracking-tight">{f.title}</h4>
                <p className="text-[11.5px] text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━ Differentiation ━━ */}
      <section className="relative py-24 border-t border-foreground/[0.04] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,hsl(var(--primary)/0.02),transparent_70%)]" />
        <div
          ref={diffFade.ref}
          className={`relative max-w-4xl mx-auto px-6 transition-all duration-1000 ${diffFade.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          <div className="text-center mb-14">
            <h2 className="text-[clamp(1.3rem,3.5vw,2.1rem)] font-bold tracking-tight mb-4">
              {isJa ? "Canva でもない、Overleaf でもない。" : "Canva can't do equations. Overleaf is overkill."}
            </h2>
            <p className="text-muted-foreground text-[15px] max-w-lg mx-auto">
              {isJa
                ? "Eddivom は、数式教材の「運用」を速くする専用ツールです。"
                : "Eddivom sits right in between — built specifically for math worksheet workflows."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl border border-foreground/[0.05] bg-foreground/[0.01] opacity-70">
              <p className="text-[11px] text-muted-foreground/50 font-bold tracking-wider uppercase mb-4">
                {isJa ? "テンプレ系ツール" : "Canva / Google Docs"}
              </p>
              <ul className="space-y-2.5 text-[12px] text-muted-foreground/50">
                <li className="flex items-center gap-2"><span className="text-red-400/70 font-bold">✕</span> {isJa ? "数式の細かい編集が難しい" : "Equations break or look ugly"}</li>
                <li className="flex items-center gap-2"><span className="text-red-400/70 font-bold">✕</span> {isJa ? "問題単位で管理できない" : "No per-problem management"}</li>
                <li className="flex items-center gap-2"><span className="text-red-400/70 font-bold">✕</span> {isJa ? "類題生成ができない" : "No variant generation"}</li>
                <li className="flex items-center gap-2"><span className="text-red-400/70 font-bold">✕</span> {isJa ? "解答PDFの自動生成なし" : "Answer key? Build it by hand"}</li>
              </ul>
            </div>

            <div className="p-6 rounded-2xl border-2 border-violet-500/25 bg-gradient-to-b from-violet-500/[0.04] to-blue-500/[0.04] shadow-xl shadow-violet-500/[0.08] relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="text-[10px] px-3 py-0.5 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 text-white font-bold shadow-lg">
                  {isJa ? "おすすめ" : "Best choice"}
                </span>
              </div>
              <p className="text-[11px] font-black tracking-wider uppercase mb-4 bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent">
                Eddivom
              </p>
              <ul className="space-y-2.5 text-[12px] text-foreground/80 font-medium">
                <li className="flex items-center gap-2"><span className="text-emerald-500 font-bold">✓</span> {isJa ? "PDF・画像から問題を再利用" : "Import from your existing PDFs"}</li>
                <li className="flex items-center gap-2"><span className="text-emerald-500 font-bold">✓</span> {isJa ? "問題ごとに編集・並べ替え" : "Edit each problem individually"}</li>
                <li className="flex items-center gap-2"><span className="text-emerald-500 font-bold">✓</span> {isJa ? "類題を1クリックで量産" : "Generate variants in one click"}</li>
                <li className="flex items-center gap-2"><span className="text-emerald-500 font-bold">✓</span> {isJa ? "生徒用 + 解答付きPDF出力" : "Auto answer-key PDF export"}</li>
                <li className="flex items-center gap-2"><span className="text-emerald-500 font-bold">✓</span> {isJa ? "印刷に最適な組版品質" : "Equations that actually look right"}</li>
              </ul>
            </div>

            <div className="p-6 rounded-2xl border border-foreground/[0.05] bg-foreground/[0.01] opacity-70">
              <p className="text-[11px] text-muted-foreground/50 font-bold tracking-wider uppercase mb-4">
                {isJa ? "LaTeX専用ツール" : "Overleaf / LaTeX"}
              </p>
              <ul className="space-y-2.5 text-[12px] text-muted-foreground/50">
                <li className="flex items-center gap-2"><span className="text-red-400/70 font-bold">✕</span> {isJa ? "LaTeXの知識が必須" : "You need to learn LaTeX first"}</li>
                <li className="flex items-center gap-2"><span className="text-red-400/70 font-bold">✕</span> {isJa ? "問題単位の管理がない" : "No per-problem structure"}</li>
                <li className="flex items-center gap-2"><span className="text-red-400/70 font-bold">✕</span> {isJa ? "類題の自動生成なし" : "No auto variant generation"}</li>
                <li className="flex items-center gap-2"><span className="text-red-400/70 font-bold">✕</span> {isJa ? "教材ワークフロー非対応" : "Way more power than you need"}</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ━━ Pricing ━━ */}
      <section id="pricing" className="relative py-28 overflow-hidden border-t border-foreground/[0.04]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_30%,hsl(var(--primary)/0.04),transparent_70%)]" />
        <div
          ref={pricingFade.ref}
          className={`relative max-w-[1400px] mx-auto px-6 transition-all duration-1000 ${pricingFade.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          {/* Section header — 見出しは読みやすさ優先で max-w を絞る */}
          <div className="text-center mb-14 max-w-3xl mx-auto">
            <p className="text-[11px] font-bold tracking-[0.25em] uppercase bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent mb-4">
              {isJa ? "料金プラン" : "Pricing"}
            </p>
            <h2 className="text-[clamp(1.5rem,4vw,2.6rem)] font-bold tracking-tight mb-4">
              {isJa ? "授業1コマ分以下で、教材作成を自動化。" : "Automate your worksheets for less than one tutoring hour."}
            </h2>
            <p className="text-muted-foreground text-[15px] max-w-xl mx-auto mb-6">
              {isJa
                ? "AI回数・テンプレート数・採点やOMRなど、プランごとに使える機能が変わります。まず無料で試して、必要な機能が増えたらアップグレード。"
                : "Each plan unlocks different AI limits, templates, grading, OMR and more. Start free — upgrade when you need the next tier of features."}
            </p>
            {/* 機能差別化バッジ */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-blue-500/10 to-violet-500/10 border border-blue-500/15">
              <Sparkles className="h-3.5 w-3.5 text-violet-500" />
              <span className="text-[12px] font-semibold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
                {isJa ? "AI回数 × 機能解放 でプランを選ぶ" : "Choose by AI limits × unlocked features"}
              </span>
            </div>
          </div>

          {/* Plans grid — monthly only。モーダルと同じ 1400px 級の広さにして日本語が潰れないようにする */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-[1340px] mx-auto">
            {/* Free */}
            <div className="relative p-6 rounded-[20px] bg-card/70 backdrop-blur-xl border border-foreground/[0.06] hover:border-foreground/[0.1] transition-all duration-300">
              <p className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground/50 mb-1">Free</p>
              <p className="text-[11px] text-muted-foreground/60 mb-3">{isJa ? "まずは体験してみたい方に" : "Try before you commit"}</p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-[32px] font-black tracking-tight">¥0</span>
              </div>
              <p className="text-[12px] text-muted-foreground mb-5">{isJa ? "ずっと無料・カード登録不要" : "Free forever · No card required"}</p>
              <button
                onClick={() => handlePlanSelect("free")}
                className="w-full py-2.5 rounded-xl border border-foreground/[0.1] text-foreground font-semibold text-[13px] hover:bg-foreground/[0.04] transition-all duration-300 mb-5"
              >
                {isJa ? "無料で始める" : "Get started free"}
              </button>
              <ul className="space-y-2.5">
                {[
                  isJa ? "高性能AI 月3回" : "Premium AI: 3 / month",
                  isJa ? "教材PDF出力 月1回" : "Worksheet PDF: 1 / month",
                  isJa ? "基本テンプレート 6種類" : "6 basic templates",
                  isJa ? "TikZ図の作成・保存 無制限" : "Unlimited TikZ figures",
                  isJa ? "リアルタイムプレビュー" : "Real-time preview",
                  isJa ? "思考ログ表示" : "Thinking log display",
                ].map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-[12.5px] leading-relaxed text-muted-foreground"
                    style={{ wordBreak: "keep-all", overflowWrap: "break-word" }}
                  >
                    <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Starter — entry paid tier */}
            <div className="relative p-6 rounded-[20px] bg-card/70 backdrop-blur-xl border border-emerald-500/[0.2] hover:border-emerald-500/[0.35] transition-all duration-300">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/95 text-white font-bold shadow">
                  {isJa ? "手軽に始める" : "Easy start"}
                </span>
              </div>
              <p className="text-[11px] font-bold tracking-wider uppercase text-emerald-600 dark:text-emerald-400 mb-1">Starter</p>
              <p className="text-[11px] text-muted-foreground/60 mb-3">{isJa ? "個人塾・家庭教師の方に" : "For individual tutors"}</p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-[32px] font-black tracking-tight">¥1,980</span>
                <span className="text-[13px] text-muted-foreground font-medium">/ {isJa ? "月" : "mo"}</span>
              </div>
              <p className="text-[12px] text-muted-foreground mb-1">{isJa ? "月払い · いつでも解約OK" : "Billed monthly · Cancel anytime"}</p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mb-5">
                {isJa ? "1日あたり約¥66 — コーヒー1杯以下" : "~¥66/day — less than a coffee"}
              </p>
              {(() => {
                const s = planButtonState(currentPlan, "starter");
                const disabled = s !== "upgrade";
                return (
                  <button
                    onClick={() => handlePlanSelect("starter")}
                    disabled={disabled}
                    className={`w-full py-2.5 rounded-xl font-bold text-[13px] shadow transition-all duration-300 mb-5 ${
                      disabled
                        ? "bg-foreground/[0.06] text-foreground/40 cursor-not-allowed"
                        : "bg-emerald-500/95 text-white hover:bg-emerald-600 hover:scale-[1.02] active:scale-[0.98]"
                    }`}
                  >
                    {s === "current" ? (isJa ? "現在のプラン" : "Current plan")
                      : s === "lower" ? (isJa ? "より上位のプランをご契約中" : "On a higher plan")
                      : (isJa ? "Starterにアップグレード" : "Upgrade to Starter")}
                  </button>
                );
              })()}
              {/* Free の全機能 + 追加 */}
              <div className="flex items-center gap-1.5 mb-3 px-2.5 py-1.5 rounded-lg bg-foreground/[0.04] border border-foreground/[0.06] text-[11.5px] font-semibold">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" strokeWidth={3} />
                <span>{isJa ? "Freeの全機能 を含む" : "Everything in Free"}</span>
              </div>
              <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] mb-2.5 text-emerald-600 dark:text-emerald-400">
                {isJa ? "＋ さらに追加で解放:" : "＋ Plus, unlocks:"}
              </div>
              <ul className="space-y-2.5">
                {[
                  isJa ? "高性能AI 月150回に拡張 (Freeの50倍・1日15回)" : "Premium AI boosted to 150 / month (50× Free, 15 / day)",
                  isJa ? "教材PDF出力 無制限 (Freeは月1回まで)" : "Unlimited Worksheet PDF (Free is 1 / month)",
                  isJa ? "LaTeXソースエクスポート" : "LaTeX source export",
                ].map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-[12.5px] leading-relaxed text-foreground/85 font-medium"
                    style={{ wordBreak: "keep-all", overflowWrap: "break-word" }}
                  >
                    <span className="shrink-0 mt-0.5 h-4 w-4 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                      <Plus className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Pro — most popular */}
            <div className="relative p-6 rounded-[20px] bg-gradient-to-b from-violet-500/[0.06] to-blue-500/[0.03] border-2 border-violet-500/[0.25] shadow-2xl shadow-violet-500/[0.08] hover:shadow-violet-500/[0.15] transition-all duration-300">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="text-[10px] px-3 py-0.5 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 text-white font-bold shadow-lg flex items-center gap-1">
                  <Crown className="h-3 w-3" />
                  {isJa ? "人気 No.1" : "Most Popular"}
                </span>
              </div>
              <p className="text-[11px] font-bold tracking-wider uppercase bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent mb-1">Pro</p>
              <p className="text-[11px] text-muted-foreground/60 mb-3">{isJa ? "毎日使うならこのプラン" : "Best for daily use"}</p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-[32px] font-black tracking-tight">¥4,980</span>
                <span className="text-[13px] text-muted-foreground font-medium">/ {isJa ? "月" : "mo"}</span>
              </div>
              <p className="text-[12px] text-muted-foreground mb-1">{isJa ? "月払い · いつでも解約OK" : "Billed monthly · Cancel anytime"}</p>
              <p className="text-[11px] bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent font-medium mb-5">
                {isJa ? "Starterの3倍以上 — 1日あたり約¥166" : "3× more than Starter — ~¥166/day"}
              </p>
              {(() => {
                const s = planButtonState(currentPlan, "pro");
                const disabled = s !== "upgrade";
                return (
                  <button
                    onClick={() => handlePlanSelect("pro")}
                    disabled={disabled}
                    className={`w-full py-2.5 rounded-xl font-bold text-[13px] shadow-lg transition-all duration-300 mb-5 ${
                      disabled
                        ? "bg-foreground/[0.06] text-foreground/40 cursor-not-allowed shadow-none"
                        : "bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-violet-500/25 hover:shadow-violet-500/40 hover:scale-[1.02] active:scale-[0.98]"
                    }`}
                  >
                    {s === "current" ? (isJa ? "現在のプラン" : "Current plan")
                      : s === "lower" ? (isJa ? "より上位のプランをご契約中" : "On a higher plan")
                      : (isJa ? "Proにアップグレード" : "Upgrade to Pro")}
                  </button>
                );
              })()}
              {/* Starter の全機能 + 追加 */}
              <div className="flex items-center gap-1.5 mb-3 px-2.5 py-1.5 rounded-lg bg-foreground/[0.04] border border-foreground/[0.06] text-[11.5px] font-semibold">
                <Check className="h-3.5 w-3.5 text-violet-500 shrink-0" strokeWidth={3} />
                <span>{isJa ? "Starterの全機能 を含む" : "Everything in Starter"}</span>
              </div>
              <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] mb-2.5 bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
                {isJa ? "＋ さらに追加で解放:" : "＋ Plus, unlocks:"}
              </div>
              <ul className="space-y-2.5">
                {[
                  isJa ? "高性能AI 月500回に拡張 (Starterの3.3倍・1日40回)" : "Premium AI boosted to 500 / month (3.3× Starter, 40 / day)",
                  isJa ? "Pro テンプレ 6種を解放 (共通テスト / 国公立二次 / 塾プリント / 英語 / 技術報告書 / プレゼン)" : "Unlocks 6 Pro templates (national exam / 2nd-stage / cram / reading / tech report / slides)",
                  isJa ? "採点・自動採点 (OMR)" : "Grading & auto-scoring (OMR)",
                  isJa ? "PDF・画像取り込み (OCR)" : "PDF & image import (OCR)",
                  isJa ? "バッチ処理 (最大100行)" : "Batch processing (up to 100 rows)",
                  isJa ? "PDF出力 優先処理" : "Priority PDF rendering",
                ].map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-[12.5px] leading-relaxed text-foreground/85 font-medium"
                    style={{ wordBreak: "keep-all", overflowWrap: "break-word" }}
                  >
                    <span className="shrink-0 mt-0.5 h-4 w-4 rounded-full bg-violet-500/10 text-violet-500 flex items-center justify-center">
                      <Plus className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Premium */}
            <div className="relative p-6 rounded-[20px] bg-gradient-to-b from-amber-500/[0.08] to-orange-500/[0.04] border-2 border-amber-400/[0.3] shadow-2xl shadow-amber-500/[0.08] hover:shadow-amber-500/[0.15] transition-all duration-300">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="text-[10px] px-3 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold shadow-lg flex items-center gap-1">
                  <Crown className="h-3 w-3" />
                  {isJa ? "最上位プラン" : "Top Tier"}
                </span>
              </div>
              <p className="text-[11px] font-bold tracking-wider uppercase bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent mb-1">Premium</p>
              <p className="text-[11px] text-muted-foreground/60 mb-3">{isJa ? "教育機関・大量利用に" : "For schools & heavy use"}</p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-[36px] font-black tracking-tight">¥19,800</span>
                <span className="text-[13px] text-muted-foreground font-medium">/ {isJa ? "月" : "mo"}</span>
              </div>
              <p className="text-[12px] text-muted-foreground mb-1">{isJa ? "月払い · いつでも解約OK" : "Billed monthly · Cancel anytime"}</p>
              <p className="text-[11px] bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent font-medium mb-5">
                {isJa ? "Proの4倍 — 講師1人分の人件費以下" : "4× more than Pro — less than hiring one tutor"}
              </p>
              {(() => {
                const s = planButtonState(currentPlan, "premium");
                const disabled = s !== "upgrade";
                return (
                  <button
                    onClick={() => handlePlanSelect("premium")}
                    disabled={disabled}
                    className={`w-full py-2.5 rounded-xl font-bold text-[13px] shadow-lg transition-all duration-300 mb-5 ${
                      disabled
                        ? "bg-foreground/[0.06] text-foreground/40 cursor-not-allowed shadow-none"
                        : "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.02] active:scale-[0.98]"
                    }`}
                  >
                    {s === "current" ? (isJa ? "現在のプラン" : "Current plan")
                      : (isJa ? "Premiumにアップグレード" : "Upgrade to Premium")}
                  </button>
                );
              })()}
              {/* Pro の全機能 + 追加 */}
              <div className="flex items-center gap-1.5 mb-3 px-2.5 py-1.5 rounded-lg bg-foreground/[0.04] border border-foreground/[0.06] text-[11.5px] font-semibold">
                <Check className="h-3.5 w-3.5 text-amber-500 shrink-0" strokeWidth={3} />
                <span>{isJa ? "Proの全機能 を含む" : "Everything in Pro"}</span>
              </div>
              <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] mb-2.5 bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                {isJa ? "＋ さらに追加で解放:" : "＋ Plus, unlocks:"}
              </div>
              <ul className="space-y-2.5">
                {[
                  isJa ? "高性能AI 月2,000回に拡張 (Proの4倍・1日150回)" : "Premium AI boosted to 2,000 / month (4× Pro, 150 / day)",
                  isJa ? "Premium 限定テンプレ 6 種を解放 (卒論・修論 / 総合模試冊子 / 学会ポスター / 学術論文 / 問題集 / 教科書)" : "Unlocks 6 Premium-only templates (Thesis / Full mock-exam / Academic poster / Journal paper / Problem book / Textbook)",
                  isJa ? "バッチ処理 最大300行に拡張 (Proの3倍)" : "Batch processing boosted to 300 rows (3× Pro)",
                  isJa ? "PDF出力 最優先処理" : "Highest-priority PDF rendering",
                ].map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-[12.5px] leading-relaxed text-foreground/85 font-medium"
                    style={{ wordBreak: "keep-all", overflowWrap: "break-word" }}
                  >
                    <span className="shrink-0 mt-0.5 h-4 w-4 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
                      <Plus className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Trust signals */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 mt-10">
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground/50">
              <Shield className="h-3.5 w-3.5" />
              {isJa ? "Stripeによる安全な決済" : "Secure payment via Stripe"}
            </div>
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground/50">
              <Check className="h-3.5 w-3.5" />
              {isJa ? "いつでもキャンセル可能" : "Cancel anytime"}
            </div>
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground/50">
              <FileDown className="h-3.5 w-3.5" />
              {isJa ? "領収書発行対応" : "Receipts available"}
            </div>
          </div>
        </div>
      </section>

      {/* ━━ Power-user reveal ━━ */}
      <section className="relative py-14 border-t border-foreground/[0.04]">
        <div
          ref={powerFade.ref}
          className={`relative max-w-3xl mx-auto px-6 transition-all duration-1000 ${powerFade.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
        >
          <button
            onClick={() => setPowerOpen((v) => !v)}
            className="w-full flex items-center justify-between px-6 py-5 rounded-2xl bg-foreground/[0.02] dark:bg-white/[0.03] border border-foreground/[0.05] hover:border-foreground/[0.1] transition-all duration-300 group"
          >
            <div className="flex items-center gap-4">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-gray-700 to-gray-900 dark:from-gray-600 dark:to-gray-800 flex items-center justify-center shadow-md">
                <Code2 className="h-4 w-4 text-gray-300" strokeWidth={1.5} />
              </div>
              <div className="text-left">
                <p className="text-[13px] font-semibold tracking-tight">
                  {isJa ? "上級者向け — LaTeXも直接触れる" : "Power users — full LaTeX under the hood"}
                </p>
                <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                  {isJa ? "必要なときだけ。LaTeX・回路図・化学式・カスタムパッケージ対応" : "You don't need it. But if you know LaTeX, you can fine-tune anything"}
                </p>
              </div>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground/40 transition-transform duration-300 ${powerOpen ? "rotate-180" : ""}`} />
          </button>

          <div className={`overflow-hidden transition-all duration-500 ${powerOpen ? "max-h-96 opacity-100 mt-4" : "max-h-0 opacity-0"}`}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-1">
              {[
                { label: isJa ? "LaTeX直接編集" : "Direct LaTeX edit", icon: "{ }" },
                { label: isJa ? "回路図 (TikZ)" : "Circuits (TikZ)", icon: "⚡" },
                { label: isJa ? "化学式" : "Chemistry", icon: "⚗" },
                { label: isJa ? "カスタムパッケージ" : "Custom packages", icon: "📦" },
              ].map((item) => (
                <div key={item.label} className="flex flex-col items-center gap-2 p-5 rounded-xl bg-foreground/[0.02] border border-foreground/[0.04] hover:border-foreground/[0.08] text-center transition-colors">
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-[11px] text-muted-foreground leading-tight">{item.label}</span>
                </div>
              ))}
            </div>
            <p className="text-center text-[11px] text-muted-foreground/35 mt-5 px-4">
              {isJa
                ? "知らなくても使える。知っていれば Eddivom はもっと自由に。"
                : "You don't need to know it. But if you do, Eddivom goes even further."}
            </p>
          </div>
        </div>
      </section>

      {/* ━━ FAQ ━━
          ロングテールキーワードでの流入と検索結果のリッチリザルト獲得を狙う。
          ここに表示している Q&A は app/layout.tsx の FAQPage JSON-LD と完全一致させる必要がある。
          内容を変更する場合は両方を同時に更新すること。 */}
      <section className="relative py-24 overflow-hidden border-t border-foreground/[0.04]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,hsl(var(--primary)/0.025),transparent_70%)]" />
        <div
          ref={faqFade.ref}
          className={`relative max-w-3xl mx-auto px-6 transition-all duration-1000 ${faqFade.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
        >
          <div className="text-center mb-12">
            <p className="text-[11px] font-bold tracking-[0.25em] uppercase bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent mb-3">
              {isJa ? "よくある質問" : "FAQ"}
            </p>
            <h2 className="text-[clamp(1.5rem,3.6vw,2.4rem)] font-bold tracking-tight">
              {isJa ? "気になるところに、先にお答えします。" : "Quick answers, before you ask."}
            </h2>
          </div>

          <div className="flex flex-col gap-3">
            <FAQItem
              question={isJa ? "AI で問題集を自動生成できますか？" : "Can AI generate practice problems automatically?"}
              answer={isJa
                ? "はい。Eddivom はチャットで「二次関数の問題を10題」のように依頼するだけで、AIがLaTeX組版で問題を自動生成します。難易度や範囲・分野・問題数を自然言語で指定でき、生成と同時にPDFプレビューが更新されます。"
                : "Yes. Just ask in chat — “10 quadratic equation problems, harder difficulty.” Eddivom generates problems in LaTeX and updates the PDF preview live. You can specify topic, difficulty, count, and scope in plain language."}
            />
            <FAQItem
              question={isJa ? "解答付きPDFは自動で作成されますか？" : "Are answer-key PDFs generated automatically?"}
              answer={isJa
                ? "はい。問題ページと解答ページがセットになったPDFを自動で書き出します。模範解答だけでなく略解・配点バッジ・解説の有無も指定でき、A4/B5の印刷に最適化されます。"
                : "Yes. Eddivom exports a paired PDF with the worksheet and a separate answer key. You can choose between full solutions, brief answers, point-value badges, and explanation toggles. Output is print-ready for A4/B5."}
            />
            <FAQItem
              question={isJa ? "数学プリント作成ソフトとして無料で使えますか？" : "Is it free to use as a math worksheet maker?"}
              answer={isJa
                ? "無料プランで会員登録なしに利用を開始できます。AI生成回数とPDF出力数に上限がありますが、数式・図・化学式の組版や直接編集は無料プランでも利用できます。"
                : "Yes — the free plan needs no signup. AI generations and PDF exports are quota-limited, but math/diagram/chemistry typesetting and direct editing are fully available on the free tier."}
            />
            <FAQItem
              question={isJa ? "Overleaf との違いは何ですか？" : "How is this different from Overleaf?"}
              answer={isJa
                ? "Overleafは汎用LaTeXエディタですが、Eddivomは教材作成に特化したIDEです。AIによる問題自動生成・類題量産・解答付きPDFの自動構成・採点など、Overleafにはない教材作成専用フローを最初から備えています。日本語UIと日本語フォント (haranoaji) も初期設定済みです。"
                : "Overleaf is a general-purpose LaTeX editor; Eddivom is an IDE built specifically for worksheet creation. AI problem generation, variant multiplication, answer-key composition, and grading flows are first-class — none of which exist in Overleaf. Japanese UI and Japanese fonts (haranoaji) are preconfigured."}
            />
            <FAQItem
              question={isJa ? "1つの問題から類題を自動で量産できますか？" : "Can it generate variants from one problem?"}
              answer={isJa
                ? "はい。既存の問題にカーソルを当てて「類題を5問」と依頼すると、係数や設定を変えた類題をAIが生成します。難易度を一段上げる・下げるといった指示にも対応しています。"
                : "Yes. Place the cursor on an existing problem and ask for “5 variants” — the AI rewrites coefficients and parameters while preserving structure. You can also tell it to nudge difficulty up or down."}
            />
            <FAQItem
              question={isJa ? "高校数学の確認テストや塾の教材作成にも使えますか？" : "Is it suitable for high-school quizzes and tutor worksheets?"}
              answer={isJa
                ? "はい。共通テスト風レイアウト・国公立二次風・学校用テスト・問題集など、高校数学の確認テスト作成や塾の教材作成に最適化されたテンプレートを多数収録しています。配点バッジや大問ボックスなど、紙に印刷したときに読みやすい体裁を初期設定で実現します。"
                : "Yes. We ship templates tuned for Japanese national exam style, university second-stage exam style, in-class quizzes, and problem sets. Point-value badges and big-question frames render cleanly on paper out of the box."}
            />
            <FAQItem
              question={isJa ? "ルーブリック採点機能はどう使いますか？" : "How does the rubric grading feature work?"}
              answer={isJa
                ? "Pro プランでは、答案画像をアップロードするとAIが採点項目ごとに○×と部分点を提案します。採点基準 (ルーブリック) は教員が編集でき、最終的な点数調整は人が行えます。OMR (マークシート) 採点も同じ画面から実行可能です。"
                : "On the Pro plan you upload student answer images and the AI scores each rubric item with partial credit. Teachers edit the rubric and make the final call. OMR (multiple-choice bubble) grading is supported from the same screen."}
            />
            <FAQItem
              question={isJa ? "既存のPDFや画像から問題を取り込めますか？" : "Can it import problems from an existing PDF or image?"}
              answer={isJa
                ? "はい。OCR機能で既存のテストPDFや教科書画像を読み取り、数式を含めてLaTeXに変換します。読み取った内容をベースに、Eddivom内で類題量産や解答生成までシームレスに行えます。"
                : "Yes. OCR reads existing exam PDFs and textbook images and converts them — equations included — into LaTeX. From there you can generate variants and answer keys without leaving Eddivom."}
            />
          </div>

          <p className="text-center text-[12px] text-muted-foreground/60 mt-10">
            {isJa
              ? "他にご質問があれば、"
              : "Have a different question? "}
            <a href="/contact" className="text-violet-500 hover:text-violet-600 underline-offset-4 hover:underline font-medium">
              {isJa ? "お問い合わせ" : "Contact us"}
            </a>
            {isJa ? " からお気軽にどうぞ。" : "."}
          </p>
        </div>
      </section>

      {/* ━━ CTA ━━ */}
      <section className="relative py-32 overflow-hidden border-t border-foreground/[0.04]">
        {/* Dramatic glow */}
        <div className="absolute inset-0 pointer-events-none">
          <GlowOrb className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-gradient-to-r from-blue-500/[0.07] via-violet-500/[0.08] to-fuchsia-500/[0.07]" />
          <div className="absolute inset-0 opacity-[0.01] dark:opacity-[0.02]"
            style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        </div>
        <div
          ref={ctaFade.ref}
          className={`relative max-w-2xl mx-auto text-center px-6 transition-all duration-1000 ${ctaFade.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          {/* Stars decoration */}
          <div className="flex items-center justify-center gap-0.5 mb-6">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
            ))}
            <span className="ml-2 text-[12px] text-muted-foreground/50">{isJa ? "教材作成 ✕ AI" : "Worksheet × AI"}</span>
          </div>

          <h2 className="text-[clamp(1.6rem,4.5vw,3rem)] font-bold tracking-tight mb-5 leading-tight">
            {currentPlan === "free"
              ? (isJa ? "Eddivom で、教材づくりを今夜から変えよう。" : "Try Eddivom tonight.\nYour worksheet will be done before bed.")
              : (isJa ? `${PLANS[currentPlan].name} プランをご利用中。教材に戻りましょう。` : `You're on ${PLANS[currentPlan].name}. Jump back into your worksheet.`)}
          </h2>
          <p className="text-muted-foreground text-[16px] mb-12 max-w-md mx-auto leading-relaxed">
            {currentPlan === "free"
              ? (isJa
                ? "無料で始めて、気に入ったらアップグレード。月¥1,980から。"
                : "Start free, upgrade when you're ready. From ¥1,980/mo.")
              : (isJa
                ? "保存した教材の続きから、または白紙から新しい1枚を。"
                : "Pick up where you left off, or start a fresh sheet.")}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={primaryCta.onClick}
              className="group relative inline-flex items-center gap-3 px-12 py-5 rounded-full font-bold text-[16px] text-white overflow-hidden shadow-2xl shadow-violet-500/30 hover:shadow-violet-500/50 hover:scale-[1.04] active:scale-[0.97] transition-all duration-300"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600" />
              <span className="absolute inset-0 bg-gradient-to-r from-blue-500 via-violet-500 to-fuchsia-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              {primaryCta.variant === "resume" && <FileText className="relative h-5 w-5" />}
              <span className="relative">{primaryCta.label}</span>
              <ArrowRight className="relative h-5 w-5 group-hover:translate-x-1 transition-transform duration-300" />
            </button>
            {currentPlan === "free" ? (
              <button
                onClick={scrollToPricing}
                className="group flex items-center gap-3 px-8 py-5 rounded-full border border-white/[0.15] text-foreground font-semibold text-[15px] hover:bg-foreground/[0.04] hover:border-foreground/[0.2] active:scale-[0.98] transition-all duration-300"
              >
                {isJa ? "料金プランを見る" : "See plans"}
                <ChevronRight className="h-4 w-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </button>
            ) : primaryCta.variant === "resume" ? (
              // 有料 + 保存あり: 白紙開始の副ボタン
              <button
                onClick={openEditorBlank}
                className="group flex items-center gap-3 px-8 py-5 rounded-full border border-foreground/[0.12] text-foreground font-semibold text-[15px] hover:bg-foreground/[0.04] hover:border-foreground/[0.2] active:scale-[0.98] transition-all duration-300"
              >
                {isJa ? "白紙で始める" : "Start blank"}
                <ChevronRight className="h-4 w-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </button>
            ) : (
              // 有料 + 保存なし: 料金プランは既に購読中なので、別導線として採点/OMR紹介等を将来入れる枠
              null
            )}
          </div>
          <p className="mt-5 text-[12px] text-muted-foreground/35">
            {primaryCta.subLabel}
          </p>
        </div>
      </section>

      {/* ━━ Footer ━━ */}
      <footer className="border-t border-foreground/[0.05] py-12">
        <div className="max-w-5xl mx-auto px-6">
          {/* ブランドロゴ + タグライン */}
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-600 via-violet-500 to-fuchsia-500 flex items-center justify-center shadow-sm">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
                  <path d="M5 6h10M5 12h7M5 18h10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                  <circle cx="18" cy="12" r="3" stroke="white" strokeWidth="2" fill="white" fillOpacity="0.3" />
                </svg>
              </div>
              <span className="text-[14px] font-bold tracking-tight opacity-60">Eddivom</span>
            </div>
            <p className="text-[11px] text-muted-foreground/40 tracking-wide">
              {isJa ? "AI教材作成IDE · Powered by LuaLaTeX" : "AI worksheet IDE · Powered by LuaLaTeX"}
            </p>
          </div>

          {/* 法的リンク行 — 日本向け順序: 料金 | お問い合わせ | 利用規約 | プライバシーポリシー | 特商法 | 返金ポリシー */}
          <nav
            className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mb-6 text-[12px] text-muted-foreground/70"
            aria-label={isJa ? "フッターナビゲーション" : "Footer navigation"}
          >
            <button
              type="button"
              onClick={scrollToPricing}
              className="hover:text-foreground transition-colors"
            >
              {isJa ? "料金" : "Pricing"}
            </button>
            <span className="text-muted-foreground/20">·</span>
            <a href="/contact" className="hover:text-foreground transition-colors">
              {isJa ? "お問い合わせ" : "Contact"}
            </a>
            <span className="text-muted-foreground/20">·</span>
            <a href="/terms" className="hover:text-foreground transition-colors">
              {isJa ? "利用規約" : "Terms"}
            </a>
            <span className="text-muted-foreground/20">·</span>
            <a href="/privacy" className="hover:text-foreground transition-colors">
              {isJa ? "プライバシーポリシー" : "Privacy"}
            </a>
            <span className="text-muted-foreground/20">·</span>
            <a href="/commerce" className="hover:text-foreground transition-colors">
              {isJa ? "特定商取引法に基づく表記" : "Commerce Disclosure"}
            </a>
            <span className="text-muted-foreground/20">·</span>
            <a href="/refunds" className="hover:text-foreground transition-colors">
              {isJa ? "返金ポリシー" : "Refunds"}
            </a>
          </nav>

          {/* コピーライト */}
          <p className="text-center text-[10.5px] text-muted-foreground/30 tracking-wide">
            © {new Date().getFullYear()} Eddivom. All rights reserved.
          </p>
        </div>
      </footer>

      <AnonymousTrialModal
        open={trialOpen}
        onOpenChange={setTrialOpen}
        onLoginRequested={handleTrialLoginRequested}
        alreadyUsed={trialAlreadyUsed}
      />
    </div>
  );
}
