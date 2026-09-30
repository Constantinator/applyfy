import { AppSidebar } from "@/components/app-sidebar";
import { getCurrentUser } from "@/lib/auth";

// Layout de l'application (dashboard, candidatures, profil) : sidebar + contenu.
// L'accès est protégé par le proxy (redirection) et par requireUser() dans la couche de données.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-1 flex-col lg:flex-row print:block">
      <AppSidebar email={user?.email ?? null} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
