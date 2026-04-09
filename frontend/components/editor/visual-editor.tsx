"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import "katex/dist/katex.min.css";
import "katex/contrib/mhchem";
import {
  renderInlineMathOrPlaceholder,
  renderDisplayMathOrPlaceholder,
} from "@/lib/katex-render";
import { Sigma } from "lucide-react";
import {
  parseLatexToSegments,
  replaceRange,
  serializeSegment,
  extractInlines,
  type Segment,
  type Inline,
  type Range,
} from "@/lib/latex-segments";
import { useI18n } from "@/lib/i18n";
import { MathEditPopover } from "./math-edit-popover";

// 数式チップ挿入後にホスト editable へ「内容を commit せよ」と通知するためのカスタムイベント名。
// 各 editable block (ContentEditableBlock / TrailingEditableParagraph) はこのイベントを購読し、
// シリアライズして親の onCommit (paragraph) または onInsert (trailing) を発火する。
// この仕組みのおかげで FAB / ショートカット等、コンポーネントツリー外から発火する経路でも
// 一様に commit を起こせる。
const COMMIT_EVENT = "latex-gui:commit-now";

// ─────────────────────────────────────
// MathEditorContext — 数式編集ポップオーバーを開くための DI。
// VisualEditor が単一のポップオーバーを持ち、子コンポーネントは
// useMathEditor() で「現在の数式 LaTeX」と「適用/キャンセル時のコールバック」を渡して開く。
// これにより「生 LaTeX を画面に出さず、自然言語で数式を編集する」を強制できる。
// ─────────────────────────────────────

interface MathEditRequest {
  /** 既存の LaTeX (中身のみ。$ や \[\] などの wrapper は含まない) */
  initialLatex: string;
  /** 確定時のコールバック。新しい LaTeX (中身のみ) を受け取る。 */
  onApply: (newLatex: string) => void;
  /** ユーザーが apply せずに閉じた時のコールバック (新規挿入の取り消し等に使う) */
  onCancel?: () => void;
}

const MathEditorContext = createContext<((req: MathEditRequest) => void) | null>(null);

function useMathEditor(): (req: MathEditRequest) => void {
  const ctx = useContext(MathEditorContext);
  if (!ctx) throw new Error("MathEditorContext provider is missing");
  return ctx;
}

// 中央集約された KaTeX レンダラ (生 LaTeX を画面に出さない方針) を使う。
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

  // ─── 数式編集ポップオーバー (シングルトン) ───
  // 子要素から openMathEditor(req) で開く。apply されたかどうかを appliedRef で追跡し、
  // 単に閉じられた場合だけ onCancel を呼ぶ (新規挿入時の空チップ削除に使う)。
  const [mathEditRequest, setMathEditRequest] = useState<MathEditRequest | null>(null);
  const mathAppliedRef = useRef(false);

  const openMathEditor = useCallback((req: MathEditRequest) => {
    mathAppliedRef.current = false;
    setMathEditRequest(req);
  }, []);

  // ─── 「数式を挿入」ボタン用: 最後にフォーカスがあった editable を追跡 ───
  // ボタンを mousedown.preventDefault で押すと選択範囲が消えないので、ボタンクリック時に
  // window.getSelection() を読めば十分だが、念のためフォールバック先として保持しておく。
  const lastFocusedEditableRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      let el = e.target as HTMLElement | null;
      while (el && el !== window.document.body) {
        if (el.isContentEditable && el.getAttribute("contenteditable") === "true") {
          lastFocusedEditableRef.current = el;
          return;
        }
        el = el.parentElement;
      }
    };
    window.document.addEventListener("focusin", onFocusIn);
    return () => window.document.removeEventListener("focusin", onFocusIn);
  }, []);

  /** ツールバー / FAB から「カーソル位置に数式を挿入」を発動する */
  const requestInsertMath = useCallback(() => {
    let target: HTMLElement | null = lastFocusedEditableRef.current;
    if (!target || !window.document.body.contains(target)) {
      target = trailingRef.current;
    }
    if (!target) return;

    // 現在の選択範囲が target の中になければ末尾に caret を置く
    const sel = window.getSelection();
    const inside =
      sel && sel.anchorNode && target.contains(sel.anchorNode);
    if (!inside) {
      target.focus();
      const range = window.document.createRange();
      range.selectNodeContents(target);
      range.collapse(false);
      const sel2 = window.getSelection();
      if (sel2) {
        sel2.removeAllRanges();
        sel2.addRange(range);
      }
    }
    insertEmptyMathChipAndEdit(target, openMathEditor);
  }, [openMathEditor]);

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
    <MathEditorContext.Provider value={openMathEditor}>
      <div className="relative h-full w-full">
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
                  latex={latex}
                  applyRangeEdit={applyRangeEdit}
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
        {/* 「数式を挿入」フローティングボタン — スクロールに追従せず常に右下に表示 */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={requestInsertMath}
          title={t("doc.editor.math.insert.tooltip")}
          aria-label={t("doc.editor.math.insert")}
          className="absolute bottom-6 right-6 z-10 flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/30 hover:bg-violet-700 hover:shadow-violet-600/40 active:scale-95 transition-all"
        >
          <Sigma className="h-4 w-4" />
          {t("doc.editor.math.insert")}
        </button>
      </div>
      {mathEditRequest && (
        <MathEditPopover
          initialLatex={mathEditRequest.initialLatex}
          onApply={(newLatex) => {
            mathAppliedRef.current = true;
            mathEditRequest.onApply(newLatex);
          }}
          onClose={() => {
            if (!mathAppliedRef.current) {
              mathEditRequest.onCancel?.();
            }
            setMathEditRequest(null);
          }}
        />
      )}
    </MathEditorContext.Provider>
  );
}

