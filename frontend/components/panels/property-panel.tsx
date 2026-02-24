"use client";

import { useState } from "react";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Minus,
  Plus,
  Type,
  Move,
  Paintbrush,
  ChevronDown,
  Palette,
  Box,
  Eye,
} from "lucide-react";
import { CanvasElement, ElementStyle, ListStyle } from "@/lib/types";

/* ── Collapsible section ── */
function Section({
  icon: Icon,
  title,
  defaultOpen = true,
  children,
}: {
  icon: React.ElementType;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 py-2 text-left group"
      >
        <div className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 shrink-0">
          <Icon className="h-3 w-3 text-primary" />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex-1">
          {title}
        </span>
        <ChevronDown
          className={`h-3 w-3 text-muted-foreground/50 transition-transform duration-200 ${
            open ? "" : "-rotate-90"
          }`}
        />
      </button>
      {open && <div className="pb-1 animate-fade-in">{children}</div>}
    </div>
  );
}

export function PropertyPanel() {
  const document = useDocumentStore((s) => s.document);
  const updateElementStyle = useDocumentStore((s) => s.updateElementStyle);
  const updateElementPosition = useDocumentStore((s) => s.updateElementPosition);
  const updateElementContent = useDocumentStore((s) => s.updateElementContent);
  const pushHistory = useDocumentStore((s) => s._pushHistory);
  const { selectedElementId, currentPageIndex } = useUIStore();

  if (!document || !selectedElementId) {
    return (
      <aside className="w-64 border-l bg-card/50 backdrop-blur-sm p-4 shrink-0 sidebar-surface">
        <div className="flex flex-col items-center justify-center h-full gap-3 animate-fade-in">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50">
            <Paintbrush className="h-5 w-5 text-muted-foreground/30" />
          </div>
          <p className="text-xs text-muted-foreground/60 text-center leading-relaxed">
            要素を選択すると<br />プロパティが表示されます
          </p>
        </div>
      </aside>
    );
  }

  const page = document.pages[currentPageIndex];
  const element = page?.elements.find((el) => el.id === selectedElementId);
  if (!element) {
    return (
      <aside className="w-64 border-l bg-card/50 backdrop-blur-sm p-4 shrink-0 sidebar-surface">
        <p className="text-xs text-muted-foreground text-center mt-8">要素が見つかりません</p>
      </aside>
    );
  }

  const setStyle = (updates: Partial<ElementStyle>) => {
    updateElementStyle(currentPageIndex, element.id, updates);
  };

  const setPosition = (updates: Partial<CanvasElement["position"]>) => {
    pushHistory();
    updateElementPosition(currentPageIndex, element.id, updates);
  };

  const setContent = (updates: Record<string, unknown>) => {
    pushHistory();
    updateElementContent(currentPageIndex, element.id, updates as Partial<CanvasElement["content"]>);
  };

  const { content, style, position } = element;

  return (
    <aside className="w-64 border-l bg-card/50 backdrop-blur-sm shrink-0 sidebar-surface">
      <ScrollArea className="h-full">
        <div className="p-3 space-y-1">
          {/* Content editing */}
          <Section icon={Type} title="コンテンツ">
            <ContentEditor content={content} setContent={setContent} />
          </Section>

          <div className="mx-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          {/* Position */}
          <Section icon={Move} title="位置・サイズ">
            <div className="grid grid-cols-2 gap-2">
              <PositionField label="X" value={position.x} onChange={(v) => setPosition({ x: v })} />
              <PositionField label="Y" value={position.y} onChange={(v) => setPosition({ y: v })} />
              <PositionField label="W" value={position.width} onChange={(v) => setPosition({ width: v })} />
              <PositionField label="H" value={position.height} onChange={(v) => setPosition({ height: v })} />
            </div>
          </Section>

          <div className="mx-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          {/* Style */}
          <Section icon={Paintbrush} title="スタイル">
            <div className="space-y-3">
              {/* Font size */}
              {content.type !== "image" && (
                <div>
                  <Label className="text-[10px] text-muted-foreground font-medium">フォントサイズ</Label>
                  <div className="flex items-center gap-1 mt-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 rounded-lg"
                      onClick={() => setStyle({ fontSize: Math.max(6, (style.fontSize || 11) - 1) })}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Input
                      type="number"
                      value={style.fontSize || 11}
                      onChange={(e) => setStyle({ fontSize: Number(e.target.value) || 11 })}
                      className="h-7 w-14 text-center text-xs rounded-lg tabular-nums"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 rounded-lg"
                      onClick={() => setStyle({ fontSize: Math.min(72, (style.fontSize || 11) + 1) })}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <span className="text-[10px] text-muted-foreground/60 ml-0.5">pt</span>
                  </div>
                </div>
              )}

              {/* Font family */}
              {content.type !== "image" && (
                <div>
                  <Label className="text-[10px] text-muted-foreground font-medium">フォント</Label>
                  <div className="flex gap-1 mt-1">
                    <Button
                      variant={style.fontFamily === "serif" ? "default" : "outline"}
                      size="sm"
                      className="h-7 flex-1 text-xs rounded-lg"
                      onClick={() => setStyle({ fontFamily: "serif" })}
                    >
                      明朝
                    </Button>
                    <Button
                      variant={style.fontFamily === "sans" ? "default" : "outline"}
                      size="sm"
                      className="h-7 flex-1 text-xs rounded-lg"
                      onClick={() => setStyle({ fontFamily: "sans" })}
                    >
                      ゴシック
                    </Button>
                  </div>
                </div>
              )}

              {/* Bold / Italic */}
              {content.type !== "image" && (
                <div>
                  <Label className="text-[10px] text-muted-foreground font-medium">装飾</Label>
                  <div className="flex gap-1 mt-1">
                    <Button
                      variant={style.bold ? "default" : "outline"}
                      size="icon"
                      className="h-7 w-7 rounded-lg"
                      onClick={() => setStyle({ bold: !style.bold })}
                    >
                      <Bold className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant={style.italic ? "default" : "outline"}
                      size="icon"
                      className="h-7 w-7 rounded-lg"
                      onClick={() => setStyle({ italic: !style.italic })}
                    >
                      <Italic className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Text align */}
              <div>
                <Label className="text-[10px] text-muted-foreground font-medium">配置</Label>
                <div className="flex gap-1 mt-1">
                  {([["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]] as const).map(
                    ([align, Icon]) => (
                      <Button
                        key={align}
                        variant={style.textAlign === align ? "default" : "outline"}
                        size="icon"
                        className="h-7 w-7 rounded-lg"
                        onClick={() => setStyle({ textAlign: align })}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </Button>
                    ),
                  )}
                </div>
              </div>
            </div>
          </Section>

          <div className="mx-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          {/* Colors */}
          <Section icon={Palette} title="カラー">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground font-medium">文字色</Label>
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      type="color"
                      value={style.textColor || "#000000"}
                      onChange={(e) => setStyle({ textColor: e.target.value })}
                      className="h-7 w-7 rounded-lg border cursor-pointer"
                    />
                    <Input
                      value={style.textColor || ""}
                      onChange={(e) => setStyle({ textColor: e.target.value })}
                      placeholder="auto"
                      className="h-7 text-[10px] flex-1 rounded-lg tabular-nums"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground font-medium">背景色</Label>
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      type="color"
                      value={style.backgroundColor || "#ffffff"}
                      onChange={(e) => setStyle({ backgroundColor: e.target.value })}
                      className="h-7 w-7 rounded-lg border cursor-pointer"
                    />
                    <Input
                      value={style.backgroundColor || ""}
                      onChange={(e) => setStyle({ backgroundColor: e.target.value })}
                      placeholder="none"
                      className="h-7 text-[10px] flex-1 rounded-lg tabular-nums"
                    />
                  </div>
                </div>
              </div>
            </div>
          </Section>

          <div className="mx-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          {/* Border & Opacity */}
          <Section icon={Box} title="枠線">
            <div className="space-y-3">
              <div>
                <Label className="text-[10px] text-muted-foreground font-medium">枠線</Label>
                <div className="flex items-center gap-1 mt-1">
                  <input
                    type="color"
                    value={style.borderColor || "#000000"}
                    onChange={(e) => setStyle({ borderColor: e.target.value })}
                    className="h-7 w-7 rounded-lg border cursor-pointer"
                  />
                  <Input
                    type="number"
                    value={style.borderWidth || 0}
                    onChange={(e) => setStyle({ borderWidth: Number(e.target.value) })}
                    className="h-7 w-14 text-[10px] rounded-lg tabular-nums"
                    min={0}
                    max={10}
                    step={0.5}
                  />
                  <span className="text-[10px] text-muted-foreground/60">pt</span>
                </div>
              </div>
            </div>
          </Section>

          <div className="mx-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          <Section icon={Eye} title="不透明度" defaultOpen={false}>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-[10px] text-muted-foreground font-medium">
                  不透明度
                </Label>
                <span className="text-[10px] font-medium text-foreground tabular-nums">
                  {Math.round((style.opacity ?? 1) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round((style.opacity ?? 1) * 100)}
                onChange={(e) => setStyle({ opacity: Number(e.target.value) / 100 })}
                className="w-full accent-primary h-1.5 rounded-full"
              />
            </div>
          </Section>
        </div>
      </ScrollArea>
    </aside>
  );
}

// --- Sub-components ---

function PositionField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <Label className="text-[10px] text-muted-foreground font-medium">{label} <span className="text-muted-foreground/40">mm</span></Label>
      <Input
        type="number"
        value={Math.round(value * 10) / 10}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="h-7 text-xs mt-0.5 rounded-lg tabular-nums"
        step={1}
      />
    </div>
  );
}

function ContentEditor({
  content,
  setContent,
}: {
  content: CanvasElement["content"];
  setContent: (u: Record<string, unknown>) => void;
}) {
  switch (content.type) {
    case "heading":
      return (
        <div className="space-y-2">
          <Input
            value={content.text}
            onChange={(e) => setContent({ text: e.target.value })}
            placeholder="見出しテキスト"
            className="h-8 text-sm rounded-lg"
          />
          <div className="flex gap-1">
            {([1, 2, 3] as const).map((lvl) => (
              <Button
                key={lvl}
                variant={content.level === lvl ? "default" : "outline"}
                size="sm"
                className="h-7 flex-1 text-xs rounded-lg"
                onClick={() => setContent({ level: lvl })}
              >
                H{lvl}
              </Button>
            ))}
          </div>
        </div>
      );

    case "paragraph":
      return (
        <Textarea
          value={content.text}
          onChange={(e) => setContent({ text: e.target.value })}
          placeholder="テキストを入力..."
          rows={4}
          className="text-sm resize-y rounded-lg"
        />
      );

    case "list":
      return (
        <div className="space-y-2">
          <div className="flex gap-1">
            {(["bullet", "numbered"] as const).map((s) => (
              <Button
                key={s}
                variant={content.style === s ? "default" : "outline"}
                size="sm"
                className="h-7 flex-1 text-xs rounded-lg"
                onClick={() => setContent({ style: s as ListStyle })}
              >
                {s === "bullet" ? "箇条書き" : "番号付き"}
              </Button>
            ))}
          </div>
          {content.items.map((item: string, i: number) => (
            <div key={i} className="flex gap-1">
              <span className="flex h-8 w-6 items-center justify-center text-xs text-muted-foreground/60">
                {content.style === "numbered" ? `${i + 1}.` : "•"}
              </span>
              <Input
                value={item}
                onChange={(e) => {
                  const newItems = [...content.items];
                  newItems[i] = e.target.value;
                  setContent({ items: newItems });
                }}
                className="h-8 text-sm flex-1 rounded-lg"
                placeholder={`項目 ${i + 1}`}
              />
              {content.items.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive/40 hover:text-destructive rounded-lg"
                  onClick={() => {
                    const newItems = content.items.filter((_: string, j: number) => j !== i);
                    setContent({ items: newItems });
                  }}
                >
                  ×
                </Button>
              )}
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="w-full h-7 text-xs rounded-lg"
            onClick={() => setContent({ items: [...content.items, ""] })}
          >
            <Plus className="h-3 w-3 mr-1" />
            項目を追加
          </Button>
        </div>
      );

    case "table":
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70">
            <span className="rounded-md bg-muted/50 px-1.5 py-0.5 font-medium">{content.headers.length}列</span>
            <span>×</span>
            <span className="rounded-md bg-muted/50 px-1.5 py-0.5 font-medium">{content.rows.length}行</span>
          </div>
          <div className="space-y-1">
            <div className="flex gap-0.5">
              {content.headers.map((h: string, i: number) => (
                <Input
                  key={`h-${i}`}
                  value={h}
                  onChange={(e) => {
                    const newH = [...content.headers];
                    newH[i] = e.target.value;
                    setContent({ headers: newH });
                  }}
                  className="h-7 text-[10px] font-semibold rounded-lg"
                  placeholder={`列${i + 1}`}
                />
              ))}
            </div>
            {content.rows.map((row: string[], ri: number) => (
              <div key={`r-${ri}`} className="flex gap-0.5">
                {row.map((cell: string, ci: number) => (
                  <Input
                    key={`c-${ri}-${ci}`}
                    value={cell}
                    onChange={(e) => {
                      const newRows = content.rows.map((r: string[], i: number) =>
                        i === ri ? r.map((c: string, j: number) => (j === ci ? e.target.value : c)) : [...r],
                      );
                      setContent({ rows: newRows });
                    }}
                    className="h-7 text-[10px] rounded-lg"
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-7 text-[10px] rounded-lg"
              onClick={() => {
                const newRows = [...content.rows, content.headers.map(() => "")];
                setContent({ rows: newRows });
              }}
            >
              +行
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-7 text-[10px] rounded-lg"
              onClick={() => {
                setContent({
                  headers: [...content.headers, `列${content.headers.length + 1}`],
                  rows: content.rows.map((r: string[]) => [...r, ""]),
                });
              }}
            >
              +列
            </Button>
          </div>
        </div>
      );

    case "image":
      return (
        <div className="space-y-2">
          <div>
            <Label className="text-[10px] text-muted-foreground font-medium">画像URL</Label>
            <Input
              type="url"
              value={content.url}
              onChange={(e) => setContent({ url: e.target.value })}
              placeholder="https://..."
              className="h-8 text-sm mt-0.5 rounded-lg"
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground font-medium">キャプション</Label>
            <Input
              value={content.caption}
              onChange={(e) => setContent({ caption: e.target.value })}
              placeholder="画像の説明"
              className="h-8 text-sm mt-0.5 rounded-lg"
            />
          </div>
        </div>
      );

    default:
      return null;
  }
}
