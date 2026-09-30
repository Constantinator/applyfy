# Applyfy

Plateforme de suivi de candidatures pour étudiants en recherche d'emploi — Next.js 16 (App Router) + Tailwind 4 + Supabase.

## Démarrer en local

Prérequis : Node.js ≥ 20.9.

```bash
npm install
npm run dev
```

Sans `.env.local`, l'app tourne en **mode démo** (données fictives de `src/lib/demo-data.ts`, pas de comptes).

Scripts utiles : `npm run lint`, `npm run typecheck`, `npm run build`.

## Brancher Supabase

1. Créer un projet sur supabase.com.
2. Exécuter les fichiers de `supabase/migrations/` **dans l'ordre**, dans le SQL Editor.
3. Copier `.env.example` en `.env.local` et renseigner l'URL et la clé publishable.
4. Authentication > URL Configuration : définir la *Site URL* et ajouter
   `<URL>/auth/confirm` aux *Redirect URLs* (en local : `http://localhost:3000/auth/confirm`).
5. **Autoriser les inscriptions** : Authentication > Sign In / Providers >
   *Allow new users to sign up* doit être coché.
6. *Confirm email* (même écran) :
   - désactivé → l'utilisateur arrive directement sur le dashboard après l'inscription ;
   - activé → il reçoit un lien de confirmation (→ `/auth/confirm` → `/dashboard`).
     En production, configurer un SMTP (Authentication > Emails > SMTP Settings) :
     l'envoi d'emails intégré de Supabase est très limité.
7. Recommandé : *Password requirements* aligné sur les règles de l'app
   (8 caractères, majuscule, chiffre, caractère spécial).

## Assistant IA (Claude)

- **Import depuis un lien** : dans le formulaire d'ajout, coller le lien d'une offre pré-remplit
  poste, entreprise, localisation (et description si vide). Données structurées schema.org
  `JobPosting` en priorité ; sinon extraction par Claude. La page est récupérée côté serveur
  avec des protections SSRF (`src/lib/offer-import.ts`).
- **Résumé de l'offre** : bouton « Générer un résumé » (missions, profil, avantages), modifiable
  et enregistré avec la candidature (colonne `offer_summary`, migration `0004`).
- **Adapter mon CV** (fiche candidature) : upload d'un CV PDF (3,5 Mo max) analysé avec
  l'offre → expériences à mettre en avant, mots-clés manquants, points forts. Le CV n'est pas
  stocké ; les suggestions le sont (colonnes `cv_suggestions*`, migration `0005`).
- Nécessite `ANTHROPIC_API_KEY` côté serveur (voir `.env.example`). Modèle : `claude-opus-5-5`
  (`src/lib/claude.ts`).

## Déployer sur Vercel

1. Pousser le dépôt sur GitHub (ou GitLab / Bitbucket).
2. Sur vercel.com : *Add New… > Project*, importer le dépôt. Le preset **Next.js** est
   détecté automatiquement (build `next build`, aucune config supplémentaire).
3. *Settings > Environment Variables* : ajouter pour **Production** et **Preview** les
   variables de `.env.example` :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `ANTHROPIC_API_KEY` (secrète, pour l'assistant IA)

   Ce sont des variables `NEXT_PUBLIC_*` : elles sont intégrées au build, donc
   **redéployer** après toute modification. Si elles manquent, le build de production
   échoue volontairement (garde-fou dans `next.config.ts`) ; les déploiements Preview
   sans variables tournent en mode démo.
4. Côté Supabase, avec le domaine Vercel (ex. `https://applyfy.vercel.app`) :
   - *Site URL* = le domaine de production ;
   - *Redirect URLs* : ajouter `https://applyfy.vercel.app/auth/confirm`
     (et `https://*-<équipe>.vercel.app/auth/confirm` pour les previews si besoin).
5. Tester : création de compte depuis la landing, accès au dashboard, déconnexion, connexion.

## Authentification

- Parcours : landing → `/signup` (email + mot de passe + confirmation) → `/dashboard`.
- `/login` pour les comptes existants.
- `src/proxy.ts` rafraîchit la session et redirige : non connecté → `/login`,
  connecté sur `/login` ou `/signup` → `/dashboard`.
- `requireUser()` (`src/lib/auth.ts`) est appelé à chaque accès aux données, et les
  tables sont protégées par RLS (`user_id = auth.uid()`) : chaque utilisateur ne voit
  que ses propres candidatures.

## Structure

```
src/
  proxy.ts                         # Session Supabase + redirections d'authentification
  app/
    page.tsx                       # Landing page (/)
    (auth)/login, (auth)/signup    # Connexion, création de compte
    auth/confirm/route.ts          # Lien de confirmation d'email Supabase
    (app)/dashboard/               # Dashboard des candidatures
    (app)/candidatures/[id]/       # Fiche candidature (historique, relance, documents)
    (app)/candidatures/nouvelle/   # Formulaire + assistant (à venir)
    actions/                       # Server Actions (auth, candidatures)
  components/                      # UI (landing, auth, dashboard, fiche candidature)
  lib/
    applications.ts                # Accès aux données + règles de relance
    auth.ts                        # getCurrentUser / requireUser
    password.ts                    # Règles de mot de passe
    supabase/{server,client}.ts    # Clients Supabase
    demo-data.ts                   # Données du mode démo
supabase/migrations/               # Schéma SQL (à exécuter dans l'ordre)
```
