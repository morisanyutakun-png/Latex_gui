"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useDocumentStore } from "@/store/document-store";
import { createDefaultDocument } from "@/lib/types";
import { getTemplateLatex } from "@/lib/templates";
import { loadFromLocalStorage } from "@/lib/storage";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useVisibleInterval } from "@/hooks/use-visible-interval";
import dynamic from "next/dynamic";
import { IdleMount } from "./idle-mount";
import { hasUsedAnonymousTrial } from "@/lib/anonymous-trial";
import { trackFreeGenerateLimitReached, trackFreeTrialCtaClick } from "@/lib/gtag";

// AnonymousTrialModal は radix-ui Dialog + 大量の lucide アイコン + i18n の翻訳まわりを
// 抱える重いコンポーネントだが、open=true になるのは「お試し済みユーザが CTA を再度
// 押した時」の極めてレアなケースのみ。LP 初期描画には不要なので dynamic import で
// 切り離して LCP/FCP を改善する。
const AnonymousTrialModal = dynamic(
  () => import("./anonymous-trial-modal").then((m) => m.AnonymousTrialModal),
  { ssr: false, loading: () => null },
);

// MobileLanding は別ファイル + 別 LP コンポーネント。
// ssr:true (デフォルト) で動的 import → サーバ側で User-Agent から isMobile を
// 判定済みのケースでは MobileLanding が SSR HTML に直接乗る = モバイルユーザに
// PC 版を一瞬見せてから swap する render delay を排除できる。
// 同時に PC ユーザの初期 JS バンドルからも実コードが分離される (chunk 化)。
const MobileLanding = dynamic(
  () => import("./mobile-landing").then((m) => m.MobileLanding),
  { loading: () => null },
);
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { UserMenu } from "@/components/auth/user-menu";
import { toast } from "sonner";
import { usePlanStore } from "@/store/plan-store";
import { PLANS, type PlanId } from "@/lib/plans";
// KaTeX の CSS (~25KB + woff2 フォント数本) は LP 初回描画のクリティカルパスに乗ると
// FCP/LCP を悪化させる。LP では SampleShowcase 内のサンプル数式描画でしか使わないので、
// その節がビューに入った瞬間に動的に <link rel="stylesheet"> を差し込む方式にする。
// ※ 旧 import "katex/dist/katex.min.css" は CSS チャンクとして必ず先に読まれてしまうため撤去。
import { renderMathHTML } from "@/lib/katex-render";

/** KaTeX CSS を初回 1 度だけ <link> で差し込むユーティリティ。SampleShowcase の中の
 *  M コンポーネントが mount されたときに呼ぶことで、上部 hero / nav の描画パスから
 *  外れて critical path を削れる。
 *  `font-display: swap` を補完する <style> も併せて注入し、FOIT を回避して
 *  Lighthouse の「フォント表示」項目をクリアする。 */
let _katexCssInjected = false;
function ensureKatexCss() {
  if (typeof document === "undefined" || _katexCssInjected) return;
  _katexCssInjected = true;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css";
  link.crossOrigin = "anonymous";
  link.referrerPolicy = "no-referrer";
  document.head.appendChild(link);
  // KaTeX 公式 CSS は font-display を指定していない (= ブラウザ既定の `block` で
  // 3秒の不可視待ちが発生)。後乗せの style で `swap` に上書きして FOIT を解消する。
  const style = document.createElement("style");
  style.textContent = `
    @font-face { font-family: KaTeX_Main; font-display: swap; }
    @font-face { font-family: KaTeX_Math; font-display: swap; }
    @font-face { font-family: KaTeX_AMS; font-display: swap; }
    @font-face { font-family: KaTeX_Caligraphic; font-display: swap; }
    @font-face { font-family: KaTeX_Fraktur; font-display: swap; }
    @font-face { font-family: KaTeX_SansSerif; font-display: swap; }
    @font-face { font-family: KaTeX_Script; font-display: swap; }
    @font-face { font-family: KaTeX_Size1; font-display: swap; }
    @font-face { font-family: KaTeX_Size2; font-display: swap; }
    @font-face { font-family: KaTeX_Size3; font-display: swap; }
    @font-face { font-family: KaTeX_Size4; font-display: swap; }
    @font-face { font-family: KaTeX_Typewriter; font-display: swap; }
  `;
  document.head.appendChild(style);
}
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
  Wand2,
  TrendingUp,
  TrendingDown,
  Shuffle,
  Loader2,
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
  Smartphone,
  FileSignature,
} from "lucide-react";

// IdleMount は ./idle-mount.tsx に分離 (mobile-landing と共有するため)。

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
  // さらに LCP/FCP 改善のため初回マウントを `requestIdleCallback` (or 800ms 後) まで
  // 遅延する: ヒーローのテキスト・モックアップが先に paint されてから装飾を後追いで挿入。
  const ref = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(true);
  const [formulas, setFormulas] = useState<typeof FLOAT_FORMULAS>(FLOAT_FORMULAS);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    type IdleWindow = Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
    };
    const w = window as IdleWindow;
    const idle = w.requestIdleCallback;
    if (typeof idle === "function") {
      idle(() => setMounted(true), { timeout: 1500 });
    } else {
      const t = window.setTimeout(() => setMounted(true), 800);
      return () => window.clearTimeout(t);
    }
  }, []);
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

  // mounted=false の間は枠だけ返す (LCP/FCP に影響する DOM ノード生成を後回し)
  if (!mounted) {
    return <div ref={ref} className="absolute inset-0 overflow-hidden pointer-events-none select-none" aria-hidden />;
  }

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden pointer-events-none select-none" aria-hidden>
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

/* ── Hero: プロンプト入力風 CTA ──
 * Free 無料お試し動線専用。ユーザの prompt を sessionStorage に預けてエディタへ遷移し、
 * エディタ側 (app/editor/page.tsx) がマウント時に拾って AI チャットに即流す。
 * 入力が空でもボタンは押せる (空のままでも /editor?guest=1 に遷移できるよう)。 */
