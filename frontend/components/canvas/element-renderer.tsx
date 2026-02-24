"use client";

import { CanvasElement, ElementStyle } from "@/lib/types";

function styleToCSS(style: ElementStyle): React.CSSProperties {
  const css: React.CSSProperties = {};
  if (style.textColor) css.color = style.textColor;
  if (style.backgroundColor) css.backgroundColor = style.backgroundColor;
  if (style.textAlign) css.textAlign = style.textAlign;
  if (style.fontSize) css.fontSize = `${style.fontSize}pt`;
  if (style.fontFamily === "serif") css.fontFamily = '"Hiragino Mincho ProN", "Noto Serif JP", serif';
  if (style.fontFamily === "sans") css.fontFamily = '"Hiragino Sans", "Noto Sans JP", sans-serif';
  if (style.bold) css.fontWeight = "bold";
  if (style.italic) css.fontStyle = "italic";
  if (style.borderColor) css.borderColor = style.borderColor;
  if (style.borderWidth) {
    css.borderWidth = `${style.borderWidth}pt`;
    css.borderStyle = "solid";
  }
  if (style.borderRadius) css.borderRadius = `${style.borderRadius}mm`;
  if (style.padding) css.padding = `${style.padding}mm`;
  if (style.opacity !== undefined) css.opacity = style.opacity;
  return css;
}

export function ElementRenderer({ element }: { element: CanvasElement }) {
  const { content, style } = element;
  const css = styleToCSS(style);

  switch (content.type) {
    case "heading": {
      const Tag = content.level === 1 ? "h1" : content.level === 2 ? "h2" : "h3";
      const sizes = { 1: "1.8em", 2: "1.4em", 3: "1.1em" };
      return (
        <Tag
          style={{ ...css, fontSize: css.fontSize || sizes[content.level], margin: 0, lineHeight: 1.3, letterSpacing: "-0.01em" }}
          className="whitespace-pre-wrap break-words"
        >
          {content.text || <span className="text-muted-foreground/30 italic font-normal text-[0.6em]">見出しを入力...</span>}
        </Tag>
      );
    }

    case "paragraph":
      return (
        <p style={{ ...css, margin: 0, lineHeight: 1.7 }} className="whitespace-pre-wrap break-words">
          {content.text || <span className="text-muted-foreground/30 italic text-[0.85em]">テキストを入力...</span>}
        </p>
      );

    case "list": {
      const Tag = content.style === "numbered" ? "ol" : "ul";
      return (
        <Tag
          style={{ ...css, margin: 0, paddingLeft: "1.5em", lineHeight: 1.7 }}
          className="whitespace-pre-wrap break-words"
        >
          {content.items.map((item, i) => (
            <li key={i}>{item || <span className="text-muted-foreground/30 italic text-[0.85em]">項目...</span>}</li>
          ))}
        </Tag>
      );
    }

    case "table":
      return (
        <div style={css} className="overflow-auto h-full">
          <table className="w-full border-collapse text-left" style={{ fontSize: css.fontSize }}>
            <thead>
              <tr>
                {content.headers.map((h, i) => (
                  <th
                    key={i}
                    className="border border-border/60 bg-muted/40 px-2.5 py-1.5 text-xs font-semibold"
                  >
                    {h || <span className="text-muted-foreground/30">—</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {content.rows.map((row, ri) => (
                <tr key={ri} className="transition-colors hover:bg-muted/20">
                  {row.map((cell, ci) => (
                    <td key={ci} className="border border-border/40 px-2.5 py-1.5 text-xs">
                      {cell || <span className="text-muted-foreground/20">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "image":
      return (
        <div style={{ ...css, display: "flex", flexDirection: "column", height: "100%", alignItems: css.textAlign === "center" ? "center" : css.textAlign === "right" ? "flex-end" : "flex-start" }}>
          {content.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={content.url}
              alt={content.caption || ""}
              className="max-w-full max-h-full object-contain rounded"
              style={{ display: "block" }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/15 bg-muted/20 text-muted-foreground/30 text-xs gap-1.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
              画像URLを設定
            </div>
          )}
          {content.caption && (
            <p className="mt-1 text-[9px] text-muted-foreground/70 italic">{content.caption}</p>
          )}
        </div>
      );

    default:
      return null;
  }
}