// ─────────────────────────────────────
// Segment renderer (kind に応じて分岐)
// ─────────────────────────────────────

interface SegmentRendererProps {
  segment: Segment;
  latex: string;
  applyRangeEdit: (range: Range, snippet: string) => void;
}

function SegmentRenderer({ segment, latex, applyRangeEdit }: SegmentRendererProps) {
  if (segment.meta?.hidden === "true") return null;

  // セグメントごとに commit ハンドラを構築 (再帰描画でも同じハンドラ生成ロジックを共有)
  const onHeadingCommit = (newTitle: string) => {
    if (newTitle === segment.body) return;
    const snippet = serializeSegment(segment, newTitle, latex);
    applyRangeEdit(segment.range, snippet);
  };

  const onParagraphCommit = (el: HTMLElement) => {
    const newBody = serializeContentEditableDOM(el);
    if (newBody.trim() === segment.body.trim()) return;
    if (segment.kind === "item") {
      const bodyStart = Number(segment.meta?.bodyStart);
      const bodyEnd = Number(segment.meta?.bodyEnd);
      if (Number.isFinite(bodyStart) && Number.isFinite(bodyEnd)) {
        applyRangeEdit({ start: bodyStart, end: bodyEnd }, newBody);
        return;
      }
    }
    applyRangeEdit(segment.range, newBody);
  };

  const onDisplayMathCommit = (newBody: string) => {
    const trimmed = newBody.trim();
    if (trimmed === segment.body.trim()) return;
    const snippet = serializeSegment(segment, trimmed, latex);
    applyRangeEdit(segment.range, snippet);
  };

  switch (segment.kind) {
    case "preamble":
      // プリアンブルは完全に非表示。ユーザーは LaTeX を見ない。
      return null;

    case "section": {
      // 空 \section{} (autoLabel) は \titleformat により PDF 側で「第N問」「Problem N」が
      // 注入されているケース。ビジュアル側で同じ番号付きラベルを描く。
      const isAuto = segment.meta?.autoLabel === "true";
      const sectionNumber = segment.meta?.sectionNumber;
      if (isAuto && sectionNumber) {
        return <SectionAutoLabel number={sectionNumber} />;
      }
      return (
        <EditableHeading
          tag="h2"
          initialText={segment.body}
          onCommit={onHeadingCommit}
          className="text-2xl font-bold text-foreground border-b border-foreground/10 pb-1.5 mt-6"
        />
      );
    }

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
      return <EditableParagraph segment={segment} latex={latex} onCommit={onParagraphCommit} />;

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
          {(segment.children ?? []).map((child, idx) => {
            // item の commit は親 list の onParagraphCommit ではなく
            // child segment 自身の range で行う必要がある (closure 注意)
            const onItemCommit = (el: HTMLElement) => {
              const newBody = serializeContentEditableDOM(el);
              if (newBody.trim() === child.body.trim()) return;
              const bodyStart = Number(child.meta?.bodyStart);
              const bodyEnd = Number(child.meta?.bodyEnd);
              if (Number.isFinite(bodyStart) && Number.isFinite(bodyEnd)) {
                applyRangeEdit({ start: bodyStart, end: bodyEnd }, newBody);
                return;
              }
              applyRangeEdit(child.range, newBody);
            };
            return (
              <EditableItem
                key={`${idx}-item`}
                segment={child}
                latex={latex}
                onCommit={onItemCommit}
              />
            );
          })}
        </ListTag>
      );
    }

    case "daimon": {
      // 大問ボックス: タイトル帯 (インライン編集可・\quad / \haiten 等を装飾表示)
      // + 子セグメントを再帰レンダリング
      const titleStart = Number(segment.meta?.titleStart);
      const titleEnd = Number(segment.meta?.titleEnd);
      const hasTitleRange = Number.isFinite(titleStart) && titleStart >= 0 && Number.isFinite(titleEnd);
      // タイトル range を疑似 paragraph segment として包み、ContentEditableBlock 経由で
      // インライン (\quad → 空白 / \haiten → バッジ / $..$ → math chip) を描画する
      const titleSegment: Segment | null = hasTitleRange ? {
        id: segment.id + "-title",
        kind: "paragraph",
        range: { start: titleStart, end: titleEnd },
        body: latex.slice(titleStart, titleEnd),
        inlines: extractInlines(latex, titleStart, titleEnd),
      } : null;
      const onDaimonTitleCommit = (el: HTMLElement) => {
        if (!hasTitleRange) return;
        const newBody = serializeContentEditableDOM(el);
        if (newBody.trim() === (titleSegment?.body ?? "").trim()) return;
        applyRangeEdit({ start: titleStart, end: titleEnd }, newBody);
      };
      return (
        <div className="my-6 rounded-md overflow-hidden border border-[#1e3a8a]/40 bg-[#1e3a8a]/[0.025] dark:border-[#93c5fd]/30 dark:bg-[#1e3a8a]/15 shadow-[0_1px_0_rgba(30,58,138,0.08)]">
          {titleSegment && (
            <ContentEditableBlock
              segment={titleSegment}
              latex={latex}
              onCommit={onDaimonTitleCommit}
              tag="h3"
              className="daimon-title bg-[#1e3a8a] text-white px-4 py-2 text-[15px] font-bold tracking-wide m-0 rounded-none border-0"
            />
          )}
          <div className="px-5 py-4 space-y-2">
            {(segment.children ?? []).map((child, idx) => (
              <SegmentRenderer
                key={`${idx}-${child.kind}`}
                segment={child}
                latex={latex}
                applyRangeEdit={applyRangeEdit}
              />
            ))}
          </div>
        </div>
      );
    }

    case "center": {
      return (
        <div className="daimon-center my-4 flex flex-col items-center text-center [&>*]:max-w-full [&_p]:text-center [&_h2]:text-center [&_h3]:text-center [&_h4]:text-center">
          {(segment.children ?? []).map((child, idx) => (
            <SegmentRenderer
              key={`${idx}-${child.kind}`}
              segment={child}
              latex={latex}
              applyRangeEdit={applyRangeEdit}
            />
          ))}
        </div>
      );
    }

    case "container": {
      // 未知環境 (tcolorbox / kihon / ouyou / teigi / passage / note / frame …) の透過コンテナ。
      // {title} 引数があれば見出しとして編集可能に出し、子セグメントを再帰描画する。
      // 「📎tcolorbox」のような生 env 名は表示しない。
      const titleStart = Number(segment.meta?.titleStart);
      const titleEnd = Number(segment.meta?.titleEnd);
      const hasTitleRange = Number.isFinite(titleStart) && titleStart >= 0 && Number.isFinite(titleEnd) && titleStart < titleEnd;
      const titleSegment: Segment | null = hasTitleRange ? {
        id: segment.id + "-title",
        kind: "paragraph",
        range: { start: titleStart, end: titleEnd },
        body: latex.slice(titleStart, titleEnd),
        inlines: extractInlines(latex, titleStart, titleEnd),
      } : null;
      const onContainerTitleCommit = (el: HTMLElement) => {
        if (!hasTitleRange) return;
        const newBody = serializeContentEditableDOM(el);
        if (newBody.trim() === (titleSegment?.body ?? "").trim()) return;
        applyRangeEdit({ start: titleStart, end: titleEnd }, newBody);
      };
      return (
        <div className="container-block my-4 rounded-md border border-foreground/10 bg-foreground/[0.015] dark:bg-white/[0.02] overflow-hidden">
          {titleSegment && (
            <ContentEditableBlock
              segment={titleSegment}
              latex={latex}
              onCommit={onContainerTitleCommit}
              tag="h4"
              className="container-block-title px-4 py-1.5 text-[13px] font-semibold text-foreground/75 bg-foreground/[0.04] dark:bg-white/[0.04] m-0 border-b border-foreground/10"
            />
          )}
          <div className="px-4 py-3 space-y-2">
            {(segment.children ?? []).map((child, idx) => (
              <SegmentRenderer
                key={`${idx}-${child.kind}`}
                segment={child}
                latex={latex}
                applyRangeEdit={applyRangeEdit}
              />
            ))}
          </div>
        </div>
      );
    }

    case "table":
      return <TableSegmentRenderer segment={segment} latex={latex} />;

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
  latex: string;
  onCommit: (el: HTMLElement) => void;
}

