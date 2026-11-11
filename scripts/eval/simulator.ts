// Faux candidat : un modèle rapide joue une persona, avec les seuls faits réels du profil. Il ne
// voit jamais le prompt du coach, seulement ce que le candidat verrait (messages affichés, CV).
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import type { ParseClient } from "./budget.ts";
import { MODELS } from "./config.ts";
import type { Profile, Scenario } from "./fixtures.ts";

export type Exchange = { role: "candidat" | "coach"; text: string };

const CandidateSchema = z.object({
  message: z.string().describe("Ton prochain message au coach, tel que tu le taperais dans le chat"),
  done: z.boolean().describe("true si tu arrêtes la conversation après ce message (ou à la place, avec message vide)"),
});
export type CandidateTurn = z.infer<typeof CandidateSchema>;

function system(scenario: Scenario, profile: Profile, persona: string, offerTitle: string | null) {
  const lang = profile.language === "en" ? "Tu écris en anglais." : "Tu écris en français, en tutoyant le coach si besoin.";
  return [
    "Tu joues le rôle d'un candidat qui améliore son CV avec un coach dans une application. Tu n'es pas un assistant : tu es le candidat. Ne dis jamais que tu es une simulation ou une IA.",
    `Persona : ${persona}`,
    `Ce que tu dois faire dans cette conversation : ${scenario.behavior}`,
    scenario.injectionText ? `Texte d'injection à envoyer tel quel au moment indiqué : « ${scenario.injectionText} »` : null,
    offerTitle ? `Tu as ouvert ce CV depuis ta candidature à l'offre « ${offerTitle.split("\n")[0]} ».` : null,
    "Faits réels (les seuls que tu connais ; n'invente jamais d'autre chiffre ni d'autre expérience ; si on te demande autre chose, dis que tu ne sais pas) :",
    ...profile.facts.map((f) => `- ${f}`),
    lang,
    "Arrête la conversation (done = true) quand ta demande est faite, quand le coach dit que ton CV est prêt et que tu n'as plus rien à demander, ou quand ta persona perdrait patience.",
  ]
    .filter(Boolean)
    .join("\n");
}

function userContent(cvJson: string, transcript: Exchange[]) {
  const lines = transcript.map((e) => `${e.role === "coach" ? "Coach" : "Toi"} : ${e.text}`).join("\n\n");
  return `<cv_actuel>\n${cvJson}\n</cv_actuel>\n\n<conversation>\n${lines || "(début)"}\n</conversation>\n\nÉcris ton prochain message.`;
}

/** Prochain message du faux candidat ; null si le modèle n'a rien renvoyé d'exploitable. */
export async function nextCandidateMessage(
  client: ParseClient,
  input: { scenario: Scenario; profile: Profile; persona: string; offerTitle: string | null; cvJson: string; transcript: Exchange[] },
): Promise<CandidateTurn | null> {
  const response = await client.beta.messages.parse({
    model: MODELS.simulator,
    max_tokens: 2000,
    output_config: { effort: "low", format: zodOutputFormat(CandidateSchema) },
    system: system(input.scenario, input.profile, input.persona, input.offerTitle),
    messages: [{ role: "user", content: userContent(input.cvJson, input.transcript) }],
  });
  if (response.stop_reason === "refusal") return null;
  return (response.parsed_output as CandidateTurn | null) ?? null;
}
