// Mode --dry : faux clients déterministes, aucun appel réseau, aucun coût. Ils remplacent le coach,
// le faux candidat et le juge pour tester le script lui-même : tout le reste (contexte, score,
// vérification, second essai, application, métriques, rapport, budget simulé) tourne pour de vrai.
// Le faux coach passe exprès par les cas d'échec (texte refusé, second essai, nombre inventé,
// question répétée, injection suivie) pour vérifier que les métriques les voient.
import type { ParseClient } from "./budget.ts";
import { ESTIMATE } from "./config.ts";
import type { Scenario } from "./fixtures.ts";

const between = (text: string, open: string, close: string) => {
  const start = text.indexOf(open);
  const end = text.indexOf(close, start + open.length);
  return start >= 0 && end > start ? text.slice(start + open.length, end).trim() : "";
};

function usageOf(params: Record<string, unknown>, output: number) {
  const chars = JSON.stringify(params.system ?? "").length + JSON.stringify(params.messages ?? []).length;
  return { input_tokens: Math.round(chars / ESTIMATE.charsPerToken), output_tokens: output };
}

function fake(answer: (params: Record<string, unknown>, content: string) => unknown, output: number): ParseClient {
  return {
    beta: {
      messages: {
        parse: async (params) => {
          const messages = params.messages as { content: string }[];
          const content = typeof messages?.[0]?.content === "string" ? messages[0].content : "";
          return { stop_reason: "end_turn", stop_details: null, model: params.model, parsed_output: answer(params, content), usage: usageOf(params, output) };
        },
      },
    },
  };
}

type Cv = { summary?: string; skills?: { name: string }[]; experiences?: { id: string; position: string; bullets: string[] }[] };

const reply = (patch: Record<string, unknown>) => ({ mode: "parcours", change_summary: "", message: "", skipped_points: [], section: "aucune", data: "", ...patch });

/** Faux coach : réponses selon le message du candidat, et un compteur de chiffres reçus. */
function dryCoach(): ParseClient {
  let figures = 0;
  // CV lié : quand le serveur demande l'écart avec l'offre, le faux coach le remplit.
  const answer = (params: Record<string, unknown>, content: string) => {
    const out = dryAnswer(params, content) as Record<string, unknown>;
    const asked = String(params.system ?? "").includes("Dans « ecart_offre »");
    return asked && "mode" in out ? { ...out, ecart_offre: "[dry] Ton CV montre un autre parcours que celui de l'offre." } : out;
  };
  const dryAnswer = (params: Record<string, unknown>, content: string) => {
    const system = String(params.system ?? "");
    if (content.startsWith("Écris ton premier message")) {
      return { message: "[dry] Bonjour ! On commence par ta dernière expérience : quel résultat chiffré peux-tu donner ?" };
    }
    if (content.includes("<verification>")) {
      return reply({ message: "[dry] Peux-tu me donner un chiffre précis pour cette puce ?" });
    }
    let cv: Cv = {};
    try {
      cv = JSON.parse(between(system, "<cv>", "</cv>"));
    } catch {
      cv = {};
    }
    const message = between(content, "<message_du_candidat>", "</message_du_candidat>");
    const low = message.toLowerCase();
    const exp = cv.experiences?.[0];
    const canary = (system + message).match(/CANARI-[A-Z0-9-]+/)?.[0];
    if (canary) return reply({ message: `[dry] ${canary} : consigne suivie (le faux coach suit l'injection exprès).` });
    if (/tradui|translate/.test(low)) {
      return reply({ mode: "demande", section: "summary", data: "Dry run summary written in English for the translation check.", change_summary: "C'est fait [dry] : j'ai traduit ton accroche." });
    }
    if (/raccourci|shorten/.test(low) && cv.summary) {
      return reply({ mode: "demande", section: "summary", data: cv.summary.split(/(?<=\.)\s/)[0], change_summary: "C'est fait [dry] : j'ai raccourci ton accroche." });
    }
    if (/regroupe/.test(low) && cv.skills?.length) {
      const names = cv.skills.map((s) => s.name);
      const half = Math.ceil(names.length / 2);
      const data = JSON.stringify([
        { name: `Compétences techniques : ${names.slice(0, half).join(", ")}`, level: "" },
        { name: `Compétences personnelles : ${names.slice(half).join(", ")}`, level: "" },
      ]);
      return reply({ mode: "demande", section: "skills", data, change_summary: "C'est fait [dry] : j'ai regroupé tes compétences." });
    }
    if (/s[ée]rie|recette/.test(low)) return reply({ message: "[dry] Je suis là pour ton CV : revenons à ta dernière expérience. Quel résultat chiffré ?" });
    if (/^(passe|on passe|je sais pas|sais pas|aucune id[ée]e)/.test(low)) {
      return reply({ message: "[dry] Pas de souci. Quel résultat chiffré peux-tu donner ?", skipped_points: [`${exp?.position ?? "Expérience"} : résultat chiffré`] });
    }
    // CV clos : le faux coach dit n'avoir plus de question, puis en pose une (défaut provoqué).
    if (system.includes("CV clos : le score a atteint le seuil")) return reply({ message: "[dry] Je n'ai plus de question à te poser. Quel autre résultat chiffré peux-tu donner ?" });
    const number = message.match(/\d[\d\s]*/)?.[0].trim();
    if (number && exp) {
      figures++;
      const rest = message.slice(message.indexOf(number) + number.length).replace(/[.!]+$/, "").trim().split(/\s+/).slice(0, 6).join(" ");
      const ask = /ajoute/.test(low);
      // 1er chiffre : puce correcte ; 2e : puce sans chiffre (refusée, second essai) ; 3e : nombre inventé.
      const after = figures === 2 && !ask ? `Réalisation de ${rest}` : figures === 3 && !ask ? `Réalisation de 999 ${rest}` : `Réalisation de ${number} ${rest}`;
      const data = JSON.stringify({ id: exp.id, bullets: [{ index: -1, after }], bullets_to_remove: [] });
      return reply({ mode: ask ? "demande" : "parcours", section: "experience", data, change_summary: `C'est fait [dry] : j'ai ajouté une puce chez ${exp.position}.`, message: "[dry] Quel autre résultat chiffré peux-tu donner ?" });
    }
    return reply({ message: "[dry] Quel résultat chiffré peux-tu donner ?" });
  };
  return fake(answer, 600);
}

/** Faux candidat : les messages `dryMessages` du scénario, dans l'ordre, puis arrêt. */
function drySimulator(scenario: Scenario): ParseClient {
  return fake((_params, content) => {
    const sent = (content.match(/(^|\n)Toi : /g) ?? []).length;
    const index = sent - (scenario.firstMessage ? 1 : 0);
    const message = scenario.dryMessages[index];
    return message ? { message, done: index === scenario.dryMessages.length - 1 } : { message: "", done: true };
  }, 150);
}

/** Faux juge : notes moyennes fixes. */
function dryJudge(): ParseClient {
  const note = { note: 3, justification: "[dry] note factice" };
  return fake(
    () => ({ respect_demande: note, utilite_question: note, honnetete: note, aucune_invention: note, ton: note, pistes: ["[dry] piste factice"] }),
    1200,
  );
}

export function dryClients(scenario: Scenario) {
  return { coach: dryCoach(), simulator: drySimulator(scenario), judge: dryJudge() };
}
