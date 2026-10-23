import { AppSidebar } from "@/components/app-sidebar";
import { OnboardingModal } from "@/components/OnboardingModal";
import { WelcomePremiumModal } from "@/components/onboarding/welcome-premium-modal";
import { isAdminEmail } from "@/lib/admin-metrics";
import { getCurrentUser } from "@/lib/auth";
import { getMyBeta } from "@/lib/beta";
import { countMyUnreadBetaMessages, countUnreadForAdmin } from "@/lib/beta-messages";
import { isPremium } from "@/lib/subscription";
import { isAdminConfigured } from "@/lib/supabase/admin";

// Layout de l'application (dashboard, candidatures, profil) : sidebar + contenu.
// L'accès est protégé par le proxy (redirection) et par requireUser() dans la couche de données.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const isAdmin = isAdminEmail(user?.email);
  const [beta, unreadBeta, unreadAdmin, premium] = await Promise.all([
    getMyBeta(), // sans échec : null si indisponible
    // Badges de la messagerie beta (sans échec : 0 si la table n'existe pas encore).
    countMyUnreadBetaMessages(),
    isAdmin && isAdminConfigured() ? countUnreadForAdmin() : Promise.resolve(0),
    isPremium(), // sans échec : abonnement Stripe en cours ou beta testeur actif
  ]);

  return (
    // data-theme-scope : zone concernée par le mode sombre (cf. globals.css).
    <div data-theme-scope className="flex flex-1 flex-col lg:flex-row print:block">
      <AppSidebar
        email={user?.email ?? null}
        isAdmin={isAdmin}
        isBetaTester={beta?.status === "active"}
        unreadBeta={unreadBeta}
        unreadAdmin={unreadAdmin}
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      {/* Présentation animée à la première connexion (mémorisée dans le navigateur). */}
      <OnboardingModal />
      {/* Prix de lancement du Premium, après la présentation (une seule fois). */}
      {!premium && <WelcomePremiumModal />}
    </div>
  );
}
