"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import "katex/contrib/mhchem";
import {
  parseLatexToSegments,
  replaceRange,
  serializeSegment,
  type Segment,
  type Inline,
  type Range,
} from "@/lib/latex-segments";
import { MathRenderer } from "./math-editor";
import { MathEditPopover } from "./math-edit-popover";
import { useI18n } from "@/lib/i18n";
// useUIStore is intentionally not imported — VisualEditor never reveals LaTeX source.

interface VisualEditorProps {
  latex: string;
  onChange: (newLatex: string) => void;
}

interface MathEditTarget {
  /** 元 LaTeX 内の置換範囲 (wrapper 込み) */
  range: Range;
  /** 中身 (popover の初期表示用) */
  body: string;
  /** wrapper 復元情報: "inline-dollar" | "inline-paren" | "display-bracket" | "display-dollar" | "display-env:NAME" */
  wrapper: string;
}

/**
 * VisualEditor — LaTeX を HTML+KaTeX で編集可能に表示するメインコンポーネント
 *
 * 編集モデル:
 * - 各セグメントは contentEditable で直接編集可能
 * - 編集確定 (onBlur) 時に該当 range を新文字列で置換 → onChange を呼ぶ
 * - 数式はクリックで MathEditPopover を開く → 確定時に該当 range を置換
 * - 未対応構文 (raw / preamble) は静的バッジで表示し、「ソースで編集」リンクを出す
 */
