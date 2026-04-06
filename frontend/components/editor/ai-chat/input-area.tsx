import React from "react";
import { useI18n } from "@/lib/i18n";
import { Textarea } from "@/components/ui/textarea";
import { ArrowUp, Loader2, Paperclip } from "lucide-react";

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
  const hasInput = input.trim().length > 0;

  return (
    <div className="px-3 pb-3 pt-2 shrink-0 chat-aurora-panel">
      <div className="chat-input-aurora rounded-2xl overflow-hidden">
        <div className="flex items-end gap-1.5 px-3 py-2.5">
          {/* File upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
            className="hidden"
            onChange={onOMRUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isChatLoading}
            className="p-1.5 mb-0.5 rounded-lg text-muted-foreground/30 hover:text-amber-500/80 hover:bg-amber-50/60 dark:hover:bg-amber-500/8 transition-all duration-150 disabled:opacity-20 shrink-0 focus:outline-none"
            title="画像・PDFを読み取り"
          >
            <Paperclip className="h-3.5 w-3.5" />
          </button>

          {/* Textarea */}
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Eddivom AI に聞く..."
            className="min-h-[22px] max-h-32 text-[13.5px] resize-none flex-1 bg-transparent border-none shadow-none p-0 focus-visible:ring-0 focus:outline-none outline-none placeholder:text-foreground/22 leading-relaxed"
            disabled={isChatLoading}
          />

          {/* Send button */}
          <button
            type="button"
            onClick={() => onSend()}
            disabled={isChatLoading || !hasInput}
            className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 mb-0.5 transition-all duration-200 focus:outline-none ${
              hasInput && !isChatLoading
                ? "chat-send-btn text-white"
                : "bg-muted/50 dark:bg-white/[0.05] text-foreground/15"
            }`}
            title="送信 (Enter)"
          >
            {isChatLoading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
            }
          </button>
        </div>
      </div>
      <p className="text-center text-[10px] text-muted-foreground/20 mt-1.5 tracking-wide">
        Enter 送信 · Shift+Enter 改行 · Esc 中断
      </p>
    </div>
  );
}