function EditableParagraph({ segment, latex, onCommit }: EditableParagraphProps) {
  return (
    <ContentEditableBlock
      segment={segment}
      latex={latex}
      onCommit={onCommit}
      tag="p"
      className="prose-text-block text-[15px] leading-[1.75] text-foreground/85 my-3"
    />
  );
}

interface EditableItemProps {
  segment: Segment;
  latex: string;
  onCommit: (el: HTMLElement) => void;
}

function EditableItem({ segment, latex, onCommit }: EditableItemProps) {
  return (
    <ContentEditableBlock
      segment={segment}
      latex={latex}
      onCommit={onCommit}
      tag="li"
      className="prose-text-item text-[15px] leading-[1.65] text-foreground/85"
    />
  );
}

type ContentEditableTag = "p" | "li" | "h2" | "h3" | "h4" | "div";

interface ContentEditableBlockProps {
  segment: Segment;
  latex: string;
  onCommit: (el: HTMLElement) => void;
  tag: ContentEditableTag;
  className?: string;
}

/**
 * paragraph / item 共通の contentEditable ブロック。
 * inlines を描画し、編集確定時に DOM を walk してシリアライズする。
 *
 * 数式は埋め込みの「緑チップ」(nested contentEditable) として表示され、
 * クリックで直接編集できる。Cmd/Ctrl+M でカーソル位置に空 chip を挿入 / chip 内なら exit。
 */
