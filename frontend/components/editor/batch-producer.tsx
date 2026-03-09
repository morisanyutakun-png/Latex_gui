"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { useDocumentStore } from "@/store/document-store";
import { detectVariables, batchGeneratePDFs, batchPreview } from "@/lib/api";
import { BatchRequest } from "@/lib/types";
import {
  Factory,
  Search,
  Upload,
  FileSpreadsheet,
  Settings2,
  Eye,
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Sparkles,
  Package,
  ArrowRight,
  FileText,
  Info,
  Copy,
} from "lucide-react";

/* ─────────────────── ステップインジケーター ─────────────────── */
function StepIndicator({
  currentStep,
  steps,
}: {
  currentStep: number;
  steps: { label: string; icon: React.ReactNode; done: boolean }[];
}) {
  return (
    <div className="flex items-center justify-center gap-1 px-6 py-4">
      {steps.map((step, i) => {
        const isActive = i === currentStep;
        const isDone = step.done;
        return (
          <React.Fragment key={i}>
            {i > 0 && (
              <div
                className={`h-px w-8 sm:w-12 transition-colors duration-500 ${
                  isDone ? "bg-emerald-400" : "bg-border/40"
                }`}
              />
            )}
            <div
              className={`
                flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-300
                ${
                  isActive
                    ? "bg-primary/10 text-primary ring-1 ring-primary/20 shadow-sm shadow-primary/5 scale-105"
                    : isDone
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                    : "text-muted-foreground/50"
                }
              `}
            >
              <span className="hidden sm:inline-flex h-5 w-5 items-center justify-center">
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  step.icon
                )}
              </span>
              <span className="hidden sm:inline">{step.label}</span>
              <span className="sm:hidden">{i + 1}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ─────────────────── 変数バッジ ─────────────────── */
function VariableBadge({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono bg-violet-50 text-violet-700 rounded-lg border border-violet-200/60 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-700/40 transition-colors hover:bg-violet-100 dark:hover:bg-violet-900/50 cursor-default">
      <span className="text-violet-400 dark:text-violet-500">{"{"}</span>
      {name}
      <span className="text-violet-400 dark:text-violet-500">{"}"}</span>
    </span>
  );
}

/* ─────────────────── メインコンポーネント ─────────────────── */
export function BatchProducer({ embedded = false }: { embedded?: boolean }) {
  const document = useDocumentStore((s) => s.document);
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [variables, setVariables] = useState<string[]>([]);
  const [csvText, setCsvText] = useState("");
  const [filenameTemplate, setFilenameTemplate] = useState(
    "{{_index}}_document"
  );
  const [maxRows, setMaxRows] = useState(50);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [previewLatex, setPreviewLatex] = useState("");
  const [previewVars, setPreviewVars] = useState<Record<string, string>>({});
  const [totalRows, setTotalRows] = useState(0);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [showComplete, setShowComplete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // ESC で閉じる
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen]);

  // 変数検出
  const handleDetectVariables = useCallback(async () => {
    if (!document) return;
    setIsDetecting(true);
    setError("");
    try {
      const vars = await detectVariables(document);
      setVariables(vars);
      if (vars.length === 0) {
        setError(
          "テンプレート内に {{変数名}} プレースホルダが見つかりません。\nテキストブロック等に {{名前}} のように記述してください。"
        );
      } else {
        if (!csvText.trim()) {
          setCsvText(vars.join(",") + "\n");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "変数検出に失敗しました");
    } finally {
      setIsDetecting(false);
    }
  }, [document, csvText]);

  // CSV ファイル読み込み
  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        setCsvText(text);
      };
      reader.readAsText(file);
    },
    []
  );

  // プレビュー
  const handlePreview = useCallback(async () => {
    if (!document || !csvText.trim()) return;
    setError("");
    try {
      const req: BatchRequest = {
        template: document,
        variablesCsv: csvText,
        filenameTemplate,
        maxRows,
      };
      const result = await batchPreview(req);
      setPreviewLatex(result.latex);
      setPreviewVars(result.variables);
      setTotalRows(result.totalRows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "プレビューに失敗しました");
    }
  }, [document, csvText, filenameTemplate, maxRows]);

  // バッチ生成
  const handleGenerate = useCallback(async () => {
    if (!document || !csvText.trim()) return;
    setIsGenerating(true);
    setError("");
    setProgress("PDF を量産中...");
    try {
      const req: BatchRequest = {
        template: document,
        variablesCsv: csvText,
        filenameTemplate,
        maxRows,
      };
      const blob = await batchGeneratePDFs(req);

      const url = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = "batch_output.zip";
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setProgress("");
      setShowComplete(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "バッチ生成に失敗しました");
      setProgress("");
    } finally {
      setIsGenerating(false);
    }
  }, [document, csvText, filenameTemplate, maxRows]);

  const openModal = () => {
    setIsOpen(true);
    setStep(0);
    setShowComplete(false);
    setError("");
    setProgress("");
    handleDetectVariables();
  };

  // ステップ定義
  const steps = [
    {
      label: "変数検出",
      icon: <Search className="h-4 w-4" />,
      done: variables.length > 0,
    },
    {
      label: "データ入力",
      icon: <FileSpreadsheet className="h-4 w-4" />,
      done: csvText.trim().split("\n").length > 1,
    },
    {
      label: "生成",
      icon: <Package className="h-4 w-4" />,
      done: showComplete,
    },
  ];

  // 行数カウント
  const dataRowCount = csvText.trim()
    ? Math.max(0, csvText.trim().split("\n").length - 1)
    : 0;

  // ── embedded モード: サイドパネル内に直接レンダリング ──
  if (embedded) {
    // 初回表示時に自動検出を開始
    useEffect(() => {
      if (variables.length === 0 && !isDetecting) {
        handleDetectVariables();
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
      <div className="space-y-3">
        {/* ── ヘッダー ── */}
        <div className="flex items-center gap-2.5 px-1">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-sm">
            <Factory className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold tracking-tight">教材工場</h3>
            <p className="text-[9px] text-muted-foreground">テンプレ × 変数 → PDF 一括生成</p>
          </div>
        </div>

        {/* ── 3ステップガイド (常に表示) ── */}
        <div className="rounded-xl border border-border/30 overflow-hidden">
          {steps.map((s, i) => {
            const isActive = i === step;
            const isDone = s.done;
            return (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`
                  w-full flex items-center gap-2.5 px-3 py-2 text-[11px] transition-all border-b last:border-b-0 border-border/20
                  ${isActive
                    ? "bg-primary/5 text-foreground"
                    : isDone
                    ? "bg-emerald-50/50 dark:bg-emerald-950/10 text-emerald-700 dark:text-emerald-400"
                    : "text-muted-foreground/50 hover:bg-muted/30"
                  }
                `}
              >
                <div className={`h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-bold ${
                  isDone
                    ? "bg-emerald-500 text-white"
                    : isActive
                    ? "bg-amber-500 text-white"
                    : "bg-muted text-muted-foreground/50"
                }`}>
                  {isDone ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
                </div>
                <span className={`font-medium ${isActive ? "font-semibold" : ""}`}>{s.label}</span>
                {isActive && <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground/40" />}
              </button>
            );
          })}
        </div>

        {/* ── 完了画面 ── */}
        {showComplete && (
          <div className="flex flex-col items-center py-6 gap-3 animate-in fade-in duration-300">
            <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h4 className="text-sm font-bold">一括生成完了!</h4>
            <p className="text-[11px] text-muted-foreground text-center">ZIPがダウンロードされました</p>
            <button
              onClick={() => { setShowComplete(false); setStep(1); }}
              className="px-3 py-1.5 text-[11px] rounded-lg border border-border hover:bg-muted transition-colors"
            >
              データを変えて再実行
            </button>
          </div>
        )}

        {/* ── Step 0: 変数検出 ── */}
        {!showComplete && step === 0 && (
          <div className="space-y-3 animate-in fade-in duration-200">
            {variables.length > 0 ? (
              <div className="p-3 rounded-xl bg-card border border-border/50">
                <div className="flex items-center gap-1.5 mb-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">{variables.length} 個の変数を検出</span>
                  <button
                    onClick={handleDetectVariables}
                    disabled={isDetecting}
                    className="ml-auto text-[9px] px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                  >
                    {isDetecting ? "..." : "再検出"}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {variables.map((v) => <VariableBadge key={v} name={v} />)}
                </div>
              </div>
            ) : isDetecting ? (
              <div className="flex items-center justify-center gap-2 py-6">
                <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                <span className="text-[11px] text-muted-foreground">変数を検出中...</span>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/15 border border-amber-200/40 dark:border-amber-800/20">
                <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium mb-2">変数プレースホルダーを追加してください</p>
                <div className="space-y-1.5 text-[10px] text-amber-700/80 dark:text-amber-300/60">
                  <p>テキストブロックに <code className="px-1 py-0.5 bg-amber-100 dark:bg-amber-900/40 rounded font-mono text-[9px]">{"{{名前}}"}</code> のように記述します</p>
                  <p>例: 「<code className="px-1 py-0.5 bg-amber-100 dark:bg-amber-900/40 rounded font-mono text-[9px]">{"{{生徒名}}"}</code> さんの成績表」</p>
                </div>
                <button
                  onClick={handleDetectVariables}
                  className="mt-2.5 w-full py-1.5 text-[11px] font-medium rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800/40 transition-colors"
                >
                  再検出する
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Step 1: CSVデータ ── */}
        {!showComplete && step === 1 && (
          <div className="space-y-3 animate-in fade-in duration-200">
            {/* 操作ボタン群 */}
            <div className="flex items-center gap-2">
              <input ref={fileInputRef} type="file" accept=".csv,.tsv,.txt" onChange={handleFileUpload} className="hidden" />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-700/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
              >
                <Upload className="h-3.5 w-3.5" />
                CSVファイル読込
              </button>
              {variables.length > 0 && !csvText.trim() && (
                <button
                  onClick={() => setCsvText(variables.join(",") + "\n")}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-700/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  ヘッダ自動生成
                </button>
              )}
            </div>

            {/* CSV エディタ (コンパクト) */}
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <div className="flex items-center justify-between px-2.5 py-1.5 bg-muted/30 border-b border-border/30">
                <span className="text-[10px] font-medium text-muted-foreground">CSVデータ</span>
                <span className="text-[9px] text-muted-foreground">{dataRowCount} 行</span>
              </div>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={`${variables.length > 0 ? variables.join(",") : "名前,クラス"}\n太郎,A組\n花子,B組`}
                className="w-full h-28 px-2.5 py-2 text-[10px] font-mono bg-background resize-none focus:outline-none placeholder:text-muted-foreground/30"
                spellCheck={false}
              />
            </div>

            <p className="text-[9px] text-muted-foreground flex items-center gap-1 px-0.5">
              <Info className="h-2.5 w-2.5 flex-shrink-0" />
              1行目がヘッダー（変数名）、2行目以降が各PDFのデータ
            </p>
          </div>
        )}

        {/* ── Step 2: 設定 & 生成 ── */}
        {!showComplete && step === 2 && (
          <div className="space-y-3 animate-in fade-in duration-200">
            {/* ファイル名設定 */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-foreground/70">ファイル名パターン</label>
              <input
                type="text"
                value={filenameTemplate}
                onChange={(e) => setFilenameTemplate(e.target.value)}
                className="w-full px-2.5 py-1.5 text-[11px] font-mono bg-muted/20 border border-border/40 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500/30 transition-all"
                placeholder="{{_index}}_{{名前}}"
              />
              <p className="text-[8px] text-muted-foreground/60"><code className="bg-muted px-0.5 rounded">{"{{_index}}"}</code> = 連番</p>
            </div>

            {/* 最大行数 (スライダー風) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-medium text-foreground/70">最大生成数</label>
                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">{maxRows} 件</span>
              </div>
              <input
                type="range"
                value={maxRows}
                onChange={(e) => setMaxRows(parseInt(e.target.value))}
                min={1} max={200} step={1}
                className="w-full h-1.5 accent-amber-500"
              />
            </div>

            {/* 生成サマリー */}
            <div className="p-3 rounded-xl bg-gradient-to-br from-amber-50/80 to-orange-50/80 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200/50 dark:border-amber-700/30">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5" /> 生成予定
                </span>
                <span className="text-base font-bold text-amber-700 dark:text-amber-300">
                  {Math.min(dataRowCount, maxRows)} 件
                </span>
              </div>
            </div>
          </div>
        )}

        {/* エラー */}
        {error && (
          <div className="p-2.5 rounded-lg bg-destructive/5 border border-destructive/20 flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-destructive mt-0.5 flex-shrink-0" />
            <p className="text-[10px] text-destructive whitespace-pre-line">{error}</p>
          </div>
        )}

        {/* 進捗 */}
        {progress && (
          <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
            <p className="text-[10px] text-primary font-medium">{progress}</p>
          </div>
        )}

        {/* ── アクションボタン ── */}
        {!showComplete && (
          <div className="space-y-2 pt-1">
            {step < 2 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={step === 0 && variables.length === 0}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-[12px] font-semibold rounded-xl bg-foreground text-background hover:opacity-90 transition-all disabled:opacity-40"
              >
                次のステップへ <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <div className="space-y-1.5">
                <button
                  onClick={handleGenerate}
                  disabled={!csvText.trim() || isGenerating}
                  className="w-full flex items-center justify-center gap-2 py-3 text-[12px] font-bold rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all disabled:opacity-50"
                >
                  {isGenerating ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> 量産中...</>
                  ) : (
                    <><Download className="h-4 w-4" /> PDF一括生成 ({Math.min(dataRowCount, maxRows)}件)</>
                  )}
                </button>
                <button
                  onClick={handlePreview}
                  disabled={!csvText.trim() || isGenerating}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  <Eye className="h-3 w-3" /> 1件目プレビュー
                </button>
              </div>
            )}

            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                disabled={isGenerating}
                className="w-full py-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                ← 前のステップ
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── ダイアログモード (ツールバーボタン用) ──
  if (!isOpen) {
    return (
      <button
        onClick={openModal}
        className="group relative flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 
          bg-gradient-to-r from-amber-50 to-orange-50 text-amber-800 border border-amber-200/60 
          hover:from-amber-100 hover:to-orange-100 hover:border-amber-300 hover:shadow-md hover:shadow-amber-100/50 
          dark:from-amber-950/40 dark:to-orange-950/40 dark:text-amber-300 dark:border-amber-700/40 
          dark:hover:from-amber-900/50 dark:hover:to-orange-900/50 dark:hover:border-amber-600/50
          active:scale-[0.97]"
        title="テンプレート × 変数 で PDF を量産"
      >
        <Factory className="h-3.5 w-3.5 transition-transform group-hover:rotate-12" />
        <span>教材工場</span>
        <Sparkles className="h-3 w-3 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={() => !isGenerating && setIsOpen(false)}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        className="relative w-full max-w-3xl max-h-[85vh] mx-4 bg-background rounded-2xl shadow-2xl shadow-black/20 border border-border/50 flex flex-col overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
      >
        {/* ── ヘッダー ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/30 bg-gradient-to-r from-amber-50/50 via-background to-orange-50/50 dark:from-amber-950/20 dark:via-background dark:to-orange-950/20">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
              <Factory className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                教材工場
              </h2>
              <p className="text-xs text-muted-foreground">
                テンプレート × 変数データ → PDF 一括生成
              </p>
            </div>
          </div>
          <button
            onClick={() => !isGenerating && setIsOpen(false)}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── ステップインジケーター ── */}
        <StepIndicator currentStep={step} steps={steps} />

        {/* ── コンテンツ ── */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {/* ──── 完了画面 ──── */}
          {showComplete && (
            <div className="flex flex-col items-center justify-center py-12 gap-4 animate-in fade-in zoom-in-95 duration-500">
              <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold">一括生成完了!</h3>
              <p className="text-sm text-muted-foreground text-center">
                ZIP ファイルがダウンロードフォルダに保存されました。
              </p>
              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => {
                    setShowComplete(false);
                    setStep(1);
                  }}
                  className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors"
                >
                  データを変えて再実行
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-5 py-2 text-sm font-medium rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity"
                >
                  閉じる
                </button>
              </div>
            </div>
          )}

          {/* ──── Step 0: 変数検出 ──── */}
          {!showComplete && step === 0 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              {/* ヘッダー */}
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Search className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold">
                    テンプレート変数を検出
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ドキュメント内の{" "}
                    <code className="px-1 py-0.5 bg-muted rounded text-[10px]">
                      {"{{変数名}}"}
                    </code>{" "}
                    プレースホルダを自動検出します
                  </p>
                </div>
                <button
                  onClick={handleDetectVariables}
                  disabled={isDetecting}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-50 text-blue-700 border border-blue-200/50 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/50 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50"
                >
                  {isDetecting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Search className="h-3 w-3" />
                  )}
                  {isDetecting ? "検出中..." : "再検出"}
                </button>
              </div>

              {/* 検出された変数 */}
              {variables.length > 0 ? (
                <div className="p-4 rounded-xl bg-card border border-border/50">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      {variables.length} 個の変数を検出
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {variables.map((v) => (
                      <VariableBadge key={v} name={v} />
                    ))}
                  </div>
                </div>
              ) : !isDetecting ? (
                <div className="p-4 rounded-xl bg-muted/50 border border-border/30">
                  <div className="flex items-start gap-3">
                    <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-muted-foreground space-y-2">
                      <p>
                        テンプレート内のテキストブロックに変数プレースホルダを追加してください。
                      </p>
                      <div className="p-2 rounded-lg bg-background border border-border/40 font-mono text-[11px]">
                        例: &quot;受験番号:{" "}
                        <span className="text-violet-600 dark:text-violet-400">
                          {"{{受験番号}}"}
                        </span>
                        &quot; や &quot;
                        <span className="text-violet-600 dark:text-violet-400">
                          {"{{氏名}}"}
                        </span>{" "}
                        殿&quot;
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* ヒントカード */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50/60 to-indigo-50/60 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-100/50 dark:border-blue-800/30">
                <h4 className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  使い方のヒント
                </h4>
                <ul className="text-xs text-blue-700/80 dark:text-blue-300/70 space-y-1.5 list-none">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">•</span>
                    テキストブロック・見出し・表のセルに{" "}
                    <code className="px-1 bg-blue-100/80 dark:bg-blue-900/50 rounded text-[10px]">
                      {"{{変数名}}"}
                    </code>{" "}
                    と記述
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">•</span>
                    数式ブロックにも使えます（例:{" "}
                    <code className="px-1 bg-blue-100/80 dark:bg-blue-900/50 rounded text-[10px]">
                      {"f(x) = {{係数}}x^2"}
                    </code>
                    ）
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">•</span>
                    同じ変数名を複数箇所で使うと、すべて同時に置換されます
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* ──── Step 1: CSVデータ入力 ──── */}
          {!showComplete && step === 1 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold">
                    変数データを入力
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    CSVファイルまたは直接入力で各PDFに差し込むデータを設定
                  </p>
                </div>
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.tsv,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/50 transition-colors"
                  >
                    <Upload className="h-3 w-3" />
                    CSV読み込み
                  </button>
                </div>
              </div>

              {/* CSV エディタ */}
              <div className="rounded-xl border border-border/50 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border/30">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    CSV データ
                  </span>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    {dataRowCount > 0 && (
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {dataRowCount} 行
                      </span>
                    )}
                    {variables.length > 0 && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(
                            variables.join(",") + "\n"
                          );
                        }}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                        title="ヘッダーをコピー"
                      >
                        <Copy className="h-3 w-3" />
                        ヘッダーコピー
                      </button>
                    )}
                  </div>
                </div>
                <textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder={`${
                    variables.length > 0
                      ? variables.join(",")
                      : "名前,クラス,点数"
                  }\n太郎,A組,95\n花子,B組,88\n次郎,C組,72`}
                  className="w-full h-44 px-4 py-3 text-sm font-mono bg-background resize-none focus:outline-none placeholder:text-muted-foreground/30"
                  spellCheck={false}
                />
              </div>

              {/* データフォーマットの説明 */}
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-muted/30 border border-border/20">
                <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  1行目 = ヘッダー（変数名をカンマ区切り）。2行目以降 =
                  各PDFに差し込むデータ。
                </p>
              </div>
            </div>
          )}

          {/* ──── Step 2: 設定 & 生成 ──── */}
          {!showComplete && step === 2 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-orange-100 dark:bg-orange-950/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Settings2 className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">出力設定</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ファイル名や生成数を設定して一括生成
                  </p>
                </div>
              </div>

              {/* 設定フォーム */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground/80">
                    ファイル名テンプレート
                  </label>
                  <input
                    type="text"
                    value={filenameTemplate}
                    onChange={(e) => setFilenameTemplate(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm font-mono bg-muted/30 border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
                    placeholder="{{_index}}_{{名前}}_レポート"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    <code className="bg-muted px-1 rounded">
                      {"{{_index}}"}
                    </code>{" "}
                    = 自動連番 (1, 2, 3...)
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground/80">
                    最大行数
                  </label>
                  <input
                    type="number"
                    value={maxRows}
                    onChange={(e) =>
                      setMaxRows(
                        Math.max(
                          1,
                          Math.min(200, parseInt(e.target.value) || 50)
                        )
                      )
                    }
                    min={1}
                    max={200}
                    className="w-full px-3 py-2.5 text-sm bg-muted/30 border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    1回の実行で生成する最大PDF数
                  </p>
                </div>
              </div>

              {/* 生成サマリー */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50/60 to-orange-50/60 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200/40 dark:border-amber-700/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
                      生成予定
                    </span>
                  </div>
                  <span className="text-lg font-bold text-amber-700 dark:text-amber-300">
                    {Math.min(dataRowCount, maxRows)} 件
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-amber-700/70 dark:text-amber-300/60">
                  <span>データ行: {dataRowCount}</span>
                  <span>変数: {variables.length}</span>
                </div>
              </div>

              {/* プレビュー */}
              {previewLatex && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5" />
                      プレビュー (1行目)
                    </h4>
                    <span className="text-[10px] text-muted-foreground">
                      {Object.entries(previewVars)
                        .map(([k, v]) => `${k}=${v}`)
                        .join(", ")}
                    </span>
                  </div>
                  <pre className="p-3 bg-slate-950 text-emerald-400 text-[11px] rounded-xl overflow-x-auto max-h-40 overflow-y-auto font-mono leading-relaxed border border-slate-800">
                    {previewLatex.slice(0, 2000)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* エラー */}
          {error && (
            <div className="mt-4 p-3 rounded-xl bg-destructive/5 border border-destructive/20 flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
              <p className="text-sm text-destructive whitespace-pre-line">
                {error}
              </p>
            </div>
          )}

          {/* 進捗 */}
          {progress && (
            <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-center gap-2.5 animate-in fade-in duration-200">
              <Loader2 className="h-4 w-4 text-primary animate-spin" />
              <p className="text-sm text-primary font-medium">{progress}</p>
            </div>
          )}
        </div>

        {/* ── フッター ── */}
        {!showComplete && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border/30 bg-muted/20">
            {/* 左ボタン */}
            <div>
              {step > 0 && (
                <button
                  onClick={() => setStep(step - 1)}
                  disabled={isGenerating}
                  className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
                >
                  戻る
                </button>
              )}
            </div>

            {/* 右ボタン群 */}
            <div className="flex items-center gap-3">
              {step === 2 && (
                <button
                  onClick={handlePreview}
                  disabled={!csvText.trim() || isGenerating}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <Eye className="h-3.5 w-3.5" />
                  プレビュー
                </button>
              )}

              {step < 2 ? (
                <button
                  onClick={() => setStep(step + 1)}
                  disabled={step === 0 && variables.length === 0}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-foreground text-background hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-40"
                >
                  次へ
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  onClick={handleGenerate}
                  disabled={!csvText.trim() || isGenerating}
                  className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 hover:scale-[1.02] active:scale-[0.97] transition-all disabled:opacity-50 disabled:hover:scale-100"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>量産中...</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      <span>一括生成 (ZIP)</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
