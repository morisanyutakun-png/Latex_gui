"use client";

import { A4_WIDTH_MM, A4_HEIGHT_MM } from "@/lib/types";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { CanvasElementView } from "./canvas-element";

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
      className="relative bg-white shadow-xl rounded-sm dark:bg-zinc-50"
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
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-muted-foreground/30">
            <p className="text-lg font-medium">要素を追加してください</p>
            <p className="text-sm mt-1">左パネルからドラッグまたはクリック</p>
          </div>
        </div>
      )}
    </div>
  );
}
