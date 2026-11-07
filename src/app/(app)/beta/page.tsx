import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";

import { TesterMessages } from "@/components/beta/beta-messages";
import { BetaReports } from "@/components/beta/beta-reports";
import { requireUser } from "@/lib/auth";
import { getMyBeta } from "@/lib/beta";
import { getMyBetaMessages } from "@/lib/beta-messages";
import { BETA_PREMIUM_UNTIL_LABEL } from "@/lib/beta-rules";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Beta testing — Applyfy" };

/** « Beta testing » : les 3 rapports du programme beta de l'utilisateur connecté. */
export default async function BetaPage() {
  await connection(); // statut des rapports calculé à chaque visite
  if (!isSupabaseConfigured()) redirect("/dashboard");
  await requireUser();
  const [beta, messages] = await Promise.all([getMyBeta(), getMyBetaMessages()]);
  if (!beta) redirect("/dashboard"); // ne participe pas au programme

  const active = beta.status === "active";
  const reason = beta.suspensionReason
    ? ` : ${beta.suspensionReason.charAt(0).toLowerCase()}${beta.suspensionReason.slice(1)}`
    : "";

  return (
    <div className="flex flex-1 flex-col bg-white dark:bg-slate-950">
      <main className="ui-page-narrow flex-1 space-y-5">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[36px] leading-[1.1] font-bold tracking-[-0.035em] text-ink">Beta testing</h1>
            {active && (
              <span className="bg-ink rounded-full px-3 py-1 text-xs font-semibold text-white">
                Beta testeur
              </span>
            )}
          </div>
          <p className="mt-2 text-muted">
            {active
              ? `Merci de nous aider à construire Applyfy ! Ton Premium est offert jusqu'au ${BETA_PREMIUM_UNTIL_LABEL}.`
              : `Ton accès beta est ${beta.status === "suspended" ? "suspendu" : "retiré"}${reason}. Tu es repassé·e au plan gratuit.`}
          </p>
        </div>

        <section aria-labelledby="beta-reports-title" className="space-y-4 ui-card p-5 sm:p-7">
          <div>
            <h2 id="beta-reports-title" className="ui-title-sm">
              Mes rapports beta
            </h2>
            {active && (
              <p className="mt-1 text-sm text-muted">
                Envoie chaque rapport avant sa date limite pour garder ton accès beta et le Premium offert. Un rappel
                t&apos;est envoyé par email 2 jours avant.
              </p>
            )}
          </div>
          <BetaReports joinedAt={beta.joinedAt} active={active} submitted={beta.reports} />
        </section>

        <section aria-labelledby="beta-messages-title" className="space-y-4 ui-card p-5 sm:p-7">
          <div>
            <h2 id="beta-messages-title" className="ui-title-sm">
              Messages
            </h2>
            <p className="mt-1 text-sm text-muted">
              Tes échanges avec l&apos;équipe Applyfy : pose une question, signale un problème, partage une idée.
            </p>
          </div>
          <TesterMessages messages={messages} />
        </section>
      </main>
    </div>
  );
}
