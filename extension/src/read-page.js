// Injecté dans l'onglet de l'offre : la valeur de la dernière expression est renvoyée
// à l'extension. On lit le texte affiché (en-tête de l'offre compris) et les données
// structurées JobPosting, que Applyfy exploite sans IA quand elles existent.
(() => {
  const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')]
    .map((script) => script.textContent || "")
    .filter((raw) => raw.includes("JobPosting"))
    .slice(0, 3)
    .map((raw) => raw.slice(0, 50000));
  const text = (document.body?.innerText || "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 40000);
  return { title: document.title.slice(0, 500), text, jsonLd };
})();
