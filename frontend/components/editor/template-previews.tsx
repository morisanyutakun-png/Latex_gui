"use client";

/**
 * template-previews.tsx
 *
 * 各テンプレートの「成果物」を視覚的に表すミニチュア・プレビュー。
 * 文字説明ではなく、実際の PDF の構成 (タイトル帯/問題ボックス/罫線/表など)
 * を A4 縦比 (1:√2) の白紙に縮小して描く。
 *
 * すべての可視テキストはロケール対応 (ja / en) で出し分ける。
 * TemplatePreview が useI18n() で locale を取得し、各 *Preview に props で渡す。
 */

import React from "react";
import { useI18n } from "@/lib/i18n";

type Locale = "ja" | "en";

/** 文字列の locale 別出し分けヘルパ。短く書くために多用する。 */
const t = (locale: Locale, ja: string, en: string): string => (locale === "en" ? en : ja);

// ──────────────────────────────────────────
// 共通プリミティブ
// ──────────────────────────────────────────

/** A4 比の白紙 (用紙) */
function Paper({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <div
      className={`relative w-full aspect-[210/297] bg-white rounded-sm shadow-inner shadow-black/10 ring-1 ring-black/10 overflow-hidden ${className}`}
    >
      {children}
    </div>
  );
}

/** ダミー本文行 (灰色の細い線) */
function Line({ w = "100%", h = 2, color = "rgba(0,0,0,0.18)", className = "" }: { w?: string | number; h?: number; color?: string; className?: string }) {
  return (
    <div
      className={`rounded-full ${className}`}
      style={{ width: typeof w === "number" ? `${w}%` : w, height: h, background: color }}
    />
  );
}

/** 行の塊 (n 本のランダム長線) */
function Lines({ n = 3, gap = 3, widths }: { n?: number; gap?: number; widths?: (string | number)[] }) {
  const ws = widths ?? Array.from({ length: n }, (_, i) => 100 - (i % 3) * 8);
  return (
    <div className="flex flex-col" style={{ gap }}>
      {ws.slice(0, n).map((w, i) => (
        <Line key={i} w={w} />
      ))}
    </div>
  );
}

// ──────────────────────────────────────────
// 1. Blank — 真っ白い紙
// ──────────────────────────────────────────
export function BlankPreview() {
  return <Paper />;
}

// ──────────────────────────────────────────
// 2. 共通テスト風 / National exam style
// ──────────────────────────────────────────
export function CommonTestPreview({ locale }: { locale: Locale }) {
  const navy = "#1e3a8a";
  const titleMain = t(locale, "数学 I・A", "Mathematics I·A");
  const titleSub = t(locale, "第 1 回 共通テスト型 模擬試験", "Mock Exam #1 — National Test Format");
  const meta = t(locale, "70 分 ・ 100 点 ・ 大問 5", "70 min · 100 pts · 5 problems");
  const noticeLabel = t(locale, "注意事項", "Instructions");
  const problems = [
    t(locale, "第 1 問　数と式・集合 (20)", "Problem 1  Numbers, Expressions & Sets (20)"),
    t(locale, "第 2 問　二次関数 (25)", "Problem 2  Quadratic Functions (25)"),
    t(locale, "第 3 問　図形と計量 (25)", "Problem 3  Geometry & Measurement (25)"),
  ];
  const pageLabel = t(locale, "第 1 ページ", "Page 1");

  return (
    <Paper>
      <div className="absolute inset-0 px-3 py-3 flex flex-col gap-1.5 font-serif">
        <div className="flex flex-col items-center gap-0.5">
          <div className="text-[7px] font-bold" style={{ color: navy }}>{titleMain}</div>
          <div className="text-[5.5px] font-semibold text-gray-800">{titleSub}</div>
          <div className="mt-0.5 px-1.5 py-[1.5px] border border-blue-900/40 rounded-[1px] text-[3.8px] text-gray-700">
            {meta}
          </div>
        </div>

        <div className="flex flex-col gap-[1.5px]">
          <div className="text-[3.5px] font-bold" style={{ color: navy }}>{noticeLabel}</div>
          <Line w={92} h={1.2} />
          <Line w={86} h={1.2} />
        </div>

        {problems.map((title, i) => (
          <div key={i} className="rounded-[2px] border" style={{ borderColor: `${navy}aa` }}>
            <div
              className="px-1.5 py-[2px] text-[3.8px] font-bold text-white"
              style={{ background: navy }}
            >
              {title}
            </div>
            <div className="px-2 py-1.5 flex flex-col gap-[2px] bg-blue-900/[0.03]">
              <Lines n={3} widths={[100, 92, 78]} />
            </div>
          </div>
        ))}

        <div className="mt-auto text-right text-[3px] text-gray-500">{pageLabel}</div>
      </div>
    </Paper>
  );
}

