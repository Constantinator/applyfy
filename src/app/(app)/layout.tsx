import { AppSidebar } from "@/components/app-sidebar";
import { WelcomeDialog } from "@/components/onboarding/welcome-dialog";
import { getAccountName, needsOnboarding } from "@/lib/account";
import { isAdminEmail } from "@/lib/admin-metrics";
import { getCurrentUser } from "@/lib/auth";
import { getMyBeta } from "@/lib/beta";

// Layout de l'application (dashboard, candidatures, profil) : sidebar + contenu.
// L'accès est protégé par le proxy (redirection) et par requireUser() dans la couche de données.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // Écran de bienvenue à la première connexion. Non bloquant : en cas d'erreur, pas d'écran.
  const [showWelcome, accountName, beta] = await Promise.all([
    needsOnboarding().catch((error) => {
      console.error("[onboarding]", error);
      return false;
    }),
    getAccountName().catch(() => null),
    getMyBeta(), // sans échec : null si indisponible
  ]);

  return (
    <div className="flex flex-1 flex-col lg:flex-row print:block">
      <AppSidebar
        email={user?.email ?? null}
        isAdmin={isAdminEmail(user?.email)}
        isBetaTester={beta?.status === "active"}
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      {showWelcome && <WelcomeDialog firstName={accountName?.firstName ?? null} />}
    </div>
  );
}
