"use client";

import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { ZoomIn, ZoomOut } from "lucide-react";

export function StatusBar() {
  const docClass = useDocumentStore((s) => s.document?.settings.documentClass);
  const blockCount = useDocumentStore((s) => s.document?.blocks.length ?? 0);
  const selectedId = useUIStore((s) => s.selectedBlockId);
  const blocks = useDocumentStore((s) => s.document?.blocks);
  const { zoom, setZoom } = useUIStore();

  const selectedBlock = selectedId && blocks ? blocks.find((b) => b.id === selectedId) : null;
  const selectedIdx = selectedId && blocks ? blocks.findIndex((b) => b.id === selectedId) : -1;

  const classLabel: Record<string, string> = {
    article: "article", report: "report", book: "book",
    beamer: "beamer", letter: "letter", jlreq: "jlreq", ltjsarticle: "ltjsarticle",
  };

  return (
    <div className="flex items-center justify-between h-5 px-3 shrink-0 select-none bg-primary text-primary-foreground/80">
      {/* Left */}
      <div className="flex items-center gap-3 text-[10px] font-mono">
        {docClass && (
          <span className="text-primary-foreground/60 font-medium">{classLabel[docClass] ?? docClass}</span>
        )}
        <span className="text-primary-foreground/50">{blockCount} blocks</span>
        {selectedBlock && selectedIdx >= 0 && (
          <span className="text-primary-foreground/40">
            L{selectedIdx + 1} · {selectedBlock.content.type}
          </span>
        )}
      </div>

      {/* Right — zoom */}
      <div className="flex items-center gap-1 text-[10px] font-mono text-primary-foreground/50">
        <button
          onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
          className="hover:text-primary-foreground transition-colors px-0.5"
          title="縮小"
        >
          <ZoomOut className="h-2.5 w-2.5" />
        </button>
        <button
          onClick={() => setZoom(1)}
          className="w-8 text-center hover:text-primary-foreground transition-colors tabular-nums"
          title="100%にリセット"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={() => setZoom(Math.min(2, zoom + 0.1))}
          className="hover:text-primary-foreground transition-colors px-0.5"
          title="拡大"
        >
          <ZoomIn className="h-2.5 w-2.5" />
        </button>
      </div>
    </div>
  );
}
