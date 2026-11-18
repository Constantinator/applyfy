// Contenus FICTIFS des tests de mise en page du PDF (cv-pdf-layout.test.mjs) : personnes, entreprises et
// chiffres inventés. Court : étudiante avec 1 stage ; moyen : 3 expériences ; dense : 5 expériences,
// 2 formations, compétences groupées, langues, projets, certifications.
export const court = {
  personal: {
    firstName: "Léa",
    lastName: "Morel",
    jobTitle: "Étudiante en marketing digital",
    email: "lea.morel@exemple.fr",
    phone: "06 12 34 56 78",
    city: "Lyon",
    linkedin: "linkedin.com/in/lea-morel-exemple",
  },
  summary:
    "Étudiante en Master 1 Marketing digital à l'IAE Lyon, à la recherche d'une alternance de 12 mois à partir de septembre. Première expérience en agence sur l'animation de réseaux sociaux.",
  experiences: [
    {
      id: "e1",
      position: "Stagiaire assistante marketing",
      company: "Agence Pixel Rhône",
      location: "Lyon",
      startDate: "04/2026",
      endDate: "07/2026",
      bullets: [
        "Rédigé 24 publications LinkedIn et Instagram pour 3 clients B2B, avec un taux d'engagement moyen de 4,2 %",
        "Préparé le reporting mensuel des campagnes (Google Analytics, Meta Business Suite)",
        "Participé à l'organisation d'un webinaire client réunissant 85 inscrits",
      ],
    },
  ],
  education: [
    { id: "f1", degree: "Master 1 Marketing digital", school: "IAE Lyon", startDate: "2025", endDate: "2027", honors: "" },
    { id: "f2", degree: "Licence Économie-Gestion", school: "Université Lumière Lyon 2", startDate: "2022", endDate: "2025", honors: "Mention bien" },
  ],
  skills: ["Canva", "Google Analytics", "Meta Business Suite", "Excel", "Rédaction web"].map((name, i) => ({ id: `s${i}`, name })),
  languages: [
    { id: "l1", name: "Français", level: "Natif" },
    { id: "l2", name: "Anglais", level: "B2" },
  ],
  interests: "Handball en club, bénévolat aux Restos du Cœur",
};

export const moyen = {
  personal: {
    firstName: "Thomas",
    lastName: "Girard",
    jobTitle: "Chef de projet digital",
    email: "thomas.girard@exemple.fr",
    phone: "06 98 76 54 32",
    city: "Nantes",
    linkedin: "linkedin.com/in/thomas-girard-exemple",
  },
  summary:
    "Chef de projet digital avec 6 ans d'expérience dans la conduite de projets web et e-commerce. Habitué à coordonner des équipes de 5 à 10 personnes, du cadrage à la mise en production, avec une forte culture du résultat.",
  experiences: [
    {
      id: "e1",
      position: "Chef de projet digital",
      company: "Maison Océane",
      location: "Nantes",
      startDate: "03/2023",
      current: true,
      bullets: [
        "Piloté la refonte du site e-commerce (budget 180 k€, équipe de 8 personnes), livrée avec 2 semaines d'avance",
        "Augmenté le taux de conversion de 1,8 % à 2,6 % en 12 mois grâce à un programme de tests A/B",
        "Mis en place un tableau de bord hebdomadaire suivi par le comité de direction",
        "Animé les rituels agiles (sprints de 2 semaines) avec les équipes produit et technique",
      ],
    },
    {
      id: "e2",
      position: "Chargé de projet web",
      company: "Agence Lumen",
      location: "Rennes",
      startDate: "09/2020",
      endDate: "02/2023",
      bullets: [
        "Géré 12 projets de sites vitrines et e-commerce pour des PME (budgets de 15 à 60 k€)",
        "Rédigé les cahiers des charges et coordonné designers, développeurs et clients",
        "Réduit de 20 % le délai moyen de livraison en standardisant les phases de recette",
      ],
    },
    {
      id: "e3",
      position: "Assistant chef de projet (alternance)",
      company: "Groupe Atlantis",
      location: "Nantes",
      startDate: "09/2018",
      endDate: "08/2020",
      bullets: [
        "Suivi le planning et le budget de 4 projets internes de digitalisation",
        "Formé 30 collaborateurs à l'outil de gestion de projet",
      ],
    },
  ],
  education: [
    { id: "f1", degree: "Master Management de projets digitaux", school: "Audencia", startDate: "2018", endDate: "2020", honors: "" },
    { id: "f2", degree: "Licence Information-Communication", school: "Université de Nantes", startDate: "2015", endDate: "2018", honors: "" },
  ],
  skills: ["Gestion de projet agile", "Jira", "Figma", "Google Analytics 4", "Shopify", "SEO", "Notion", "SQL (notions)"].map((name, i) => ({ id: `s${i}`, name })),
  languages: [
    { id: "l1", name: "Français", level: "Natif" },
    { id: "l2", name: "Anglais", level: "Courant (TOEIC 915)" },
    { id: "l3", name: "Espagnol", level: "Intermédiaire" },
  ],
  certifications: [{ id: "c1", name: "Certified Scrum Master", issuer: "Scrum Alliance", date: "2022" }],
  interests: "Voile, course à pied (semi-marathon), cuisine",
};

