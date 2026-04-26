"use client";

/**
 * lp-mockups.tsx — LP 用の自動デモ Mockup を独立 chunk に切り出した最小依存ファイル。
 *
 * このファイルが必要な理由:
 *  - template-gallery.tsx 全体 (2300+ 行 + next-auth, plan-store, lucide-react 全件 import) は重い。
 *  - mobile-landing がここから直接 import すれば、Webpack は **このファイルだけ** を独立 chunk として
 *    生成でき、PC LP のコードはモバイル bundle に含まれない。
 *  - PC 側 (template-gallery) からも同じファイルを import するので動作は完全に一致。
 *
 * 直接 import 禁止 (使うとモバイル bundle に PC LP コードが流入する):
 *   - components/auth/*  (next-auth)
 *   - store/plan-store, store/document-store
 *   - sonner
 *   - components/template/template-gallery
 */

import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight, FileText, Sparkles, Copy, Code2, ChevronDown, PenLine,
  RefreshCw, FileDown, Pencil, Check, Brain, Wrench, Hammer, Plus,
  MousePointer2, Square, Circle as CircleIcon, Minus as MinusIcon,
  Type as TypeIcon, Pen as PenIcon, ImagePlus, Eye, X, BookOpen,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useVisibleInterval } from "@/hooks/use-visible-interval";
import { renderMathHTML } from "@/lib/katex-render";

// katex CSS は LP の hero / 折り上では使わない。
// Mockup が visible になったときに runtime で <link> 注入する (initial CSS bundle から外す)。
function ensureKatexCss(): void {
  if (typeof document === "undefined") return;
  const id = "katex-css-runtime";
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = "https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css";
  link.crossOrigin = "anonymous";
  link.media = "print";
  link.onload = () => { link.media = "all"; };
  document.head.appendChild(link);
}

/* KaTeX inline math — renders exactly like real LaTeX output. */
function M({ t }: { t: string }) {
  const { html, ok } = renderMathHTML(t, { displayMode: false });
  if (ok) {
    return <span className="align-middle" dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return <span className="text-muted-foreground/70 text-[0.85em]">{"\u2329 math \u232A"}</span>;
}

export function EditorMockup({ isJa }: { isJa: boolean }) {
  const CYCLE = 30000; // 30 s
  // 可視時のみ tick を回す (off-screen / 非表示タブでは完全停止 → TBT を抑える)
  const containerRef = useRef<HTMLDivElement>(null);
  const [tick] = useVisibleInterval(containerRef, 100);
  // katex の CSS は mockup マウント時に lazy で注入する (initial CSS bundle 削減)
  useEffect(() => { ensureKatexCss(); }, []);

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
export { FigureDrawMockup as __FigureDrawMockup };
export function FigureDrawMockup({ isJa }: { isJa: boolean }) {
  const CYCLE = 22000; // 22 s — 物理の力学図を組み立てる長めのループ
  // 可視時のみ tick を回す。off-screen / 非表示タブでは setInterval を完全停止 → TBT 抑制
  const containerRef = useRef<HTMLDivElement>(null);
  const [tick] = useVisibleInterval(containerRef, 80);
  useEffect(() => { ensureKatexCss(); }, []);
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