// ──────────────────────────────────────────
// 3. 国公立二次風 / University 2nd-stage style
// ──────────────────────────────────────────
export function KokukoNijiPreview({ locale }: { locale: Locale }) {
  const titleMain = t(locale, "○○大学 入学試験問題", "Example University Entrance Exam");
  const titleSub = t(locale, "数学 (理系)", "Mathematics (Science Track)");
  const meta = t(locale, "試験時間 150 分　配点 200 点", "Time: 150 min · Total: 200 pts");
  const notice = t(
    locale,
    "注意 ・ 解答は所定の解答用紙に / 結果のみでなく導出過程も",
    "Note · Write all answers in the answer booklet / Show all reasoning"
  );

  return (
    <Paper>
      <div className="absolute inset-0 px-4 py-4 flex flex-col gap-2 font-serif">
        <div className="flex flex-col items-center">
          <div className="text-[7px] font-bold text-black">{titleMain}</div>
          <div className="text-[5px] text-gray-700 mt-0.5">{titleSub}</div>
          <div className="mt-1 w-3/4 border-t border-b border-gray-800 py-[3px]">
            <div className="text-center text-[3.8px] text-gray-700">{meta}</div>
          </div>
        </div>

        <div className="text-[3.6px] text-gray-700 leading-tight">{notice}</div>

        {["1", "2", "3"].map((num) => (
          <div key={num} className="mt-1">
            <div className="flex items-center gap-1.5">
              <div className="px-1 py-[1px] border border-gray-800 text-[4px] font-bold leading-none">
                {t(locale, `第 ${num} 問`, `Problem ${num}`)}
              </div>
            </div>
            <div className="border-t border-gray-700 mt-[2px] mb-1" />
            <Lines n={4} widths={[100, 96, 88, 70]} gap={3} />
          </div>
        ))}

        <div className="mt-auto text-center text-[3px] text-gray-500">- 1 -</div>
      </div>
    </Paper>
  );
}

// ──────────────────────────────────────────
// 4. 学校テスト / School test
// ──────────────────────────────────────────
export function SchoolTestPreview({ locale }: { locale: Locale }) {
  const accent = "#dc2626";
  const title = t(locale, "数学 II 第 2 回 定期考査", "Algebra II — Quarter Test #2");
  const labels = {
    year: t(locale, "年", "Yr"),
    klass: t(locale, "組", "Cls"),
    num: t(locale, "番", "No."),
    name: t(locale, "氏名", "Name"),
    score: t(locale, "得点", "Score"),
  };
  const problems = [
    [t(locale, "第 1 問", "Problem 1"), t(locale, "計算 (各 5 点)", "Computation (5 pts each)")],
    [t(locale, "第 2 問", "Problem 2"), t(locale, "方程式・不等式 (各 8 点)", "Equations & Inequalities (8 pts each)")],
    [t(locale, "第 3 問", "Problem 3"), t(locale, "二次関数 (各 10 点)", "Quadratic Functions (10 pts each)")],
  ];

  return (
    <Paper>
      <div className="absolute inset-0 px-3 py-3 flex flex-col gap-1.5 font-sans">
        <div className="text-center text-[7.5px] font-bold text-gray-900">{title}</div>

        <div className="flex items-stretch gap-1 mt-1">
          <div className="flex-1 grid grid-cols-6 border border-gray-700 text-[3.5px]">
            <div className="border-r border-gray-700 px-0.5 py-0.5 text-center bg-gray-50">{labels.year}</div>
            <div className="border-r border-gray-700 px-0.5 py-0.5"></div>
            <div className="border-r border-gray-700 px-0.5 py-0.5 text-center bg-gray-50">{labels.klass}</div>
            <div className="border-r border-gray-700 px-0.5 py-0.5"></div>
            <div className="border-r border-gray-700 px-0.5 py-0.5 text-center bg-gray-50">{labels.num}</div>
            <div></div>
            <div className="col-span-1 border-t border-r border-gray-700 px-0.5 py-0.5 text-center bg-gray-50">{labels.name}</div>
            <div className="col-span-5 border-t border-gray-700"></div>
          </div>
          <div className="w-[26%] border border-gray-800 flex flex-col items-center justify-center">
            <div className="text-[3.5px] font-bold text-gray-700">{labels.score}</div>
            <div className="text-[6px] font-bold mt-0.5" style={{ color: accent }}>/ 100</div>
          </div>
        </div>

        {problems.map(([num, sub], i) => (
          <div key={i} className="mt-1">
            <div className="flex items-center gap-1">
              <div className="w-[2px] h-2.5" style={{ background: accent }} />
              <div className="text-[4.5px] font-bold text-gray-900">{num}</div>
              <div className="text-[3.8px] text-gray-600">{sub}</div>
            </div>
            <div className="pl-2 mt-0.5 flex flex-col gap-[2px]">
              <Lines n={2} widths={[92, 80]} />
            </div>
          </div>
        ))}
      </div>
    </Paper>
  );
}

