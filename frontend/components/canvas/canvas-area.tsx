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
      className="flex-1 overflow-auto canvas-grid"
      onWheel={handleWheel}
    >
      <div className="flex min-h-full items-start justify-center p-8">
        <CanvasPage />
      </div>
    </div>
  );
}
