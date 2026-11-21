/**
 * Phase guidée (import, création, éditeur, /bienvenue) : masque les liens « Notre histoire » et
 * « Blog » du pied de page (data-guide-hidden), qui feraient sortir du parcours. Les liens légaux,
 * la gestion des cookies et l'attribution Logo.dev restent visibles. Règle rendue avec la page :
 * rien n'apparaît furtivement, rien ne reste après l'avoir quittée.
 */
export function GuidedFooterStyle() {
  return <style>{"[data-guide-hidden]{display:none!important}"}</style>;
}
