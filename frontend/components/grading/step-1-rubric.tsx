"use client";

/**
 * 採点モード Step 1 — 採点基準を確認
 *
 * 左: 問題 PDF プレビュー (問題 LaTeX をコンパイルして表示)
 *     どの問題に対する採点なのか視覚的に確認できるようにするため
 * 右: 採点基準テーブル + AI 自動生成 + 保存
 */
import React, { useEffect, useRef, useState } from "react";
import {
  Sparkles, Loader2, Save, FileText, AlertTriangle, RefreshCw,
} from "lucide-react";
import { useUIStore } from "@/store/ui-store";
import { useI18n } from "@/lib/i18n";
import {
  parseRubric, writeRubric, extractRubricStream,
  compileRawLatex, CompileError, formatCompileError,
} from "@/lib/api";
import type { Rubric, RubricBundle } from "@/lib/grading-types";
import { RubricTable } from "./rubric-table";
import { toast } from "sonner";

export function Step1Rubric() {
  const { t, locale } = useI18n();

  const problemLatex = useUIStore((s) => s.gradingProblemLatex);
  const rubricBundle = useUIStore((s) => s.gradingRubrics);
  const setRubricBundle = useUIStore((s) => s.setGradingRubrics);

  // ローカル編集用 state
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [parsing, setParsing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractStatus, setExtractStatus] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);

  // 初回マウント: 問題LaTeX をパース
  useEffect(() => {
    if (rubricBundle) {
      setRubrics(rubricBundle.rubrics);
      setWarnings(rubricBundle.parseWarnings);
      return;
    }
    if (!problemLatex) return;
    setParsing(true);
    parseRubric(problemLatex)
      .then((b) => {
        setRubricBundle(b);
        setRubrics(b.rubrics);
        setWarnings(b.parseWarnings);
      })
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : (locale === "en"
          ? "Failed to parse the rubric"
          : "ルーブリック解析に失敗しました"));
      })
      .finally(() => setParsing(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemLatex]);

  const handleAIExtract = async () => {
    if (!problemLatex) return;
    setExtracting(true);
    setExtractStatus(t("grading.progress.grading"));
    try {
      const result = await extractRubricStream(problemLatex, (event) => {
        if (event.type === "progress") {
          setExtractStatus(event.message);
        }
      }, undefined, locale);

      // バックエンドから返ってきた更新済み LaTeX を採用
      useUIStore.setState({ gradingProblemLatex: result.latex });
      setRubricBundle(result.rubrics);
      setRubrics(result.rubrics.rubrics);
      setWarnings(result.rubrics.parseWarnings);
      setDirty(false);
      toast.success(locale === "en"
        ? "AI generated the grading rubric"
        : "AI が採点基準を生成しました");
    } catch (e) {
      const msg = e instanceof Error ? e.message : (locale === "en"
        ? "AI extraction failed"
        : "AI 抽出に失敗しました");
      toast.error(msg);
      setExtractStatus("");
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!problemLatex) return;
    setSaving(true);
    try {
      const newLatex = await writeRubric(problemLatex, rubrics);
      useUIStore.setState({ gradingProblemLatex: newLatex });
      // パースし直して bundle を最新化
      const fresh = await parseRubric(newLatex);
      setRubricBundle(fresh);
      setRubrics(fresh.rubrics);
      setWarnings(fresh.parseWarnings);
      setDirty(false);
      toast.success(locale === "en"
        ? "Rubric saved"
        : "採点基準を保存しました");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : (locale === "en"
        ? "Save failed"
        : "保存に失敗しました"));
    } finally {
      setSaving(false);
    }
  };

  const handleRubricsChange = (next: Rubric[]) => {
    setRubrics(next);
    setDirty(true);
  };

  const isEmpty = !parsing && rubrics.length === 0;

  return (
    <div className="flex-1 min-h-0 grid grid-cols-2 gap-4 px-6 py-4 overflow-hidden">
      {/* ── 左: 問題 PDF プレビュー ── */}
      <ProblemPdfPreview latex={problemLatex} />

      {/* ── 右: 採点基準テーブル ── */}
      <div className="flex flex-col min-h-0 border border-border/40 rounded-lg overflow-hidden bg-background">
        <div className="px-3 py-2 border-b border-border/30 bg-muted/30 flex items-center gap-2">
          <span className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider flex-1">
            {locale === "en" ? "Grading rubric" : "採点基準"}
          </span>
          {dirty && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              {t("grading.action.save_rubric")}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-auto px-4 py-3">
          {parsing && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
              <span className="text-sm">{locale === "en" ? "Loading grading rubric…" : "採点基準を読み込み中…"}</span>
            </div>
          )}

          {!parsing && isEmpty && !extracting && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
              <div className="h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground/90">
                  {t("grading.rubric.empty")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("grading.rubric.empty_hint")}
                </p>
              </div>
              <button
                onClick={handleAIExtract}
                disabled={!problemLatex.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-md shadow-emerald-500/20 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {t("grading.action.ai_extract")}
              </button>
            </div>
          )}

          {extracting && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
              <span className="text-sm">{extractStatus || (locale === "en" ? "AI is drafting grading criteria…" : "AI が採点観点を考えています…")}</span>
            </div>
          )}

          {!parsing && !extracting && rubrics.length > 0 && (
            <>
              {warnings.length > 0 && (
                <div className="mb-3 p-2 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-300/40 flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <div className="text-[11px] text-amber-800 dark:text-amber-300 space-y-0.5">
                    {warnings.map((w, i) => (
                      <div key={i}>{w}</div>
                    ))}
                  </div>
                </div>
              )}
              <RubricTable rubrics={rubrics} onChange={handleRubricsChange} disabled={saving} />

              {/* 既存があってもいつでも AI に再生成させる選択肢 */}
              <div className="mt-4 pt-3 border-t border-border/30">
                <button
                  onClick={handleAIExtract}
                  disabled={extracting}
                  className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  <Sparkles className="h-3 w-3" />
                  {locale === "en" ? "Regenerate with AI" : "AI で再生成"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Rubric が同じか参照比較するためのユーティリティ (必要に応じて使う)
export function _rubricsEqual(a: Rubric[], b: Rubric[]) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// dummy export to silence unused-warning if not used elsewhere
export type { RubricBundle };

// ─────────────────────────────────────────────────────────────
// ProblemPdfPreview — 問題 LaTeX をコンパイルして iframe で表示
//
// LaTeX ソースの羅列だと採点者がどの問題を見ているか直感的に分からないため、
// 採点モード Step 1 の左ペインでは問題 PDF をそのまま表示する。
// document-editor の PdfPreviewPanel と似た挙動だが、こちらは:
//   - リサイズ不可 (grid セル幅に追従)
//   - latex が変わった瞬間に 1 度だけコンパイル (採点画面では普通 1 回だけ)
//   - 失敗時はエラー表示 + リトライボタン
// ─────────────────────────────────────────────────────────────

interface ProblemPdfPreviewProps {
  latex: string;
}

interface CompileErrorView {
  title: string;
  lines: string[];
  hint?: string;
}

function ProblemPdfPreview({ latex }: ProblemPdfPreviewProps) {
  const { t } = useI18n();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [compileError, setCompileError] = useState<CompileErrorView | null>(null);
  const compileSeqRef = useRef(0);

  const runCompile = React.useCallback(async (source: string) => {
    if (!source.trim()) {
      setPreviewUrl(null);
      setCompileError(null);
      setCompiling(false);
      return;
    }
    const seq = ++compileSeqRef.current;
    setCompiling(true);
    setCompileError(null);
    try {
      const blob = await compileRawLatex(source, "problem");
      if (seq !== compileSeqRef.current) return;
      const url = URL.createObjectURL(blob);
      setPreviewUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return url;
      });
      setCompileError(null);
    } catch (e) {
      if (seq !== compileSeqRef.current) return;
      if (e instanceof CompileError) {
        setCompileError(formatCompileError(e, t));
      } else if (e instanceof Error) {
        setCompileError({ title: t("error.compile"), lines: [e.message] });
      } else {
        setCompileError({ title: t("error.compile"), lines: [t("error.pdf_generation_failed")] });
      }
    } finally {
      if (seq === compileSeqRef.current) setCompiling(false);
    }
  }, [t]);

  // latex が変わるたびに自動コンパイル (短いデバウンスで連続変更に追随)
  useEffect(() => {
    const timer = setTimeout(() => runCompile(latex), 200);
    return () => clearTimeout(timer);
  }, [latex, runCompile]);

  // アンマウント時に Blob URL を解放
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col min-h-0 border border-border/40 rounded-lg overflow-hidden bg-muted/10">
      <div className="px-3 py-2 border-b border-border/30 bg-muted/30 flex items-center gap-2">
        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider flex-1">
          {t("grading.rubric.preview")}
        </span>
        {compiling && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t("doc.editor.compiling")}
          </span>
        )}
        <button
          onClick={() => runCompile(latex)}
          disabled={!latex.trim() || compiling}
          className="rounded p-1 text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-30"
          title={t("grading.rubric.recompile")}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden bg-white dark:bg-neutral-900">
        {compileError && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-rose-50/95 p-6 text-center dark:bg-rose-950/40 overflow-auto">
            <AlertTriangle className="h-7 w-7 text-rose-500 shrink-0" />
            <div className="max-w-md space-y-2">
              <div className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                {compileError.title}
              </div>
              <div className="text-xs text-rose-700/90 dark:text-rose-300/90 space-y-1 text-left">
                {compileError.lines.map((line, idx) => (
                  <div key={idx}>{line}</div>
                ))}
              </div>
              {compileError.hint && (
                <div className="text-[11px] italic text-rose-600/80 dark:text-rose-400/80 pt-1 border-t border-rose-300/40">
                  {compileError.hint}
                </div>
              )}
            </div>
            <button
              onClick={() => runCompile(latex)}
              className="rounded-md bg-rose-500 px-3 py-1 text-xs font-medium text-white hover:bg-rose-600"
            >
              {t("grading.rubric.retry")}
            </button>
          </div>
        )}

        {!compileError && previewUrl && (
          <iframe
            src={previewUrl}
            title={t("grading.rubric.preview")}
            className="h-full w-full border-0"
          />
        )}

        {!compileError && !previewUrl && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {compiling
              ? t("grading.rubric.pdf_generating")
              : (latex.trim() ? t("grading.rubric.preview_preparing") : t("grading.rubric.empty_problem"))}
          </div>
        )}
      </div>
    </div>
  );
}
