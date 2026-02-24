"use client";

import { CanvasElement, ElementStyle } from "@/lib/types";

function styleToCSS(style: ElementStyle): React.CSSProperties {
  const css: React.CSSProperties = {};
  if (style.textColor) css.color = style.textColor;
  if (style.backgroundColor) css.backgroundColor = style.backgroundColor;
  if (style.textAlign) css.textAlign = style.textAlign;
  if (style.fontSize) css.fontSize = `${style.fontSize}pt`;
  if (style.fontFamily === "serif") css.fontFamily = '"Noto Serif JP", "Hiragino Mincho ProN", serif';
  if (style.fontFamily === "sans") css.fontFamily = '"Noto Sans JP", "Hiragino Sans", sans-serif';
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
          style={{ ...css, fontSize: css.fontSize || sizes[content.level], margin: 0, lineHeight: 1.3 }}
          className="whitespace-pre-wrap break-words"
        >
          {content.text || <span className="text-muted-foreground/40">見出しを入力...</span>}
        </Tag>
      );
    }

    case "paragraph":
      return (
        <p style={{ ...css, margin: 0, lineHeight: 1.7 }} className="whitespace-pre-wrap break-words">
          {content.text || <span className="text-muted-foreground/40">テキストを入力...</span>}
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
            <li key={i}>{item || <span className="text-muted-foreground/40">項目...</span>}</li>
          ))}
        </Tag>
      );
    }

    case "table":
      return (
        <div style={css} className="overflow-auto">
          <table className="w-full border-collapse text-left" style={{ fontSize: css.fontSize }}>
            <thead>
              <tr>
                {content.headers.map((h, i) => (
                  <th
                    key={i}
                    className="border border-border bg-muted/50 px-2 py-1 text-xs font-semibold"
                  >
                    {h || "-"}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {content.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="border border-border px-2 py-1 text-xs">
                      {cell || "-"}
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
        <div style={{ ...css, display: "flex", flexDirection: "column", alignItems: css.textAlign === "center" ? "center" : css.textAlign === "right" ? "flex-end" : "flex-start" }}>
          {content.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={content.url}
              alt={content.caption || ""}
              className="max-w-full max-h-full object-contain rounded"
              style={{ display: "block" }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded border-2 border-dashed border-muted-foreground/20 bg-muted/30 text-muted-foreground/40 text-xs">
              画像URLを設定
            </div>
          )}
          {content.caption && (
            <p className="mt-1 text-[9px] text-muted-foreground">{content.caption}</p>
          )}
        </div>
      );

    default:
      return null;
  }
}
