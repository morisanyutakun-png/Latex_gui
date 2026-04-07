"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  parseLatexToSegments,
  replaceRange,
  serializeSegment,
  type Segment,
  type Inline,
  type Range,
} from "@/lib/latex-segments";
import { useI18n } from "@/lib/i18n";
// useUIStore is intentionally not imported — VisualEditor never reveals LaTeX source.

interface VisualEditorProps {
  latex: string;
  onChange: (newLatex: string) => void;
}

/**
 * VisualEditor — LaTeX を contentEditable で直接編集できるビジュアルエディタ
 *
 * 編集モデル:
 * - 各セグメントは contentEditable のグレーボックスで直接編集可能
 * - 編集確定 (onBlur) 時に該当 range を新文字列で置換 → onChange を呼ぶ
 * - インライン数式は文章中に「緑のチップ」として埋め込まれ、その場で生 LaTeX を編集できる
 *   (ポップオーバー無し。Word の数式オブジェクトのように直接書ける)
 * - displayMath は緑のブロック内で同じく生 LaTeX を直接編集できる
 * - Cmd/Ctrl+M でカーソル位置に math chip を挿入 / chip 内なら exit
 * - 未対応構文 (raw / preamble) は静的バッジで表示
 */
export function VisualEditor({ latex, onChange }: VisualEditorProps) {
  const { t } = useI18n();
  const segments = useMemo(() => parseLatexToSegments(latex), [latex]);

  // 末尾の常時編集可能な段落 (Word ライクな「白紙の上にカーソル」感)
  const trailingRef = useRef<HTMLParagraphElement | null>(null);

  // Edit を発行するヘルパー: range と新スニペットを受け取り、onChange を呼ぶ
  const applyRangeEdit = useCallback(
    (range: Range, newSnippet: string) => {
      const newLatex = replaceRange(latex, range, newSnippet);
      if (newLatex !== latex) onChange(newLatex);
    },
    [latex, onChange]
  );

  // 新しい段落を本文末尾 (\end{document} の直前) に挿入する
  const handleInsertNewParagraph = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const endDocIdx = latex.indexOf("\\end{document}");
      let next: string;
      if (endDocIdx === -1) {
        // \end{document} なし → 末尾に追加
        const sep = latex.length === 0 ? "" : latex.endsWith("\n\n") ? "" : latex.endsWith("\n") ? "\n" : "\n\n";
        next = latex + sep + trimmed + "\n";
      } else {
        // \end{document} の前に空行で囲んで挿入
        const before = latex.slice(0, endDocIdx).replace(/\s*$/, "");
        const after = latex.slice(endDocIdx);
        next = before + "\n\n" + trimmed + "\n\n" + after;
      }
      onChange(next);
    },
    [latex, onChange]
  );

  // 見出し編集
  const handleHeadingCommit = useCallback(
    (segment: Segment, newTitle: string) => {
      if (newTitle === segment.body) return;
      const snippet = serializeSegment(segment, newTitle, latex);
      applyRangeEdit(segment.range, snippet);
    },
    [applyRangeEdit, latex]
  );

  // 段落・item 編集 (DOM walker でシリアライズ)
  const handleParagraphCommit = useCallback(
    (segment: Segment, el: HTMLElement) => {
      const newBody = serializeContentEditableDOM(el);
      const trimmed = newBody.trim();
      const original = segment.body.trim();
      if (trimmed === original) return;

      if (segment.kind === "item") {
        // item は \item の本体 (bodyStart..bodyEnd) のみ置換
        const bodyStart = Number(segment.meta?.bodyStart);
        const bodyEnd = Number(segment.meta?.bodyEnd);
        if (Number.isFinite(bodyStart) && Number.isFinite(bodyEnd)) {
          applyRangeEdit({ start: bodyStart, end: bodyEnd }, newBody);
          return;
        }
      }
      applyRangeEdit(segment.range, newBody);
    },
    [applyRangeEdit]
  );

  // displayMath ブロックの編集確定
  const handleDisplayMathCommit = useCallback(
    (segment: Segment, newBody: string) => {
      const trimmed = newBody.trim();
      if (trimmed === segment.body.trim()) return;
      const snippet = serializeSegment(segment, trimmed, latex);
      applyRangeEdit(segment.range, snippet);
    },
    [applyRangeEdit, latex]
  );

  // 表示対象となるセグメント (preamble / documentEnd / hidden raw を除外)
  const visibleSegments = segments.filter((seg) => {
    if (seg.kind === "preamble" || seg.kind === "documentEnd") return false;
    if (seg.meta?.hidden === "true") return false;
    return true;
  });

  // ページ上の余白クリックで末尾の編集可能段落にカーソルを移す (Word ライク)
  const handlePageMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const node = trailingRef.current;
    if (!node) return;
    e.preventDefault();
    node.focus();
    if (typeof window !== "undefined") {
      const sel = window.getSelection();
      if (sel) {
        const range = window.document.createRange();
        range.selectNodeContents(node);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  };

  return (
    <>
      <div className="visual-editor h-full w-full overflow-y-auto bg-stone-200/60 dark:bg-stone-950/60 scrollbar-thin">
        <div className="mx-auto my-10 w-full max-w-3xl bg-white dark:bg-zinc-900 shadow-[0_2px_24px_-4px_rgba(0,0,0,0.18)] dark:shadow-[0_2px_24px_-4px_rgba(0,0,0,0.6)] ring-1 ring-black/5 dark:ring-white/5 rounded-sm">
          <div
            className="px-16 py-20 space-y-4 min-h-[calc(100vh-8rem)] cursor-text"
            onMouseDown={handlePageMouseDown}
          >
            {visibleSegments.map((seg, idx) => (
              <SegmentRenderer
                key={`${idx}-${seg.kind}`}
                segment={seg}
                onHeadingCommit={(title) => handleHeadingCommit(seg, title)}
                onParagraphCommit={(el) => handleParagraphCommit(seg, el)}
                onDisplayMathCommit={(body) => handleDisplayMathCommit(seg, body)}
              />
            ))}
            <TrailingEditableParagraph
              innerRef={trailingRef}
              placeholder={t("doc.editor.visual.type_here")}
              onInsert={handleInsertNewParagraph}
            />
          </div>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────
// Segment renderer (kind に応じて分岐)
// ─────────────────────────────────────

interface SegmentRendererProps {
  segment: Segment;
  onHeadingCommit: (newTitle: string) => void;
  onParagraphCommit: (el: HTMLElement) => void;
  onDisplayMathCommit: (newBody: string) => void;
}

function SegmentRenderer({
  segment,
  onHeadingCommit,
  onParagraphCommit,
  onDisplayMathCommit,
}: SegmentRendererProps) {
  if (segment.meta?.hidden === "true") return null;

  switch (segment.kind) {
    case "preamble":
      // プリアンブルは完全に非表示。ユーザーは LaTeX を見ない。
      return null;

    case "section":
      return (
        <EditableHeading
          tag="h2"
          initialText={segment.body}
          onCommit={onHeadingCommit}
          className="text-2xl font-bold text-foreground border-b border-foreground/10 pb-1.5 mt-6"
        />
      );

    case "subsection":
      return (
        <EditableHeading
          tag="h3"
          initialText={segment.body}
          onCommit={onHeadingCommit}
          className="text-xl font-semibold text-foreground/90 mt-5"
        />
      );

    case "subsubsection":
      return (
        <EditableHeading
          tag="h4"
          initialText={segment.body}
          onCommit={onHeadingCommit}
          className="text-base font-semibold text-foreground/85 mt-4"
        />
      );

    case "displayMath":
      return <EditableDisplayMath initialBody={segment.body} onCommit={onDisplayMathCommit} />;

    case "paragraph":
      return <EditableParagraph segment={segment} onCommit={onParagraphCommit} />;

    case "itemize":
    case "enumerate": {
      const ListTag = segment.kind === "itemize" ? "ul" : "ol";
      return (
        <ListTag
          className={
            segment.kind === "itemize"
              ? "list-disc list-outside pl-6 space-y-1.5 my-3 marker:text-muted-foreground/50"
              : "list-decimal list-outside pl-6 space-y-1.5 my-3 marker:text-muted-foreground/60"
          }
        >
          {(segment.children ?? []).map((child, idx) => (
            <EditableItem
              key={`${idx}-item`}
              segment={child}
              onCommit={onParagraphCommit}
            />
          ))}
        </ListTag>
      );
    }

    case "raw":
      return <RawPlaceholder segment={segment} />;

    case "documentEnd":
      return null;

    default:
      return null;
  }
}

// ─────────────────────────────────────
// EditableHeading — h2/h3/h4 contentEditable
// ─────────────────────────────────────

interface EditableHeadingProps {
  tag: "h2" | "h3" | "h4";
  initialText: string;
  className?: string;
  onCommit: (newText: string) => void;
}

function EditableHeading({ tag: Tag, initialText, className, onCommit }: EditableHeadingProps) {
  const ref = useRef<HTMLHeadingElement | null>(null);
  const lastWritten = useRef(initialText);

  // 外部更新の同期: DOM 内容と prop が違えば書き直す。フォーカス中は触らない。
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof document !== "undefined" && document.activeElement === node) return;
    const current = (node.textContent || "").trim();
    if (current === initialText.trim()) {
      lastWritten.current = current;
      return;
    }
    node.textContent = initialText;
    lastWritten.current = initialText;
  }, [initialText]);

  return (
    <Tag
      ref={(node: HTMLHeadingElement | null) => {
        ref.current = node;
        if (node && node.textContent !== initialText && document.activeElement !== node) {
          node.textContent = initialText;
          lastWritten.current = initialText;
        }
      }}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      className={`${className ?? ""} outline-none focus:bg-foreground/[0.03] rounded px-1 -mx-1 cursor-text`}
      onBlur={(e) => {
        const text = (e.currentTarget.textContent || "").trim();
        if (text !== lastWritten.current) {
          lastWritten.current = text;
          onCommit(text);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.currentTarget as HTMLElement).blur();
        }
      }}
    />
  );
}

