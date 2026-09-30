import Link from "next/link";

// Écran 2 — formulaire (offre + profil étudiant + assistant de rédaction). À construire.
export default function NewApplicationPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-900">
        ← Retour au dashboard
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-slate-900">Nouvelle candidature</h1>
      <p className="mt-2 text-slate-500">Formulaire à venir.</p>
    </main>
  );
}
