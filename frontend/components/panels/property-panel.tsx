"use client";

import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";
import { CanvasElement, ElementStyle, ListStyle } from "@/lib/types";

export function PropertyPanel() {
  const document = useDocumentStore((s) => s.document);
  const updateElementStyle = useDocumentStore((s) => s.updateElementStyle);
  const updateElementPosition = useDocumentStore((s) => s.updateElementPosition);
  const updateElementContent = useDocumentStore((s) => s.updateElementContent);
  const pushHistory = useDocumentStore((s) => s._pushHistory);
  const { selectedElementId, currentPageIndex } = useUIStore();

  if (!document || !selectedElementId) {
    return (
      <aside className="w-60 border-l bg-card p-4 shrink-0">
        <p className="text-xs text-muted-foreground text-center mt-8">
          要素を選択すると<br />プロパティが表示されます
        </p>
      </aside>
    );
  }

  const page = document.pages[currentPageIndex];
  const element = page?.elements.find((el) => el.id === selectedElementId);
  if (!element) {
    return (
      <aside className="w-60 border-l bg-card p-4 shrink-0">
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
    <aside className="w-60 border-l bg-card shrink-0">
      <ScrollArea className="h-full">
        <div className="p-3 space-y-4">
          {/* Content editing */}
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              コンテンツ
            </h4>
            <ContentEditor content={content} setContent={setContent} />
          </div>

          <Separator />

          {/* Position */}
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              位置・サイズ
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <PositionField label="X" value={position.x} onChange={(v) => setPosition({ x: v })} />
              <PositionField label="Y" value={position.y} onChange={(v) => setPosition({ y: v })} />
              <PositionField label="W" value={position.width} onChange={(v) => setPosition({ width: v })} />
              <PositionField label="H" value={position.height} onChange={(v) => setPosition({ height: v })} />
            </div>
          </div>

          <Separator />

          {/* Style */}
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              スタイル
            </h4>
            <div className="space-y-3">
              {/* Font size */}
              {content.type !== "image" && (
                <div>
                  <Label className="text-[10px] text-muted-foreground">フォントサイズ</Label>
                  <div className="flex items-center gap-1 mt-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setStyle({ fontSize: Math.max(6, (style.fontSize || 11) - 1) })}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Input
                      type="number"
                      value={style.fontSize || 11}
                      onChange={(e) => setStyle({ fontSize: Number(e.target.value) || 11 })}
                      className="h-7 w-14 text-center text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setStyle({ fontSize: Math.min(72, (style.fontSize || 11) + 1) })}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <span className="text-[10px] text-muted-foreground">pt</span>
                  </div>
                </div>
              )}

              {/* Font family */}
              {content.type !== "image" && (
                <div>
                  <Label className="text-[10px] text-muted-foreground">フォント</Label>
                  <div className="flex gap-1 mt-1">
                    <Button
                      variant={style.fontFamily === "serif" ? "default" : "outline"}
                      size="sm"
                      className="h-7 flex-1 text-xs"
                      onClick={() => setStyle({ fontFamily: "serif" })}
                    >
                      明朝
                    </Button>
                    <Button
                      variant={style.fontFamily === "sans" ? "default" : "outline"}
                      size="sm"
                      className="h-7 flex-1 text-xs"
                      onClick={() => setStyle({ fontFamily: "sans" })}
                    >
                      ゴシック
                    </Button>
                  </div>
                </div>
              )}

              {/* Bold / Italic */}
              {content.type !== "image" && (
                <div className="flex gap-1">
                  <Button
                    variant={style.bold ? "default" : "outline"}
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setStyle({ bold: !style.bold })}
                  >
                    <Bold className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant={style.italic ? "default" : "outline"}
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setStyle({ italic: !style.italic })}
                  >
                    <Italic className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}

              {/* Text align */}
              <div>
                <Label className="text-[10px] text-muted-foreground">配置</Label>
                <div className="flex gap-1 mt-1">
                  {([["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]] as const).map(
                    ([align, Icon]) => (
                      <Button
                        key={align}
                        variant={style.textAlign === align ? "default" : "outline"}
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setStyle({ textAlign: align })}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </Button>
                    ),
                  )}
                </div>
              </div>

              {/* Colors */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">文字色</Label>
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      type="color"
                      value={style.textColor || "#000000"}
                      onChange={(e) => setStyle({ textColor: e.target.value })}
                      className="h-7 w-7 rounded border cursor-pointer"
                    />
                    <Input
                      value={style.textColor || ""}
                      onChange={(e) => setStyle({ textColor: e.target.value })}
                      placeholder="auto"
                      className="h-7 text-[10px] flex-1"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">背景色</Label>
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      type="color"
                      value={style.backgroundColor || "#ffffff"}
                      onChange={(e) => setStyle({ backgroundColor: e.target.value })}
                      className="h-7 w-7 rounded border cursor-pointer"
                    />
                    <Input
                      value={style.backgroundColor || ""}
                      onChange={(e) => setStyle({ backgroundColor: e.target.value })}
                      placeholder="none"
                      className="h-7 text-[10px] flex-1"
                    />
                  </div>
                </div>
              </div>

              {/* Border */}
              <div>
                <Label className="text-[10px] text-muted-foreground">枠線</Label>
                <div className="flex items-center gap-1 mt-1">
                  <input
                    type="color"
                    value={style.borderColor || "#000000"}
                    onChange={(e) => setStyle({ borderColor: e.target.value })}
                    className="h-7 w-7 rounded border cursor-pointer"
                  />
                  <Input
                    type="number"
                    value={style.borderWidth || 0}
                    onChange={(e) => setStyle({ borderWidth: Number(e.target.value) })}
                    className="h-7 w-14 text-[10px]"
                    min={0}
                    max={10}
                    step={0.5}
                  />
                  <span className="text-[10px] text-muted-foreground">pt</span>
                </div>
              </div>

              {/* Opacity */}
              <div>
                <Label className="text-[10px] text-muted-foreground">
                  不透明度: {Math.round((style.opacity ?? 1) * 100)}%
                </Label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round((style.opacity ?? 1) * 100)}
                  onChange={(e) => setStyle({ opacity: Number(e.target.value) / 100 })}
                  className="w-full mt-1 accent-primary h-1.5"
                />
              </div>
            </div>
          </div>
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
      <Label className="text-[10px] text-muted-foreground">{label} (mm)</Label>
      <Input
        type="number"
        value={Math.round(value * 10) / 10}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="h-7 text-xs mt-0.5"
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
            className="h-8 text-sm"
          />
          <div className="flex gap-1">
            {([1, 2, 3] as const).map((lvl) => (
              <Button
                key={lvl}
                variant={content.level === lvl ? "default" : "outline"}
                size="sm"
                className="h-7 flex-1 text-xs"
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
          className="text-sm resize-y"
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
                className="h-7 flex-1 text-xs"
                onClick={() => setContent({ style: s as ListStyle })}
              >
                {s === "bullet" ? "箇条書き" : "番号付き"}
              </Button>
            ))}
          </div>
          {content.items.map((item: string, i: number) => (
            <div key={i} className="flex gap-1">
              <span className="flex h-8 w-6 items-center justify-center text-xs text-muted-foreground">
                {content.style === "numbered" ? `${i + 1}.` : "•"}
              </span>
              <Input
                value={item}
                onChange={(e) => {
                  const newItems = [...content.items];
                  newItems[i] = e.target.value;
                  setContent({ items: newItems });
                }}
                className="h-8 text-sm flex-1"
                placeholder={`項目 ${i + 1}`}
              />
              {content.items.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive/50 hover:text-destructive"
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
            className="w-full h-7 text-xs"
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
          <div className="text-[10px] text-muted-foreground">
            {content.headers.length}列 × {content.rows.length}行
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
                  className="h-7 text-[10px] font-semibold"
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
                    className="h-7 text-[10px]"
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-7 text-[10px]"
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
              className="flex-1 h-7 text-[10px]"
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
            <Label className="text-[10px] text-muted-foreground">画像URL</Label>
            <Input
              type="url"
              value={content.url}
              onChange={(e) => setContent({ url: e.target.value })}
              placeholder="https://..."
              className="h-8 text-sm mt-0.5"
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">キャプション</Label>
            <Input
              value={content.caption}
              onChange={(e) => setContent({ caption: e.target.value })}
              placeholder="画像の説明"
              className="h-8 text-sm mt-0.5"
            />
          </div>
        </div>
      );

    default:
      return null;
  }
}
