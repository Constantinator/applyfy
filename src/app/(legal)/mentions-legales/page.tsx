import type { Metadata } from "next";
import Link from "next/link";

import { ContactLink, LegalDocument, LegalSection } from "@/components/legal/legal-document";

export const metadata: Metadata = { title: "Mentions légales — Applyfy" };

export default function LegalNoticePage() {
  return (
    <LegalDocument
      title="Mentions légales"
      intro="Conformément à la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l'économie numérique (LCEN), voici les informations relatives à l'éditeur et à l'hébergeur du site Applyfy."
    >
      <LegalSection title="Éditeur du site">
        <p>
          Le site Applyfy est édité à titre personnel par <strong>Constantin Varin</strong>, étudiant.
        </p>
        <ul>
          <li>Directeur de la publication : Constantin Varin</li>
          <li>
            Contact : <ContactLink />
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Hébergeur">
        <p>
          <strong>Vercel Inc.</strong>
          <br />
          340 Pine Street, San Francisco, Californie, États-Unis
          <br />
          Site : <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">vercel.com</a>
        </p>
      </LegalSection>

      <LegalSection title="Propriété intellectuelle">
        <p>
          La marque Applyfy, le logo, la charte graphique et le code du site sont la propriété de leur
          éditeur. Toute reproduction ou réutilisation sans autorisation est interdite. Les contenus
          que tu ajoutes (CV, candidatures, notes, lettres) restent ta propriété.
        </p>
      </LegalSection>

      <LegalSection title="Données personnelles">
        <p>
          Le traitement de tes données est détaillé dans la{" "}
          <Link href="/politique-confidentialite">politique de confidentialité</Link>. L&apos;utilisation du
          service est encadrée par les <Link href="/cgu">conditions générales d&apos;utilisation</Link>.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Pour toute question ou signalement concernant le site : <ContactLink />.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
