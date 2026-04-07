"use client";

/**
 * template-previews.tsx
 *
 * 各テンプレートの「成果物」を視覚的に表すミニチュア・プレビュー。
 * 文字説明ではなく、実際の PDF の構成 (タイトル帯/問題ボックス/罫線/表など)
 * を A4 縦比 (1:√2) の白紙に縮小して描く。
 *
 * テキストはダミー (灰色の細罫線) で表現し、テンプレ固有の色を必ず使う。
 * 一目で「この成果物が出る」と分かることを目的とする。
 */

import React from "react";

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
// 2. 共通テスト風 — 紺基調 / 大問ボックス
// ──────────────────────────────────────────
export function CommonTestPreview() {
  const navy = "#1e3a8a";
  return (
    <Paper>
      <div className="absolute inset-0 px-3 py-3 flex flex-col gap-1.5 font-serif">
        {/* タイトル */}
        <div className="flex flex-col items-center gap-0.5">
          <div className="text-[7px] font-bold" style={{ color: navy }}>数学 I・A</div>
          <div className="text-[5.5px] font-semibold text-gray-800">第 1 回 共通テスト型 模擬試験</div>
          <div className="mt-0.5 px-1.5 py-[1.5px] border border-blue-900/40 rounded-[1px] text-[3.8px] text-gray-700">
            70 分 ・ 100 点 ・ 大問 5
          </div>
        </div>

        {/* 注意 */}
        <div className="flex flex-col gap-[1.5px]">
          <div className="text-[3.5px] font-bold" style={{ color: navy }}>注意事項</div>
          <Line w={92} h={1.2} />
          <Line w={86} h={1.2} />
        </div>

        {/* 大問ボックス x 3 */}
        {[
          "第 1 問　数と式・集合 (20)",
          "第 2 問　二次関数 (25)",
          "第 3 問　図形と計量 (25)",
        ].map((title, i) => (
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

        {/* ページ番号 */}
        <div className="mt-auto text-right text-[3px] text-gray-500">第 1 ページ</div>
      </div>
    </Paper>
  );
}

// ──────────────────────────────────────────
// 3. 国公立二次風 — モノクロ / 罫線見出し
// ──────────────────────────────────────────
export function KokukoNijiPreview() {
  return (
    <Paper>
      <div className="absolute inset-0 px-4 py-4 flex flex-col gap-2 font-serif">
        {/* 表紙 */}
        <div className="flex flex-col items-center">
          <div className="text-[7px] font-bold text-black">○○大学 入学試験問題</div>
          <div className="text-[5px] text-gray-700 mt-0.5">数学 (理系)</div>
          <div className="mt-1 w-3/4 border-t border-b border-gray-800 py-[3px]">
            <div className="text-center text-[3.8px] text-gray-700">試験時間 150 分　配点 200 点</div>
          </div>
        </div>

        <div className="text-[3.6px] text-gray-700 leading-tight">
          注意 ・ 解答は所定の解答用紙に / 結果のみでなく導出過程も
        </div>

        {/* 大問: 罫線見出し */}
        {["1", "2", "3"].map((num) => (
          <div key={num} className="mt-1">
            <div className="flex items-center gap-1.5">
              <div className="px-1 py-[1px] border border-gray-800 text-[4px] font-bold leading-none">
                第 {num} 問
              </div>
            </div>
            <div className="border-t border-gray-700 mt-[2px] mb-1" />
            <Lines n={4} widths={[100, 96, 88, 70]} gap={3} />
          </div>
        ))}

        {/* ページ */}
        <div className="mt-auto text-center text-[3px] text-gray-500">- 1 -</div>
      </div>
    </Paper>
  );
}

// ──────────────────────────────────────────
// 4. 学校テスト — 氏名/得点欄付き
// ──────────────────────────────────────────
export function SchoolTestPreview() {
  const accent = "#dc2626";
  return (
    <Paper>
      <div className="absolute inset-0 px-3 py-3 flex flex-col gap-1.5 font-sans">
        {/* タイトル */}
        <div className="text-center text-[7.5px] font-bold text-gray-900">数学 II 第 2 回 定期考査</div>

        {/* 氏名表 + 得点 */}
        <div className="flex items-stretch gap-1 mt-1">
          <div className="flex-1 grid grid-cols-6 border border-gray-700 text-[3.5px]">
            <div className="border-r border-gray-700 px-0.5 py-0.5 text-center bg-gray-50">年</div>
            <div className="border-r border-gray-700 px-0.5 py-0.5"></div>
            <div className="border-r border-gray-700 px-0.5 py-0.5 text-center bg-gray-50">組</div>
            <div className="border-r border-gray-700 px-0.5 py-0.5"></div>
            <div className="border-r border-gray-700 px-0.5 py-0.5 text-center bg-gray-50">番</div>
            <div></div>
            <div className="col-span-1 border-t border-r border-gray-700 px-0.5 py-0.5 text-center bg-gray-50">氏名</div>
            <div className="col-span-5 border-t border-gray-700"></div>
          </div>
          <div className="w-[26%] border border-gray-800 flex flex-col items-center justify-center">
            <div className="text-[3.5px] font-bold text-gray-700">得点</div>
            <div className="text-[6px] font-bold mt-0.5" style={{ color: accent }}>/ 100</div>
          </div>
        </div>

        {/* 大問: 左罫線アクセント */}
        {[
          ["第 1 問", "計算 (各 5 点)"],
          ["第 2 問", "方程式・不等式 (各 8 点)"],
          ["第 3 問", "二次関数 (各 10 点)"],
        ].map(([num, sub], i) => (
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
// 5. 塾プリント — オレンジ帯 + 難度バッジ + box
// ──────────────────────────────────────────
export function JukuPreview() {
  const orange = "#ea580c";
  const navy = "#0c4a6e";
  return (
    <Paper>
      <div className="absolute inset-0 px-3 py-3 flex flex-col gap-1.5">
        {/* タイトル帯 */}
        <div
          className="rounded-sm px-2 py-1 flex items-center justify-between text-white"
          style={{ background: orange }}
        >
          <div className="text-[6px] font-bold">二次関数 完全マスター</div>
          <div className="text-[3.5px] font-semibold opacity-90">Lesson 03</div>
        </div>

        {/* 難度バッジ */}
        <div className="flex items-center gap-1">
          {["★☆☆", "★★☆", "★★★"].map((s, i) => (
            <div
              key={i}
              className="text-[3.5px] font-bold px-1 py-[0.5px] border rounded-[1px]"
              style={{ borderColor: orange, color: orange }}
            >
              難度 {s}
            </div>
          ))}
        </div>

        {/* 基本ボックス */}
        <div className="rounded-[1px] border-l-[3px] border" style={{ borderLeftColor: orange, borderColor: `${orange}88`, background: "#fff7ed" }}>
          <div className="px-1.5 py-[2px] text-[4px] font-bold text-orange-900">基本問題　★☆☆ ウォームアップ</div>
          <div className="px-2 pb-1 flex flex-col gap-[2px]">
            <Lines n={3} widths={[90, 80, 70]} />
          </div>
        </div>

        {/* 標準ボックス */}
        <div className="rounded-[1px] border-l-[3px] border" style={{ borderLeftColor: orange, borderColor: `${orange}88`, background: "#fff7ed" }}>
          <div className="px-1.5 py-[2px] text-[4px] font-bold text-orange-900">標準問題　★★☆ 解の配置</div>
          <div className="px-2 pb-1 flex flex-col gap-[2px]">
            <Lines n={2} widths={[88, 78]} />
          </div>
        </div>

        {/* 応用 (紺) */}
        <div className="rounded-[1px] border-l-[3px] border" style={{ borderLeftColor: navy, borderColor: `${navy}88`, background: "white" }}>
          <div className="px-1.5 py-[2px] text-[4px] font-bold" style={{ color: navy }}>応用問題　★★★ 文字を含む最大最小</div>
          <div className="px-2 pb-1 flex flex-col gap-[2px]">
            <Lines n={2} widths={[92, 70]} />
          </div>
        </div>

        {/* Today's point */}
        <div className="mt-auto text-[3px] text-orange-900/80">
          <div className="font-bold">Today&apos;s Point</div>
          <div>・ 軸と定義域の位置で場合分け / ・ 解の配置は D + 軸 + 端</div>
        </div>
      </div>
    </Paper>
  );
}

// ──────────────────────────────────────────
// 6. 解説ノート — 定義/例題/定理の色付きボックス
// ──────────────────────────────────────────
export function KaisetsuNotePreview() {
  const teal = "#0d9488";
  const sky = "#0284c7";
  return (
    <Paper>
      <div className="absolute inset-0 px-3 py-3 flex flex-col gap-1.5">
        {/* 章タイトル */}
        <div className="text-center">
          <div className="text-[7px] font-bold" style={{ color: teal }}>第 3 章　微分の応用</div>
          <div className="text-[3.5px] italic text-gray-500 mt-0.5">Differentiation and its Applications</div>
        </div>

        {/* セクション */}
        <div className="flex items-baseline gap-1 mt-0.5">
          <div className="text-[5px]" style={{ color: teal }}>▸</div>
          <div className="text-[5px] font-bold" style={{ color: teal }}>1. 接線の方程式</div>
        </div>

        {/* 定義ボックス */}
        <div className="rounded-[2px] border" style={{ borderColor: teal, background: "#ecfeff" }}>
          <div
            className="inline-block ml-1.5 -mt-[3px] px-1 py-[1px] text-[3.5px] font-bold text-white rounded-[1px]"
            style={{ background: teal }}
          >
            定義
          </div>
          <div className="px-2 pb-1 -mt-[2px] flex flex-col gap-[2px]">
            <Lines n={3} widths={[96, 90, 70]} />
          </div>
        </div>

        {/* 例題ボックス */}
        <div className="rounded-[1px] border" style={{ borderColor: `${teal}88`, background: "#f0fdfa" }}>
          <div className="px-1.5 py-[2px] text-[3.8px] font-bold" style={{ color: teal }}>例題</div>
          <div className="px-2 pb-1 flex flex-col gap-[2px]">
            <Lines n={3} widths={[92, 88, 76]} />
          </div>
        </div>

        {/* 注意 */}
        <div className="text-[3.5px]">
          <span className="text-rose-600 font-bold">! 注意</span>
          <span className="text-gray-600">　微分可能でない点では接線は考えない</span>
        </div>

        {/* セクション 2 */}
        <div className="flex items-baseline gap-1 mt-0.5">
          <div className="text-[5px]" style={{ color: teal }}>▸</div>
          <div className="text-[5px] font-bold" style={{ color: teal }}>2. 平均値の定理</div>
        </div>

        {/* 定理ボックス */}
        <div className="rounded-[2px] border" style={{ borderColor: sky, background: "white" }}>
          <div
            className="inline-block ml-1.5 -mt-[3px] px-1 py-[1px] text-[3.5px] font-bold text-white rounded-[1px]"
            style={{ background: sky }}
          >
            定理
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
// 7. 演習プリント — 単元バナー + レベル別
// ──────────────────────────────────────────
export function WorksheetPreview() {
  const teal = "#0d9488";
  return (
    <Paper>
      <div className="absolute inset-0 px-3 py-3 flex flex-col gap-1.5">
        {/* タイトル */}
        <div className="text-center text-[6.5px] font-bold text-gray-900">三角比　演習プリント</div>

        {/* 氏名行 */}
        <div className="text-[3.4px] text-gray-600 flex gap-1 items-center">
          <span>学年・組</span>
          <div className="flex-1 border-b border-gray-400" />
          <span>番号</span>
          <div className="w-[12%] border-b border-gray-400" />
          <span>氏名</span>
          <div className="flex-[1.5] border-b border-gray-400" />
        </div>

        {/* 単元バナー */}
        <div
          className="rounded-[1px] px-2 py-1 text-[4px] font-bold text-white mt-1"
          style={{ background: teal }}
        >
          単元　三角比の定義 / 正弦定理 / 余弦定理
        </div>

        {/* レベル: 基本 */}
        <div>
          <div
            className="inline-block px-1.5 py-[1px] text-[3.8px] font-bold rounded-[1px] border"
            style={{ borderColor: `${teal}88`, color: teal, background: "#ecfeff" }}
          >
            【基本】 角の値が分かっているケース
          </div>
          <div className="pl-2 mt-1 flex flex-col gap-[2px]">
            <Lines n={2} widths={[88, 70]} />
          </div>
        </div>

        {/* レベル: 標準 */}
        <div>
          <div
            className="inline-block px-1.5 py-[1px] text-[3.8px] font-bold rounded-[1px] border"
            style={{ borderColor: `${teal}88`, color: teal, background: "#ecfeff" }}
          >
            【標準】 正弦定理・余弦定理
          </div>
          <div className="pl-2 mt-1 flex flex-col gap-[2px]">
            <Lines n={3} widths={[92, 86, 78]} />
          </div>
        </div>

        {/* レベル: 発展 */}
        <div>
          <div
            className="inline-block px-1.5 py-[1px] text-[3.8px] font-bold rounded-[1px] border"
            style={{ borderColor: `${teal}88`, color: teal, background: "#ecfeff" }}
          >
            【発展】 場合分け・図形応用
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
// 8. 英語ワークシート — 単語表 + 本文 + 設問
// ──────────────────────────────────────────
export function EnglishWorksheetPreview() {
  const moss = "#16a34a";
  const cream = "#f0fdf4";
  const accent = "#ca8a04";
  return (
    <Paper>
      <div className="absolute inset-0 px-3 py-3 flex flex-col gap-1.5">
        {/* タイトル */}
        <div className="text-center">
          <div className="text-[7px] font-bold" style={{ color: "#14532d" }}>Unit 5: The Power of Curiosity</div>
          <div className="text-[3.5px] italic text-gray-600 mt-0.5">Reading · Vocabulary · Comprehension</div>
        </div>

        {/* Vocabulary */}
        <div className="text-[4px] font-bold" style={{ color: moss }}>Part 1　Vocabulary</div>
        <div className="rounded-[1px] border px-1.5 py-1 grid grid-cols-2 gap-x-2 gap-y-[1px]" style={{ borderColor: `${accent}88` }}>
          {["curiosity / 好奇心", "discover / 発見", "remarkable / 注目", "phenomenon / 現象"].map((s, i) => (
            <div key={i} className="text-[3.5px] text-gray-700">{s}</div>
          ))}
        </div>

        {/* Reading */}
        <div className="text-[4px] font-bold" style={{ color: moss }}>Part 2　Reading</div>
        <div className="rounded-[2px] border px-2 py-1 flex flex-col gap-[2px]" style={{ borderColor: `${moss}88`, background: cream }}>
          <Lines n={5} widths={[100, 96, 92, 88, 78]} />
        </div>

        {/* Comprehension */}
        <div className="text-[4px] font-bold" style={{ color: moss }}>Part 3　Comprehension</div>
        <div className="pl-2 flex flex-col gap-[2px]">
          <Lines n={3} widths={[88, 80, 72]} />
        </div>

        {/* Writing answer lines */}
        <div className="text-[4px] font-bold mt-0.5" style={{ color: moss }}>Part 4　Writing</div>
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
// 9. レポート・論文 — abstract + sections + bib
// ──────────────────────────────────────────
export function ArticlePreview() {
  const navy = "#1e40af";
  return (
    <Paper>
      <div className="absolute inset-0 px-4 py-4 flex flex-col gap-1.5 font-serif">
        {/* タイトル */}
        <div className="text-center">
          <div className="text-[6px] font-bold text-gray-900 leading-tight">
            機械学習による教材生成の<br />高速化に関する一考察
          </div>
          <div className="text-[3.5px] text-gray-600 mt-0.5">著者名† ・ 所属機関</div>
        </div>

        {/* abstract */}
        <div className="mx-2 mt-1 px-1.5 py-1 border-l-2 border-r-2 border-gray-200">
          <div className="text-[3.5px] font-bold text-center" style={{ color: navy }}>Abstract</div>
          <div className="mt-0.5 flex flex-col gap-[1.5px]">
            <Line w={100} h={1} />
            <Line w={94} h={1} />
            <Line w={88} h={1} />
          </div>
        </div>

        {/* 二段組っぽい本文 */}
        <div className="mt-1 grid grid-cols-2 gap-2">
          {[1, 2].map((c) => (
            <div key={c} className="flex flex-col gap-1">
              <div className="text-[4px] font-bold" style={{ color: navy }}>
                {c}　{c === 1 ? "はじめに" : "関連研究"}
              </div>
              <Lines n={4} widths={[100, 96, 92, 70]} gap={2} />
            </div>
          ))}
        </div>

        <div className="text-[4px] font-bold" style={{ color: navy }}>3　提案手法</div>
        <Lines n={2} widths={[100, 92]} />
        <div className="mx-auto text-[3.5px] italic text-gray-600">L = L_valid + λ · L_style</div>

        <div className="text-[4px] font-bold" style={{ color: navy }}>4　実験結果</div>
        {/* mini table */}
        <div className="mx-auto w-[80%] border-t border-b border-gray-700 text-[3px]">
          <div className="grid grid-cols-3 px-1 py-0.5 border-b border-gray-300">
            <div>手法</div><div className="text-right">時間</div><div className="text-right">評価</div>
          </div>
          <div className="grid grid-cols-3 px-1 py-0.5 text-gray-600">
            <div>手作業</div><div className="text-right">42.5</div><div className="text-right">3.8</div>
          </div>
          <div className="grid grid-cols-3 px-1 py-0.5 font-bold">
            <div>提案</div><div className="text-right">11.6</div><div className="text-right">4.4</div>
          </div>
        </div>

        <div className="mt-auto text-[3px] text-gray-500">[1] Vaswani et al. 2017　[2] Brown et al. 2020</div>
      </div>
    </Paper>
  );
}

// ──────────────────────────────────────────
// 10. 技術報告書 — 章タイトル + 目次 + 表
// ──────────────────────────────────────────
export function ReportPreview() {
  const teal = "#0f766e";
  return (
    <Paper>
      <div className="absolute inset-0 px-4 py-4 flex flex-col gap-1.5 font-serif">
        {/* Chapter heading */}
        <div className="text-right">
          <div className="text-[3.8px] uppercase tracking-wider" style={{ color: teal }}>Chapter 1</div>
          <div className="text-[8px] font-bold text-gray-900 leading-tight">システム概要</div>
          <div className="ml-auto w-[60%] border-t border-gray-400 mt-1" />
        </div>

        {/* TOC */}
        <div className="mt-1">
          <div className="text-[4px] font-bold" style={{ color: teal }}>目次</div>
          <div className="flex flex-col gap-[1.5px] mt-0.5 text-[3.5px] text-gray-600">
            <div className="flex justify-between"><span>1.1 背景</span><span>3</span></div>
            <div className="flex justify-between"><span>1.2 用語定義</span><span>5</span></div>
            <div className="flex justify-between"><span>2.1 全体構成</span><span>7</span></div>
            <div className="flex justify-between"><span>2.2 API 仕様</span><span>9</span></div>
            <div className="flex justify-between"><span>3.1 数理モデル</span><span>12</span></div>
          </div>
        </div>

        {/* 1.1 背景 */}
        <div className="mt-1">
          <div className="text-[4.5px] font-bold" style={{ color: teal }}>1.1　背景</div>
          <div className="mt-1 flex flex-col gap-[2px]">
            <Lines n={3} widths={[100, 92, 78]} />
          </div>
        </div>

        {/* note box */}
        <div className="rounded-[1px] border px-1.5 py-1 text-[3.5px]" style={{ borderColor: `${teal}88`, background: "#f0fdfa" }}>
          <div className="font-bold" style={{ color: teal }}>NOTE</div>
          <Line w={92} h={1} />
        </div>

        {/* mini API table */}
        <div className="mt-1 w-full border-t border-b border-gray-700 text-[3px]">
          <div className="grid grid-cols-3 px-1 py-[1px] border-b border-gray-300 font-bold">
            <div>endpoint</div><div className="text-center">method</div><div>説明</div>
          </div>
          {[
            ["/api/users", "GET", "一覧"],
            ["/api/users/:id", "GET", "詳細"],
            ["/api/users", "POST", "作成"],
          ].map((r, i) => (
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
// 11. プレゼンテーション — 16:9 mini slides
// ──────────────────────────────────────────
export function BeamerPreview() {
  const violet = "#6366f1";
  return (
    <Paper>
      <div className="absolute inset-0 p-3 flex flex-col gap-1.5 bg-gray-50">
        <div className="text-[4px] font-bold text-gray-700">5 枚スライド ・ 16:9</div>
        {/* slide thumbnails */}
        <Slide title="提案手法" violet={violet}>
          <Lines n={2} widths={[80, 60]} />
          <div className="mx-auto mt-1 text-[3px] italic text-gray-600">min L(θ) = ...</div>
        </Slide>
        <Slide title="実験結果" violet={violet}>
          <div className="mx-auto w-[70%] border-t border-b border-gray-600 text-[2.5px] mt-1">
            <div className="grid grid-cols-3 px-0.5 border-b border-gray-300"><div>手法</div><div className="text-right">acc</div><div className="text-right">time</div></div>
            <div className="grid grid-cols-3 px-0.5"><div>従来 A</div><div className="text-right">85</div><div className="text-right">120</div></div>
            <div className="grid grid-cols-3 px-0.5 font-bold"><div>提案</div><div className="text-right">91</div><div className="text-right">42</div></div>
          </div>
        </Slide>
        <Slide title="結論" violet={violet}>
          <Lines n={3} widths={[80, 70, 55]} />
        </Slide>
        {/* standout */}
        <div className="rounded-[2px] aspect-[16/7] flex items-center justify-center text-white text-[5px] font-bold" style={{ background: violet }}>
          ご清聴ありがとうございました
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
// 12. 手紙 — 案内状の体裁
// ──────────────────────────────────────────
export function LetterPreview() {
  return (
    <Paper>
      <div className="absolute inset-0 px-5 py-5 flex flex-col gap-1.5 font-serif">
        {/* date */}
        <div className="text-right text-[4px] text-gray-700">令和 6 年 5 月 15 日</div>

        {/* recipient */}
        <div className="text-[4px] text-gray-800 leading-tight mt-0.5">
          ○○株式会社<br />
          代表取締役　○○ ○○ 様
        </div>

        {/* title */}
        <div className="text-center text-[6px] font-bold text-gray-900 mt-1">○○のご案内</div>

        {/* body */}
        <div className="mt-1 flex flex-col gap-[2px]">
          <div className="text-[4px] text-gray-800">拝啓　時下ますますご清祥のこととお慶び申し上げます。</div>
          <Lines n={3} widths={[100, 96, 80]} />
        </div>

        {/* 記 */}
        <div className="text-center text-[5px] font-bold text-gray-900 mt-1">記</div>
        <div className="mx-auto text-[3.5px] text-gray-700 leading-tight">
          <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-[1px]">
            <span>日　時</span><span>令和 6 年 5 月 15 日 14:00</span>
            <span>場　所</span><span>本館 3 階 大会議室</span>
            <span>議　題</span><span>○○プロジェクトの進捗報告</span>
            <span>持　物</span><span>筆記用具・配布資料</span>
          </div>
        </div>

        {/* closing */}
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

const PREVIEWS: Record<string, React.FC> = {
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
  const Comp = PREVIEWS[id] ?? BlankPreview;
  return <Comp />;
}
