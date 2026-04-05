import React from "react";
import { useI18n } from "@/lib/i18n";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, ScanLine, Zap } from "lucide-react";

export function InputArea({
  input, setInput, onSend, onKeyDown, isChatLoading, agentMode,
  textareaRef, fileInputRef, onOMRUpload,
}: {
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  isChatLoading: boolean;
  agentMode: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onOMRUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="relative border-t border-foreground/[0.04] px-3 py-3 shrink-0 bg-surface-1/80 dark:bg-surface-0/80 backdrop-blur-xl">
      {/* Subtle top glow line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/10 to-transparent" />

      <div className="flex items-end gap-2">
        <div className="flex flex-col gap-1 pb-1">
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,application/pdf" className="hidden" onChange={onOMRUpload} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isChatLoading}
            className="p-1.5 rounded-lg text-emerald-500/50 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all duration-200 disabled:opacity-20"
            title="画像・PDFを読み取り"
          >
            <ScanLine className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 flex items-end gap-2 rounded-xl border border-foreground/[0.06] bg-surface-0/50 dark:bg-surface-0/60 px-3 py-2.5 focus-within:border-indigo-500/25 focus-within:ring-1 focus-within:ring-indigo-500/10 focus-within:bg-surface-0/70 dark:focus-within:bg-surface-0/80 transition-all duration-200">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={agentMode ? "AIエージェントに指示..." : t("chat.placeholder")}
            className="min-h-[20px] max-h-32 text-[13px] resize-none flex-1 font-sans bg-transparent border-none shadow-none p-0 focus-visible:ring-0 placeholder:text-foreground/20"
            disabled={isChatLoading}
          />
          <button
            onClick={onSend}
            disabled={isChatLoading || !input.trim()}
            className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200 ${
              input.trim() && !isChatLoading
                ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-105 active:scale-95"
                : "bg-foreground/[0.04] text-foreground/15"
            }`}
            title="送信 (Enter)"
          >
            {isChatLoading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Send className="h-3.5 w-3.5" />
            }
          </button>
        </div>
      </div>

      {/* Agent mode footer */}
      <div className="flex items-center justify-center gap-2 mt-2">
        {agentMode && (
          <span className="flex items-center gap-1 text-[10px] font-medium text-indigo-400/40 tracking-wide">
            <Zap className="h-2.5 w-2.5" />
            AGENT
          </span>
        )}
        <span className="text-[10px] text-foreground/15 font-mono">
          Enter で送信 · Esc で中断
        </span>
      </div>
    </div>
  );
}
