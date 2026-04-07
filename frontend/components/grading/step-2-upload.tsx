"use client";

/**
 * 採点モード Step 2 — 答案を入れる
 *
 * ドロップゾーン + ファイルピッカー + サムネ列 + 生徒名/学籍番号入力
 */
import React, { useCallback, useRef, useState } from "react";
import { Upload, Trash2, Image as ImageIcon } from "lucide-react";
import { useUIStore } from "@/store/ui-store";
import { useI18n } from "@/lib/i18n";
import { AnswerThumbnailStrip } from "./answer-thumbnail-strip";
import { toast } from "sonner";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"]);
const MAX_SIZE = 20 * 1024 * 1024;

export function Step2Upload() {
  const { t } = useI18n();
  const files = useUIStore((s) => s.gradingAnswerFiles);
  const setFiles = useUIStore((s) => s.setGradingAnswerFiles);
  const studentName = useUIStore((s) => s.gradingStudentName);
  const setStudentName = useUIStore((s) => s.setGradingStudentName);
  const studentId = useUIStore((s) => s.gradingStudentId);
  const setStudentId = useUIStore((s) => s.setGradingStudentId);

  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const acceptFiles = useCallback((incoming: File[]) => {
    const accepted: File[] = [];
    let rejected = 0;
    for (const f of incoming) {
      if (!ALLOWED.has(f.type)) {
        rejected++;
        continue;
      }
      if (f.size > MAX_SIZE) {
        toast.error(`${f.name} は 20MB を超えています`);
        continue;
      }
      accepted.push(f);
    }
    if (rejected > 0) {
      toast.error("対応形式は JPG / PNG / GIF / WEBP / PDF です");
    }
    if (accepted.length > 0) {
      setFiles([...files, ...accepted]);
    }
  }, [files, setFiles]);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files || []);
    acceptFiles(dropped);
  }, [acceptFiles]);

  const onPick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    acceptFiles(picked);
    if (inputRef.current) inputRef.current.value = "";
  }, [acceptFiles]);

  const clearAll = () => setFiles([]);

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-4 px-6 py-4 overflow-auto max-w-3xl mx-auto w-full">
      {/* ドロップゾーン */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          relative flex flex-col items-center justify-center gap-3 px-8 py-14 rounded-xl border-2 border-dashed
          transition-all duration-200 cursor-pointer
          ${dragging
            ? "border-emerald-500 bg-emerald-500/5 scale-[1.01]"
            : "border-border/50 bg-muted/20 hover:border-emerald-500/60 hover:bg-emerald-500/5"
          }
        `}
      >
        <div className="h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <Upload className="h-6 w-6 text-emerald-500" />
        </div>
        <div className="text-center">
          <p className="text-base font-medium text-foreground/90">
            {t("grading.upload.dropzone")}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("grading.upload.formats")}
          </p>
        </div>
        <span className="text-xs text-emerald-600 dark:text-emerald-400 underline underline-offset-2">
          {t("grading.upload.choose")}
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
          onChange={onPick}
          className="hidden"
        />
      </div>

      {/* アップロード済みサムネ */}
      {files.length > 0 && (
        <div className="border border-border/40 rounded-lg p-3 bg-background">
          <div className="flex items-center justify-between mb-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/80">
              <ImageIcon className="h-3.5 w-3.5" />
              {t("grading.upload.uploaded")} ({files.length})
            </span>
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-red-500 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              {t("grading.upload.clear")}
            </button>
          </div>
          <AnswerThumbnailStrip files={files} />
        </div>
      )}

      {/* 生徒情報 */}
      <div className="border border-border/40 rounded-lg p-4 bg-background space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">
            {t("grading.upload.student_name")}
          </label>
          <input
            type="text"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            placeholder="例: 山田 太郎"
            className="w-full h-9 px-3 text-sm rounded-md border border-border/40 bg-background"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">
            {t("grading.upload.student_id")}
          </label>
          <input
            type="text"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="例: 2024001"
            className="w-full h-9 px-3 text-sm rounded-md border border-border/40 bg-background font-mono"
          />
        </div>
      </div>
    </div>
  );
}
