"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Code2, Sigma } from "lucide-react";
import { useUIStore } from "@/store/ui-store";

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
  const setShowSourcePanel = useUIStore((s) => s.setShowSourcePanel);
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

  // ── レンダリング ──
  if (segments.length === 0 || (segments.length === 1 && segments[0].kind === "preamble")) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground/60 px-8 text-center">
        {t("doc.editor.visual.empty")}
      </div>
    );
  }

  return (
    <>
      <div className="visual-editor h-full w-full overflow-y-auto bg-stone-200/60 dark:bg-stone-950/60 scrollbar-thin">
        <div className="mx-auto my-10 w-full max-w-3xl bg-white dark:bg-zinc-900 shadow-[0_2px_24px_-4px_rgba(0,0,0,0.18)] dark:shadow-[0_2px_24px_-4px_rgba(0,0,0,0.6)] ring-1 ring-black/5 dark:ring-white/5 rounded-sm">
          <div className="px-16 py-20 space-y-4 min-h-[calc(100vh-8rem)]">
            {segments.map((seg, idx) => (
              <SegmentRenderer
                key={`${idx}-${seg.kind}`}
                segment={seg}
                latex={latex}
                onHeadingCommit={(title) => handleHeadingCommit(seg, title)}
                onParagraphCommit={(el) => handleParagraphCommit(seg, el)}
                onOpenMath={setMathTarget}
                onShowSource={() => setShowSourcePanel(true)}
              />
            ))}
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
  latex: string;
  onHeadingCommit: (newTitle: string) => void;
  onParagraphCommit: (el: HTMLElement) => void;
  onOpenMath: (target: MathEditTarget) => void;
  onShowSource: () => void;
}

function SegmentRenderer({
  segment,
  latex,
  onHeadingCommit,
  onParagraphCommit,
  onOpenMath,
  onShowSource,
}: SegmentRendererProps) {
  const { t } = useI18n();

  if (segment.meta?.hidden === "true") return null;

  switch (segment.kind) {
    case "preamble":
      // プリアンブルは Word ライクな白紙体験のため非表示。
      // LaTeX を直接編集したいときはツールバーから LaTeX ソースパネルを開く。
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
        <button
          type="button"
          onClick={() => onOpenMath({ range: segment.range, body: segment.body, wrapper: wrapperKey })}
          className="block w-full my-4 px-4 py-3 rounded-lg border border-violet-200/60 dark:border-violet-800/40 bg-violet-50/30 dark:bg-violet-950/15 hover:border-violet-400/60 hover:bg-violet-100/40 dark:hover:bg-violet-900/20 transition-colors group text-left"
        >
          <div className="flex items-center gap-1.5 mb-1">
            <Sigma className="h-3 w-3 text-violet-500/60" />
            <span className="text-[9px] font-semibold uppercase tracking-wider text-violet-500/60 group-hover:text-violet-600">
              数式 (クリックで編集)
            </span>
          </div>
          <div className="flex justify-center overflow-x-auto">
            <MathRenderer latex={segment.body} displayMode={true} />
          </div>
        </button>
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
      return (
        <RawBadge segment={segment} onShowSource={onShowSource} hint={t("doc.editor.visual.raw_hint")} editLabel={t("doc.editor.visual.edit_in_source")} latex={latex} />
      );

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
// PreambleBadge / RawBadge
// ─────────────────────────────────────

interface RawBadgeProps {
  segment: Segment;
  hint: string;
  editLabel: string;
  onShowSource: () => void;
  latex: string;
}

function RawBadge({ segment, hint, editLabel, onShowSource }: RawBadgeProps) {
  const isEnv = segment.meta?.isEnvironment === "true";
  const envName = segment.meta?.envName;
  const isStandalone = segment.meta?.isStandalone === "true";
  const cmd = segment.meta?.cmd;

  // \maketitle 等は小さなチップで
  if (isStandalone) {
    return (
      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/40 border border-border/40 text-[10px] font-mono text-muted-foreground my-1">
        <span className="opacity-60">\</span>
        <span>{cmd}</span>
      </div>
    );
  }

  // 環境系は preview + edit ボタン
  return (
    <div className="my-3 rounded-lg border border-amber-300/40 dark:border-amber-700/30 bg-amber-50/30 dark:bg-amber-950/10 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-amber-300/30 bg-amber-100/40 dark:bg-amber-900/15">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-700/80 dark:text-amber-400/80">
          <Code2 className="h-3 w-3" />
          {isEnv ? `\\begin{${envName}}` : "raw"}
        </div>
        <button
          type="button"
          onClick={onShowSource}
          className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 transition-colors"
        >
          {editLabel}
        </button>
      </div>
      <pre className="px-3 py-2 text-[11px] font-mono text-foreground/55 overflow-x-auto whitespace-pre-wrap max-h-40">
        {segment.body.length > 600 ? segment.body.slice(0, 600) + "\n..." : segment.body}
      </pre>
      <div className="px-3 py-1 text-[9px] text-muted-foreground/50 italic border-t border-amber-300/20">
        {hint}
      </div>
    </div>
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
      // 数式はクライアント側で KaTeX レンダリング (placeholder span を入れて
      // mount 後に MathRenderer で書き換える方が綺麗だが、v1 では innerText を使う)
      // → ここでは KaTeX を直接 string でレンダリングできないので、
      //    ASCII プレースホルダ + data 属性で持つ。クリックで popover が開く。
      html += `<span data-inline-math="1" data-range-start="${inline.range.start}" data-range-end="${inline.range.end}" data-original-body="${escapeHtml(inline.body)}" data-wrapper="inline-dollar" contenteditable="false" class="inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 rounded bg-violet-100/60 dark:bg-violet-900/30 border border-violet-300/40 dark:border-violet-700/40 text-violet-700 dark:text-violet-300 text-[12px] font-mono cursor-pointer hover:bg-violet-200/60 dark:hover:bg-violet-800/40 select-none align-middle">$${escapeHtml(inline.body)}$</span>`;
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
