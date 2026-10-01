import type { Metadata } from "next";
import Link from "next/link";

import { ContactLink, LegalDocument, LegalSection } from "@/components/legal/legal-document";

export const metadata: Metadata = { title: "Conditions générales d'utilisation — Applyfy" };

export default function TermsPage() {
  return (
    <LegalDocument
      title="Conditions générales d'utilisation"
      intro="Les présentes conditions générales d'utilisation (CGU) encadrent l'accès et l'utilisation du service Applyfy. En créant un compte, tu les acceptes sans réserve."
    >
      <LegalSection title="1. Objet du service">
        <p>
          Applyfy est un outil en ligne qui t&apos;aide à organiser ta recherche d&apos;emploi : suivi de
          tes candidatures, rappels de relance, et génération assistée par intelligence artificielle
          de résumés d&apos;offres, de CV adaptés et de lettres de motivation.
        </p>
      </LegalSection>

      <LegalSection title="2. Accès et compte">
        <ul>
          <li>L&apos;inscription est ouverte à toute personne disposant d&apos;une adresse email valide.</li>
          <li>Tu t&apos;engages à fournir des informations exactes et à les tenir à jour.</li>
          <li>
            Tu es responsable de la confidentialité de ton mot de passe et de toute activité réalisée
            depuis ton compte.
          </li>
          <li>
            Tu peux supprimer ton compte à tout moment depuis <strong>Mon profil</strong>.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Gratuité pendant la phase bêta">
        <p>
          Applyfy est actuellement en <strong>phase bêta</strong> et <strong>gratuit</strong>. Des
          fonctionnalités peuvent évoluer, être ajoutées ou retirées. Si une offre payante devait être
          proposée à l&apos;avenir, tu en serais informé·e à l&apos;avance et rien ne te serait facturé
          sans ton accord explicite.
        </p>
      </LegalSection>

      <LegalSection title="4. Utilisation acceptable">
        <p>Tu t&apos;engages à utiliser Applyfy de manière loyale. Il est notamment interdit :</p>
        <ul>
          <li>d&apos;utiliser le service à des fins illégales, frauduleuses ou contraires à l&apos;ordre public ;</li>
          <li>
            de générer ou diffuser des documents mensongers (faux diplômes, expériences inventées) ou
            portant atteinte aux droits de tiers ;
          </li>
          <li>d&apos;importer des contenus illicites ou des données personnelles de tiers sans droit ;</li>
          <li>
            de tenter de perturber le service, d&apos;en contourner les limites ou d&apos;accéder aux
            données d&apos;autres utilisateurs ;
          </li>
          <li>d&apos;automatiser l&apos;utilisation du service de manière abusive.</li>
        </ul>
        <p>
          En cas de manquement, l&apos;éditeur peut suspendre ou supprimer le compte concerné.
        </p>
      </LegalSection>

      <LegalSection title="5. Contenus générés par l'intelligence artificielle">
        <p>
          Les résumés, suggestions, CV adaptés et lettres de motivation sont générés automatiquement
          par une intelligence artificielle, à partir des informations que tu fournis. Ils peuvent
          contenir des erreurs, des imprécisions ou des formulations inadaptées.
        </p>
        <ul>
          <li>
            Ces contenus sont des <strong>propositions</strong> : tu dois les relire, les vérifier et les
            corriger avant toute utilisation.
          </li>
          <li>
            Tu restes <strong>seul·e responsable</strong> des documents que tu envoies aux recruteurs et
            de l&apos;exactitude des informations qu&apos;ils contiennent.
          </li>
          <li>
            Applyfy ne garantit aucun résultat dans ta recherche d&apos;emploi (entretien, embauche).
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Tes contenus">
        <p>
          Tu restes propriétaire des contenus que tu ajoutes (CV, candidatures, notes) et des documents
          générés pour toi. Tu accordes à Applyfy le seul droit de les traiter pour te fournir le
          service, dans les conditions décrites par la{" "}
          <Link href="/politique-confidentialite">politique de confidentialité</Link>.
        </p>
      </LegalSection>

      <LegalSection title="7. Disponibilité et limitation de responsabilité">
        <p>
          Le service est fourni « en l&apos;état ». L&apos;éditeur s&apos;efforce d&apos;en assurer
          l&apos;accès et le bon fonctionnement, sans garantie de disponibilité continue : des
          interruptions (maintenance, panne d&apos;un prestataire) peuvent survenir.
        </p>
        <p>
          Dans les limites permises par la loi, l&apos;éditeur ne saurait être tenu responsable des
          dommages indirects liés à l&apos;utilisation du service, notamment de l&apos;usage fait des
          contenus générés par IA, d&apos;une perte de données ou d&apos;une opportunité manquée. Pense à
          conserver une copie de tes documents importants.
        </p>
      </LegalSection>

      <LegalSection title="8. Modification des CGU">
        <p>
          Ces conditions peuvent être modifiées pour suivre l&apos;évolution du service. La date de
          dernière mise à jour figure en haut de cette page ; en cas de changement important, tu en
          seras informé·e dans l&apos;application ou par email.
        </p>
      </LegalSection>

      <LegalSection title="9. Droit applicable et contact">
        <p>
          Les présentes CGU sont soumises au droit français. En cas de litige, une solution amiable sera
          recherchée avant toute action ; à défaut, les tribunaux français seront compétents.
        </p>
        <p>
          Pour toute question : <ContactLink />. Voir aussi les{" "}
          <Link href="/mentions-legales">mentions légales</Link>.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
