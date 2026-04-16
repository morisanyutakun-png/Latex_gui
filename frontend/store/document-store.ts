"use client";

import { create } from "zustand";
import {
  DocumentModel,
  DocumentSettings,
  DocumentMetadata,
  createDefaultDocument,
} from "@/lib/types";
import { getTemplateLatex } from "@/lib/templates";

interface DocumentState {
  document: DocumentModel | null;

  // Document management
  setDocument: (doc: DocumentModel) => void;
  clearDocument: () => void;
  initBlankDocument: () => void;
  updateMetadata: (updates: Partial<DocumentMetadata>) => void;
  updateSettings: (updates: Partial<DocumentSettings>) => void;

  // Raw LaTeX editing
  setLatex: (latex: string) => void;
  /** Apply latex from AI without pushing to history (history is handled by AI flow) */
  applyAiLatex: (latex: string) => void;

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
    if (document) return;
    set({ document: createDefaultDocument("blank", getTemplateLatex("blank")), past: [], future: [] });
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

  setLatex: (latex) => {
    const { document, _pushHistory } = get();
    if (!document) return;
    if (document.latex === latex) return;
    _pushHistory();
    set({ document: { ...document, latex } });
  },

  applyAiLatex: (latex) => {
    const { document, _pushHistory } = get();
    if (!document) return;
    if (document.latex === latex) return;
    _pushHistory();
    set({ document: { ...document, latex } });
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
