"use client";

import { create } from "zustand";
import { Block, BlockContent, BlockStyle, BlockType, DocumentModel, DocumentSettings, DocumentMetadata, AdvancedHooks, DocumentPatch, PaperDesign, createBlock, createDefaultDocument, DEFAULT_BLOCK_STYLE } from "@/lib/types";

// ── AIパッチのブロック正規化 ──
// AIが返すブロックは必須フィールドが欠落していることがある。
// レンダラーが "Hundefined" 等を表示しないよう、ここで補完する。

const CONTENT_DEFAULTS: Record<string, () => BlockContent> = {
  heading:   () => ({ type: "heading", text: "", level: 2 }),
  paragraph: () => ({ type: "paragraph", text: "" }),
  math:      () => ({ type: "math", latex: "", displayMode: true }),
  list:      () => ({ type: "list", style: "bullet" as const, items: [""] }),
  table:     () => ({ type: "table", headers: ["列1", "列2"], rows: [["", ""]] }),
  image:     () => ({ type: "image", url: "", caption: "" }),
  divider:   () => ({ type: "divider", style: "solid" as const }),
  code:      () => ({ type: "code", language: "", code: "" }),
  quote:     () => ({ type: "quote", text: "" }),
  circuit:   () => ({ type: "circuit", code: "", caption: "" }),
  diagram:   () => ({ type: "diagram", code: "", diagramType: "flowchart", caption: "" }),
  chemistry: () => ({ type: "chemistry", formula: "", displayMode: true }),
  chart:     () => ({ type: "chart", chartType: "line" as const, code: "", caption: "" }),
  latex:     () => ({ type: "latex", code: "", caption: "" }),
};

/**
 * 段落/見出し本文に AI が混入させがちな「レイアウト系の生 LaTeX コマンド」を検出。
 * これらは段落テキストとして表示されてもコンパイルされず、生文字列として残ってしまうため
 * latex ブロックに振り分ける必要がある。
 */
const RAW_LATEX_COMMAND_RE =
  /\\(?:vspace|hspace|vfill|hfill|newpage|clearpage|pagebreak|noindent|indent|par|bigskip|medskip|smallskip|linebreak|nolinebreak|hrule|vrule|rule|baselineskip|parskip|setlength|addtolength|begin|end|centering|raggedright|raggedleft|columnbreak|allowbreak|hphantom|vphantom|phantom)\b/;

/**
 * テキスト全体が「ほぼ生 LaTeX」かどうか判定。
 *  - 1個でも上記コマンドを含み、かつ
 *  - $...$ で囲まれていない箇所にコマンドがある
 * 場合に true。
 */
function isRawLatexText(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  // $...$ の中身を取り除いた残りでコマンドを探す
  const stripped = text.replace(/\$[^$]*\$/g, "");
  return RAW_LATEX_COMMAND_RE.test(stripped);
}

