import { strict as assert } from 'node:assert';
import { after, before, describe, it } from 'node:test';
import { createDemoBackend } from './demo';
import { memoryStorage } from './storage';
import type { OnyxBackend } from './types';
import { watchMyRequests, watchOffers } from './watchers';
import { pushMessage } from '../notifications';
import { seedTechnicianId } from '../seed/technicians';

const DEMO_TECH = seedTechnicianId(1);

describe('in-app alerts', () => {
  let backend: OnyxBackend;
  before(async () => {
    backend = await createDemoBackend({ storage: memoryStorage(), simulate: false, latencyMs: [0, 0] });
  });
  after(() => backend.dispose());

  it('alerts the technician to a new request, then the driver to each step', async () => {
    await backend.auth.demo!.signInAs('technician');
    const offers = watchOffers(backend, 'fr');
    assert.deepEqual(await offers.next(), [], 'existing requests are not announced');

    await backend.auth.demo!.signInAs('driver');
    const steps = watchMyRequests(backend, 'en');
    assert.deepEqual(await steps.next(), []);
    const request = await backend.requests.create({
      category: 'flat_tire',
      description: '',
      urgency: 'high',
      vehicle: { type: 'car' },
      location: { lat: 4.0531, lng: 9.7002 },
      landmark: 'Face à la pharmacie',
      contactName: 'Arielle Ekambi',
      contactPhone: '6 99 00 00 00',
      requestedTechnicianId: DEMO_TECH,
    });
    assert.deepEqual(await steps.next(), [], 'the driver is not alerted about their own request');

    await backend.auth.demo!.signInAs('technician');
    const [offer, ...rest] = await offers.next();
    assert.equal(rest.length, 0);
    assert.equal(offer?.requestId, request.id);
    assert.equal(pushMessage(offer!)?.title, 'Un conducteur vous a choisi');
    assert.deepEqual(await offers.next(), [], 'each request is announced once');

    await backend.pro.accept(request.id);
    await backend.pro.advance(request.id, 'en_route');

    await backend.auth.demo!.signInAs('driver');
    const news = await steps.next();
    assert.deepEqual(
      news.map((n) => n.eventType),
      ['accepted', 'en_route'],
    );
    const technician = (await backend.directory.get(DEMO_TECH))!.businessName;
    assert.equal(pushMessage(news[0]!)?.title, `${technician} accepted your request`);
    assert.deepEqual(await steps.next(), []);
  });
});
