"use client";

import { create } from "zustand";
import { ChatMessage, DocumentPatch } from "@/lib/types";

export type PaperSize = "a4" | "a3" | "b5" | "letter";
export type GuideContext = "none" | "math" | "heading" | "list" | "table" | "code" | "general";

export interface LastAIAction {
  description: string;
  blockIds: string[];
  opCounts: { added: number; updated: number; deleted: number; reordered: number };
  timestamp: number;
}

interface UIState {
  selectedBlockId: string | null;
  editingBlockId: string | null;
  isGenerating: boolean;
  zoom: number;
  paperSize: PaperSize;
  isMathEditing: boolean;
  activeGuideContext: GuideContext;

  // AI action tracking
  lastAIAction: LastAIAction | null;
  isOutlineOpen: boolean;

  // Global command palette
  showGlobalPalette: boolean;

  // AI Chat state (in-memory only, not persisted)
  chatMessages: ChatMessage[];
  pendingPatch: DocumentPatch | null;
  isChatLoading: boolean;
  streamingMessageId: string | null;

  selectBlock: (id: string | null) => void;
  setEditingBlock: (id: string | null) => void;
  setMathEditing: (v: boolean) => void;
  setActiveGuideContext: (ctx: GuideContext) => void;
  setGenerating: (v: boolean) => void;
  setZoom: (v: number) => void;
  setPaperSize: (s: PaperSize) => void;

  // AI action actions
  setLastAIAction: (action: LastAIAction | null) => void;
  clearLastAIAction: () => void;
  toggleOutline: () => void;
  setOutlineOpen: (v: boolean) => void;

  setGlobalPalette: (v: boolean) => void;

  // Chat actions
  addChatMessage: (msg: ChatMessage) => void;
  updateChatMessage: (id: string, updates: Partial<ChatMessage>) => void;
  setPendingPatch: (patch: DocumentPatch | null) => void;
  setChatLoading: (v: boolean) => void;
  clearChat: () => void;
  updateStreamingContent: (id: string, content: string) => void;
  setStreamingComplete: (id: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedBlockId: null,
  editingBlockId: null,
  isGenerating: false,
  zoom: 1,
  paperSize: "a4",
  isMathEditing: false,
  activeGuideContext: "none",
  lastAIAction: null,
  isOutlineOpen: false,
  showGlobalPalette: false,
  chatMessages: [],
  pendingPatch: null,
  isChatLoading: false,
  streamingMessageId: null,

  selectBlock: (id) => set(
    id === null
      ? { selectedBlockId: null, editingBlockId: null }
      : { selectedBlockId: id }
  ),
  setEditingBlock: (id) => set({ editingBlockId: id, selectedBlockId: id }),
  setMathEditing: (v) => set({ isMathEditing: v }),
  setActiveGuideContext: (ctx) => set({ activeGuideContext: ctx }),
  setGenerating: (v) => set({ isGenerating: v }),
  setZoom: (v) => set({ zoom: Math.max(0.5, Math.min(2, v)) }),
  setPaperSize: (s) => set({ paperSize: s }),

  setGlobalPalette: (v) => set({ showGlobalPalette: v }),
  setLastAIAction: (action) => set({ lastAIAction: action }),
  clearLastAIAction: () => set({ lastAIAction: null }),
  toggleOutline: () => set((s) => ({ isOutlineOpen: !s.isOutlineOpen })),
  setOutlineOpen: (v) => set({ isOutlineOpen: v }),

  addChatMessage: (msg) => set((state) => ({ chatMessages: [...state.chatMessages, msg] })),
  updateChatMessage: (id, updates) => set((state) => ({
    chatMessages: state.chatMessages.map((m) => m.id === id ? { ...m, ...updates } : m),
  })),
  setPendingPatch: (patch) => set({ pendingPatch: patch }),
  setChatLoading: (v) => set({ isChatLoading: v }),
  clearChat: () => set({ chatMessages: [], pendingPatch: null, streamingMessageId: null }),
  updateStreamingContent: (id, content) => set((state) => ({
    chatMessages: state.chatMessages.map((m) =>
      m.id === id ? { ...m, content: m.content + content } : m
    ),
  })),
  setStreamingComplete: (id) => set((state) => ({
    chatMessages: state.chatMessages.map((m) =>
      m.id === id ? { ...m, isStreaming: false } : m
    ),
    streamingMessageId: null,
  })),
}));
