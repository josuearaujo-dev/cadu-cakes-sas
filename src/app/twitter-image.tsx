import { ImageResponse } from "next/og";

export const alt = "Cadu Cakes — Sistema Financeiro";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #fff8f4 0%, #f7ece4 45%, #e1d3c7 100%)",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 36,
            padding: "48px 64px",
            borderRadius: 32,
            background: "rgba(255,255,255,0.88)",
            boxShadow: "0 24px 60px rgba(83, 27, 4, 0.14)",
            border: "1px solid rgba(83, 27, 4, 0.12)",
          }}
        >
          <div
            style={{
              width: 140,
              height: 140,
              borderRadius: 999,
              background: "linear-gradient(145deg, #fff8f4, #e1d3c7)",
              border: "4px solid #531b04",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 52,
              fontWeight: 800,
              color: "#531b04",
            }}
          >
            CC
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <span style={{ fontSize: 64, fontWeight: 800, color: "#531b04", letterSpacing: "-0.02em" }}>
              Cadu Cakes
            </span>
            <span style={{ fontSize: 32, fontWeight: 600, color: "#6f5243" }}>Sistema Financeiro</span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
