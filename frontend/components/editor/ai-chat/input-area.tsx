"use client";

import React, { useState, useRef, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { ArrowUp, Loader2, Paperclip, Sparkles, X, Wand2, FileText, Calculator, Table } from "lucide-react";

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
  input, setInput, onSend, onKeyDown, isChatLoading,
  textareaRef, onAttach,
}: {
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  isChatLoading: boolean;
  agentMode: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onAttach?: () => void;
}) {
  const { t } = useI18n();
  const [focused, setFocused] = useState(false);
  const [showQuick, setShowQuick] = useState(true);
  const hasInput = input.trim().length > 0;
  const composingRef = useRef(false);

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

  return (
    <div className="px-3 pb-3 pt-2 shrink-0 border-t border-black/[0.08] dark:border-white/[0.05] chat-panel-bar dark:bg-white/[0.02] backdrop-blur-sm">
      {/* Quick action chips */}
      {showQuick && !isChatLoading && (
        <div className="flex flex-wrap gap-1.5 mb-2 px-0.5 animate-in fade-in slide-in-from-bottom-1 duration-200">
          {QUICK_ACTIONS.map((qa) => (
            <button
              key={qa.labelKey}
              type="button"
              onClick={() => handleQuick(qa.labelKey)}
              className="group inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-medium text-foreground/55 bg-foreground/[0.04] hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-300 border border-transparent hover:border-amber-200/60 dark:hover:border-amber-500/20 transition-all"
            >
              <span className="text-amber-500/70 group-hover:text-amber-500">{qa.icon}</span>
              <span>{t(qa.labelKey)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input box — single border only via box-shadow on outer div */}
      <div
        style={{
          borderRadius: 16,
          background: "var(--color-background, #fff)",
          boxShadow: focused
            ? "0 0 0 1.5px rgba(217,119,6,0.50), 0 0 0 4px rgba(245,158,11,0.08)"
            : "0 0 0 1px rgba(0,0,0,0.10)",
          transition: "box-shadow 0.15s ease",
        }}
      >
        <div className="flex items-end gap-1.5 px-3 py-2">
          {onAttach && (
            <button
              type="button"
              onClick={onAttach}
              disabled={isChatLoading}
              title={t("chat.attach.tooltip")}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-foreground/30 hover:text-foreground/70 hover:bg-foreground/[0.06] transition-colors disabled:opacity-30 shrink-0 mb-0.5"
            >
              <Paperclip className="h-3.5 w-3.5" />
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
            style={{
              minHeight: 28,
              maxHeight: 200,
              fontSize: 14,
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
              className="h-7 w-7 rounded-lg flex items-center justify-center text-foreground/25 hover:text-foreground/60 hover:bg-foreground/[0.06] transition-colors shrink-0 mb-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onSend()}
            disabled={isChatLoading || !hasInput}
            title={t("chat.send")}
            className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 focus:outline-none mb-0.5 ${
              hasInput && !isChatLoading
                ? "bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/30 hover:shadow-amber-500/50 hover:scale-105 active:scale-95"
                : "bg-foreground/[0.06] text-foreground/25"
            }`}
          >
            {isChatLoading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
            }
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-1.5 px-1">
        <div className="flex items-center gap-1 text-[10px] font-medium text-amber-600/50 dark:text-amber-400/40">
          <Sparkles className="h-2.5 w-2.5" />
          <span>{t("chat.model.badge")}</span>
        </div>
        <span className="text-[10px] text-muted-foreground/30 font-mono tracking-wide">
          {input.length > 0 ? `${input.length} ${t("status.chars")}` : t("chat.input.hint")}
        </span>
      </div>
    </div>
  );
}