// ──────────────────────────────────────────
// 5. 塾プリント / Cram-school worksheet
// ──────────────────────────────────────────
export function JukuPreview({ locale }: { locale: Locale }) {
  const orange = "#ea580c";
  const navy = "#0c4a6e";
  const title = t(locale, "二次関数 完全マスター", "Quadratic Functions Mastery");
  const lesson = "Lesson 03";
  const levelLabel = t(locale, "難度", "Level");
  const basicTitle = t(locale, "基本問題　★☆☆ ウォームアップ", "Basic  ★☆☆ Warm-up");
  const standardTitle = t(locale, "標準問題　★★☆ 解の配置", "Standard  ★★☆ Root location");
  const advancedTitle = t(locale, "応用問題　★★★ 文字を含む最大最小", "Advanced  ★★★ Parametric max/min");
  const pointTitle = t(locale, "Today's Point", "Today's Point");
  const pointBody = t(
    locale,
    "・ 軸と定義域の位置で場合分け / ・ 解の配置は D + 軸 + 端",
    "· Split by axis vs interval / · Root location: D + axis + endpoints"
  );

  return (
    <Paper>
      <div className="absolute inset-0 px-3 py-3 flex flex-col gap-1.5">
        <div
          className="rounded-sm px-2 py-1 flex items-center justify-between text-white"
          style={{ background: orange }}
        >
          <div className="text-[6px] font-bold">{title}</div>
          <div className="text-[3.5px] font-semibold opacity-90">{lesson}</div>
        </div>

        <div className="flex items-center gap-1">
          {["★☆☆", "★★☆", "★★★"].map((s, i) => (
            <div
              key={i}
              className="text-[3.5px] font-bold px-1 py-[0.5px] border rounded-[1px]"
              style={{ borderColor: orange, color: orange }}
            >
              {levelLabel} {s}
            </div>
          ))}
        </div>

        <div className="rounded-[1px] border-l-[3px] border" style={{ borderLeftColor: orange, borderColor: `${orange}88`, background: "#fff7ed" }}>
          <div className="px-1.5 py-[2px] text-[4px] font-bold text-orange-900">{basicTitle}</div>
          <div className="px-2 pb-1 flex flex-col gap-[2px]">
            <Lines n={3} widths={[90, 80, 70]} />
          </div>
        </div>

        <div className="rounded-[1px] border-l-[3px] border" style={{ borderLeftColor: orange, borderColor: `${orange}88`, background: "#fff7ed" }}>
          <div className="px-1.5 py-[2px] text-[4px] font-bold text-orange-900">{standardTitle}</div>
          <div className="px-2 pb-1 flex flex-col gap-[2px]">
            <Lines n={2} widths={[88, 78]} />
          </div>
        </div>

        <div className="rounded-[1px] border-l-[3px] border" style={{ borderLeftColor: navy, borderColor: `${navy}88`, background: "white" }}>
          <div className="px-1.5 py-[2px] text-[4px] font-bold" style={{ color: navy }}>{advancedTitle}</div>
          <div className="px-2 pb-1 flex flex-col gap-[2px]">
            <Lines n={2} widths={[92, 70]} />
          </div>
        </div>

        <div className="mt-auto text-[3px] text-orange-900/80">
          <div className="font-bold">{pointTitle}</div>
          <div>{pointBody}</div>
        </div>
      </div>
    </Paper>
  );
}

