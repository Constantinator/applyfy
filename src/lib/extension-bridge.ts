// Dialogue avec l'extension navigateur Applyfy (dossier extension/), côté client.
// Son content script relaie les messages window.postMessage de la page vers
// l'extension, qui lit l'onglet affichant l'offre collée.

import type { OpenTabPage } from "@/lib/offer-import";

/** Réponse au ping : l'extension est absente si rien ne répond dans ce délai. */
const PING_TIMEOUT_MS = 300;
/** Recherche de l'onglet + lecture du contenu de la page. */
const READ_TIMEOUT_MS = 4000;

type Reply = Record<string, unknown>;

function request(message: Reply, replyType: string, timeoutMs: number): Promise<Reply | null> {
  const requestId = crypto.randomUUID();
  return new Promise((resolve) => {
    const done = (value: Reply | null) => {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      resolve(value);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const data = event.data as Reply | null;
      if (data?.type === replyType && data.requestId === requestId) done(data);
    };
    const timer = setTimeout(() => done(null), timeoutMs);
    window.addEventListener("message", onMessage);
    window.postMessage({ ...message, requestId }, window.location.origin);
  });
}

let available: Promise<boolean> | null = null;

export function isExtensionAvailable(): Promise<boolean> {
  available ??= request({ type: "applyfy:ping" }, "applyfy:pong", PING_TIMEOUT_MS).then(Boolean);
  return available;
}

/** Contenu de l'onglet qui affiche cette offre, ou null (extension absente, onglet non ouvert…). */
export async function readOpenTab(url: string): Promise<OpenTabPage | null> {
  if (!(await isExtensionAvailable())) return null;
  const result = await request({ type: "applyfy:read-tab", url }, "applyfy:read-tab:result", READ_TIMEOUT_MS);
  if (!result?.found || typeof result.text !== "string") return null;
  return {
    url: typeof result.url === "string" ? result.url : url,
    title: typeof result.title === "string" ? result.title : "",
    text: result.text,
    jsonLd: Array.isArray(result.jsonLd)
      ? result.jsonLd.filter((block): block is string => typeof block === "string")
      : [],
  };
}
