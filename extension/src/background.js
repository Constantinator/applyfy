// Reçoit les demandes du formulaire Applyfy (via bridge.js), retrouve l'onglet qui
// affiche l'offre collée et en lit le contenu. Aucune donnée n'est conservée.
/* global jobKey */

// Chrome (service worker) charge l'utilitaire ici ; Firefox le charge via le manifest.
if (typeof importScripts === "function" && typeof jobKey === "undefined") importScripts("url-match.js");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Seul le content script injecté dans un onglet Applyfy envoie ce message.
  if (message?.type !== "applyfy:read-tab" || typeof message.url !== "string" || !sender.tab) return;

  readOpenTab(message.url, sender.tab.id).then(sendResponse, (error) => {
    console.warn("[applyfy] lecture de l'onglet impossible", error);
    sendResponse({ found: false });
  });
  return true; // réponse asynchrone
});

async function readOpenTab(url, requesterTabId) {
  const key = jobKey(url);
  if (!key) return { found: false };

  // Sans la permission « tabs », seules les URL des sites autorisés sont visibles :
  // l'extension ne voit jamais les autres onglets.
  const tabs = await chrome.tabs.query({});
  const tab = tabs.find((t) => t.id !== requesterTabId && t.url && jobKey(t.url) === key);
  if (!tab) return { found: false };

  const [injection] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["read-page.js"],
  });
  const page = injection?.result;
  if (!page || typeof page.text !== "string" || !page.text) return { found: false };
  return { found: true, url: tab.url, title: page.title, text: page.text, jsonLd: page.jsonLd };
}
