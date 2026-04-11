"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
  /** ドキュメントのテンプレ ID。data-template として root に出力し、
   *  CSS でテンプレ別の色 / コンテナ枠 / 見出し装飾を適用する。 */
  template?: string;
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
export function VisualEditor({ latex, onChange, template }: VisualEditorProps) {
  const { t } = useI18n();
  const segments = useMemo(() => parseLatexToSegments(latex), [latex]);
  const templateId = template ?? "blank";

  // ユーザーのソースに含まれる \definecolor を CSS 色として畳み、
  // \titleformat{\section}{...\color{X}...} 等から見出し色を引き出して
  // CSS 変数として root に流し込む (簡易プレビューを PDF に近づける)。
  const docColorVars = useMemo(() => {
    const colorMap = parseDefinedColors(latex);
    const sectionColor = extractTitleformatColor(latex, "section", colorMap);
    const subsectionColor = extractTitleformatColor(latex, "subsection", colorMap);
    const style: Record<string, string> = {};
    if (sectionColor) style["--doc-section-color"] = sectionColor;
    if (subsectionColor) style["--doc-subsection-color"] = subsectionColor;
    return style;
  }, [latex]);

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
        <div
          className="visual-editor h-full w-full overflow-y-auto bg-stone-200/60 dark:bg-stone-950/60 scrollbar-thin"
          data-template={templateId}
          style={docColorVars as CSSProperties}
        >
          <div className="visual-editor-paper mx-auto my-10 w-full max-w-3xl bg-white dark:bg-zinc-900 shadow-[0_2px_24px_-4px_rgba(0,0,0,0.18)] dark:shadow-[0_2px_24px_-4px_rgba(0,0,0,0.6)] ring-1 ring-black/5 dark:ring-white/5 rounded-sm">
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

    case "titleBlock":
      return <TitleBlockRenderer segment={segment} latex={latex} applyRangeEdit={applyRangeEdit} />;

    case "toc":
      return <TocRenderer segment={segment} />;

    case "vspace":
      return <VSpaceRenderer segment={segment} />;

    case "pageBreak":
      return <PageBreakRenderer segment={segment} />;

    case "bibliography":
      return <BibliographyRenderer segment={segment} latex={latex} applyRangeEdit={applyRangeEdit} />;

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
          className="text-2xl font-bold border-b border-foreground/10 pb-1.5 mt-6"
          style={{ color: "var(--doc-section-color, hsl(var(--foreground)))" }}
        />
      );
    }

    case "subsection":
      return (
        <EditableHeading
          tag="h3"
          initialText={segment.body}
          onCommit={onHeadingCommit}
          className="text-xl font-semibold mt-5"
          style={{ color: "var(--doc-subsection-color, hsl(var(--foreground) / 0.9))" }}
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
        <div className="container-block daimon-block my-6 overflow-hidden" data-env="daimon">
          {titleSegment && (
            <ContentEditableBlock
              segment={titleSegment}
              latex={latex}
              onCommit={onDaimonTitleCommit}
              tag="h3"
              className="daimon-title m-0"
            />
          )}
          <div className="container-block-body">
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

    case "container":
      return <ContainerRenderer segment={segment} latex={latex} applyRangeEdit={applyRangeEdit} />;

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
  style?: CSSProperties;
  onCommit: (newText: string) => void;
}