// ─────────────────────────────────────
// EditableParagraph
// ─────────────────────────────────────

interface EditableParagraphProps {
  segment: Segment;
  onCommit: (el: HTMLElement) => void;
}

function EditableParagraph({ segment, onCommit }: EditableParagraphProps) {
  return (
    <ContentEditableBlock
      segment={segment}
      onCommit={onCommit}
      tag="p"
      className="prose-text-block text-[15px] leading-[1.75] text-foreground/85 my-3"
    />
  );
}

interface EditableItemProps {
  segment: Segment;
  onCommit: (el: HTMLElement) => void;
}

function EditableItem({ segment, onCommit }: EditableItemProps) {
  return (
    <ContentEditableBlock
      segment={segment}
      onCommit={onCommit}
      tag="li"
      className="prose-text-item text-[15px] leading-[1.65] text-foreground/85"
    />
  );
}

interface ContentEditableBlockProps {
  segment: Segment;
  onCommit: (el: HTMLElement) => void;
  tag: "p" | "li";
  className?: string;
}

/**
 * paragraph / item 共通の contentEditable ブロック。
 * inlines を描画し、編集確定時に DOM を walk してシリアライズする。
 *
 * 数式は埋め込みの「緑チップ」(nested contentEditable) として表示され、
 * クリックで直接編集できる。Cmd/Ctrl+M でカーソル位置に空 chip を挿入 / chip 内なら exit。
 */
