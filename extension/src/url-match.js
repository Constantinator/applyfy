// Identifiant d'une offre à partir de son URL, pour retrouver l'onglet qui l'affiche
// même si l'URL collée et celle de l'onglet diffèrent un peu (paramètres de suivi,
// « www. », « / » final, ancre, vue liste/détail d'Indeed et LinkedIn).
/* exported jobKey */

const TRACKING_PARAM = /^(utm_|mc_|_hs|fbclid$|gclid$|msclkid$|ref$|refid$|referrer$|trk|tracking|src$|source$|from$|origin$|xtor$|position$|pagenum$)/i;

function jobKey(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  // Indeed : la même offre s'ouvre en page (viewjob?jk=…) ou dans la liste (jobs?…&vjk=…).
  if (/(^|\.)indeed\.[a-z.]+$/.test(host)) {
    const id = url.searchParams.get("jk") || url.searchParams.get("vjk");
    if (id) return `indeed:${id}`;
  }
  // LinkedIn : /jobs/view/<slug->123 ou liste avec ?currentJobId=123.
  if (/(^|\.)linkedin\.com$/.test(host)) {
    const id = url.pathname.match(/\/jobs\/view\/(?:[^/]*-)?(\d+)/)?.[1] || url.searchParams.get("currentJobId");
    if (id) return `linkedin:${id}`;
  }

  const params = [...url.searchParams]
    .filter(([name]) => !TRACKING_PARAM.test(name))
    .sort(([a], [b]) => a.localeCompare(b));
  const path = url.pathname.replace(/\/+$/, "") || "/";
  return `${host}${path}${params.length ? `?${new URLSearchParams(params)}` : ""}`;
}

if (typeof module !== "undefined") module.exports = { jobKey }; // tests Node
