"use client";

import React, { useState, useRef, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import {
  ArrowUp, Loader2, Paperclip, Sparkles, X, Wand2, FileText,
  Calculator, Table, Square, Plus, Mic,
  ClipboardList, Layers, Lock,
} from "lucide-react";
import type { AgentMode } from "@/lib/api";
import { MODE_ACCENTS } from "./mode-switcher";
import { useIsMobile } from "@/hooks/use-is-mobile";

interface QuickAction {
  icon: React.ReactNode;
  labelKey: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { icon: <Wand2 className="h-3 w-3" />, labelKey: "chat.quick.create" },
  { icon: <Calculator className="h-3 w-3" />, labelKey: "chat.quick.math" },
  { icon: <Table className="h-3 w-3" />, labelKey: "chat.quick.table" },
  { icon: <FileText className="h-3 w-3" />, labelKey: "chat.quick.fix" },
];

export function InputArea({
  input, setInput, onSend, onStop, onKeyDown, isChatLoading,
  textareaRef, onAttach, mode, onModeChange,
  enhanceOn, onEnhanceToggle, enhanceLocked,
}: {
  input: string;
  setInput: (v: string) => void;
  /**
   * 通常送信は引数なしで呼ぶ。`onEnhanceToggle` が ON の状態で発火された送信は
   * 親側で REM ノウハウ強化 (`buildEnhancePrompt`) を挟むよう実装する。
   */
  onSend: () => void;
  /** ストリーミング中の停止 (モバイルの送信ボタンが Stop に化けたとき呼ばれる) */
  onStop?: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  isChatLoading: boolean;
  agentMode: boolean;
  mode: AgentMode;
  /** モバイルの `[+]` シートからモード切替できるように。PC は ModeSwitcher が別途出る。 */
  onModeChange?: (m: AgentMode) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onAttach?: () => void;
  /** ✨ 強化トグルの状態。Pro+ または未消費 Free のとき切替可能。 */
  enhanceOn?: boolean;
  /** ✨ 強化トグル切替ハンドラ。未指定だとトグルは描画しない。 */
  onEnhanceToggle?: () => void;
  /** Free + 使用済 → トグル自体をクリックすると signup overlay が開く設計。
   *  この場合 `onEnhanceToggle` 内で signup を発火させてもよいので、ここでは
   *  単に「視覚的にロックされている」フラグだけ受け取る。 */
  enhanceLocked?: boolean;
}) {
  const { t, locale } = useI18n();
  const [focused, setFocused] = useState(false);
  const [showQuick, setShowQuick] = useState(true);
  const hasInput = input.trim().length > 0;
  const composingRef = useRef(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [input, textareaRef]);

  useEffect(() => {
    if (input.length > 0) setShowQuick(false);
    else setShowQuick(true);
  }, [input]);

  const handleQuick = (labelKey: string) => {
    setInput(t(labelKey));
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  // モバイル `[+]` 添付シート — ChatGPT モバイルの "+" メニューに相当。
  const [sheetOpen, setSheetOpen] = useState(false);
  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSheetOpen(false); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [sheetOpen]);

  // モバイルではタップターゲットを iOS HIG の 44px 推奨に近づけ、
  // 送信ボタンはストリーミング中に Stop ボタンに化ける (ChatGPT モバイル風)。
  const sendBtnSize = isMobile ? "h-10 w-10" : "h-8 w-8";
  const iconBtnSize = isMobile ? "h-10 w-10" : "h-7 w-7";
  const textareaMinH = isMobile ? 36 : 28;
  const textareaFontSize = isMobile ? 16 : 14; // iOS auto-zoom 防止 (16px 以上で発動しない)

  // ── Cycling placeholder hints (mobile only) ──
  // 4 秒ごとに切り替わる「次の入力例」。ChatGPT iOS / Notion AI 風の動的プレースホルダ。
  // ユーザがフォーカスする前に「これ何が入るの?」を直感的に伝えるための演出。
  const HINTS_JA = React.useMemo(() => [
    "数学Ⅰ 二次関数の小テストを5問",
    "高1物理 運動方程式の練習10問",
    "中2 一次関数の確認テストを作って",
    "化学基礎 mol計算の問題セット",
    "問1の数値だけ変えて",
  ], []);
  const HINTS_EN = React.useMemo(() => [
    "Make a 5-question quadratic quiz",
    "10 problems on Newton's laws",
    "Linear functions practice for 8th grade",
    "Mole calculation problems",
    "Change only the numbers in Q1",
  ], []);
  const [hintIdx, setHintIdx] = React.useState(0);
  React.useEffect(() => {
    if (!isMobile) return;
    if (input.length > 0 || focused) return; // 入力中・フォーカス中は固定
    const id = setInterval(() => {
      setHintIdx((i) => (i + 1) % HINTS_JA.length);
    }, 3500);
    return () => clearInterval(id);
  }, [isMobile, input, focused, HINTS_JA.length]);
  const dynamicMobilePlaceholder = locale === "en"
    ? HINTS_EN[hintIdx % HINTS_EN.length]
    : HINTS_JA[hintIdx % HINTS_JA.length];

  // ── Eddivom モバイル Composer (iOS ネイティブ風・2 段構成) ──
  // 旧: 1 行に [+][textarea][✨][送信] を詰め込んでいた → placeholder が潰れて Web 感
  // 新: textarea を主役に大型化、アクションボタンは下段に独立した行として配置。
  //     ChatGPT iOS / Claude iOS と同じ視覚言語で、各ボタンに 44px の touch target を確保。
  if (isMobile) {
    return (
      <>
        <div
          className="px-3 pt-1.5 shrink-0"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)" }}
        >
          {/* ── 強化 ON 時の subtle ステータスストリップ (composer の上) ── */}
          {enhanceOn && !enhanceLocked && (
            <div className="mb-1.5 flex items-center justify-center animate-in fade-in slide-in-from-bottom-1 duration-200">
              <span className="inline-flex items-center gap-1 px-2.5 py-[3px] rounded-full bg-gradient-to-r from-violet-500/15 to-fuchsia-500/15 border border-violet-500/30 text-[10px] font-bold tracking-wide text-violet-700 dark:text-violet-300 shadow-sm">
                <Sparkles className="h-2.5 w-2.5" />
                {locale === "en" ? "Prompt boost ON" : "強化 ON ・ 送信ごとに自動構造化"}
              </span>
            </div>
          )}

          {/* ── Composer 本体: rounded-3xl の 2 段カード (iOS native feel) ── */}
          <div
            className="relative rounded-[28px] overflow-hidden"
            style={{
              background: focused
                ? "linear-gradient(180deg, rgba(255,253,247,1) 0%, rgba(254,247,233,1) 100%)"
                : "linear-gradient(180deg, rgba(255,253,247,0.95) 0%, rgba(254,247,233,0.85) 100%)",
              border: focused
                ? "1px solid rgba(217,119,6,0.32)"
                : enhanceOn && !enhanceLocked
                  ? "1px solid rgba(168,85,247,0.30)"
                  : "1px solid rgba(217,119,6,0.16)",
              boxShadow: focused
                ? "0 0 0 4px rgba(245,158,11,0.12), 0 4px 16px -4px rgba(217,119,6,0.18), 0 1px 2px rgba(217,119,6,0.08)"
                : enhanceOn && !enhanceLocked
                  ? "0 0 0 3px rgba(168,85,247,0.12), 0 4px 12px -4px rgba(168,85,247,0.18)"
                  : "0 4px 12px -4px rgba(217,119,6,0.12), 0 1px 2px rgba(0,0,0,0.04)",
              transition: "box-shadow 0.2s ease, border-color 0.2s ease",
            }}
          >
            {/* 上段: textarea のみ (主役) */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (composingRef.current) return;
                onKeyDown(e);
              }}
              onCompositionStart={() => { composingRef.current = true; }}
              onCompositionEnd={() => { composingRef.current = false; }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={dynamicMobilePlaceholder}
              disabled={isChatLoading}
              rows={1}
              inputMode="text"
              enterKeyHint="send"
              autoCapitalize="sentences"
              className="w-full bg-transparent border-0 outline-none resize-none placeholder:text-amber-900/40 dark:placeholder:text-amber-300/45 placeholder:font-medium text-foreground"
              style={{
                minHeight: 48,
                maxHeight: 180,
                fontSize: 16, // iOS auto-zoom 防止
                lineHeight: 1.5,
                padding: "14px 18px 6px 18px",
              }}
            />

            {/* 下段: アクションバー (左 [+] / 右 ✨ + Mic|送信) */}
            <div className="flex items-center gap-1 px-2 pb-2 pt-1">
              {/* [+] 添付/モードシート — 控えめな iOS 風グレーボタン */}
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                disabled={isChatLoading}
                aria-label={t("chat.attach.tooltip")}
                className="h-9 w-9 rounded-full flex items-center justify-center text-amber-700/80 dark:text-amber-300/80 bg-amber-500/[0.06] hover:bg-amber-500/[0.12] active:scale-95 transition disabled:opacity-30 shrink-0"
              >
                <Plus className="h-[18px] w-[18px]" strokeWidth={2.2} />
              </button>

              <div className="flex-1" />

              {/* ✨ 強化トグル — 常時表示、ON で発光 */}
              {onEnhanceToggle && !isChatLoading && (
                <button
                  type="button"
                  onClick={onEnhanceToggle}
                  aria-pressed={!!enhanceOn}
                  aria-label={locale === "en" ? "Toggle prompt boost" : "プロンプト強化トグル"}
                  className={`h-9 px-3 rounded-full flex items-center justify-center gap-1 text-[11.5px] font-bold tracking-wide active:scale-95 transition shrink-0 ${
                    enhanceLocked
                      ? "text-violet-600/70 bg-violet-500/[0.06] border border-violet-500/30"
                      : enhanceOn
                        ? "text-white bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-md shadow-violet-500/30"
                        : "text-violet-700/85 dark:text-violet-300/85 bg-violet-500/[0.07] hover:bg-violet-500/[0.14] border border-violet-500/15"
                  }`}
                >
                  {enhanceLocked
                    ? <Lock className="h-3.5 w-3.5" />
                    : <Sparkles className="h-3.5 w-3.5" strokeWidth={2.2} />
                  }
                  <span>{locale === "en" ? "Boost" : "強化"}</span>
                </button>
              )}

              {/* 入力なし → Mic / 入力あり → 送信 / ストリーム中 → Stop */}
              {!isChatLoading && !hasInput && (
                <button
                  type="button"
                  onClick={() => textareaRef.current?.focus()}
                  aria-label={locale === "en" ? "Voice input" : "音声入力"}
                  className="h-9 w-9 rounded-full flex items-center justify-center text-amber-700/75 dark:text-amber-300/75 hover:bg-amber-500/10 active:scale-95 transition shrink-0"
                >
                  <Mic className="h-[18px] w-[18px]" strokeWidth={1.9} />
                </button>
              )}
              {(hasInput || isChatLoading) && (
                <button
                  type="button"
                  onClick={() => {
                    if (isChatLoading && onStop) onStop();
                    else onSend();
                  }}
                  aria-label={isChatLoading ? (t("chat.stop") as string || "Stop") : (t("chat.send") as string)}
                  className={`h-9 w-9 rounded-full flex items-center justify-center text-white active:scale-90 transition shrink-0 ${
                    isChatLoading ? "eddivom-stop-active" : "eddivom-send-active"
                  }`}
                  style={{
                    boxShadow: isChatLoading
                      ? "0 4px 12px rgba(15,23,42,0.25)"
                      : "0 4px 12px rgba(217,119,6,0.30), 0 1px 2px rgba(217,119,6,0.15)",
                  }}
                >
                  {isChatLoading
                    ? <Square className="h-3 w-3 fill-current relative z-10" />
                    : <ArrowUp className="h-[18px] w-[18px] relative z-10" strokeWidth={2.6} />
                  }
                </button>
              )}
            </div>
          </div>
        </div>

        {/* `[+]` Bottom sheet — 添付 / モード切替 */}
        {sheetOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] animate-page-fade-in"
              onClick={() => setSheetOpen(false)}
              aria-hidden
            />
            <div
              className="fixed left-0 right-0 bottom-0 z-50 bg-background rounded-t-2xl shadow-2xl border-t border-border/40 animate-in slide-in-from-bottom duration-200"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
              role="dialog"
              aria-modal="true"
            >
              <div className="flex justify-center pt-2 pb-1">
                <span className="h-1 w-10 rounded-full bg-foreground/15" />
              </div>

              {/* 添付ソース */}
              <div className="px-3 pt-2 pb-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1 px-2">
                  {locale === "en" ? "Attach" : "添付"}
                </div>
                {onAttach && (
                  <button
                    type="button"
                    onClick={() => { setSheetOpen(false); onAttach(); }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl active:bg-foreground/[0.06] transition"
                  >
                    <span className="h-10 w-10 rounded-full bg-emerald-500/15 flex items-center justify-center">
                      <Paperclip className="h-4 w-4 text-emerald-600" />
                    </span>
                    <div className="flex flex-col items-start">
                      <span className="text-[14.5px] font-medium text-foreground/90">
                        {locale === "en" ? "Scan PDF or image" : "PDF / 画像を読み取る"}
                      </span>
                      <span className="text-[11.5px] text-muted-foreground/65">
                        {locale === "en" ? "OCR existing exam to LaTeX" : "既存のテスト → LaTeX"}
                      </span>
                    </div>
                  </button>
                )}
              </div>

              {/* モード */}
              {onModeChange && (
                <div className="px-3 pt-1 pb-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1 px-2">
                    {locale === "en" ? "AI mode" : "AI モード"}
                  </div>
                  {([
                    { id: "plan" as const,  Icon: ClipboardList, ja: "計画", en: "Plan",  descJa: "考え方を相談",  descEn: "Discuss approach" },
                    { id: "edit" as const,  Icon: Wand2,         ja: "編集", en: "Edit",  descJa: "紙面を直接更新", descEn: "Apply edits" },
                    { id: "mix"  as const,  Icon: Layers,        ja: "混合", en: "Mix",   descJa: "計画 + 編集",   descEn: "Plan + edit" },
                  ]).map(({ id, Icon, ja, en, descJa, descEn }) => {
                    const isActive = id === mode;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => { onModeChange(id); setSheetOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${
                          isActive ? "bg-foreground/[0.05]" : "active:bg-foreground/[0.04]"
                        }`}
                      >
                        <span
                          className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
                          style={{ background: MODE_ACCENTS[id].accentSoft }}
                        >
                          <Icon className="h-4 w-4" style={{ color: MODE_ACCENTS[id].accent }} strokeWidth={1.8} />
                        </span>
                        <div className="flex-1 flex flex-col items-start">
                          <span className="text-[14px] font-semibold text-foreground/90">
                            {locale === "en" ? en : ja}
                          </span>
                          <span className="text-[11.5px] text-muted-foreground/65">
                            {locale === "en" ? descEn : descJa}
                          </span>
                        </div>
                        {isActive && (
                          <span className="h-2 w-2 rounded-full" style={{ background: MODE_ACCENTS[id].accent }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="px-5 pt-1 pb-2 text-center">
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  className="text-[12px] text-muted-foreground/60 font-medium px-3 py-1"
                >
                  {locale === "en" ? "Cancel" : "キャンセル"}
                </button>
              </div>
            </div>
          </>
        )}
      </>
    );
  }

  return (
    <div
      className={`${isMobile ? "px-2.5 pb-2 pt-1 chat-mobile-safe-bottom" : "px-3 pb-3 pt-1"} shrink-0 chat-panel-bar dark:bg-white/[0.02] backdrop-blur-sm`}
    >
      {/* ✨ 強化中インジケータ (PC) — composer の上に薄く乗せて「ON のまま」を常時可視化 */}
      {enhanceOn && !enhanceLocked && !isChatLoading && (
        <div className="mb-1.5 flex items-center justify-between gap-2 px-2">
          <span className="inline-flex items-center gap-1.5 px-2 py-[2px] rounded-full bg-gradient-to-r from-violet-500/15 to-fuchsia-500/15 border border-violet-500/30 text-[10.5px] font-semibold text-violet-700 dark:text-violet-300">
            <Sparkles className="h-3 w-3" />
            {locale === "en" ? "Prompt boost ON — every send is auto-structured" : "強化 ON — 送信ごとに自動で構造化"}
          </span>
          <button
            type="button"
            onClick={onEnhanceToggle}
            className="text-[10.5px] text-muted-foreground/70 hover:text-violet-600 underline-offset-2 hover:underline transition"
          >
            {locale === "en" ? "Turn off" : "OFFにする"}
          </button>
        </div>
      )}
      {/* Quick action chips — モバイルでは折り返さず横スクロール (ChatGPT 風) */}
      {showQuick && !isChatLoading && (
        <div
          className={`mb-2 px-0.5 animate-in fade-in slide-in-from-bottom-1 duration-200 ${
            isMobile
              ? "flex gap-1.5 overflow-x-auto scrollbar-thin -mx-2.5 px-2.5 pb-1 snap-x"
              : "flex flex-wrap gap-1.5"
          }`}
          style={isMobile ? { WebkitOverflowScrolling: "touch" } : undefined}
        >
          {QUICK_ACTIONS.map((qa) => (
            <button
              key={qa.labelKey}
              type="button"
              onClick={() => handleQuick(qa.labelKey)}
              className={`chat-quick-chip group inline-flex items-center gap-1.5 rounded-full font-semibold shrink-0 snap-start ${
                isMobile ? "h-9 px-3.5 text-[12.5px]" : "h-7 px-2.5 text-[11px]"
              }`}
            >
              <span className="chat-quick-chip-icon">{qa.icon}</span>
              <span className="whitespace-nowrap">{t(qa.labelKey)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input box — premium amber glass card with focus halo */}
      <div className={`chat-composer-card ${focused ? "is-focused" : ""} ${enhanceOn && !enhanceLocked ? "is-boost" : ""} ${isMobile ? "is-mobile" : "is-desktop"}`}>
        <span className="chat-composer-sheen" aria-hidden />
        <div className={`chat-composer-row ${isMobile ? "px-2.5 py-1.5" : "px-3 py-2"}`}>
          {onAttach && (
            <button
              type="button"
              onClick={onAttach}
              disabled={isChatLoading}
              title={t("chat.attach.tooltip")}
              aria-label={t("chat.attach.tooltip")}
              className={`chat-composer-icon-btn ${iconBtnSize} mb-0.5`}
            >
              <Paperclip className={isMobile ? "h-5 w-5" : "h-3.5 w-3.5"} />
            </button>
          )}

          {/* Raw textarea — no component wrapper, zero styling from shadcn */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (composingRef.current) return;
              onKeyDown(e);
            }}
            onCompositionStart={() => { composingRef.current = true; }}
            onCompositionEnd={() => { composingRef.current = false; }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={t("chat.input.placeholder")}
            disabled={isChatLoading}
            rows={1}
            // モバイルでは autocapitalize/autocorrect を素直に有効化、enterkeyhint で「送信」キーを表示
            inputMode="text"
            enterKeyHint="send"
            autoCapitalize="sentences"
            className="chat-composer-textarea"
            style={{
              minHeight: textareaMinH,
              maxHeight: isMobile ? 160 : 200,
              fontSize: textareaFontSize,
            }}
          />

          {hasInput && !isChatLoading && (
            <button
              type="button"
              onClick={() => { setInput(""); textareaRef.current?.focus(); }}
              aria-label={t("chat.input.clear") as string || "Clear"}
              className={`chat-composer-icon-btn ${iconBtnSize} mb-0.5`}
            >
              <X className={isMobile ? "h-4.5 w-4.5" : "h-3.5 w-3.5"} />
            </button>
          )}

          {/* ✨ 強化トグル (PC) — 入力の有無に関わらず常時表示。ON はセッション中保持。 */}
          {onEnhanceToggle && !isChatLoading && (
            <button
              type="button"
              onClick={onEnhanceToggle}
              aria-pressed={!!enhanceOn}
              aria-label={locale === "en" ? "Toggle prompt boost" : "プロンプト強化トグル"}
              title={enhanceLocked
                ? (locale === "en" ? "Pro plan to keep using prompt boost" : "Pro プランでプロンプト強化が無制限に")
                : enhanceOn
                  ? (locale === "en" ? "Prompt boost ON — auto-structures every send" : "強化ON — 送信ごとに自動で構造化")
                  : (locale === "en" ? "Prompt boost OFF — normal send" : "強化OFF — 通常送信")
              }
              className={`chat-composer-boost-btn ${iconBtnSize} mb-0.5 ${
                enhanceLocked ? "is-locked" : enhanceOn ? "is-on" : "is-off"
              }`}
            >
              {enhanceLocked
                ? <Lock className={isMobile ? "h-4 w-4" : "h-3.5 w-3.5"} />
                : <Sparkles className={isMobile ? "h-4 w-4" : "h-3.5 w-3.5"} strokeWidth={2} />
              }
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (isChatLoading && onStop) onStop();
              else onSend();
            }}
            disabled={!isChatLoading && !hasInput}
            aria-label={isChatLoading ? (t("chat.stop") as string || "Stop") : t("chat.send") as string}
            title={isChatLoading ? (t("chat.stop") as string || "Stop") : t("chat.send") as string}
            className={`chat-composer-send-btn ${sendBtnSize} mb-0.5 ${
              isChatLoading ? "is-stop" : hasInput ? "is-active" : "is-idle"
            }`}
          >
            {isChatLoading
              ? <Square className={isMobile ? "h-4 w-4 fill-current" : "h-3.5 w-3.5 fill-current"} />
              : <ArrowUp className={isMobile ? "h-5 w-5" : "h-4 w-4"} strokeWidth={2.5} />
            }
          </button>
        </div>
      </div>

      {/* Footer — モバイルでは隠して縦スペース節約 */}
      {!isMobile && (
        <div className="chat-composer-footer">
          <span className="chat-composer-footer-mode">
            <Sparkles className="h-2.5 w-2.5" />
            <span>{t("chat.model.badge")} · {mode}</span>
          </span>
          <span className="chat-composer-footer-meta">
            {input.length > 0 ? (
              <>
                <span className="chat-composer-footer-count tabular-nums">{input.length}</span>
                <span className="chat-composer-footer-sep">·</span>
                <span className="chat-composer-footer-hint">{t("status.chars")}</span>
              </>
            ) : (
              <>
                <kbd className="chat-composer-kbd">↵</kbd>
                <span className="chat-composer-footer-hint">{t("chat.input.hint")}</span>
              </>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
