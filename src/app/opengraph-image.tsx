import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

// Image de partage par défaut (LinkedIn, Facebook, X) : logo Applyfy et accroche.
export const alt = "Applyfy — Gère tes candidatures et décroche ton job";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const logo = await readFile(join(process.cwd(), "public/images/applyfy-logo.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

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
        borderBottom: "16px solid #1E40AF",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- rendu en image, pas de next/image ici */}
      <img src={logoSrc} width={675} height={240} alt="" />
      <div
        style={{
          marginTop: 32,
          fontSize: 44,
          fontWeight: 700,
          color: "#0F172A",
        }}
      >
        Gère tes candidatures et décroche ton job
      </div>
      <div style={{ marginTop: 16, fontSize: 28, color: "#64748B" }}>
        Suivi, CV et lettre adaptés, rappels de relance
      </div>
    </div>,
    size,
  );
}
