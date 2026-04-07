"use client";

/**
 * 採点モード Step 1 — 採点基準を確認
 *
 * 左: 問題LaTeX のソース表示
 * 右: 採点基準テーブル + AI 自動生成 + 保存
 */
import React, { useEffect, useState } from "react";
import { Sparkles, Loader2, Save, FileCheck2, AlertTriangle } from "lucide-react";
import { useUIStore } from "@/store/ui-store";
import { useI18n } from "@/lib/i18n";
import { parseRubric, writeRubric, extractRubricStream } from "@/lib/api";
import type { Rubric, RubricBundle } from "@/lib/grading-types";
import { RubricTable } from "./rubric-table";
import { toast } from "sonner";

export function Step1Rubric() {
  const { t } = useI18n();

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
        toast.error(e instanceof Error ? e.message : "ルーブリック解析に失敗しました");
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
      });

      // バックエンドから返ってきた更新済み LaTeX を採用
      useUIStore.setState({ gradingProblemLatex: result.latex });
      setRubricBundle(result.rubrics);
      setRubrics(result.rubrics.rubrics);
      setWarnings(result.rubrics.parseWarnings);
      setDirty(false);
      toast.success("AI が採点基準を生成しました");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "AI 抽出に失敗しました";
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
      toast.success("採点基準を保存しました");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存に失敗しました");
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
      {/* ── 左: 問題プレビュー ── */}
      <div className="flex flex-col min-h-0 border border-border/40 rounded-lg overflow-hidden bg-muted/10">
        <div className="px-3 py-2 border-b border-border/30 bg-muted/30 flex items-center gap-2">
          <FileCheck2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">
            問題LaTeX
          </span>
        </div>
        <div className="flex-1 overflow-auto">
          <pre className="text-[11px] font-mono leading-[1.55] text-foreground/80 px-4 py-3 whitespace-pre-wrap break-all">
            {problemLatex || "(空)"}
          </pre>
        </div>
      </div>

      {/* ── 右: 採点基準テーブル ── */}
      <div className="flex flex-col min-h-0 border border-border/40 rounded-lg overflow-hidden bg-background">
        <div className="px-3 py-2 border-b border-border/30 bg-muted/30 flex items-center gap-2">
          <span className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider flex-1">
            採点基準
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
              <span className="text-sm">採点基準を読み込み中…</span>
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
              <span className="text-sm">{extractStatus || "AI が採点観点を考えています…"}</span>
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
                  AI で再生成
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
