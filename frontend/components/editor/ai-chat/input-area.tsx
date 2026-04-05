import React from "react";
import { useI18n } from "@/lib/i18n";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, ScanLine } from "lucide-react";

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
    <div className="border-t border-border/50 px-3 py-2.5 shrink-0 bg-surface-1 dark:bg-surface-0">
      <div className="flex items-end gap-2">
        <div className="flex flex-col gap-1 pb-1">
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,application/pdf" className="hidden" onChange={onOMRUpload} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isChatLoading}
            className="p-1 rounded text-muted-foreground/40 hover:text-foreground/60 hover:bg-surface-3 dark:hover:bg-surface-2 transition-colors disabled:opacity-20"
            title="画像・PDFを読み取り"
          >
            <ScanLine className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 flex items-end gap-2 rounded-md border border-border/60 bg-surface-0/50 dark:bg-surface-0/80 px-3 py-2 focus-within:border-foreground/20 transition-colors">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={"> 編集を指示..."}
            className="min-h-[20px] max-h-32 text-[13px] resize-none flex-1 font-mono bg-transparent border-none shadow-none p-0 focus-visible:ring-0 placeholder:text-foreground/20"
            disabled={isChatLoading}
          />
          <button
            onClick={onSend}
            disabled={isChatLoading || !input.trim()}
            className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 transition-colors ${
              input.trim() && !isChatLoading
                ? "bg-foreground/80 text-background hover:bg-foreground/90"
                : "bg-foreground/[0.06] text-foreground/20"
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

      <div className="flex items-center justify-center mt-1.5">
        <span className="text-[10px] text-muted-foreground/30 font-mono">
          Enter で送信 · Shift+Enter で改行 · Esc で中断
        </span>
      </div>
    </div>
  );
}