function normalizeAIBlock(raw: Block): Block {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawAny = raw as any;
  const id = rawAny.id || crypto.randomUUID();

  // style が欠落 or 不完全な場合はデフォルトで補完
  const style: BlockStyle = {
    ...DEFAULT_BLOCK_STYLE,
    ...(rawAny.style && typeof rawAny.style === "object" ? rawAny.style : {}),
  };

  // content が無い or type が無い場合の処理
  let content = rawAny.content;
  if (!content || typeof content !== "object" || !("type" in content)) {
    // フラット形式: { id, type: "heading", text: "...", level: 2, style: {...} }
    // → content を再構成する
    if (rawAny.type && typeof rawAny.type === "string") {
      const metaKeys = new Set(["id", "style"]);
      const contentObj: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rawAny)) {
        if (!metaKeys.has(k)) contentObj[k] = v;
      }
      content = contentObj;
    } else {
      content = { type: "paragraph", text: "" };
    }
  }

  let btype = (content as { type: string }).type;

  // ── 救済: paragraph / quote / heading に生 LaTeX を入れられた場合は latex ブロックに変換 ──
  // 例) AI が paragraph.text に "\vspace{1.5cm}" だけを入れてくるケース
  if ((btype === "paragraph" || btype === "quote" || btype === "heading")) {
    const c = content as { type: string; text?: string };
    if (typeof c.text === "string" && isRawLatexText(c.text)) {
      content = { type: "latex", code: c.text.trim(), caption: "" };
      btype = "latex";
    }
  }

  const defaults = CONTENT_DEFAULTS[btype]?.();

  if (defaults) {
    // defaults の全キーが content に存在することを保証
    content = { ...defaults, ...content } as BlockContent;
  }

  // math ブロック → paragraph に変換（旧フォーマット後方互換）
  // $$...$$ = display math, $...$ = inline math として paragraph.text に変換する
  if (btype === "math") {
    const mc = content as unknown as { type: "math"; latex: string; displayMode?: boolean };
    let latex = (typeof mc.latex === "string" ? mc.latex : "").trim();
    // すでに $...$ で囲まれていたら外す
    if (latex.startsWith("$$") && latex.endsWith("$$")) latex = latex.slice(2, -2).trim();
    else if (latex.startsWith("$") && latex.endsWith("$")) latex = latex.slice(1, -1).trim();
    // displayMode のデフォルトは true（段落として独立した数式）
    const isDisplay = mc.displayMode !== false;
    content = {
      type: "paragraph",
      text: isDisplay ? `$$${latex}$$` : `$${latex}$`,
    };
    btype = "paragraph";
  }

  return { id, content: content as BlockContent, style };
}

interface DocumentState {
  document: DocumentModel | null;

  // Document management
  setDocument: (doc: DocumentModel) => void;
  clearDocument: () => void;
  initBlankDocument: () => void;
  updateMetadata: (updates: Partial<DocumentMetadata>) => void;
  updateSettings: (updates: Partial<DocumentSettings>) => void;

  // Block CRUD
  addBlock: (type: BlockType, index?: number) => string;
  addBlockWithContent: (block: Block, index?: number) => void;
  deleteBlock: (blockId: string) => void;
  duplicateBlock: (blockId: string) => void;
  moveBlock: (blockId: string, direction: "up" | "down") => void;
  reorderToIndex: (blockId: string, toIndex: number) => void;
  updateBlockContent: (blockId: string, updates: Partial<BlockContent>) => void;
  updateBlockStyle: (blockId: string, updates: Partial<BlockStyle>) => void;

  // Block type conversion (slash command palette — history-tracked)
  convertBlock: (blockId: string, content: BlockContent) => void;

  // AI Document Patches
  applyPatch: (patch: DocumentPatch) => void;

  // Advanced Mode (上級者モード)
  updateAdvanced: (updates: Partial<AdvancedHooks>) => void;
  toggleAdvancedMode: () => void;

  // Undo/Redo
  _pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  past: DocumentModel[];
  future: DocumentModel[];
}

const MAX_HISTORY = 50;

