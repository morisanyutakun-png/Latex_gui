"use client";

import { create } from "zustand";
import { Block, BlockContent, BlockStyle, BlockType, DocumentModel, DocumentSettings, DocumentMetadata, AdvancedHooks, DocumentPatch, createBlock, createDefaultDocument } from "@/lib/types";

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
    const { document, _pushHistory } = get();
    if (!document) return;
    _pushHistory();

    let blocks = [...document.blocks];

    for (const op of patch.ops) {
      if (op.op === "add_block") {
        const newBlock = { ...op.block, id: op.block.id || crypto.randomUUID() };
        if (op.afterId === null) {
          blocks = [newBlock, ...blocks];
        } else {
          const idx = blocks.findIndex((b) => b.id === op.afterId);
          if (idx === -1) {
            blocks = [...blocks, newBlock];
          } else {
            const copy = [...blocks];
            copy.splice(idx + 1, 0, newBlock);
            blocks = copy;
          }
        }
      } else if (op.op === "update_block") {
        blocks = blocks.map((b) => {
          if (b.id !== op.blockId) return b;
          return {
            ...b,
            content: op.content ? { ...b.content, ...op.content } as BlockContent : b.content,
            style: op.style ? { ...b.style, ...op.style } : b.style,
          };
        });
      } else if (op.op === "delete_block") {
        blocks = blocks.filter((b) => b.id !== op.blockId);
      } else if (op.op === "reorder") {
        const blockMap = new Map(blocks.map((b) => [b.id, b]));
        const reordered = op.blockIds.map((id) => blockMap.get(id)).filter((b): b is Block => !!b);
        const mentioned = new Set(op.blockIds);
        const remainder = blocks.filter((b) => !mentioned.has(b.id));
        blocks = [...reordered, ...remainder];
      }
    }

    set({ document: { ...document, blocks } });
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
