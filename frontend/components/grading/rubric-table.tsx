"use client";

/**
 * 採点基準テーブル
 *
 * 設問 × 観点 のインライン編集テーブル。
 * 行追加・削除・観点追加・配点編集に対応。
 */
import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { Rubric, RubricCriterion } from "@/lib/grading-types";

interface Props {
  rubrics: Rubric[];
  onChange: (rubrics: Rubric[]) => void;
  disabled?: boolean;
}

function newCriterion(): RubricCriterion {
  return { description: "", weight: 1, hint: null };
}

function newRubric(index: number): Rubric {
  return {
    questionId: `q${index}`,
    questionLabel: `問${index}`,
    maxPoints: 5,
    criteria: [
      { description: "正しく解答できているか", weight: 5, hint: null },
    ],
    hint: null,
    sourceLine: null,
  };
}

export function RubricTable({ rubrics, onChange, disabled = false }: Props) {
  const { t } = useI18n();

  const updateRubric = (idx: number, patch: Partial<Rubric>) => {
    const next = rubrics.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    onChange(next);
  };

  const updateCriterion = (rIdx: number, cIdx: number, patch: Partial<RubricCriterion>) => {
    const next = rubrics.map((r, i) => {
      if (i !== rIdx) return r;
      const newCriteria = r.criteria.map((c, j) => (j === cIdx ? { ...c, ...patch } : c));
      const newMax = newCriteria.reduce((sum, c) => sum + (c.weight || 0), 0);
      return { ...r, criteria: newCriteria, maxPoints: newMax };
    });
    onChange(next);
  };

  const addCriterion = (rIdx: number) => {
    const next = rubrics.map((r, i) => {
      if (i !== rIdx) return r;
      const newCriteria = [...r.criteria, newCriterion()];
      return { ...r, criteria: newCriteria, maxPoints: newCriteria.reduce((s, c) => s + c.weight, 0) };
    });
    onChange(next);
  };

  const removeCriterion = (rIdx: number, cIdx: number) => {
    const next = rubrics.map((r, i) => {
      if (i !== rIdx) return r;
      const newCriteria = r.criteria.filter((_, j) => j !== cIdx);
      return { ...r, criteria: newCriteria, maxPoints: newCriteria.reduce((s, c) => s + c.weight, 0) };
    });
    onChange(next);
  };

  const addRubric = () => {
    onChange([...rubrics, newRubric(rubrics.length + 1)]);
  };

  const removeRubric = (idx: number) => {
    onChange(rubrics.filter((_, i) => i !== idx));
  };

  const totalPoints = rubrics.reduce((sum, r) => sum + r.maxPoints, 0);

  return (
    <div className="flex flex-col gap-3">
      {rubrics.map((r, rIdx) => (
        <div
          key={`${r.questionId}-${rIdx}`}
          className="border border-border/40 rounded-lg bg-background overflow-hidden"
        >
          {/* ヘッダ行 */}
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border/30">
            <input
              type="text"
              value={r.questionLabel}
              onChange={(e) => updateRubric(rIdx, { questionLabel: e.target.value })}
              disabled={disabled}
              placeholder={t("grading.rubric.col.question")}
              className="flex-1 h-7 px-2 text-sm rounded border border-border/40 bg-background"
            />
            <input
              type="text"
              value={r.questionId}
              onChange={(e) => updateRubric(rIdx, { questionId: e.target.value })}
              disabled={disabled}
              placeholder="q1-1"
              className="w-20 h-7 px-2 text-[11px] font-mono rounded border border-border/40 bg-background text-center"
            />
            <span className="text-xs text-muted-foreground tabular-nums">
              {r.maxPoints} {t("grading.rubric.col.points")}
            </span>
            <button
              type="button"
              onClick={() => removeRubric(rIdx)}
              disabled={disabled}
              className="p-1 text-muted-foreground/40 hover:text-red-500 transition-colors"
              title="この設問を削除"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* 観点行 */}
          <div className="px-3 py-2 space-y-1.5">
            {r.criteria.map((c, cIdx) => (
              <div key={cIdx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={c.description}
                  onChange={(e) => updateCriterion(rIdx, cIdx, { description: e.target.value })}
                  disabled={disabled}
                  placeholder={t("grading.rubric.col.criteria")}
                  className="flex-1 h-7 px-2 text-[12px] rounded border border-border/30 bg-background"
                />
                <input
                  type="number"
                  value={c.weight}
                  onChange={(e) => updateCriterion(rIdx, cIdx, { weight: parseInt(e.target.value) || 0 })}
                  disabled={disabled}
                  min={0}
                  className="w-14 h-7 px-2 text-[12px] rounded border border-border/30 bg-background text-center font-mono tabular-nums"
                  title={t("grading.rubric.col.weight")}
                />
                <button
                  type="button"
                  onClick={() => removeCriterion(rIdx, cIdx)}
                  disabled={disabled || r.criteria.length <= 1}
                  className="p-1 text-muted-foreground/40 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="この観点を削除"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addCriterion(rIdx)}
              disabled={disabled}
              className="inline-flex items-center gap-1 text-[11px] text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 mt-1"
            >
              <Plus className="h-3 w-3" />
              観点を追加
            </button>
          </div>
        </div>
      ))}

      {/* 設問追加 + 合計 */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={addRubric}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg border border-emerald-500/30 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          設問を追加
        </button>
        <span className="text-sm font-medium tabular-nums">
          {t("grading.rubric.total")}: {totalPoints} {t("grading.rubric.col.points")}
        </span>
      </div>
    </div>
  );
}
