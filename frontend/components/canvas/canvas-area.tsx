"use client";

import { useUIStore } from "@/store/ui-store";
import { CanvasPage } from "./canvas-page";

export function CanvasArea() {
  const { zoom, setZoom } = useUIStore();

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      setZoom(zoom + delta);
    }
  };

  return (
    <div
      className="relative flex-1 overflow-auto canvas-grid"
      onWheel={handleWheel}
    >
      <div className="flex min-h-full items-start justify-center p-10">
        <CanvasPage />
      </div>

      {/* Zoom indicator */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-card/80 backdrop-blur-sm border border-border/50 px-2.5 py-1.5 shadow-sm pointer-events-none select-none z-30">
        <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
      </div>
    </div>
  );
}