function EditableHeading({ tag: Tag, initialText, className, style, onCommit }: EditableHeadingProps) {
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
      style={style}
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

type ContentEditableTag = "p" | "li" | "h1" | "h2" | "h3" | "h4" | "div";

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
  // 装飾はテンプレ別に CSS で行う (data-template が祖先 .visual-editor にある)。
  // ユーザー定義の \titleformat 色があれば --doc-section-color 経由で色が載る。
  return (
    <div
      className="section-auto-label select-none"
      data-section-number={number}
      style={{ color: "var(--doc-section-color, inherit)" }}
    >
      <span className="section-auto-label-badge">{label}</span>
      <span className="section-auto-label-divider" />
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

// ─────────────────────────────────────
// ContainerRenderer — \begin{<env>}{title}...\end{<env>} の汎用コンテナ。
//
// 未知の環境 (tcolorbox / tcbtheorem / flushright / abstract / quote / ...) を
// 透過的に展開して子を再帰描画する。title 引数がなくても、既知環境名に対して
// ロケールに合わせたデフォルトラベル (abstract → "Abstract"/"要約" 等) を出す。
// ─────────────────────────────────────

// 既知の「ラベルを出したい」環境名 → ロケール別表示ラベル。
// 同時に、タイトル引数を持たない環境にもデフォルトタイトルを与える。
const CONTAINER_DEFAULT_LABELS: Record<string, { ja: string; en: string }> = {
  abstract: { ja: "要約", en: "Abstract" },
  quote: { ja: "引用", en: "Quote" },
  quotation: { ja: "引用", en: "Quotation" },
  verse: { ja: "詩", en: "Verse" },
  proof: { ja: "証明", en: "Proof" },
  theorem: { ja: "定理", en: "Theorem" },
  lemma: { ja: "補題", en: "Lemma" },
  corollary: { ja: "系", en: "Corollary" },
  definition: { ja: "定義", en: "Definition" },
  example: { ja: "例", en: "Example" },
  remark: { ja: "注意", en: "Remark" },
  note: { ja: "注記", en: "Note" },
};

// 子孫を再帰描画するだけの無題コンテナ (枠も見出しも出さない)。
// flushright / flushleft などの「配置スイッチ」に使う。
const CONTAINER_ALIGN_CLASSES: Record<string, string> = {
  flushright: "text-right",
  flushleft: "text-left",
};

interface ContainerRendererProps {
  segment: Segment;
  latex: string;
  applyRangeEdit: (range: Range, snippet: string) => void;
}

function ContainerRenderer({ segment, latex, applyRangeEdit }: ContainerRendererProps) {
  const { locale } = useI18n();
  const envName = segment.meta?.envName ?? "container";
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

  // 配置スイッチ (flushright / flushleft) は枠なしで子を並べる
  const alignClass = CONTAINER_ALIGN_CLASSES[envName];
  if (alignClass) {
    return (
      <div className={`${alignClass} my-3`} data-env={envName}>
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

  // 既知環境のデフォルトラベル (title 引数がない時の fallback)
  const defaultLabel = !titleSegment && CONTAINER_DEFAULT_LABELS[envName]
    ? (locale === "en" ? CONTAINER_DEFAULT_LABELS[envName].en : CONTAINER_DEFAULT_LABELS[envName].ja)
    : null;

  // abstract は紙面中央にインデント付きで出す (LaTeX の \begin{abstract} と似せる)
  const isAbstract = envName === "abstract";

  return (
    <div
      className={`container-block my-4 overflow-hidden ${isAbstract ? "mx-6 px-4 py-2 border-l-2 border-foreground/15" : ""}`}
      data-env={envName}
    >
      {titleSegment && (
        <ContentEditableBlock
          segment={titleSegment}
          latex={latex}
          onCommit={onContainerTitleCommit}
          tag="h4"
          className="container-block-title m-0"
        />
      )}
      {!titleSegment && defaultLabel && (
        <h4 className="container-block-title m-0 text-sm font-semibold text-foreground/70 uppercase tracking-wide">
          {defaultLabel}
        </h4>
      )}
      <div className="container-block-body">
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

// ─────────────────────────────────────
// TocRenderer — \tableofcontents を展開して章節の一覧を描画する。
// エントリは parser 側で collectTocEntries によって JSON として meta に詰められている。
// ─────────────────────────────────────

function TocRenderer({ segment }: { segment: Segment }) {
  const { locale } = useI18n();
  const label = locale === "en" ? "Contents" : "目次";
  let entries: Array<{ level: number; text: string; starred: boolean }> = [];
  try {
    const raw = segment.meta?.entries;
    if (raw) entries = JSON.parse(raw);
  } catch {
    entries = [];
  }
  // starred (番号なし) セクションは TOC に出ない (LaTeX の挙動と同じ)
  const visible = entries.filter((e) => !e.starred && e.text.trim() !== "");
  if (visible.length === 0) {
    return (
      <div className="my-6 p-4 rounded border border-dashed border-foreground/15 text-foreground/50 text-sm">
        {label}（章節が見つかりません）
      </div>
    );
  }
  return (
    <nav className="my-6 p-4 rounded border border-foreground/15 bg-foreground/[0.015]" aria-label={label}>
      <h3 className="text-lg font-bold text-foreground mb-3 border-b border-foreground/10 pb-1">{label}</h3>
      <ol className="space-y-1 list-none pl-0 m-0">
        {visible.map((entry, idx) => (
          <li
            key={idx}
            className="flex items-baseline gap-3 text-foreground/85"
            style={{ paddingLeft: `${(entry.level - 1) * 1.25}rem` }}
          >
            <span className="flex-1 truncate">
              {entry.text}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

// ─────────────────────────────────────
// VSpaceRenderer — \vspace / \smallskip / \medskip / \bigskip を可視スペースとして描画。
// ─────────────────────────────────────

function VSpaceRenderer({ segment }: { segment: Segment }) {
  const size = segment.meta?.size ?? "medskip";
  let height = "0.8rem";
  if (size === "smallskip") height = "0.4rem";
  else if (size === "medskip") height = "0.8rem";
  else if (size === "bigskip") height = "1.6rem";
  else if (size === "custom") {
    const amount = segment.meta?.amount ?? "";
    height = cssLength(amount) || "0.8rem";
  }
  return <div aria-hidden="true" style={{ height }} />;
}

// ─────────────────────────────────────
// PageBreakRenderer — \newpage / \clearpage / \pagebreak を可視の改ページマーカに。
// ─────────────────────────────────────

function PageBreakRenderer({ segment }: { segment: Segment }) {
  void segment;
  const { locale } = useI18n();
  const label = locale === "en" ? "Page break" : "改ページ";
  return (
    <div className="my-6 flex items-center gap-3 select-none" aria-label={label}>
      <div className="flex-1 border-t border-dashed border-foreground/20" />
      <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40">
        {label}
      </span>
      <div className="flex-1 border-t border-dashed border-foreground/20" />
    </div>
  );
}

// ─────────────────────────────────────
// BibliographyRenderer — \begin{thebibliography}{N}...\end{thebibliography}
// 各 \bibitem{key} を番号付きエントリとして描画する。
// ─────────────────────────────────────

interface BibliographyRendererProps {
  segment: Segment;
  latex: string;
  applyRangeEdit: (range: Range, snippet: string) => void;
}

function BibliographyRenderer({ segment, latex, applyRangeEdit }: BibliographyRendererProps) {
  const { locale } = useI18n();
  const label = locale === "en" ? "References" : "参考文献";
  return (
    <section className="my-8" aria-label={label}>
      <h3 className="text-xl font-semibold text-foreground/90 border-b border-foreground/10 pb-1 mb-3">
        {label}
      </h3>
      <ol className="list-none pl-0 space-y-2 m-0">
        {(segment.children ?? []).map((child, idx) => {
          const index = child.meta?.bibIndex ?? String(idx + 1);
          const bodyStart = Number(child.meta?.bodyStart);
          const bodyEnd = Number(child.meta?.bodyEnd);
          const onItemCommit = (el: HTMLElement) => {
            const newBody = serializeContentEditableDOM(el);
            if (newBody.trim() === child.body.trim()) return;
            if (Number.isFinite(bodyStart) && Number.isFinite(bodyEnd)) {
              applyRangeEdit({ start: bodyStart, end: bodyEnd }, newBody);
              return;
            }
            applyRangeEdit(child.range, newBody);
          };
          return (
            <li key={child.id} className="flex items-baseline gap-3 text-foreground/85">
              <span className="flex-none text-foreground/55 tabular-nums">[{index}]</span>
              <ContentEditableBlock
                segment={child}
                latex={latex}
                onCommit={onItemCommit}
                tag="p"
                className="flex-1 m-0 leading-snug"
              />
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ─────────────────────────────────────
// TitleBlockRenderer — \maketitle を可視化する
//
// プリアンブルの \title / \subtitle / \author / \date を抽出し、
// 大きい見出し + 小さい補助行としてページ頭に表示する。
// 各フィールドは自分自身の preamble 上の range に対して range-edit でコミットする。
// ─────────────────────────────────────
interface TitleBlockRendererProps {
  segment: Segment;
  latex: string;
  applyRangeEdit: (range: Range, snippet: string) => void;
}

function TitleBlockRenderer({ segment, latex, applyRangeEdit }: TitleBlockRendererProps) {
  const fieldRange = (startKey: string, endKey: string): Range | null => {
    const s = Number(segment.meta?.[startKey]);
    const e = Number(segment.meta?.[endKey]);
    if (!Number.isFinite(s) || !Number.isFinite(e) || s < 0 || e < s) return null;
    return { start: s, end: e };
  };

  const titleRange = fieldRange("titleStart", "titleEnd");
  const subtitleRange = fieldRange("subtitleStart", "subtitleEnd");
  const authorRange = fieldRange("authorStart", "authorEnd");
  const instituteRange = fieldRange("instituteStart", "instituteEnd");
  const dateRange = fieldRange("dateStart", "dateEnd");

  // フィールド範囲から、擬似 paragraph セグメントを作って ContentEditableBlock に渡す。
  // 日付の `\today` 等は「templateCmd」インライン or plain text として渡るだけなので
  // 表示は控えめに。
  const makeFieldSegment = (range: Range, idSuffix: string): Segment => ({
    id: segment.id + idSuffix,
    kind: "paragraph",
    range,
    body: latex.slice(range.start, range.end),
    inlines: extractInlines(latex, range.start, range.end),
  });

  const onFieldCommit = (range: Range) => (el: HTMLElement) => {
    const newBody = serializeContentEditableDOM(el);
    if (newBody.trim() === latex.slice(range.start, range.end).trim()) return;
    applyRangeEdit(range, newBody);
  };

  // いずれのフィールドも取れなかった場合 (raw maketitle だけが残っていた場合) は描画しない
  if (!titleRange && !subtitleRange && !authorRange && !instituteRange && !dateRange) return null;

  return (
    <div className="my-8 text-center space-y-2">
      {titleRange && (
        <ContentEditableBlock
          segment={makeFieldSegment(titleRange, "-title")}
          latex={latex}
          onCommit={onFieldCommit(titleRange)}
          tag="h1"
          className="text-3xl font-bold text-foreground leading-tight m-0"
        />
      )}
      {subtitleRange && (
        <ContentEditableBlock
          segment={makeFieldSegment(subtitleRange, "-subtitle")}
          latex={latex}
          onCommit={onFieldCommit(subtitleRange)}
          tag="h2"
          className="text-xl font-semibold text-foreground/80 m-0"
        />
      )}
      {authorRange && (
        <ContentEditableBlock
          segment={makeFieldSegment(authorRange, "-author")}
          latex={latex}
          onCommit={onFieldCommit(authorRange)}
          tag="p"
          className="text-base text-foreground/75 m-0 mt-3"
        />
      )}
      {instituteRange && (
        <ContentEditableBlock
          segment={makeFieldSegment(instituteRange, "-institute")}
          latex={latex}
          onCommit={onFieldCommit(instituteRange)}
          tag="p"
          className="text-sm text-foreground/65 m-0"
        />
      )}
      {dateRange && (
        <ContentEditableBlock
          segment={makeFieldSegment(dateRange, "-date")}
          latex={latex}
          onCommit={onFieldCommit(dateRange)}
          tag="p"
          className="text-sm text-foreground/55 m-0"
        />
      )}
    </div>
  );
}

function RawPlaceholder({ segment }: { segment: Segment }) {
  const isStandalone = segment.meta?.isStandalone === "true";
  const isEnv = segment.meta?.isEnvironment === "true";
  const figureId = segment.meta?.figureId;

  // \maketitle / \tableofcontents / \newpage / `\\[10mm]` 等は完全に非表示。
  if (isStandalone) return null;

  // 図アセットライブラリ由来の図は、サーバが生成した PNG プレビューで
  // 置き換える。KaTeX は TikZ をレンダリングできないため、この経路だけが
  // 「生 LaTeX を画面に出さない」原則を守りつつ図を可視化する方法。
  if (isEnv && figureId) {
    return (
      <FigureAssetPreview figureId={figureId} />
    );
  }

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
// FigureAssetPreview — サーバの /api/figures/{id}/preview.png を img で表示。
// 図アセットライブラリ由来のブロックは必ずこの経路を通る。
// ─────────────────────────────────────
function FigureAssetPreview({ figureId }: { figureId: string }) {
  const [errored, setErrored] = useState(false);
  const src = `/api/figures/${encodeURIComponent(figureId)}/preview.png`;
  if (errored) {
    return (
      <div className="my-3 px-3 py-2 rounded border border-dashed border-foreground/15 bg-foreground/[0.02] inline-flex items-center gap-2 text-foreground/50 text-[11.5px]">
        <span className="font-mono text-[10px]">❖</span>
        <span>図 (プレビュー取得失敗: {figureId})</span>
      </div>
    );
  }
  return (
    <div
      className="my-3 flex flex-col items-center gap-1"
      contentEditable={false}
      data-figure-id={figureId}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={figureId}
        loading="lazy"
        draggable={false}
        onError={() => setErrored(true)}
        className="max-w-full max-h-[360px] object-contain select-none bg-white rounded border border-foreground/10"
      />
      <span className="text-[10px] text-foreground/40 font-mono tracking-wide">
        {figureId}
      </span>
    </div>
  );
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

/** テキスト系 LaTeX コマンドの Unicode 置換テーブル。
 *  「テキストモードの装飾コマンド」を visible body 内で見つけたとき、生 LaTeX を出さずに
 *  Unicode に置き換えて表示する。 */
// textbackslash / textbar / textless / textgreater は latex-segments.ts 側で
// templateCmd (noarg) として round-trip するため、ここでは Unicode 置換しない。
// renderRichInlineHTML がラップ inline の body 文字列をパースし直すときは
// 代わりにこの表で noarg templateCmd span を組み立てる。
const INLINE_LATEX_ESCAPE_CHARS: Record<string, string> = {
  textbackslash: "\u005C",
  textless: "<",
  textgreater: ">",
  textbar: "|",
};

const TEXT_CMD_UNICODE: Record<string, string> = {
  textbullet: "\u2022",
  textquoteleft: "\u2018",
  textquoteright: "\u2019",
  textquotedblleft: "\u201C",
  textquotedblright: "\u201D",
  textregistered: "\u00AE",
  texttrademark: "\u2122",
  textcopyright: "\u00A9",
  textdegree: "\u00B0",
  textperiodcentered: "\u00B7",
  textellipsis: "\u2026",
  textendash: "\u2013",
  textemdash: "\u2014",
  bullet: "\u2022",
  cdot: "\u00B7",
  cdots: "\u22EF",
  ldots: "\u2026",
  dots: "\u2026",
  square: "\u25A1",
  blacksquare: "\u25A0",
  bigstar: "\u2605",
  star: "\u2606",
  circ: "\u25CB",
  bullet2: "\u2022",
  triangle: "\u25B3",
  blacktriangleright: "\u25B6",
  blacktriangle: "\u25B2",
  P: "\u00B6",
  S: "\u00A7",
  ldots2: "\u2026",
};

/** \textcircled{X} を Unicode 〇 + X 風に置換する (簡易) */
function processTextCircled(body: string): string {
  return body.replace(/\\textcircled\s*\{([^{}]*)\}/g, (_m, x) => {
    const t = (x ?? "").trim();
    if (/^[1-9]$/.test(t)) {
      return String.fromCharCode(0x2460 + parseInt(t, 10) - 1);
    }
    if (t === "0") return "\u24EA";
    if (/^[A-Z]$/.test(t)) return String.fromCharCode(0x24B6 + t.charCodeAt(0) - 65);
    if (/^[a-z]$/.test(t)) return String.fromCharCode(0x24D0 + t.charCodeAt(0) - 97);
    return `(${t})`;
  });
}

/** リッチな inline テキスト (sized/colored/framed/templateCmd の body) を HTML 化する。
 *  ・`$..$` / `\(..\)` の数式を math chip に変換 (KaTeX 経由、生 LaTeX を出さない)
 *  ・既知のテキストモード LaTeX コマンドを Unicode に置換
 *  ・残る `\cmd{...}` 形のテンプレ独自コマンドは中身だけ取り出す (簡易展開)
 *  ・最後に escape して安全な HTML を返す */
function renderRichInlineHTML(body: string): string {
  if (!body) return "";
  let s = body;
  // \textcircled{X} → 丸数字 / 丸文字
  s = processTextCircled(s);
  // \unicode{0xNNNN} → 文字 (KaTeX が \unicode をマクロ展開する形だが念のため)
  s = s.replace(/\\unicode\{0x([0-9a-fA-F]+)\}/g, (_m, hex) => String.fromCodePoint(parseInt(hex, 16)));
  // 既知のテキストモード命令 → Unicode
  s = s.replace(/\\([a-zA-Z@]+)(?![a-zA-Z@])/g, (m, name) => {
    const repl = TEXT_CMD_UNICODE[name];
    if (repl !== undefined) return repl;
    return m;
  });
  // 段階的処理: $..$ / \(..\) 数式範囲を抽出して math chip に置換
  // 残った文字列は escapeHtml で安全化
  const parts: string[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    // \( ... \)
    if (ch === "\\" && s[i + 1] === "(") {
      const close = s.indexOf("\\)", i + 2);
      if (close !== -1) {
        const math = s.slice(i + 2, close);
        parts.push(renderInlineMathOrPlaceholder(math));
        i = close + 2;
        continue;
      }
    }
    // $..$
    if (ch === "$" && s[i + 1] !== "$") {
      let j = i + 1;
      while (j < s.length) {
        if (s[j] === "\\" && j + 1 < s.length) { j += 2; continue; }
        if (s[j] === "$") break;
        j++;
      }
      if (j < s.length && s[j] === "$") {
        const math = s.slice(i + 1, j);
        parts.push(renderInlineMathOrPlaceholder(math));
        i = j + 1;
        continue;
      }
    }
    // 残る `\name{...}` 1引数命令 → 中身だけ
    if (ch === "\\") {
      // \\ (literal line break) → <br data-latex-linebreak> でラウンドトリップ
      if (s[i + 1] === "\\") {
        let cmdEnd = i + 2;
        if (s[cmdEnd] === "*") cmdEnd++;
        if (s[cmdEnd] === "[") {
          let depth = 1;
          let j = cmdEnd + 1;
          while (j < s.length && depth > 0) {
            if (s[j] === "\\" && j + 1 < s.length) { j += 2; continue; }
            if (s[j] === "[") depth++;
            else if (s[j] === "]") depth--;
            j++;
          }
          cmdEnd = j;
        }
        parts.push(`<br data-latex-linebreak="1"/>`);
        i = cmdEnd;
        continue;
      }
      const m = s.slice(i).match(/^\\([a-zA-Z@]+)\s*\{([^{}]*)\}/);
      if (m) {
        // 中身を再帰的に処理 (テキスト + 数式)
        parts.push(renderRichInlineHTML(m[2]));
        i += m[0].length;
        continue;
      }
      // 残る `\name` (引数なし) — 表示特殊文字用のエスケープなら atomic span で round-trip
      const m2 = s.slice(i).match(/^\\([a-zA-Z@]+)/);
      if (m2) {
        const name = m2[1];
        const escapeCh = INLINE_LATEX_ESCAPE_CHARS[name];
        if (escapeCh !== undefined) {
          parts.push(`<span class="latex-tcmd latex-tcmd-${escapeHtml(name)}" data-cmd-name="${escapeHtml(name)}" data-cmd-noarg="1" contenteditable="false">${escapeHtml(escapeCh)}</span>`);
          let step = m2[0].length;
          if (s[i + step] === " ") step++;
          i += step;
          continue;
        }
        i += m2[0].length;
        continue;
      }
    }
    // 通常文字 → 1 文字進めて escape する区間に追加
    let textEnd = i + 1;
    while (
      textEnd < s.length &&
      s[textEnd] !== "\\" &&
      s[textEnd] !== "$"
    ) {
      textEnd++;
    }
    parts.push(escapeHtml(s.slice(i, textEnd)));
    i = textEnd;
  }
  return parts.join("");
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
  const colorMap = getColorMapFor(src);
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
      html += `<span class="latex-fbox" data-fbox-cmd="${escapeHtml(cmdName)}" style="display:inline-block;border:1px solid currentColor;padding:0 0.35em;border-radius:1px;">${renderRichInlineHTML(inline.body)}</span>`;
    } else if (inline.kind === "colored") {
      const color = inline.meta?.color ?? "inherit";
      const css = colorNameToCss(color, colorMap);
      html += `<span class="latex-color" data-color="${escapeHtml(color)}" style="color:${css};">${renderRichInlineHTML(inline.body)}</span>`;
    } else if (inline.kind === "sized") {
      const style = sizedInlineStyle(inline.meta);
      const dataAttrs = Object.entries(inline.meta ?? {})
        .map(([k, v]) => `data-sized-${k}="${escapeHtml(v)}"`)
        .join(" ");
      html += `<span class="latex-sized" ${dataAttrs} style="${style}">${renderRichInlineHTML(inline.body)}</span>`;
    } else if (inline.kind === "templateCmd") {
      const name = inline.meta?.name ?? "text";
      const arg2 = inline.meta?.arg2;
      const block = inline.meta?.block === "1";
      const noarg = inline.meta?.noarg === "1";
      const arg2Attr = arg2 !== undefined ? ` data-cmd-arg2="${escapeHtml(arg2)}"` : "";
      // 引数を取らない値展開コマンド (\today 等) はプレーンテキストの見た目で出し、
      // data-cmd-noarg="1" をマークして serializer 側で `\today` にラウンドトリップする。
      if (noarg) {
        html += `<span class="latex-tcmd latex-tcmd-${escapeHtml(name)}" data-cmd-name="${escapeHtml(name)}" data-cmd-noarg="1" contenteditable="false">${escapeHtml(inline.body)}</span>`;
        continue;
      }
      // ブロックレベルの命令 (\jukutitle / \daimonhead / \chui / \unit / \level / \anslines)
      // は CSS で display:block にして紙面の段組に流し込む
      if (name === "anslines") {
        // \anslines{N} → N 本の罫線
        const n = Math.max(1, Math.min(20, parseInt(inline.body.trim(), 10) || 1));
        const lines = Array.from({ length: n })
          .map(() => `<span class="latex-ans-line"></span>`).join("");
        html += `<span class="latex-tcmd latex-tcmd-anslines" data-cmd-name="anslines" data-cmd-block="1" contenteditable="false" data-cmd-arg1="${escapeHtml(inline.body)}">${lines}</span>`;
      } else if (arg2 !== undefined) {
        html += `<span class="latex-tcmd latex-tcmd-${escapeHtml(name)}" data-cmd-name="${escapeHtml(name)}"${arg2Attr}${block ? ` data-cmd-block="1"` : ""} contenteditable="false"><span class="latex-tcmd-arg1">${renderRichInlineHTML(inline.body)}</span><span class="latex-tcmd-arg2">${renderRichInlineHTML(arg2)}</span></span>`;
      } else {
        html += `<span class="latex-tcmd latex-tcmd-${escapeHtml(name)}" data-cmd-name="${escapeHtml(name)}"${block ? ` data-cmd-block="1"` : ""} contenteditable="false">${renderRichInlineHTML(inline.body)}</span>`;
      }
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
};

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

/** xcolor の model / value を CSS 色文字列に変換する。不明なら null。 */
function colorModelToCss(model: string, value: string): string | null {
  const v = value.trim();
  switch (model.trim()) {
    case "HTML": {
      const hex = v.replace(/\s+/g, "");
      if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex}`;
      if (/^[0-9a-fA-F]{3}$/.test(hex)) return `#${hex}`;
      return null;
    }
    case "RGB": {
      const [r, g, b] = v.split(",").map((s) => parseFloat(s.trim()));
      if ([r, g, b].every((n) => Number.isFinite(n))) {
        return `rgb(${clamp255(r)}, ${clamp255(g)}, ${clamp255(b)})`;
      }
      return null;
    }
    case "rgb": {
      const [r, g, b] = v.split(",").map((s) => parseFloat(s.trim()));
      if ([r, g, b].every((n) => Number.isFinite(n))) {
        return `rgb(${clamp255(r * 255)}, ${clamp255(g * 255)}, ${clamp255(b * 255)})`;
      }
      return null;
    }
    case "gray": {
      const g = parseFloat(v);
      if (Number.isFinite(g)) {
        const c = clamp255(g * 255);
        return `rgb(${c}, ${c}, ${c})`;
      }
      return null;
    }
    case "cmyk": {
      const [c, m, y, k] = v.split(",").map((s) => parseFloat(s.trim()));
      if ([c, m, y, k].every((n) => Number.isFinite(n))) {
        const r = 255 * (1 - c) * (1 - k);
        const g = 255 * (1 - m) * (1 - k);
        const b = 255 * (1 - y) * (1 - k);
        return `rgb(${clamp255(r)}, ${clamp255(g)}, ${clamp255(b)})`;
      }
      return null;
    }
    default:
      return null;
  }
}

/** LaTeX ソースから `\definecolor{name}{model}{value}` を全部拾って name → CSS に畳む。 */
function parseDefinedColors(src: string): Record<string, string> {
  const map: Record<string, string> = {};
  const re = /\\definecolor\s*\{([^}]+)\}\s*\{([^}]+)\}\s*\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const name = m[1].trim();
    const css = colorModelToCss(m[2], m[3]);
    if (css) map[name] = css;
  }
  return map;
}

// 同じ src に対する再パースを避けるためのモジュールレベルキャッシュ (直近 1 件で十分)。
let _colorMapSrc: string | null = null;
let _colorMap: Record<string, string> = {};
function getColorMapFor(src: string): Record<string, string> {
  if (src === _colorMapSrc) return _colorMap;
  _colorMapSrc = src;
  _colorMap = parseDefinedColors(src);
  return _colorMap;
}

/** `red`, `DeepBlue`, `red!50!black`, `jkmain!20` 等を CSS 色に解決する。
 *  mixing は CSS `color-mix(in srgb, ...)` にフォールバックし、base が解決できなければ
 *  currentColor を返して UI を壊さない。 */
function colorNameToCss(name: string, custom?: Record<string, string>): string {
  const trimmed = name.trim();
  if (!trimmed) return "currentColor";
  const resolveBase = (n: string): string | null => {
    const t = n.trim();
    if (!t) return null;
    if (custom && custom[t]) return custom[t];
    if (NAMED_COLORS[t]) return NAMED_COLORS[t];
    return null;
  };
  if (trimmed.includes("!")) {
    const parts = trimmed.split("!").map((p) => p.trim());
    // A!P!B → A を P% と B を (100-P)% で混ぜる
    if (parts.length >= 3) {
      const a = resolveBase(parts[0]);
      const pct = parseFloat(parts[1]);
      const b = resolveBase(parts[2]);
      if (a && b && Number.isFinite(pct)) {
        return `color-mix(in srgb, ${a} ${pct}%, ${b})`;
      }
    }
    // A!P → xcolor のデフォルトで A を P%、残りを white で希釈
    if (parts.length === 2) {
      const a = resolveBase(parts[0]);
      const pct = parseFloat(parts[1]);
      if (a && Number.isFinite(pct)) {
        return `color-mix(in srgb, ${a} ${pct}%, white)`;
      }
    }
    return resolveBase(parts[0]) ?? "currentColor";
  }
  return resolveBase(trimmed) ?? "currentColor";
}

/** `\titleformat{\section}{…}{…}{…}{…}` 等から最初の `\color{X}` / `\textcolor{X}{…}` を拾い、
 *  section / subsection の見出し色として使えるように解決する。未定義なら null。 */
function extractTitleformatColor(
  src: string,
  target: "section" | "subsection",
  colorMap: Record<string, string>,
): string | null {
  const re = new RegExp(`\\\\titleformat\\s*\\{\\\\${target}\\}`, "g");
  const m = re.exec(src);
  if (!m) return null;
  // titleformat 宣言以降の適当な範囲 (~400 文字) を走査して color 指定を探す。
  const tail = src.slice(m.index, m.index + 600);
  const colorMatch =
    tail.match(/\\color\s*\{([^}]+)\}/) ??
    tail.match(/\\textcolor\s*\{([^}]+)\}/);
  if (!colorMatch) return null;
  const resolved = colorNameToCss(colorMatch[1], colorMap);
  return resolved === "currentColor" ? null : resolved;
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

    // テンプレ独自コマンド (\juKey / \jukutitle / \chui / \nlevel / ...)
    if (child.dataset.cmdName) {
      const name = child.dataset.cmdName;
      // 引数を取らないコマンド (\today 等) はそのまま `\name` を吐く
      if (child.dataset.cmdNoarg === "1") {
        result += `\\${name}`;
        continue;
      }
      // arg1 / arg2 構造があるか
      const arg1El = child.querySelector(":scope > .latex-tcmd-arg1");
      const arg2El = child.querySelector(":scope > .latex-tcmd-arg2");
      if (arg1El && arg2El) {
        const a1 = (arg1El.textContent || "").trim();
        const a2 = (arg2El.textContent || "").trim();
        result += `\\${name}{${a1}}{${a2}}`;
      } else {
        // 単一引数。anslines の場合は data-cmd-arg1 を見る
        const arg1Attr = child.dataset.cmdArg1;
        if (arg1Attr !== undefined) {
          result += `\\${name}{${arg1Attr}}`;
        } else {
          result += `\\${name}{${(child.textContent || "").trim()}}`;
        }
      }
      continue;
    }

    if (tag === "strong" || tag === "b") {
      result += `\\textbf{${serializeContentEditableDOM(child)}}`;
      continue;
    }
    if (tag === "em" || tag === "i") {
      result += `\\textit{${serializeContentEditableDOM(child)}}`;
      continue;
    }
    if (tag === "code") {
      result += `\\texttt{${serializeContentEditableDOM(child)}}`;
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
