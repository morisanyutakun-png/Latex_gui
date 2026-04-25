"use client";

import React, { useState, useRef, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import {
  ArrowUp, Loader2, Paperclip, Sparkles, X, Wand2, FileText,
  Calculator, Table, Square, Plus, Mic, AudioLines,
  ClipboardList, Layers,
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
}: {
  input: string;
  setInput: (v: string) => void;
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
}) {
  const { t, locale } = useI18n();
  const [focused, setFocused] = useState(false);
  const [showQuick, setShowQuick] = useState(true);
  const hasInput = input.trim().length > 0;
  const composingRef = useRef(false);
  const accent = MODE_ACCENTS[mode];
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

  // ── ChatGPT-mobile 風 Composer ──
  // 大きな pill / 左 [+] / 中央プレースホルダ / 右 mic + 黒丸送信(ストリーム中は Stop)
  if (isMobile) {
    return (
      <>
        <div className="px-3 pb-2 pt-1 shrink-0 chat-mobile-safe-bottom">
          <div
            className="relative flex items-center gap-1 px-1.5 py-1.5 rounded-full bg-foreground/[0.04] border border-foreground/[0.06]"
            style={{
              boxShadow: focused ? `0 0 0 2px ${accent.ring}, 0 1px 4px rgba(0,0,0,0.04)` : "0 1px 2px rgba(0,0,0,0.03)",
              transition: "box-shadow 0.15s ease",
            }}
          >
            {/* 左: [+] ボタン → bottom sheet */}
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              disabled={isChatLoading}
              aria-label={t("chat.attach.tooltip")}
              className="h-10 w-10 rounded-full flex items-center justify-center text-foreground/70 hover:bg-foreground/[0.06] active:scale-95 transition disabled:opacity-30 shrink-0"
            >
              <Plus className="h-5 w-5" strokeWidth={2} />
            </button>

            {/* textarea (フラット pill) */}
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
              inputMode="text"
              enterKeyHint="send"
              autoCapitalize="sentences"
              style={{
                minHeight: textareaMinH,
                maxHeight: 160,
                fontSize: textareaFontSize,
                lineHeight: 1.4,
                resize: "none",
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                boxShadow: "none",
                padding: "6px 4px",
                margin: 0,
                color: "inherit",
                fontFamily: "inherit",
              }}
            />

            {/* 右側: 入力なし → mic + 黒丸ボイス / 入力あり → 黒丸送信 / ストリーム中 → 黒丸 Stop */}
            {!isChatLoading && !hasInput && (
              <>
                <button
                  type="button"
                  onClick={() => textareaRef.current?.focus()}
                  aria-label={locale === "en" ? "Voice input" : "音声入力"}
                  className="h-10 w-10 rounded-full flex items-center justify-center text-foreground/70 hover:bg-foreground/[0.06] active:scale-95 transition shrink-0"
                >
                  <Mic className="h-5 w-5" strokeWidth={1.8} />
                </button>
                <button
                  type="button"
                  onClick={() => textareaRef.current?.focus()}
                  aria-label={locale === "en" ? "Voice mode" : "音声モード"}
                  className="h-10 w-10 rounded-full flex items-center justify-center bg-foreground text-background active:scale-95 transition shrink-0"
                >
                  <AudioLines className="h-5 w-5" strokeWidth={2} />
                </button>
              </>
            )}
            {(hasInput || isChatLoading) && (
              <button
                type="button"
                onClick={() => {
                  if (isChatLoading && onStop) onStop();
                  else onSend();
                }}
                aria-label={isChatLoading ? (t("chat.stop") as string || "Stop") : (t("chat.send") as string)}
                className="h-10 w-10 rounded-full flex items-center justify-center bg-foreground text-background active:scale-95 transition shrink-0"
              >
                {isChatLoading
                  ? <Square className="h-3.5 w-3.5 fill-current" />
                  : <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
                }
              </button>
            )}
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
              className={`group inline-flex items-center gap-1.5 rounded-full font-medium text-foreground/65 bg-foreground/[0.04] hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-300 border border-foreground/[0.06] hover:border-amber-200/60 dark:hover:border-amber-500/20 transition-all shrink-0 snap-start ${
                isMobile ? "h-9 px-3.5 text-[12.5px]" : "h-7 px-2.5 text-[11px]"
              }`}
            >
              <span className="text-amber-500/70 group-hover:text-amber-500">{qa.icon}</span>
              <span className="whitespace-nowrap">{t(qa.labelKey)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input box — focus ring tinted by the current agent mode */}
      <div
        style={{
          borderRadius: isMobile ? 22 : 16,
          background: "var(--color-background, #fff)",
          boxShadow: focused
            ? `0 0 0 1.5px ${accent.ring}, 0 0 0 4px ${accent.ringSoft}`
            : "0 0 0 1px rgba(0,0,0,0.10)",
          transition: "box-shadow 0.15s ease",
        }}
      >
        <div className={`flex items-end gap-1.5 ${isMobile ? "px-2.5 py-1.5" : "px-3 py-2"}`}>
          {onAttach && (
            <button
              type="button"
              onClick={onAttach}
              disabled={isChatLoading}
              title={t("chat.attach.tooltip")}
              aria-label={t("chat.attach.tooltip")}
              className={`${iconBtnSize} rounded-xl flex items-center justify-center text-foreground/45 hover:text-foreground/80 hover:bg-foreground/[0.06] active:scale-95 transition-all disabled:opacity-30 shrink-0 mb-0.5`}
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
            style={{
              minHeight: textareaMinH,
              maxHeight: isMobile ? 160 : 200,
              fontSize: textareaFontSize,
              lineHeight: 1.55,
              resize: "none",
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              boxShadow: "none",
              padding: 0,
              margin: 0,
              color: "inherit",
              fontFamily: "inherit",
            }}
          />

          {hasInput && !isChatLoading && (
            <button
              type="button"
              onClick={() => { setInput(""); textareaRef.current?.focus(); }}
              aria-label={t("chat.input.clear") as string || "Clear"}
              className={`${iconBtnSize} rounded-xl flex items-center justify-center text-foreground/35 hover:text-foreground/70 hover:bg-foreground/[0.06] active:scale-95 transition-all shrink-0 mb-0.5`}
            >
              <X className={isMobile ? "h-4.5 w-4.5" : "h-3.5 w-3.5"} />
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
            style={
              !isChatLoading && hasInput
                ? {
                    background: `linear-gradient(135deg, ${accent.btnFrom} 0%, ${accent.btnTo} 100%)`,
                    boxShadow: `0 2px 8px ${accent.btnShadow}`,
                  }
                : isChatLoading
                ? { background: "#0f172a", color: "#fff" }
                : undefined
            }
            className={`${sendBtnSize} rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 focus:outline-none mb-0.5 ${
              isChatLoading
                ? "text-white active:scale-95"
                : hasInput
                ? "text-white hover:scale-105 active:scale-95"
                : "bg-foreground/[0.06] text-foreground/25 cursor-not-allowed"
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
        <div className="flex items-center justify-between mt-1.5 px-1">
          <div
            className="flex items-center gap-1 text-[10px] font-medium transition-colors duration-150"
            style={{ color: accent.accent, opacity: 0.65 }}
          >
            <Sparkles className="h-2.5 w-2.5" />
            <span>{t("chat.model.badge")} · {mode}</span>
          </div>
          <span className="text-[10px] text-muted-foreground/30 font-mono tracking-wide">
            {input.length > 0 ? `${input.length} ${t("status.chars")}` : t("chat.input.hint")}
          </span>
        </div>
      )}
    </div>
  );
}
