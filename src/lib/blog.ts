// Articles du blog (/blog). Contenu en Markdown simple (voir ArticleBody) ; un article sans
// contenu affiche « Article à venir ».
export type BlogPost = {
  slug: string;
  title: string;
  /** Date au format AAAA-MM-JJ. */
  date: string;
  description: string;
  /** Image de couverture (16:9, dans public/) et son texte alternatif. */
  cover?: { src: string; alt: string };
  /** Texte complet en Markdown : paragraphes, titres « ## », listes « - » et **gras**. */
  content?: string;
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "organiser-candidatures-stage",
    title: "Comment organiser ses candidatures de stage efficacement",
    date: "2026-10-11",
    description:
      "Tableau de suivi, priorités, relances : une méthode simple pour ne plus perdre le fil quand les candidatures s'accumulent.",
    cover: {
      src: "/images/blog/organiser-candidatures-stage.jpg",
      alt: "Feuilles de travail imprimées étalées sur une table, avec un stylo et une paire de lunettes",
    },
    content: `
Envoyer des candidatures de stage, c'est facile. Les organiser, c'est une autre histoire. Entre les offres sauvegardées dans 10 onglets, les emails envoyés il y a 3 semaines dont tu ne sais plus si tu as relancé, et le CV "version finale (2)" qui traîne sur ton bureau — la recherche de stage peut vite devenir un chaos.

Pourtant, quelques réflexes simples suffisent à reprendre le contrôle.

## Pourquoi l'organisation fait la différence

Un recruteur qui reçoit ta relance au bon moment est bien plus susceptible de te répondre. Un CV adapté à chaque offre multiplie tes chances d'être sélectionné. Et savoir exactement où en est chaque candidature te permet de te concentrer sur ce qui compte vraiment : préparer tes entretiens.

## Le cauchemar des fichiers en tout genre

Si tu cherches un stage, tu connais sûrement cette situation : un dossier "Candidatures 2026" sur ton bureau, avec à l'intérieur :

- CV_final.docx
- CV_final_v2.docx
- CV_final_VRAI_FINAL.pdf
- LM_Spotify.docx
- LM_Spotify_modifiée.docx
- LM_BlaBlaCar_adaptée_depuis_Spotify.docx

Et par-dessus ça, un tableau Excel pour "suivre" tes candidatures, qui n'a pas été mis à jour depuis 2 semaines.

Jongler entre Word pour écrire, PDF pour envoyer, Excel pour suivre et Gmail pour relancer — c'est épuisant. Et surtout, c'est une source d'erreurs : envoyer la mauvaise lettre de motivation, oublier de relancer, perdre du temps à retrouver quelle version du CV tu avais envoyé à quelle entreprise.

## Étape 1 : centralise tout au même endroit

La première erreur des candidats, c'est de disperser leurs candidatures entre leur boîte mail, un tableau Excel, des notes sur le téléphone et quelques favoris dans leur navigateur.

Choisis un seul endroit pour tout suivre. Chaque candidature doit avoir à portée de main : l'offre, le CV envoyé, la lettre de motivation, la date d'envoi et le statut actuel.

L'important, c'est la constance : chaque nouvelle candidature doit être ajoutée immédiatement, pas "plus tard".

## Étape 2 : garde une version de chaque document par candidature

C'est là que la plupart des candidats perdent du temps. Tu adaptes ton CV pour Spotify, puis pour BlaBlaCar, puis pour Doctolib — et au bout d'un moment tu ne sais plus quelle version tu as envoyée à qui.

La bonne pratique : **une candidature = un CV + une lettre de motivation**. Ces documents doivent être associés à la candidature, pas flotter dans un dossier au nom cryptique.

Ça te permet de :
- Retrouver immédiatement ce que tu avais envoyé si un recruteur te rappelle
- Éviter d'envoyer la lettre de motivation d'une entreprise à une autre
- Voir en un coup d'œil si tu as adapté ton dossier ou si tu as envoyé un dossier générique

## Étape 3 : utilise des statuts clairs

Pour chaque candidature, tu dois savoir en un coup d'œil où tu en es :

- **Brouillon** — l'offre t'intéresse, tu prépares ton dossier
- **Envoyée** — ta candidature est partie
- **En attente** — tu attends une réponse
- **Relancée** — tu as relancé le recruteur
- **Entretien** — tu as décroché un entretien
- **Offre reçue / Refusée** — la décision est tombée

## Étape 4 : adapte ton CV et ta lettre à chaque offre

Un CV générique envoyé à 50 entreprises donne de moins bons résultats qu'un CV ciblé envoyé à 10. Lis attentivement l'offre, identifie les compétences recherchées, et mets en avant les expériences qui y correspondent.

## Étape 5 : relance au bon moment

Si tu n'as pas de réponse après 10-15 jours, relance le recruteur. Un message court suffit :

"Bonjour, je me permets de revenir vers vous au sujet de ma candidature au poste de [X], envoyée le [date]. Ce poste m'intéresse toujours vivement et je reste disponible pour un entretien à votre convenance."

## Étape 6 : fais le bilan chaque semaine

Prends 10 minutes chaque lundi pour faire le point : quelles candidatures nécessitent une relance, quels entretiens préparer, quelles nouvelles offres explorer.

## En résumé

Organiser ses candidatures, c'est arrêter de jongler entre Excel, Word, PDF et Gmail — et tout regrouper au même endroit. Une candidature, un CV, une lettre, un statut. Simple, mais efficace.

Essaie Applyfy gratuitement sur applyfy.fr — suivi des candidatures, adaptation du CV et rappels de relance au même endroit.
`,
  },
  {
    slug: "creer-son-reseau-professionnel",
    title: "Comment créer son réseau professionnel quand on est étudiant",
    date: "2026-10-11",
    description:
      "Le réseau, c'est la clé pour décrocher un stage. Voici comment le construire efficacement quand on est étudiant.",
    cover: {
      src: "/images/blog/creer-son-reseau-professionnel.jpg",
      alt: "Des personnes qui discutent debout, un café à la main, lors d'un événement dans un espace de travail",
    },
    content: `
On entend souvent dire que "le réseau, c'est tout". Et c'est vrai — une grande majorité des offres de stage et d'emploi ne sont jamais publiées officiellement. Elles se pourvoient par recommandations, cooptations et bouche à oreille.

Bonne nouvelle : construire un réseau, ça s'apprend. Et en tant qu'étudiant, tu as plus d'atouts qu'il n'y paraît.

## Pourquoi le réseau est indispensable

Envoyer des candidatures spontanées dans le vide, c'est épuisant et souvent décourageant. Un contact dans une entreprise change tout : il peut transmettre ton CV directement au bon interlocuteur, te prévenir d'un poste qui n'est pas encore publié, ou simplement donner un avis positif sur ton profil.

Le réseau, c'est ton raccourci vers le marché caché de l'emploi.

## Étape 1 : commence par ce que tu as déjà

Ton réseau existe déjà — tu ne le sais peut-être pas encore.

- **Tes anciens professeurs** — ils connaissent des professionnels dans leur domaine et peuvent faire des introductions
- **Les alumni de ton école** — les anciens élèves sont souvent ravis d'aider les plus jeunes
- **Tes parents et leur entourage** — ne sous-estime pas ce réseau familial
- **Tes camarades de promo** — dans 5 ans, certains seront en position de t'aider (et réciproquement)

Fais d'abord l'inventaire de ces contacts avant de chercher à en créer de nouveaux.

## Étape 2 : optimise ton profil LinkedIn

LinkedIn est la vitrine de ton réseau professionnel. Avant de contacter qui que ce soit, assure-toi que ton profil est complet :

- Une photo professionnelle
- Un titre clair : "Étudiant en Master Finance | En recherche de stage"
- Un résumé court qui explique qui tu es et ce que tu cherches
- Toutes tes expériences, même les petites (tutorat, associations, projets)

Un profil complet donne envie de te répondre.

## Étape 3 : contacte les alumni de ton école

C'est la technique la plus efficace et la plus sous-utilisée. Les anciens de ton école ont une vraie solidarité envers les plus jeunes.

Le message parfait :

"Bonjour [Prénom], je suis étudiant en [formation] à [école] et je travaille sur mon projet professionnel dans [secteur]. Votre parcours chez [entreprise] m'intéresse beaucoup. Seriez-vous disponible pour un échange de 20 minutes pour me partager votre expérience ?"

Trois règles : sois court, sois précis, ne demande pas de stage directement.

## Étape 4 : assiste aux événements

Les forums entreprises, les conférences, les afterworks étudiants — ce sont des mines d'or pour rencontrer des professionnels en face à face.

Avant chaque événement :
- Identifie 3 personnes ou entreprises que tu veux absolument rencontrer
- Prépare une présentation de toi en 30 secondes
- Note tes contacts sur LinkedIn directement depuis ton téléphone

Après l'événement, envoie un message LinkedIn dans les 24h à chaque personne rencontrée.

## Étape 5 : entretiens tes relations

Construire un réseau, c'est entretenir des relations dans la durée.

- Félicite tes contacts quand ils changent de poste
- Partage des articles qui pourraient les intéresser
- Donne avant de recevoir : si tu peux aider quelqu'un, fais-le

## En résumé

Créer son réseau, ça commence par activer ce qu'on a déjà, optimiser sa présence LinkedIn, contacter les alumni et assister aux événements. Pas besoin d'être extraverti — juste d'être curieux et sincère.

Tu cherches un stage ? Organise tes candidatures et tes relances sur applyfy.fr — gratuit et simple à utiliser.
`,
  },
  {
    slug: "erreurs-cv-rejet-automatique",
    title: "Les erreurs qui font rejeter un CV automatiquement",
    date: "2026-10-11",
    description:
      "Mise en page, mots-clés, format de fichier : ce qui fait écarter un CV par les logiciels de recrutement avant même d'être lu.",
  },
];

export function getBlogPost(slug: string) {
  return BLOG_POSTS.find((post) => post.slug === slug) ?? null;
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeZone: "UTC",
});

/** Ex. « 11 octobre 2026 ». */
export function formatBlogDate(date: string) {
  return dateFormatter.format(new Date(`${date}T00:00:00Z`));
}
