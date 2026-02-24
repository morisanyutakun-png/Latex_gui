"use client";

import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Heading,
  Type,
  List,
  Table,
  ImageIcon,
  Plus,
  Trash2,
  FilePlus,
} from "lucide-react";
import { ElementType, ELEMENT_TYPES } from "@/lib/types";

const ELEMENT_ICONS: Record<ElementType, React.ReactNode> = {
  heading: <Heading className="h-4 w-4" />,
  paragraph: <Type className="h-4 w-4" />,
  list: <List className="h-4 w-4" />,
  table: <Table className="h-4 w-4" />,
  image: <ImageIcon className="h-4 w-4" />,
};

export function AppSidebar() {
  const { document, addElement, addPage, deletePage } = useDocumentStore();
  const { currentPageIndex, setCurrentPageIndex, selectElement } = useUIStore();

  if (!document) return null;

  const handleAddElement = (type: ElementType) => {
    addElement(type, currentPageIndex);
  };

  return (
    <aside className="flex w-56 flex-col border-r bg-card shrink-0">
      {/* Block palette */}
      <div className="p-3">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          要素を追加
        </h3>
        <div className="grid grid-cols-2 gap-1.5">
          {ELEMENT_TYPES.map((info) => (
            <button
              key={info.type}
              onClick={() => handleAddElement(info.type)}
              className="flex flex-col items-center gap-1 rounded-lg border border-transparent
                         p-2.5 text-muted-foreground transition-colors
                         hover:border-border hover:bg-accent hover:text-foreground"
            >
              {ELEMENT_ICONS[info.type]}
              <span className="text-[10px] font-medium">{info.name}</span>
            </button>
          ))}
        </div>
      </div>

      <Separator />

      {/* Page list */}
      <div className="flex items-center justify-between p-3 pb-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          ページ
        </h3>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={addPage}>
          <FilePlus className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1 px-3 pb-3">
        <div className="space-y-1.5">
          {document.pages.map((page, i) => (
            <div
              key={page.id}
              onClick={() => {
                setCurrentPageIndex(i);
                selectElement(null);
              }}
              className={`group relative flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm transition-colors
                ${
                  i === currentPageIndex
                    ? "border-primary/40 bg-primary/5 text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:bg-accent"
                }`}
            >
              {/* Mini preview */}
              <div className="flex h-10 w-7 items-center justify-center rounded border bg-white text-[8px] text-muted-foreground shrink-0 dark:bg-zinc-900">
                {page.elements.length > 0 ? (
                  <div className="space-y-0.5 px-0.5">
                    {page.elements.slice(0, 4).map((el) => (
                      <div key={el.id} className="h-[2px] w-full rounded bg-muted-foreground/30" />
                    ))}
                  </div>
                ) : (
                  <Plus className="h-2.5 w-2.5" />
                )}
              </div>
              <span className="text-xs font-medium">ページ {i + 1}</span>
              <span className="ml-auto text-[10px] text-muted-foreground">
                {page.elements.length}
              </span>
              {document.pages.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute -right-1 -top-1 h-5 w-5 opacity-0 group-hover:opacity-100 bg-destructive/10 hover:bg-destructive/20 text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    deletePage(page.id);
                    if (currentPageIndex >= document.pages.length - 1) {
                      setCurrentPageIndex(Math.max(0, currentPageIndex - 1));
                    }
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