function HeroPromptCta({ isJa, onSubmit }: { isJa: boolean; onSubmit: (prompt: string) => void }) {
  const [value, setValue] = React.useState("");
  const placeholder = isJa
    ? "二次方程式の問題を10問、解答付きで作って"
    : "Create 10 quadratic equation problems with answers";
  const submit = () => onSubmit(value);
  return (
    <div className="group relative flex items-stretch gap-2 p-2 pl-3 sm:pl-4 rounded-2xl border-2 border-foreground/[0.08] bg-card/80 backdrop-blur-md shadow-xl shadow-foreground/[0.04] focus-within:border-violet-500/40 focus-within:shadow-violet-500/[0.08] transition-all">
      <Sparkles className="h-4 w-4 text-violet-500 self-center shrink-0" aria-hidden />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
        placeholder={placeholder}
        aria-label={isJa ? "AIに作成内容を伝える" : "Tell the AI what to make"}
        className="flex-1 min-w-0 bg-transparent text-[14px] sm:text-[15px] outline-none placeholder:text-muted-foreground/50 text-foreground"
      />
      <button
        type="button"
        onClick={submit}
        className="shrink-0 inline-flex items-center gap-1.5 px-4 sm:px-5 h-10 sm:h-11 rounded-xl bg-foreground text-background font-bold text-[13px] sm:text-[14px] hover:opacity-90 active:scale-[0.98] transition"
      >
        <span className="hidden sm:inline">
          {isJa ? "無料で1枚作る" : "Create 1 free worksheet"}
        </span>
        <span className="sm:hidden">{isJa ? "作る" : "Create"}</span>
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ── Hero: Prompt → Worksheet PDF → Answer Key PDF の出力フロー帯 ──
 * 何が出てくるかを 3 ステップで一目見せる。CTA の説得補助。 */
function HeroFlowStrip({ isJa }: { isJa: boolean }) {
  const items = [
    {
      icon: <Sparkles className="h-4 w-4" />,
      label: isJa ? "プロンプト" : "Prompt",
      sub: isJa ? "「二次方程式10問」" : "\"10 quadratic problems\"",
      tone: "from-blue-500 to-violet-500",
    },
    {
      icon: <FileText className="h-4 w-4" />,
      label: isJa ? "問題 PDF" : "Worksheet PDF",
      sub: isJa ? "A4 / B5 印刷対応" : "A4 / B5 print-ready",
      tone: "from-emerald-500 to-teal-500",
    },
    {
      icon: <FileSignature className="h-4 w-4" />,
      label: isJa ? "解答 PDF" : "Answer-key PDF",
      sub: isJa ? "自動生成" : "Generated automatically",
      tone: "from-amber-500 to-orange-500",
    },
  ];
  return (
    <div className="mt-3 flex items-stretch justify-center gap-1.5 sm:gap-2 text-[11px] sm:text-[12px]">
      {items.map((it, i) => (
        <React.Fragment key={it.label}>
          <div className="flex-1 flex items-center gap-2 px-2.5 sm:px-3 py-2 rounded-xl border border-foreground/[0.08] bg-background/50 backdrop-blur-sm min-w-0">
            <div className={`h-7 w-7 rounded-lg bg-gradient-to-br ${it.tone} flex items-center justify-center text-white shadow-sm shrink-0`}>
              {it.icon}
            </div>
            <div className="min-w-0 text-left">
              <p className="font-semibold tracking-tight truncate">{it.label}</p>
              <p className="text-muted-foreground/70 text-[10px] sm:text-[10.5px] truncate">{it.sub}</p>
            </div>
          </div>
          {i < items.length - 1 && (
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 self-center shrink-0" aria-hidden />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

/* ── Hero 直下: 成果物プレビュー (Worksheet + Answer-key) ──
 *
 * 「成果物で判断する」を意識し、ファーストビューに「実際の出力」を見せる:
 *   - 左: 二次関数 / 三角関数 / 対数 / 積分 をミックスした問題集 (display 数式 + 配点バッジ)
 *   - 右: 解答に SVG グラフ (放物線 + 頂点 + 軸の交点 ・ 単位円 + 三角比) を含めて
 *         「図入りの解説 PDF」が60秒で出ることを直感的に伝える
 *   - 紙は CSS だけで質感 (二重罫線・角折れ・大学ノート風縦罫・3D 傾き・薄い影)
 *
 * 親側で button にラップ → タップでゲスト生成へ。 */
function WorksheetPreviewDuo({ isJa }: { isJa: boolean }) {
  React.useEffect(() => { ensureKatexCss(); }, []);

  const promptText = isJa
    ? "高1数学・関数と三角比の確認テスト 解答・グラフ付き"
    : "Algebra & trig quiz with answers and graphs";

  return (
    <div className="relative">
      <HeroFlowBadge isJa={isJa} promptText={promptText} />

      <div className="relative grid grid-cols-2 gap-3 sm:gap-5" style={{ perspective: "1500px" }}>
        <div aria-hidden className="absolute inset-x-4 -bottom-3 h-10 rounded-[50%] bg-foreground/15 blur-2xl pointer-events-none" />
        <PreviewPaperWorksheet isJa={isJa} />
        <PreviewPaperAnswerKey isJa={isJa} />
      </div>

      <p className="mt-4 text-center text-[11px] sm:text-[12px] text-muted-foreground/75 font-medium">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-violet-500/25 bg-violet-500/[0.06]">
          <Sparkles className="h-3 w-3 text-violet-500" />
          {isJa ? "タップしてあなたのプリントを作る" : "Tap to generate your own"}
          <ArrowRight className="h-3 w-3 text-violet-500" />
        </span>
      </p>
    </div>
  );
}

/* Hero 用: Prompt → AI → 60s のフロー帯 */
function HeroFlowBadge({ isJa, promptText }: { isJa: boolean; promptText: string }) {
  return (
    <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card border border-foreground/[0.1] text-[11px] sm:text-[12px] font-medium text-foreground/85 shadow-sm max-w-[68vw] sm:max-w-none">
        <Sparkles className="h-3 w-3 text-violet-500 shrink-0" />
        <span className="truncate">{promptText}</span>
      </span>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/55 shrink-0" />
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-blue-500 text-white text-[10.5px] sm:text-[11px] font-extrabold tracking-wider shadow-md shadow-violet-500/30 shrink-0">
        <Zap className="h-3 w-3" />
        {isJa ? "60秒" : "60s"}
      </span>
    </div>
  );
}

/* 共通: 紙の枠 */
function PaperFrame({ children, tilt }: { children: React.ReactNode; tilt: "left" | "right" }) {
  const rotate = tilt === "left" ? "rotateY(4deg) rotate(-1.2deg)" : "rotateY(-4deg) rotate(1.2deg)";
  return (
    <div
      className="relative rounded-[3px] bg-white border border-gray-300/80 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.25),0_4px_10px_-4px_rgba(0,0,0,0.12)] overflow-hidden text-gray-900"
      style={{
        fontFamily: "'Iowan Old Style', 'Palatino Linotype', 'URW Palladio L', 'Hiragino Mincho ProN', 'Yu Mincho', serif",
        backgroundImage:
          "linear-gradient(to bottom, rgba(250,250,247,1), rgba(255,255,255,1)), repeating-linear-gradient(0deg, rgba(0,0,0,0.014) 0 1px, transparent 1px 22px)",
        backgroundBlendMode: "multiply",
        transform: rotate,
        transformOrigin: "center bottom",
      }}
    >
      <div aria-hidden className="absolute top-0 right-0 w-4 h-4 sm:w-5 sm:h-5"
        style={{ background: "linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.08) 50%)" }} />
      <div aria-hidden className="absolute top-0 right-0 w-4 h-4 sm:w-5 sm:h-5"
        style={{
          clipPath: "polygon(100% 0, 100% 100%, 0 0)",
          background: "linear-gradient(135deg, rgba(0,0,0,0.04), rgba(0,0,0,0.12))",
        }} />
      <div aria-hidden className="absolute left-3 sm:left-4 top-0 bottom-0 w-px bg-rose-300/40" />
      {children}
    </div>
  );
}

/* 紙のヘッダ — 二重罫線 + サブ + 名前欄 */
function PaperHeader({
  eyebrow, title, subtitle, isJa, withScore = false, rightBadge,
}: {
  eyebrow: string; title: string; subtitle: string; isJa: boolean;
  withScore?: boolean; rightBadge?: React.ReactNode;
}) {
  return (
    <div className="px-3 sm:px-4 pt-2.5 sm:pt-3">
      <div className="flex items-baseline justify-between text-[7.5px] sm:text-[9px] tracking-[0.22em] uppercase text-gray-500">
        <span>{eyebrow}</span>
        <span>2025 · 05</span>
      </div>
      <div className="border-t-[1.5px] border-gray-800 mt-0.5" />
      <h3 className="text-center text-[12px] sm:text-[15px] font-bold tracking-wide leading-tight pt-1.5">
        {title}
      </h3>
      <p className="text-center text-[8px] sm:text-[10px] text-gray-500 leading-tight pb-1">
        {subtitle}
      </p>
      <div className="border-t border-gray-800" />
      <div className="border-t border-gray-800 mt-[1.5px]" />
      {withScore ? (
        <div className="flex items-end justify-between gap-2 mt-1.5 text-[7.5px] sm:text-[9px] text-gray-500">
          <span className="flex items-baseline gap-1">
            <span>{isJa ? "氏名" : "Name"}</span>
            <span className="border-b border-gray-500 w-12 sm:w-20 inline-block mb-0.5" />
          </span>
          <span className="flex items-baseline gap-1">
            <span className="border-b border-gray-500 w-7 inline-block mb-0.5" />
            <span>/100</span>
          </span>
        </div>
      ) : rightBadge ? (
        <div className="flex items-end justify-end gap-1 mt-1.5 text-[7.5px] sm:text-[9px] text-gray-500">
          {rightBadge}
        </div>
      ) : null}
    </div>
  );
}

/* 配点バッジ — グラデのソリッド寄り (ザコさ解消) */
function PointsBadge({ pts, isJa }: { pts: string; isJa: boolean }) {
  return (
    <span className="ml-auto inline-flex items-center gap-0.5 px-1.5 py-[1.5px] rounded-full text-[7.5px] sm:text-[9px] font-extrabold tracking-wider text-white bg-gradient-to-r from-amber-500 to-rose-500 shadow-sm shrink-0"
      style={{ fontFamily: "ui-sans-serif, system-ui" }}>
      {pts}{isJa ? "点" : "pt"}
    </span>
  );
}

/* 問題プリント (左) */
function PreviewPaperWorksheet({ isJa }: { isJa: boolean }) {
  return (
    <PaperFrame tilt="left">
      <PaperHeader
        eyebrow={`EDDIVOM · ${isJa ? "確認テスト" : "Quiz"}`}
        title={isJa ? "数学Ⅰ・Ⅱ　関数と三角比" : "Math I/II — Functions & Trig"}
        subtitle={isJa ? "次の各問に答えよ。" : "Answer each problem."}
        withScore
        isJa={isJa}
      />

      <ol className="px-3 sm:px-4 pt-2 pb-3 space-y-2 sm:space-y-2.5">
        {/* 第1問: 二次関数の最大最小 (display 数式) */}
        <li>
          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="text-[10px] sm:text-[12px] font-bold text-gray-700 shrink-0">
              {isJa ? "問1" : "Q1"}
            </span>
            <span className="text-[9px] sm:text-[11px] text-gray-700">
              {isJa ? "次の関数の最小値を求めよ。" : "Find the minimum value."}
            </span>
            <PointsBadge pts="20" isJa={isJa} />
          </div>
          <div className="pl-3 sm:pl-4">
            <PreviewMathDisplay latex="f(x) = x^2 - 6x + 11" />
          </div>
          <div className="ml-3 sm:ml-4 mt-1 h-2 sm:h-3 border-b border-dashed border-gray-300/80" />
        </li>

        {/* 第2問: 三角比 (分数 + 平方根) */}
        <li>
          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="text-[10px] sm:text-[12px] font-bold text-gray-700 shrink-0">
              {isJa ? "問2" : "Q2"}
            </span>
            <span className="text-[9px] sm:text-[11px] text-gray-700">
              {isJa ? "次の値を計算せよ。" : "Evaluate."}
            </span>
            <PointsBadge pts="20" isJa={isJa} />
          </div>
          <div className="pl-3 sm:pl-4">
            <PreviewMathDisplay latex="\sin\dfrac{\pi}{3} + \cos\dfrac{\pi}{6} - \tan\dfrac{\pi}{4}" />
          </div>
          <div className="ml-3 sm:ml-4 mt-1 h-2 sm:h-3 border-b border-dashed border-gray-300/80" />
        </li>

        {/* 第3問: 対数 (display) */}
        <li>
          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="text-[10px] sm:text-[12px] font-bold text-gray-700 shrink-0">
              {isJa ? "問3" : "Q3"}
            </span>
            <span className="text-[9px] sm:text-[11px] text-gray-700">
              {isJa ? "次の方程式を解け。" : "Solve."}
            </span>
            <PointsBadge pts="30" isJa={isJa} />
          </div>
          <div className="pl-3 sm:pl-4">
            <PreviewMathDisplay latex="\log_{2}(x+1) + \log_{2}(x-1) = 3" />
          </div>
          <div className="ml-3 sm:ml-4 mt-1 h-2 sm:h-3 border-b border-dashed border-gray-300/80" />
        </li>

        {/* 第4問: 定積分 (大きな ∫) */}
        <li>
          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="text-[10px] sm:text-[12px] font-bold text-gray-700 shrink-0">
              {isJa ? "問4" : "Q4"}
            </span>
            <span className="text-[9px] sm:text-[11px] text-gray-700">
              {isJa ? "定積分の値を求めよ。" : "Compute."}
            </span>
            <PointsBadge pts="30" isJa={isJa} />
          </div>
          <div className="pl-3 sm:pl-4">
            <PreviewMathDisplay latex="\int_{0}^{2} (3x^2 - 2x + 1)\,dx" />
          </div>
          <div className="ml-3 sm:ml-4 mt-1 h-2 sm:h-3 border-b border-dashed border-gray-300/80" />
        </li>
      </ol>

      <PaperStamp label={isJa ? "問題プリント PDF" : "Worksheet PDF"} color="from-blue-500 to-violet-500" />
    </PaperFrame>
  );
}

/* 解答プリント (右) — グラフ入り */
function PreviewPaperAnswerKey({ isJa }: { isJa: boolean }) {
  return (
    <PaperFrame tilt="right">
      <PaperHeader
        eyebrow={`EDDIVOM · ${isJa ? "解答" : "Answer Key"}`}
        title={isJa ? "解答 ・ 解説" : "Solutions & Explanations"}
        subtitle={isJa ? "図入りの完全解答。" : "Complete answers with figures."}
        rightBadge={
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-500/12 border border-emerald-500/35 text-emerald-700 font-bold">
            <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            {isJa ? "全問正解" : "All correct"}
          </span>
        }
        isJa={isJa}
      />

      <ol className="px-3 sm:px-4 pt-2 pb-3 space-y-2 sm:space-y-2.5">
        {/* 問1 解答 + 放物線グラフ */}
        <li>
          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="text-[10px] sm:text-[12px] font-bold text-gray-700 shrink-0">
              {isJa ? "問1" : "Q1"}
            </span>
            <span className="overflow-hidden">
              <PreviewMathInline latex="f(x)=(x-3)^2+2" />
            </span>
            <CorrectMark />
          </div>
          <div className="flex items-center gap-2 pl-3 sm:pl-4">
            <ParabolaSvg />
            <div className="flex flex-col gap-0.5">
              <span className="text-[8.5px] sm:text-[10.5px] text-gray-700">
                {isJa ? "頂点 " : "vertex "}
                <PreviewMathInline latex="(3,\,2)" />
              </span>
              <span className="text-[8.5px] sm:text-[10.5px] font-semibold text-rose-700">
                {isJa ? "最小値 " : "min = "}
                <PreviewMathInline latex="\boxed{2}" />
              </span>
            </div>
          </div>
        </li>

        {/* 問2 解答 + 単位円 */}
        <li>
          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="text-[10px] sm:text-[12px] font-bold text-gray-700 shrink-0">
              {isJa ? "問2" : "Q2"}
            </span>
            <span className="overflow-hidden">
              <PreviewMathInline latex="\dfrac{\sqrt{3}}{2}+\dfrac{\sqrt{3}}{2}-1=\sqrt{3}-1" />
            </span>
            <CorrectMark />
          </div>
          <div className="flex items-center gap-2 pl-3 sm:pl-4">
            <UnitCircleSvg />
            <span className="text-[8.5px] sm:text-[10.5px] text-gray-700 leading-snug">
              {isJa ? "単位円で " : "From unit circle: "}
              <PreviewMathInline latex="\sin60^\circ=\tfrac{\sqrt{3}}{2}" />
            </span>
          </div>
        </li>

        {/* 問3 解答 — 解法ステップ + 真数条件の数直線図解 */}
        <li>
          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="text-[10px] sm:text-[12px] font-bold text-gray-700 shrink-0">
              {isJa ? "問3" : "Q3"}
            </span>
            <span className="text-[8.5px] sm:text-[10px] font-semibold tracking-wide text-violet-700 shrink-0">
              {isJa ? "対数方程式" : "log eqn"}
            </span>
            <CorrectMark />
          </div>

          {/* 解法ステップ — グラデ縦罫 + numbered chip */}
          <div className="ml-3 sm:ml-4 pl-2.5 border-l-2 border-violet-400/60 space-y-1">
            <SolutionStep n={1} label={isJa ? "真数条件" : "Domain"}>
              <PreviewMathInline latex="x+1>0\;\land\;x-1>0\;\Rightarrow\;x>1" />
            </SolutionStep>
            <SolutionStep n={2} label={isJa ? "和→積に変形" : "Combine logs"}>
              <PreviewMathInline latex="\log_2\bigl\{(x+1)(x-1)\bigr\}=3" />
            </SolutionStep>
            <SolutionStep n={3} label={isJa ? "対数を外す" : "Exponentiate"}>
              <PreviewMathInline latex="x^2-1=2^3=8" />
            </SolutionStep>
            <SolutionStep n={4} label={isJa ? "解の選別" : "Select"}>
              <PreviewMathInline latex="x=\pm 3" />
              <span className="text-[8px] sm:text-[10px] text-gray-500 ml-1">
                {isJa ? "→ 条件より −3 不適" : "→ −3 rejected"}
              </span>
            </SolutionStep>
          </div>

          {/* 真数条件の数直線図解 */}
          <div className="ml-3 sm:ml-4 mt-2 flex items-center gap-2">
            <NumberLineLogDomain />
            <div className="flex flex-col gap-0.5">
              <span className="inline-flex items-center gap-1 text-[8.5px] sm:text-[10px]">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-emerald-700 font-semibold">
                  <PreviewMathInline latex="x=3" /> {isJa ? "可" : "OK"}
                </span>
              </span>
              <span className="inline-flex items-center gap-1 text-[8.5px] sm:text-[10px]">
                <span className="h-2 w-2 rounded-full bg-rose-400" />
                <span className="text-rose-600 line-through">
                  <PreviewMathInline latex="x=-3" />
                </span>
              </span>
            </div>
          </div>

          <div className="ml-3 sm:ml-4 mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gradient-to-r from-amber-100 to-rose-100 border border-rose-300/60">
            <span className="text-[8.5px] sm:text-[10px] font-bold text-rose-800">
              {isJa ? "答 " : "Ans. "}
            </span>
            <PreviewMathInline latex="x=\boxed{3}" />
          </div>
        </li>

        {/* 問4 解答 — 計算式 */}
        <li>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] sm:text-[12px] font-bold text-gray-700 shrink-0">
              {isJa ? "問4" : "Q4"}
            </span>
            <span className="overflow-hidden">
              <PreviewMathInline latex="\bigl[x^3-x^2+x\bigr]_0^2=\boxed{6}" />
            </span>
            <CorrectMark />
          </div>
        </li>
      </ol>

      <PaperStamp label={isJa ? "解答 PDF" : "Answer-key PDF"} color="from-emerald-500 to-teal-500" />
    </PaperFrame>
  );
}

/* 解法ステップ行 — 番号付きチップ + ラベル + 数式 */
function SolutionStep({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5 text-[9px] sm:text-[11px] leading-snug">
      <span
        className="inline-flex items-center justify-center h-3.5 w-3.5 sm:h-4 sm:w-4 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white text-[7.5px] sm:text-[9px] font-extrabold shadow-sm shrink-0"
        style={{ fontFamily: "ui-sans-serif, system-ui" }}
      >
        {n}
      </span>
      <span
        className="text-[7.5px] sm:text-[9px] font-bold tracking-wider uppercase text-violet-700 shrink-0"
        style={{ fontFamily: "ui-sans-serif, system-ui" }}
      >
        {label}
      </span>
      <span className="overflow-hidden">{children}</span>
    </div>
  );
}

/* 真数条件 x>1 の数直線図解 */
function NumberLineLogDomain() {
  // x ∈ [-5, 5] を 0..120 に。x=1 で境界。x=3 は OK、x=-3 は NG
  const W = 120, H = 36;
  const xMin = -5, xMax = 5;
  const sx = (x: number) => ((x - xMin) / (xMax - xMin)) * W;
  const baseY = 22;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-[120px] sm:w-[150px] h-auto shrink-0" aria-hidden>
      <defs>
        <linearGradient id="domainOK" x1="0" x2="1">
          <stop offset="0" stopColor="#10b981" stopOpacity="0.25" />
          <stop offset="1" stopColor="#10b981" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id="domainNG" x1="0" x2="1">
          <stop offset="0" stopColor="#f43f5e" stopOpacity="0.45" />
          <stop offset="1" stopColor="#f43f5e" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      {/* NG 帯 (x ≤ 1) — 斜線パターン風 */}
      <rect x={sx(xMin)} y={baseY - 5} width={sx(1) - sx(xMin)} height="10" fill="url(#domainNG)" />
      {/* OK 帯 (x > 1) */}
      <rect x={sx(1)} y={baseY - 5} width={sx(xMax) - sx(1)} height="10" fill="url(#domainOK)" />
      {/* 数直線本体 */}
      <line x1={sx(xMin)} y1={baseY} x2={sx(xMax)} y2={baseY} stroke="#1f2937" strokeWidth="0.9" />
      {/* 矢印 */}
      <polygon points={`${sx(xMax)},${baseY} ${sx(xMax)-2.5},${baseY-1.5} ${sx(xMax)-2.5},${baseY+1.5}`} fill="#1f2937" />
      {/* 目盛 */}
      {[-3, 0, 1, 3].map((t) => (
        <g key={t}>
          <line x1={sx(t)} y1={baseY - 2} x2={sx(t)} y2={baseY + 2} stroke="#1f2937" strokeWidth="0.7" />
          <text x={sx(t)} y={baseY + 8} fontSize="5.5" fill="#374151" textAnchor="middle">{t}</text>
        </g>
      ))}
      {/* x=1 の境界 (open circle) */}
      <circle cx={sx(1)} cy={baseY} r="2" fill="white" stroke="#1f2937" strokeWidth="1" />
      <text x={sx(1)} y={baseY - 7} fontSize="5.5" fill="#374151" textAnchor="middle" fontStyle="italic">x&gt;1</text>
      {/* x=3 OK (filled green) */}
      <circle cx={sx(3)} cy={baseY} r="2.4" fill="#10b981" stroke="white" strokeWidth="0.8" />
      {/* x=-3 NG (rose with X) */}
      <circle cx={sx(-3)} cy={baseY} r="2.4" fill="#f43f5e" stroke="white" strokeWidth="0.8" />
      <line x1={sx(-3) - 1.5} y1={baseY - 1.5} x2={sx(-3) + 1.5} y2={baseY + 1.5} stroke="white" strokeWidth="0.9" />
      <line x1={sx(-3) - 1.5} y1={baseY + 1.5} x2={sx(-3) + 1.5} y2={baseY - 1.5} stroke="white" strokeWidth="0.9" />
    </svg>
  );
}

/* 採点風の赤マル */
function CorrectMark() {
  return (
    <span aria-hidden className="ml-auto relative h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0">
      <svg viewBox="0 0 20 20" className="absolute inset-0 w-full h-full">
        <circle cx="10" cy="10" r="8" fill="none" stroke="rgba(225,29,72,0.85)" strokeWidth="2" strokeLinecap="round"
          strokeDasharray="50.27" strokeDashoffset="0" transform="rotate(-30 10 10)" />
      </svg>
    </span>
  );
}

/* 紙の右下に貼る PDF スタンプ */
function PaperStamp({ label, color }: { label: string; color: string }) {
  return (
    <div className="px-3 sm:px-4 pb-2 flex justify-end">
      <span
        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[3px] text-[8px] sm:text-[9.5px] font-extrabold tracking-[0.15em] text-white bg-gradient-to-r ${color} shadow-sm`}
        style={{ fontFamily: "ui-sans-serif, system-ui" }}
      >
        <FileText className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
        {label}
      </span>
    </div>
  );
}

/* KaTeX inline */
function PreviewMathInline({ latex }: { latex: string }) {
  const { html, ok } = renderMathHTML(latex, { displayMode: false });
  if (ok) return <span className="align-middle [&_.katex]:text-[0.92em] sm:[&_.katex]:text-[1em]" dangerouslySetInnerHTML={{ __html: html }} />;
  return <span className="text-gray-700">{latex}</span>;
}

/* KaTeX display — 数式が「主役」になるよう center + 大きめ */
function PreviewMathDisplay({ latex }: { latex: string }) {
  const { html, ok } = renderMathHTML(latex, { displayMode: true });
  if (ok) {
    return (
      <div
        className="my-0.5 text-center [&_.katex-display]:m-0 [&_.katex]:text-[0.95em] sm:[&_.katex]:text-[1.05em]"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return <div className="text-gray-700 text-center">{latex}</div>;
}

/* TikZ 風の放物線 SVG — y = (x-3)^2 + 2 を [-1, 7] で描画 */
function ParabolaSvg() {
  // 座標系: x ∈ [-1, 7] → 0..120, y ∈ [-1, 12] → 90..0
  const W = 120, H = 90;
  const xMin = -1, xMax = 7, yMin = -1, yMax = 12;
  const sx = (x: number) => ((x - xMin) / (xMax - xMin)) * W;
  const sy = (y: number) => H - ((y - yMin) / (yMax - yMin)) * H;
  const points: string[] = [];
  for (let i = 0; i <= 80; i++) {
    const x = xMin + (i / 80) * (xMax - xMin);
    const y = (x - 3) * (x - 3) + 2;
    points.push(`${sx(x).toFixed(2)},${sy(y).toFixed(2)}`);
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-[88px] sm:w-[120px] h-auto shrink-0" aria-hidden>
      <defs>
        <linearGradient id="parabolaStroke" x1="0" x2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
        <pattern id="grid" width="15" height="15" patternUnits="userSpaceOnUse">
          <path d="M 15 0 L 0 0 0 15" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#grid)" />
      {/* 軸 */}
      <line x1={sx(xMin)} y1={sy(0)} x2={sx(xMax)} y2={sy(0)} stroke="#1f2937" strokeWidth="0.7" />
      <line x1={sx(0)} y1={sy(yMin)} x2={sx(0)} y2={sy(yMax)} stroke="#1f2937" strokeWidth="0.7" />
      {/* 矢印 */}
      <polygon points={`${sx(xMax)},${sy(0)} ${sx(xMax)-2.5},${sy(0)-1.5} ${sx(xMax)-2.5},${sy(0)+1.5}`} fill="#1f2937" />
      <polygon points={`${sx(0)},${sy(yMax)} ${sx(0)-1.5},${sy(yMax)+2.5} ${sx(0)+1.5},${sy(yMax)+2.5}`} fill="#1f2937" />
      {/* 放物線本体 */}
      <polyline points={points.join(" ")} fill="none" stroke="url(#parabolaStroke)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      {/* 頂点 (3, 2) */}
      <circle cx={sx(3)} cy={sy(2)} r="2" fill="#ec4899" stroke="white" strokeWidth="1" />
      <text x={sx(3)+3} y={sy(2)-3} fontSize="6" fill="#be185d" fontWeight="700">(3,2)</text>
      {/* 軸ラベル */}
      <text x={sx(xMax)-4} y={sy(0)+6} fontSize="5.5" fill="#374151">x</text>
      <text x={sx(0)+2} y={sy(yMax)+5} fontSize="5.5" fill="#374151">y</text>
    </svg>
  );
}

/* 単位円 SVG (60° の三角比) */
function UnitCircleSvg() {
  const cx = 45, cy = 45, r = 32;
  const angle = 60 * Math.PI / 180;
  const px = cx + r * Math.cos(angle);
  const py = cy - r * Math.sin(angle);
  return (
    <svg viewBox="0 0 90 90" className="w-[72px] sm:w-[92px] h-auto shrink-0" aria-hidden>
      <defs>
        <linearGradient id="circleStroke" x1="0" x2="1">
          <stop offset="0" stopColor="#10b981" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      {/* 軸 */}
      <line x1="6" y1={cy} x2="86" y2={cy} stroke="#1f2937" strokeWidth="0.7" />
      <line x1={cx} y1="6" x2={cx} y2="86" stroke="#1f2937" strokeWidth="0.7" />
      {/* 円 */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="url(#circleStroke)" strokeWidth="1.6" />
      {/* 半径 (60°) */}
      <line x1={cx} y1={cy} x2={px} y2={py} stroke="#0ea5e9" strokeWidth="1.4" />
      {/* sin / cos の補助線 */}
      <line x1={px} y1={py} x2={px} y2={cy} stroke="#ec4899" strokeWidth="1.2" strokeDasharray="2 1.5" />
      <line x1={cx} y1={cy} x2={px} y2={cy} stroke="#6366f1" strokeWidth="1.2" strokeDasharray="2 1.5" />
      {/* 角度の弧 */}
      <path d={`M ${cx + 10} ${cy} A 10 10 0 0 0 ${cx + 10 * Math.cos(angle)} ${cy - 10 * Math.sin(angle)}`} fill="none" stroke="#f59e0b" strokeWidth="0.9" />
      <text x={cx + 12} y={cy - 4} fontSize="6" fill="#b45309" fontWeight="700">60°</text>
      {/* 点 P */}
      <circle cx={px} cy={py} r="1.8" fill="#0ea5e9" stroke="white" strokeWidth="0.8" />
      {/* ラベル */}
      <text x={px + 1.5} y={py - 2} fontSize="6" fill="#0c4a6e" fontWeight="700">P</text>
      <text x="80" y={cy - 1} fontSize="5.5" fill="#374151">x</text>
      <text x={cx + 1} y="10" fontSize="5.5" fill="#374151">y</text>
    </svg>
  );
}

/* ── 装飾: 黄色マーカー風アンダーライン ──
 * Hero H1 の核フレーズに薄い黄色のハイライトを敷いて、黒文字の重さを和らげる。
 * 背景は半透明 + linear-gradient で「ペンで引いた」感を出している。 */
function HighlightMark({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="relative inline-block"
      style={{
        backgroundImage:
          "linear-gradient(180deg, transparent 58%, rgba(250, 204, 21, 0.55) 58%, rgba(250, 204, 21, 0.55) 92%, transparent 92%)",
        backgroundRepeat: "no-repeat",
      }}
    >
      {children}
    </span>
  );
}

/* ── 装飾: 数値・キーワードに使うグラデ強調 ── */
function GradientWord({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-gradient-to-r from-blue-500 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
      {children}
    </span>
  );
}

/* ── Hero: サンプルプロンプトチップ ──
 * クリックすると prompt を onSubmit に渡し、ゲスト生成フローへ即遷移する。
 * 「何を書いたらいいか分からない」を解消するためのワンクリック起点。
 * 既存の HeroPromptCta と並列に置き、入力フローを壊さない。 */
function HeroSamplePromptChips({ isJa, onSubmit }: { isJa: boolean; onSubmit: (prompt: string) => void }) {
  const samples = isJa
    ? [
        "中2数学 一次関数の確認テスト10問",
        "高校物理 運動方程式の基本問題",
        "小学生向け 分数の計算プリント",
        "回路の基本クイズ 解説付き",
      ]
    : [
        "10 quadratic equation problems with answers",
        "High school physics: forces and motion quiz",
        "Grade 6 fractions worksheet with answer key",
        "Circuit basics quiz with explanations",
      ];
  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <p className="text-[10.5px] sm:text-[11px] font-semibold tracking-wide text-muted-foreground/70 text-left">
          {isJa ? "サンプルから始める：" : "Start from a sample:"}
        </p>
        <p className="text-[10px] sm:text-[10.5px] font-bold tracking-wide text-violet-600 dark:text-violet-400 inline-flex items-center gap-0.5">
          <Sparkles className="h-2.5 w-2.5" />
          {isJa ? "完成後 1タップで類題量産" : "1-tap variants after"}
        </p>
      </div>
      <div className="flex flex-wrap justify-start gap-1.5 sm:gap-2">
        {samples.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSubmit(s)}
            className="text-[11.5px] sm:text-[12px] px-3 py-1.5 rounded-full border border-foreground/[0.1] bg-card/60 text-foreground/85 hover:border-violet-500/35 hover:bg-card hover:-translate-y-0.5 active:scale-[0.98] transition-all"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Hero: Free でできること ──
 * 「無料でどこまで」を初見で明確化。Pro 機能より先に無料体験の価値を見せる。
 * 5 項目を 1 ブロックに纏め、視線がページ下部の Pricing に流れる前に決着させる。 */
function HeroFreePerks({ isJa }: { isJa: boolean }) {
  const items = [
    { label: isJa ? "プリントを1枚生成"           : "Generate 1 worksheet" },
    { label: isJa ? "問題を画面で編集"             : "Edit problems on the page" },
    { label: isJa ? "問題プリントを PDF 出力"      : "Export worksheet PDF" },
    { label: isJa ? "解答 PDF を出力"               : "Export answer-key PDF" },
    { label: isJa ? "✨ 類題ジェネレータ (お試し1回)" : "✨ Variant Studio (1 free trial)" },
    { label: isJa ? "無料アカウントで保存"          : "Save with a free account" },
  ];
  return (
    <div className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.04] p-2.5 sm:p-3 text-left">
      <p className="inline-flex items-center gap-1.5 text-[11px] sm:text-[11.5px] font-bold tracking-wide text-emerald-700 dark:text-emerald-300 mb-2">
        <Check className="h-3.5 w-3.5" />
        {isJa ? "Free でできること" : "Free users can do this"}
      </p>
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {items.map((it) => (
          <li key={it.label} className="inline-flex items-center gap-1.5 text-[12px] sm:text-[12.5px] text-foreground/85">
            <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{it.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Editor Workspace Mockup ── */
/* ── 30-second looping demo ── */
function EditorMockup({ isJa }: { isJa: boolean }) {
  const CYCLE = 38000; // 38 s — 既存 30s デモに「類題生成」核機能フェーズ (~8s) を追加
  // 可視時のみ tick を回す (off-screen / 非表示タブでは完全停止 → TBT を抑える)
  const containerRef = useRef<HTMLDivElement>(null);
  const [tick] = useVisibleInterval(containerRef, 100);

  const e = (tick * 100) % CYCLE; // elapsed ms in current cycle

  // ── Text content ──
  const p1 = isJa ? "二次方程式の練習問題を5問作って" : "Make 5 quadratic equation problems";
  const p2 = isJa ? "もう少し難しくして" : "Make them harder";
  const a1 = isJa ? "5問作成しました。紙面に反映しました。" : "Done — 5 problems created and applied!";
  const a2 = isJa ? "難易度を上げて更新しました。" : "Updated with harder variants.";

  // ── Timeline (ms) — paced to fill ~38 s cycle ──
  // フェーズ:
  //  1) p1 入力 → AI 思考 → 紙面に反映 (Q1)
  //  2) p2 入力 → AI 思考 → 紙面更新 (難しく)
  //  3) ★ 類題ジェネレータ起動 → Style 選択 → 生成 → 別の類題セットに置き換わる
  const T = {
    type1: 2000,  send1: 2000 + p1.length * 130 + 500,
    think1: 0,    ai1: 0,      content1: 0,  applied1: 0,
    type2: 0,     send2: 0,
    think2: 0,    ai2: 0,      content2: 0,  applied2: 0,
    // 類題ジェネレータ・フェーズ
    studioOpen: 0, studioPick: 0, studioRun: 0, studioThink: 0, studioApplied: 0, studioClose: 0,
    fadeOut: 35200,
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
  // ★ 類題フェーズ — 既存の applied2 後に「核機能」として目立たせる
  T.studioOpen    = T.applied2 + 1500;   // ~1.5s 余韻 → Studio オーバーレイがスライドイン
  T.studioPick    = T.studioOpen + 1400; // スタイル "難しく" がハイライト
  T.studioRun     = T.studioPick + 900;  // CTA がクリックされる
  T.studioThink   = T.studioRun + 200;   // 類題生成中 (shimmer overlay)
  T.studioApplied = T.studioThink + 2400;// 紙面に新しい類題セットが反映
  T.studioClose   = T.studioApplied + 700;// オーバーレイが閉じる

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

  // 類題ジェネレータ (★ 核機能フェーズ)
  const showStudio        = e >= T.studioOpen && e < T.studioClose;
  const studioPickedHard  = e >= T.studioPick;     // "もう少し難しく" カードが選択状態
  const studioCtaPressed  = e >= T.studioRun && e < T.studioRun + 350; // CTA がタップされた瞬間 (scale anim)
  const studioGenerating  = e >= T.studioThink && e < T.studioApplied; // 類題生成中の shimmer
  const studioApplied     = e >= T.studioApplied;
  // 紙面に類題版を表示するか — applied 後 〜 (CYCLE 末尾まで)
  const showVariantSet    = e >= T.studioApplied;

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
  // ★ 類題セットが反映された瞬間に紙面全体を violet/fuchsia リングで一瞬光らせる
  const variantFlash = e >= T.studioApplied && e < T.studioApplied + 900;

  // Fade in/out for loop
  const opacity = e >= T.fadeOut ? Math.max(0, 1 - (e - T.fadeOut) / 1800)
                : e < 600 ? e / 600 : 1;

  // Step label for progress bar
  const stepLabel =
    e < T.type1        ? (isJa ? "デモ開始..." : "Starting...") :
    e < T.send1        ? (isJa ? "ユーザーが入力中" : "User typing...") :
    e < T.ai1          ? (isJa ? "AIが分析中..." : "AI thinking...") :
    e < T.applied1     ? (isJa ? "紙面に反映中" : "Applying to page...") :
    e < T.type2        ? (isJa ? "問題が完成" : "Problems created") :
    e < T.send2        ? (isJa ? "追加指示を入力中" : "New instruction...") :
    e < T.ai2          ? (isJa ? "AIが更新中..." : "AI updating...") :
    e < T.studioOpen   ? (isJa ? "更新完了" : "Updated") :
    e < T.studioPick   ? (isJa ? "✨ 類題ジェネレータを起動" : "✨ Opening Variant Studio") :
    e < T.studioRun    ? (isJa ? "スタイルを選択中…" : "Picking a style…") :
    e < T.studioThink  ? (isJa ? "✨ 類題を生成 (核機能)" : "✨ Generate variants (core feature)") :
    e < T.studioApplied? (isJa ? "高精度エンジンで類題を生成中…" : "Generating with Precision Variant Engine…") :
    e < T.fadeOut      ? (isJa ? "★ 類題プリント完成 — 1ボタンで何枚でも" : "★ Variant ready — one tap, infinite worksheets") :
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

        {/* 2-pane + activity bar — `relative` で内部の Variant Studio オーバーレイの absolute を効かせる */}
        <div className="relative flex" style={{ minHeight: "340px" }}>

          {/* Left: animated worksheet */}
          <div className="flex-1 bg-gray-100/60 dark:bg-gray-950/40 flex justify-center items-start py-4 px-3 overflow-hidden">
            <div className="overflow-hidden rounded-md shadow-xl" style={{ width: "248px", height: "308px" }}>
              <div style={{ transform: "scale(0.645)", transformOrigin: "top left", width: "385px", pointerEvents: "none" }}>
                <div
                  className={`relative bg-white rounded-lg shadow-2xl border border-gray-300/50 overflow-hidden select-none transition-all duration-500 ${
                    harderFlash ? "ring-2 ring-amber-400/40" : ""
                  } ${variantFlash ? "ring-4 ring-violet-500/45" : ""}`}
                  style={SERIF}
                >
                  {/* 類題反映直後の紙面右上に "✨ 類題版" バッジを 1 秒だけ載せる */}
                  {showVariantSet && (
                    <span
                      className={`absolute top-2 right-2 z-10 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[8px] font-extrabold tracking-wider text-white bg-gradient-to-r from-violet-500 to-fuchsia-500 shadow-md transition-opacity duration-500 ${
                        variantFlash ? "opacity-100" : "opacity-90"
                      }`}
                      style={{ fontFamily: "ui-sans-serif, system-ui" }}
                    >
                      <Sparkles className="h-2 w-2" />
                      {isJa ? "類題版" : "VARIANT"}
                    </span>
                  )}
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
                            <M t={
                              showVariantSet
                                ? "7x^2 + 11x - 6 = 0"     // ★ 類題版 (難しく + 別係数)
                                : showHarder
                                  ? "5x^2 - 7x + 1 = 0"
                                  : "3x^2 + 5x - 2 = 0"
                            } />{isJa ? "　を解け。" : ""}
                          </p>
                          <div className="ml-6 mt-1 h-10 border-b border-dashed border-gray-200" />
                        </div>
                        <div>
                          <p className="text-[11.5px] text-gray-800 leading-relaxed flex items-baseline gap-1">
                            <span className="text-gray-500 mr-1">(2)</span>
                            <M t={
                              showVariantSet
                                ? "\\log_5 125 + \\log_2 32"  // ★ 類題版
                                : showHarder
                                  ? "\\log_3 27 \\cdot \\log_2 16"
                                  : "\\log_2 8 + \\log_2 4"
                            } />{isJa ? "　の値を求めよ。" : " = ?"}
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
                            ? <span>関数 <M t={
                                showVariantSet
                                  ? "f(x) = 3x^2 - 12x + 7"
                                  : showHarder
                                    ? "f(x) = 2x^2 - 8x + 5"
                                    : "f(x) = x^2 - 4x + 3"
                              } /> について、次の問いに答えよ。</span>
                            : <span><M t={
                                showVariantSet
                                  ? "f(x) = 3x^2 - 12x + 7"
                                  : showHarder
                                    ? "f(x) = 2x^2 - 8x + 5"
                                    : "f(x) = x^2 - 4x + 3"
                              } /> — answer the following.</span>}
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

          {/* Activity Bar — 実エディタと同じ並び (AI / ✨ 類題 / 採点)。
               類題フェーズ中は ✨ アイコンを violet で active にして「ここから起動した」を視覚化。 */}
          <div className="w-8 border-l border-foreground/[0.06] bg-foreground/[0.02] flex flex-col items-center py-2 gap-2">
            {/* AI Chat */}
            <div
              className={`w-5 h-5 rounded flex items-center justify-center transition-all duration-300 ${
                showStudio ? "border-l-2 border-transparent text-muted-foreground/25" : "border-l-2 border-amber-500"
              }`}
              style={!showStudio ? { background: "rgba(245,158,11,0.10)" } : undefined}
            >
              <Sparkles className={`h-3 w-3 ${showStudio ? "text-muted-foreground/30" : "text-amber-500"}`} />
            </div>
            {/* ✨ Variant Studio (類題) — 類題フェーズで光る */}
            <div
              className={`relative w-5 h-5 rounded flex items-center justify-center transition-all duration-300 ${
                showStudio ? "border-l-2 border-violet-500 ring-2 ring-violet-500/35" : "text-muted-foreground/25"
              }`}
              style={showStudio ? { background: "rgba(139,92,246,0.14)" } : undefined}
            >
              <Wand2 className={`h-3 w-3 ${showStudio ? "text-violet-500" : "text-muted-foreground/40"}`} />
              {/* Studio 起動の 1 タップ目に "クリック" っぽい bounce */}
              {e >= T.studioOpen && e < T.studioOpen + 500 && (
                <span aria-hidden className="absolute inset-0 rounded animate-ping bg-violet-500/30" />
              )}
            </div>
            {/* 採点 (placeholder) */}
            <div className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/25">
              <CheckSquare className="h-3 w-3" />
            </div>
          </div>

          {/* ★★★ Variant Studio オーバーレイ — 30秒デモの「核機能」演出 ★★★
                右側からスライドインしてスタイル選択 → CTA タップ → shimmer → 完成
                までを 6〜7 秒で見せる。 */}
          {showStudio && (
            <div
              className="absolute inset-y-0 right-0 z-20 w-[260px] sm:w-[280px] bg-background/97 backdrop-blur-md border-l border-foreground/[0.08] shadow-2xl shadow-violet-500/10 flex flex-col"
              style={{
                animation: "slide-in-right 0.4s ease-out",
                background: "linear-gradient(135deg, rgba(139,92,246,0.06) 0%, rgba(255,255,255,0.95) 50%, rgba(217,70,239,0.05) 100%)",
              }}
            >
              {/* ambient orb */}
              <span aria-hidden className="absolute -top-12 -right-8 w-40 h-40 rounded-full bg-violet-500/15 blur-2xl pointer-events-none" />

              {/* Studio header */}
              <div className="relative flex items-start gap-2 px-3 pt-3 pb-2 border-b border-foreground/[0.05]">
                <div className="relative shrink-0">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 via-fuchsia-500 to-blue-500 flex items-center justify-center shadow-md shadow-violet-500/30">
                    <Wand2 className="h-3.5 w-3.5 text-white" strokeWidth={2.2} />
                  </div>
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-400 border border-background animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="text-[11px] font-bold tracking-tight">
                      {isJa ? "類題ジェネレータ" : "Variant Studio"}
                    </p>
                    <span className="inline-flex items-center gap-0.5 px-1 py-[1px] rounded text-[7.5px] font-extrabold tracking-wider text-violet-700 dark:text-violet-300 bg-violet-500/12 border border-violet-500/35">
                      <Crown className="h-2 w-2" />
                      PRO
                    </span>
                  </div>
                  <p className="text-[8.5px] text-muted-foreground/75 leading-snug mt-0.5 inline-flex items-center gap-0.5">
                    <Zap className="h-2 w-2 text-amber-500" />
                    {isJa ? "瞬時に何枚でも" : "Infinite, in one tap"}
                  </p>
                </div>
              </div>

              {/* Style cards (compact) */}
              <div className="relative flex-1 px-3 py-2.5 space-y-1.5">
                <p className="text-[8.5px] font-bold tracking-wider uppercase text-muted-foreground/65 mb-1">
                  {isJa ? "スタイルを選ぶ" : "Pick style"}
                </p>
                {([
                  { id: "same",   ja: "同じ難易度",       en: "Same",     icon: Sparkles,      color: "violet" },
                  { id: "harder", ja: "もう少し難しく",   en: "Harder",   icon: TrendingUp,    color: "rose"   },
                  { id: "easier", ja: "もう少し易しく",   en: "Easier",   icon: TrendingDown,  color: "emerald"},
                  { id: "format", ja: "別の形式で",       en: "Format",   icon: Shuffle,       color: "amber"  },
                  { id: "more",   ja: "問題数を増やして", en: "More",     icon: Plus,          color: "blue"   },
                ] as const).map((s) => {
                  const isPicked = studioPickedHard && s.id === "harder";
                  const Icon = s.icon;
                  const colorClass =
                    s.color === "violet"  ? "bg-violet-500/12 text-violet-600" :
                    s.color === "rose"    ? "bg-rose-500/12 text-rose-600" :
                    s.color === "emerald" ? "bg-emerald-500/12 text-emerald-600" :
                    s.color === "amber"   ? "bg-amber-500/12 text-amber-600" :
                    "bg-blue-500/12 text-blue-600";
                  return (
                    <div
                      key={s.id}
                      className={`relative flex items-center gap-1.5 px-2 py-1.5 rounded-md border transition-all duration-300 ${
                        isPicked
                          ? "border-rose-500/40 bg-gradient-to-r from-rose-500/[0.10] to-orange-500/[0.06] ring-1 ring-rose-500/30 -translate-y-0.5 shadow-sm shadow-rose-500/15"
                          : "border-foreground/[0.06] bg-foreground/[0.02]"
                      }`}
                    >
                      <span className={`h-5 w-5 shrink-0 rounded ${colorClass} flex items-center justify-center`}>
                        <Icon className="h-2.5 w-2.5" />
                      </span>
                      <span className={`text-[9px] font-semibold leading-tight ${isPicked ? "text-rose-700 dark:text-rose-300" : "text-foreground/80"}`}>
                        {isJa ? s.ja : s.en}
                      </span>
                      {isPicked && (
                        <Check className="ml-auto h-2.5 w-2.5 text-rose-500" strokeWidth={3} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* CTA */}
              <div className="relative px-3 pb-3 pt-1">
                <button
                  type="button"
                  disabled
                  className={`relative w-full inline-flex items-center justify-center gap-1 h-8 rounded-lg text-white text-[10px] font-bold transition-all duration-200 overflow-hidden ${
                    studioCtaPressed ? "scale-[0.96]" : ""
                  }`}
                  style={{
                    background: "linear-gradient(135deg, #7c3aed 0%, #d946ef 50%, #2563eb 100%)",
                    boxShadow: studioCtaPressed
                      ? "0 0 0 4px rgba(139,92,246,0.30)"
                      : "0 4px 12px rgba(139,92,246,0.30)",
                  }}
                >
                  {/* shimmer */}
                  <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full" style={{ animation: "shimmer 2.4s ease-in-out infinite" }} />
                  <Sparkles className="h-3 w-3 relative z-10" />
                  <span className="relative z-10">
                    {studioGenerating ? (isJa ? "生成中…" : "Generating…") : (isJa ? "類題を生成" : "Generate")}
                  </span>
                  {studioGenerating ? null : (
                    <span className="relative z-10 text-[8px] opacity-50 ml-0.5 font-mono">⌘↵</span>
                  )}
                </button>
                <p className="mt-1 text-[8px] text-center text-muted-foreground/65 inline-flex items-center justify-center gap-0.5 w-full">
                  <Zap className="h-2 w-2 text-amber-500" />
                  {isJa ? "Pro: 何枚でも無制限" : "Pro: unlimited"}
                </p>
              </div>

              {/* shimmer overlay during generation */}
              {studioGenerating && (
                <div className="absolute inset-0 bg-background/40 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
                  <div className="flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-blue-600 text-white shadow-2xl shadow-violet-500/40">
                    <div className="relative">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <Sparkles className="absolute -top-0.5 -right-0.5 h-2 w-2 text-amber-300 animate-pulse" />
                    </div>
                    <p className="text-[9px] font-bold tracking-tight text-center">
                      {isJa ? "類題を生成中…" : "Generating…"}
                    </p>
                  </div>
                </div>
              )}

              {/* applied success burst */}
              {studioApplied && e < T.studioApplied + 1200 && (
                <div className="absolute inset-x-3 bottom-12 z-10 px-2 py-1.5 rounded-md bg-emerald-500/95 text-white shadow-md flex items-center gap-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <Check className="h-3 w-3" strokeWidth={3} />
                  <span className="text-[9px] font-bold">{isJa ? "類題プリント完成" : "Variant ready"}</span>
                </div>
              )}
            </div>
          )}
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
// `gradient` プロパティは互換のため受けるだけで描画しない (旧 callers の影響を最小化)
function PersonaCard({ icon, title, desc, bullets }: {
  icon: React.ReactNode; title: string; desc?: string; gradient?: string; bullets?: string[];
}) {
  return (
    <div className="group flex flex-col gap-4 p-7 rounded-2xl bg-card border border-foreground/[0.06] hover:border-foreground/[0.14] hover:shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)] transition-all duration-300">
      <div className="text-foreground/75" aria-hidden>{icon}</div>
      <div className="flex-1">
        <h4 className="text-[15px] font-semibold tracking-tight mb-2">{title}</h4>
        {desc && <p className="text-[12.5px] text-muted-foreground leading-relaxed">{desc}</p>}
        {bullets && (
          <ul className="space-y-1.5 mt-1">
            {bullets.map((b) => (
              <li key={b} className="text-[12.5px] text-muted-foreground leading-relaxed flex gap-2">
                <span aria-hidden className="text-foreground/30 mt-[0.5em] shrink-0">—</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}
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
  // 初回マウント時に katex.min.css を CDN から非同期注入。LP の critical CSS から外して
  // FCP/LCP を改善する。SampleShowcase は below-the-fold なので大半のユーザは見る前に
  // FCP が確定する。
  useEffect(() => {
    ensureKatexCss();
  }, []);
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
      <div className="relative max-w-5xl mx-auto px-6">
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <p className="text-[11px] font-medium tracking-[0.22em] uppercase text-muted-foreground/70 mb-5 flex items-center justify-center gap-3">
            <span aria-hidden className="inline-block h-px w-6 bg-foreground/20" />
            <span className="font-mono text-[10px] text-foreground/45">§ 03</span>
            {isJa ? "ビフォー / アフター" : "Before / After"}
            <span aria-hidden className="inline-block h-px w-6 bg-foreground/20" />
          </p>
          <h2 className="text-[clamp(1.7rem,4vw,2.6rem)] font-bold tracking-tight mb-5 leading-[1.25]">
            {isJa ? "古い教材が、3ステップで新品に。" : "Old worksheet → polished printout in 3 steps."}
          </h2>
          <p className="text-muted-foreground text-[15px] max-w-md mx-auto mb-5 leading-relaxed">
            {isJa
              ? "過去問・スキャン・古い PDF。何からでも始められます。"
              : "Start from any old worksheet, scan, or PDF — Eddivom handles the rest."}
          </p>
          {/* 整合性: PDF/画像取り込みは Pro+ 機能のため、LP 上で明示する。
              Free ユーザーは AI プロンプト or テンプレートから始める動線を利用する。 */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-violet-500/[0.06] border border-violet-500/25 text-[11px] font-medium text-violet-700 dark:text-violet-300">
            <Crown className="h-3 w-3" />
            {isJa
              ? "PDF 取り込みフローは Pro プラン以上で利用可能"
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

          {/* Steps connector — mobile (rainbow を廃し、neutral & 統一トーンに) */}
          <div className="flex md:hidden items-center justify-center gap-3 py-2">
            {[Upload, PenLine, FileDown].map((Icon, i) => (
              <React.Fragment key={i}>
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30" />}
                <div className="h-9 w-9 rounded-full bg-foreground/[0.04] border border-foreground/[0.08] flex items-center justify-center text-foreground/70">
                  <Icon className="h-4 w-4" strokeWidth={1.5} />
                </div>
              </React.Fragment>
            ))}
          </div>
          {/* Steps connector — desktop */}
          <div className="hidden md:flex flex-col items-center justify-center min-w-[130px]">
            {[
              { Icon: Upload, label: isJa ? "アップロード\nAI抽出" : "Upload\nAI extract" },
              { Icon: PenLine, label: isJa ? "編集・類題\n追加" : "Edit &\nadd variants" },
              { Icon: FileDown, label: isJa ? "PDF出力" : "Export PDF" },
            ].map(({ Icon, label }, i) => (
              <React.Fragment key={i}>
                {i > 0 && (
                  <div className="flex flex-col items-center my-0.5">
                    <div className="h-4 w-px bg-foreground/[0.08]" />
                    <ChevronDown className="h-3 w-3 text-muted-foreground/25 -my-0.5" />
                  </div>
                )}
                <div className="h-10 w-10 rounded-full bg-foreground/[0.04] border border-foreground/[0.08] flex items-center justify-center text-foreground/75">
                  <Icon className="h-4 w-4" strokeWidth={1.5} />
                </div>
                <p className="text-[9px] text-muted-foreground/55 text-center leading-tight mt-1.5 whitespace-pre-line">{label}</p>
              </React.Fragment>
            ))}
          </div>

          {/* After */}
          <div className="flex flex-col items-center gap-4">
            <span className="text-[10px] font-medium tracking-wider uppercase px-2.5 py-1 rounded-md border border-foreground/[0.1] text-foreground/65 bg-foreground/[0.02]">
              {isJa ? "完成品" : "After"}
            </span>
            <div className="relative w-full max-w-[270px] mx-auto">
              {/* Ambient glow — 単色の柔らかいシャドウだけに整理 */}
              <div className="absolute -inset-4 -z-10 bg-foreground/[0.04] dark:bg-white/[0.03] rounded-3xl blur-2xl" />
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

/** TemplateGallery
 *  @param initialIsMobile  サーバ側で User-Agent から判定したモバイル真偽値。SSR HTML を
 *  最初から正しいレイアウト (PC or Mobile) で出すために `useIsMobile` の初期値に渡す。
 *  これがないとモバイルユーザは PC レイアウトの SSR HTML を受け取り、ハイドレーション後
 *  に MobileLanding へ swap される → LCP に 2 秒以上の render delay が乗る。
 */
export function TemplateGallery({ initialIsMobile = false }: { initialIsMobile?: boolean } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setDocument = useDocumentStore((s) => s.setDocument);
  const currentPlan = usePlanStore((s) => s.currentPlan);
  // 旧: false → 60ms 後に true へ flip (フェードイン)。だが LCP 要素 (h1) が
  // opacity-0 で paint されないため、低速回線では「element render delay」が 3 秒以上に
  // なる。CVR 訴求のフェードよりパフォーマンス影響の方が重いので初期から表示済みに。
  const [heroLoaded] = useState(true);
  const [powerOpen, setPowerOpen] = useState(false);
  // 「ログインなしで試す」モーダル。すでに使い切ったときだけ「上限到達」UI として表示する。
  // 未使用なら直接 /editor?guest=1 に飛ばす — モーダルで JS 入力させるより
  // 本物のエディタで触らせる方が CVR が上がる。
  const [trialOpen, setTrialOpen] = useState(false);
  const [trialAlreadyUsed, setTrialAlreadyUsed] = useState(false);

  /**
   * 「無料で1枚作ってみる」CTA の挙動。
   *   - まだお試し未使用 → エディタにゲストモードで遷移 (/editor?guest=1)
   *   - 既に使用済み      → モーダルで登録 CTA を出して GA4 limit_reached を発火
   *
   * GA4: クリック自体を free_trial_cta_click で必ず計測 (CTR を CTA 位置別に取れるよう
   * placement を渡す)。これがないと「LP に来てもクリックされたか」が見えない。
   */
  const openTrialOrLimit = (placement: string = "hero", initialPrompt?: string) => {
    trackFreeTrialCtaClick({ placement });
    // LP 上のプロンプト入力 CTA を踏んだ場合は、ユーザの prompt を sessionStorage に
    // 預けてからエディタに遷移する。エディタ側がマウント時にこの値を拾って
    // pendingChatMessage に流し込み、AI チャット欄が即その prompt を実行する。
    if (typeof window !== "undefined") {
      const trimmed = initialPrompt?.trim();
      if (trimmed) sessionStorage.setItem("lp_initial_prompt", trimmed);
      else sessionStorage.removeItem("lp_initial_prompt");
    }
    // ログイン済み (有効な next-auth セッション cookie あり) なら guest=1 動線を踏まずに、
    // 本人のセッションのまま /editor?new=1 へ。ゲストモード扱いを避ける。
    if (sessionStatus === "authenticated") {
      setDocument(createDefaultDocument("blank", getTemplateLatex("blank")));
      router.push("/editor?new=1");
      return;
    }
    if (hasUsedAnonymousTrial()) {
      setTrialAlreadyUsed(true);
      trackFreeGenerateLimitReached();
      setTrialOpen(true);
      return;
    }
    setTrialAlreadyUsed(false);
    // 即エディタへ。doc は editor 側の useEffect が ?guest=1 を検出した瞬間に
    // 空白テンプレートで埋める。
    router.push("/editor?guest=1");
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
  // 未認証 (status="unauthenticated") の間は localStorage の保存ドキュメントを
  // 「無いもの」として扱う。 これがないとログアウト直後でも前ユーザの保存物が
  // 残り、「続きから編集」CTA が出てしまい、新規ゲスト体験 (= 「無料で1枚作ってみる」)
  // に入れない。 status="loading" は session 解決待ちなので saved を覗かない。
  const { status: sessionStatus } = useSession();
  const savedRaw = typeof window !== "undefined" ? loadFromLocalStorage() : null;
  const saved = sessionStatus === "authenticated" ? savedRaw : null;
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

    // ログイン済み (Free 含む全プラン): 必ず /editor 動線を出す。
    //   - saved あり → 「続きから編集 (planName)」 → /editor
    //   - saved なし → 「白紙で始める (planName)」 → /editor?new=1
    // ゲスト動線 (/editor?guest=1) はログイン済みには絶対に見せない。
    if (sessionStatus === "authenticated") {
      if (saved) {
        return {
          label: isJa ? `続きから編集 (${planName})` : `Resume editing (${planName})`,
          subLabel: saved.metadata.title || (isJa ? "無題の教材" : "Untitled"),
          onClick: handleResume,
          variant: "resume" as const,
        };
      }
      return {
        label: isJa ? `白紙で始める (${planName})` : `Start a new worksheet (${planName})`,
        subLabel: isJa ? `${planName}プランでエディタを開く` : `Open editor on ${planName}`,
        onClick: openEditorBlank,
        variant: "paid-new" as const,
      };
    }

    // 未ログイン (status="unauthenticated" or "loading"): ヒーロー CTA は
    // 「ログインなしお試しモーダル」を直接開く。広告流入ユーザにはここで
    // 触らせることが先 (CVR 検証用)。登録動線は結果画面の登録 CTA に集約する。
    // 顧客目線: "1 枚作る" よりも「60秒 + 類題は何枚でも」の循環価値を訴求。
    return {
      label: isJa ? "60秒で最初の1枚を作る" : "Build my first quiz — free",
      subLabel: isJa ? "登録不要 · 完成後は1タップで何枚でも類題" : "No sign-up · 1-tap variants after",
      onClick: () => openTrialOrLimit("hero"),
      variant: "free" as const,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlan, saved, isJa, sessionStatus]);

  // ── モバイル分岐 — PC 版 LP には一切手を入れず、こちらは別 LP コンポーネント
  // 通常は app/page.tsx が UA で MobileLandingShell を直接 dynamic import するので
  // ここに来るのは「PC で SSR された後にウィンドウを縮めた」エッジケースのみ。
  const isMobile = useIsMobile(initialIsMobile);
  if (isMobile) {
    return (
      <>
        <MobileLanding
          primaryCta={primaryCta}
          scrollToPricing={scrollToPricing}
          scrollToSample={scrollToSample}
          onPlanSelect={handlePlanSelect}
          onPromptSubmit={(prompt) => openTrialOrLimit("hero_prompt", prompt)}
        />
        <AnonymousTrialModal
          open={trialOpen}
          onOpenChange={setTrialOpen}
          onLoginRequested={handleTrialLoginRequested}
          alreadyUsed={trialAlreadyUsed}
          onPlanSelect={handlePlanSelect}
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

            {/* 核機能バッジ — 顧客に伝わる「高精度 類題生成エンジン」訴求。
                 旧「REM 出題ノウハウ駆動」は内部名で意味不明だったので、ベネフィット直結の名前に置換。
                 H1 より先に出して、ユーザに「これがあなたの本当の課題を解決する機能」と提示する。 */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-violet-500/[0.12] via-fuchsia-500/[0.12] to-blue-500/[0.12] border border-violet-500/[0.35] mb-4 sm:mb-5 shadow-md shadow-violet-500/15">
              <Sparkles className="h-3.5 w-3.5 text-violet-500" />
              <span className="bg-gradient-to-r from-violet-600 via-fuchsia-600 to-blue-600 bg-clip-text text-transparent text-[11px] sm:text-[12px] font-extrabold tracking-wider">
                {isJa
                  ? "高精度 類題生成エンジン搭載 · 1問から何枚でも瞬時に量産"
                  : "Weekly quiz maker · for teachers and tutors"}
              </span>
              <span className="inline-flex items-center px-1.5 py-[1px] rounded text-[9px] font-extrabold tracking-wider text-white bg-gradient-to-r from-violet-500 to-fuchsia-500 shadow-sm">
                NEW
              </span>
            </div>

            {/* Headline — 2 軸 (60秒で1枚 + 1タップで何枚でも) を 1 行に並べる */}
            <h1 className="text-[clamp(1.6rem,4.2vw,3.4rem)] leading-[1.08] font-bold tracking-[-0.035em] mb-3 sm:mb-4">
              {isJa ? (
                <>
                  <GradientWord>60秒で1枚</GradientWord>。
                  あとは <HighlightMark>1タップで何枚でも</HighlightMark>。
                </>
              ) : (
                <>
                  <GradientWord>Weekly quizzes in 5 minutes</GradientWord>.{" "}
                  <HighlightMark>Variants in one click</HighlightMark>.
                </>
              )}
            </h1>

            <p className="text-foreground/80 text-[15px] sm:text-[17px] leading-relaxed max-w-2xl mx-auto mb-3 font-medium">
              {isJa ? (
                <>
                  数学・理科のプリントを 60 秒で生成。
                  <span className="text-violet-700 dark:text-violet-300 font-semibold">同じ範囲の類題は、ボタン1つで何枚でも。</span>
                  <span className="text-emerald-700 dark:text-emerald-300 font-semibold"> 最初の1枚は登録不要。</span>
                </>
              ) : (
                <>
                  Build printable quizzes, homework, and answer keys for math &amp; science classes.{" "}
                  <span className="text-violet-700 dark:text-violet-300 font-semibold">Make a fresh worksheet for every student with one click.</span>{" "}
                  <span className="text-emerald-700 dark:text-emerald-300 font-semibold">First quiz is free — no signup.</span>
                </>
              )}
            </p>

            <p className="inline-flex items-center gap-1.5 text-[12.5px] sm:text-[13.5px] text-foreground/70 font-medium mb-5 sm:mb-6">
              <GraduationCap className="h-3.5 w-3.5" />
              {isJa
                ? "生徒ごとに数値だけ変えたい先生へ — 毎週のプリント作りを 数十分 → 数秒 に。"
                : "For high-school math &amp; physics teachers — cut weekly worksheet prep from hours to minutes."}
            </p>
          </div>

          {/* ── プロンプト入力 CTA — Hero ファーストビューに「触れる入力欄」 ──
               未ログインユーザだけに見せる (ログイン済みは「続きから編集 / 白紙で始める」が
               メイン CTA なので、prompt 入力欄を出すと動線が分散する)。 */}
          {primaryCta.variant === "free" && (
            <div className={`relative max-w-2xl mx-auto mb-5 transition-all duration-1000 delay-75 ${heroLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>
              <HeroPromptCta isJa={isJa} onSubmit={(p) => openTrialOrLimit("hero_prompt", p)} />
              <HeroSamplePromptChips isJa={isJa} onSubmit={(p) => openTrialOrLimit("hero_chip", p)} />
            </div>
          )}

          {/* ── 成果物プレビュー: 入力欄の真下に置いて「入力 → これが出てくる」の流れに */}
          {primaryCta.variant === "free" && (
            <div className={`relative max-w-2xl mx-auto mb-6 transition-all duration-1000 delay-100 ${heroLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>
              <div className="flex items-center justify-center gap-1.5 mb-3 text-[11px] sm:text-[12px] font-semibold text-muted-foreground/75">
                <span className="h-px w-8 bg-foreground/15" />
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-foreground/[0.04] border border-foreground/[0.08]">
                  <Zap className="h-3 w-3 text-amber-500" />
                  {isJa ? "60秒で1枚 → 1タップで類題量産" : "5 min for the first quiz → 1 click for variants"}
                </span>
                <span className="h-px w-8 bg-foreground/15" />
              </div>
              <button
                type="button"
                onClick={() => openTrialOrLimit("hero_preview")}
                className="block w-full text-left active:scale-[0.99] transition"
                aria-label={isJa ? "プレビューをタップして自分のプリントを作る" : "Tap preview to make your own"}
              >
                <WorksheetPreviewDuo isJa={isJa} />
              </button>
            </div>
          )}

          {/* ── 補足: 何ができるか + フロー帯 ── */}
          {primaryCta.variant === "free" && (
            <div className={`relative max-w-2xl mx-auto mb-9 sm:mb-10 transition-all duration-1000 delay-150 ${heroLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>
              <HeroFreePerks isJa={isJa} />
              <HeroFlowStrip isJa={isJa} />
            </div>
          )}

          {/* 30 秒の実機デモ ─ CTA より先に "どう動くのか" を見せる */}
          <div className={`relative transition-all duration-1000 delay-200 ${heroLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <p className="inline-flex items-center gap-1.5 text-[11px] text-violet-500/80 font-semibold mb-3">
              <Play className="h-3 w-3 fill-current" />
              {isJa ? "30 秒で実際の画面を見る" : "Watch a real teacher build a quiz — 30s"}
            </p>
            {/* IdleMount: モバイルで FCP/LCP を圧迫する 700+ 行の JSX を idle まで遅らせる。
                 LCP 候補は上の <h1> に移り、ヒーロー文字が先に paint されるようになる。
                 placeholder の minHeight でモックアップ表示前後の CLS を抑える。 */}
            <IdleMount minHeight="360px">
              <EditorMockup isJa={isJa} />
            </IdleMount>

            {/* 機能チップ — モバイルでは折り返し */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
              {[
                { icon: <Sparkles className="h-3 w-3" />, label: isJa ? "AIに指示→即反映" : "Type a topic → see the page" },
                { icon: <FileText className="h-3 w-3" />, label: isJa ? "コンパイル済みPDF" : "Printable PDF" },
                { icon: <Pencil className="h-3 w-3" />, label: isJa ? "紙面を直接編集" : "Edit right on the page" },
                { icon: <RefreshCw className="h-3 w-3" />, label: isJa ? "類題を一瞬で量産" : "1-click variants" },
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
                {isJa ? "サンプル出力を見る" : "See a real worksheet"}
                <ChevronRight className="h-4 w-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </button>
            </div>

            <p className="text-[11px] text-muted-foreground/40 mb-3">
              {primaryCta.subLabel}
            </p>

            {/* モバイル限定の PC 推奨ヒント — 「モバイルでも動く」を先に伝えて離脱を防ぐ */}
            <div className="sm:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-foreground/[0.1] bg-foreground/[0.03] text-foreground/75 text-[11px] font-medium">
              <Smartphone className="h-3 w-3" aria-hidden />
              <span>
                {isJa
                  ? "モバイル対応 · 編集は PC が快適"
                  : "Works on mobile · Best editing experience on desktop"}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ━━ Trust signals bar ━━ */}
      <section className="border-y border-foreground/[0.04] bg-foreground/[0.008] dark:bg-white/[0.01] py-5">
        <div className="max-w-5xl mx-auto px-6 flex flex-wrap items-center justify-center gap-3">
          <TrustBadge icon={<Zap className="h-3.5 w-3.5" />} label={isJa ? "LuaLaTeX 組版エンジン" : "Print-quality typesetting"} />
          <TrustBadge icon={<Shield className="h-3.5 w-3.5" />} label={isJa ? "無料プランあり・登録不要" : "Free plan · no signup needed"} />
          <TrustBadge icon={<Printer className="h-3.5 w-3.5" />} label={isJa ? "A4/B5 印刷対応" : "Ready for A4/B5 printing"} />
          <TrustBadge icon={<Star className="h-3.5 w-3.5" />} label={isJa ? "数式・図・化学式対応" : "Math, diagrams & chemistry"} />
        </div>
      </section>

      <SampleShowcase isJa={isJa} onTryNow={primaryCta.onClick} ctaLabel={primaryCta.label} />

      {/* ━━ Who is this for ━━ */}
      <section className="relative py-24">
        <div
          ref={personaFade.ref}
          className={`relative max-w-5xl mx-auto px-6 transition-all duration-1000 ${personaFade.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          <div className="mb-14 max-w-3xl">
            <p className="text-[11px] font-medium tracking-[0.22em] uppercase text-muted-foreground/70 mb-5 flex items-center gap-2">
              <span aria-hidden className="inline-block h-px w-6 bg-foreground/25" />
              <span className="font-mono text-[10px] text-foreground/45">§ 01</span>
              {isJa ? "こんな先生に" : "Built for teachers"}
            </p>
            <h2 className="text-[clamp(1.7rem,4vw,2.6rem)] font-bold tracking-tight mb-5 leading-[1.25]">
              {isJa ? (
                <>毎週、生徒ごとに <span className="italic font-serif font-semibold text-foreground/85">プリントを手作り</span> する先生へ。</>
              ) : (
                <>Save <span className="italic font-serif font-semibold text-foreground/85">hours</span> of weekly worksheet prep.</>
              )}
            </h2>
            <p className="text-muted-foreground text-[15px] max-w-xl leading-relaxed">
              {isJa
                ? "生徒に合わせた教材を毎週手作りしていませんか？ Eddivom なら、過去問の再利用も類題の量産も数分で完了します。"
                : "Spend less time formatting weekly quizzes and homework — and more time teaching. Build, edit, and print without rewriting LaTeX."}
            </p>
          </div>

          {/* 3 equal personas — no rainbow, consistent neutral cards. 主動線である
              「個人塾・家庭教師」は冒頭に配置し、bullets を出すことで自然に注目を集める。 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <PersonaCard
              icon={<GraduationCap className="h-6 w-6" strokeWidth={1.4} />}
              title={isJa ? "個人塾・家庭教師" : "High-school teachers"}
              bullets={[
                isJa ? "生徒ごとに違うプリントを毎週作る" : "A different weekly quiz for each class",
                isJa ? "過去のプリントを数値だけ変えて再利用" : "Reuse last week's worksheet — just swap the numbers",
                isJa ? "「あと5問」で類題を一瞬で追加" : "\"5 more like this\" — variants in one click",
                isJa ? "解答付きPDFで採点・保護者説明も楽" : "Answer-key PDFs make Monday grading easy",
              ]}
            />
            <PersonaCard
              icon={<Users className="h-6 w-6" strokeWidth={1.4} />}
              title={isJa ? "学校の教科担当" : "Math & physics tutors"}
              desc={isJa
                ? "小テスト・定期テストを効率よく作成。解答付きPDFで採点まで一気通貫。"
                : "Build per-student homework with answer keys. Make grading and parent reports painless."}
            />
            <PersonaCard
              icon={<BookOpen className="h-6 w-6" strokeWidth={1.4} />}
              title={isJa ? "教材制作・販売" : "Cram-school instructors"}
              desc={isJa
                ? "問題集やドリルを作って配布・販売。印刷品質のPDFを大量に書き出せます。"
                : "Print-ready problem sets, every week, without rebuilding from scratch."}
            />
          </div>
        </div>
      </section>

      {/* ━━ Outcome stats ━━
          「数値」を主役に。rainbow グラデを廃し、editorial な大きな数字 +
          静かなキー線で人が組んだ印象を出す。 */}
      <section className="relative border-y border-foreground/[0.05]">
        <div className="relative max-w-5xl mx-auto px-6 py-20">
          <p className="text-center text-[11px] font-medium tracking-[0.22em] uppercase text-muted-foreground/70 mb-12 flex items-center justify-center gap-3">
            <span aria-hidden className="inline-block h-px w-6 bg-foreground/20" />
            <span className="font-mono text-[10px] text-foreground/45">§ 02</span>
            {isJa ? "数字で見る Eddivom" : "Eddivom in numbers"}
            <span aria-hidden className="inline-block h-px w-6 bg-foreground/20" />
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-foreground/[0.06]">
            {[
              { display: isJa ? "30–60s" : "5 min", label: isJa ? "1枚を AI が組み上げる目安時間" : "from idea to a printable quiz" },
              { display: isJa ? "1 クリック" : "1 click", label: isJa ? "「あと5問」で類題を量産" : "for the next student's variant" },
              { display: "A4 / B5", label: isJa ? "印刷品質の PDF を出力" : "ready for the classroom printer" },
              { display: isJa ? "ブラウザ完結" : "In browser", label: isJa ? "インストール不要・登録なしで開始" : "no install, no signup" },
            ].map((s, i) => (
              <div key={s.label} className={`px-4 ${i === 0 ? "pt-0 md:pl-0" : "pt-8 md:pt-0 md:pl-8"} ${i < 3 ? "pb-8 md:pb-0 md:pr-8" : ""}`}>
                <p className="text-[clamp(1.6rem,3.4vw,2.4rem)] font-semibold tracking-tight text-foreground leading-[1.1] mb-3">
                  {s.display}
                </p>
                <p className="text-[12.5px] text-muted-foreground leading-relaxed">{s.label}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-[11px] text-muted-foreground/55 mt-12 italic">
            {isJa
              ? "* 実測値。LuaLaTeX による組版で、A4 / B5 共に 600dpi 級の印刷品質を出します。"
              : "* Measured numbers. LuaLaTeX-typeset, print-grade at A4 and B5."}
          </p>
        </div>
      </section>

      <BeforeAfterSection isJa={isJa} />

      {/* ━━ Workflow ━━
        Free で完結する 4 ステップをメインに置き、
        その下に「Pro で解放される拡張機能」を別ブロックで見せる構成。
        (以前は 5 ステップで PDF 取り込み=OCR を最初に置いていたが、
        OCR は Pro+ 機能なので Free ユーザーが実行できず LP の整合性を損ねていた) */}
      <section className="relative py-28">
        <div
          ref={workflowFade.ref}
          className={`relative max-w-5xl mx-auto px-6 transition-all duration-1000 ${workflowFade.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          <div className="mb-14 max-w-3xl">
            <p className="text-[11px] font-medium tracking-[0.22em] uppercase text-muted-foreground/70 mb-5 flex items-center gap-2">
              <span aria-hidden className="inline-block h-px w-6 bg-foreground/25" />
              <span className="font-mono text-[10px] text-foreground/45">§ 04</span>
              {isJa ? "ワークフロー" : "How it works"}
            </p>
            <h2 className="text-[clamp(1.7rem,4vw,2.6rem)] font-bold tracking-tight mb-5 leading-[1.25]">
              {isJa ? (
                <>Free でも、<span className="italic font-serif font-semibold text-foreground/85">4 ステップ</span> で 1 枚完成。</>
              ) : (
                <>A worksheet in <span className="italic font-serif font-semibold text-foreground/85">four steps</span> — even on Free.</>
              )}
            </h2>
            <p className="text-muted-foreground text-[15px] max-w-xl leading-relaxed">
              {isJa
                ? "AI への指示から PDF 印刷まで、ブラウザだけで完結します。Pro にアップグレードすると、PDF 取り込み・採点・バッチ量産までフローが拡張されます。"
                : "From AI prompt to print-ready PDF, entirely in the browser. Upgrade to Pro to unlock PDF ingestion, grading, and batch generation."}
            </p>
          </div>

          {/* ── Free で完結する 4 ステップ ──
              編集方針: 完璧な 4 列カードグリッドは "AI が組んだ" 感が強いので、
              編集記事ライクな番号付きリストに置き換える。各エントリは:
                ① セリフ体の特大番号 (微回転) を margin に hanging
                ② アイコンはタイトル横に小さい inline glyph として
                ③ 説明文は max-w で改行を制御
                ④ 一部のステップだけ余白に italic の脚注 — 全部つけないことで「人が選んだ」感
              アイコン位置・有無・余白を意図的に揃えないことで、完璧さを壊す。 */}
          <ol className="border-t border-foreground/[0.08]">
            {[
              {
                num: "01",
                rotate: "-1.5deg",
                icon: <Sparkles className="h-4 w-4" strokeWidth={1.5} />,
                title: isJa ? "AIにお願い" : "Ask the AI",
                desc: isJa ? "「二次方程式のプリントを10問」など、自然言語で投げるだけ。テンプレ選択から始めてもOK。" : "Describe what you need — e.g. \"10 quadratic problems\". Or start from a template.",
                aside: isJa ? "たいてい数十秒で 1 枚目が組み上がります。" : "Usually drafts the first sheet in seconds.",
              },
              {
                num: "02",
                rotate: "0.8deg",
                icon: <PenLine className="h-4 w-4" strokeWidth={1.5} />,
                title: isJa ? "紙面で直接編集" : "Edit on the page",
                desc: isJa ? "数式・配点・設問を、出来上がった紙面の上でクリックして直す。LaTeX の知識は要りません。" : "Click any equation, score, or prompt right on the rendered sheet. No LaTeX needed.",
                aside: null,
              },
              {
                num: "03",
                rotate: "-0.6deg",
                icon: <Copy className="h-4 w-4" strokeWidth={1.5} />,
                title: isJa ? "AIで類題を追加" : "AI adds variants",
                desc: isJa ? "「もう5問」と頼むと、数値や難易度を変えた類題が即追加されます。" : "\"5 more like this\" — fresh variants with different numbers or difficulty.",
                aside: isJa ? "* AI の呼び出し回数はプランごとに上限があります。" : "* AI call quota depends on your plan.",
              },
              {
                num: "04",
                rotate: "1.2deg",
                icon: <FileDown className="h-4 w-4" strokeWidth={1.5} />,
                title: isJa ? "PDF 出力・印刷" : "Export & print",
                desc: isJa ? "生徒用と解答付きの 2 種類を、まとめて PDF へ。A4 / B5 そのまま印刷できます。" : "Student sheet + answer key, exported together. Prints clean on A4 or B5.",
                aside: isJa ? "印刷したまま配れる組版品質。" : "Print-grade typesetting.",
              },
            ].map((s) => (
              <li
                key={s.num}
                className="grid grid-cols-[64px_1fr] sm:grid-cols-[110px_1fr_auto] gap-x-6 sm:gap-x-8 gap-y-2 items-baseline py-8 sm:py-9 border-b border-foreground/[0.08]"
              >
                <span
                  className="text-[44px] sm:text-[56px] font-light text-foreground/25 tabular-nums leading-none tracking-tight inline-block select-none"
                  style={{
                    fontFamily: 'ui-serif, "Iowan Old Style", "Apple Garamond", Georgia, serif',
                    transform: `rotate(${s.rotate})`,
                    transformOrigin: "left baseline",
                  }}
                  aria-hidden
                >
                  {s.num}.
                </span>
                <div className="min-w-0 max-w-[44ch]">
                  <h3 className="text-[16px] sm:text-[17px] font-semibold tracking-tight mb-2 flex items-baseline gap-2 flex-wrap">
                    <span aria-hidden className="text-foreground/55 self-center -mb-0.5">{s.icon}</span>
                    <span>{s.title}</span>
                  </h3>
                  <p className="text-[13px] text-muted-foreground leading-[1.7]">{s.desc}</p>
                  {s.aside && (
                    <p
                      className="mt-2.5 text-[11.5px] italic text-muted-foreground/70 leading-relaxed"
                      style={{ fontFamily: 'ui-serif, "Iowan Old Style", Georgia, serif' }}
                    >
                      {s.aside}
                    </p>
                  )}
                </div>
                <span className="hidden sm:inline-flex justify-self-end self-start items-center text-[10px] font-medium tracking-wide px-1.5 py-0.5 rounded-md border text-foreground/55 bg-foreground/[0.04] border-foreground/[0.08]">
                  {isJa ? "Freeでも" : "Free"}
                </span>
              </li>
            ))}
          </ol>

          {/* ── Pro で解放される拡張フロー ──
              主ステップ (01–04) と視覚的に差別化: ローマ数字 (i / ii / iii) を margin に置く
              アノテーション形式。カードを廃して「同じ行に並んだ脚注」のような扱い。 */}
          <div className="mt-16 relative pt-7 border-t-[1.5px] border-foreground/15">
            <span className="absolute -top-3 left-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-background border border-violet-500/30 text-violet-700 dark:text-violet-300 text-[10.5px] font-semibold tracking-wide">
              <Crown className="h-3 w-3" />
              {isJa ? "Pro 以上で解放" : "Unlocked on Pro"}
            </span>
            <p className="text-[13px] text-muted-foreground/85 mb-7 max-w-[44ch] leading-relaxed">
              {isJa
                ? "ここから先は、有料プランでさらに広がるフロー。お持ちの素材から始めたり、採点まで一気に流せます。"
                : "Paid plans extend the flow — start from existing materials, or run all the way through grading."}
            </p>
            <ol className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-7">
              {[
                {
                  numeral: "i",
                  icon: <Upload className="h-3.5 w-3.5" strokeWidth={1.5} />,
                  title: isJa ? "PDF・画像から取り込み" : "PDF / image ingest",
                  desc: isJa ? "過去問のスキャンや古い PDF を、AI が自動で編集可能な問題に起こします (OCR)。" : "Scanned exams or old PDFs become editable problems via OCR.",
                },
                {
                  numeral: "ii",
                  icon: <ClipboardCheck className="h-3.5 w-3.5" strokeWidth={1.5} />,
                  title: isJa ? "採点・自動赤入れ" : "AI grading & markup",
                  desc: isJa ? "答案画像を投げると、AI 採点 → TikZ で赤入れした PDF まで一気通貫で出ます。" : "Answer images → AI grading → marked-up PDF with TikZ overlay.",
                },
                {
                  numeral: "iii",
                  icon: <Layers className="h-3.5 w-3.5" strokeWidth={1.5} />,
                  title: isJa ? "CSV からバッチ生成" : "Batch from CSV",
                  desc: isJa ? "変数を含む CSV を流し込むと、クラス別・生徒別の PDF が一括で書き出されます。" : "Pour in a CSV of variables, get per-student or per-class PDFs in one go.",
                  aside: isJa ? "Pro 100 行 / Premium 300 行まで。" : "Up to 100 rows on Pro, 300 on Premium.",
                },
              ].map((p) => (
                <li key={p.numeral} className="relative pl-7">
                  <span
                    aria-hidden
                    className="absolute left-0 top-0 text-[15px] italic font-medium text-violet-600/70 dark:text-violet-400/70 tabular-nums select-none"
                    style={{ fontFamily: 'ui-serif, "Iowan Old Style", Georgia, serif' }}
                  >
                    {p.numeral}.
                  </span>
                  <h4 className="text-[14px] font-semibold tracking-tight mb-1.5 flex items-baseline gap-2">
                    <span aria-hidden className="text-foreground/55 self-center -mb-0.5">{p.icon}</span>
                    <span>{p.title}</span>
                  </h4>
                  <p className="text-[12.5px] text-muted-foreground leading-[1.7]">{p.desc}</p>
                  {"aside" in p && p.aside && (
                    <p
                      className="mt-2 text-[11px] italic text-muted-foreground/65"
                      style={{ fontFamily: 'ui-serif, "Iowan Old Style", Georgia, serif' }}
                    >
                      — {p.aside}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </div>

          {/* Workflow 下の主要 CTA — ユーザー状態に応じてラベル/動作が切り替わる */}
          <div className="mt-14 flex flex-col items-start gap-3">
            <button
              onClick={primaryCta.onClick}
              className="group inline-flex items-center gap-2.5 pl-7 pr-6 h-12 rounded-full bg-foreground text-background font-semibold text-[14px] hover:opacity-90 active:scale-[0.98] transition-all duration-200"
            >
              {primaryCta.variant === "resume"
                ? (isJa ? "このワークフローで続きから編集" : "Continue with this workflow")
                : primaryCta.variant === "paid-new"
                ? (isJa ? "このワークフローで1枚作ってみる" : "Run this workflow now")
                : (isJa ? "このワークフローを無料で試す" : "Try this workflow free")}
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform duration-200" />
            </button>
            <p className="text-[12px] text-muted-foreground/60">
              {isJa
                ? "アップロード・画像・テキスト、どれからでも始められます。"
                : "Start from PDF, photo, or plain text — your choice."}
            </p>
          </div>
        </div>
      </section>

      {/* ━━ Figure Drawing — Free でも使える図形描画 ━━
          AI 生成だけでは伝わらない「TikZ 図形を直接描ける」差別化ポイント。
          回路・幾何・力学・化学・生物まで対応する domain palette が無料プランで利用可能。 */}
      <section className="relative py-28 border-t border-foreground/[0.05]">
        <div className="relative max-w-5xl mx-auto px-6">
          <div className="mb-12 max-w-3xl">
            <p className="text-[11px] font-medium tracking-[0.22em] uppercase text-muted-foreground/70 mb-5 flex items-center gap-2">
              <span aria-hidden className="inline-block h-px w-6 bg-foreground/25" />
              <span className="font-mono text-[10px] text-foreground/45">§ 05</span>
              {isJa ? "図形描画" : "Figure mode"}
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9.5px] font-medium tracking-wide border text-foreground/55 bg-foreground/[0.04] border-foreground/[0.08]">
                {isJa ? "Freeでも" : "Free"}
              </span>
            </p>
            <h2 className="text-[clamp(1.7rem,4vw,2.6rem)] font-bold tracking-tight mb-5 leading-[1.25]">
              {isJa ? (
                <>図も、<span className="italic font-serif font-semibold text-foreground/85">手で</span> 描ける。</>
              ) : (
                <>Figures, drawn <span className="italic font-serif font-semibold text-foreground/85">by hand</span>.</>
              )}
            </h2>
            <p className="text-muted-foreground text-[15px] max-w-xl leading-relaxed">
              {isJa
                ? "回路図・力学・幾何・化学・生物・フローチャートまで。専用の図形パレットで、TikZ コードを書かずに教材用の図を直感的に描けます。無料プランで制限なく利用できます。"
                : "Circuits, mechanics, geometry, chemistry, biology, flowcharts. A built-in shape palette lets you draw textbook-quality figures without writing TikZ — and it's all free."}
            </p>
          </div>

          <IdleMount minHeight="360px">
            <FigureDrawMockup isJa={isJa} />
          </IdleMount>

          {/* 補足チップ — 何が描けるかを列挙 (SEO 兼 ユーザー安心材料) */}
          <div className="flex flex-wrap items-center gap-2 mt-8">
            {(isJa
              ? ["回路図 (Circuitikz)", "力学・てこ・ばね", "幾何・座標・関数", "化学式・分子", "生物・細胞", "フローチャート"]
              : ["Circuits (Circuitikz)", "Mechanics", "Geometry & functions", "Chemistry", "Biology", "Flowcharts"]
            ).map((label) => (
              <span
                key={label}
                className="inline-flex items-center px-2.5 py-1 rounded-md bg-foreground/[0.025] border border-foreground/[0.07] text-[11.5px] text-foreground/65 font-medium"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ━━ Features ━━
          編集方針: 6 つのカードに 6 種類の rainbow グラデを当てていた旧実装は
          「AI が雑に並べた感」が強い。アイコンを統一トーンの thin-stroke に固定し、
          カードサイズも統一して editorial に見せる。プラン区分は ChIP のみで表現。 */}
      <section className="relative py-28 border-t border-foreground/[0.05]">
        <div
          ref={featuresFade.ref}
          className={`relative max-w-5xl mx-auto px-6 transition-all duration-1000 ${featuresFade.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          <div className="mb-16 max-w-3xl">
            <p className="text-[11px] font-medium tracking-[0.22em] uppercase text-muted-foreground/70 mb-5 flex items-center gap-2">
              <span aria-hidden className="inline-block h-px w-6 bg-foreground/25" />
              <span className="font-mono text-[10px] text-foreground/45">§ 06</span>
              {isJa ? "機能" : "Features"}
            </p>
            <h2 className="text-[clamp(1.7rem,4vw,2.6rem)] font-bold tracking-tight mb-5 leading-[1.25]">
              {isJa ? (
                <>問題作成から配布まで、<span className="italic font-serif font-semibold text-foreground/85">全部ここで</span>。</>
              ) : (
                <>Everything between &ldquo;I need a worksheet&rdquo; and <span className="italic font-serif font-semibold text-foreground/85">&ldquo;it&rsquo;s printing.&rdquo;</span></>
              )}
            </h2>
            <p className="text-muted-foreground text-[15px] max-w-xl leading-relaxed">
              {isJa
                ? "LaTeX の知識は要りません。数式・図・採点まで、Eddivom が組版品質で仕上げます。"
                : "No LaTeX knowledge needed. Eddivom handles typesetting, figures, and grading."}
            </p>
          </div>

          {/* 6 features — 全カード同サイズ、同トーン。違いは「Free / Pro」の chip だけ。 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-foreground/[0.06] rounded-2xl overflow-hidden border border-foreground/[0.06]">
            {[
              {
                icon: <Upload className="h-5 w-5" strokeWidth={1.4} />,
                title: isJa ? "PDF・画像から教材を再利用" : "Reuse your existing worksheets",
                desc: isJa
                  ? "既存の教材 PDF・過去問・画像をアップロードするだけ。問題を自動で認識・抽出し、そのまま編集できます。"
                  : "Upload a PDF you already made or a past exam photo. Problems are auto-extracted — equations intact — and ready to edit.",
                planBadge: "pro" as const,
              },
              {
                icon: <PenLine className="h-5 w-5" strokeWidth={1.4} />,
                title: isJa ? "問題ごとに Word 感覚で編集" : "Edit problem by problem",
                desc: isJa
                  ? "数式・選択肢・配点・解説をクリックして直接編集。問題の入れ替えや並べ替えも自在です。"
                  : "Click any equation, answer choice, or point value and just type. Reorder and rearrange problems freely.",
                planBadge: "free" as const,
              },
              {
                icon: <Copy className="h-5 w-5" strokeWidth={1.4} />,
                title: isJa ? "類題を即座に量産" : "Spin up variants instantly",
                desc: isJa
                  ? "1 問から数値・条件・難易度を変えたバリエーションを一括生成。演習量を一気に増やせます。"
                  : "One problem becomes five — or fifty. Different numbers, different difficulty, same skill.",
                planBadge: "free" as const,
              },
              {
                icon: <CheckSquare className="h-5 w-5" strokeWidth={1.4} />,
                title: isJa ? "解答付き PDF をワンクリック" : "Answer key included automatically",
                desc: isJa
                  ? "生徒用と解答付きの 2 種類をボタン一つで書き出し。採点・配布もすぐ始められます。"
                  : "Student version and answer key export separately with one click.",
                planBadge: "free" as const,
              },
              {
                icon: <Printer className="h-5 w-5" strokeWidth={1.4} />,
                title: isJa ? "印刷に強い A4 / B5 レイアウト" : "Print-ready, every time",
                desc: isJa
                  ? "プロ品質の組版で印刷配布に最適。余白・フォント・レイアウトも細かく調整できます。"
                  : "Professional typesetting with clean margins and crisp equations. Prints beautifully.",
                planBadge: "free" as const,
              },
              {
                icon: <Sparkles className="h-5 w-5" strokeWidth={1.4} />,
                title: isJa ? "テキストからも問題を生成" : "Generate problems from scratch",
                desc: isJa
                  ? "「二次方程式を 5 問」のように指示するだけで問題を自動生成。ゼロからでも始められます。"
                  : "Type \"10 factoring problems, medium difficulty\" and get a full worksheet.",
                planBadge: "free" as const,
              },
            ].map((f) => (
              <div
                key={f.title}
                className="relative p-7 bg-card hover:bg-foreground/[0.015] dark:hover:bg-white/[0.02] transition-colors duration-300"
              >
                <span
                  className={`absolute top-5 right-5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium tracking-wide border ${
                    f.planBadge === "pro"
                      ? "text-violet-700 dark:text-violet-300 bg-violet-500/[0.06] border-violet-500/25"
                      : "text-foreground/55 bg-foreground/[0.04] border-foreground/[0.08]"
                  }`}
                >
                  {f.planBadge === "pro" && <Crown className="h-2.5 w-2.5" />}
                  {f.planBadge === "pro" ? (isJa ? "Pro〜" : "Pro+") : (isJa ? "Freeでも" : "Free")}
                </span>
                <div className="text-foreground/75 mb-5 pr-16" aria-hidden>{f.icon}</div>
                <h4 className="text-[14.5px] font-semibold mb-2 tracking-tight">{f.title}</h4>
                <p className="text-[12.5px] text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━ Differentiation ━━
          rainbow グラデと多色シャドウを廃して、editorial な比較表に整理。
          Eddivom 列だけが foreground 100% で、左右は muted で薄める。 */}
      <section className="relative py-28 border-t border-foreground/[0.05]">
        <div
          ref={diffFade.ref}
          className={`relative max-w-5xl mx-auto px-6 transition-all duration-1000 ${diffFade.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          <div className="mb-14 max-w-3xl">
            <p className="text-[11px] font-medium tracking-[0.22em] uppercase text-muted-foreground/70 mb-5 flex items-center gap-2">
              <span aria-hidden className="inline-block h-px w-6 bg-foreground/25" />
              <span className="font-mono text-[10px] text-foreground/45">§ 07</span>
              {isJa ? "比較" : "How we compare"}
            </p>
            <h2 className="text-[clamp(1.6rem,3.6vw,2.3rem)] font-bold tracking-tight mb-5 leading-[1.25]">
              {isJa ? (
                <>Canva でもない、<span className="italic font-serif font-semibold text-foreground/85">Overleaf でもない</span>。</>
              ) : (
                <>Canva can&rsquo;t do equations. <span className="italic font-serif font-semibold text-foreground/85">Overleaf is overkill</span>.</>
              )}
            </h2>
            <p className="text-muted-foreground text-[15px] max-w-xl leading-relaxed">
              {isJa
                ? "Eddivom は、数式教材の「運用」を速くする専用ツールです。"
                : "Eddivom sits right in between — built specifically for math worksheet workflows."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-foreground/[0.06] rounded-2xl overflow-hidden border border-foreground/[0.06]">
            <div className="p-7 bg-card/60">
              <p className="text-[11px] text-muted-foreground/55 font-medium tracking-[0.18em] uppercase mb-5">
                {isJa ? "テンプレ系ツール" : "Canva / Google Docs"}
              </p>
              <ul className="space-y-2.5 text-[12.5px] text-muted-foreground/65 leading-relaxed">
                <li className="flex items-start gap-2.5"><span aria-hidden className="text-foreground/25 mt-0.5">✕</span> {isJa ? "数式の細かい編集が難しい" : "Equations break or look ugly"}</li>
                <li className="flex items-start gap-2.5"><span aria-hidden className="text-foreground/25 mt-0.5">✕</span> {isJa ? "問題単位で管理できない" : "No per-problem management"}</li>
                <li className="flex items-start gap-2.5"><span aria-hidden className="text-foreground/25 mt-0.5">✕</span> {isJa ? "類題生成ができない" : "No variant generation"}</li>
                <li className="flex items-start gap-2.5"><span aria-hidden className="text-foreground/25 mt-0.5">✕</span> {isJa ? "解答PDFの自動生成なし" : "Answer key? Build it by hand"}</li>
              </ul>
            </div>

            <div className="relative p-7 bg-card">
              <span aria-hidden className="absolute top-0 left-0 right-0 h-px bg-foreground" />
              <div className="flex items-center gap-2 mb-5">
                <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-foreground">Eddivom</p>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-foreground text-background text-[9.5px] font-semibold tracking-wide">
                  {isJa ? "本サービス" : "This product"}
                </span>
              </div>
              <ul className="space-y-2.5 text-[12.5px] text-foreground/85 leading-relaxed">
                <li className="flex items-start gap-2.5"><span aria-hidden className="text-foreground/55 mt-0.5">✓</span> {isJa ? "PDF・画像から問題を再利用" : "Import from your existing PDFs"}</li>
                <li className="flex items-start gap-2.5"><span aria-hidden className="text-foreground/55 mt-0.5">✓</span> {isJa ? "問題ごとに編集・並べ替え" : "Edit each problem individually"}</li>
                <li className="flex items-start gap-2.5"><span aria-hidden className="text-foreground/55 mt-0.5">✓</span> {isJa ? "類題を 1 クリックで量産" : "Generate variants in one click"}</li>
                <li className="flex items-start gap-2.5"><span aria-hidden className="text-foreground/55 mt-0.5">✓</span> {isJa ? "生徒用 + 解答付き PDF を出力" : "Auto answer-key PDF export"}</li>
                <li className="flex items-start gap-2.5"><span aria-hidden className="text-foreground/55 mt-0.5">✓</span> {isJa ? "印刷に最適な組版品質" : "Equations that actually look right"}</li>
              </ul>
            </div>

            <div className="p-7 bg-card/60">
              <p className="text-[11px] text-muted-foreground/55 font-medium tracking-[0.18em] uppercase mb-5">
                {isJa ? "LaTeX専用ツール" : "Overleaf / LaTeX"}
              </p>
              <ul className="space-y-2.5 text-[12.5px] text-muted-foreground/65 leading-relaxed">
                <li className="flex items-start gap-2.5"><span aria-hidden className="text-foreground/25 mt-0.5">✕</span> {isJa ? "LaTeXの知識が必須" : "You need to learn LaTeX first"}</li>
                <li className="flex items-start gap-2.5"><span aria-hidden className="text-foreground/25 mt-0.5">✕</span> {isJa ? "問題単位の管理がない" : "No per-problem structure"}</li>
                <li className="flex items-start gap-2.5"><span aria-hidden className="text-foreground/25 mt-0.5">✕</span> {isJa ? "類題の自動生成なし" : "No auto variant generation"}</li>
                <li className="flex items-start gap-2.5"><span aria-hidden className="text-foreground/25 mt-0.5">✕</span> {isJa ? "教材ワークフロー非対応" : "Way more power than you need"}</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ━━ 開発者紹介 ━━
           Pricing 直前で「誰が作っているか」を示して、課金前の信頼感を底上げする。
           既存の構成 / 計測 / CTA には触らず、独立セクションで挟む形にしている。 */}
      <section className="relative py-24 border-t border-foreground/[0.05] bg-foreground/[0.012] dark:bg-white/[0.015]">
        <div className="relative max-w-3xl mx-auto px-6">
          <p className="text-[11px] font-medium tracking-[0.22em] uppercase text-muted-foreground/70 mb-5 flex items-center gap-2">
            <span aria-hidden className="inline-block h-px w-6 bg-foreground/25" />
            <span className="font-mono text-[10px] text-foreground/45">§ 08</span>
            {isJa ? "開発者について" : "About the developer"}
          </p>
          <h2 className="text-[clamp(1.5rem,3.4vw,2.1rem)] font-bold tracking-tight mb-8 leading-[1.3]">
            {isJa ? (
              <>ソフトウェアだけでなく、<span className="italic font-serif font-semibold text-foreground/85">STEM 教材を実際に作ってきた人間</span> が設計しています。</>
            ) : (
              <>Built by <span className="italic font-serif font-semibold text-foreground/85">someone who creates STEM materials</span>, not just software.</>
            )}
          </h2>
          <div
            className="space-y-4 text-[15px] sm:text-[16px] leading-[1.85] text-foreground/85"
            style={{ fontFamily: 'ui-serif, "Iowan Old Style", "Apple Garamond", Georgia, serif' }}
          >
            <p>
              {isJa
                ? "Eddivom は、名古屋大学工学部の学生で、物理の学習教材も自作している森 祐太によって開発されています。"
                : "Eddivom is developed by Yuta Mori, an engineering student at Nagoya University and creator of physics learning materials."}
            </p>
            <p>
              {isJa
                ? "「教材は手早く作れるべき。でもその裏側にある考え方は、ちゃんと残るべき」── そんなシンプルな信念のもとで作られています。"
                : "The product is built around a simple belief: worksheets should be easy to create, but the reasoning behind them should stay clear."}
            </p>
            <p>
              {isJa
                ? "だから Eddivom は、汎用 AI チャットで終わらせず、数式・解答・印刷可能な PDF・問題単位で編集できるワークフローに集中しています。"
                : "That is why Eddivom focuses on equations, answer keys, printable PDFs, and editable problem-by-problem workflows — not just generic AI chat."}
            </p>
          </div>
          <p className="mt-6 text-[12px] text-muted-foreground/55 italic">
            — {isJa ? "教える人が作り、教える人のために組んだ道具です。" : "a tool built by, and for, people who teach."}
          </p>
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

            {/* Starter — entry paid tier
                 「アップグレード販促時は必ず Starter を進める」方針に合わせて、
                 バッジ文言を "手軽に始める" → "無料からの最初の一歩" に強化。
                 Pro の "人気 No.1" と並立する購入訴求の軸として機能させる。 */}
            <div className="relative p-6 rounded-[20px] bg-card/70 backdrop-blur-xl border-2 border-emerald-500/[0.3] hover:border-emerald-500/[0.5] shadow-xl shadow-emerald-500/[0.08] hover:shadow-emerald-500/[0.15] transition-all duration-300">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="text-[10px] px-3 py-0.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold shadow-lg flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  {isJa ? "無料からの最初の一歩" : "Best first upgrade"}
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
                  isJa ? "類題ジェネレータ を解放 (1ボタンで何枚でも類題を量産・5スタイル切替)" : "Variant Studio unlocked (one-tap, unlimited variants · 5 styles)",
                  isJa ? "プロンプト強化 を解放 (出題ノウハウで自動構造化)" : "Prompt boost unlocked (auto-structures messy prompts into print-ready layouts)",
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

          {/* コピーライト + 開発者サイトへの控えめリンク (権威性向上 / 副次扱い)。
              footer 最下段の copyright 行に inline で混ぜることで主動線 (CTA) に
              影響しない位置に置き、target="_blank" で現在のタブから離脱しない。 */}
          <p className="text-center text-[10.5px] text-muted-foreground/30 tracking-wide">
            © {new Date().getFullYear()} Eddivom. All rights reserved. ·{" "}
            <a
              href="https://yuta-eng.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-2 hover:underline hover:text-muted-foreground/60 transition-colors"
            >
              {isJa ? "開発者について" : "About the developer"}
            </a>
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