function ContentEditableBlock({ segment, latex, onCommit, tag: Tag, className }: ContentEditableBlockProps) {
  const ref = useRef<HTMLElement | null>(null);
  const lastSerialized = useRef<string>(segment.body);
  const openMathEditor = useMathEditor();

  // onCommit は親が毎レンダで作る closure になりがち。
  // 後述の DOM-level イベントリスナは一度だけ取り付けたいので、最新 onCommit を ref 経由で参照する。
  const onCommitRef = useRef(onCommit);
  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  // inlines を初期 HTML として組み立てる (バッジ等は元 LaTeX を data 属性として埋め込む)
  const initialHTML = useMemo(() => buildInlinesHTML(segment.inlines ?? [], latex), [segment.inlines, latex]);

  // 外部 (ストア / テンプレ切替 / AI 編集) 由来でセグメント body が変わったら DOM を同期する。
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof document !== "undefined" && document.activeElement === node) return;
    // 子孫にフォーカスが入っている場合も触らない
    if (typeof document !== "undefined" && node.contains(document.activeElement)) return;
    const currentSerialized = serializeContentEditableDOM(node);
    if (currentSerialized.trim() === segment.body.trim()) {
      lastSerialized.current = currentSerialized;
      return;
    }
    node.innerHTML = initialHTML;
    lastSerialized.current = serializeContentEditableDOM(node);
  }, [initialHTML, segment.body]);

  // 数式チップは contentEditable=false なので、クリックしてもキャレットは動かない。
  // mousedown を捕まえてポップオーバーを開き、apply 時に data-source とプレビューを書き換える。
  // commit は COMMIT_EVENT を介して下記の listener が拾う。
  // (生 LaTeX は画面に一切出さない: 「テンプレ駆動 + 自然言語 → LaTeX」方針)
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const onMouseDown = (e: MouseEvent) => {
      const chip = findEnclosingChip(e.target as HTMLElement | null);
      if (!chip) return;
      e.preventDefault();
      e.stopPropagation();
      openMathEditor({
        initialLatex: chip.dataset.source ?? "",
        onApply: (newLatex) => {
          renderChipPreview(chip, newLatex);
          node.dispatchEvent(new CustomEvent(COMMIT_EVENT, { bubbles: false }));
        },
      });
    };
    const onCommitNow = () => {
      const target = ref.current;
      if (!target) return;
      const serialized = serializeContentEditableDOM(target);
      if (serialized !== lastSerialized.current) {
        lastSerialized.current = serialized;
        onCommitRef.current(target);
      }
    };
    node.addEventListener("mousedown", onMouseDown);
    node.addEventListener(COMMIT_EVENT, onCommitNow);
    return () => {
      node.removeEventListener("mousedown", onMouseDown);
      node.removeEventListener(COMMIT_EVENT, onCommitNow);
    };
  }, [openMathEditor]);

  // Cmd/Ctrl+M で空チップを挿入してポップオーバーを開く (commit は COMMIT_EVENT 経由)
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "m") return;
      e.preventDefault();
      e.stopPropagation();
      const node = ref.current;
      if (!node) return;
      insertEmptyMathChipAndEdit(node, openMathEditor);
    },
    [openMathEditor]
  );

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
      onKeyDown={onKeyDown}
      onBlur={(e) => {
        const el = e.currentTarget as HTMLElement;
        // 子孫にフォーカスが移っただけなら commit しない
        const next = e.relatedTarget as Node | null;
        if (next && el.contains(next)) return;
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
  const openMathEditor = useMathEditor();

  /** KaTeX で表示。失敗時は中央レンダラのプレースホルダ (生 LaTeX を出さない) */
  const renderPreview = useCallback((node: HTMLDivElement, source: string) => {
    node.dataset.source = source;
    if (!source.trim()) {
      node.innerHTML = '<span class="display-math-placeholder" contenteditable="false">&nbsp;</span>';
      return;
    }
    node.innerHTML = renderDisplayMathOrPlaceholder(source);
  }, []);

  // 外部更新 (テンプレ切替 / ストア反映) の同期
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if ((node.dataset.source ?? "") === initialBody) return;
    renderPreview(node, initialBody);
  }, [initialBody, renderPreview]);

  // クリックでポップオーバーを開く (生 LaTeX を見せない方針)
  const onClick = useCallback(() => {
    const node = ref.current;
    const current = node?.dataset.source ?? initialBody;
    openMathEditor({
      initialLatex: current,
      onApply: (newLatex) => {
        if (node) renderPreview(node, newLatex);
        if (newLatex !== current) onCommit(newLatex);
      },
    });
  }, [openMathEditor, onCommit, initialBody, renderPreview]);

  return (
    <div
      ref={(node: HTMLDivElement | null) => {
        ref.current = node;
        if (node && !node.dataset.initialized) {
          node.dataset.initialized = "1";
          renderPreview(node, initialBody);
        }
      }}
      role="button"
      tabIndex={0}
      className="display-math-block my-4 cursor-pointer outline-none"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    />
  );
}

