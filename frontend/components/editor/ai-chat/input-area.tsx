import React from "react";
import { useI18n } from "@/lib/i18n";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Paperclip, BookOpen } from "lucide-react";

export function InputArea({
  input, setInput, onSend, onKeyDown, isChatLoading, agentMode,
  textareaRef, fileInputRef, onOMRUpload, showMaterials, setShowMaterials,
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
  showMaterials: boolean;
  setShowMaterials: (v: boolean) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="border-t border-slate-200/40 dark:border-slate-700/30 px-3 py-3 shrink-0 bg-white dark:bg-[#1a1c22] shadow-[0_-1px_8px_rgba(0,0,0,0.06)]">
      <div className="flex items-end gap-2">
        <div className="flex flex-col gap-1 pb-1">
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={onOMRUpload} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isChatLoading}
            className="p-1.5 rounded-full text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors disabled:opacity-30"
            title="画像をアップロード (OMR)"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowMaterials(!showMaterials)}
            className={`p-1.5 rounded-full transition-colors ${showMaterials ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50"}`}
            title="教材DB"
          >
            <BookOpen className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 flex items-end gap-2 rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-[#23262e] px-3 py-2 focus-within:border-indigo-400/60 dark:focus-within:border-indigo-600/50 focus-within:ring-2 focus-within:ring-indigo-200/30 dark:focus-within:ring-indigo-900/30 transition-all shadow-sm">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t("chat.placeholder")}
            className="min-h-[20px] max-h-32 text-[13px] resize-none flex-1 font-sans bg-transparent border-none shadow-none p-0 focus-visible:ring-0 placeholder:text-slate-400/60 dark:placeholder:text-slate-500/60"
            disabled={isChatLoading}
          />
          <button
            onClick={onSend}
            disabled={isChatLoading || !input.trim()}
            className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 transition-all ${
              input.trim() && !isChatLoading
                ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white hover:from-indigo-400 hover:to-violet-500 shadow-md shadow-indigo-900/25"
                : "bg-slate-100 dark:bg-slate-700/50 text-slate-300 dark:text-slate-600"
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
      <p className="text-[9px] text-slate-400/50 dark:text-slate-600/60 text-center mt-2">{t("chat.hint")}</p>
    </div>
  );
}