export function VisualEditor({ latex, onChange }: VisualEditorProps) {
  const { t } = useI18n();
  const segments = useMemo(() => parseLatexToSegments(latex), [latex]);

  const [mathTarget, setMathTarget] = useState<MathEditTarget | null>(null);

  // Edit を発行するヘルパー: range と新スニペットを受け取り、onChange を呼ぶ
  const applyRangeEdit = useCallback(
    (range: Range, newSnippet: string) => {
      const newLatex = replaceRange(latex, range, newSnippet);
      if (newLatex !== latex) onChange(newLatex);
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

  // 数式編集 (popover からの apply)
  const handleMathApply = useCallback(
    (newInnerLatex: string) => {
      if (!mathTarget) return;
      const wrapper = mathTarget.wrapper;
      let snippet = "";
      if (wrapper === "inline-dollar") snippet = `$${newInnerLatex}$`;
      else if (wrapper === "inline-paren") snippet = `\\(${newInnerLatex}\\)`;
      else if (wrapper === "display-bracket") snippet = `\\[\n${newInnerLatex}\n\\]`;
      else if (wrapper === "display-dollar") snippet = `$$${newInnerLatex}$$`;
      else if (wrapper.startsWith("display-env:")) {
        const env = wrapper.slice("display-env:".length);
        snippet = `\\begin{${env}}\n${newInnerLatex}\n\\end{${env}}`;
      } else {
        snippet = `$${newInnerLatex}$`;
      }
      applyRangeEdit(mathTarget.range, snippet);
      setMathTarget(null);
    },
    [mathTarget, applyRangeEdit]
  );

  // 表示対象となるセグメント (preamble / documentEnd / hidden raw を除外)
  const visibleSegments = segments.filter((seg) => {
    if (seg.kind === "preamble" || seg.kind === "documentEnd") return false;
    if (seg.meta?.hidden === "true") return false;
    return true;
  });
  const hasContent = visibleSegments.length > 0;

  return (
    <>
      <div className="visual-editor h-full w-full overflow-y-auto bg-stone-200/60 dark:bg-stone-950/60 scrollbar-thin">
        <div className="mx-auto my-10 w-full max-w-3xl bg-white dark:bg-zinc-900 shadow-[0_2px_24px_-4px_rgba(0,0,0,0.18)] dark:shadow-[0_2px_24px_-4px_rgba(0,0,0,0.6)] ring-1 ring-black/5 dark:ring-white/5 rounded-sm">
          <div className="px-16 py-20 space-y-4 min-h-[calc(100vh-8rem)]">
            {hasContent ? (
              visibleSegments.map((seg, idx) => (
                <SegmentRenderer
                  key={`${idx}-${seg.kind}`}
                  segment={seg}
                  onHeadingCommit={(title) => handleHeadingCommit(seg, title)}
                  onParagraphCommit={(el) => handleParagraphCommit(seg, el)}
                  onOpenMath={setMathTarget}
                />
              ))
            ) : (
              <BlankPaperPlaceholder hint={t("doc.editor.visual.empty")} />
            )}
          </div>
        </div>
      </div>

      {mathTarget && (
        <MathEditPopover
          initialLatex={mathTarget.body}
          onApply={handleMathApply}
          onClose={() => setMathTarget(null)}
        />
      )}
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
  onOpenMath: (target: MathEditTarget) => void;
}

function SegmentRenderer({
  segment,
  onHeadingCommit,
  onParagraphCommit,
  onOpenMath,
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

    case "displayMath": {
      const wrapper = segment.meta?.wrapper;
      const wrapperKey =
        wrapper === "bracket" ? "display-bracket"
        : wrapper === "dollar" ? "display-dollar"
        : wrapper === "env" ? `display-env:${segment.meta?.envName ?? "equation"}`
        : "display-bracket";
      return (
        <div
          role="button"
          tabIndex={0}
          onClick={() => onOpenMath({ range: segment.range, body: segment.body, wrapper: wrapperKey })}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpenMath({ range: segment.range, body: segment.body, wrapper: wrapperKey });
            }
          }}
          className="my-5 px-2 py-2 rounded-md cursor-pointer hover:bg-foreground/[0.025] transition-colors flex justify-center overflow-x-auto"
          title="クリックして数式を編集"
        >
          <MathRenderer latex={segment.body} displayMode={true} />
        </div>
      );
    }

    case "paragraph":
      return (
        <EditableParagraph
          segment={segment}
          onCommit={onParagraphCommit}
          onOpenMath={onOpenMath}
        />
      );

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
              onOpenMath={onOpenMath}
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

  // 外部更新の同期 (自分が書いたものではない場合のみ。フォーカス中は触らない)
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (initialText === lastWritten.current) return;
    if (typeof document !== "undefined" && document.activeElement === node) return;
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
  onOpenMath: (target: MathEditTarget) => void;
}

function EditableParagraph({ segment, onCommit, onOpenMath }: EditableParagraphProps) {
  return (
    <ContentEditableBlock
      segment={segment}
      onCommit={onCommit}
      onOpenMath={onOpenMath}
      tag="p"
      className="text-[15px] leading-[1.75] text-foreground/85 my-3"
    />
  );
}

interface EditableItemProps {
  segment: Segment;
  onCommit: (el: HTMLElement) => void;
  onOpenMath: (target: MathEditTarget) => void;
}

function EditableItem({ segment, onCommit, onOpenMath }: EditableItemProps) {
  return (
    <ContentEditableBlock
      segment={segment}
      onCommit={onCommit}
      onOpenMath={onOpenMath}
      tag="li"
      className="text-[15px] leading-[1.65] text-foreground/85"
    />
  );
}

interface ContentEditableBlockProps {
  segment: Segment;
  onCommit: (el: HTMLElement) => void;
  onOpenMath: (target: MathEditTarget) => void;
  tag: "p" | "li";
  className?: string;
}

/**
 * paragraph / item 共通の contentEditable ブロック。
 * inlines を描画し、編集確定時に DOM を walk してシリアライズする。
 */
function ContentEditableBlock({ segment, onCommit, onOpenMath, tag: Tag, className }: ContentEditableBlockProps) {
  const ref = useRef<HTMLElement | null>(null);
  const lastSerialized = useRef<string>(segment.body);

  // inlines を初期 HTML として組み立てる
  const initialHTML = useMemo(() => buildInlinesHTML(segment.inlines ?? []), [segment.inlines]);

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const mathSpan = target.closest<HTMLElement>("[data-inline-math]");
    if (mathSpan) {
      e.preventDefault();
      e.stopPropagation();
      const start = Number(mathSpan.dataset.rangeStart);
      const end = Number(mathSpan.dataset.rangeEnd);
      const body = mathSpan.dataset.originalBody || "";
      const wrapper = mathSpan.dataset.wrapper || "inline-dollar";
      if (Number.isFinite(start) && Number.isFinite(end)) {
        onOpenMath({ range: { start, end }, body, wrapper });
      }
    }
  };

  return (
    <Tag
      ref={(node: HTMLElement | null) => {
        ref.current = node;
        if (node && node.dataset.initialized !== "1") {
          node.innerHTML = initialHTML;
          node.dataset.initialized = "1";
          lastSerialized.current = serializeContentEditableDOM(node);
        }
      }}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      className={`${className ?? ""} outline-none focus:bg-foreground/[0.03] rounded px-1 -mx-1 cursor-text whitespace-pre-wrap`}
      onClick={handleClick}
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
// BlankPaperPlaceholder — 本文ゼロのときに紙の上に薄く出すヒント
// ─────────────────────────────────────

function BlankPaperPlaceholder({ hint }: { hint: string }) {
  return (
    <p className="text-foreground/30 text-[15px] leading-[1.75] italic select-none">
      {hint}
    </p>
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

/** KaTeX で数式を HTML 文字列に変換 (失敗時は薄いプレースホルダ) */
function renderMathToHTML(latex: string): string {
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      displayMode: false,
      trust: true,
      strict: "ignore",
      output: "html",
    });
  } catch {
    return `<span class="text-rose-500/70">数式エラー</span>`;
  }
}

/** Inline 配列から contentEditable 用の初期 HTML を組み立てる */
function buildInlinesHTML(inlines: Inline[]): string {
  let html = "";
  for (const inline of inlines) {
    if (inline.kind === "text") {
      html += escapeHtml(inline.body);
    } else if (inline.kind === "inlineMath") {
      // KaTeX でコンパイル済みとしてレンダリング。LaTeX ソースは表に出さない。
      // クリック領域として data 属性付きの非編集 span でラップ。
      const rendered = renderMathToHTML(inline.body);
      html += `<span data-inline-math="1" data-range-start="${inline.range.start}" data-range-end="${inline.range.end}" data-original-body="${escapeHtml(inline.body)}" data-wrapper="inline-dollar" contenteditable="false" class="inline-block align-middle mx-0.5 px-1 rounded cursor-pointer hover:bg-foreground/[0.05] transition-colors select-none" title="クリックして数式を編集">${rendered}</span>`;
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

    if (child.dataset.inlineMath === "1") {
      const body = child.dataset.originalBody || "";
      const wrapper = child.dataset.wrapper || "inline-dollar";
      if (wrapper === "inline-paren") result += `\\(${body}\\)`;
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
