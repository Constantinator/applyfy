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
  /** Texte complet en Markdown : paragraphes, titres « ## » et « ### », listes « - » et **gras**. */
  content?: string;
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "comment-faire-un-cv-ere-ia",
    title: "Comment faire un CV à l'ère de l'IA",
    date: "2026-10-27",
    description:
      "ATS, tri automatique, CV écrits par ChatGPT : ce qui a changé et les règles pour un CV qui passe les filtres et convainc un recruteur.",
    cover: {
      src: "/images/blog/comment-faire-un-cv-ere-ia.jpg",
      alt: "Personne lisant un CV imprimé pendant un entretien, face à une autre personne assise de l'autre côté de la table",
    },
    content: `
Les recruteurs reçoivent plus de candidatures que jamais, et beaucoup se ressemblent. D'un côté, les entreprises utilisent des logiciels pour trier les CV. De l'autre, les candidats écrivent leur CV avec ChatGPT. Résultat : des CV lisses, remplis des mêmes formules, que les logiciels classent mal et que les recruteurs lisent en diagonale.

Bonne nouvelle : les règles d'un bon CV n'ont pas disparu. Elles sont simplement devenues plus strictes. Voici ce qui a changé, et comment utiliser l'IA pour te démarquer au lieu de te fondre dans la masse.

## Ce qui a changé

### Côté recruteur : le premier lecteur est souvent un logiciel

La plupart des entreprises de taille moyenne et grande utilisent un ATS (Applicant Tracking System), un logiciel de suivi des candidatures. Il lit ton CV, en extrait les informations (postes, dates, compétences) et aide le recruteur à trier les candidatures, notamment en recherchant des mots-clés.

Concrètement, cela veut dire deux choses :
- si le logiciel lit mal ton CV (mise en page en colonnes, texte dans une image, tableau), tes informations peuvent être perdues ;
- si ton CV ne contient pas les termes de l'offre, il risque de remonter moins bien dans les résultats, même si tu as le bon profil.

### Côté candidat : tout le monde écrit avec l'IA

Les outils d'IA permettent d'écrire un CV en quelques minutes. Le problème, c'est que tout le monde le fait, avec les mêmes demandes. Les recruteurs voient donc passer des dizaines de CV « passionnés », « orientés résultats » et « dotés d'un parcours éprouvé ». Ces formules ne disent rien de toi, et elles se repèrent tout de suite.

## Le piège : laisser l'IA écrire à ta place

Demander à une IA « écris-moi un CV de chef de projet marketing » donne un texte propre, mais vide. L'IA ne connaît ni tes résultats, ni tes chiffres, ni le contexte de tes missions. Elle comble donc les trous avec des généralités, ou pire, avec des chiffres inventés.

Un chiffre inventé est le pire scénario : en entretien, le recruteur te demandera comment tu as « augmenté le chiffre d'affaires de 40 % », et tu n'auras pas de réponse.

La bonne approche est l'inverse : c'est toi qui apportes la matière, l'IA t'aide à la mettre en forme.

## Les règles d'un CV efficace en 2026

### 1. Partir de l'offre, pas de ton parcours

Avant d'écrire une ligne, relis l'offre et repère :
- l'intitulé exact du poste ;
- les compétences techniques demandées (outils, logiciels, méthodes) ;
- les compétences comportementales mises en avant ;
- les mots qui reviennent plusieurs fois.

Ignore les parties sur les avantages, la présentation de l'entreprise et les mentions légales : elles ne disent rien sur ce qu'on attend de toi.

Ensuite, vérifie quels mots-clés se retrouvent dans ton CV. Un bon objectif : en couvrir au moins les trois quarts, à condition de les avoir réellement. Si l'offre parle de « gestion de projet » et que tu as écrit « pilotage de missions », reprends le terme de l'offre. Si tu ne maîtrises pas une compétence demandée, ne l'ajoute pas.

Pense aussi au titre de ton CV : reprendre l'intitulé du poste visé (s'il correspond à ton profil) aide à la fois le logiciel et le recruteur.

### 2. Une mise en page que les logiciels savent lire

Un CV très graphique peut être beau à l'écran et illisible pour un ATS. Pour ne prendre aucun risque :
- une seule colonne, de haut en bas ;
- pas de texte dans des images, des icônes ou des zones de texte ;
- pas de tableaux pour structurer le contenu ;
- des titres de rubriques classiques : « Expérience professionnelle », « Formation », « Compétences », « Langues » ;
- une police standard : Arial, Calibri, Times New Roman, Georgia, Cambria ou Garamond ;
- des dates complètes et cohérentes (mois et année) ;
- un PDF exporté depuis un traitement de texte, pas un scan.

La sobriété n'est pas un défaut : les CV les plus lus en finance ou en conseil sont souvent en noir et blanc, avec de simples traits horizontaux entre les rubriques.

### 3. Chaque puce commence par une action et se termine par un résultat

C'est la règle qui fait le plus de différence. Une puce efficace répond à trois questions : qu'as-tu fait, comment, et avec quel résultat ?

Avant :
- Responsable de la gestion des réseaux sociaux de l'entreprise.

Après :
- Refonte de la ligne éditoriale Instagram et LinkedIn : +35 % d'abonnés en 6 mois et 2 fois plus de demandes de démo venues des réseaux.

Quelques repères :
- commence par un verbe ou un nom d'action (« Pilotage », « Lancement », « Réduction ») ;
- ne commence pas deux puces par le même verbe ;
- 3 à 6 puces par expérience, 30 mots maximum chacune ;
- pas de « je », pas de « mon » ;
- supprime les mots vides : « dynamique », « polyvalent », « force de proposition », « diverses missions ».

### 4. Des chiffres vrais, même approximatifs

Tu n'as pas de chiffre exact ? Pose-toi ces questions :
- Combien ? (clients, projets, personnes encadrées, dossiers traités)
- De combien ? (hausse, baisse, gain de temps)
- En combien de temps ?
- Comparé à quoi ? (l'année précédente, l'objectif, la moyenne de l'équipe)
- Pour qui ? (taille du client, du budget, de l'équipe)

Un ordre de grandeur honnête (« une quinzaine de clients », « environ 20 % de temps gagné ») vaut beaucoup mieux qu'un chiffre précis inventé. Tu dois pouvoir défendre chaque nombre en entretien.

### 5. Un CV par candidature

Un CV unique envoyé partout est presque toujours moins performant. Garde une version complète de référence, puis adapte-la à chaque offre : le titre, l'ordre des expériences, les mots-clés et les puces mises en avant. Cela prend dix minutes et change souvent le résultat.

### 6. Relire comme un recruteur

Avant d'envoyer, relis ton CV en 30 secondes, comme le ferait un recruteur pressé. Est-ce qu'on comprend tout de suite quel poste tu vises ? Est-ce que tes meilleurs résultats sautent aux yeux ? Est-ce qu'une seule phrase pourrait figurer dans le CV de n'importe qui ? Si oui, réécris-la.

## Bien utiliser l'IA : un coach, pas un rédacteur

L'IA est très utile pour écrire un CV, à condition de l'utiliser comme un coach qui te pose les bonnes questions.

À éviter :
- « Écris-moi un CV de business analyst. »
- « Rends mon CV plus impressionnant. »

À faire :
- « Voici l'offre et mon CV. Quels mots-clés de l'offre manquent dans mon CV ? »
- « Voici une puce de mon CV. Pose-moi les questions dont tu as besoin pour la rendre plus concrète, sans rien inventer. »
- « Propose-moi trois façons de reformuler cette puce avec un verbe d'action, en gardant exactement mes chiffres. »

Et garde toujours la main : relis chaque phrase proposée, supprime ce qui ne te ressemble pas, et vérifie qu'aucun chiffre n'a été ajouté sans toi.

## La check-list avant d'envoyer

- Le titre du CV correspond au poste visé
- Les principaux mots-clés de l'offre apparaissent (si tu les as réellement)
- Une seule colonne, une police standard, pas d'image ni de tableau
- Chaque puce commence par une action
- La plupart des puces contiennent un résultat chiffré
- Aucun chiffre que tu ne pourrais pas expliquer en entretien
- Aucune formule générique (« passionné », « orienté résultats », « dynamique »)
- Dates complètes et cohérentes
- Adresse email professionnelle avec ton nom
- Une ou deux pages, relues sans faute

## Et avec Applyfy ?

C'est exactement la méthode du CV Builder d'Applyfy. Le coach ne rédige pas à ta place : il te pose des questions ciblées pour obtenir tes vrais résultats, puis il les met en forme. Ton CV reçoit une note sur 100, recalculée en direct (actions, chiffres, mots-clés de ton secteur, concision, mise en forme), avec les corrections qui rapportent le plus de points. Les modèles Minimaliste, Classique et Finance suivent ces règles de mise en page.

Et quand tu postules à une offre, Applyfy compare ton CV aux mots-clés de l'annonce, te montre ceux qui manquent et te propose un intitulé adapté.

Crée ton CV gratuitement sur applyfy.fr.
`,
  },
  {
    slug: "ia-recherche-emploi",
    title: "L'IA dans la recherche d'emploi : une arme à double tranchant",
    date: "2026-10-22",
    description:
      "CV optimisé en 30 secondes, lettre de motivation sur mesure — l'IA promet beaucoup. Mais elle peut aussi te coûter ta candidature si tu ne sais pas t'en servir.",
    cover: {
      src: "/images/blog/ia-recherche-emploi.jpg",
      alt: "Homme en costume sombre et cravate rayée boutonnant sa veste devant un escalier",
    },
    content: `
L'IA a changé la façon de candidater. En quelques secondes, tu génères un CV adapté à une offre ou une lettre de motivation. Ce qui prenait deux heures en prend maintenant dix minutes. Les recruteurs ont commencé à le remarquer.

## Ce que l'IA fait bien

Pour adapter ton CV à une offre précise ou rédiger une première version de lettre, l'IA est rapide et difficile à battre. Elle compense aussi certains blocages : si tu ne sais pas comment formuler une expérience ou structurer ton CV, elle te donne une base. Tu peux générer dix variantes, corriger, recommencer sans te retrouver face à une page blanche.

## Ce qu'elle fait mal

L'IA écrit pour n'importe quel candidat. Une lettre non retouchée sonne comme une lettre générée, et les recruteurs qui en lisent des dizaines par jour le repèrent. Certains outils ajoutent des compétences que tu n'as pas, reformulent des expériences de façon inexacte, ou glissent des chiffres qui ne viennent pas de toi. Si tu ne relis pas ligne par ligne, tu envoies un CV qui ne te représente pas. Et si tout le monde utilise les mêmes outils avec les mêmes prompts, les candidatures finissent par se ressembler.

## Comment s'en servir

Utilise l'IA pour générer une structure ou débloquer une formulation, puis retravaille le résultat. Lis chaque phrase avant d'envoyer. Supprime ce que tu ne dirais pas à l'oral. Ajoute un détail concret que l'IA ne pouvait pas inventer. Si tu peux envoyer une candidature sans l'avoir lue, elle n'est pas prête.

## Ce qui reste humain

Les outils IA accélèrent l'exécution. Savoir quelles offres valent ton temps, comment te préparer à un entretien, ce que tu veux vraiment faire : ça, l'IA ne le fait pas à ta place. C'est là que se joue une candidature.

Applyfy utilise l'IA pour adapter ton CV à chaque offre et générer une lettre de motivation, mais te laisse relire, modifier et décider ce qui part. Essaie sur applyfy.fr.
`,
  },
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
    slug: "ats-cv-recrutement",
    title: "ATS : c'est quoi et comment ne pas se faire éliminer avant même d'être lu",
    date: "2026-10-11",
    description:
      "Les ATS filtrent automatiquement les CV avant qu'un recruteur les lise. Voici comment optimiser ton CV pour passer ce filtre invisible.",
    cover: {
      src: "/images/blog/ats-cv-recrutement.jpg",
      alt: "Un CV vierge sur un porte-documents, à côté d'un stylo plume et d'un ordinateur portable",
    },
    content: `
Les ATS (Applicant Tracking System) sont des logiciels utilisés par les entreprises pour filtrer automatiquement les CV avant qu'un recruteur humain les lise. En clair : ton CV peut être rejeté par une machine, sans que personne ne l'ait jamais ouvert.

## Ce qu'est un ATS concrètement

Quand tu postules en ligne sur le site d'une grande entreprise, ton CV ne va pas directement dans la boîte mail du recruteur. Il passe d'abord par un logiciel qui :
- Extrait les informations (nom, expériences, compétences, formations)
- Compare ton profil aux mots-clés de l'offre
- Attribue un score à ta candidature
- Filtre les candidats en dessous d'un certain seuil

Les grandes entreprises reçoivent des centaines de candidatures par poste — sans ATS, c'est ingérable.

## Pourquoi ton CV peut être rejeté à tort

Un CV mal formaté peut tromper l'ATS et te faire éliminer même si tu es le candidat parfait.

Les erreurs les plus fréquentes :
- **Tableaux et colonnes** — les ATS lisent mal les mises en page complexes
- **En-têtes et pieds de page** — les informations qu'ils contiennent sont souvent ignorées
- **Fichier image** — un CV scanné ou en image JPG est illisible pour un ATS
- **Polices exotiques** — certains caractères ne sont pas reconnus
- **Abréviations non expliquées** — "BDE" ou "IEP" ne sont pas forcément compris

## Comment optimiser son CV pour les ATS

1. **Utilise les mots-clés de l'offre** — si l'offre parle de "gestion de projet", utilise exactement ces mots dans ton CV, pas "pilotage de projets"
2. **Format simple** — une colonne, pas de tableaux, police standard (Arial, Calibri, Georgia)
3. **PDF ou Word** — ces formats sont bien lus par les ATS
4. **Sections claires** — "Expériences professionnelles", "Formation", "Compétences" — des titres que l'ATS reconnaît
5. **Compétences explicites** — liste tes compétences clairement, avec les outils et logiciels maîtrisés

## ATS ne veut pas dire sans personnalité

Optimiser pour les ATS ne signifie pas écrire un CV robotique. Une fois passé le filtre automatique, un humain lira ton CV. Il faut donc trouver l'équilibre : assez de mots-clés pour passer l'ATS, assez de personnalité pour convaincre le recruteur.

## En résumé

Les ATS éliminent jusqu'à 75% des candidatures avant qu'un humain ne les lise. Adapter ton CV aux mots-clés de chaque offre n'est pas de la triche — c'est de la stratégie.

Tu cherches un stage ? Applyfy analyse ton CV face à chaque offre et te dit exactement quels mots-clés tu dois ajouter. Essaie gratuitement sur applyfy.fr.
`,
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