// ──────────────────────────────────────────
// 6. 解説ノート / Lecture note
// ──────────────────────────────────────────
export function KaisetsuNotePreview({ locale }: { locale: Locale }) {
  const teal = "#0d9488";
  const sky = "#0284c7";
  const chapTitle = t(locale, "第 3 章　微分の応用", "Chapter 3.  Applications of Differentiation");
  const chapSub = t(locale, "Differentiation and its Applications", "Tangent lines, Mean Value Theorem");
  const sec1 = t(locale, "1. 接線の方程式", "1. The equation of a tangent line");
  const sec2 = t(locale, "2. 平均値の定理", "2. The Mean Value Theorem");
  const defLabel = t(locale, "定義", "Definition");
  const exLabel = t(locale, "例題", "Worked example");
  const noteLabel = t(locale, "! 注意", "! Note");
  const noteBody = t(
    locale,
    "　微分可能でない点では接線は考えない",
    "  At non-differentiable points there is no tangent line"
  );
  const thmLabel = t(locale, "定理", "Theorem");

  return (
    <Paper>
      <div className="absolute inset-0 px-3 py-3 flex flex-col gap-1.5">
        <div className="text-center">
          <div className="text-[7px] font-bold" style={{ color: teal }}>{chapTitle}</div>
          <div className="text-[3.5px] italic text-gray-500 mt-0.5">{chapSub}</div>
        </div>

        <div className="flex items-baseline gap-1 mt-0.5">
          <div className="text-[5px]" style={{ color: teal }}>▸</div>
          <div className="text-[5px] font-bold" style={{ color: teal }}>{sec1}</div>
        </div>

        <div className="rounded-[2px] border" style={{ borderColor: teal, background: "#ecfeff" }}>
          <div
            className="inline-block ml-1.5 -mt-[3px] px-1 py-[1px] text-[3.5px] font-bold text-white rounded-[1px]"
            style={{ background: teal }}
          >
            {defLabel}
          </div>
          <div className="px-2 pb-1 -mt-[2px] flex flex-col gap-[2px]">
            <Lines n={3} widths={[96, 90, 70]} />
          </div>
        </div>

        <div className="rounded-[1px] border" style={{ borderColor: `${teal}88`, background: "#f0fdfa" }}>
          <div className="px-1.5 py-[2px] text-[3.8px] font-bold" style={{ color: teal }}>{exLabel}</div>
          <div className="px-2 pb-1 flex flex-col gap-[2px]">
            <Lines n={3} widths={[92, 88, 76]} />
          </div>
        </div>

        <div className="text-[3.5px]">
          <span className="text-rose-600 font-bold">{noteLabel}</span>
          <span className="text-gray-600">{noteBody}</span>
        </div>

        <div className="flex items-baseline gap-1 mt-0.5">
          <div className="text-[5px]" style={{ color: teal }}>▸</div>
          <div className="text-[5px] font-bold" style={{ color: teal }}>{sec2}</div>
        </div>

        <div className="rounded-[2px] border" style={{ borderColor: sky, background: "white" }}>
          <div
            className="inline-block ml-1.5 -mt-[3px] px-1 py-[1px] text-[3.5px] font-bold text-white rounded-[1px]"
            style={{ background: sky }}
          >
            {thmLabel}
          </div>
          <div className="px-2 pb-1 -mt-[2px] flex flex-col gap-[2px]">
            <Lines n={2} widths={[94, 80]} />
          </div>
        </div>
      </div>
    </Paper>
  );
}

// ──────────────────────────────────────────
// 7. 演習プリント / Practice worksheet
// ──────────────────────────────────────────
export function WorksheetPreview({ locale }: { locale: Locale }) {
  const teal = "#0d9488";
  const title = t(locale, "三角比　演習プリント", "Trigonometry — Practice Worksheet");
  const fields = {
    cls: t(locale, "学年・組", "Class"),
    num: t(locale, "番号", "No."),
    name: t(locale, "氏名", "Name"),
  };
  const unit = t(
    locale,
    "単元　三角比の定義 / 正弦定理 / 余弦定理",
    "Unit  Trig definitions / Law of Sines / Law of Cosines"
  );
  const basic = t(locale, "【基本】 角の値が分かっているケース", "[Basic] Special angles");
  const standard = t(locale, "【標準】 正弦定理・余弦定理", "[Standard] Law of Sines / Cosines");
  const advanced = t(locale, "【発展】 場合分け・図形応用", "[Advanced] Casework and area");

  return (
    <Paper>
      <div className="absolute inset-0 px-3 py-3 flex flex-col gap-1.5">
        <div className="text-center text-[6.5px] font-bold text-gray-900">{title}</div>

        <div className="text-[3.4px] text-gray-600 flex gap-1 items-center">
          <span>{fields.cls}</span>
          <div className="flex-1 border-b border-gray-400" />
          <span>{fields.num}</span>
          <div className="w-[12%] border-b border-gray-400" />
          <span>{fields.name}</span>
          <div className="flex-[1.5] border-b border-gray-400" />
        </div>

        <div
          className="rounded-[1px] px-2 py-1 text-[4px] font-bold text-white mt-1"
          style={{ background: teal }}
        >
          {unit}
        </div>

        <div>
          <div
            className="inline-block px-1.5 py-[1px] text-[3.8px] font-bold rounded-[1px] border"
            style={{ borderColor: `${teal}88`, color: teal, background: "#ecfeff" }}
          >
            {basic}
          </div>
          <div className="pl-2 mt-1 flex flex-col gap-[2px]">
            <Lines n={2} widths={[88, 70]} />
          </div>
        </div>

        <div>
          <div
            className="inline-block px-1.5 py-[1px] text-[3.8px] font-bold rounded-[1px] border"
            style={{ borderColor: `${teal}88`, color: teal, background: "#ecfeff" }}
          >
            {standard}
          </div>
          <div className="pl-2 mt-1 flex flex-col gap-[2px]">
            <Lines n={3} widths={[92, 86, 78]} />
          </div>
        </div>

        <div>
          <div
            className="inline-block px-1.5 py-[1px] text-[3.8px] font-bold rounded-[1px] border"
            style={{ borderColor: `${teal}88`, color: teal, background: "#ecfeff" }}
          >
            {advanced}
          </div>
          <div className="pl-2 mt-1 flex flex-col gap-[2px]">
            <Lines n={2} widths={[92, 76]} />
          </div>
        </div>
      </div>
    </Paper>
  );
}

