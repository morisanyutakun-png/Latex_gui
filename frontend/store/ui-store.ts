"use client";

import { create } from "zustand";
import { ChatMessage } from "@/lib/types";
import type { RubricBundle, GradingResult, GradingPhase } from "@/lib/grading-types";
import type { AgentMode } from "@/lib/api";

export type PaperSize = "a4" | "a3" | "b5" | "letter";
export type GuideContext = "none" | "math" | "heading" | "list" | "table" | "code" | "general";

// v2: モード ID 再設計 (plan / edit / mix)。旧値 (auto/problem/math/review) は
// ここで破棄して edit にフォールバックする。キーも変えて旧値が読まれないようにする。
const AGENT_MODE_STORAGE_KEY = "eddivom-agent-mode-v2";
const VALID_AGENT_MODES: readonly AgentMode[] = ["plan", "edit", "mix"];

function loadInitialAgentMode(): AgentMode {
  if (typeof window === "undefined") return "edit";
  try {
    const saved = localStorage.getItem(AGENT_MODE_STORAGE_KEY);
    if (saved && (VALID_AGENT_MODES as readonly string[]).includes(saved)) {
      return saved as AgentMode;
    }
  } catch { /* ignore */ }
  return "edit";
}

// v2: 既定を確実に ON に揃えるためキーを回した。旧キーに "false" が
// 残っていても無視され、新規にトグルしたタイミングで v2 に保存される。
const VISUAL_PANEL_STORAGE_KEY = "eddivom-show-visual-panel-v2";
const VISUAL_PANEL_LEGACY_KEYS = ["eddivom-show-visual-panel"];