function ContentEditableBlock({ segment, onCommit, tag: Tag, className }: ContentEditableBlockProps) {
  const ref = useRef<HTMLElement | null>(null);
  const lastSerialized = useRef<string>(segment.body);

  // inlines を初期 HTML として組み立てる
  const initialHTML = useMemo(() => buildInlinesHTML(segment.inlines ?? []), [segment.inlines]);

  // 外部 (ストア / テンプレ切替 / AI 編集) 由来でセグメント body が変わったら DOM を同期する。
  // フォーカス中はユーザーの編集を壊さないため触らない。
  // チェックは「現在の DOM をシリアライズ → segment.body と一致するか」で行う。
  // 自分自身の編集の結果として再パースされた場合は一致するので no-op。
  // 別所からの差し替えでは不一致になるので innerHTML を再構築する。
  // (React がノードを再利用するケースでも確実に動く)
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof document !== "undefined" && document.activeElement === node) return;
    const currentSerialized = serializeContentEditableDOM(node);
    if (currentSerialized.trim() === segment.body.trim()) {
      lastSerialized.current = currentSerialized;
      return;
    }
    node.innerHTML = initialHTML;
    lastSerialized.current = serializeContentEditableDOM(node);
  }, [initialHTML, segment.body]);

  return (
    <Tag
      ref={(node: HTMLElement | null) => {
        ref.current = node;
        if (node && !node.dataset.initialized) {
          node.innerHTML = initialHTML;
          node.dataset.initialized = "1";
          lastSerialized.current = serializeContentEditableDOM(node);
        }
      }}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      className={`${className ?? ""} editable-text-box outline-none cursor-text whitespace-pre-wrap`}
      onKeyDown={handleMathToggleKeyDown}
      onBlur={(e) => {
        const el = e.currentTarget as HTMLElement;
        const newSerialized = serializeContentEditableDOM(el);
        if (newSerialized !== lastSerialized.current) {
          lastSerialized.current = newSerialized;
          onCommit(el);
        }
      }}
    />
  );
}