// ──────────────────────────────────────────
// 8. 英語ワークシート / Reading worksheet
// ──────────────────────────────────────────
export function EnglishWorksheetPreview({ locale }: { locale: Locale }) {
  const moss = "#16a34a";
  const cream = "#f0fdf4";
  const accent = "#ca8a04";
  // Vocab pairs differ by locale: JA shows EN→JA glosses, EN shows EN→definition
  const vocab = locale === "en"
    ? [
        "curiosity / a desire to know",
        "discover / find for the first time",
        "remarkable / striking; notable",
        "phenomenon / an observable fact",
      ]
    : [
        "curiosity / 好奇心",
        "discover / 発見",
        "remarkable / 注目",
        "phenomenon / 現象",
      ];

  return (
    <Paper>
      <div className="absolute inset-0 px-3 py-3 flex flex-col gap-1.5">
        <div className="text-center">
          <div className="text-[7px] font-bold" style={{ color: "#14532d" }}>Unit 5: The Power of Curiosity</div>
          <div className="text-[3.5px] italic text-gray-600 mt-0.5">Reading · Vocabulary · Comprehension</div>
        </div>

        <div className="text-[4px] font-bold" style={{ color: moss }}>Part 1  Vocabulary</div>
        <div className="rounded-[1px] border px-1.5 py-1 grid grid-cols-2 gap-x-2 gap-y-[1px]" style={{ borderColor: `${accent}88` }}>
          {vocab.map((s, i) => (
            <div key={i} className="text-[3.5px] text-gray-700">{s}</div>
          ))}
        </div>

        <div className="text-[4px] font-bold" style={{ color: moss }}>Part 2  Reading</div>
        <div className="rounded-[2px] border px-2 py-1 flex flex-col gap-[2px]" style={{ borderColor: `${moss}88`, background: cream }}>
          <Lines n={5} widths={[100, 96, 92, 88, 78]} />
        </div>

        <div className="text-[4px] font-bold" style={{ color: moss }}>Part 3  Comprehension</div>
        <div className="pl-2 flex flex-col gap-[2px]">
          <Lines n={3} widths={[88, 80, 72]} />
        </div>

        <div className="text-[4px] font-bold mt-0.5" style={{ color: moss }}>Part 4  Writing</div>
        <div className="flex flex-col gap-[3px]">
          <div className="border-b border-gray-400 h-[3px]" />
          <div className="border-b border-gray-400 h-[3px]" />
          <div className="border-b border-gray-400 h-[3px]" />
        </div>
      </div>
    </Paper>
  );
}

