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
5. **Désactiver les inscriptions publiques** : Authentication > Sign In / Providers >
   décocher *Allow new users to sign up* (les invitations continuent de fonctionner).
6. **Template d'invitation** : Authentication > Emails > *Invite user*, remplacer le lien par
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite`
7. Recommandé : *Password requirements* aligné sur les règles de l'app
   (8 caractères, majuscule, chiffre, caractère spécial).

## Déployer sur Vercel

1. Pousser le dépôt sur GitHub (ou GitLab / Bitbucket).
2. Sur vercel.com : *Add New… > Project*, importer le dépôt. Le preset **Next.js** est
   détecté automatiquement (build `next build`, aucune config supplémentaire).
3. *Settings > Environment Variables* : ajouter pour **Production** et **Preview** les
   variables de `.env.example` :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

   Ce sont des variables `NEXT_PUBLIC_*` : elles sont intégrées au build, donc
   **redéployer** après toute modification. Si elles manquent, le build de production
   échoue volontairement (garde-fou dans `next.config.ts`) ; les déploiements Preview
   sans variables tournent en mode démo.
4. Côté Supabase, avec le domaine Vercel (ex. `https://applyfy.vercel.app`) :
   - *Site URL* = le domaine de production ;
   - *Redirect URLs* : ajouter `https://applyfy.vercel.app/auth/confirm`
     (et `https://*-<équipe>.vercel.app/auth/confirm` pour les previews si besoin).
5. Tester : inscription à la liste d'attente, invitation d'un email de test,
   activation du compte, connexion.

## Authentification (accès sur invitation)

- Les visiteurs s'inscrivent sur la liste d'attente (table `waitlist`).
- Pour donner accès : Supabase > Authentication > Users > *Invite user* avec l'email.
- L'invité clique sur le lien → `/auth/confirm` ouvre sa session → `/signup` où il
  définit son mot de passe (drapeau `password_set` dans `user_metadata`) → `/dashboard`.
- Ensuite il se connecte via `/login`. `/signup` est inaccessible sans lien d'invitation.
- `src/proxy.ts` rafraîchit la session et redirige : non connecté → `/login`,
  invité sans mot de passe → `/signup`, connecté sur `/login` → `/dashboard`.
- `requireUser()` (`src/lib/auth.ts`) est appelé à chaque accès aux données, et les
  tables sont protégées par RLS (`user_id = auth.uid()`) : chaque utilisateur ne voit
  que ses propres candidatures.

## Structure

```
src/
  proxy.ts                         # Session Supabase + redirections d'authentification
  app/
    page.tsx                       # Landing page (/) + liste d'attente
    (auth)/login, (auth)/signup    # Connexion, activation de compte invité
    auth/confirm/route.ts          # Lien d'invitation Supabase
    (app)/dashboard/               # Dashboard des candidatures
    (app)/candidatures/[id]/       # Fiche candidature (historique, relance, documents)
    (app)/candidatures/nouvelle/   # Formulaire + assistant (à venir)
    actions/                       # Server Actions (auth, candidatures, liste d'attente)
  components/                      # UI (landing, auth, dashboard, fiche candidature)
  lib/
    applications.ts                # Accès aux données + règles de relance
    auth.ts                        # getCurrentUser / requireUser
    password.ts                    # Règles de mot de passe
    supabase/{server,client}.ts    # Clients Supabase
    demo-data.ts                   # Données du mode démo
supabase/migrations/               # Schéma SQL (à exécuter dans l'ordre)
```
