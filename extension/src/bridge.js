// Content script injecté sur Applyfy : relais entre la page (window.postMessage) et
// l'extension (runtime.sendMessage). N'accepte que les messages de la page elle-même.

function reply(message) {
  window.postMessage(message, location.origin);
}

window.addEventListener("message", (event) => {
  if (event.source !== window || event.origin !== location.origin) return;
  const data = event.data;
  if (!data || typeof data.requestId !== "string") return;

  if (data.type === "applyfy:ping") {
    reply({ type: "applyfy:pong", requestId: data.requestId, version: chrome.runtime.getManifest().version });
    return;
  }

  if (data.type === "applyfy:read-tab" && typeof data.url === "string") {
    const answer = (result) => reply({ ...result, type: "applyfy:read-tab:result", requestId: data.requestId });
    chrome.runtime
      .sendMessage({ type: "applyfy:read-tab", url: data.url })
      .then((result) => answer(result ?? { found: false }), () => answer({ found: false }));
  }
});
