import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { pushMessage, type PushTarget } from './notifications';
import { LOCALES } from './constants';

const base: PushTarget = {
  locale: 'fr',
  audience: 'technician',
  eventType: 'created',
  actorRole: 'driver',
  requestId: 'req-1',
  requestCode: 'ONX-7KQ2M',
  category: 'battery',
  placeLabel: 'Makepe, Douala',
  distanceKm: 2.34,
  isDirect: false,
  technicianName: 'Garage Akwa Auto Services',
  amount: null,
  rating: null,
};

// Mirrors the event lists in push_targets() (supabase/migrations/*_push.sql).
const ALERTED = {
  driver: ['accepted', 'declined', 'released', 'en_route', 'arrived', 'quote_sent', 'completed', 'cancelled'],
  technician: ['created', 'declined', 'released', 'quote_accepted', 'quote_declined', 'cancelled', 'reviewed'],
} as const;

describe('phone alerts', () => {
  it('offers a nearby request to technicians with what, where and how far', () => {
    const m = pushMessage(base)!;
    assert.equal(m.title, 'Nouvelle demande : Batterie');
    assert.match(m.body, /^Batterie à Makepe, Douala, à 2,3 km de vous./);
    assert.equal(m.url, '/pro');
    assert.equal(m.tag, 'offer-req-1');
    assert.ok(m.ttl <= 15 * 60, 'offers expire quickly');
  });

  it('tells a technician when a driver picked them', () => {
    assert.equal(pushMessage({ ...base, isDirect: true, locale: 'en' })!.title, 'A driver chose you');
  });

  it('keeps every update about one request in a single alert for the driver', () => {
    const accepted = pushMessage({ ...base, audience: 'driver', eventType: 'accepted', locale: 'en' })!;
    const arrived = pushMessage({ ...base, audience: 'driver', eventType: 'arrived', locale: 'en' })!;
    assert.equal(accepted.title, 'Garage Akwa Auto Services accepted your request');
    assert.equal(accepted.url, '/requests/req-1');
    assert.equal(accepted.tag, arrived.tag);
  });

  it('shows the quote amount in local currency', () => {
    const m = pushMessage({ ...base, audience: 'driver', eventType: 'quote_sent', amount: 58000 })!;
    assert.equal(m.title, 'Devis reçu : 58 000 FCFA');
  });

  it('says who cancelled', () => {
    const byDriver = pushMessage({ ...base, eventType: 'cancelled', actorRole: 'driver', locale: 'en' })!;
    const byTeam = pushMessage({ ...base, eventType: 'cancelled', actorRole: 'admin', locale: 'en' })!;
    assert.equal(byDriver.body, 'The driver cancelled the request.');
    assert.equal(byTeam.body, 'The ONYX team cancelled this request.');
  });

  it('has a message for every event the database alerts about, in both languages', () => {
    for (const locale of LOCALES) {
      for (const audience of ['driver', 'technician'] as const) {
        for (const eventType of ALERTED[audience]) {
          const m = pushMessage({ ...base, locale, audience, eventType, amount: 1000, rating: 5 });
          assert.ok(m && m.title && m.body && !/[{}]/.test(m.title + m.body), `${locale} ${audience} ${eventType}`);
        }
      }
    }
  });

  it('stays quiet about steps nobody needs an alert for', () => {
    assert.equal(pushMessage({ ...base, eventType: 'diagnosis', audience: 'driver' }), null);
    assert.equal(pushMessage({ ...base, eventType: 'accepted', audience: 'technician' }), null);
  });
});
