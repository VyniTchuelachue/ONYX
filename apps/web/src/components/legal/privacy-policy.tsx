'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { polishText, type Locale } from '@onyx/core';
import { useI18n } from '@/lib/i18n';
import { config } from '@/lib/config';

/*
 * ONYX privacy policy. Keep it true to what the app does: when a feature changes what is
 * collected or who sees it, update this page and its date. The statements here match
 * the database rules (supabase/migrations) and the account deletion function.
 */
const UPDATED: Record<Locale, string> = { fr: '15 octobre 2026', en: 'October 15, 2026' };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-wide text-[17px] font-semibold text-ink">{title}</h2>
      <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-gold">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

const linkClass = 'font-medium text-gold-bright underline-offset-4 hover:underline';

export function PrivacyPolicy() {
  const { locale } = useI18n();
  const p = (text: string) => polishText(text, locale);
  const email = config.supportEmail;
  const mail = email ? (
    <a href={`mailto:${email}`} className={linkClass}>
      {email}
    </a>
  ) : null;
  const deletePage = (
    <Link href="/account/delete" className={linkClass}>
      {locale === 'fr' ? 'Supprimer votre compte' : 'Delete your account'}
    </Link>
  );

  if (locale === 'en') {
    return (
      <article>
        <h1 className="font-display text-[30px] leading-tight text-ink">Privacy policy</h1>
        <p className="mt-2 text-[14px] text-ink-3">Last updated {UPDATED.en}</p>
        <p className="mt-5 text-[15px] leading-relaxed text-ink-2">
          ONYX connects drivers who have broken down with mechanics, auto electricians, tyre repairers and tow trucks in
          Douala and on Cameroon&apos;s roads. This page explains what information we use, why, who sees it and how to
          delete it. It applies to the ONYX app on the web and on phones.
        </p>

        <Section title="Who we are">
          <p>
            ONYX is responsible for your data and handles it in line with Cameroon&apos;s law no. 2024/017 of 23 December
            2024 on the protection of personal data.{mail && <> For any question, write to {mail}.</>}
          </p>
        </Section>

        <Section title="What we collect">
          <List
            items={[
              <>
                <strong className="text-ink">Your account:</strong> name, email address, password (stored in a form we
                cannot read back), phone number (optional for drivers), language and, if you save it, your vehicle (type,
                make, model, colour, plate).
              </>,
              <>
                <strong className="text-ink">Your requests for help:</strong> the problem (category, description,
                urgency), the assistant&apos;s summary, your vehicle, your position (GPS or the area you chose) and
                landmark, the name and number to call, then how the job went: quotes, the payment declared (amount and
                method) and your review.
              </>,
              <>
                <strong className="text-ink">Technicians:</strong> on top of the account, the business listing (business
                and owner name, phone, WhatsApp, specialties, workshop area and position, hours, description), the
                verification documents (ID, business licence, workshop photo, certificates), availability, the position
                shared while driving to a customer, and the ratings received.
              </>,
              <>
                <strong className="text-ink">The assistant:</strong> the messages you type or dictate.
              </>,
              <>
                <strong className="text-ink">Alerts, if you turn them on:</strong> a technical address your browser gives
                us to send them, your language and the type of device.
              </>,
              <>
                <strong className="text-ink">On your phone only:</strong> the technician list saved for offline use, your
                favourites, your last known position, your drafts and your conversation with the assistant stay on your
                device and are not sent to us.
              </>,
            ]}
          />
        </Section>

        <Section title="Why we use it">
          <List
            items={[
              'To find technicians near you and pass on your request.',
              'To let the technician call you and reach you.',
              'To follow the job, its quotes and payments, and the commission technicians owe ONYX.',
              'To check technicians before they appear in the directory.',
              'To send the alerts you asked for.',
              'To keep the service safe, handle disputes and improve ONYX.',
            ]}
          />
          <p>We do not sell your data or use it for advertising.</p>
        </Section>

        <Section title="Who sees what">
          <List
            items={[
              <>
                <strong className="text-ink">Technicians</strong> see the category, the description and an approximate
                position of your request (to about a kilometre). Your name, number and exact position are only shown once a
                technician accepts your request, and only to that technician.
              </>,
              <>
                <strong className="text-ink">Drivers</strong> see verified technicians&apos; public listing: business
                name, owner, phone, specialties, area and ratings. Public reviews only show the reviewer&apos;s first name
                and initial.
              </>,
              <>
                <strong className="text-ink">The ONYX team</strong> sees requests, listings, verification documents and
                payments, to check technicians, help when something goes wrong and manage commissions.
              </>,
            ]}
          />
        </Section>

        <Section title="Services we use">
          <List
            items={[
              'Supabase: database, accounts and document storage.',
              'Vercel: hosting of the app.',
              'Anthropic (Claude): when the smart assistant is on, your messages are sent to it to write the answer. Otherwise the built-in guide answers without sending anything to anyone.',
              'Your browser or phone: voice dictation uses your device’s speech recognition service (for example Google on Android), and alerts go through your browser’s notification service (Google, Apple or Mozilla).',
              'OpenStreetMap: maps are loaded from this service, which receives your IP address and the area on screen.',
              'Our email provider sends account confirmation and password reset messages.',
            ]}
          />
          <p>These services may be located outside Cameroon.</p>
        </Section>

        <Section title="How long we keep it">
          <p>Your information is kept as long as your account exists.</p>
          <p>
            When you delete your account, your account, profile, vehicles, saved phones, unfinished requests and, for a
            technician, the listing and verification documents are erased. Completed jobs and their payments stay, without
            your name, number, vehicle or exact position, for the accounts and to handle any dispute. Your reviews keep
            their rating, without your name or comment.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            You can see and correct your information in your profile at any time, and delete your account in the app
            (Profile, then “Delete my account”) or on the {deletePage} page.
            {mail && <> For anything else (a copy of your data, an objection, a question), write to {mail}.</>}
          </p>
        </Section>

        <Section title="Security">
          <p>
            Everything travels encrypted (HTTPS). Each account can only reach its own data, a rule enforced by the
            database itself. Verification documents are kept in private storage that only the technician and the ONYX
            team can open.
          </p>
        </Section>

        <Section title="Age">
          <p>ONYX is meant for people aged 18 and over.</p>
        </Section>

        <Section title="Changes">
          <p>If this policy changes, we will update this page and its date.</p>
        </Section>
      </article>
    );
  }

  return (
    <article>
      <h1 className="font-display text-[30px] leading-tight text-ink">Politique de confidentialité</h1>
      <p className="mt-2 text-[14px] text-ink-3">{p(`Dernière mise à jour : ${UPDATED.fr}`)}</p>
      <p className="mt-5 text-[15px] leading-relaxed text-ink-2">
        {p(
          'ONYX met en relation des conducteurs en panne avec des mécaniciens, électriciens auto, vulcanisateurs et dépanneurs à Douala et sur les routes du Cameroun. Cette page explique quelles informations nous utilisons, pourquoi, qui les voit et comment les supprimer. Elle s’applique à l’application ONYX, sur le web comme sur téléphone.',
        )}
      </p>

      <Section title="Qui sommes-nous">
        <p>
          {p(
            'ONYX est responsable de vos données et les traite conformément à la loi n° 2024/017 du 23 décembre 2024 relative à la protection des données à caractère personnel au Cameroun.',
          )}
          {mail && <> {p('Pour toute question, écrivez-nous à')} {mail}.</>}
        </p>
      </Section>

      <Section title="Ce que nous collectons">
        <List
          items={[
            <>
              <strong className="text-ink">{p('Votre compte :')}</strong>{' '}
              {p(
                'nom, adresse e-mail, mot de passe (conservé sous une forme que nous ne pouvons pas relire), numéro de téléphone (facultatif pour les conducteurs), langue et, si vous l’enregistrez, votre véhicule (type, marque, modèle, couleur, immatriculation).',
              )}
            </>,
            <>
              <strong className="text-ink">{p('Vos demandes d’assistance :')}</strong>{' '}
              {p(
                'le problème décrit (catégorie, description, urgence), le résumé de l’assistant, votre véhicule, votre position (GPS ou quartier choisi) et votre repère, le nom et le numéro à joindre, puis le déroulé de l’intervention : devis, paiement déclaré (montant et moyen) et votre avis.',
              )}
            </>,
            <>
              <strong className="text-ink">{p('Les techniciens :')}</strong>{' '}
              {p(
                'en plus du compte, la fiche professionnelle (nom de l’activité et du responsable, téléphone, WhatsApp, spécialités, zone et position de l’atelier, horaires, présentation), les documents de vérification (pièce d’identité, patente ou registre de commerce, photo de l’atelier, certificats), la disponibilité, la position partagée pendant le trajet vers un client et les notes reçues.',
              )}
            </>,
            <>
              <strong className="text-ink">{p('L’assistant :')}</strong> {p('les messages que vous écrivez ou dictez.')}
            </>,
            <>
              <strong className="text-ink">{p('Les alertes, si vous les activez :')}</strong>{' '}
              {p('une adresse technique fournie par votre navigateur pour vous les envoyer, votre langue et le type d’appareil.')}
            </>,
            <>
              <strong className="text-ink">{p('Sur votre téléphone seulement :')}</strong>{' '}
              {p(
                'la liste de techniciens enregistrée pour le mode hors ligne, vos favoris, votre dernière position connue, vos brouillons et votre conversation avec l’assistant restent sur votre appareil et ne nous sont pas envoyés.',
              )}
            </>,
          ]}
        />
      </Section>

      <Section title="Pourquoi nous les utilisons">
        <List
          items={[
            p('Vous trouver des techniciens proches et leur transmettre votre demande.'),
            p('Permettre au technicien de vous appeler et de vous rejoindre.'),
            p('Suivre l’intervention, ses devis et ses paiements, ainsi que la commission due à ONYX par les techniciens.'),
            p('Vérifier les techniciens avant qu’ils n’apparaissent dans l’annuaire.'),
            p('Vous envoyer les alertes que vous avez demandées.'),
            p('Assurer la sécurité du service, traiter les litiges et améliorer ONYX.'),
          ]}
        />
        <p>{p('Nous ne vendons pas vos données et ne les utilisons pas pour de la publicité.')}</p>
      </Section>

      <Section title="Qui voit quoi">
        <List
          items={[
            <>
              <strong className="text-ink">{p('Les techniciens')}</strong>{' '}
              {p(
                'voient la catégorie, la description et une position approximative de votre demande (à environ un kilomètre près). Votre nom, votre numéro et votre position exacte ne sont montrés qu’une fois votre demande acceptée, et seulement au technicien qui l’a acceptée.',
              )}
            </>,
            <>
              <strong className="text-ink">{p('Les conducteurs')}</strong>{' '}
              {p(
                'voient la fiche publique des techniciens vérifiés : nom de l’activité, responsable, téléphone, spécialités, zone et notes. Les avis publics n’affichent que le prénom et l’initiale du nom de leur auteur.',
              )}
            </>,
            <>
              <strong className="text-ink">{p('L’équipe ONYX')}</strong>{' '}
              {p(
                'voit les demandes, les fiches, les documents de vérification et les paiements, pour vérifier les techniciens, aider en cas de problème et gérer les commissions.',
              )}
            </>,
          ]}
        />
      </Section>

      <Section title="Les services que nous utilisons">
        <List
          items={[
            p('Supabase : base de données, comptes et stockage des documents.'),
            p('Vercel : hébergement de l’application.'),
            p(
              'Anthropic (Claude) : quand l’assistant intelligent est activé, vos messages lui sont envoyés pour rédiger la réponse. Sinon, le guide intégré répond sans rien envoyer à personne.',
            ),
            p(
              'Votre navigateur ou votre téléphone : la dictée vocale utilise le service de reconnaissance vocale de votre appareil (par exemple Google sur Android), et les alertes passent par le service de notifications de votre navigateur (Google, Apple ou Mozilla).',
            ),
            p('OpenStreetMap : les cartes sont chargées depuis ce service, qui reçoit votre adresse IP et la zone affichée.'),
            p('Notre fournisseur d’e-mails envoie les messages de confirmation de compte et de nouveau mot de passe.'),
          ]}
        />
        <p>{p('Ces services peuvent être situés hors du Cameroun.')}</p>
      </Section>

      <Section title="Combien de temps nous les gardons">
        <p>{p('Vos informations sont conservées tant que votre compte existe.')}</p>
        <p>
          {p(
            'Quand vous supprimez votre compte, votre compte, votre profil, vos véhicules, vos téléphones enregistrés, vos demandes non terminées et, pour un technicien, sa fiche et ses documents de vérification sont effacés. Les interventions terminées et leurs paiements restent, sans votre nom, votre numéro, votre véhicule ni votre position exacte, pour la comptabilité et le traitement d’éventuels litiges. Vos avis gardent leur note, sans votre nom ni votre commentaire.',
          )}
        </p>
      </Section>

      <Section title="Vos droits">
        <p>
          {p(
            'Vous pouvez à tout moment consulter et corriger vos informations dans votre profil, et supprimer votre compte dans l’application (Profil, puis « Supprimer mon compte ») ou sur la page',
          )}{' '}
          {deletePage}.
          {mail && (
            <>
              {' '}
              {p('Pour toute autre demande (copie de vos données, opposition, question), écrivez-nous à')} {mail}.
            </>
          )}
        </p>
      </Section>

      <Section title="Sécurité">
        <p>
          {p(
            'Les échanges sont chiffrés (HTTPS). Chaque compte n’accède qu’à ses propres données, une règle appliquée par la base de données elle-même. Les documents de vérification sont conservés dans un espace privé, que seuls le technicien et l’équipe ONYX peuvent ouvrir.',
          )}
        </p>
      </Section>

      <Section title="Âge">
        <p>{p('ONYX s’adresse aux personnes de 18 ans et plus.')}</p>
      </Section>

      <Section title="Modifications">
        <p>{p('Si cette politique change, nous mettrons à jour cette page et sa date.')}</p>
      </Section>
    </article>
  );
}
