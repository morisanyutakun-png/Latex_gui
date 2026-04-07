"use client";

import React, { useState } from "react";
import { Plus, Trash2, CheckCircle2, XCircle, ClipboardCheck } from "lucide-react";
import { scoreAnswers } from "@/lib/api";
import type { AnswerKeyItem, AnswerKey, StudentAnswer, ScoreResult } from "@/lib/types";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

export function ScoringPanel() {
  const { t } = useI18n();

  const [answerItems, setAnswerItems] = useState<AnswerKeyItem[]>([
    { questionId: "Q1", correctAnswer: "", points: 1, answerType: "choice" },
  ]);
  const [studentAnswers, setStudentAnswers] = useState<StudentAnswer[]>([]);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [loading, setLoading] = useState(false);

  const addItem = () => {
    const num = answerItems.length + 1;
    setAnswerItems([...answerItems, { questionId: `Q${num}`, correctAnswer: "", points: 1, answerType: "choice" }]);
    setStudentAnswers([...studentAnswers, { questionId: `Q${num}`, answer: "", confidence: 1 }]);
  };

  const removeItem = (idx: number) => {
    setAnswerItems(answerItems.filter((_, i) => i !== idx));
    setStudentAnswers(studentAnswers.filter((_, i) => i !== idx));
  };

  const updateKey = (idx: number, updates: Partial<AnswerKeyItem>) => {
    setAnswerItems(answerItems.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, ...updates };
      // Sync questionId to studentAnswers
      if (updates.questionId) {
        setStudentAnswers((sa) => sa.map((s, j) => j === idx ? { ...s, questionId: updates.questionId! } : s));
      }
      return updated;
    }));
  };

  const updateStudentAnswer = (idx: number, answer: string) => {
    // Auto-create student answers if needed
    const sa = [...studentAnswers];
    while (sa.length <= idx) {
      sa.push({ questionId: answerItems[sa.length]?.questionId ?? "", answer: "", confidence: 1 });
    }
    sa[idx] = { ...sa[idx], answer };
    setStudentAnswers(sa);
  };

  const handleScore = async () => {
    if (answerItems.length === 0) return;
    setLoading(true);
    try {
      const key: AnswerKey = {
        title: "",
        items: answerItems,
        totalPoints: answerItems.reduce((sum, i) => sum + i.points, 0),
      };
      const res = await scoreAnswers(key, studentAnswers);
      setResult(res);
    } catch {
      toast.error(t("toast.scoring.fail"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30 shrink-0">
        <ClipboardCheck className="h-4 w-4 text-emerald-500" />
        <h3 className="text-sm font-semibold text-foreground/90">{t("scoring.title")}</h3>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Answer Key Table */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">{t("scoring.answer_key")}</span>
            <button onClick={addItem} className="inline-flex items-center gap-1 text-[10px] text-emerald-500 hover:text-emerald-600 transition-colors">
              <Plus className="h-3 w-3" />
              {t("scoring.add")}
            </button>
          </div>

          <div className="space-y-1.5">
            {answerItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                {/* Question ID */}
                <input
                  value={item.questionId}
                  onChange={(e) => updateKey(idx, { questionId: e.target.value })}
                  className="w-12 h-7 px-1.5 text-[11px] rounded border border-border/40 bg-white/70 dark:bg-white/5 text-center font-mono"
                  placeholder="Q1"
                />
                {/* Correct Answer */}
                <input
                  value={item.correctAnswer}
                  onChange={(e) => updateKey(idx, { correctAnswer: e.target.value })}
                  className="flex-1 h-7 px-2 text-[11px] rounded border border-border/40 bg-white/70 dark:bg-white/5"
                  placeholder={t("scoring.placeholder.correct")}
                />
                {/* Type */}
                <select
                  value={item.answerType}
                  onChange={(e) => updateKey(idx, { answerType: e.target.value as "choice" | "numeric" | "text" })}
                  className="h-7 px-1 text-[10px] rounded border border-border/40 bg-white/70 dark:bg-white/5"
                >
                  <option value="choice">{t("scoring.type.choice")}</option>
                  <option value="numeric">{t("scoring.type.numeric")}</option>
                  <option value="text">{t("scoring.type.text")}</option>
                </select>
                {/* Points */}
                <input
                  type="number"
                  value={item.points}
                  onChange={(e) => updateKey(idx, { points: parseInt(e.target.value) || 1 })}
                  className="w-10 h-7 px-1 text-[11px] rounded border border-border/40 bg-white/70 dark:bg-white/5 text-center font-mono"
                  min={1}
                />
                {/* Student Answer */}
                <input
                  value={studentAnswers[idx]?.answer ?? ""}
                  onChange={(e) => updateStudentAnswer(idx, e.target.value)}
                  className="flex-1 h-7 px-2 text-[11px] rounded border border-border/40 bg-blue-50/50 dark:bg-blue-900/10"
                  placeholder={t("scoring.placeholder.student")}
                />
                {/* Delete */}
                <button onClick={() => removeItem(idx)} className="h-7 w-7 flex items-center justify-center text-muted-foreground/40 hover:text-red-400 transition-colors">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Score Button */}
        <button
          onClick={handleScore}
          disabled={loading || answerItems.length === 0}
          className="w-full h-9 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors disabled:opacity-40"
        >
          {loading ? t("scoring.button.scoring") : t("scoring.button.score")}
        </button>

        {/* Results */}
        {result && (
          <div className="space-y-3">
            {/* Score Summary */}
            <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-gradient-to-r from-emerald-50 to-sky-50 dark:from-emerald-950/30 dark:to-sky-950/30 border border-emerald-200/40 dark:border-emerald-800/30">
              <span className="text-sm font-medium text-foreground/80">{t("scoring.score")}</span>
              <div className="text-right">
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {result.totalScore}
                </span>
                <span className="text-sm text-muted-foreground">/{result.totalPossible}</span>
                <span className="ml-2 text-sm text-muted-foreground">({result.percentage}%)</span>
              </div>
            </div>

            {/* Per-Question Results */}
            <div className="space-y-1">
              {result.items.map((item) => (
                <div key={item.questionId} className="flex items-center gap-2 px-2 py-1.5 rounded text-[11px]">
                  {item.isCorrect ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                  )}
                  <span className="font-mono text-muted-foreground w-8">{item.questionId}</span>
                  <span className={item.isCorrect ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}>
                    {item.studentAnswer || "—"}
                  </span>
                  {!item.isCorrect && (
                    <span className="text-muted-foreground/50 ml-auto">{t("scoring.answer.label")}: {item.correctAnswer}</span>
                  )}
                  <span className="text-muted-foreground/40 ml-auto font-mono">{item.pointsEarned}/{item.pointsPossible}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
