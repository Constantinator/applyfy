import { GuidedFooterStyle } from "@/components/onboarding/guided-footer-style";

// Layout du parcours d'accueil : plein écran, sans barre de navigation ni bouton de Lumeo ; dans le
// pied de page, seuls les liens légaux, cookies et attribution restent.
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <GuidedFooterStyle />
      {children}
    </div>
  );
}
