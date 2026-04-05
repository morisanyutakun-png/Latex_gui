import React from "react";
import { useI18n } from "@/lib/i18n";
import { Textarea } from "@/components/ui/textarea";
import { ArrowUp, Loader2, ScanLine } from "lucide-react";

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
    <div className="px-3 pb-3 pt-2 shrink-0 bg-surface-2/80 dark:bg-surface-1/80">
      <div className="rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-surface-0 shadow-sm overflow-hidden">
        <div className="flex items-end gap-1 px-3 py-2.5">
          {/* File upload */}
          <div className="flex items-center pb-0.5">
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,application/pdf" className="hidden" onChange={onOMRUpload} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isChatLoading}
              className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors disabled:opacity-20"
              title="画像・PDFを読み取り"
            >
              <ScanLine className="h-4 w-4" />
            </button>
          </div>

          {/* Textarea */}
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="メッセージを入力..."
            className="min-h-[20px] max-h-32 text-[13px] resize-none flex-1 bg-transparent border-none shadow-none p-0 focus-visible:ring-0 placeholder:text-foreground/25"
            disabled={isChatLoading}
          />

          {/* Send button */}
          <div className="flex items-center pb-0.5">
            <button
              onClick={onSend}
              disabled={isChatLoading || !input.trim()}
              className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 ${
                input.trim() && !isChatLoading
                  ? "bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm hover:shadow-md hover:scale-105 active:scale-95"
                  : "bg-black/[0.05] dark:bg-white/[0.06] text-foreground/20"
              }`}
              title="送信 (Enter)"
            >
              {isChatLoading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <ArrowUp className="h-4 w-4" />
              }
            </button>
          </div>
        </div>
      </div>
      <p className="text-center text-[10px] text-muted-foreground/30 mt-1.5">
        Enter で送信 · Shift+Enter で改行
      </p>
    </div>
  );
}
