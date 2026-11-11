// Estimation du coût d'un run AVANT tout appel : le vrai prompt système du coach est construit en
// local pour chaque scénario (coachSystem), puis multiplié par les tours prévus et les hypothèses de
// config.ts (ESTIMATE). Aucun appel à l'API, même gratuit.
import { buildCoachContext } from "../../src/lib/coach-context.ts";
import { coachSystem, coachUserText } from "../../src/lib/coach-prompt.ts";
import { chatContent, targetJobOf } from "../../src/lib/cv-builder-types.ts";
import { cvScoringSector, formatSectorContext, getSectorContext, scoringOfferFor } from "../../src/lib/cv-sector-context.ts";
import { scoringContextForSector } from "../../src/lib/cv-scoring-context.ts";
import { costEur, type Role } from "./budget.ts";
import { ESTIMATE, MODELS } from "./config.ts";
import type { Fixtures, Scenario } from "./fixtures.ts";

export type Estimate = {
  conversations: number;
  calls: Record<Role, number>;
  eur: Record<Role, number>;
  totalEur: number;
};

const tokens = (text: string) => text.length / ESTIMATE.charsPerToken;

export function estimateRun(fx: Fixtures, scenarios: Scenario[], repeat: number, maxTurns: number): Estimate {
  const calls: Record<Role, number> = { coach: 0, simulator: 0, judge: 0 };
  const eur: Record<Role, number> = { coach: 0, simulator: 0, judge: 0 };
  for (const scenario of scenarios) {
    const profile = fx.profiles.get(scenario.profile)!;
    const detail = scenario.offer ? fx.offers.get(scenario.offer)!.detail : null;
    const offer = scoringOfferFor(detail?.application.id ?? null, detail);
    const sector = cvScoringSector(JSON.stringify(chatContent(profile.cv)), targetJobOf(profile.cv), offer);
    const scoring = scoringContextForSector(sector, offer, fx.marketKeywords[sector] ?? []);
    const context = buildCoachContext(profile.cv, scoring, detail);
    const system = tokens(coachSystem(context, formatSectorContext(getSectorContext(sector), context.marketKeywords)));
    const cv = tokens(JSON.stringify(chatContent(profile.cv)));

    const turns = Math.max(2, Math.round(maxTurns * ESTIMATE.turnShare));
    // Entrée moyenne d'un appel du coach : prompt système + la moitié de la conversation finale.
    const coachInput = system + tokens(coachUserText([], "x")) + turns * 80;
    const coachCalls = 1 + turns * (1 + ESTIMATE.retryRate);
    calls.coach += coachCalls * repeat;
    eur.coach += repeat * (costEur(MODELS.coach, system, ESTIMATE.openingOutput) + turns * (1 + ESTIMATE.retryRate) * costEur(MODELS.coach, coachInput, ESTIMATE.coachOutput));

    const simTurns = scenario.firstMessage ? turns - 1 : turns;
    calls.simulator += simTurns * repeat;
    eur.simulator += repeat * simTurns * costEur(MODELS.simulator, ESTIMATE.simulatorInput + cv, ESTIMATE.simulatorOutput);

    calls.judge += repeat;
    eur.judge += repeat * costEur(MODELS.judge, 2 * cv + turns * 2 * 80 + 600, ESTIMATE.judgeOutput);
  }
  return { conversations: scenarios.length * repeat, calls, eur, totalEur: eur.coach + eur.simulator + eur.judge };
}
