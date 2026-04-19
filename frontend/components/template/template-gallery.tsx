"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDocumentStore } from "@/store/document-store";
import { createDefaultDocument } from "@/lib/types";
import { getTemplateLatex } from "@/lib/templates";
import { loadFromLocalStorage } from "@/lib/storage";
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
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      {FLOAT_FORMULAS.map((formula, i) => (
        <div
          key={i}
          className="absolute animate-float-formula"
          style={{
            left: `${(i * 17 + 5) % 92}%`,
            top: `${(i * 23 + 10) % 88}%`,
            animationDelay: `${i * 0.7}s`,
            animationDuration: `${20 + (i % 6) * 4}s`,
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

/* ── Step card ── */
function StepCard({ num, icon, title, desc, color }: {
  num: string; icon: React.ReactNode; title: string; desc: string; color: string;
}) {
  return (
    <div className="relative flex flex-col items-start gap-3 p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-foreground/[0.06] hover:border-foreground/[0.12] hover:shadow-xl hover:-translate-y-0.5 transition-all duration-400 group">
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
  const [tick, setTick] = useState(0);
  const CYCLE = 30000; // 30 s

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 100);
    return () => clearInterval(id);
  }, []);

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
    <div className="relative w-full max-w-4xl mx-auto" style={{ opacity }}>
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
          <p className="text-muted-foreground text-[15px] max-w-md mx-auto">
            {isJa
              ? "過去問・スキャン・古いPDF。何からでも始められます。"
              : "Start from any old worksheet, scan, or PDF — Eddivom handles the rest."}
          </p>
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


  const personaFade = useFadeIn(0);
  const mockupFade = useFadeIn(0);
  const workflowFade = useFadeIn(0);
  const featuresFade = useFadeIn(0);
  const diffFade = useFadeIn(0);
  const pricingFade = useFadeIn(0);
  const powerFade = useFadeIn(0);
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
      return {
        label: isJa ? "無料で始める" : "Get started free",
        subLabel: isJa ? "カード不要 · 30秒で最初の1枚" : "No credit card · First sheet in 30s",
        onClick: () => handlePlanSelect("free"),
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

      {/* ━━ Hero ━━ */}
      <section className="relative min-h-[100vh] flex items-center justify-center overflow-hidden">
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

        {/* Hero content */}
        <div className="relative z-10 max-w-3xl mx-auto text-center px-6 pt-20">
          <div className={`transition-all duration-1000 ease-out ${heroLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>

            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-blue-500/[0.08] to-violet-500/[0.08] border border-violet-500/[0.15] mb-8 shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-violet-500" />
              <span className="bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent text-[12px] font-bold tracking-wide">
                Eddivom — {isJa ? "AI教材作成IDE" : "AI-powered worksheet IDE"}
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-[clamp(2rem,5.5vw,4.8rem)] leading-[1.06] font-bold tracking-[-0.035em] mb-8 whitespace-nowrap">
              <TypingLine lines={heroTypingLines} />
            </h1>

            <p className="text-muted-foreground text-[17px] sm:text-[19px] leading-relaxed max-w-xl mx-auto mb-10 font-light">
              {isJa
                ? "AIが問題を生成し、類題を量産し、解答付きPDFを自動で作成。"
                : "AI generates problems, multiplies variants,\nand auto-creates answer-key PDFs."}
            </p>

            {/* CTAs — プランと保存状態に応じて文言・動作を変える */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              <button
                onClick={primaryCta.onClick}
                className="group relative flex items-center gap-3 px-9 py-4 rounded-full bg-foreground text-background font-bold text-[15px] shadow-2xl shadow-foreground/10 hover:shadow-foreground/20 hover:scale-[1.03] active:scale-[0.98] transition-all duration-300 overflow-hidden"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600 opacity-0 group-hover:opacity-[0.08] transition-opacity duration-300" />
                {primaryCta.variant === "resume" && <FileText className="h-4 w-4" />}
                {primaryCta.label}
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
              </button>
              {/* 有料 + 保存あり の場合は副ボタンに「白紙で始める」も出す */}
              {primaryCta.variant === "resume" && currentPlan !== "free" && (
                <button
                  onClick={openEditorBlank}
                  className="group flex items-center gap-3 px-7 py-4 rounded-full border border-foreground/[0.12] text-foreground font-medium text-[15px] hover:bg-foreground/[0.04] hover:border-foreground/[0.2] active:scale-[0.98] transition-all duration-300"
                >
                  {isJa ? "白紙で始める" : "Start blank"}
                  <ChevronRight className="h-4 w-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </button>
              )}
              <button
                onClick={scrollToSample}
                className="group flex items-center gap-3 px-8 py-4 rounded-full border border-foreground/[0.12] text-foreground font-medium text-[15px] hover:bg-foreground/[0.04] hover:border-foreground/[0.2] active:scale-[0.98] transition-all duration-300"
              >
                {isJa ? "完成イメージを見る" : "See sample output"}
                <ChevronRight className="h-4 w-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </button>
            </div>

            <p className="text-[12px] text-muted-foreground/40">
              {primaryCta.subLabel}
            </p>
          </div>

          {/* Scroll indicator */}
          <div className={`mt-14 transition-all duration-1000 delay-700 ${heroLoaded ? "opacity-100" : "opacity-0"}`}>
            <div className="flex flex-col items-center gap-2 text-muted-foreground/25">
              <span className="text-[9px] tracking-[0.3em] uppercase">scroll</span>
              <div className="w-px h-10 bg-gradient-to-b from-muted-foreground/20 to-transparent" />
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

      {/* ━━ Editor Workspace Mockup ━━ */}
      <section className="relative py-24 overflow-hidden border-t border-foreground/[0.04]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,hsl(var(--primary)/0.04),transparent_70%)]" />
        <div
          ref={mockupFade.ref}
          className={`relative max-w-5xl mx-auto px-6 transition-all duration-1000 ${mockupFade.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          <div className="text-center mb-14">
            <p className="text-[11px] font-bold tracking-[0.25em] uppercase bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent mb-4">
              {isJa ? "Eddivom のワークスペース" : "The Eddivom workspace"}
            </p>
            <h2 className="text-[clamp(1.5rem,4vw,2.5rem)] font-bold tracking-tight mb-4">
              {isJa ? "AIに頼んで、紙面にすぐ反映。" : "Tell the AI what you need. See it on the page."}
            </h2>
            <p className="text-muted-foreground text-[15px] max-w-lg mx-auto">
              {isJa
                ? "AIに指示を出すと、コンパイル済みのPDFが紙面にそのまま表示。数式も図もきれいに組版された状態で直接編集できます。"
                : "Type a prompt, and Eddivom renders the finished PDF right on the page. Equations and layout are print-ready."}
            </p>
            <p className="flex items-center justify-center gap-1.5 text-[12px] text-violet-500/70 font-medium mt-5">
              <Play className="h-3.5 w-3.5 fill-current" />
              {isJa ? "30秒デモをご覧ください" : "Watch the 30-second demo"}
            </p>
          </div>

          <EditorMockup isJa={isJa} />

          <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
            {[
              { icon: <Sparkles className="h-3.5 w-3.5" />, label: isJa ? "AIに指示→即反映" : "Prompt AI → instant result" },
              { icon: <FileText className="h-3.5 w-3.5" />, label: isJa ? "コンパイル済みPDF表示" : "Compiled PDF on page" },
              { icon: <Pencil className="h-3.5 w-3.5" />, label: isJa ? "紙面を直接編集" : "Edit directly on page" },
              { icon: <RefreshCw className="h-3.5 w-3.5" />, label: isJa ? "類題を一瞬で量産" : "Variants in one click" },
            ].map((chip) => (
              <div key={chip.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground/[0.03] border border-foreground/[0.06] text-[11px] text-muted-foreground hover:border-foreground/[0.12] transition-colors">
                <span className="text-primary/70">{chip.icon}</span>
                {chip.label}
              </div>
            ))}
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

      {/* ━━ Workflow ━━ */}
      <section className="relative py-28 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_100%,hsl(var(--primary)/0.03),transparent_70%)]" />
        <div
          ref={workflowFade.ref}
          className={`relative max-w-5xl mx-auto px-6 transition-all duration-1000 ${workflowFade.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          <div className="text-center mb-16">
            <p className="text-[11px] font-bold tracking-[0.25em] uppercase bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent mb-4">
              {isJa ? "Eddivom のワークフロー" : "How Eddivom works"}
            </p>
            <h2 className="text-[clamp(1.5rem,4vw,2.6rem)] font-bold tracking-tight mb-4">
              {isJa ? "入力から配布まで、5ステップ。" : "PDF to printable worksheet in 5 steps."}
            </h2>
            <p className="text-muted-foreground text-[15px] max-w-md mx-auto">
              {isJa
                ? "PDF・画像・テキスト、何からでも始められます。"
                : "Start from an old worksheet, a photo, or just a description."}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-3">
            <StepCard num="01" icon={<Upload className="h-5 w-5" strokeWidth={1.5} />}
              title={isJa ? "素材を入力" : "Bring your source"}
              desc={isJa ? "PDFをアップロード、画像を貼る、またはテキストで指示。何からでもOK" : "Upload an old worksheet PDF, snap a photo, or just describe what you need"}
              color="bg-gradient-to-br from-blue-500 to-cyan-500" />
            <StepCard num="02" icon={<Layers className="h-5 w-5" strokeWidth={1.5} />}
              title={isJa ? "問題を抽出" : "Extract problems"}
              desc={isJa ? "PDFや画像から問題を自動で認識し、編集可能な形式に変換" : "AI pulls out each problem — equations, diagrams, choices — and makes them editable"}
              color="bg-gradient-to-br from-violet-500 to-fuchsia-500" />
            <StepCard num="03" icon={<PenLine className="h-5 w-5" strokeWidth={1.5} />}
              title={isJa ? "問題ごとに編集" : "Edit per problem"}
              desc={isJa ? "数式・選択肢・配点をWord感覚で自由に修正。1問ずつ微調整" : "Change numbers, reword prompts, adjust points. No LaTeX — just click and type"}
              color="bg-gradient-to-br from-emerald-500 to-teal-500" />
            <StepCard num="04" icon={<Copy className="h-5 w-5" strokeWidth={1.5} />}
              title={isJa ? "類題を増やす" : "Generate variants"}
              desc={isJa ? "「類題を5問」で数値・難易度を変えたバリエーションを即生成" : "\"5 more like this\" — fresh problems with different numbers and difficulty levels"}
              color="bg-gradient-to-br from-amber-500 to-orange-500" />
            <StepCard num="05" icon={<FileDown className="h-5 w-5" strokeWidth={1.5} />}
              title={isJa ? "PDF出力・印刷" : "Export & print"}
              desc={isJa ? "生徒用と解答付きの2種類のPDFを出力。A4/B5で即印刷" : "One click for the student version, one click for the answer key. Print-ready PDF"}
              color="bg-gradient-to-br from-slate-500 to-gray-600" />
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

          {/* Big 3 cards */}
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
              },
              {
                icon: <PenLine className="h-6 w-6" strokeWidth={1.5} />,
                gradient: "from-emerald-500 to-teal-500",
                shadow: "shadow-emerald-500/20",
                title: isJa ? "問題ごとにWord感覚で編集" : "Edit problem by problem",
                desc: isJa
                  ? "数式・選択肢・配点・解説をクリックして直接編集。問題の入れ替え・並べ替えも自在です。"
                  : "Click any equation, answer choice, or point value and just type. Reorder and rearrange problems freely.",
              },
              {
                icon: <Copy className="h-6 w-6" strokeWidth={1.5} />,
                gradient: "from-violet-500 to-fuchsia-500",
                shadow: "shadow-violet-500/20",
                title: isJa ? "類題を即座に量産" : "Spin up variants instantly",
                desc: isJa
                  ? "1問から数値・条件・難易度を変えたバリエーションを一括生成。演習量を一気に増やせます。"
                  : "One problem becomes five — or fifty. Different numbers, different difficulty, same skill.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="group relative p-7 rounded-[20px] bg-card/70 backdrop-blur-xl border border-foreground/[0.05] hover:border-foreground/[0.1] hover:shadow-2xl hover:-translate-y-1 transition-all duration-500"
              >
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
                  isJa ? "全テンプレート 12種類に解放 (入試・発表・長文レポート +6種)" : "Unlocks all 12 templates (+6 exams/slides/reports)",
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
        <div className="max-w-5xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-600 via-violet-500 to-fuchsia-500 flex items-center justify-center shadow-sm">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
                <path d="M5 6h10M5 12h7M5 18h10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="18" cy="12" r="3" stroke="white" strokeWidth="2" fill="white" fillOpacity="0.3" />
              </svg>
            </div>
            <span className="text-[14px] font-bold tracking-tight opacity-50">Eddivom</span>
          </div>
          <p className="text-[11px] text-muted-foreground/25 tracking-wide">
            AI教材作成IDE · Powered by LuaLaTeX
          </p>
        </div>
      </footer>
    </div>
  );
}
