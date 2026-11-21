import { AppNavProvider } from "@/components/app-nav-context";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppTopbar } from "@/components/app-topbar";
import { LumeoProvider } from "@/components/lumeo/lumeo-panel";
import { getAccountName } from "@/lib/account";
import { isAdminEmail } from "@/lib/admin-metrics";
import { getCurrentUser } from "@/lib/auth";
import { getMyBeta } from "@/lib/beta";
import { isClaudeConfigured } from "@/lib/claude";
import { lumeoMockEnabled } from "@/lib/lumeo-mock";
import { countMyUnreadBetaMessages, countUnreadForAdmin } from "@/lib/beta-messages";
import { PATH_HEADER } from "@/lib/onboarding";
import { getOnboardingEntry } from "@/lib/onboarding-server";
import { accountInitials } from "@/lib/person-name";
import { isAdminConfigured } from "@/lib/supabase/admin";

// Layout de l'application (dashboard, candidatures, profil) : barre de navigation + contenu.
// L'accès est protégé par le proxy (redirection) et par requireUser() dans la couche de données.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Filet du parcours d'accueil : /dashboard demandé sans paramètre (connexion, adresse tapée) par
  // un compte qui doit suivre le parcours → redirection AVANT de rendre la barre (sinon elle
  // s'affiche un instant). Avec paramètres (retour de Stripe…), la page décide, comme avant.
  // Même règle que la page du tableau de bord ; ancien compte : aucune lecture en base.
  if ((await headers()).get(PATH_HEADER) === "/dashboard") {
    const onboarding = await getOnboardingEntry();
    if (onboarding) redirect(onboarding.target.kind === "editeur" ? `/cv-builder/${onboarding.target.cvId}` : "/bienvenue");
  }
  const user = await getCurrentUser();
  const isAdmin = isAdminEmail(user?.email);
  const [beta, unreadBeta, unreadAdmin, accountName] = await Promise.all([
    getMyBeta(), // sans échec : null si indisponible
    // Badges de la messagerie beta (sans échec : 0 si la table n'existe pas encore).
    countMyUnreadBetaMessages(),
    isAdmin && isAdminConfigured() ? countUnreadForAdmin() : Promise.resolve(0),
    // Initiales de l'avatar : à défaut du nom, l'initiale de l'e-mail.
    user ? getAccountName().catch(() => null) : null,
  ]);

  const content = (
    <>
      <AppTopbar
        email={user?.email ?? null}
        initials={accountInitials(accountName, user?.email ?? null)}
        isAdmin={isAdmin}
        isBetaTester={beta?.status === "active"}
        unreadBeta={unreadBeta}
        unreadAdmin={unreadAdmin}
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </>
  );

  return (
    // AppNavProvider : panneau Menu et garde de sortie des pages en plein écran (éditeur du CV Builder).
    <AppNavProvider>
      {/* data-theme-scope : zone concernée par le mode sombre (cf. globals.css). */}
      <div data-theme-scope className="flex flex-1 flex-col print:block">
        {user ? (
          // Lumeo : panneau et boutons (barre du haut sur mobile, rond en bas à droite sur ordinateur).
          <LumeoProvider aiEnabled={isClaudeConfigured() || lumeoMockEnabled()}>{content}</LumeoProvider>
        ) : (
          content
        )}
      </div>
    </AppNavProvider>
  );
}
