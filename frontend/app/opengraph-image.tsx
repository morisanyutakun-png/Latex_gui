import { ImageResponse } from "next/og";

// Next.js File-based OG: このファイルをそのまま `/opengraph-image` として PNG 配信する。
// 1200x630 が Twitter / Slack / LINE など主要プラットフォームの推奨サイズ。
// Satori は CSS のサブセットしかサポートしないので inline-style のみ・display:flex 必須に注意。

export const runtime = "edge";
export const alt = "Eddivom — AI worksheet IDE";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background:
            "linear-gradient(135deg, #1e1b4b 0%, #312e81 30%, #6d28d9 60%, #be185d 100%)",
          color: "#ffffff",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        {/* Dot grid overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            opacity: 0.6,
          }}
        />

        {/* Top: brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              background: "linear-gradient(135deg, #60a5fa, #a78bfa, #f0abfc)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 12px 32px rgba(124, 58, 237, 0.45)",
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 6h10M5 12h7M5 18h10"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle
                cx="18"
                cy="12"
                r="3"
                stroke="white"
                strokeWidth="2"
                fill="white"
                fillOpacity="0.3"
              />
            </svg>
          </div>
          <div
            style={{
              fontSize: 40,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              display: "flex",
            }}
          >
            Eddivom
          </div>
          <div
            style={{
              marginLeft: "auto",
              padding: "8px 18px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.25)",
              fontSize: 18,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
            }}
          >
            AI worksheet IDE
          </div>
        </div>

        {/* Middle: headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 92,
              fontWeight: 800,
              letterSpacing: "-0.035em",
              lineHeight: 1.05,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span style={{ display: "flex" }}>Worksheets, faster.</span>
            <span
              style={{
                display: "flex",
                background:
                  "linear-gradient(90deg, #93c5fd, #c4b5fd, #f9a8d4)",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              Answer keys, automatic.
            </span>
          </div>
          <div
            style={{
              fontSize: 28,
              color: "rgba(255,255,255,0.75)",
              fontWeight: 400,
              maxWidth: 920,
              display: "flex",
            }}
          >
            AI generates problems, multiplies variants, and exports
            print-ready PDFs with answer keys.
          </div>
        </div>

        {/* Bottom: flow strip — Ask -> AI -> PDF */}
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          {[
            { tag: "1. Ask", body: "10 quadratic problems" },
            { tag: "2. AI builds", body: "x² + 3x   ∫f(x)dx   ax+b" },
            { tag: "3. PDF ready", body: "f(x) = ax² + bx + c" },
          ].map((step, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                flex: 1,
                flexDirection: "column",
                gap: 8,
                padding: "16px 20px",
                borderRadius: 16,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.18)",
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.7)",
                  display: "flex",
                }}
              >
                {step.tag}
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 600,
                  color: "#ffffff",
                  display: "flex",
                }}
              >
                {step.body}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
