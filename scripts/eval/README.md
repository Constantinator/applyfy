# Banc d'essai du coach du CV Builder

Script **local** qui mesure la qualité du coach avant de toucher à son prompt. Il n'est jamais
importé par l'application, jamais déployé (`.vercelignore`, exclu du `tsconfig.json` racine) et
jamais lancé en CI.

## Lancer

```bash
npm run eval:coach -- --dry                    # réponses simulées : aucun appel, 0 €
npm run eval:coach -- --dry --holdout          # idem, avec le jeu tenu à l'écart
npm run eval:typecheck                         # typecheck du banc d'essai (et des modules de src/lib qu'il importe)
node --import ./scripts/eval/register.mjs scripts/eval/calibrate.ts --detail   # score de départ des profils
```

Options : `--only id1,id2`, `--case libre|lie`, `--repeat N` (3 par défaut), `--max-turns N`
(10 par défaut), `--concurrency N` (4 par défaut), `--holdout`.

### Vrai run (payant)

1. Créer une clé dédiée avec une limite de dépense dans la console Anthropic.
2. La mettre dans l'environnement local du terminal, avec le plafond :
   `EVAL_ANTHROPIC_API_KEY` et `EVAL_MAX_COST_EUR` (ex. 35). Le script ne lit **aucune autre clé**
   (ni `ANTHROPIC_API_KEY`, ni `.env.local`) et refuse de démarrer sans ces deux variables.
3. Lancer sans `--dry` : le script affiche l'estimation (calculée en local, sans appel), puis
   demande une confirmation `o/N` dans le terminal. Sans terminal interactif, il annule.
4. Avant chaque appel, il vérifie que la dépense, les appels en cours et le pire coût de l'appel
   restent sous le plafond ; sinon il s'arrête et écrit un rapport partiel marqué « interrompu ».

Premier vrai run conseillé : petit (`--repeat 1 --only …`, environ 5 à 7 €), puis le run complet.

## Ce qui tourne

Le vrai pipeline de l'application, sans copie de la logique :

| Étape | Code de l'application |
|---|---|
| Contexte du score (secteur de l'offre pour un CV lié) | `scoringOfferFor`, `cvScoringSector`, `scoringContextForSector` |
| Contexte du coach | `buildCoachContext` (`src/lib/coach-context.ts`) |
| Premier message, réponses, second essai | `coachOpening`, `coachBuilderCv` (`src/lib/coach-llm.ts`), client injecté |
| Vérification, application, texte affiché | `runCoachTurn` (`src/lib/coach-turn.ts`) : `checkProposal`, `coachReplyText`… |
| Score | `scoreCv` |

Seules les lectures sont remplacées : la candidature liée est une offre synthétique
(`fixtures/offers.json`), les mots-clés du marché sont figés (`fixtures/market-keywords.json`) au
lieu de la table `job_keywords`. L'historique suit l'éditeur : premier message compris, messages
d'erreur exclus, points abandonnés cumulés, 30 échanges au plus. Le candidat simulé a toujours des
adaptations disponibles (le cas « quota épuisé » n'est pas joué).

Modèles : coach = celui de l'application (`modelFor`, surcharge `CLAUDE_MODEL_COACH` comprise) ;
faux candidat = Claude Haiku 5.5 (`EVAL_SIMULATOR_MODEL`) ; juge = Claude Opus 5.5
(`EVAL_JUDGE_MODEL`). Le faux candidat et le juge ne voient jamais le prompt du coach.

## Fixtures (100 % synthétiques, versionnées)

- `fixtures/profiles/dev/` : 8 profils ; `fixtures/profiles/holdout/` : 4 profils **tenus à
  l'écart** — on ne les regarde pas pendant les améliorations de prompt.
- `fixtures/scenarios.json` : 30 scénarios de développement (21 CV libre, 9 CV lié) et 10 tenus à
  l'écart. `behavior` guide le faux candidat ; `expect` décrit les vérifications ; `dryMessages`
  sert au mode `--dry`.
- `fixtures/personas.json` : patient, pressé, vague, bavard.

## Rapport (`eval-runs/<date>/`, gitignoré)

- `report.md` : coût, puis **deux rapports séparés** (CV libre, CV lié) avec un tableau par
  scénario (médiane sur les lancements, ⚠ instable si l'écart est grand), les causes de refus,
  les pistes et les 3 pires conversations en entier ; jeu tenu à l'écart en agrégats seulement ;
  comparaison avec le dernier run complet sur les mêmes fixtures.
- `report.json` : tout pour le jeu de développement ; seulement des agrégats pour le jeu tenu à
  l'écart.

Les pistes sont des propositions : **rien n'est modifié automatiquement**. Chaque changement de
prompt est validé à la main.

## Métriques automatiques (`metrics.ts`)

Delta de score ; messages jusqu'à 80 ; questions de parcours après 80 ; refus de la vérification
et leurs causes (première réponse, puis après le second essai) ; nombres du CV final absents du CV
de départ et des messages du candidat ; questions répétées ; messages du coach dans une autre langue
que celle du candidat ; demande explicite exécutée ; titre du CV proposé plus d'une fois ou changé
sans accord (CV lié) ; secteur détecté ; injection suivie ; écart avec l'offre ou le poste dit
(heuristique, le juge le note aussi).

## Mode --dry

Faux coach, faux candidat et faux juge déterministes, sans réseau. Le faux coach passe exprès par
les cas d'échec (puce refusée, second essai, nombre inventé, question répétée, injection suivie,
réponse en français à un candidat anglophone) : le rapport doit les montrer. Le coût affiché est
simulé, et le plafond est vérifié comme pour un vrai run.
