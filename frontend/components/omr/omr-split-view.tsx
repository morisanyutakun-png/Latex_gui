"use client";

import React, { useCallback, useRef } from "react";
import { useUIStore } from "@/store/ui-store";
import { useDocumentStore } from "@/store/document-store";
import { streamOMRAnalyze } from "@/lib/api";
import type { OMRStreamEvent } from "@/lib/api";
import { Block, DocumentPatch, PatchOp } from "@/lib/types";
import { X, Check, RefreshCw, FileText, Loader2, ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

// ── Block を正規化 (omr_service と同じロジック) ──
function normalizeBlock(raw: Record<string, unknown>): Block | null {
  const id = (raw.id as string) || `omr-${crypto.randomUUID().slice(0, 8)}`;
  let content = raw.content as Record<string, unknown> | undefined;
  if (!content || typeof content !== "object" || !("type" in content)) {
    const btype = raw.type as string;
    if (!btype) return null;
    const meta = new Set(["id", "style"]);
    content = Object.fromEntries(Object.entries(raw).filter(([k]) => !meta.has(k)));
  }
  const style = (raw.style as Record<string, unknown>) || { textAlign: "left", fontSize: 11, fontFamily: "sans" };
  return { id, content: content as unknown as Block["content"], style: style as unknown as Block["style"] };
}

export function OMRSplitView() {
  const { locale } = useI18n();
  const isJa = locale !== "en";

  const omrMode = useUIStore((s) => s.omrMode);
  const sourceUrl = useUIStore((s) => s.omrSourceUrl);
  const sourceName = useUIStore((s) => s.omrSourceName);
  const extractedBlocks = useUIStore((s) => s.omrExtractedBlocks);
  const processing = useUIStore((s) => s.omrProcessing);
  const progress = useUIStore((s) => s.omrProgress);
  const closeOMR = useUIStore((s) => s.closeOMR);
  const setOMRBlocks = useUIStore((s) => s.setOMRBlocks);
  const setOMRProcessing = useUIStore((s) => s.setOMRProcessing);
  const setOMRProgress = useUIStore((s) => s.setOMRProgress);

  const doc = useDocumentStore((s) => s.document);
  const applyPatch = useDocumentStore((s) => s.applyPatch);
  const fileRef = useRef<File | null>(null);

  // OMR解析を開始
  const startAnalysis = useCallback(async (file: File) => {
    if (!doc) return;
    fileRef.current = file;
    setOMRProcessing(true);
    setOMRProgress(isJa ? "ファイルを解析中..." : "Analyzing file...");
    setOMRBlocks([]);

    try {
      const result = await streamOMRAnalyze(
        file, doc,
        (event: OMRStreamEvent) => {
          if (event.type === "progress") setOMRProgress(event.message);
        },
      );

      if (result.patches?.ops && result.patches.ops.length > 0) {
        // パッチからブロックを抽出して右パネルに表示
        const blocks: Block[] = [];
        for (const op of result.patches.ops) {
          if (op.op === "add_block" && op.block) {
            const normalized = normalizeBlock(op.block as unknown as Record<string, unknown>);
            if (normalized) blocks.push(normalized);
          }
        }
        setOMRBlocks(blocks);
        setOMRProgress(isJa ? `${blocks.length}件のブロックを抽出しました` : `Extracted ${blocks.length} blocks`);
      } else {
        setOMRProgress(isJa ? "ブロックを抽出できませんでした" : "No blocks extracted");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "OMR error";
      setOMRProgress(`エラー: ${msg}`);
    } finally {
      setOMRProcessing(false);
    }
  }, [doc, isJa, setOMRBlocks, setOMRProcessing, setOMRProgress]);

  // 承認: ブロックを文書に追加して編集画面に戻る
  const handleApprove = useCallback(() => {
    if (extractedBlocks.length === 0) return;

    const currentBlocks = useDocumentStore.getState().document?.blocks ?? [];
    const lastBlockId = currentBlocks.length > 0 ? currentBlocks[currentBlocks.length - 1].id : null;

    // afterId チェーンを構築して末尾に追加
    const ops: PatchOp[] = [];
    let prevId = lastBlockId;
    for (const block of extractedBlocks) {
      ops.push({ op: "add_block", afterId: prevId, block });
      prevId = block.id;
    }

    applyPatch({ ops } as DocumentPatch);
    toast.success(isJa ? `${extractedBlocks.length}件のブロックを文書に追加しました` : `Added ${extractedBlocks.length} blocks`);
    closeOMR();
  }, [extractedBlocks, applyPatch, closeOMR, isJa]);

  // 再スキャン
  const handleRetry = useCallback(() => {
    if (fileRef.current) startAnalysis(fileRef.current);
  }, [startAnalysis]);

  // OMRモードが最初に開かれた時にファイルを取得して解析開始
  const initialized = useRef(false);
  React.useEffect(() => {
    if (!omrMode || initialized.current) return;
    initialized.current = true;

    // sourceUrl から Blob を取得してFile化 → 解析開始
    if (sourceUrl && sourceName) {
      fetch(sourceUrl)
        .then((r) => r.blob())
        .then((blob) => {
          const file = new File([blob], sourceName, { type: blob.type });
          startAnalysis(file);
        })
        .catch(() => setOMRProgress("ファイルの読み込みに失敗しました"));
    }
    return () => { initialized.current = false; };
  }, [omrMode, sourceUrl, sourceName, startAnalysis, setOMRProgress]);

  if (!omrMode) return null;

  const isPdf = sourceName?.toLowerCase().endsWith(".pdf");

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col animate-in fade-in duration-200">
      {/* ── ヘッダー ── */}
      <div className="h-12 border-b border-border/40 bg-background/95 backdrop-blur flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <FileText className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-medium">{isJa ? "読み取りモード" : "OMR Mode"}</span>
          {sourceName && <span className="text-xs text-muted-foreground truncate max-w-[200px]">{sourceName}</span>}
        </div>
        <div className="flex items-center gap-2">
          {/* 進捗表示 */}
          {(processing || progress) && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {processing && <Loader2 className="h-3 w-3 animate-spin" />}
              <span>{progress}</span>
            </div>
          )}

          {/* 再スキャン */}
          {!processing && extractedBlocks.length > 0 && (
            <button onClick={handleRetry}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
              <RefreshCw className="h-3 w-3" />
              {isJa ? "再スキャン" : "Re-scan"}
            </button>
          )}

          {/* 承認ボタン */}
          {extractedBlocks.length > 0 && !processing && (
            <button onClick={handleApprove}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm">
              <Check className="h-3.5 w-3.5" />
              {isJa ? "承認して編集画面へ" : "Approve & Edit"}
              <ArrowRight className="h-3 w-3" />
            </button>
          )}

          {/* 閉じる */}
          <button onClick={closeOMR}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── メイン: 左右分割 ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左パネル: 入力ファイルプレビュー */}
        <div className="w-1/2 border-r border-border/30 bg-muted/20 flex flex-col">
          <div className="px-3 py-2 border-b border-border/20 bg-muted/30">
            <span className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">
              {isJa ? "入力ファイル" : "Source File"}
            </span>
          </div>
          <div className="flex-1 overflow-auto flex items-center justify-center p-4">
            {sourceUrl ? (
              isPdf ? (
                <embed src={sourceUrl} type="application/pdf" className="w-full h-full rounded-md border border-border/20" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={sourceUrl} alt={sourceName || "Source"} className="max-w-full max-h-full object-contain rounded-md shadow-md" />
              )
            ) : (
              <span className="text-muted-foreground text-sm">{isJa ? "ファイルなし" : "No file"}</span>
            )}
          </div>
        </div>

        {/* 右パネル: 抽出結果 */}
        <div className="w-1/2 bg-background flex flex-col">
          <div className="px-3 py-2 border-b border-border/20 bg-muted/30 flex items-center justify-between">
            <span className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">
              {isJa ? "抽出結果" : "Extracted Content"}
            </span>
            {extractedBlocks.length > 0 && (
              <span className="text-[10px] text-muted-foreground">{extractedBlocks.length} {isJa ? "ブロック" : "blocks"}</span>
            )}
          </div>
          <div className="flex-1 overflow-auto p-4">
            {processing ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                <p className="text-sm text-muted-foreground">{progress}</p>
              </div>
            ) : extractedBlocks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                <FileText className="h-8 w-8 opacity-30" />
                <p className="text-sm">{progress || (isJa ? "解析結果がここに表示されます" : "Results appear here")}</p>
              </div>
            ) : (
              <div className="space-y-1 max-w-[600px] mx-auto">
                {extractedBlocks.map((block) => (
                  <OMRBlockPreview key={block.id} block={block} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 抽出ブロックのプレビュー表示 ──
function OMRBlockPreview({ block }: { block: Block }) {
  const c = block.content;
  const type = c.type;

  const typeLabel: Record<string, string> = {
    heading: "見出し", paragraph: "テキスト", math: "数式", list: "リスト",
    table: "表", divider: "区切り線", code: "コード", quote: "引用",
    latex: "LaTeX", image: "画像",
  };

  const typeColor: Record<string, string> = {
    heading: "text-blue-500 bg-blue-50 dark:bg-blue-950/30",
    paragraph: "text-slate-500 bg-slate-50 dark:bg-slate-950/30",
    math: "text-violet-500 bg-violet-50 dark:bg-violet-950/30",
    list: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30",
    table: "text-orange-500 bg-orange-50 dark:bg-orange-950/30",
    divider: "text-gray-400 bg-gray-50 dark:bg-gray-950/30",
    latex: "text-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-950/30",
  };

  const getText = (): string => {
    if ("text" in c && c.text) return c.text as string;
    if ("latex" in c && c.latex) return `$${c.latex}$`;
    if ("code" in c && c.code) return (c.code as string).slice(0, 80);
    if ("items" in c && Array.isArray(c.items)) return (c.items as string[]).join(", ");
    if ("formula" in c && c.formula) return c.formula as string;
    return "";
  };

  return (
    <div className="flex items-start gap-2 py-1.5 px-2 rounded-md hover:bg-muted/30 transition-colors">
      <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-medium ${typeColor[type] || "text-gray-500 bg-gray-50"}`}>
        {typeLabel[type] || type}
      </span>
      <span className="text-sm leading-relaxed line-clamp-2 text-foreground/80">
        {getText() || "—"}
      </span>
    </div>
  );
}
