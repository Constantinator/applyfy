import type { NextConfig } from "next";

const REQUIRED_ENV = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];

// En production sur Vercel, le mode démo n'est pas acceptable (pas de comptes, données
// fictives publiques) : on fait échouer le build si la config Supabase manque.
if (process.env.VERCEL_ENV === "production") {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Variables d'environnement manquantes pour la production : ${missing.join(", ")}. ` +
        "Ajoute-les dans Vercel > Settings > Environment Variables (voir .env.example).",
    );
  }
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Upload de CV en PDF (3,5 Mo max, cf. src/lib/cv-types.ts), sous la limite
      // de 4,5 Mo des requêtes Vercel.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
