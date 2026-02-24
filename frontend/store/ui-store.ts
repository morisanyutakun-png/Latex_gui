"use client";

import { create } from "zustand";

interface UIState {
  selectedElementId: string | null;
  currentPageIndex: number;
  zoom: number;
  isGenerating: boolean;
  editingElementId: string | null;   // ダブルクリックで編集中の要素

  selectElement: (id: string | null) => void;
  setCurrentPageIndex: (index: number) => void;
  setZoom: (zoom: number) => void;
  setGenerating: (val: boolean) => void;
  setEditingElement: (id: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedElementId: null,
  currentPageIndex: 0,
  zoom: 1,
  isGenerating: false,
  editingElementId: null,

  selectElement: (id) => set({ selectedElementId: id, editingElementId: null }),
  setCurrentPageIndex: (index) => set({ currentPageIndex: index }),
  setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(2, zoom)) }),
  setGenerating: (val) => set({ isGenerating: val }),
  setEditingElement: (id) => set({ editingElementId: id, selectedElementId: id }),
}));
