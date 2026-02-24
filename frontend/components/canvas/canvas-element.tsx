"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { CanvasElement, A4_WIDTH_MM, A4_HEIGHT_MM } from "@/lib/types";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { ElementRenderer } from "./element-renderer";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Trash2, Copy, ArrowUp, ArrowDown, GripVertical } from "lucide-react";

interface Props {
  element: CanvasElement;
  pageIndex: number;
  scale: number; // px per mm
}

export function CanvasElementView({ element, pageIndex, scale }: Props) {
  const { updateElementPosition, deleteElement, duplicateElement, bringForward, sendBackward } =
    useDocumentStore();
  const { selectedElementId, selectElement, editingElementId, setEditingElement } = useUIStore();
  const pushHistory = useDocumentStore((s) => s._pushHistory);

  const isSelected = selectedElementId === element.id;
  const isEditing = editingElementId === element.id;
  const ref = useRef<HTMLDivElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, elX: 0, elY: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0, dir: "" });

  // Convert mm to px
  const px = (mm: number) => mm * scale;

  // Drag handlers
  const handleDragStart = useCallback(
    (e: React.PointerEvent) => {
      if (isEditing) return;
      e.stopPropagation();
      e.preventDefault();
      setIsDragging(true);
      pushHistory();
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        elX: element.position.x,
        elY: element.position.y,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [element.position, isEditing, pushHistory],
  );

  const handleDragMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      const dx = (e.clientX - dragStart.current.x) / scale;
      const dy = (e.clientY - dragStart.current.y) / scale;
      const x = Math.max(0, Math.min(A4_WIDTH_MM - element.position.width, dragStart.current.elX + dx));
      const y = Math.max(0, Math.min(A4_HEIGHT_MM - element.position.height, dragStart.current.elY + dy));
      updateElementPosition(pageIndex, element.id, { x, y });
    },
    [isDragging, scale, element.id, element.position.width, element.position.height, pageIndex, updateElementPosition],
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Resize handlers
  const handleResizeStart = useCallback(
    (e: React.PointerEvent, dir: string) => {
      e.stopPropagation();
      e.preventDefault();
      setIsResizing(true);
      pushHistory();
      resizeStart.current = {
        x: e.clientX,
        y: e.clientY,
        w: element.position.width,
        h: element.position.height,
        dir,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [element.position, pushHistory],
  );

  const handleResizeMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isResizing) return;
      const { dir, x: sx, y: sy, w: sw, h: sh } = resizeStart.current;
      const dx = (e.clientX - sx) / scale;
      const dy = (e.clientY - sy) / scale;
      const updates: Partial<typeof element.position> = {};

      if (dir.includes("e")) updates.width = Math.max(10, sw + dx);
      if (dir.includes("s")) updates.height = Math.max(5, sh + dy);
      if (dir.includes("w")) {
        updates.width = Math.max(10, sw - dx);
        updates.x = element.position.x + (sw - updates.width);
      }
      if (dir.includes("n")) {
        updates.height = Math.max(5, sh - dy);
        updates.y = element.position.y + (sh - updates.height);
      }

      updateElementPosition(pageIndex, element.id, updates);
    },
    [isResizing, scale, element.id, element.position.x, element.position.y, pageIndex, updateElementPosition],
  );

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
  }, []);

  // Click outside to deselect
  useEffect(() => {
    if (!isSelected) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        // Handled by canvas-page click
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [isSelected]);

  const resizeHandles = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
  const handleCursors: Record<string, string> = {
    n: "cursor-n-resize",
    ne: "cursor-ne-resize",
    e: "cursor-e-resize",
    se: "cursor-se-resize",
    s: "cursor-s-resize",
    sw: "cursor-sw-resize",
    w: "cursor-w-resize",
    nw: "cursor-nw-resize",
  };
  const handlePositions: Record<string, string> = {
    n: "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2",
    ne: "top-0 right-0 translate-x-1/2 -translate-y-1/2",
    e: "top-1/2 right-0 translate-x-1/2 -translate-y-1/2",
    se: "bottom-0 right-0 translate-x-1/2 translate-y-1/2",
    s: "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2",
    sw: "bottom-0 left-0 -translate-x-1/2 translate-y-1/2",
    w: "top-1/2 left-0 -translate-x-1/2 -translate-y-1/2",
    nw: "top-0 left-0 -translate-x-1/2 -translate-y-1/2",
  };

  return (
    <div
      ref={ref}
      className={`absolute group transition-gpu ${isDragging ? "cursor-grabbing opacity-90" : ""}`}
      style={{
        left: px(element.position.x),
        top: px(element.position.y),
        width: px(element.position.width),
        height: px(element.position.height),
        zIndex: element.zIndex,
      }}
      onClick={(e) => {
        e.stopPropagation();
        selectElement(element.id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditingElement(element.id);
      }}
    >
      {/* Content */}
      <div
        className={`h-full w-full overflow-hidden rounded-sm transition-all duration-150
          ${isSelected ? "element-selected" : "element-hover"}
          ${isEditing ? "ring-2 ring-primary" : ""}`}
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        style={{ cursor: isEditing ? "text" : isDragging ? "grabbing" : "grab" }}
      >
        <div className="h-full w-full" style={{ pointerEvents: isEditing ? "auto" : "none" }}>
          <ElementRenderer element={element} />
        </div>
      </div>

      {/* Floating toolbar */}
      {isSelected && !isDragging && !isResizing && (
        <div className="floating-toolbar absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-0.5 rounded-xl border bg-card/95 backdrop-blur-md px-1.5 py-1 shadow-lg z-50 animate-scale-in">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                onClick={(e) => { e.stopPropagation(); bringForward(pageIndex, element.id); }}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px]">前面へ</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                onClick={(e) => { e.stopPropagation(); sendBackward(pageIndex, element.id); }}
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px]">背面へ</TooltipContent>
          </Tooltip>

          <div className="mx-0.5 h-4 w-px bg-border/50" />

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                onClick={(e) => { e.stopPropagation(); duplicateElement(pageIndex, element.id); }}
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px]">複製 (⌘D)</TooltipContent>
          </Tooltip>

          <div className="mx-0.5 h-4 w-px bg-border/50" />

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="rounded-lg p-1.5 text-destructive/60 hover:bg-destructive/10 hover:text-destructive transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteElement(pageIndex, element.id);
                  selectElement(null);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px]">削除 (Del)</TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Drag handle */}
      {isSelected && !isDragging && !isResizing && (
        <div className="absolute -left-7 top-0 flex h-7 w-5 items-center justify-center rounded-l-lg border border-r-0 bg-card/90 backdrop-blur-sm text-muted-foreground cursor-grab shadow-sm transition-colors hover:bg-primary/10 hover:text-primary animate-fade-in">
          <GripVertical className="h-3.5 w-3.5" />
        </div>
      )}

      {/* Resize handles */}
      {isSelected &&
        resizeHandles.map((dir) => (
          <div
            key={dir}
            className={`resize-handle absolute h-2.5 w-2.5 rounded-full border-2 border-primary bg-white dark:bg-zinc-900 shadow-sm ${handleCursors[dir]} ${handlePositions[dir]} z-50`}
            onPointerDown={(e) => handleResizeStart(e, dir)}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
          />
        ))}
    </div>
  );
}
