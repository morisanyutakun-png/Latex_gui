"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type Locale = "ja" | "en";

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "ja",
  setLocale: () => {},
  t: (k) => k,
});

function detectLocale(): Locale {
  if (typeof window === "undefined") return "ja";
  try {
    const stored = localStorage.getItem("lx-locale");
    if (stored === "en" || stored === "ja") return stored;
  } catch { /* ignore */ }
  const lang = navigator.language || (navigator.languages?.[0] ?? "ja");
  return lang.toLowerCase().startsWith("en") ? "en" : "ja";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ja");

  useEffect(() => {
    setLocaleState(detectLocale());
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    try { localStorage.setItem("lx-locale", l); } catch { /* ignore */ }
  };

  const t = (key: string): string => {
    const dict = locale === "en" ? en : ja;
    return (dict as Record<string, string>)[key] ?? key;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

// ── Japanese ────────────────────────────────────────────────
const ja = {
  // Nav
  "nav.start": "今すぐ始める",
  "nav.resume": "を続ける",
  // Hero
  "hero.badge": "Eddivom — AI教材作成IDE",
  "hero.h1.line1": "教材を、",
  "hero.h1.line2": "もっと速く。",
  "hero.sub": "AIが問題を生成し、類題を量産し、\n解答付きPDFを自動で作成。",
  "hero.cta": "今すぐ始める",
  "hero.scroll": "Scroll",
  // Stats
  "stat.agent": "自律エージェント",
  "stat.packages": "対応パッケージ",
  "stat.math": "数式サポート",
  "stat.batch": "一括量産",
  // Start section
  "start.label": "Start",
  "start.h2": "AIと一緒に、今すぐ作り始めよう",
  "start.desc": "空白のキャンバスからスタート。右パネルの AI エージェントに「数学プリントを作って」と話しかけるだけで、文書が自動で完成します。",
  "start.pill.ai": "AIエージェント搭載",
  "start.pill.db": "教材DB参照",
  "start.pill.math": "LaTeX数式",
  "start.pill.pdf": "PDF出力",
  "start.button": "エディタを開く",
  // Features
  "features.label": "Features",
  "features.h2": "なぜ Eddivom？",
  "features.sub": "教師・塾講師・教材作成者のためのプロ品質ツール",
  "feat.ai.title": "AI エージェント",
  "feat.ai.desc": "「問題を5つ追加して」と話すだけ。Claude が文書を自動生成・編集",
  "feat.db.title": "教材データベース",
  "feat.db.desc": "数学・理科・英語など豊富な問題集から検索してAIに参照させられる",
  "feat.math.title": "数式 & 回路図",
  "feat.math.desc": "amsmath・circuitikz・pgfplotsをGUIだけで操作可能",
  "feat.pdf.title": "即座にPDF出力",
  "feat.pdf.desc": "ブラウザで編集→ワンクリックで高品質PDFをダウンロード",
  "feat.factory.title": "簡単編集",
  "feat.factory.desc": "Wordのように直感的に文字・数式・表を編集。フォント・色・サイズも自由に",
  "feat.advanced.title": "LaTeX拡張",
  "feat.advanced.desc": "プリアンブル・カスタムコマンド・フックを直接制御するLaTeX拡張機能",
  "feat.pkg.title": "自動パッケージ検出",
  "feat.pkg.desc": "コンポーネントに応じて必要なLaTeXパッケージを自動でロード",
  "feat.secure.title": "セキュアな実行環境",
  "feat.secure.desc": "サンドボックス内でLaTeXをコンパイル。パッケージ許可リストで安全性を確保",
  // CTA bottom
  "cta.h2": "さぁ、始めましょう",
  "cta.sub": "AI エージェントと話すだけで、プロ品質の文書が完成します。",
  "cta.button": "エディタを開く",
  // Footer
  "footer.powered": "Powered by LuaLaTeX, TikZ & PGFPlots",
  // Editor header
  "header.untitled": "無題のドキュメント",
  "header.save": "保存 (Ctrl+S)",
  "header.export": "JSONエクスポート",
  "header.import": "JSONインポート",
  "header.undo": "元に戻す (Ctrl+Z)",
  "header.redo": "やり直し (Ctrl+Y)",
  "header.pdf": "PDF",
  "header.generating": "生成中…",
  "header.outline": "ドキュメント構成",
  "header.home": "ホームへ",
  // Editor page panels
  "panel.document": "エディタ",
  "panel.ai": "AI AGENT",
  "panel.advanced": "LaTeX EXTENSIONS",
  "panel.edit": "簡単編集",
  "panel.latex": "LATEX SOURCE",
  "panel.close": "パネルを閉じる",
  "panel.back.editor": "エディタに戻る",
  // Toolbar
  "toolbar.paper": "用紙",
  "toolbar.gothic": "ゴシック",
  "toolbar.mincho": "明朝体",
  "toolbar.hint": "テキストをクリックして書式変更",
  "toolbar.cat.basic": "基本",
  "toolbar.cat.stem": "理工系",
  "toolbar.cat.media": "メディア",
  // Edit toolbar
  "edit.toolbar.title": "簡単編集",
  "edit.toolbar.insert": "挿入",
  "edit.toolbar.format": "書式",
  "edit.toolbar.collapse": "ツールバーを折りたたむ",
  "edit.toolbar.expand": "ツールバーを展開する",
  // Mobile tabs
  "mobile.tab.ai": "AIエージェント",
  "mobile.tab.preview": "プレビュー",
  // Status bar
  "status.blocks": "blocks",
  // Document editor empty state
  "editor.empty.comment": "// 空のドキュメント",
  "editor.empty.h2": "何を作りますか？",
  "editor.editmode.hint": "クリックして入力を始める…",
  "editor.editmode.click_to_add": "+ クリックして段落を追加",
  // Block actions
  "block.move.up": "上へ",
  "block.move.down": "下へ",
  "block.duplicate": "複製",
  "block.delete": "削除",
  // Command palette & context menu
  "cmd.palette.hint": "要素を挿入 (↑↓ 移動, Enter で確定)",
  "cmd.palette.search": "要素タイプを検索…",
  "ctx.move.up": "上へ移動",
  "ctx.move.down": "下へ移動",
  "ctx.duplicate": "複製",
  "ctx.delete": "削除",
  "ctx.change.type": "種類を変更",
  // Block editor placeholders
  "block.ph.paragraph": "テキストを入力… ( Tab: 数式モード )",
  "block.ph.caption": "キャプション（任意）",
  "block.ph.image.url": "画像URL",
  "block.ph.code.lang": "言語",
  "block.ph.code.body": "コードを入力...",
  "block.ph.quote": "引用テキスト...",
  "block.ph.quote.src": "— 出典",
  "block.ph.table.caption": "表のキャプション",
  // AI Chat panel
  "chat.title": "AI エージェント",
  "chat.subtitle": "LaTeX ドキュメント制作アシスタント",
  "chat.auto": "自動",
  "chat.confirm": "確認",
  "chat.clear": "クリア",
  "chat.materials": "教材DB",
  "chat.empty.title": "何でも聞いてください",
  "chat.empty.sub": "ドキュメントの作成・編集をAIが手伝います",
  "chat.suggestion.1": "数学プリントを作って",
  "chat.suggestion.2": "二次方程式の問題を5つ追加",
  "chat.suggestion.3": "模試形式の問題集にして",
  "chat.suggestion.4": "表を見やすく整えて",
  "chat.placeholder": "メッセージを入力…",
  "chat.hint": "Enter で送信 · Shift+Enter で改行",
  "chat.agent.mode": "自動適用モード — 変更は即時反映",
  "chat.apply": "適用する",
  "chat.cancel": "キャンセル",
  "chat.applied": "ドキュメントに適用済み",
  "chat.retry": "もう一度",
  "chat.changes": "件の変更を確認・適用",
  "chat.changes.title": "件の変更案",
  "chat.see.all": "すべて見る",
  "chat.collapse": "折りたたむ",
  // Toast
  "toast.saved": "保存しました",
  "toast.exported": "JSONエクスポート完了",
  "toast.imported": "読み込みました",
  "toast.import.fail": "読み込み失敗",
  "toast.pdf.done": "PDF生成完了",
  "toast.pdf.retry": "数秒待ってから再試行してください",
} as const;

// ── English ──────────────────────────────────────────────────
const en = {
  // Nav
  "nav.start": "Get started",
  "nav.resume": "Resume",
  // Hero
  "hero.badge": "Eddivom — AI-powered worksheet IDE",
  "hero.h1.line1": "Worksheets,",
  "hero.h1.line2": "faster.",
  "hero.sub": "AI generates problems, multiplies variants,\nand auto-creates answer-key PDFs.",
  "hero.cta": "Get started",
  "hero.scroll": "Scroll",
  // Stats
  "stat.agent": "Autonomous Agent",
  "stat.packages": "LaTeX Packages",
  "stat.math": "Math Support",
  "stat.batch": "Batch Production",
  // Start section
  "start.label": "Start",
  "start.h2": "Build with AI, right now",
  "start.desc": "Start from a blank canvas. Just tell the AI agent in the right panel — \"Create a math worksheet\" — and your document builds itself.",
  "start.pill.ai": "AI Agent",
  "start.pill.db": "Materials DB",
  "start.pill.math": "LaTeX Math",
  "start.pill.pdf": "PDF Export",
  "start.button": "Open editor",
  // Features
  "features.label": "Features",
  "features.h2": "Why Eddivom?",
  "features.sub": "A professional tool for teachers, tutors, and content creators",
  "feat.ai.title": "AI Agent",
  "feat.ai.desc": "Just say \"Add 5 problems.\" Claude automatically generates and edits your document.",
  "feat.db.title": "Materials Database",
  "feat.db.desc": "Search a rich library of math, science, and English problems for the AI to reference.",
  "feat.math.title": "Math & Circuits",
  "feat.math.desc": "amsmath, circuitikz, pgfplots — all accessible through a clean GUI.",
  "feat.pdf.title": "Instant PDF Export",
  "feat.pdf.desc": "Edit in the browser, download a high-quality PDF in one click.",
  "feat.factory.title": "Easy Edit",
  "feat.factory.desc": "Edit text, math, and tables just like Word. Choose fonts, colors, and sizes freely.",
  "feat.advanced.title": "LaTeX Extensions",
  "feat.advanced.desc": "Directly control the LaTeX preamble, custom commands, and document hooks.",
  "feat.pkg.title": "Auto Package Detection",
  "feat.pkg.desc": "Required LaTeX packages are automatically loaded based on the blocks you use.",
  "feat.secure.title": "Secure Sandbox",
  "feat.secure.desc": "LaTeX compiles in an isolated sandbox with a strict package allowlist for safety.",
  // CTA bottom
  "cta.h2": "Ready to start?",
  "cta.sub": "Just talk to the AI agent — your professional document writes itself.",
  "cta.button": "Open editor",
  // Footer
  "footer.powered": "Powered by LuaLaTeX, TikZ & PGFPlots",
  // Editor header
  "header.untitled": "Untitled document",
  "header.save": "Save (Ctrl+S)",
  "header.export": "Export JSON",
  "header.import": "Import JSON",
  "header.undo": "Undo (Ctrl+Z)",
  "header.redo": "Redo (Ctrl+Y)",
  "header.pdf": "PDF",
  "header.generating": "Generating…",
  "header.outline": "Document outline",
  "header.home": "Home",
  // Editor page panels
  "panel.document": "Editor",
  "panel.ai": "AI AGENT",
  "panel.advanced": "LaTeX EXTENSIONS",
  "panel.edit": "Easy Edit",
  "panel.latex": "LATEX SOURCE",
  "panel.close": "Close panel",
  "panel.back.editor": "Back to editor",
  // Toolbar
  "toolbar.paper": "Paper",
  "toolbar.gothic": "Sans-serif",
  "toolbar.mincho": "Serif",
  "toolbar.hint": "Click text to format",
  "toolbar.cat.basic": "Basic",
  "toolbar.cat.stem": "STEM",
  "toolbar.cat.media": "Media",
  // Edit toolbar
  "edit.toolbar.title": "Easy Edit",
  "edit.toolbar.insert": "Insert",
  "edit.toolbar.format": "Format",
  "edit.toolbar.collapse": "Collapse toolbar",
  "edit.toolbar.expand": "Expand toolbar",
  // Mobile tabs
  "mobile.tab.ai": "AI Agent",
  "mobile.tab.preview": "Preview",
  // Status bar
  "status.blocks": "blocks",
  // Document editor empty state
  "editor.empty.comment": "// empty document",
  "editor.empty.h2": "What would you like to create?",
  "editor.editmode.hint": "Click to start typing…",
  "editor.editmode.click_to_add": "+ Click to add paragraph",
  // Block actions
  "block.move.up": "Move up",
  "block.move.down": "Move down",
  "block.duplicate": "Duplicate",
  "block.delete": "Delete",
  // Command palette & context menu
  "cmd.palette.hint": "Insert element (↑↓ to navigate, Enter to insert)",
  "cmd.palette.search": "Search element types…",
  "ctx.move.up": "Move up",
  "ctx.move.down": "Move down",
  "ctx.duplicate": "Duplicate",
  "ctx.delete": "Delete",
  "ctx.change.type": "Change type",
  // Block editor placeholders
  "block.ph.paragraph": "Type something… ( Tab: math mode )",
  "block.ph.caption": "Caption (optional)",
  "block.ph.image.url": "Image URL",
  "block.ph.code.lang": "Language",
  "block.ph.code.body": "Enter code...",
  "block.ph.quote": "Quote text...",
  "block.ph.quote.src": "— Source",
  "block.ph.table.caption": "Table caption",
  // AI Chat panel
  "chat.title": "AI Agent",
  "chat.subtitle": "LaTeX document creation assistant",
  "chat.auto": "Auto",
  "chat.confirm": "Confirm",
  "chat.clear": "Clear",
  "chat.materials": "Materials DB",
  "chat.empty.title": "Ask me anything",
  "chat.empty.sub": "AI helps you create and edit documents",
  "chat.suggestion.1": "Create a math worksheet",
  "chat.suggestion.2": "Add 5 quadratic equations",
  "chat.suggestion.3": "Format as a mock exam",
  "chat.suggestion.4": "Clean up the table layout",
  "chat.placeholder": "Message…",
  "chat.hint": "Enter to send · Shift+Enter for newline",
  "chat.agent.mode": "Auto-apply mode — changes apply instantly",
  "chat.apply": "Apply",
  "chat.cancel": "Cancel",
  "chat.applied": "Applied to document",
  "chat.retry": "Retry",
  "chat.changes": "changes to review",
  "chat.changes.title": "proposed changes",
  "chat.see.all": "See all",
  "chat.collapse": "Collapse",
  // Toast
  "toast.saved": "Saved",
  "toast.exported": "JSON exported",
  "toast.imported": "Loaded successfully",
  "toast.import.fail": "Import failed",
  "toast.pdf.done": "PDF ready",
  "toast.pdf.retry": "Please wait a few seconds and try again",
} as const;
