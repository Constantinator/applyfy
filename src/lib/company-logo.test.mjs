// Logo d'entreprise (components/company-logo.tsx) et écrans qui l'affichent : lecture des
// sources. Lancé par `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const SRC = new URL("../", import.meta.url);
const source = (path) => readFileSync(new URL(path, SRC), "utf8");

test("CompanyLogo : n'importe rien qui touche aux secteurs (garde-fou du Tableau de bord)", () => {
  const logo = source("components/company-logo.tsx");
  const imports = [...logo.matchAll(/from\s+["']([^"']+)["']/g)].map(([, spec]) => spec);
  assert.deepEqual(imports, ["next/image", "react"]);
  assert.doesNotMatch(logo, /sector|SectorPill|bg-sector-/i);
});

test("CompanyLogo : chargé par le navigateur, sans relais ni chemin de page transmis, initiales en repli", () => {
  const logo = source("components/company-logo.tsx");
  assert.match(logo, /unoptimized/);
  assert.match(logo, /loading="lazy"/);
  // Restriction de la clé Logo.dev par domaine : contrôle du Referer, une requête sans Referer est refusée.
  assert.match(logo, /referrerPolicy="origin"/);
  assert.match(logo, /width=\{size\}\s+height=\{size\}/);
  assert.match(logo, /onError=/);
  assert.match(logo, /\{initials\(name\)\}/);
  // Carré blanc, aussi en mode sombre : aucune classe dark: sur le carré.
  assert.match(logo, /const TILE = "shrink-0 rounded-xl bg-white ring-1 ring-line";/);
  assert.doesNotMatch(logo, /dark:/);
  assert.match(logo, /36: "h-9 w-9[^"]*",\s+44: "h-11 w-11[^"]*",\s+48: "h-12 w-12[^"]*"/);
});

test("adresse Logo.dev : construite côté serveur seulement, PNG au double de l'affichage, fallback=404", () => {
  const logos = source("lib/company-logos.ts");
  assert.match(logos, /^import "server-only";/);
  assert.match(logos, /size: String\(size \* 2\), format: "png", fallback: "404"/);
  assert.match(logos, /const domain = companyDomain\(input, KNOWN_DOMAINS\);\s+return domain && logoUrl\(domain, size\);/);
  // La clé n'est lue nulle part ailleurs.
  for (const path of ["components/company-logo.tsx", "components/dashboard/applications-list.tsx", "components/dashboard/applications-view.tsx", "components/offers/offer-details.tsx"]) {
    assert.doesNotMatch(source(path), /LOGO_DEV_TOKEN|img\.logo\.dev/, path);
  }
});

test("écrans : logo dans Offres pour toi, /offres (liste et panneau), /candidatures et la fiche ; jamais dans À faire, les e-mails ni la démo", () => {
  assert.match(source("components/dashboard/offers-for-you.tsx"), /<CompanyLogo name=\{offer\.company\} src=\{companyLogo\(\{ name: offer\.company, offerUrl: offer\.url \}, 44\)\} size=\{44\} \/>/);
  assert.match(source("app/(app)/offres/page.tsx"), /src=\{logoOf\(offer, 36\)\}/);
  assert.match(source("app/(app)/offres/page.tsx"), /logo=\{logoOf\(selected, 48\)\}/);
  assert.match(source("components/offers/offer-details.tsx"), /<CompanyLogo name=\{offer\.company\} src=\{logo\} fallbackSrc=\{sourceLogo\} size=\{48\} \/>/);
  assert.match(source("app/(app)/candidatures/page.tsx"), /companyLogo\(\{ name: app\.company, offerUrl: app\.offer_url, contactEmail: app\.contact_email \}, 36\)/);
  assert.match(source("components/dashboard/applications-list.tsx"), /<CompanyLogo name=\{app\.company\} src=\{logos\[app\.id\] \?\? null\} \/>/);
  assert.match(source("app/(app)/candidatures/[id]/page.tsx"), /companyLogo\(\{ name: app\.company, offerUrl: app\.offer_url, contactEmail: app\.contact_email \}, 48\)/);
  for (const path of ["components/dashboard/todo-card.tsx", "components/landing/demo-dashboard.tsx", "lib/email/reminder-email.ts"]) {
    assert.doesNotMatch(source(path), /CompanyLogo|companyLogo|logo\.dev/i, path);
  }
});

test("attribution Logo.dev dans le pied de page commun (pages publiques comprises) et politique de confidentialité à jour", () => {
  const footer = source("components/site-footer.tsx");
  assert.match(footer, /<a href="https:\/\/logo\.dev" className=\{LINK\}>\s+Logos fournis par Logo\.dev\s+<\/a>/);
  assert.match(source("app/layout.tsx"), /<SiteFooter \/>/);
  const policy = source("app/(legal)/politique-confidentialite/page.tsx");
  assert.match(policy, /Affichage des logos d'entreprises \(offres, candidatures, tableau de bord\) : ton navigateur charge chaque logo depuis les serveurs de Logo\.dev, qui reçoivent ton adresse IP et le domaine de l'entreprise concernée \(par exemple qonto\.com\), sans ton nom ni ton adresse e-mail/);
  assert.doesNotMatch(policy, /logos d'entreprises dans « Trouver une offre »/);
});
