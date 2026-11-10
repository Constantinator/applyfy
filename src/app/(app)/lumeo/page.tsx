import type { Metadata } from "next";

import { LumeoFullPage } from "@/components/lumeo/lumeo-panel";
import { LUMEO_PANEL_TEXTS as T } from "@/lib/lumeo-texts";

export const metadata: Metadata = { title: T.pageTitle, description: T.pageDescription };

// Lumeo en pleine page : la même conversation que le panneau (LumeoProvider du layout).
export default function LumeoPage() {
  return <LumeoFullPage />;
}
