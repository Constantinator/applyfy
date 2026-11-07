import { ImageResponse } from "next/og";

// Image de partage par défaut (LinkedIn, Facebook, X) : logo Applyfy et accroche, en noir et bleu.
export const alt = "Applyfy — Gère tes candidatures et décroche ton job";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "white",
        borderBottom: "16px solid #2563EB",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <svg width="150" height="150" viewBox="0 0 48 48">
          <path
            d="M9 38 L24 8 L39 38"
            fill="none"
            stroke="#0A0A0A"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="24" cy="30" r="4.2" fill="#2563EB" />
        </svg>
        <div style={{ fontSize: 120, fontWeight: 700, letterSpacing: "-0.03em", color: "#0A0A0A" }}>Applyfy</div>
      </div>
      <div style={{ marginTop: 32, fontSize: 44, fontWeight: 700, color: "#0A0A0A" }}>
        Gère tes candidatures et décroche ton job
      </div>
      <div style={{ marginTop: 16, fontSize: 28, color: "#6B6B6B" }}>
        Suivi, CV et lettre adaptés, rappels de relance
      </div>
    </div>,
    size,
  );
}