// ─────────────────────────────────────
// EditableDisplayMath — 表示数式を緑のブロック内で生 LaTeX 直接編集
// ─────────────────────────────────────

interface EditableDisplayMathProps {
  initialBody: string;
  onCommit: (newBody: string) => void;
}

function EditableDisplayMath({ initialBody, onCommit }: EditableDisplayMathProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const lastWritten = useRef(initialBody);

  // 外部更新の同期: DOM の現在 textContent と prop が違えば書き直す。
  // ノード再利用 (テンプレ切替) でも確実に動く。
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof document !== "undefined" && document.activeElement === node) return;
    const current = (node.textContent || "").replace(/\u200B/g, "");
    if (current === initialBody) {
      lastWritten.current = current;
      return;
    }
    node.textContent = initialBody;
    lastWritten.current = initialBody;
  }, [initialBody]);

  return (
    <div
      ref={(node: HTMLDivElement | null) => {
        ref.current = node;
        if (node && !node.dataset.initialized) {
          node.textContent = initialBody;
          node.dataset.initialized = "1";
          lastWritten.current = initialBody;
        }
      }}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      className="display-math-block my-4 cursor-text outline-none whitespace-pre-wrap"
      onBlur={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        const text = (el.textContent || "").replace(/\u200B/g, "");
        if (text !== lastWritten.current) {
          lastWritten.current = text;
          onCommit(text);
        }
      }}
    />
  );
}

// ─────────────────────────────────────
// 数式チップの挿入 / exit (Cmd/Ctrl+M ハンドラ)
// ─────────────────────────────────────

function handleMathToggleKeyDown(e: React.KeyboardEvent<HTMLElement>) {
  // Cmd+M (Mac) / Ctrl+M (Win/Linux) で math chip を挿入 or 終了
  if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "m") return;
  e.preventDefault();
  e.stopPropagation();

  if (typeof window === "undefined") return;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  // 現在のカーソル位置の祖先に math-chip があるか
  let node: Node | null = sel.anchorNode;
  let chip: HTMLElement | null = null;
  while (node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.dataset && el.dataset.mathChip === "1") {
        chip = el;
        break;
      }
    }
    node = node.parentNode;
  }

  if (chip) {
    // chip 内 → 外に出る (chip の直後にカーソルを移動)
    const range = window.document.createRange();
    range.setStartAfter(chip);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    return;
  }

  // chip 外 → 新しい空の math chip を挿入 (選択範囲があればそれをラップ)
  const range = sel.getRangeAt(0);
  const selectedText = sel.toString();
  const span = window.document.createElement("span");
  span.dataset.mathChip = "1";
  span.dataset.wrapper = "dollar";
  span.contentEditable = "true";
  span.className = "math-chip";
  span.textContent = selectedText || "\u200B";
  range.deleteContents();
  range.insertNode(span);

  // chip 内にカーソルを移動 (末尾)
  const newRange = window.document.createRange();
  newRange.selectNodeContents(span);
  newRange.collapse(false);
  sel.removeAllRanges();
  sel.addRange(newRange);
}

// ─────────────────────────────────────
// RawPlaceholder — \maketitle / table / figure 等。
// ユーザーには LaTeX を見せない。\maketitle 等は完全無視、
// 環境系は「(表)」「(図)」のようなアイコンチップで表すだけ。
// ─────────────────────────────────────

const ENV_LABEL_JA: Record<string, string> = {
  table: "表",
  tabular: "表",
  figure: "図",
  tikzpicture: "図",
  verbatim: "コードブロック",
  lstlisting: "コードブロック",
  minted: "コードブロック",
  abstract: "概要",
  center: "中央寄せブロック",
};

function RawPlaceholder({ segment }: { segment: Segment }) {
  const isStandalone = segment.meta?.isStandalone === "true";
  const isEnv = segment.meta?.isEnvironment === "true";

  // \maketitle / \tableofcontents / \newpage 等は完全に非表示。
  if (isStandalone) return null;

  if (isEnv) {
    const envName = segment.meta?.envName ?? "";
    const label = ENV_LABEL_JA[envName] ?? envName;
    return (
      <div className="my-4 px-4 py-3 rounded-md border border-dashed border-foreground/15 bg-foreground/[0.015] flex items-center gap-2 text-foreground/45 italic text-[12.5px]">
        <span className="text-[14px]">📎</span>
        <span>{label}</span>
      </div>
    );
  }

  // その他 (% コメント等) も完全非表示。
  return null;
}