function loadInitialShowVisualPanel(): boolean {
  if (typeof window === "undefined") return true;
  try {
    // 旧キーが残っていたら掃除 (保存内容は尊重しない)
    for (const k of VISUAL_PANEL_LEGACY_KEYS) localStorage.removeItem(k);

    const saved = localStorage.getItem(VISUAL_PANEL_STORAGE_KEY);
    if (saved === "false") return false;
    if (saved === "true") return true;
  } catch { /* ignore */ }
  return true;
}

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

  // ── Editor panel visibility (default: visual editor only) ──
  showSourcePanel: boolean;
  showPdfPanel: boolean;
  /**
   * 中央の VisualEditor (直接編集できる紙) を表示するか。
   * localStorage 永続 — ユーザーが非表示にしたらリロード後もその状態を保つ。
   * AI チャット中心で使いたい人、Source / PDF だけ見たい人向け。
   */
  showVisualPanel: boolean;

  // AI action tracking
  lastAIAction: LastAIAction | null;

  // AI Chat state (in-memory only, not persisted)
  chatMessages: ChatMessage[];
  isChatLoading: boolean;
  streamingMessageId: string | null;

  // エージェントモード (localStorage 永続)
  agentMode: AgentMode;
  setAgentMode: (m: AgentMode) => void;

  // Programmatic chat message (e.g. from 類題作成)
  pendingChatMessage: string | null;

  // OMR (画像/PDF → raw LaTeX) split-view
  omrMode: boolean;
  omrSourceUrl: string | null;
  omrSourceName: string | null;
  omrExtractedLatex: string | null;
  omrProcessing: boolean;
  omrProgress: string;

  // 図エディタモード (フルスクリーン)
  figureEditorMode: boolean;

  // 採点モード (フルスクリーン)
  gradingMode: boolean;
  gradingPhase: GradingPhase;
  gradingProblemLatex: string;
  gradingProblemTitle: string;
  gradingRubrics: RubricBundle | null;
  gradingAnswerFiles: File[];
  gradingStudentName: string;
  gradingStudentId: string;
  gradingResult: GradingResult | null;
  gradingMarkedPdfUrl: string | null;
  gradingFeedbackPdfUrl: string | null;
  gradingProcessing: boolean;
  gradingProgress: string;
  gradingError: string | null;

  setMathEditing: (v: boolean) => void;
  setActiveGuideContext: (ctx: GuideContext) => void;
  setShowSourcePanel: (v: boolean) => void;
  setShowPdfPanel: (v: boolean) => void;
  setShowVisualPanel: (v: boolean) => void;
  toggleSourcePanel: () => void;
  togglePdfPanel: () => void;
  toggleVisualPanel: () => void;
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

  // 採点モード actions
  openGrading: (problemLatex: string, problemTitle: string) => void;
  closeGrading: () => void;
  setGradingPhase: (p: GradingPhase) => void;
  setGradingRubrics: (r: RubricBundle | null) => void;
  setGradingAnswerFiles: (f: File[]) => void;
  setGradingStudentName: (v: string) => void;
  setGradingStudentId: (v: string) => void;
  setGradingResult: (r: GradingResult | null) => void;
  setGradingMarkedPdfUrl: (url: string | null) => void;
  setGradingFeedbackPdfUrl: (url: string | null) => void;
  setGradingProcessing: (v: boolean) => void;
  setGradingProgress: (msg: string) => void;
  setGradingError: (msg: string | null) => void;

  // 図エディタ actions
  openFigureEditor: () => void;
  closeFigureEditor: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isGenerating: false,
  zoom: 1,
  zoomFitMode: true,
  paperSize: "a4",
  isMathEditing: false,
  activeGuideContext: "none",
  showSourcePanel: false,
  showPdfPanel: false,
  showVisualPanel: loadInitialShowVisualPanel(),
  lastAIAction: null,
  chatMessages: [],
  isChatLoading: false,
  streamingMessageId: null,
  pendingChatMessage: null,

  agentMode: loadInitialAgentMode(),
  setAgentMode: (m) => {
    set({ agentMode: m });
    try { localStorage.setItem(AGENT_MODE_STORAGE_KEY, m); } catch { /* ignore */ }
  },
  omrMode: false,
  omrSourceUrl: null,
  omrSourceName: null,
  omrExtractedLatex: null,
  omrProcessing: false,
  omrProgress: "",

  figureEditorMode: false,

  gradingMode: false,
  gradingPhase: "idle",
  gradingProblemLatex: "",
  gradingProblemTitle: "",
  gradingRubrics: null,
  gradingAnswerFiles: [],
  gradingStudentName: "",
  gradingStudentId: "",
  gradingResult: null,
  gradingMarkedPdfUrl: null,
  gradingFeedbackPdfUrl: null,
  gradingProcessing: false,
  gradingProgress: "",
  gradingError: null,

  setMathEditing: (v) => set({ isMathEditing: v }),
  setActiveGuideContext: (ctx) => set({ activeGuideContext: ctx }),
  setShowSourcePanel: (v) => set({ showSourcePanel: v }),
  setShowPdfPanel: (v) => set({ showPdfPanel: v }),
  setShowVisualPanel: (v) => {
    set({ showVisualPanel: v });
    try { localStorage.setItem(VISUAL_PANEL_STORAGE_KEY, v ? "true" : "false"); } catch { /* ignore */ }
  },
  toggleSourcePanel: () => set((s) => ({ showSourcePanel: !s.showSourcePanel })),
  togglePdfPanel: () => set((s) => ({ showPdfPanel: !s.showPdfPanel })),
  toggleVisualPanel: () => {
    const next = !useUIStore.getState().showVisualPanel;
    set({ showVisualPanel: next });
    try { localStorage.setItem(VISUAL_PANEL_STORAGE_KEY, next ? "true" : "false"); } catch { /* ignore */ }
  },
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

  openGrading: (problemLatex, problemTitle) => set({
    gradingMode: true,
    gradingPhase: "step1-rubric",
    gradingProblemLatex: problemLatex,
    gradingProblemTitle: problemTitle,
    gradingRubrics: null,
    gradingAnswerFiles: [],
    gradingStudentName: "",
    gradingStudentId: "",
    gradingResult: null,
    gradingMarkedPdfUrl: null,
    gradingFeedbackPdfUrl: null,
    gradingProcessing: false,
    gradingProgress: "",
    gradingError: null,
  }),
  closeGrading: () => set((s) => {
    if (s.gradingMarkedPdfUrl) URL.revokeObjectURL(s.gradingMarkedPdfUrl);
    if (s.gradingFeedbackPdfUrl) URL.revokeObjectURL(s.gradingFeedbackPdfUrl);
    return {
      gradingMode: false,
      gradingPhase: "idle",
      gradingProblemLatex: "",
      gradingProblemTitle: "",
      gradingRubrics: null,
      gradingAnswerFiles: [],
      gradingStudentName: "",
      gradingStudentId: "",
      gradingResult: null,
      gradingMarkedPdfUrl: null,
      gradingFeedbackPdfUrl: null,
      gradingProcessing: false,
      gradingProgress: "",
      gradingError: null,
    };
  }),
  setGradingPhase: (p) => set({ gradingPhase: p }),
  setGradingRubrics: (r) => set({ gradingRubrics: r }),
  setGradingAnswerFiles: (f) => set({ gradingAnswerFiles: f }),
  setGradingStudentName: (v) => set({ gradingStudentName: v }),
  setGradingStudentId: (v) => set({ gradingStudentId: v }),
  setGradingResult: (r) => set({ gradingResult: r }),
  setGradingMarkedPdfUrl: (url) => set((s) => {
    if (s.gradingMarkedPdfUrl && s.gradingMarkedPdfUrl !== url) {
      URL.revokeObjectURL(s.gradingMarkedPdfUrl);
    }
    return { gradingMarkedPdfUrl: url };
  }),
  setGradingFeedbackPdfUrl: (url) => set((s) => {
    if (s.gradingFeedbackPdfUrl && s.gradingFeedbackPdfUrl !== url) {
      URL.revokeObjectURL(s.gradingFeedbackPdfUrl);
    }
    return { gradingFeedbackPdfUrl: url };
  }),
  setGradingProcessing: (v) => set({ gradingProcessing: v }),
  setGradingProgress: (msg) => set({ gradingProgress: msg }),
  setGradingError: (msg) => set({ gradingError: msg }),

  // 図エディタ
  openFigureEditor: () => set({ figureEditorMode: true }),
  closeFigureEditor: () => set({ figureEditorMode: false }),
}));