export const useDocumentStore = create<DocumentState>((set, get) => ({
  document: null,
  past: [],
  future: [],

  setDocument: (doc) => set({ document: doc, past: [], future: [] }),
  clearDocument: () => set({ document: null, past: [], future: [] }),
  initBlankDocument: () => {
    const { document } = get();
    if (document) return; // already have a document
    set({ document: createDefaultDocument("blank", []), past: [], future: [] });
  },

  updateMetadata: (updates) => {
    const { document } = get();
    if (!document) return;
    set({ document: { ...document, metadata: { ...document.metadata, ...updates } } });
  },

  updateSettings: (updates) => {
    const { document } = get();
    if (!document) return;
    set({ document: { ...document, settings: { ...document.settings, ...updates } } });
  },

  _pushHistory: () => {
    const { document, past } = get();
    if (!document) return;
    const snap = JSON.parse(JSON.stringify(document));
    set({ past: [...past.slice(-(MAX_HISTORY - 1)), snap], future: [] });
  },

  addBlock: (type, index) => {
    const { document, _pushHistory } = get();
    if (!document) return "";
    _pushHistory();
    const block = createBlock(type);
    const blocks = [...document.blocks];
    const insertAt = index !== undefined ? index : blocks.length;
    blocks.splice(insertAt, 0, block);
    set({ document: { ...document, blocks } });
    return block.id;
  },

  addBlockWithContent: (block, index) => {
    const { document, _pushHistory } = get();
    if (!document) return;
    _pushHistory();
    const blocks = [...document.blocks];
    const insertAt = index !== undefined ? index : blocks.length;
    blocks.splice(insertAt, 0, block);
    set({ document: { ...document, blocks } });
  },

  deleteBlock: (blockId) => {
    const { document, _pushHistory } = get();
    if (!document) return;
    _pushHistory();
    const blocks = document.blocks.filter((b) => b.id !== blockId);
    set({ document: { ...document, blocks } });
  },

  duplicateBlock: (blockId) => {
    const { document, _pushHistory } = get();
    if (!document) return;
    _pushHistory();
    const idx = document.blocks.findIndex((b) => b.id === blockId);
    if (idx === -1) return;
    const original = document.blocks[idx];
    const copy: Block = JSON.parse(JSON.stringify(original));
    copy.id = crypto.randomUUID();
    const blocks = [...document.blocks];
    blocks.splice(idx + 1, 0, copy);
    set({ document: { ...document, blocks } });
  },

  moveBlock: (blockId, direction) => {
    const { document, _pushHistory } = get();
    if (!document) return;
    const blocks = [...document.blocks];
    const idx = blocks.findIndex((b) => b.id === blockId);
    if (idx === -1) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= blocks.length) return;
    _pushHistory();
    [blocks[idx], blocks[newIdx]] = [blocks[newIdx], blocks[idx]];
    set({ document: { ...document, blocks } });
  },

  reorderToIndex: (blockId, toIndex) => {
    const { document, _pushHistory } = get();
    if (!document) return;
    const blocks = [...document.blocks];
    const from = blocks.findIndex((b) => b.id === blockId);
    if (from === -1 || from === toIndex) return;
    _pushHistory();
    const [moved] = blocks.splice(from, 1);
    const adjustedTo = from < toIndex ? toIndex - 1 : toIndex;
    blocks.splice(adjustedTo, 0, moved);
    set({ document: { ...document, blocks } });
  },

  updateBlockContent: (blockId, updates) => {
    const { document } = get();
    if (!document) return;
    const blocks = document.blocks.map((b) =>
      b.id === blockId ? { ...b, content: { ...b.content, ...updates } as BlockContent } : b,
    );
    set({ document: { ...document, blocks } });
  },

  updateBlockStyle: (blockId, updates) => {
    const { document } = get();
    if (!document) return;
    const blocks = document.blocks.map((b) =>
      b.id === blockId ? { ...b, style: { ...b.style, ...updates } } : b,
    );
    set({ document: { ...document, blocks } });
  },

  convertBlock: (blockId, content) => {
    const { document, _pushHistory } = get();
    if (!document) return;
    _pushHistory();
    const blocks = document.blocks.map((b) =>
      b.id === blockId ? { ...b, content } : b
    );
    set({ document: { ...document, blocks } });
  },

  applyPatch: (patch) => {
    const state = get();
    const currentDoc = state.document;
    if (!currentDoc) return;
    state._pushHistory();

    let blocks = [...currentDoc.blocks];
    let settings = { ...currentDoc.settings };
    let advanced = currentDoc.advanced;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const op of patch.ops as any[]) {
      try {
        if (op.op === "add_block") {
          if (!op.block || typeof op.block !== "object") {
            console.warn("[applyPatch] add_block: missing block object", op);
            continue;
          }
          const newBlock = normalizeAIBlock(op.block as Block);
          if (!newBlock || !newBlock.id) {
            console.warn("[applyPatch] add_block: normalization failed", op.block);
            continue;
          }
          if (op.afterId === null || op.afterId === undefined) {
            // afterId 未指定 → 先頭に追加
            blocks = [newBlock, ...blocks];
          } else {
            const idx = blocks.findIndex((b) => b?.id === op.afterId);
            if (idx === -1) {
              // afterId が見つからない → 末尾に追加（フォールバック）
              blocks = [...blocks, newBlock];
            } else {
              const copy = [...blocks];
              copy.splice(idx + 1, 0, newBlock);
              blocks = copy;
            }
          }
        } else if (op.op === "update_block") {
          if (!op.blockId) continue;
          blocks = blocks.map((b) => {
            if (!b || b.id !== op.blockId) return b;
            const merged = {
              ...b,
              content: op.content ? { ...b.content, ...op.content } as BlockContent : b.content,
              style: op.style ? { ...b.style, ...op.style } : b.style,
            };
            return normalizeAIBlock(merged);
          });
        } else if (op.op === "delete_block") {
          if (!op.blockId) continue;
          blocks = blocks.filter((b) => b?.id !== op.blockId);
        } else if (op.op === "reorder") {
          if (!op.blockIds || !Array.isArray(op.blockIds)) continue;
          const validBlocks = blocks.filter((b): b is Block => !!b && !!b.id);
          const blockMap = new Map(validBlocks.map((b) => [b.id, b]));
          const reordered = op.blockIds.map((id: string) => blockMap.get(id)).filter((b: Block | undefined): b is Block => !!b);
          const mentioned = new Set(op.blockIds as string[]);
          const remainder = validBlocks.filter((b) => !mentioned.has(b.id));
          blocks = [...reordered, ...remainder];
        } else if (op.op === "update_design") {
          const defaultDesign: PaperDesign = { theme: "plain", paperColor: "#ffffff", accentColor: "#4f46e5", headerBorder: false, sectionDividers: false, designPreset: "none" };
          const current = settings.paperDesign || defaultDesign;
          settings = { ...settings, paperDesign: { ...current, ...op.paperDesign } };
        } else if (op.op === "update_advanced") {
          const advData = op.advanced;
          if (advData && typeof advData === "object") {
            const current = currentDoc.advanced || { enabled: false, customPreamble: "", preDocument: "", postDocument: "", customCommands: [] as string[] };
            advanced = { ...current, ...advData, enabled: true };
          }
        }
      } catch (e) {
        console.warn("[applyPatch] Skipping invalid op:", op, e);
        continue;
      }
    }
    // Sanitize: remove any undefined/null blocks
    blocks = blocks.filter((b): b is Block => !!b && !!b.id);

    set({ document: { ...currentDoc, blocks, settings, advanced } });
  },

  updateAdvanced: (updates) => {
    const { document, _pushHistory } = get();
    if (!document) return;
    _pushHistory();
    const current = document.advanced || { enabled: false, customPreamble: "", preDocument: "", postDocument: "", customCommands: [] };
    set({ document: { ...document, advanced: { ...current, ...updates } } });
  },

  toggleAdvancedMode: () => {
    const { document } = get();
    if (!document) return;
    const current = document.advanced || { enabled: false, customPreamble: "", preDocument: "", postDocument: "", customCommands: [] };
    set({ document: { ...document, advanced: { ...current, enabled: !current.enabled } } });
  },

  undo: () => {
    const { past, document, future } = get();
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    set({
      document: prev,
      past: past.slice(0, -1),
      future: document ? [JSON.parse(JSON.stringify(document)), ...future.slice(0, MAX_HISTORY - 1)] : future,
    });
  },

  redo: () => {
    const { future, document, past } = get();
    if (future.length === 0) return;
    const next = future[0];
    set({
      document: next,
      future: future.slice(1),
      past: document ? [...past.slice(-(MAX_HISTORY - 1)), JSON.parse(JSON.stringify(document))] : past,
    });
  },
}));