// ─────────────────────────────────────
// TrailingEditableParagraph — 本文末尾に常時ある「白紙の入力枠」
//
// Word ライクに「ページ上のどこをクリックしても入力できる」感を実現するため、
// 常に末尾に空の contentEditable を 1 つ置いておく。
// 入力 → blur で本文末尾 (\end{document} の直前) に新しい段落として挿入する。
// 空のときは placeholder テキストを CSS で描画する。
// ─────────────────────────────────────

interface TrailingEditableParagraphProps {
  placeholder: string;
  onInsert: (text: string) => void;
  innerRef: React.MutableRefObject<HTMLParagraphElement | null>;
}

function TrailingEditableParagraph({ placeholder, onInsert, innerRef }: TrailingEditableParagraphProps) {
  return (
    <p
      ref={(node: HTMLParagraphElement | null) => {
        innerRef.current = node;
      }}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      data-placeholder={placeholder}
      className="trailing-editable editable-text-box text-[15px] leading-[1.75] text-foreground/85 my-3 outline-none cursor-text whitespace-pre-wrap min-h-[1.75em]"
      onKeyDown={handleMathToggleKeyDown}
      onBlur={(e) => {
        const el = e.currentTarget as HTMLElement;
        // chip も含めてシリアライズ (生 textContent ではなく serializer を使う)
        const text = serializeContentEditableDOM(el).replace(/\u200B/g, "").trim();
        if (text) {
          el.textContent = "";
          onInsert(text);
        }
      }}
    />
  );
}

// ─────────────────────────────────────
// inlines → HTML 変換 + DOM serializer
// ─────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Inline 配列から contentEditable 用の初期 HTML を組み立てる */
function buildInlinesHTML(inlines: Inline[]): string {
  let html = "";
  for (const inline of inlines) {
    if (inline.kind === "text") {
      html += escapeHtml(inline.body);
    } else if (inline.kind === "inlineMath") {
      // 数式は緑のチップとして文中に直接編集可能なまま埋め込む。
      // contenteditable="true" にして、その場で生 LaTeX を編集できるようにする。
      // wrapper を data 属性で保持して、シリアライズ時に $...$ / \(...\) を復元する。
      html += `<span data-math-chip="1" data-wrapper="dollar" contenteditable="true" class="math-chip">${escapeHtml(inline.body)}</span>`;
    } else if (inline.kind === "bold") {
      html += `<strong>${escapeHtml(inline.body)}</strong>`;
    } else if (inline.kind === "italic") {
      html += `<em>${escapeHtml(inline.body)}</em>`;
    } else if (inline.kind === "code") {
      html += `<code class="px-1 py-0.5 rounded bg-muted/60 text-[12px] font-mono">${escapeHtml(inline.body)}</code>`;
    }
  }
  if (!html) html = "&#8203;"; // 空段落でもカレットを出すための ZWSP
  return html;
}

/** contentEditable な要素から LaTeX 文字列をシリアライズする */
export function serializeContentEditableDOM(el: HTMLElement): string {
  let result = "";
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      result += (node.textContent || "").replace(/\u200B/g, "");
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const child = node as HTMLElement;
    const tag = child.tagName.toLowerCase();

    if (child.dataset.mathChip === "1") {
      // ライブの textContent を読む (ユーザーが chip 内で編集した可能性)
      const body = (child.textContent || "").replace(/\u200B/g, "");
      if (!body.trim()) continue; // 空 chip は出力しない (誤って $$ になるのを避ける)
      const wrapper = child.dataset.wrapper || "dollar";
      if (wrapper === "paren") result += `\\(${body}\\)`;
      else result += `$${body}$`;
      continue;
    }
    if (tag === "strong" || tag === "b") {
      result += `\\textbf{${child.textContent || ""}}`;
      continue;
    }
    if (tag === "em" || tag === "i") {
      result += `\\textit{${child.textContent || ""}}`;
      continue;
    }
    if (tag === "code") {
      result += `\\texttt{${child.textContent || ""}}`;
      continue;
    }
    if (tag === "br") {
      result += "\n";
      continue;
    }
    // 不明な要素 → 子の text を再帰的に取得
    result += serializeContentEditableDOM(child);
  }
  return result.replace(/\u00A0/g, " ");
}
