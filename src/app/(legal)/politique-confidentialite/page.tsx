import type { Metadata } from "next";

import { ContactLink, LegalDocument, LegalSection } from "@/components/legal/legal-document";

export const metadata: Metadata = { title: "Politique de confidentialité — Applyfy" };

const PROCESSORS = [
  {
    name: "Supabase",
    role: "Base de données, comptes utilisateurs et stockage des fichiers (CV, documents)",
    url: "https://supabase.com/privacy",
  },
  {
    name: "Vercel",
    role: "Hébergement du site, exécution de l'application et mesure d'audience anonyme (Web Analytics)",
    url: "https://vercel.com/legal/privacy-policy",
  },
  {
    name: "Anthropic",
    role: "Intelligence artificielle (Claude) : résumés d'offres, analyse et adaptation de CV, lettres de motivation",
    url: "https://www.anthropic.com/legal/privacy",
  },
  {
    name: "Jina AI",
    role: "Lecture des pages d'offres d'emploi quand l'import depuis un lien ne peut pas les lire directement (seule l'adresse publique de l'offre lui est transmise)",
    url: "https://jina.ai/legal/",
  },
  {
    name: "Logo.dev",
    role: "Affichage des logos d'entreprises dans « Trouver une offre » : ton navigateur les charge depuis ses serveurs, qui reçoivent ton adresse IP",
    url: "https://www.logo.dev/legal/privacy",
  },
  {
    name: "Brevo",
    role: "Envoi des emails (rappels de relance, email de bienvenue à l'inscription et email de relance J+2 si aucune candidature ajoutée)",
    url: "https://www.brevo.com/fr/legal/privacypolicy/",
  },
  {
    name: "Meta",
    role: "Mesure de l'efficacité des publicités (Meta Pixel), uniquement si tu as accepté les cookies publicitaires",
    url: "https://www.facebook.com/privacy/policy/",
  },
  {
    name: "Google",
    role: "Mesure de l'efficacité des publicités (Google Ads), uniquement si tu as accepté les cookies publicitaires",
    url: "https://policies.google.com/privacy",
  },
  {
    name: "Stripe",
    role: "Traitement des paiements de l'abonnement Premium (carte bancaire, facturation, gestion de l'abonnement)",
    url: "https://stripe.com/fr/privacy",
  },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalDocument
      title="Politique de confidentialité"
      updatedOn="23 octobre 2026"
      intro="Applyfy t'aide à suivre ta recherche d'emploi. Cette page explique quelles données sont collectées, pourquoi, combien de temps elles sont conservées et comment exercer tes droits, conformément au Règlement général sur la protection des données (RGPD)."
    >
      <LegalSection title="Responsable du traitement">
        <p>
          Constantin Varin, éditeur d&apos;Applyfy. Contact : <ContactLink />.
        </p>
      </LegalSection>

      <LegalSection title="Données collectées">
        <ul>
          <li>
            <strong>Identité et compte :</strong> prénom, nom, adresse email, mot de passe (stocké sous
            forme chiffrée, jamais lisible).
          </li>
          <li>
            <strong>CV :</strong> les fichiers PDF que tu enregistres dans ton profil ou importes pour une
            analyse.
          </li>
          <li>
            <strong>Candidatures :</strong> entreprises, postes, offres, statuts, historique, notes,
            contacts recruteurs, CV adaptés et lettres de motivation générés.
          </li>
          <li>
            <strong>Préférences :</strong> réglages des rappels de relance.
          </li>
          <li>
            <strong>Extension navigateur (facultative) :</strong> quand tu colles dans Applyfy le lien
            d&apos;une offre ouverte dans un autre onglet, l&apos;extension lit le texte de cette page et
            l&apos;envoie à Applyfy pour pré-remplir ta candidature. Elle ne lit aucun autre onglet et ne
            conserve aucune donnée.
          </li>
          <li>
            <strong>Abonnement Premium :</strong> statut de ton abonnement, dates de la période en cours
            et identifiants client et abonnement Stripe. Tes données de carte bancaire sont saisies et
            traitées directement par Stripe : Applyfy n&apos;y a jamais accès et ne les stocke pas.
          </li>
        </ul>
        <p>
          Aucune donnée n&apos;est collectée à des fins publicitaires et aucune n&apos;est vendue ni
          cédée à des tiers.
        </p>
      </LegalSection>

      <LegalSection title="Finalités et base légale">
        <ul>
          <li>Suivi de tes candidatures, rappels de relance, email de bienvenue à l&apos;inscription et email de relance J+2 si aucune candidature ajoutée, par email ;</li>
          <li>
            Génération de documents par intelligence artificielle (résumé d&apos;offre, analyse et
            adaptation de CV, lettre de motivation), uniquement à ta demande ;
          </li>
          <li>Gestion de l&apos;abonnement Premium et de son paiement, si tu y souscris.</li>
        </ul>
        <p>
          Ces traitements sont nécessaires à la fourniture du service que tu utilises (exécution des
          conditions générales d&apos;utilisation, article 6.1.b du RGPD).
        </p>
      </LegalSection>

      <LegalSection title="Durée de conservation">
        <p>
          Tes données sont conservées <strong>jusqu&apos;à la suppression de ton compte</strong>. La
          suppression efface définitivement ton compte, tes candidatures, tes CV et tous tes
          documents.
        </p>
      </LegalSection>

      <LegalSection title="Tes droits">
        <p>Conformément au RGPD, tu disposes des droits suivants sur tes données :</p>
        <ul>
          <li>
            <strong>Accès et rectification :</strong> consulte et modifie tes informations à tout moment
            dans l&apos;application (fiches candidatures, <strong>Mon profil</strong>).
          </li>
          <li>
            <strong>Suppression :</strong> supprime ton compte et toutes tes données depuis{" "}
            <strong>Mon profil → Zone dangereuse</strong>.
          </li>
          <li>
            <strong>Portabilité, opposition, limitation :</strong> sur simple demande à <ContactLink />.
          </li>
        </ul>
        <p>
          Si tu estimes que tes droits ne sont pas respectés, tu peux adresser une réclamation à la CNIL
          (<a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">cnil.fr</a>).
        </p>
      </LegalSection>

      <LegalSection title="Sous-traitants">
        <p>Applyfy s&apos;appuie sur les prestataires suivants, qui traitent tes données pour son compte :</p>
        <ul>
          {PROCESSORS.map((p) => (
            <li key={p.name}>
              <strong>{p.name}</strong> — {p.role} (
              <a href={p.url} target="_blank" rel="noopener noreferrer">
                politique de confidentialité
              </a>
              )
            </li>
          ))}
        </ul>
        <p>
          Lorsque tu utilises une fonctionnalité d&apos;IA, les informations nécessaires (CV, texte de
          l&apos;offre, résumé de profil) sont transmises à Anthropic pour cette seule requête. Selon ses
          conditions commerciales, Anthropic n&apos;utilise pas les données reçues via son API pour
          entraîner ses modèles.
        </p>
        <p>
          Certains de ces prestataires sont établis aux États-Unis. Les transferts de données hors de
          l&apos;Union européenne sont encadrés par les garanties prévues par le RGPD (clauses
          contractuelles types de la Commission européenne et/ou Data Privacy Framework).
        </p>
      </LegalSection>

      <LegalSection title="Cookies, stockage local et mesure d'audience">
        <p>
          Sans ton accord, Applyfy n&apos;utilise que des cookies strictement nécessaires (maintien de ta
          connexion) et le stockage local de ton navigateur, pour mémoriser les bulles d&apos;aide déjà
          vues et ton choix concernant les cookies.
        </p>
        <p>
          <strong>Recherches récentes :</strong> uniquement si tu actives les « Recommandations
          personnalisées » dans « Trouver une offre », tes 5 dernières recherches (mots-clés,
          localisation, type de contrat) sont gardées 30 jours dans un cookie de ton navigateur, pour
          personnaliser les offres recommandées. Elles ne sont pas enregistrées dans notre base de
          données. Désactiver les recommandations efface ce cookie ; tant qu&apos;elles sont désactivées,
          aucune recherche n&apos;est mémorisée.
        </p>
        <p>
          <strong>Cookies publicitaires (Meta Pixel, Google Ads) :</strong> si tu les acceptes dans le
          bandeau affiché lors de ta première visite, Applyfy charge le pixel de Meta (Facebook,
          Instagram) et la balise Google Ads pour mesurer l&apos;efficacité de ses publicités. Meta et
          Google reçoivent alors les pages que tu visites sur Applyfy et déposent des cookies dans ton
          navigateur (par exemple _fbp pour Meta, _gcl_au pour Google). Sans acceptation, rien
          n&apos;est chargé ni envoyé à Meta ou à Google. Ton choix est conservé 6 mois ; tu peux le modifier à tout moment
          avec le lien « Gestion des cookies » en bas de chaque page.
        </p>
        <p>
          Pour comprendre comment le site est utilisé (pages vues, provenance des visites, type
          d&apos;appareil), Applyfy utilise <strong>Vercel Web Analytics</strong>. Cet outil ne dépose
          aucun cookie, ne permet pas de te suivre d&apos;un site à l&apos;autre et ne produit que des
          statistiques agrégées et anonymes.
        </p>
      </LegalSection>

      <LegalSection title="Sécurité">
        <p>
          Les échanges sont chiffrés (HTTPS). Tes données ne sont accessibles qu&apos;à ton compte : chaque
          accès est contrôlé côté base de données, et tes CV sont stockés dans un espace privé.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Pour toute question sur tes données : <ContactLink />.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
