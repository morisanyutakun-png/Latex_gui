"use client";

import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Heading,
  Type,
  List,
  Table,
  ImageIcon,
  Plus,
  Trash2,
  FilePlus,
  Layers,
  LayoutGrid,
} from "lucide-react";
import { ElementType, ELEMENT_TYPES } from "@/lib/types";

const ELEMENT_ICONS: Record<ElementType, React.ReactNode> = {
  heading: <Heading className="h-4 w-4" />,
  paragraph: <Type className="h-4 w-4" />,
  list: <List className="h-4 w-4" />,
  table: <Table className="h-4 w-4" />,
  image: <ImageIcon className="h-4 w-4" />,
};

const ELEMENT_DESCRIPTIONS: Record<ElementType, string> = {
  heading: "タイトルやセクション見出し",
  paragraph: "本文テキスト",
  list: "箇条書き・番号リスト",
  table: "表組みデータ",
  image: "画像を配置",
};

export function AppSidebar() {
  const { document, addElement, addPage, deletePage } = useDocumentStore();
  const { currentPageIndex, setCurrentPageIndex, selectElement } = useUIStore();

  if (!document) return null;

  const handleAddElement = (type: ElementType) => {
    addElement(type, currentPageIndex);
  };

  return (
    <aside className="flex w-60 flex-col border-r bg-card/50 backdrop-blur-sm shrink-0 sidebar-surface">
      {/* Element palette */}
      <div className="p-3 pb-2">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-primary/10">
            <LayoutGrid className="h-3 w-3 text-primary" />
          </div>
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            要素を追加
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {ELEMENT_TYPES.map((info, i) => (
            <Tooltip key={info.type}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleAddElement(info.type)}
                  className="group/el flex flex-col items-center gap-1.5 rounded-xl border border-transparent
                             p-3 text-muted-foreground transition-all duration-200
                             hover:border-primary/20 hover:bg-primary/5 hover:text-foreground
                             hover:shadow-sm hover:-translate-y-0.5
                             active:translate-y-0 active:shadow-none"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/60
                                  transition-all duration-200 group-hover/el:bg-primary/10 group-hover/el:scale-110">
                    {ELEMENT_ICONS[info.type]}
                  </div>
                  <span className="text-[10px] font-medium leading-none">{info.name}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                {ELEMENT_DESCRIPTIONS[info.type]}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="mx-3 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* Page list */}
      <div className="flex items-center justify-between p-3 pb-1.5">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-primary/10">
            <Layers className="h-3 w-3 text-primary" />
          </div>
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            ページ
          </h3>
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-1 text-[9px] font-bold text-muted-foreground tabular-nums">
            {document.pages.length}
          </span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              onClick={addPage}
            >
              <FilePlus className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">ページを追加</TooltipContent>
        </Tooltip>
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
              className={`group relative flex cursor-pointer items-center gap-2.5 rounded-xl border p-2 transition-all duration-200
                ${
                  i === currentPageIndex
                    ? "border-primary/30 bg-primary/[0.06] text-foreground shadow-sm shadow-primary/5"
                    : "border-transparent text-muted-foreground hover:border-border/60 hover:bg-accent/50"
                }`}
            >
              {/* Active indicator */}
              {i === currentPageIndex && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-primary" />
              )}

              {/* Mini preview */}
              <div className={`relative flex h-12 w-[34px] items-center justify-center rounded-md border bg-white text-[8px] text-muted-foreground shrink-0 dark:bg-zinc-900 overflow-hidden transition-shadow
                ${i === currentPageIndex ? "shadow-sm border-primary/20" : "border-border/50"}`}>
                {page.elements.length > 0 ? (
                  <div className="w-full space-y-0.5 px-1">
                    {page.elements.slice(0, 5).map((el) => (
                      <div
                        key={el.id}
                        className="h-[2px] rounded-full bg-muted-foreground/25"
                        style={{ width: `${Math.min(100, 40 + Math.random() * 60)}%` }}
                      />
                    ))}
                  </div>
                ) : (
                  <Plus className="h-2.5 w-2.5 opacity-40" />
                )}
              </div>

              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-xs font-medium leading-none truncate">ページ {i + 1}</span>
                <span className="text-[10px] text-muted-foreground/70 leading-none">
                  {page.elements.length} 要素
                </span>
              </div>

              {document.pages.length > 1 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute -right-1 -top-1 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity
                                 bg-destructive/10 hover:bg-destructive/20 text-destructive/70 hover:text-destructive shadow-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePage(page.id);
                        if (currentPageIndex >= document.pages.length - 1) {
                          setCurrentPageIndex(Math.max(0, currentPageIndex - 1));
                        }
                      }}
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">削除</TooltipContent>
                </Tooltip>
              )}
            </div>
          ))}

          {/* Add page button */}
          <button
            onClick={addPage}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border/60
                       p-2.5 text-muted-foreground/60 transition-all duration-200
                       hover:border-primary/30 hover:text-primary/70 hover:bg-primary/[0.03]"
          >
            <Plus className="h-3 w-3" />
            <span className="text-[10px] font-medium">新しいページ</span>
          </button>
        </div>
      </ScrollArea>
    </aside>
  );
}
