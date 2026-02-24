"use client";

import { create } from "zustand";

interface UIState {
  selectedBlockId: string | null;
  editingBlockId: string | null;
  isGenerating: boolean;
  zoom: number;

  selectBlock: (id: string | null) => void;
  setEditingBlock: (id: string | null) => void;
  setGenerating: (v: boolean) => void;
  setZoom: (v: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedBlockId: null,
  editingBlockId: null,
  isGenerating: false,
  zoom: 1,

  selectBlock: (id) => set({ selectedBlockId: id, editingBlockId: id ? undefined : null }),
  setEditingBlock: (id) => set({ editingBlockId: id, selectedBlockId: id }),
  setGenerating: (v) => set({ isGenerating: v }),
  setZoom: (v) => set({ zoom: Math.max(0.5, Math.min(2, v)) }),
}));
