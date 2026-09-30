import { AppHeader } from "@/components/app-header";
import { getCurrentUser } from "@/lib/auth";

// Layout de l'application (dashboard, candidatures).
// L'accès est protégé par le proxy (redirection) et par requireUser() dans la couche de données.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <>
      <AppHeader user={user} />
      {children}
    </>
  );
}
