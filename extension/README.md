# Extension navigateur Applyfy (Chrome + Firefox)

Quand l'utilisateur colle dans le formulaire « Nouvelle candidature » le lien d'une offre
ouverte dans un autre onglet, l'extension lit cet onglet (texte affiché + données
structurées JobPosting) et le transmet à Applyfy, qui pré-remplit les champs. Sans
extension, ou si l'onglet n'est pas ouvert, Applyfy lit la page côté serveur comme avant.

## Fonctionnement

```
Formulaire Applyfy ──postMessage──▶ bridge.js (content script sur Applyfy)
                                        │ runtime.sendMessage
                                        ▼
                                   background.js ── tabs.query → onglet de l'offre (url-match.js)
                                        │           scripting.executeScript(read-page.js)
                                        ▼
Formulaire ◀──postMessage── { found, url, title, text, jsonLd }
    │
    └─▶ importOfferFromPageAction (src/app/actions/offer.ts) : JobPosting, sinon Claude
```

- `manifest.base.json` : manifest commun (MV3). `build.mjs` en dérive les versions Chrome
  (service worker) et Firefox (scripts d'arrière-plan + `gecko.id`).
- Permissions : `scripting` + accès aux sites d'emploi courants et aux domaines Applyfy.
  L'accès à tous les sites (`<all_urls>`) est optionnel, accordé depuis la popup.
  Pas de permission `tabs` : l'extension ne voit l'URL que des onglets des sites autorisés.
- Messages acceptés par `bridge.js` : `applyfy:ping` et `applyfy:read-tab`, uniquement
  depuis la page elle-même (même fenêtre, même origine).

## Construire

```sh
node extension/build.mjs         # production → extension/dist/chrome et extension/dist/firefox
node extension/build.mjs --dev   # + http://localhost (pour npm run dev)
```

## Installer en mode développeur

**Chrome / Edge** : `chrome://extensions` → activer le « Mode développeur » → « Charger
l'extension non empaquetée » → choisir `extension/dist/chrome`. Après une modification :
relancer le build puis cliquer sur ↻ dans la carte de l'extension.

**Firefox** : `about:debugging#/runtime/this-firefox` → « Charger un module complémentaire
temporaire » → choisir `extension/dist/firefox/manifest.json`. Si Firefox n'a pas accordé
l'accès aux sites à l'installation, ouvrir la popup de l'extension → « Autoriser les sites
d'emploi ».

Après l'installation, recharger les onglets Applyfy déjà ouverts (le content script n'est
injecté qu'au chargement de la page).

## Tester

1. Ouvrir une offre (ex. Indeed, JobTeaser, WTTJ) dans un onglet.
2. Copier son URL, ouvrir Applyfy → Nouvelle candidature, coller le lien.
3. Le message « Pré-rempli depuis l'onglet ouvert » confirme que l'extension a servi.
