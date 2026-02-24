"use client";

import { A4_WIDTH_MM, A4_HEIGHT_MM } from "@/lib/types";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { CanvasElementView } from "./canvas-element";
import { MousePointerClick } from "lucide-react";

// A4 aspect ratio rendering
const BASE_WIDTH_PX = 794; // A4 at 96dpi

export function CanvasPage() {
  const document = useDocumentStore((s) => s.document);
  const { currentPageIndex, zoom, selectElement } = useUIStore();

  if (!document) return null;

  const page = document.pages[currentPageIndex];
  if (!page) return null;

  const scale = (BASE_WIDTH_PX / A4_WIDTH_MM) * zoom;
  const pageWidthPx = A4_WIDTH_MM * scale;
  const pageHeightPx = A4_HEIGHT_MM * scale;

  return (
    <div
      className="relative bg-white rounded-sm page-shadow transition-gpu dark:bg-zinc-50"
      style={{
        width: pageWidthPx,
        height: pageHeightPx,
        minWidth: pageWidthPx,
        minHeight: pageHeightPx,
      }}
      onClick={() => selectElement(null)}
    >
      {/* Elements */}
      {page.elements
        .slice()
        .sort((a, b) => a.zIndex - b.zIndex)
        .map((el) => (
          <CanvasElementView
            key={el.id}
            element={el}
            pageIndex={currentPageIndex}
            scale={scale}
          />
        ))}

      {/* Empty state */}
      {page.elements.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-fade-in">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground/30">
              <MousePointerClick className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground/40">要素を追加してください</p>
              <p className="text-xs text-muted-foreground/25 mt-1">左パネルからクリックして配置</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
