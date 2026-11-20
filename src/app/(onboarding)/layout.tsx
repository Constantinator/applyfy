// Layout du parcours d'accueil : plein écran, sans barre de navigation ni bouton de Lumeo.
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col">{children}</div>;
}
