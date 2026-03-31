"use client";

import { create } from "zustand";
import { ChatMessage, DocumentPatch } from "@/lib/types";

interface UIState {
  selectedBlockId: string | null;
  editingBlockId: string | null;
  isGenerating: boolean;
  zoom: number;

  // AI Chat state (in-memory only, not persisted)
  chatMessages: ChatMessage[];
  pendingPatch: DocumentPatch | null;
  isChatLoading: boolean;

  selectBlock: (id: string | null) => void;
  setEditingBlock: (id: string | null) => void;
  setGenerating: (v: boolean) => void;
  setZoom: (v: number) => void;

  // Chat actions
  addChatMessage: (msg: ChatMessage) => void;
  updateChatMessage: (id: string, updates: Partial<ChatMessage>) => void;
  setPendingPatch: (patch: DocumentPatch | null) => void;
  setChatLoading: (v: boolean) => void;
  clearChat: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedBlockId: null,
  editingBlockId: null,
  isGenerating: false,
  zoom: 1,
  chatMessages: [],
  pendingPatch: null,
  isChatLoading: false,

  selectBlock: (id) => set((state) => ({
    selectedBlockId: id,
    editingBlockId: id && state.editingBlockId === id ? id : (id ? state.editingBlockId : null),
  })),
  setEditingBlock: (id) => set({ editingBlockId: id, selectedBlockId: id }),
  setGenerating: (v) => set({ isGenerating: v }),
  setZoom: (v) => set({ zoom: Math.max(0.5, Math.min(2, v)) }),

  addChatMessage: (msg) => set((state) => ({ chatMessages: [...state.chatMessages, msg] })),
  updateChatMessage: (id, updates) => set((state) => ({
    chatMessages: state.chatMessages.map((m) => m.id === id ? { ...m, ...updates } : m),
  })),
  setPendingPatch: (patch) => set({ pendingPatch: patch }),
  setChatLoading: (v) => set({ isChatLoading: v }),
  clearChat: () => set({ chatMessages: [], pendingPatch: null }),
}));
