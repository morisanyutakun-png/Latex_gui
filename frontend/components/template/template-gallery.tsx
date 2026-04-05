"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useDocumentStore } from "@/store/document-store";
import { createDefaultDocument } from "@/lib/types";
import { loadFromLocalStorage } from "@/lib/storage";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { UserMenu } from "@/components/auth/user-menu";
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
  // lines の参照を追跡し、言語切り替え時にアニメーションをリセット
  const prevLinesRef = useRef(lines);

  useEffect(() => {
    if (prevLinesRef.current !== lines) {
      prevLinesRef.current = lines;
      setLineIdx(0);
      setCharIdx(0);
      setDeleting(false);
    }
  }, [lines]);

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
function EditorMockup({ isJa }: { isJa: boolean }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % 4), 2000);
    return () => clearInterval(t);
  }, []);

  const chatMessages = [
    { role: "user", text: isJa ? "二次方程式の練習問題を5問作って" : "Make 5 quadratic equation problems" },
    { role: "ai",   text: isJa ? "5問作成しました。紙面に反映しています。" : "Done — 5 problems added to your worksheet.", done: true },
    { role: "user", text: isJa ? "もう少し難しくして" : "Make them harder" },
    { role: "ai",   text: isJa ? "難易度を上げました。" : "Updated with harder variants.", done: true },
  ];

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      {/* Glow behind mockup */}
      <div className="absolute -inset-4 bg-gradient-to-b from-blue-500/[0.05] via-violet-500/[0.05] to-fuchsia-500/[0.03] rounded-3xl blur-2xl pointer-events-none" />
      <div className="relative rounded-2xl border border-foreground/[0.08] bg-card/90 backdrop-blur-xl shadow-2xl shadow-foreground/[0.06] overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-foreground/[0.06] bg-foreground/[0.02]">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
          </div>
          <div className="h-5 w-5 rounded-md bg-gradient-to-br from-blue-600 via-violet-500 to-fuchsia-500 flex items-center justify-center ml-2 shadow shadow-violet-500/30">
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none">
              <path d="M5 6h10M5 12h7M5 18h10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="18" cy="12" r="3" stroke="white" strokeWidth="2" fill="white" fillOpacity="0.3" />
            </svg>
          </div>
          <span className="text-[11px] text-muted-foreground/60 font-medium">Eddivom</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium border border-emerald-500/10">
              {isJa ? "PDF出力" : "Export PDF"}
            </span>
          </div>
        </div>

        {/* 2-pane + activity bar */}
        <div className="flex min-h-[320px] sm:min-h-[360px]">
          {/* Left: PDF paper */}
          <div className="flex-1 bg-gray-100/60 dark:bg-gray-950/40 p-4 flex justify-center overflow-hidden">
            <div className="bg-white dark:bg-white/[0.97] rounded-lg shadow-xl border border-gray-200/50 w-full max-w-[300px] p-5 space-y-3">
              <div className="text-center space-y-1 pb-3 border-b border-gray-100">
                <div className="h-2.5 w-3/4 bg-gray-800 rounded-full mx-auto" />
                <div className="h-1.5 w-1/2 bg-gray-400 rounded-full mx-auto mt-1" />
              </div>
              {[1, 2, 3].map((n) => (
                <div key={n} className={`space-y-1.5 transition-all duration-500 ${step >= n - 1 ? "opacity-100" : "opacity-30"}`}>
                  <div className="flex items-start gap-2">
                    <span className="text-[9px] font-bold text-gray-700 mt-0.5">{n}.</span>
                    <div className="flex-1 space-y-1">
                      <div className="h-1 bg-gray-200 rounded-full w-full" />
                      <div className="h-1 bg-gray-200 rounded-full w-4/5" />
                    </div>
                  </div>
                  <div className="ml-4 bg-gray-50 rounded px-2 py-1.5 text-center">
                    <span className="text-[11px] font-medium text-gray-600 font-mono">
                      {["2x² − 5x + 3 = 0", "x² + 4x − 12 = 0", "3x² − 7x + 2 = 0"][n - 1]}
                    </span>
                  </div>
                </div>
              ))}
              <div className={`space-y-1 transition-all duration-700 ${step >= 3 ? "opacity-100" : "opacity-20"}`}>
                <div className="flex items-start gap-2">
                  <span className="text-[9px] font-bold text-gray-700 mt-0.5">4.</span>
                  <div className="flex-1 space-y-1">
                    <div className="h-1 bg-gray-200 rounded-full w-full" />
                    <div className="h-1 bg-gray-200 rounded-full w-2/3" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: AI chat */}
          <div className="w-[200px] sm:w-[240px] border-l border-foreground/[0.06] flex flex-col bg-surface-1/[0.02] dark:bg-surface-1/60">
            {/* Panel header */}
            <div className="px-3 py-2 border-b border-foreground/[0.06] bg-surface-1/[0.04] dark:bg-surface-1/80 flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm">
                <Sparkles className="h-2.5 w-2.5 text-white" />
              </div>
              <span className="text-[10px] font-bold text-indigo-400 tracking-wide">EddivomAI</span>
              <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            {/* Chat */}
            <div className="flex-1 p-2.5 space-y-2 overflow-hidden">
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex transition-all duration-700 ${i < step + 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"} ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`rounded-xl px-2.5 py-1.5 max-w-[90%] ${msg.role === "user" ? "bg-gradient-to-br from-indigo-600 to-violet-700 rounded-tr-sm" : "bg-white/[0.04] dark:bg-white/[0.06] border border-white/[0.06] rounded-tl-sm"}`}>
                    <p className={`text-[9px] leading-relaxed ${msg.role === "user" ? "text-white/90" : "text-foreground/60"}`}>
                      {msg.text}
                    </p>
                    {msg.done && (
                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500 font-medium mt-1 inline-block">
                        {isJa ? "✓ 反映済み" : "✓ Applied"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {/* Input */}
            <div className="p-2 border-t border-foreground/[0.06]">
              <div className="flex items-center gap-1.5 bg-white/[0.03] rounded-lg px-2.5 py-1.5 border border-white/[0.06]">
                <span className="text-[9px] text-muted-foreground/30 flex-1 truncate">
                  {isJa ? "指示を入力…" : "Type a prompt…"}
                </span>
                <ArrowRight className="h-3 w-3 text-indigo-500/40" />
              </div>
            </div>
          </div>

          {/* Activity Bar */}
          <div className="w-8 border-l border-foreground/[0.06] bg-foreground/[0.02] flex flex-col items-center py-2 gap-2">
            <div className="w-5 h-5 rounded bg-indigo-500/15 flex items-center justify-center border-l-2 border-indigo-500">
              <Sparkles className="h-3 w-3 text-indigo-400" />
            </div>
            {[Code2, PenLine, BookOpen].map((Icon, i) => (
              <div key={i} className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/25">
                <Icon className="h-3 w-3" />
              </div>
            ))}
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
                <p className="text-[11.5px] text-gray-800 leading-relaxed">
                  <span className="text-gray-500 mr-2">(1)</span>
                  3x<sup className="text-[8px]">2</sup> + 5x − 2 = 0　{isJa ? "を解け。" : ""}
                </p>
                <div className="ml-6 mt-1 h-10 border-b border-dashed border-gray-200" />
              </div>
              <div>
                <p className="text-[11.5px] text-gray-800 leading-relaxed">
                  <span className="text-gray-500 mr-2">(2)</span>
                  log<sub className="text-[8px]">2</sub>8 + log<sub className="text-[8px]">2</sub>4　{isJa ? "の値を求めよ。" : "= ?"}
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
                ? <span>関数 f(x) = x<sup className="text-[8px]">2</sup> − 4x + 3 について、次の問いに答えよ。</span>
                : <span>f(x) = x<sup className="text-[8px]">2</sup> − 4x + 3 — answer the following.</span>}
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
      <span key="p1">y = x<sup className="text-[8px]">2</sup> − 6x + 5</span>,
      <span key="p2">y = −2x<sup className="text-[8px]">2</sup> + 8x − 3</span>,
      <span key="p3">y = 3(x−1)<sup className="text-[8px]">2</sup> + 4</span>,
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
              <p className="text-[11.5px] text-gray-800">
                <span className="text-gray-500 mr-2">(1)</span>
                x<sup className="text-[8px]">2</sup> − 2x − 3 &gt; 0　{isJa ? "を満たす x の範囲を求めよ。" : "find range of x."}
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
              <p className="text-[11px] text-gray-600">
                <span className="mr-2 text-gray-400">(1)</span>
                3x<sup className="text-[8px]">2</sup> + 5x − 2 = 0
              </p>
              <div className="ml-5 mt-1 bg-red-50/80 border-l-2 border-red-400 px-2.5 py-1.5">
                <p className="text-[10.5px] text-red-700 leading-relaxed">
                  (3x − 1)(x + 2) = 0　∴　<strong>x = <sup className="text-[8px]">1</sup>⁄<sub className="text-[8px]">3</sub>, −2</strong>
                </p>
              </div>
            </div>
            <div>
              <p className="text-[11px] text-gray-600">
                <span className="mr-2 text-gray-400">(2)</span>
                log<sub className="text-[8px]">2</sub>8 + log<sub className="text-[8px]">2</sub>4
              </p>
              <div className="ml-5 mt-1 bg-red-50/80 border-l-2 border-red-400 px-2.5 py-1.5">
                <p className="text-[10.5px] text-red-700">
                  = log<sub className="text-[8px]">2</sub>32 = <strong>5</strong>
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
              <p className="text-[11px] text-gray-600">
                <span className="mr-2 text-gray-400">(1)</span>
                {isJa ? "頂点の座標" : "Vertex"}
              </p>
              <div className="ml-5 mt-1 bg-red-50/80 border-l-2 border-red-400 px-2.5 py-1.5">
                <p className="text-[10.5px] text-red-700">
                  f(x) = (x−2)<sup className="text-[8px]">2</sup> − 1　∴　<strong>{isJa ? "頂点 (2, −1)" : "(2, −1)"}</strong>
                </p>
              </div>
            </div>
            <div>
              <p className="text-[11px] text-gray-600">
                <span className="mr-2 text-gray-400">(2)</span>
                f(x) = 0
              </p>
              <div className="ml-5 mt-1 bg-red-50/80 border-l-2 border-red-400 px-2.5 py-1.5">
                <p className="text-[10.5px] text-red-700">
                  (x−1)(x−3) = 0　∴　<strong>x = 1, 3</strong>
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
function SampleShowcase({ isJa, onTryNow }: { isJa: boolean; onTryNow: () => void }) {
  const fadeIn = useFadeIn(0);
  const [active, setActive] = useState<PrintVariant>("exam");

  const tabs: Array<{ id: PrintVariant; ja: string; en: string }> = [
    { id: "exam", ja: "確認テスト", en: "Exam Sheet" },
    { id: "worksheet", ja: "演習プリント", en: "Worksheet" },
    { id: "answer", ja: "解答付き版", en: "Answer Key" },
  ];

  return (
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
            {isJa ? "このプリントを自分で作る" : "Make this worksheet yourself"}
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
          </button>
          <p className="text-[11px] text-muted-foreground/40 mt-3">
            {isJa ? "無料で試せます · カード不要" : "Free to try · No credit card needed"}
          </p>
        </div>
      </div>
    </section>
  );
}

/* ── Before / After ── */
function BeforeAfterSection({ isJa }: { isJa: boolean }) {
  const fadeIn = useFadeIn(0);

  return (
    <section ref={fadeIn.ref} className={`relative py-24 border-t border-foreground/[0.04] overflow-hidden transition-all duration-1000 ${fadeIn.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_50%,hsl(var(--primary)/0.025),transparent_70%)]" />
      <div className="relative max-w-5xl mx-auto px-6">
        <div className="text-center mb-14">
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

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 md:gap-4 items-start">
          {/* Before */}
          <div className="flex flex-col items-center gap-3">
            <span className="text-[10px] font-bold tracking-wider uppercase px-3 py-1 rounded-full border border-foreground/[0.08] text-muted-foreground/50 bg-foreground/[0.02]">
              {isJa ? "元の教材" : "Before"}
            </span>
            <div className="relative w-full max-w-[230px] mx-auto">
              <div className="bg-[#fdfcf4] dark:bg-[#2c2a1e] rounded-lg border border-amber-200/40 dark:border-amber-800/30 shadow-lg p-5 rotate-[-1.5deg] hover:rotate-0 transition-transform duration-300">
                <div className="space-y-1 mb-3">
                  <div className="h-2 bg-gray-700/30 rounded-full w-2/3 mx-auto" />
                  <div className="h-1.5 bg-gray-500/20 rounded-full w-1/2 mx-auto" />
                </div>
                <div className="border-t border-gray-400/20 pt-3 space-y-3 opacity-70">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="flex gap-1.5">
                      <span className="text-[8px] text-gray-500/60 mt-0.5 shrink-0">({n})</span>
                      <div className="flex-1 space-y-1">
                        <div className="h-1 bg-gray-600/20 rounded-full w-full" />
                        <div className="h-1 bg-gray-500/15 rounded-full w-4/5" />
                        <div className="h-6 border-b border-dashed border-gray-400/20" />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="absolute inset-0 rounded-lg pointer-events-none opacity-[0.06]"
                  style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.02) 3px, rgba(0,0,0,0.02) 4px)" }} />
              </div>
            </div>
            <p className="text-[12px] text-muted-foreground/70 text-center leading-snug">
              {isJa ? "過去問・古いプリント・スキャンPDF" : "Old exams, scanned worksheets, PDFs"}
            </p>
          </div>

          {/* Steps connector */}
          <div className="hidden md:flex flex-col items-center justify-start gap-1 pt-10 min-w-[120px]">
            <div className="flex flex-col items-center gap-1.5">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                <Upload className="h-4 w-4 text-white" />
              </div>
              <p className="text-[9px] text-muted-foreground/50 text-center leading-tight">
                {isJa ? "アップロード\nAI抽出" : "Upload\nAI extract"}
              </p>
              <div className="h-6 w-px bg-gradient-to-b from-violet-500/30 to-fuchsia-500/30" />
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/25">
                <PenLine className="h-4 w-4 text-white" />
              </div>
              <p className="text-[9px] text-muted-foreground/50 text-center leading-tight">
                {isJa ? "編集・類題\n追加" : "Edit &\nadd variants"}
              </p>
              <div className="h-6 w-px bg-gradient-to-b from-fuchsia-500/30 to-emerald-500/30" />
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                <FileDown className="h-4 w-4 text-white" />
              </div>
              <p className="text-[9px] text-muted-foreground/50 text-center leading-tight">
                {isJa ? "PDF出力" : "Export PDF"}
              </p>
            </div>
          </div>

          {/* After */}
          <div className="flex flex-col items-center gap-3">
            <span className="text-[10px] font-bold tracking-wider uppercase px-3 py-1 rounded-full border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 bg-emerald-500/[0.06]">
              {isJa ? "完成品" : "After"}
            </span>
            <div className="relative w-full max-w-[230px] mx-auto">
              <WorksheetPaper variant="answer" isJa={isJa} />
            </div>
            <p className="text-[12px] text-muted-foreground/70 text-center leading-snug">
              {isJa ? "美しく組版された印刷品質のPDF" : "Beautifully typeset, print-ready PDF"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function TemplateGallery() {
  const router = useRouter();
  const setDocument = useDocumentStore((s) => s.setDocument);
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [powerOpen, setPowerOpen] = useState(false);
  const [annual, setAnnual] = useState(true);

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

  const handleStart = async () => {
    // 認証が設定されている場合のみログインチェック
    try {
      // @ts-ignore — next-auth is optional; absence is caught below
      const { getSession } = await import("next-auth/react");
      const session = await getSession();
      if (!session) {
        // セッション取得できるが未ログイン → ログインへ
        // @ts-ignore
        const { signIn } = await import("next-auth/react");
        signIn("google", { callbackUrl: "/editor?new=1" });
        return;
      }
    } catch {
      // 認証未設定 or エラー → そのまま続行
    }
    const doc = createDefaultDocument("blank", []);
    setDocument(doc);
    router.push("/editor");
  };

  const handleResume = () => {
    const doc = loadFromLocalStorage();
    if (doc) { setDocument(doc); router.push("/editor"); }
  };

  const { locale } = useI18n();
  const saved = typeof window !== "undefined" ? loadFromLocalStorage() : null;
  const isJa = locale !== "en";

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
              onClick={handleStart}
              className="hidden sm:flex items-center gap-2 px-4 py-1.5 rounded-full bg-foreground text-background text-[13px] font-semibold hover:opacity-90 transition-opacity"
            >
              {isJa ? "無料で始める" : "Get started"}
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
            <h1 className="text-[clamp(2.5rem,6.5vw,4.8rem)] leading-[1.06] font-bold tracking-[-0.035em] mb-8">
              <TypingLine lines={heroTypingLines} />
            </h1>

            <p className="text-muted-foreground text-[17px] sm:text-[19px] leading-relaxed max-w-xl mx-auto mb-10 font-light">
              {isJa
                ? "AIが問題を生成し、類題を量産し、解答付きPDFを自動で作成。"
                : "AI generates problems, multiplies variants,\nand auto-creates answer-key PDFs."}
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              <button
                onClick={handleStart}
                className="group relative flex items-center gap-3 px-9 py-4 rounded-full bg-foreground text-background font-bold text-[15px] shadow-2xl shadow-foreground/10 hover:shadow-foreground/20 hover:scale-[1.03] active:scale-[0.98] transition-all duration-300 overflow-hidden"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600 opacity-0 group-hover:opacity-[0.08] transition-opacity duration-300" />
                {isJa ? "無料で試す" : "Try free"}
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
              </button>
              <button
                onClick={scrollToSample}
                className="group flex items-center gap-3 px-8 py-4 rounded-full border border-foreground/[0.12] text-foreground font-medium text-[15px] hover:bg-foreground/[0.04] hover:border-foreground/[0.2] active:scale-[0.98] transition-all duration-300"
              >
                {isJa ? "完成イメージを見る" : "See sample output"}
                <ChevronRight className="h-4 w-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </button>
            </div>

            <p className="text-[12px] text-muted-foreground/40">
              {isJa ? "無料プランあり · カード不要 · 30秒で最初の1枚" : "Free plan available · No credit card · First worksheet in 30 seconds"}
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
          <TrustBadge icon={<Sparkles className="h-3.5 w-3.5" />} label={isJa ? "Claude AI 搭載" : "Powered by Claude AI"} />
          <TrustBadge icon={<Printer className="h-3.5 w-3.5" />} label={isJa ? "A4/B5 印刷対応" : "Print-ready PDF"} />
          <TrustBadge icon={<Star className="h-3.5 w-3.5" />} label={isJa ? "数式・図・化学式対応" : "Math, diagrams, chemistry"} />
        </div>
      </section>

      <SampleShowcase isJa={isJa} onTryNow={handleStart} />

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

          <div className="text-center mt-12">
            <button
              onClick={handleStart}
              className="group inline-flex items-center gap-3 px-10 py-4 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 text-white font-bold text-[14px] shadow-2xl shadow-blue-500/25 hover:shadow-blue-500/35 hover:scale-[1.03] active:scale-[0.98] transition-all duration-300"
            >
              {isJa ? "PDFから始めてみる" : "Try it with your PDF"}
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
            </button>
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
          className={`relative max-w-5xl mx-auto px-6 transition-all duration-1000 ${pricingFade.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          <div className="text-center mb-8">
            <p className="text-[11px] font-bold tracking-[0.25em] uppercase bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent mb-4">
              {isJa ? "料金プラン" : "Pricing"}
            </p>
            <h2 className="text-[clamp(1.5rem,4vw,2.6rem)] font-bold tracking-tight mb-4">
              {isJa ? "授業1コマ分以下で、教材作成を自動化。" : "Automate your worksheets for less than one tutoring hour."}
            </h2>
            <p className="text-muted-foreground text-[15px] max-w-md mx-auto">
              {isJa
                ? "まず無料で試して、気に入ったらProへ。"
                : "Start free, upgrade when you're ready."}
            </p>
          </div>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-3 mb-12">
            <span className={`text-[13px] font-medium transition-colors ${!annual ? "text-foreground" : "text-muted-foreground/50"}`}>
              {isJa ? "月払い" : "Monthly"}
            </span>
            <button
              onClick={() => setAnnual((v) => !v)}
              className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${annual ? "bg-violet-500" : "bg-foreground/20"}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-300 ${annual ? "translate-x-6" : "translate-x-0.5"}`} />
            </button>
            <span className={`text-[13px] font-medium transition-colors ${annual ? "text-foreground" : "text-muted-foreground/50"}`}>
              {isJa ? "年払い" : "Annual"}
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/15">
              {isJa ? "34%お得" : "Save 34%"}
            </span>
          </div>

          {/* Plans */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {/* Free */}
            <div className="relative p-6 rounded-[20px] bg-card/70 backdrop-blur-xl border border-foreground/[0.06] hover:border-foreground/[0.1] transition-all duration-300">
              <p className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground/50 mb-3">Free</p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-[32px] font-black tracking-tight">¥0</span>
              </div>
              <p className="text-[12px] text-muted-foreground mb-5">{isJa ? "ずっと無料・カード不要" : "Free forever · No credit card"}</p>
              <button
                onClick={handleStart}
                className="w-full py-2.5 rounded-xl border border-foreground/[0.1] text-foreground font-semibold text-[13px] hover:bg-foreground/[0.04] transition-all duration-300 mb-5"
              >
                {isJa ? "無料で始める" : "Get started free"}
              </button>
              <ul className="space-y-2.5">
                {[
                  isJa ? "AIリクエスト 3回/日（月30回）" : "3 AI requests/day (30/month)",
                  isJa ? "AIモデル: Haiku（軽量）" : "AI model: Haiku (lightweight)",
                  isJa ? "基本テンプレート" : "Basic templates",
                  isJa ? "PDF出力" : "PDF export",
                  isJa ? "テキストから問題生成" : "Generate from text prompts",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Pro */}
            <div className="relative p-6 rounded-[20px] bg-gradient-to-b from-violet-500/[0.06] to-blue-500/[0.03] border-2 border-violet-500/[0.25] shadow-2xl shadow-violet-500/[0.08] hover:shadow-violet-500/[0.15] transition-all duration-300">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="text-[10px] px-3 py-0.5 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 text-white font-bold shadow-lg flex items-center gap-1">
                  <Crown className="h-3 w-3" />
                  {isJa ? "おすすめ" : "Most popular"}
                </span>
              </div>
              <p className="text-[11px] font-bold tracking-wider uppercase bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent mb-3">Pro</p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-[32px] font-black tracking-tight">¥{annual ? "980" : "1,480"}</span>
                <span className="text-[13px] text-muted-foreground font-medium">/ {isJa ? "月" : "mo"}</span>
              </div>
              <p className="text-[12px] text-muted-foreground mb-5">
                {annual
                  ? (isJa ? "年払い ¥11,760/年（月あたり¥980）" : "Billed annually at ¥11,760/yr")
                  : (isJa ? "月払い · いつでも解約OK" : "Billed monthly · Cancel anytime")}
              </p>
              <button
                onClick={handleStart}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white font-bold text-[13px] shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 mb-5"
              >
                {isJa ? "7日間無料で試す" : "Start 7-day free trial"}
              </button>
              <ul className="space-y-2.5">
                {[
                  isJa ? "AIリクエスト 25回/日（月500回）" : "25 AI requests/day (500/month)",
                  isJa ? "高精度AI（Sonnet）月50回" : "High-quality AI (Sonnet) 50/month",
                  isJa ? "PDF・画像から問題を抽出" : "Import from PDF & images",
                  isJa ? "解答付きPDF自動生成" : "Auto answer-key PDF",
                  isJa ? "バッチ処理（上限50行）" : "Batch processing (up to 50 rows)",
                  isJa ? "メールサポート" : "Email support",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-[12px] text-foreground/80 font-medium">
                    <Check className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Premium */}
            <div className="relative p-6 rounded-[20px] bg-gradient-to-b from-amber-500/[0.08] to-orange-500/[0.04] border-2 border-amber-400/[0.3] shadow-2xl shadow-amber-500/[0.08] hover:shadow-amber-500/[0.15] transition-all duration-300">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="text-[10px] px-3 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold shadow-lg flex items-center gap-1">
                  <Crown className="h-3 w-3" />
                  {isJa ? "最上位" : "Best value"}
                </span>
              </div>
              <p className="text-[11px] font-bold tracking-wider uppercase bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent mb-3">Premium</p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-[32px] font-black tracking-tight">¥{annual ? "9,800" : "12,800"}</span>
                <span className="text-[13px] text-muted-foreground font-medium">/ {isJa ? "月" : "mo"}</span>
              </div>
              <p className="text-[12px] text-muted-foreground mb-5">
                {annual
                  ? (isJa ? "年払い ¥117,600/年（月あたり¥9,800）" : "Billed annually at ¥117,600/yr")
                  : (isJa ? "月払い · いつでも解約OK" : "Billed monthly · Cancel anytime")}
              </p>
              <button
                onClick={handleStart}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-[13px] shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 mb-5"
              >
                {isJa ? "14日間無料で試す" : "Start 14-day free trial"}
              </button>
              <ul className="space-y-2.5">
                {[
                  isJa ? "AIリクエスト 80回/日（月1,500回）" : "80 AI requests/day (1,500/month)",
                  isJa ? "高精度AI（Sonnet）月200回" : "High-quality AI (Sonnet) 200/month",
                  isJa ? "Proの全機能を含む" : "Everything in Pro",
                  isJa ? "紙デザインそのままPDF出力" : "Paper design preserved in PDF",
                  isJa ? "バッチ処理（最大200行）" : "Batch processing (up to 200 rows)",
                  isJa ? "カスタムテンプレート作成" : "Custom template creation",
                  isJa ? "最優先サポート" : "Priority support",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-[12px] text-foreground/80 font-medium">
                    <Check className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="text-center text-[12px] text-muted-foreground/40 mt-8">
            {isJa ? "Stripe による安全な決済 · いつでもキャンセル可能 · 領収書発行対応" : "Secure payment via Stripe · Cancel anytime · Receipts available"}
          </p>
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
            {isJa ? "Eddivom で、教材づくりを今夜から変えよう。" : "Try Eddivom tonight.\nYour worksheet will be done before bed."}
          </h2>
          <p className="text-muted-foreground text-[16px] mb-12 max-w-md mx-auto leading-relaxed">
            {isJa
              ? "無料で始めて、気に入ったらProへ。月¥980から。"
              : "Start free, upgrade to Pro from ¥980/mo when you're ready."}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleStart}
              className="group relative inline-flex items-center gap-3 px-12 py-5 rounded-full font-bold text-[16px] text-white overflow-hidden shadow-2xl shadow-violet-500/30 hover:shadow-violet-500/50 hover:scale-[1.04] active:scale-[0.97] transition-all duration-300"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600" />
              <span className="absolute inset-0 bg-gradient-to-r from-blue-500 via-violet-500 to-fuchsia-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="relative">{isJa ? "無料で試す" : "Try free"}</span>
              <ArrowRight className="relative h-5 w-5 group-hover:translate-x-1 transition-transform duration-300" />
            </button>
            <button
              onClick={scrollToPricing}
              className="group flex items-center gap-3 px-8 py-5 rounded-full border border-white/[0.15] text-foreground font-semibold text-[15px] hover:bg-foreground/[0.04] hover:border-foreground/[0.2] active:scale-[0.98] transition-all duration-300"
            >
              {isJa ? "料金プランを見る" : "See plans"}
              <ChevronRight className="h-4 w-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </button>
          </div>
          {saved && (
            <button
              onClick={handleResume}
              className="group inline-flex items-center gap-2 mt-6 text-[13px] text-muted-foreground/50 hover:text-foreground/70 transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
              {isJa
                ? `「${saved.metadata.title || "無題"}」を続ける`
                : `Resume "${saved.metadata.title || "Untitled"}"`}
              <ChevronRight className="h-3.5 w-3.5 opacity-50 group-hover:translate-x-0.5 transition-all" />
            </button>
          )}
          <p className="mt-5 text-[12px] text-muted-foreground/35">
            {isJa ? "無料プランあり · カード不要 · 30秒で最初の1枚" : "Free plan available · No credit card · First worksheet in 30 seconds"}
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
            AI教材作成IDE · Powered by LuaLaTeX · Built with Claude
          </p>
        </div>
      </footer>
    </div>
  );
}