export const dense = {
  personal: {
    firstName: "Camille",
    lastName: "Lefèvre-Martineau",
    jobTitle: "Responsable développement produit — Data & IA",
    email: "camille.lefevre-martineau@exemple.fr",
    phone: "+33 6 11 22 33 44",
    city: "Paris",
    linkedin: "linkedin.com/in/camille-lefevre-martineau-exemple",
    website: "camille-lefevre.exemple.fr",
    github: "github.com/camille-lm-exemple",
  },
  summary:
    "Responsable produit avec 11 ans d'expérience, dont 6 en management, spécialisée dans les produits data et IA pour le secteur bancaire et l'assurance. J'ai dirigé des équipes pluridisciplinaires jusqu'à 14 personnes et lancé 5 produits utilisés par plus de 400 000 clients. À l'aise aussi bien avec les équipes techniques qu'avec les directions métier, je cherche un poste de direction produit dans une scale-up à fort enjeu réglementaire.",
  experiences: [
    {
      id: "e1",
      position: "Responsable développement produit, pôle Data & IA",
      company: "Banque Hexagone",
      location: "Paris",
      startDate: "01/2022",
      current: true,
      bullets: [
        "Dirigé une équipe de 14 personnes (product managers, data scientists, designers) sur 3 lignes de produits",
        "Lancé un assistant de scoring crédit utilisé par 1 200 conseillers, réduisant le délai de décision de 48 h à 6 h",
        "Défini la feuille de route produit sur 3 ans, validée par le comité exécutif (budget annuel de 4,2 M€)",
        "Mis en conformité 100 % des modèles avec le règlement européen sur l'IA avant l'échéance réglementaire",
        "Négocié et piloté 2 partenariats technologiques, pour une économie de 600 k€ par an",
        "Instauré des revues produit trimestrielles avec les directions risques, conformité et commerciale",
      ],
    },
    {
      id: "e2",
      position: "Senior Product Manager",
      company: "Assurances Méridien",
      location: "Paris",
      startDate: "06/2019",
      endDate: "12/2021",
      bullets: [
        "Conçu et lancé l'application de déclaration de sinistre en ligne (320 000 utilisateurs actifs en 18 mois)",
        "Augmenté le NPS de 31 à 52 en refondant le parcours d'indemnisation",
        "Encadré 4 product managers juniors et structuré le processus de discovery",
        "Réduit de 35 % les appels au service client grâce à un suivi de dossier en temps réel",
        "Coordonné 3 équipes de développement réparties entre Paris, Lille et Lisbonne",
      ],
    },
    {
      id: "e3",
      position: "Product Manager",
      company: "FinTech Novalis",
      location: "Paris",
      startDate: "09/2016",
      endDate: "05/2019",
      bullets: [
        "Géré le produit d'agrégation de comptes, de 20 000 à 150 000 utilisateurs en 2 ans",
        "Priorisé le backlog avec une équipe de 9 développeurs, en livraison continue",
        "Mené plus de 60 entretiens utilisateurs et mis en place un programme de tests bêta",
        "Contribué à la levée de fonds de série B (12 M€) en préparant la feuille de route produit",
      ],
    },
    {
      id: "e4",
      position: "Cheffe de projet digital",
      company: "Cabinet Orion Conseil",
      location: "Lyon",
      startDate: "09/2014",
      endDate: "08/2016",
      bullets: [
        "Piloté 7 missions de transformation digitale pour des banques régionales et des mutuelles",
        "Rédigé les spécifications fonctionnelles et animé les ateliers avec les directions métier",
        "Formé 45 collaborateurs clients aux méthodes agiles",
      ],
    },
    {
      id: "e5",
      position: "Analyste d'affaires (stage de fin d'études)",
      company: "Société Générale de Courtage",
      location: "Lyon",
      startDate: "02/2014",
      endDate: "08/2014",
      bullets: [
        "Analysé les parcours de souscription en ligne et proposé 12 pistes d'optimisation, dont 8 retenues",
        "Construit un tableau de bord de suivi des ventes utilisé par 25 commerciaux",
      ],
    },
  ],
  education: [
    {
      id: "f1",
      degree: "Mastère spécialisé Management de l'innovation et entrepreneuriat",
      school: "ESSEC Business School",
      startDate: "2013",
      endDate: "2014",
      honors: "Major de promotion",
      bullets: ["Thèse professionnelle : l'adoption des outils d'aide à la décision dans la banque de détail"],
    },
    {
      id: "f2",
      degree: "Diplôme d'ingénieur, spécialité informatique et mathématiques appliquées",
      school: "INSA Lyon",
      startDate: "2008",
      endDate: "2013",
      honors: "Semestre d'échange à Polytechnique Montréal",
    },
  ],
  skills: [
    { id: "s1", name: "Produit : stratégie produit, discovery, roadmap, OKR, priorisation (RICE)", level: "" },
    { id: "s2", name: "Data & IA : SQL, Python, scoring, modèles de langage, tests A/B", level: "" },
    { id: "s3", name: "Outils : Jira, Productboard, Figma, Amplitude, Looker, Notion", level: "" },
    { id: "s4", name: "Management : recrutement, coaching, conduite du changement", level: "" },
    { id: "s5", name: "Réglementation : RGPD, règlement européen sur l'IA, DSP2", level: "" },
  ],
  languages: [
    { id: "l1", name: "Français", level: "Natif" },
    { id: "l2", name: "Anglais", level: "Bilingue (C2)" },
    { id: "l3", name: "Espagnol", level: "Professionnel (B2)" },
    { id: "l4", name: "Allemand", level: "Notions (A2)" },
  ],
  certifications: [
    { id: "c1", name: "Certified Scrum Product Owner", issuer: "Scrum Alliance", date: "2018" },
    { id: "c2", name: "Machine Learning Specialization", issuer: "DeepLearning.AI", date: "2021" },
  ],
  projects: [
    {
      id: "p1",
      name: "Observatoire ouvert du crédit responsable",
      description:
        "Création d'un tableau de bord public sur l'accès au crédit en France à partir de données ouvertes ; 9 000 visiteurs par mois, repris par deux médias économiques.",
      link: "observatoire-credit.exemple.fr",
    },
    {
      id: "p2",
      name: "Mentorat Femmes & Produit",
      description:
        "Cofondatrice d'un programme de mentorat bénévole : 60 mentorées accompagnées depuis 2020, 14 mentors actifs, partenariat avec 3 écoles.",
      link: "",
    },
    {
      id: "p3",
      name: "Bibliothèque open source d'explicabilité",
      description: "Contributrice à une bibliothèque Python d'explicabilité des modèles de scoring (1 400 étoiles sur GitHub).",
      link: "github.com/exemple/explicabilite",
    },
  ],
  interests: "Trail (ultra de 80 km), piano, bénévolat en éducation financière, photographie argentique",
};