// ──────────────────────────────────────────
// 9. レポート・論文 / Academic article
// ──────────────────────────────────────────
export function ArticlePreview({ locale }: { locale: Locale }) {
  const navy = "#1e40af";
  const titleLines = locale === "en"
    ? ["Template-Driven LaTeX Generation", "with Large Language Models"]
    : ["機械学習による教材生成の", "高速化に関する一考察"];
  const author = t(locale, "著者名† ・ 所属機関", "Author Name† · Affiliation");
  const sec1 = t(locale, "はじめに", "Introduction");
  const sec2 = t(locale, "関連研究", "Related Work");
  const sec3Title = t(locale, "3　提案手法", "3  Method");
  const sec4Title = t(locale, "4　実験結果", "4  Experiments");
  const tableHead = locale === "en"
    ? ["Method", "Time", "Score"]
    : ["手法", "時間", "評価"];
  const tableRows = locale === "en"
    ? [["Manual", "42.5", "3.8"], ["Ours", "11.6", "4.4"]]
    : [["手作業", "42.5", "3.8"], ["提案", "11.6", "4.4"]];
  const refs = "[1] Vaswani et al. 2017　[2] Brown et al. 2020";

  return (
    <Paper>
      <div className="absolute inset-0 px-4 py-4 flex flex-col gap-1.5 font-serif">
        <div className="text-center">
          <div className="text-[6px] font-bold text-gray-900 leading-tight">
            {titleLines[0]}<br />{titleLines[1]}
          </div>
          <div className="text-[3.5px] text-gray-600 mt-0.5">{author}</div>
        </div>

        <div className="mx-2 mt-1 px-1.5 py-1 border-l-2 border-r-2 border-gray-200">
          <div className="text-[3.5px] font-bold text-center" style={{ color: navy }}>Abstract</div>
          <div className="mt-0.5 flex flex-col gap-[1.5px]">
            <Line w={100} h={1} />
            <Line w={94} h={1} />
            <Line w={88} h={1} />
          </div>
        </div>

        <div className="mt-1 grid grid-cols-2 gap-2">
          {[1, 2].map((c) => (
            <div key={c} className="flex flex-col gap-1">
              <div className="text-[4px] font-bold" style={{ color: navy }}>
                {c}　{c === 1 ? sec1 : sec2}
              </div>
              <Lines n={4} widths={[100, 96, 92, 70]} gap={2} />
            </div>
          ))}
        </div>

        <div className="text-[4px] font-bold" style={{ color: navy }}>{sec3Title}</div>
        <Lines n={2} widths={[100, 92]} />
        <div className="mx-auto text-[3.5px] italic text-gray-600">L = L_valid + λ · L_style</div>

        <div className="text-[4px] font-bold" style={{ color: navy }}>{sec4Title}</div>
        <div className="mx-auto w-[80%] border-t border-b border-gray-700 text-[3px]">
          <div className="grid grid-cols-3 px-1 py-0.5 border-b border-gray-300">
            <div>{tableHead[0]}</div><div className="text-right">{tableHead[1]}</div><div className="text-right">{tableHead[2]}</div>
          </div>
          <div className="grid grid-cols-3 px-1 py-0.5 text-gray-600">
            <div>{tableRows[0][0]}</div><div className="text-right">{tableRows[0][1]}</div><div className="text-right">{tableRows[0][2]}</div>
          </div>
          <div className="grid grid-cols-3 px-1 py-0.5 font-bold">
            <div>{tableRows[1][0]}</div><div className="text-right">{tableRows[1][1]}</div><div className="text-right">{tableRows[1][2]}</div>
          </div>
        </div>

        <div className="mt-auto text-[3px] text-gray-500">{refs}</div>
      </div>
    </Paper>
  );
}

