"use client";

import { create } from "zustand";
import {
  DocumentModel,
  CanvasElement,
  ElementType,
  ElementStyle,
  ElementPosition,
  TemplateType,
  Metadata,
  Page,
  createDefaultDocument,
  createDefaultElement,
} from "@/lib/types";

interface DocumentState {
  document: DocumentModel | null;

  // Undo / redo
  past: DocumentModel[];
  future: DocumentModel[];

  // Actions
  newDocument: (template: TemplateType) => void;
  setDocument: (doc: DocumentModel) => void;
  updateMetadata: (updates: Partial<Metadata>) => void;

  // Page actions
  addPage: () => void;
  deletePage: (pageId: string) => void;
  setCurrentPageIndex: (index: number) => void;

  // Element actions
  addElement: (type: ElementType, pageIndex: number) => void;
  updateElementContent: (pageIndex: number, elementId: string, content: Partial<CanvasElement["content"]>) => void;
  updateElementPosition: (pageIndex: number, elementId: string, position: Partial<ElementPosition>) => void;
  updateElementStyle: (pageIndex: number, elementId: string, style: Partial<ElementStyle>) => void;
  deleteElement: (pageIndex: number, elementId: string) => void;
  duplicateElement: (pageIndex: number, elementId: string) => void;
  bringForward: (pageIndex: number, elementId: string) => void;
  sendBackward: (pageIndex: number, elementId: string) => void;

  // Undo / redo
  undo: () => void;
  redo: () => void;
  _pushHistory: () => void;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  document: null,
  past: [],
  future: [],

  _pushHistory: () => {
    const { document, past } = get();
    if (!document) return;
    const snapshot = JSON.parse(JSON.stringify(document));
    set({
      past: [...past.slice(-49), snapshot],
      future: [],
    });
  },

  newDocument: (template) => {
    set({ document: createDefaultDocument(template), past: [], future: [] });
  },

  setDocument: (doc) => {
    set({ document: doc, past: [], future: [] });
  },

  updateMetadata: (updates) => {
    const { document, _pushHistory } = get();
    if (!document) return;
    _pushHistory();
    set({
      document: {
        ...document,
        metadata: { ...document.metadata, ...updates },
      },
    });
  },

  addPage: () => {
    const { document, _pushHistory } = get();
    if (!document) return;
    _pushHistory();
    const newPage: Page = { id: crypto.randomUUID(), elements: [] };
    set({
      document: {
        ...document,
        pages: [...document.pages, newPage],
      },
    });
  },

  deletePage: (pageId) => {
    const { document, _pushHistory } = get();
    if (!document || document.pages.length <= 1) return;
    _pushHistory();
    set({
      document: {
        ...document,
        pages: document.pages.filter((p) => p.id !== pageId),
      },
    });
  },

  setCurrentPageIndex: () => {
    // Handled by UI store
  },

  addElement: (type, pageIndex) => {
    const { document, _pushHistory } = get();
    if (!document) return;
    _pushHistory();
    const page = document.pages[pageIndex];
    if (!page) return;
    const el = createDefaultElement(type, page.elements.length);
    const newPages = [...document.pages];
    newPages[pageIndex] = {
      ...page,
      elements: [...page.elements, el],
    };
    set({ document: { ...document, pages: newPages } });
  },

  updateElementContent: (pageIndex, elementId, content) => {
    const { document } = get();
    if (!document) return;
    const newPages = [...document.pages];
    const page = newPages[pageIndex];
    if (!page) return;
    newPages[pageIndex] = {
      ...page,
      elements: page.elements.map((el) =>
        el.id === elementId
          ? { ...el, content: { ...el.content, ...content } as CanvasElement["content"] }
          : el,
      ),
    };
    set({ document: { ...document, pages: newPages } });
  },

  updateElementPosition: (pageIndex, elementId, position) => {
    const { document } = get();
    if (!document) return;
    const newPages = [...document.pages];
    const page = newPages[pageIndex];
    if (!page) return;
    newPages[pageIndex] = {
      ...page,
      elements: page.elements.map((el) =>
        el.id === elementId
          ? { ...el, position: { ...el.position, ...position } }
          : el,
      ),
    };
    set({ document: { ...document, pages: newPages } });
  },

  updateElementStyle: (pageIndex, elementId, style) => {
    const { document, _pushHistory } = get();
    if (!document) return;
    _pushHistory();
    const newPages = [...document.pages];
    const page = newPages[pageIndex];
    if (!page) return;
    newPages[pageIndex] = {
      ...page,
      elements: page.elements.map((el) =>
        el.id === elementId
          ? { ...el, style: { ...el.style, ...style } }
          : el,
      ),
    };
    set({ document: { ...document, pages: newPages } });
  },

  deleteElement: (pageIndex, elementId) => {
    const { document, _pushHistory } = get();
    if (!document) return;
    _pushHistory();
    const newPages = [...document.pages];
    const page = newPages[pageIndex];
    if (!page) return;
    newPages[pageIndex] = {
      ...page,
      elements: page.elements.filter((el) => el.id !== elementId),
    };
    set({ document: { ...document, pages: newPages } });
  },

  duplicateElement: (pageIndex, elementId) => {
    const { document, _pushHistory } = get();
    if (!document) return;
    _pushHistory();
    const page = document.pages[pageIndex];
    if (!page) return;
    const el = page.elements.find((e) => e.id === elementId);
    if (!el) return;
    const dup: CanvasElement = {
      ...JSON.parse(JSON.stringify(el)),
      id: crypto.randomUUID(),
      position: { ...el.position, x: el.position.x + 5, y: el.position.y + 5 },
      zIndex: page.elements.length + 1,
    };
    const newPages = [...document.pages];
    newPages[pageIndex] = { ...page, elements: [...page.elements, dup] };
    set({ document: { ...document, pages: newPages } });
  },

  bringForward: (pageIndex, elementId) => {
    const { document } = get();
    if (!document) return;
    const page = document.pages[pageIndex];
    if (!page) return;
    const maxZ = Math.max(...page.elements.map((e) => e.zIndex));
    const newPages = [...document.pages];
    newPages[pageIndex] = {
      ...page,
      elements: page.elements.map((el) =>
        el.id === elementId ? { ...el, zIndex: maxZ + 1 } : el,
      ),
    };
    set({ document: { ...document, pages: newPages } });
  },

  sendBackward: (pageIndex, elementId) => {
    const { document } = get();
    if (!document) return;
    const page = document.pages[pageIndex];
    if (!page) return;
    const minZ = Math.min(...page.elements.map((e) => e.zIndex));
    const newPages = [...document.pages];
    newPages[pageIndex] = {
      ...page,
      elements: page.elements.map((el) =>
        el.id === elementId ? { ...el, zIndex: Math.max(0, minZ - 1) } : el,
      ),
    };
    set({ document: { ...document, pages: newPages } });
  },

  undo: () => {
    const { past, document } = get();
    if (past.length === 0 || !document) return;
    const previous = past[past.length - 1];
    set({
      document: previous,
      past: past.slice(0, -1),
      future: [JSON.parse(JSON.stringify(document)), ...get().future],
    });
  },

  redo: () => {
    const { future, document } = get();
    if (future.length === 0 || !document) return;
    const next = future[0];
    set({
      document: next,
      past: [...get().past, JSON.parse(JSON.stringify(document!))],
      future: future.slice(1),
    });
  },
}));
