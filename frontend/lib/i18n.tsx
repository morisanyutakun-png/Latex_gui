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
  "chat.title": "EddivomAI",
  "chat.subtitle": "LaTeX ドキュメント制作アシスタント",
  "chat.auto": "自動",
  "chat.confirm": "確認",
  "chat.clear": "クリア",
  "chat.empty.title": "Eddivom AI",
  "chat.empty.sub": "文書の作成・編集・修正をお手伝いします",
  "chat.suggestion.1": "数学プリントを作って",
  "chat.suggestion.2": "二次方程式の問題を5つ追加",
  "chat.suggestion.3": "表を見やすく整えて",
  "chat.suggestion.4": "数式のエラーを修正して",
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
  "toast.pdf.fail": "PDF生成失敗",
  "toast.scoring.fail": "採点に失敗しました",

  // Header (extended)
  "header.title.placeholder": "無題の教材",
  "header.save.short": "保存",
  "header.export.json.short": "JSON書き出し",
  "header.scan.label": "読み取り",
  "header.scan.tooltip": "画像やPDFをAIが読み取り、自動でドキュメントに変換します",
  "header.pdf.export": "PDF出力",
  "header.pdf.generating": "生成中…",
  "header.ai.thinking": "AIが考え中…",
  "header.pdf.dialog.title": "PDFを保存",
  "header.pdf.dialog.filename": "ファイル名",
  "header.pdf.dialog.cancel": "キャンセル",
  "header.pdf.dialog.save": "保存",
  "header.pdf.error.unknown": "不明なエラー",
  "header.theme.toggle": "テーマ切替",

  // Edit toolbar (extended)
  "edit.toolbar.mode_badge": "テンプレ駆動 LaTeX",
  "edit.toolbar.template.label": "テンプレ",
  "edit.toolbar.template.confirm_overwrite": "現在のLaTeXソースを上書きしますか?",
  "edit.toolbar.scan.tooltip": "画像・PDFを読み取り (OMR)",
  "edit.toolbar.pdf.tooltip": "PDFをダウンロード",
  "edit.toolbar.pdf.error": "PDF生成に失敗しました",
  "edit.toolbar.toggle.source": "LaTeXソースを表示/非表示",
  "edit.toolbar.toggle.pdf": "PDFプレビューを表示/非表示",

  // Status bar (extended)
  "status.chars": "文字",
  "status.lines": "行",

  // Document editor
  "doc.editor.source.label": "LaTeX ソース",
  "doc.editor.preview.label": "プレビュー",
  "doc.editor.compiling": "コンパイル中…",
  "doc.editor.recompile": "再コンパイル",
  "doc.editor.retry": "再試行",
  "doc.editor.no_document": "ドキュメントが読み込まれていません",
  "doc.editor.pdf.generating": "PDFを生成中…",
  "doc.editor.empty_preview": "LaTeXを入力するとプレビューが表示されます",
  "doc.editor.compile_error": "コンパイルエラー",
  "doc.editor.visual.label": "ビジュアル編集",
  "doc.editor.visual.preamble": "プリアンブル (ソースで編集)",
  "doc.editor.visual.raw_hint": "この要素はビジュアル編集できません",
  "doc.editor.visual.edit_in_source": "ソースで編集",
  "doc.editor.visual.empty": "ドキュメントが空です。テンプレートを選択するか、AIで作成してください。",
  "doc.editor.math.popover.title": "数式を編集",
  "doc.editor.math.popover.current": "現在の数式",
  "doc.editor.math.popover.hint": "新しい入力で上書きされます。空のまま閉じれば変更されません。",
  "doc.editor.math.popover.cancel": "キャンセル",

  // Editor sidebar / page
  "side.scoring.label": "採点",
  "side.tooltip.ai": "AIアシスタント",
  "side.tooltip.scoring": "採点",
  "side.tooltip.lang.toEn": "英語に切り替え",
  "side.tooltip.lang.toJa": "日本語に切り替え",

  // OMR
  "omr.title": "読み取りモード",
  "omr.rescan": "再スキャン",
  "omr.approve": "承認して編集画面へ",
  "omr.source": "入力ファイル",
  "omr.extracted": "抽出LaTeX",
  "omr.no_file": "ファイルなし",
  "omr.results.placeholder": "解析結果がここに表示されます",
  "omr.analyzing": "ファイルを解析中...",
  "omr.no_latex": "LaTeXを抽出できませんでした",
  "omr.read_failed": "ファイルの読み込みに失敗しました",
  "omr.applied": "LaTeXソースを文書に適用しました",
  "omr.error.prefix": "エラー",
  "omr.extracted.suffix": "文字のLaTeXを抽出しました",

  // Scoring panel
  "scoring.title": "採点",
  "scoring.answer_key": "解答キー",
  "scoring.add": "追加",
  "scoring.placeholder.correct": "正解",
  "scoring.placeholder.student": "生徒回答",
  "scoring.type.choice": "選択",
  "scoring.type.numeric": "数値",
  "scoring.type.text": "記述",
  "scoring.button.scoring": "採点中...",
  "scoring.button.score": "採点する",
  "scoring.score": "得点",
  "scoring.answer.label": "正解",

  // AI Chat (extended)
  "chat.online": "オンライン",
  "chat.api_key.missing": "API キーが未設定です",
  "chat.api_key.message": "ANTHROPIC_API_KEY をバックエンド (Koyeb) 環境変数に設定してください。",
  "chat.api_key.close": "閉じる",
  "chat.empty.subtitle": "LaTeXソースの作成・編集・修正を\n何でもお気軽にどうぞ。",
  "chat.input.placeholder": "EddivomAI に聞く...",
  "chat.send": "送信 (Enter)",
  "chat.input.hint": "Enter 送信 · Shift+Enter 改行",
  "chat.streaming": "生成中",
  "chat.feedback.good": "良い回答",
  "chat.feedback.bad": "改善が必要",
  "chat.applied.label": "反映済み",
  "chat.applied.suffix": "文字のLaTeXソース",
  "chat.error.details": "詳細",
  "chat.error.retry": "リトライ",
  "chat.thinking.analyzing": "リクエストを分析中...",
  "chat.thinking.processing": "処理中...",
  "chat.thinking.thinking": "考えています...",
  "chat.thinking.api_wait": "API応答を待機中...",
  "chat.tool.executing": "を実行中",
  "chat.tool.read.label": "LaTeXソースを読み込み中",
  "chat.tool.write.label": "LaTeXソースを更新中",
  "chat.tool.replace.label": "LaTeXを部分修正中",
  "chat.tool.compile.label": "コンパイルを検証中",
  "chat.tool.read.suffix": "文字のLaTeX",
  "chat.tool.write.summary": "LaTeXを更新",
  "chat.tool.replace.summary": "修正完了",
  "chat.tool.compile.success": "コンパイル成功",
  "chat.tool.compile.error": "エラー",

  // Action timeline labels
  "timeline.thinking": "思考",
  "timeline.tools": "ツール",
  "timeline.errors": "エラー",
  "timeline.steps": "ステップ",
  "timeline.label.thinking": "思考",
  "timeline.label.exec": "実行",
  "timeline.label.done": "完了",
  "timeline.label.error": "エラー",

  // Errors / messages
  "error.fetch": "サーバーへの接続に失敗しました。バックエンドが起動しているか確認してください。",
  "error.aborted": "リクエストがキャンセルされました。",
  "error.timeout": "AIサービスの応答がタイムアウトしました。しばらく待ってから再試行してください。",
  "error.generic": "エラーが発生しました。もう一度お試しください。",
  "error.no_response": "バックエンドからの応答がありませんでした。サーバーが起動中か、接続に問題がある可能性があります。",
  "error.stream.partial.prefix": "ストリーミングが途中で終了しました（受信イベント:",
  "error.stream.partial.suffix": "件）。",
  "error.stream.interrupted": "ストリーミングが中断されました。ネットワーク接続を確認してください。",
  "error.file_analyze": "ファイル解析中にエラーが発生しました。",
  "error.compile": "コンパイルエラー",
  "chat.file.applied": "ファイルを解析しました。",
  "chat.assistant.updated": "LaTeXソースを更新しました。",

  // Last AI action
  "action.latex.updated.prefix": "LaTeXソースを更新（",
  "action.latex.updated.suffix": "文字）",

  // Time formatting
  "time.now": "たった今",
  "time.seconds_ago.suffix": "秒前",
  "time.minutes_ago.suffix": "分前",
  "time.hours_ago.suffix": "時間前",

  // User menu
  "user.menu.login": "ログイン",
  "user.menu.subscription": "サブスクを管理",
  "user.menu.logout": "ログアウト",

  // Login page
  "login.tagline": "AI教材作成IDE — 無料で始めよう",
  "login.heading": "アカウントにログイン",
  "login.subheading": "Googleアカウントで簡単にログインできます",
  "login.unconfigured.title": "Google認証が未設定です",
  "login.unconfigured.body.before": "と",
  "login.unconfigured.body.after": "を",
  "login.unconfigured.body.tail": "に設定してください。",
  "login.unconfigured.hint": "Google Cloud Console → APIとサービス → 認証情報 で OAuth 2.0 クライアントIDを作成できます。",
  "login.google.button": "Googleでログイン",
  "login.terms": "ログインすることで、利用規約とプライバシーポリシーに同意したものとみなされます。",
  "login.skip": "ログインせずに利用する →",

  // Math reference
  "mathref.section.input": "日本語入力構文",
  "mathref.section.input.desc.before": "テキスト内で",
  "mathref.section.input.desc.after": "で囲んで数式を入力。日本語で以下の変換が使えます。",
  "mathref.section.symbols": "記号リファレンス",
  "mathref.section.formulas": "よく使う数式",
  "mathref.group.greek": "ギリシャ文字",
  "mathref.group.ops": "演算・関係",
  "mathref.group.arrows": "矢印・その他",
  "mathref.formula.quadratic": "二次方程式の解",
  "mathref.formula.euler": "オイラーの公式",
  "mathref.formula.integral": "定積分",
  "mathref.formula.taylor": "テイラー展開",
  "mathref.formula.gauss": "ガウス積分",
  "mathref.formula.det2x2": "行列式 2×2",

  // Editor hints (for HINTS object)
  "hint.default": "左のエディタで raw LaTeX を編集 · 右ペインで自動プレビュー · AIに依頼すれば代わりに編集します",
  "hint.math": "数式モード: $...$ でインライン数式 · \\[ ... \\] でディスプレイ数式",
  "hint.empty": "テンプレートから始めるか、AIに「○○を作って」と依頼してください",
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
  "chat.title": "EddivomAI",
  "chat.subtitle": "LaTeX document creation assistant",
  "chat.auto": "Auto",
  "chat.confirm": "Confirm",
  "chat.clear": "Clear",
  "chat.empty.title": "Eddivom AI",
  "chat.empty.sub": "Your LaTeX editing assistant",
  "chat.suggestion.1": "Create a math worksheet",
  "chat.suggestion.2": "Add 5 quadratic equations",
  "chat.suggestion.3": "Clean up the table layout",
  "chat.suggestion.4": "Fix math formula errors",
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
  "toast.pdf.fail": "PDF generation failed",
  "toast.scoring.fail": "Scoring failed",

  // Header (extended)
  "header.title.placeholder": "Untitled worksheet",
  "header.save.short": "Save",
  "header.export.json.short": "Export JSON",
  "header.scan.label": "Scan",
  "header.scan.tooltip": "AI reads images/PDFs and converts them to document blocks",
  "header.pdf.export": "Export PDF",
  "header.pdf.generating": "Generating…",
  "header.ai.thinking": "AI thinking…",
  "header.pdf.dialog.title": "Save PDF",
  "header.pdf.dialog.filename": "Filename",
  "header.pdf.dialog.cancel": "Cancel",
  "header.pdf.dialog.save": "Save",
  "header.pdf.error.unknown": "Unknown error",
  "header.theme.toggle": "Toggle theme",

  // Edit toolbar (extended)
  "edit.toolbar.mode_badge": "Template-driven LaTeX",
  "edit.toolbar.template.label": "Template",
  "edit.toolbar.template.confirm_overwrite": "Overwrite the current LaTeX source?",
  "edit.toolbar.scan.tooltip": "Scan image/PDF (OMR)",
  "edit.toolbar.pdf.tooltip": "Download PDF",
  "edit.toolbar.pdf.error": "PDF generation failed",
  "edit.toolbar.toggle.source": "Show / hide LaTeX source",
  "edit.toolbar.toggle.pdf": "Show / hide PDF preview",

  // Status bar (extended)
  "status.chars": "chars",
  "status.lines": "lines",

  // Document editor
  "doc.editor.source.label": "LaTeX source",
  "doc.editor.preview.label": "Preview",
  "doc.editor.compiling": "Compiling…",
  "doc.editor.recompile": "Recompile",
  "doc.editor.retry": "Retry",
  "doc.editor.no_document": "No document loaded",
  "doc.editor.pdf.generating": "Generating PDF…",
  "doc.editor.empty_preview": "Enter LaTeX to see the preview",
  "doc.editor.compile_error": "Compile error",
  "doc.editor.visual.label": "Visual edit",
  "doc.editor.visual.preamble": "Preamble (edit in source)",
  "doc.editor.visual.raw_hint": "This element cannot be edited visually",
  "doc.editor.visual.edit_in_source": "Edit in source",
  "doc.editor.visual.empty": "Document is empty. Pick a template or ask the AI to create one.",
  "doc.editor.math.popover.title": "Edit formula",
  "doc.editor.math.popover.current": "Current formula",
  "doc.editor.math.popover.hint": "Anything you type will replace the current formula. Close empty to leave it untouched.",
  "doc.editor.math.popover.cancel": "Cancel",

  // Editor sidebar / page
  "side.scoring.label": "Scoring",
  "side.tooltip.ai": "AI Assistant",
  "side.tooltip.scoring": "Scoring",
  "side.tooltip.lang.toEn": "Switch to English",
  "side.tooltip.lang.toJa": "Switch to Japanese",

  // OMR
  "omr.title": "Scan Mode",
  "omr.rescan": "Re-scan",
  "omr.approve": "Approve & Edit",
  "omr.source": "Source File",
  "omr.extracted": "Extracted LaTeX",
  "omr.no_file": "No file",
  "omr.results.placeholder": "Results appear here",
  "omr.analyzing": "Analyzing file...",
  "omr.no_latex": "No LaTeX extracted",
  "omr.read_failed": "Failed to load file",
  "omr.applied": "LaTeX applied to document",
  "omr.error.prefix": "Error",
  "omr.extracted.suffix": "chars of LaTeX extracted",

  // Scoring panel
  "scoring.title": "Scoring",
  "scoring.answer_key": "Answer Key",
  "scoring.add": "Add",
  "scoring.placeholder.correct": "Answer",
  "scoring.placeholder.student": "Student",
  "scoring.type.choice": "Choice",
  "scoring.type.numeric": "Numeric",
  "scoring.type.text": "Text",
  "scoring.button.scoring": "Scoring...",
  "scoring.button.score": "Score",
  "scoring.score": "Score",
  "scoring.answer.label": "Ans",

  // AI Chat (extended)
  "chat.online": "Online",
  "chat.api_key.missing": "API key not set",
  "chat.api_key.message": "Please set ANTHROPIC_API_KEY in the backend (Koyeb) environment variables.",
  "chat.api_key.close": "Close",
  "chat.empty.subtitle": "Ask anything about creating,\nediting, or fixing LaTeX source.",
  "chat.input.placeholder": "Ask EddivomAI...",
  "chat.send": "Send (Enter)",
  "chat.input.hint": "Enter to send · Shift+Enter for newline",
  "chat.streaming": "Streaming",
  "chat.feedback.good": "Good response",
  "chat.feedback.bad": "Needs improvement",
  "chat.applied.label": "Applied",
  "chat.applied.suffix": "char LaTeX source",
  "chat.error.details": "Details",
  "chat.error.retry": "Retry",
  "chat.thinking.analyzing": "Analyzing request...",
  "chat.thinking.processing": "Processing...",
  "chat.thinking.thinking": "Thinking...",
  "chat.thinking.api_wait": "Waiting for API response...",
  "chat.tool.executing": "running",
  "chat.tool.read.label": "Reading LaTeX source",
  "chat.tool.write.label": "Updating LaTeX source",
  "chat.tool.replace.label": "Editing LaTeX",
  "chat.tool.compile.label": "Validating compile",
  "chat.tool.read.suffix": "chars of LaTeX",
  "chat.tool.write.summary": "LaTeX updated",
  "chat.tool.replace.summary": "Edit complete",
  "chat.tool.compile.success": "Compile success",
  "chat.tool.compile.error": "error",

  // Action timeline labels
  "timeline.thinking": "thoughts",
  "timeline.tools": "tools",
  "timeline.errors": "errors",
  "timeline.steps": "steps",
  "timeline.label.thinking": "Think",
  "timeline.label.exec": "Exec",
  "timeline.label.done": "Done",
  "timeline.label.error": "Error",

  // Errors / messages
  "error.fetch": "Failed to connect to the server. Please check that the backend is running.",
  "error.aborted": "Request was canceled.",
  "error.timeout": "AI service response timed out. Please wait a moment and retry.",
  "error.generic": "An error occurred. Please try again.",
  "error.no_response": "No response from the backend. The server may be starting or the connection may have an issue.",
  "error.stream.partial.prefix": "Streaming ended unexpectedly (events received:",
  "error.stream.partial.suffix": ").",
  "error.stream.interrupted": "Streaming was interrupted. Please check your network connection.",
  "error.file_analyze": "An error occurred while analyzing the file.",
  "error.compile": "Compile error",
  "chat.file.applied": "File analyzed.",
  "chat.assistant.updated": "LaTeX source updated.",

  // Last AI action
  "action.latex.updated.prefix": "LaTeX source updated (",
  "action.latex.updated.suffix": " chars)",

  // Time formatting
  "time.now": "just now",
  "time.seconds_ago.suffix": "s ago",
  "time.minutes_ago.suffix": "m ago",
  "time.hours_ago.suffix": "h ago",

  // User menu
  "user.menu.login": "Sign in",
  "user.menu.subscription": "Manage subscription",
  "user.menu.logout": "Sign out",

  // Login page
  "login.tagline": "AI worksheet IDE — Get started free",
  "login.heading": "Sign in to your account",
  "login.subheading": "Sign in easily with your Google account",
  "login.unconfigured.title": "Google sign-in is not configured",
  "login.unconfigured.body.before": "and",
  "login.unconfigured.body.after": "in",
  "login.unconfigured.body.tail": "— please add them.",
  "login.unconfigured.hint": "Create an OAuth 2.0 client ID in Google Cloud Console → APIs & Services → Credentials.",
  "login.google.button": "Sign in with Google",
  "login.terms": "By signing in, you agree to our Terms of Service and Privacy Policy.",
  "login.skip": "Continue without signing in →",

  // Math reference
  "mathref.section.input": "Japanese input syntax",
  "mathref.section.input.desc.before": "Wrap math in",
  "mathref.section.input.desc.after": "inside text. The following Japanese conversions are available.",
  "mathref.section.symbols": "Symbol reference",
  "mathref.section.formulas": "Common formulas",
  "mathref.group.greek": "Greek letters",
  "mathref.group.ops": "Operators & relations",
  "mathref.group.arrows": "Arrows & misc",
  "mathref.formula.quadratic": "Quadratic formula",
  "mathref.formula.euler": "Euler's formula",
  "mathref.formula.integral": "Definite integral",
  "mathref.formula.taylor": "Taylor expansion",
  "mathref.formula.gauss": "Gaussian integral",
  "mathref.formula.det2x2": "2×2 determinant",

  // Editor hints (for HINTS object)
  "hint.default": "Edit raw LaTeX on the left · Auto preview on the right · Ask AI to edit for you",
  "hint.math": "Math: $...$ for inline · \\[ ... \\] for display",
  "hint.empty": "Start from a template, or ask the AI to create something",
} as const;