// ──────────────────────────────────────────
// 10. 技術報告書 / Technical report
// ──────────────────────────────────────────
export function ReportPreview({ locale }: { locale: Locale }) {
  const teal = "#0f766e";
  const chapTitle = t(locale, "システム概要", "System Overview");
  const tocLabel = t(locale, "目次", "Contents");
  const tocItems = locale === "en"
    ? [
        ["1.1 Background", "3"],
        ["1.2 Terminology", "5"],
        ["2.1 Overall Architecture", "7"],
        ["2.2 API Specification", "9"],
        ["3.1 Mathematical Model", "12"],
      ]
    : [
        ["1.1 背景", "3"],
        ["1.2 用語定義", "5"],
        ["2.1 全体構成", "7"],
        ["2.2 API 仕様", "9"],
        ["3.1 数理モデル", "12"],
      ];
  const sec11 = t(locale, "1.1　背景", "1.1  Background");
  const apiHead = locale === "en"
    ? ["endpoint", "method", "description"]
    : ["endpoint", "method", "説明"];
  const apiRows = locale === "en"
    ? [
        ["/api/users", "GET", "List"],
        ["/api/users/:id", "GET", "Detail"],
        ["/api/users", "POST", "Create"],
      ]
    : [
        ["/api/users", "GET", "一覧"],
        ["/api/users/:id", "GET", "詳細"],
        ["/api/users", "POST", "作成"],
      ];

  return (
    <Paper>
      <div className="absolute inset-0 px-4 py-4 flex flex-col gap-1.5 font-serif">
        <div className="text-right">
          <div className="text-[3.8px] uppercase tracking-wider" style={{ color: teal }}>Chapter 1</div>
          <div className="text-[8px] font-bold text-gray-900 leading-tight">{chapTitle}</div>
          <div className="ml-auto w-[60%] border-t border-gray-400 mt-1" />
        </div>

        <div className="mt-1">
          <div className="text-[4px] font-bold" style={{ color: teal }}>{tocLabel}</div>
          <div className="flex flex-col gap-[1.5px] mt-0.5 text-[3.5px] text-gray-600">
            {tocItems.map(([item, page], i) => (
              <div key={i} className="flex justify-between"><span>{item}</span><span>{page}</span></div>
            ))}
          </div>
        </div>

        <div className="mt-1">
          <div className="text-[4.5px] font-bold" style={{ color: teal }}>{sec11}</div>
          <div className="mt-1 flex flex-col gap-[2px]">
            <Lines n={3} widths={[100, 92, 78]} />
          </div>
        </div>

        <div className="rounded-[1px] border px-1.5 py-1 text-[3.5px]" style={{ borderColor: `${teal}88`, background: "#f0fdfa" }}>
          <div className="font-bold" style={{ color: teal }}>NOTE</div>
          <Line w={92} h={1} />
        </div>

        <div className="mt-1 w-full border-t border-b border-gray-700 text-[3px]">
          <div className="grid grid-cols-3 px-1 py-[1px] border-b border-gray-300 font-bold">
            <div>{apiHead[0]}</div><div className="text-center">{apiHead[1]}</div><div>{apiHead[2]}</div>
          </div>
          {apiRows.map((r, i) => (
            <div key={i} className="grid grid-cols-3 px-1 py-[1px] text-gray-600">
              <div className="font-mono">{r[0]}</div><div className="text-center">{r[1]}</div><div>{r[2]}</div>
            </div>
          ))}
        </div>

        <div className="mt-auto text-right text-[3px] text-gray-500">- 3 -</div>
      </div>
    </Paper>
  );
}

// ──────────────────────────────────────────
// 11. プレゼンテーション / Presentation
// ──────────────────────────────────────────
export function BeamerPreview({ locale }: { locale: Locale }) {
  const violet = "#6366f1";
  const slidesLabel = t(locale, "5 枚スライド ・ 16:9", "5 slides · 16:9");
  const titles = {
    method: t(locale, "提案手法", "Method"),
    results: t(locale, "実験結果", "Results"),
    conclusion: t(locale, "結論", "Conclusion"),
  };
  const tableHead = locale === "en" ? ["Method", "acc", "time"] : ["手法", "acc", "time"];
  const tableRows = locale === "en"
    ? [["Baseline A", "85", "120"], ["Ours", "91", "42"]]
    : [["従来 A", "85", "120"], ["提案", "91", "42"]];
  const thanks = t(locale, "ご清聴ありがとうございました", "Thank you for listening!");

  return (
    <Paper>
      <div className="absolute inset-0 p-3 flex flex-col gap-1.5 bg-gray-50">
        <div className="text-[4px] font-bold text-gray-700">{slidesLabel}</div>
        <Slide title={titles.method} violet={violet}>
          <Lines n={2} widths={[80, 60]} />
          <div className="mx-auto mt-1 text-[3px] italic text-gray-600">min L(θ) = ...</div>
        </Slide>
        <Slide title={titles.results} violet={violet}>
          <div className="mx-auto w-[70%] border-t border-b border-gray-600 text-[2.5px] mt-1">
            <div className="grid grid-cols-3 px-0.5 border-b border-gray-300"><div>{tableHead[0]}</div><div className="text-right">{tableHead[1]}</div><div className="text-right">{tableHead[2]}</div></div>
            <div className="grid grid-cols-3 px-0.5"><div>{tableRows[0][0]}</div><div className="text-right">{tableRows[0][1]}</div><div className="text-right">{tableRows[0][2]}</div></div>
            <div className="grid grid-cols-3 px-0.5 font-bold"><div>{tableRows[1][0]}</div><div className="text-right">{tableRows[1][1]}</div><div className="text-right">{tableRows[1][2]}</div></div>
          </div>
        </Slide>
        <Slide title={titles.conclusion} violet={violet}>
          <Lines n={3} widths={[80, 70, 55]} />
        </Slide>
        <div className="rounded-[2px] aspect-[16/7] flex items-center justify-center text-white text-[5px] font-bold" style={{ background: violet }}>
          {thanks}
        </div>
      </div>
    </Paper>
  );
}

