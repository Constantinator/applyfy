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
  { name: "Brevo", role: "Envoi des emails (rappels de relance)", url: "https://www.brevo.com/fr/legal/privacypolicy/" },
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
          <li>Suivi de tes candidatures et rappels de relance par email ;</li>
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
          Applyfy n&apos;utilise aucun cookie publicitaire. Seuls sont utilisés des cookies strictement
          nécessaires (maintien de ta connexion) et le stockage local de ton navigateur, pour mémoriser
          les bulles d&apos;aide déjà vues.
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
