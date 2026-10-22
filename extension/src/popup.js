// Statut et gestion des accès aux sites. Les sites d'emploi sont accordés à
// l'installation (Firefox peut demander de les confirmer) ; « tous les sites » est optionnel.

const JOB_SITES = chrome.runtime.getManifest().host_permissions;
const ALL_SITES = ["<all_urls>"];

const $ = (id) => document.getElementById(id);

function setStatus(element, granted) {
  element.textContent = granted ? "autorisé" : "non autorisé";
  element.className = `status ${granted ? "ok" : "warn"}`;
}

async function refresh() {
  const [jobSites, allSites] = await Promise.all([
    chrome.permissions.contains({ origins: JOB_SITES }),
    chrome.permissions.contains({ origins: ALL_SITES }),
  ]);
  setStatus($("job-status"), jobSites);
  setStatus($("all-status"), allSites);
  $("grant-job").hidden = jobSites;
  $("grant-all").hidden = allSites;
  $("revoke-all").hidden = !allSites;
}

// permissions.request doit être appelé directement dans le clic (geste utilisateur).
$("grant-job").addEventListener("click", () => {
  chrome.permissions.request({ origins: JOB_SITES }).finally(refresh);
});
$("grant-all").addEventListener("click", () => {
  chrome.permissions.request({ origins: ALL_SITES }).finally(refresh);
});
$("revoke-all").addEventListener("click", () => {
  chrome.permissions.remove({ origins: ALL_SITES }).finally(refresh);
});

refresh();