function Slide({ title, violet, children }: { title: string; violet: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[2px] border border-gray-300 bg-white aspect-[16/7] overflow-hidden flex flex-col">
      <div className="px-1.5 py-[1.5px] text-[3.5px] font-bold text-white" style={{ background: violet }}>
        {title}
      </div>
      <div className="px-2 py-1 flex flex-col gap-[2px] flex-1">{children}</div>
    </div>
  );
}

// ──────────────────────────────────────────
// 12. 手紙 / Formal letter
// ──────────────────────────────────────────
export function LetterPreview({ locale }: { locale: Locale }) {
  if (locale === "en") {
    return (
      <Paper>
        <div className="absolute inset-0 px-5 py-5 flex flex-col gap-1.5 font-serif">
          <div className="text-right text-[4px] text-gray-700">
            Jane Doe<br />
            123 Example Street<br />
            Cambridge, MA 02139<br />
            May 15, 2026
          </div>

          <div className="text-[4px] text-gray-800 leading-tight mt-1">
            Dr. John Smith<br />
            Director of Engineering<br />
            Acme Industries, Inc.
          </div>

          <div className="text-[4px] text-gray-800 mt-1">Dear Dr. Smith,</div>

          <div className="mt-1 flex flex-col gap-[2px]">
            <Lines n={4} widths={[100, 96, 92, 80]} />
          </div>

          <div className="mt-1 flex flex-col gap-[2px]">
            <Lines n={3} widths={[100, 94, 70]} />
          </div>

          <div className="mt-auto text-[4px] text-gray-800 leading-tight">
            Sincerely,<br /><br />
            Jane Doe<br />
            <span className="text-[3.4px] text-gray-600">Department of Computer Science</span><br />
            <span className="text-[3.4px] text-gray-600">Example University</span>
          </div>
        </div>
      </Paper>
    );
  }

  return (
    <Paper>
      <div className="absolute inset-0 px-5 py-5 flex flex-col gap-1.5 font-serif">
        <div className="text-right text-[4px] text-gray-700">令和 6 年 5 月 15 日</div>

        <div className="text-[4px] text-gray-800 leading-tight mt-0.5">
          ○○株式会社<br />
          代表取締役　○○ ○○ 様
        </div>

        <div className="text-center text-[6px] font-bold text-gray-900 mt-1">○○のご案内</div>

        <div className="mt-1 flex flex-col gap-[2px]">
          <div className="text-[4px] text-gray-800">拝啓　時下ますますご清祥のこととお慶び申し上げます。</div>
          <Lines n={3} widths={[100, 96, 80]} />
        </div>

        <div className="text-center text-[5px] font-bold text-gray-900 mt-1">記</div>
        <div className="mx-auto text-[3.5px] text-gray-700 leading-tight">
          <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-[1px]">
            <span>日　時</span><span>令和 6 年 5 月 15 日 14:00</span>
            <span>場　所</span><span>本館 3 階 大会議室</span>
            <span>議　題</span><span>○○プロジェクトの進捗報告</span>
            <span>持　物</span><span>筆記用具・配布資料</span>
          </div>
        </div>

        <div className="mt-auto text-right text-[4px] text-gray-800 leading-tight">
          敬具<br />
          △△株式会社<br />
          総務部　△△ △△
        </div>
      </div>
    </Paper>
  );
}

// ──────────────────────────────────────────
// Dispatcher
// ──────────────────────────────────────────

interface PreviewProps { locale: Locale }
const PREVIEWS: Record<string, React.FC<PreviewProps> | React.FC> = {
  blank: BlankPreview,
  "common-test": CommonTestPreview,
  "kokuko-niji": KokukoNijiPreview,
  "school-test": SchoolTestPreview,
  juku: JukuPreview,
  "kaisetsu-note": KaisetsuNotePreview,
  worksheet: WorksheetPreview,
  "english-worksheet": EnglishWorksheetPreview,
  article: ArticlePreview,
  report: ReportPreview,
  beamer: BeamerPreview,
  letter: LetterPreview,
};

export function TemplatePreview({ id }: { id: string }) {
  const { locale } = useI18n();
  const Comp = PREVIEWS[id] ?? BlankPreview;
  // BlankPreview takes no props; others accept { locale }. Cast to any to bridge.
  const CompAny = Comp as React.FC<{ locale?: Locale }>;
  return <CompAny locale={locale as Locale} />;
}
