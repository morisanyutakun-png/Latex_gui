"use client";

import { create } from "zustand";
import { ChatMessage } from "@/lib/types";

export type PaperSize = "a4" | "a3" | "b5" | "letter";
export type GuideContext = "none" | "math" | "heading" | "list" | "table" | "code" | "general";

export interface LastAIAction {
  description: string;
  timestamp: number;
}

interface UIState {
  isGenerating: boolean;
  zoom: number;
  zoomFitMode: boolean;
  paperSize: PaperSize;
  isMathEditing: boolean;
  activeGuideContext: GuideContext;

  // AI action tracking
  lastAIAction: LastAIAction | null;

  // AI Chat state (in-memory only, not persisted)
  chatMessages: ChatMessage[];
  isChatLoading: boolean;
  streamingMessageId: string | null;

  // Programmatic chat message (e.g. from 類題作成)
  pendingChatMessage: string | null;

  // OMR (画像/PDF → raw LaTeX) split-view
  omrMode: boolean;
  omrSourceUrl: string | null;
  omrSourceName: string | null;
  omrExtractedLatex: string | null;
  omrProcessing: boolean;
  omrProgress: string;

  setMathEditing: (v: boolean) => void;
  setActiveGuideContext: (ctx: GuideContext) => void;
  setGenerating: (v: boolean) => void;
  setZoom: (v: number) => void;
  setZoomFitMode: (v: boolean) => void;
  setPaperSize: (s: PaperSize) => void;

  setLastAIAction: (action: LastAIAction | null) => void;
  clearLastAIAction: () => void;

  // Chat actions
  addChatMessage: (msg: ChatMessage) => void;
  updateChatMessage: (id: string, updates: Partial<ChatMessage>) => void;
  setChatLoading: (v: boolean) => void;
  clearChat: () => void;
  updateStreamingContent: (id: string, content: string) => void;
  setStreamingComplete: (id: string) => void;
  setPendingChatMessage: (msg: string | null) => void;

  // OMR actions
  openOMR: (sourceUrl: string, sourceName: string) => void;
  closeOMR: () => void;
  setOMRLatex: (latex: string | null) => void;
  setOMRProcessing: (v: boolean) => void;
  setOMRProgress: (msg: string) => void;
  omrTriggerFn: (() => void) | null;
  setOMRTrigger: (fn: (() => void) | null) => void;
  triggerOMR: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isGenerating: false,
  zoom: 1,
  zoomFitMode: true,
  paperSize: "a4",
  isMathEditing: false,
  activeGuideContext: "none",
  lastAIAction: null,
  chatMessages: [],
  isChatLoading: false,
  streamingMessageId: null,
  pendingChatMessage: null,
  omrMode: false,
  omrSourceUrl: null,
  omrSourceName: null,
  omrExtractedLatex: null,
  omrProcessing: false,
  omrProgress: "",

  setMathEditing: (v) => set({ isMathEditing: v }),
  setActiveGuideContext: (ctx) => set({ activeGuideContext: ctx }),
  setGenerating: (v) => set({ isGenerating: v }),
  setZoom: (v) => set({ zoom: Math.max(0.3, Math.min(2, v)), zoomFitMode: false }),
  setZoomFitMode: (v) => set({ zoomFitMode: v }),
  setPaperSize: (s) => set({ paperSize: s }),

  setLastAIAction: (action) => set({ lastAIAction: action }),
  clearLastAIAction: () => set({ lastAIAction: null }),

  addChatMessage: (msg) => set((state) => ({ chatMessages: [...state.chatMessages, msg] })),
  updateChatMessage: (id, updates) => set((state) => ({
    chatMessages: state.chatMessages.map((m) => m.id === id ? { ...m, ...updates } : m),
  })),
  setChatLoading: (v) => set({ isChatLoading: v }),
  clearChat: () => set({ chatMessages: [], streamingMessageId: null }),
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
  setPendingChatMessage: (msg) => set({ pendingChatMessage: msg }),

  openOMR: (sourceUrl, sourceName) => set({
    omrMode: true,
    omrSourceUrl: sourceUrl,
    omrSourceName: sourceName,
    omrExtractedLatex: null,
    omrProcessing: false,
    omrProgress: "",
  }),
  closeOMR: () => set((s) => {
    if (s.omrSourceUrl) URL.revokeObjectURL(s.omrSourceUrl);
    return {
      omrMode: false,
      omrSourceUrl: null,
      omrSourceName: null,
      omrExtractedLatex: null,
      omrProcessing: false,
      omrProgress: "",
    };
  }),
  setOMRLatex: (latex) => set({ omrExtractedLatex: latex }),
  setOMRProcessing: (v) => set({ omrProcessing: v }),
  setOMRProgress: (msg) => set({ omrProgress: msg }),
  omrTriggerFn: null,
  setOMRTrigger: (fn) => set({ omrTriggerFn: fn }),
  triggerOMR: () => { const fn = useUIStore.getState().omrTriggerFn; if (fn) fn(); },
}));