// ─────────────────────────────────────
// 数式チップ — 常時 KaTeX プレビュー (生 LaTeX 編集モードは廃止)
// 編集はすべて MathEditPopover (自然言語入力) を経由する。
// ─────────────────────────────────────

/** チップの中身を KaTeX プレビューで描画する。data-source も同時に更新。
 *  生 LaTeX は絶対に出さず、失敗時は中央レンダラのプレースホルダを使う。 */
function renderChipPreview(chip: HTMLElement, source: string): void {
  chip.dataset.source = source;
  if (!source.trim()) {
    chip.innerHTML = '<span class="math-chip-placeholder" contenteditable="false">&nbsp;</span>';
    return;
  }
  chip.innerHTML = renderInlineMathOrPlaceholder(source);
}

function findEnclosingChip(node: Node | null): HTMLElement | null {
  while (node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.dataset && el.dataset.mathChip === "1") return el;
    }
    node = node.parentNode;
  }
  return null;
}

/**
 * 現在のキャレット位置に空の数式チップを挿入し、即座にポップオーバーを開く。
 * apply 時には containerEl に COMMIT_EVENT を発火し、ホストの editable block 側で
 * シリアライズ + commit を行う (どこから呼ばれても commit パスが一本化される)。
 * cancel 時はチップを取り除くだけで commit はしない (元の LaTeX ソースに反映されていないため)。
 */
function insertEmptyMathChipAndEdit(
  containerEl: HTMLElement,
  openMathEditor: (req: MathEditRequest) => void,
): void {
  if (typeof window === "undefined") return;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  // キャレットがこの container の外にある場合は末尾に置き直す
  if (!containerEl.contains(sel.getRangeAt(0).startContainer)) {
    const fallback = window.document.createRange();
    fallback.selectNodeContents(containerEl);
    fallback.collapse(false);
    sel.removeAllRanges();
    sel.addRange(fallback);
  }

  const span = window.document.createElement("span");
  span.dataset.mathChip = "1";
  span.dataset.wrapper = "dollar";
  span.dataset.source = "";
  span.contentEditable = "false";
  span.className = "math-chip";
  span.innerHTML = '<span class="math-chip-fallback" contenteditable="false">&nbsp;</span>';

  const insertRange = sel.getRangeAt(0);
  insertRange.deleteContents();
  insertRange.insertNode(span);

  // チップの直後にキャレットを移す
  const after = window.document.createRange();
  after.setStartAfter(span);
  after.collapse(true);
  sel.removeAllRanges();
  sel.addRange(after);

  openMathEditor({
    initialLatex: "",
    onApply: (newLatex) => {
      renderChipPreview(span, newLatex);
      containerEl.dispatchEvent(new CustomEvent(COMMIT_EVENT, { bubbles: false }));
    },
    onCancel: () => {
      span.remove();
    },
  });
}

// ─────────────────────────────────────
// RawPlaceholder — \maketitle / table / figure 等。
// ユーザーには LaTeX を見せない。\maketitle 等は完全無視、
// 環境系は「(表)」「(図)」のようなアイコンチップで表すだけ。
// ─────────────────────────────────────

const ENV_LABEL_JA: Record<string, string> = {
  table: "表",
  "table*": "表",
  tabular: "表",
  "tabular*": "表",
  tabularx: "表",
  longtable: "表",
  array: "行列",
  matrix: "行列",
  figure: "図",
  "figure*": "図",
  wrapfigure: "図",
  wraptable: "表",
  tikzpicture: "図",
  pgfpicture: "図",
  verbatim: "コード",
  "verbatim*": "コード",
  Verbatim: "コード",
  lstlisting: "コード",
  minted: "コード",
  alltt: "コード",
  thebibliography: "参考文献",
  filecontents: "外部ファイル",
  "filecontents*": "外部ファイル",
};

const ENV_LABEL_ICON: Record<string, string> = {
  table: "▦", "table*": "▦", tabular: "▦", "tabular*": "▦",
  tabularx: "▦", longtable: "▦", array: "▦", matrix: "▦",
  wraptable: "▦",
  figure: "❖", "figure*": "❖", wrapfigure: "❖",
  tikzpicture: "❖", pgfpicture: "❖",
  verbatim: "</>", "verbatim*": "</>", Verbatim: "</>",
  lstlisting: "</>", minted: "</>", alltt: "</>",
  thebibliography: "❡",
  filecontents: "▣", "filecontents*": "▣",
};

// ─────────────────────────────────────
// SectionAutoLabel — 空 \section{} 用に「第N問」「Problem N」を自動生成
//
// 大学入試系のテンプレでは titleformat により "第\thesection 問" が自動挿入される
// (PDF 上では \fbox + 罫線で出る)。ビジュアルエディタは titleformat を解釈できないので、
// 番号付きラベルを箱で包んで PDF に近い見た目にする。
// ─────────────────────────────────────

