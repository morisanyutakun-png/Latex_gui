import React from "react";
import { useI18n } from "@/lib/i18n";
import { Textarea } from "@/components/ui/textarea";
import { ArrowUp, Loader2 } from "lucide-react";

export function InputArea({
  input, setInput, onSend, onKeyDown, isChatLoading, agentMode,
  textareaRef,
}: {
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  isChatLoading: boolean;
  agentMode: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const { t } = useI18n();
  const hasInput = input.trim().length > 0;

  return (
    <div className="px-3 pb-3 pt-2 shrink-0 border-t border-black/[0.08] dark:border-white/[0.05] chat-panel-bar dark:bg-white/[0.02] backdrop-blur-sm">
      <div className="chat-input-aurora rounded-2xl overflow-hidden">
        <div className="flex items-end gap-1.5 px-3 py-2.5">
          {/* Textarea */}
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="EddivomAI に聞く..."
            className="min-h-[24px] max-h-32 text-[13.5px] resize-none flex-1 bg-transparent border-none shadow-none p-0 focus-visible:ring-0 focus:outline-none outline-none placeholder:text-foreground/30 leading-relaxed"
            disabled={isChatLoading}
          />

          {/* Send button */}
          <button
            type="button"
            onClick={() => onSend()}
            disabled={isChatLoading || !hasInput}
            className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 mb-0.5 transition-all duration-200 focus:outline-none ${
              hasInput && !isChatLoading
                ? "chat-send-btn text-white"
                : "bg-black/[0.04] dark:bg-white/[0.05] text-foreground/20"
            }`}
            title="送信 (Enter)"
          >
            {isChatLoading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
            }
          </button>
        </div>
      </div>
      <p className="text-center text-[10px] text-muted-foreground/25 mt-1.5 tracking-wider font-mono">
        Enter 送信 · Shift+Enter 改行
      </p>
    </div>
  );
}