function SectionAutoLabel({ number }: { number: string }) {
  const { locale } = useI18n();
  const label = locale === "en" ? `Problem ${number}` : `第 ${number} 問`;
  return (
    <div className="my-6 select-none">
      <div className="flex items-baseline gap-3">
        <span className="inline-block px-3 py-1 border border-foreground/70 text-foreground font-bold text-[16px] tracking-wide leading-none">
          {label}
        </span>
        <div className="flex-1 h-px bg-foreground/30" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────
// TableSegmentRenderer — \begin{tabular}{...}...\end{tabular} を HTML テーブルに描画
//
// 設計:
//   - parser が cells/rows/cols を meta に JSON で保存している。
//   - 各セルは extractInlines で再パースして本文のインラインを描画する。
//   - 編集は v1 では readonly。テーブルは template で boilerplate (試験時間表/氏名欄) として
//     使われがちなので、見た目さえ揃えば編集できなくても許容される。
//     編集したいユーザーは LaTeX ソースパネルで直接書き換えられる。
// ─────────────────────────────────────

interface TableCellMeta {
  start: number;
  end: number;
}
interface TableRowMeta {
  topRule: boolean;
  bottomRule: boolean;
  cells: TableCellMeta[];
}
interface TableColMeta {
  align: "left" | "center" | "right";
  borderLeft: boolean;
  borderRight: boolean;
  stretch: boolean;
}

function TableSegmentRenderer({ segment, latex }: { segment: Segment; latex: string }) {
  // parser のメタを安全に復元
  let cols: TableColMeta[] = [];
  let rows: TableRowMeta[] = [];
  try {
    cols = JSON.parse(segment.meta?.cols ?? "[]") as TableColMeta[];
    rows = JSON.parse(segment.meta?.rows ?? "[]") as TableRowMeta[];
  } catch {
    return <RawPlaceholder segment={segment} />;
  }
  if (rows.length === 0) return <RawPlaceholder segment={segment} />;

  // 列数 (cols がスペックから取れた数 / 行から推定の最大値)
  const maxCols = Math.max(cols.length, ...rows.map((r) => r.cells.length));

  return (
    <table className="latex-table-render my-3 border-collapse" contentEditable={false} suppressContentEditableWarning>
      <tbody>
        {rows.map((row, ri) => {
          const isFirst = ri === 0;
          const prevHadBottom = ri > 0 && rows[ri - 1].bottomRule;
          const showTop = row.topRule || (isFirst && false);
          return (
            <tr
              key={ri}
              style={{
                borderTop: showTop || prevHadBottom ? "1px solid currentColor" : undefined,
                borderBottom: row.bottomRule ? "1px solid currentColor" : undefined,
              }}
            >
              {Array.from({ length: maxCols }).map((_, ci) => {
                const cell = row.cells[ci];
                const col = cols[ci];
                const align = col?.align ?? "left";
                const borderLeft = col?.borderLeft ? "1px solid currentColor" : undefined;
                const borderRight = col?.borderRight ? "1px solid currentColor" : undefined;
                if (!cell) {
                  return (
                    <td
                      key={ci}
                      style={{
                        textAlign: align,
                        borderLeft,
                        borderRight,
                        padding: "4px 8px",
                      }}
                    />
                  );
                }
                const inlines = extractInlines(latex, cell.start, cell.end);
                const html = buildInlinesHTML(inlines, latex);
                return (
                  <td
                    key={ci}
                    style={{
                      textAlign: align,
                      borderLeft,
                      borderRight,
                      padding: "4px 8px",
                      verticalAlign: "middle",
                    }}
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function RawPlaceholder({ segment }: { segment: Segment }) {
  const isStandalone = segment.meta?.isStandalone === "true";
  const isEnv = segment.meta?.isEnvironment === "true";

  // \maketitle / \tableofcontents / \newpage / `\\[10mm]` 等は完全に非表示。
  if (isStandalone) return null;

  if (isEnv) {
    const envName = segment.meta?.envName ?? "";
    const label = ENV_LABEL_JA[envName] ?? envName;
    const icon = ENV_LABEL_ICON[envName] ?? "▣";
    return (
      <div className="my-3 px-3 py-2 rounded border border-dashed border-foreground/12 bg-foreground/[0.015] inline-flex items-center gap-2 text-foreground/40 text-[11.5px] tracking-wide">
        <span className="font-mono text-[10px]">{icon}</span>
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
  const openMathEditor = useMathEditor();

  // onInsert は親の closure で毎回作り直されがち。listener を一度だけ取り付けるため ref 経由で参照する。
  const onInsertRef = useRef(onInsert);
  useEffect(() => {
    onInsertRef.current = onInsert;
  }, [onInsert]);

  // 数式チップ click → ポップオーバー (生 LaTeX を見せない)
  // FAB / Cmd+M 経由で挿入された新規チップの commit も COMMIT_EVENT で受ける
  useEffect(() => {
    const node = innerRef.current;
    if (!node) return;
    const onMouseDown = (e: MouseEvent) => {
      const chip = findEnclosingChip(e.target as HTMLElement | null);
      if (!chip) return;
      e.preventDefault();
      e.stopPropagation();
      openMathEditor({
        initialLatex: chip.dataset.source ?? "",
        onApply: (newLatex) => {
          renderChipPreview(chip, newLatex);
          node.dispatchEvent(new CustomEvent(COMMIT_EVENT, { bubbles: false }));
        },
      });
    };
    const onCommitNow = () => {
      const text = serializeContentEditableDOM(node).replace(/\u200B/g, "").trim();
      if (text) {
        node.textContent = "";
        onInsertRef.current(text);
      }
    };
    node.addEventListener("mousedown", onMouseDown);
    node.addEventListener(COMMIT_EVENT, onCommitNow);
    return () => {
      node.removeEventListener("mousedown", onMouseDown);
      node.removeEventListener(COMMIT_EVENT, onCommitNow);
    };
  }, [innerRef, openMathEditor]);

  // Cmd/Ctrl+M で空チップ挿入 → ポップオーバー (commit は COMMIT_EVENT 経由)
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "m") return;
      e.preventDefault();
      e.stopPropagation();
      const node = innerRef.current;
      if (!node) return;
      insertEmptyMathChipAndEdit(node, openMathEditor);
    },
    [innerRef, openMathEditor]
  );

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
      onKeyDown={onKeyDown}
      onBlur={(e) => {
        const el = e.currentTarget as HTMLElement;
        // 子孫 (math chip) にフォーカスが移っただけなら commit しない
        const next = e.relatedTarget as Node | null;
        if (next && el.contains(next)) return;
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

/** math chip の初期 HTML を生成。
 *  チップ自体は contentEditable=false (atomic な inline 要素として振る舞う)。
 *  クリックすると ContentEditableBlock の mousedown delegation が MathEditPopover を開く。
 *  生 LaTeX を画面に出さない方針のため、編集モードは存在せず常に KaTeX プレビュー固定。
 *  失敗時は中央レンダラのプレースホルダ (\u2329 math \u232A) で生 LaTeX 露出を防ぐ。 */
function buildMathChipHTML(source: string, wrapper: string): string {
  const safeSource = escapeHtml(source);
  const inner = renderInlineMathOrPlaceholder(source);
  return `<span data-math-chip="1" data-wrapper="${wrapper}" data-source="${safeSource}" contenteditable="false" class="math-chip">${inner}</span>`;
}

/** sized inline (\Large \bfseries 等) の CSS スタイル文字列を作る。
 *  size と weight/shape は data 属性で round-trip するので class でも data 属性でも OK。
 *  ここでは inline style で直接サイズを当てる (CSS class より優先順位が分かりやすい)。 */
function sizedInlineStyle(meta: Record<string, string> | undefined): string {
  if (!meta) return "";
  const sizeMap: Record<string, string> = {
    tiny: "0.6em",
    scriptsize: "0.72em",
    footnotesize: "0.83em",
    small: "0.92em",
    normalsize: "1em",
    large: "1.18em",
    Large: "1.36em",
    LARGE: "1.6em",
    huge: "1.92em",
    Huge: "2.3em",
  };
  const parts: string[] = [];
  if (meta.size && sizeMap[meta.size]) parts.push(`font-size:${sizeMap[meta.size]}`);
  if (meta.weight === "bold") parts.push("font-weight:700");
  if (meta.shape === "italic") parts.push("font-style:italic");
  return parts.join(";");
}

/** Inline 配列から contentEditable 用の初期 HTML を組み立てる。
 *  scoreBadge など「表示と原 LaTeX が異なる」種類は src から原文をそのまま data 属性に埋め込む。 */
function buildInlinesHTML(inlines: Inline[], src: string): string {
  let html = "";
  for (const inline of inlines) {
    if (inline.kind === "text") {
      html += escapeHtml(inline.body);
    } else if (inline.kind === "inlineMath") {
      html += buildMathChipHTML(inline.body, "dollar");
    } else if (inline.kind === "bold") {
      html += `<strong>${escapeHtml(inline.body)}</strong>`;
    } else if (inline.kind === "italic") {
      html += `<em>${escapeHtml(inline.body)}</em>`;
    } else if (inline.kind === "code") {
      html += `<code class="px-1 py-0.5 rounded bg-muted/60 text-[12px] font-mono">${escapeHtml(inline.body)}</code>`;
    } else if (inline.kind === "scoreBadge") {
      const orig = src.slice(inline.range.start, inline.range.end);
      html += `<span class="haiten-badge" contenteditable="false" data-haiten-source="${escapeHtml(orig)}">${escapeHtml(inline.body)}</span>`;
    } else if (inline.kind === "linebreak") {
      html += `<br data-latex-linebreak="1"/>`;
    } else if (inline.kind === "rule") {
      const w = inline.meta?.width ?? "1em";
      const h = inline.meta?.height ?? "0.4pt";
      // 横ルール (PDF の \rule{...}{...} と同じく文字列ライン)
      html += `<span class="latex-rule" contenteditable="false" data-rule-width="${escapeHtml(w)}" data-rule-height="${escapeHtml(h)}" style="display:inline-block;vertical-align:middle;width:${escapeHtml(cssLength(w))};height:${escapeHtml(cssLength(h))};background:currentColor;margin:0 0.2em;">&nbsp;</span>`;
    } else if (inline.kind === "framed") {
      const cmdName = inline.meta?.cmd ?? "fbox";
      html += `<span class="latex-fbox" data-fbox-cmd="${escapeHtml(cmdName)}" style="display:inline-block;border:1px solid currentColor;padding:0 0.35em;border-radius:1px;">${escapeHtml(inline.body)}</span>`;
    } else if (inline.kind === "colored") {
      const color = inline.meta?.color ?? "inherit";
      const css = colorNameToCss(color);
      html += `<span class="latex-color" data-color="${escapeHtml(color)}" style="color:${css};">${escapeHtml(inline.body)}</span>`;
    } else if (inline.kind === "sized") {
      const style = sizedInlineStyle(inline.meta);
      const dataAttrs = Object.entries(inline.meta ?? {})
        .map(([k, v]) => `data-sized-${k}="${escapeHtml(v)}"`)
        .join(" ");
      html += `<span class="latex-sized" ${dataAttrs} style="${style}">${escapeHtml(inline.body)}</span>`;
    }
  }
  if (!html) html = "&#8203;"; // 空段落でもカレットを出すための ZWSP
  return html;
}

/** LaTeX の長さ表記 (12mm, 0.4pt, 0.8\textwidth, 6em ...) を CSS の長さに変換する。
 *  完全な変換は不可能なので、よく出るケースだけ覚えておく。 */
function cssLength(latex: string): string {
  const s = latex.trim();
  if (!s) return "0";
  // 0.8\textwidth → 80%
  const tw = s.match(/^([\d.]+)\\textwidth$/);
  if (tw) return `${parseFloat(tw[1]) * 100}%`;
  const lw = s.match(/^([\d.]+)\\linewidth$/);
  if (lw) return `${parseFloat(lw[1]) * 100}%`;
  // \textwidth 単独 → 100%
  if (s === "\\textwidth" || s === "\\linewidth") return "100%";
  // 数値 + 単位 (mm/cm/pt/em/ex/in/px) → そのまま
  const m = s.match(/^([-\d.]+)(mm|cm|pt|em|ex|in|px|%)?$/);
  if (m) {
    const v = m[1];
    const u = m[2] || "pt";
    return `${v}${u}`;
  }
  return "0";
}

/** 既知のテンプレ色名 → CSS 色 (RGB) のマップ。未知の色は currentColor で逃がす。 */
const NAMED_COLORS: Record<string, string> = {
  black: "#000", white: "#fff",
  red: "#dc2626", blue: "#2563eb", green: "#16a34a", yellow: "#facc15",
  cyan: "#06b6d4", magenta: "#d946ef", orange: "#ea580c", purple: "#9333ea",
  gray: "#6b7280", lightgray: "#d1d5db", darkgray: "#374151",
  // テンプレで定義される色は 16 進だが、ここでは認識できないので無視 (currentColor)
};
function colorNameToCss(name: string): string {
  const trimmed = name.trim();
  if (NAMED_COLORS[trimmed]) return NAMED_COLORS[trimmed];
  // \color{red!75!black} のような表現は基底色だけ拾う
  const base = trimmed.split("!")[0];
  if (NAMED_COLORS[base]) return NAMED_COLORS[base];
  return "currentColor";
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

    // 装飾バッジ (\haiten{N} 等) は data-haiten-source に元 LaTeX を保存しているのでそのまま吐く
    if (child.dataset.haitenSource) {
      result += child.dataset.haitenSource;
      continue;
    }

    if (child.dataset.mathChip === "1") {
      // チップは常にプレビュー固定 (生 LaTeX 編集モードなし)。
      // ソースは data-source に保管されているので、それを wrapper で囲んで吐く。
      const body = (child.dataset.source ?? "").trim();
      if (!body) continue;
      const wrapper = child.dataset.wrapper || "dollar";
      if (wrapper === "paren") result += `\\(${body}\\)`;
      else result += `$${body}$`;
      continue;
    }

    // \rule{w}{h} を data 属性で round-trip
    if (child.dataset.ruleWidth) {
      const w = child.dataset.ruleWidth;
      const h = child.dataset.ruleHeight ?? "0.4pt";
      result += `\\rule{${w}}{${h}}`;
      continue;
    }

    // \fbox{...} / \framebox{...}
    if (child.dataset.fboxCmd) {
      const cmd = child.dataset.fboxCmd;
      result += `\\${cmd}{${serializeContentEditableDOM(child)}}`;
      continue;
    }

    // \textcolor{name}{...}
    if (child.dataset.color) {
      const color = child.dataset.color;
      result += `\\textcolor{${color}}{${serializeContentEditableDOM(child)}}`;
      continue;
    }

    // {\Large\bfseries ...}
    if (child.dataset.sizedSize !== undefined || child.dataset.sizedWeight !== undefined || child.dataset.sizedShape !== undefined) {
      const size = child.dataset.sizedSize;
      const weight = child.dataset.sizedWeight;
      const shape = child.dataset.sizedShape;
      const parts: string[] = [];
      if (size) parts.push(`\\${size}`);
      if (weight === "bold") parts.push(`\\bfseries`);
      if (shape === "italic") parts.push(`\\itshape`);
      const prefix = parts.join("");
      result += `{${prefix}${prefix ? " " : ""}${serializeContentEditableDOM(child)}}`;
      continue;
    }

    // \\ (LaTeX line break)
    if (child.dataset.latexLinebreak === "1") {
      result += `\\\\`;
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
