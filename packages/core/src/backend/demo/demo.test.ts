import { strict as assert } from 'node:assert';
import { after, before, describe, it } from 'node:test';
import { createDemoBackend } from './index';
import { memoryStorage } from '../storage';
import { isBackendError } from '../errors';
import type { OnyxBackend } from '../types';
import { seedTechnicianId } from '../../seed/technicians';

const TECH1 = seedTechnicianId(1);

async function rejectsWith(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (e: unknown) => isBackendError(e) && e.code === code);
}

describe('demo backend', () => {
  let backend: OnyxBackend;
  before(async () => {
    backend = await createDemoBackend({ storage: memoryStorage(), simulate: false, latencyMs: [0, 0] });
  });
  after(() => backend.dispose());

  it('lists verified technicians near Akwa, closest first', async () => {
    const list = await backend.directory.nearby({ center: { lat: 4.0525, lng: 9.6963 }, radiusKm: 5 });
    assert.equal(list[0]?.id, TECH1);
    assert.ok(list.every((t) => t.verificationStatus === 'verified'));
  });

  it('requires an account to create a request', async () => {
    await rejectsWith(
      backend.requests.create({
        category: 'battery',
        description: '',
        urgency: 'medium',
        vehicle: { type: 'car' },
        location: { lat: 4.05, lng: 9.7 },
        landmark: 'Pharmacie',
        contactName: 'Test',
        contactPhone: '699000000',
      }),
      'unauthenticated',
    );
  });

  it('runs a complete job between the demo driver and the demo technician', async () => {
    await backend.auth.demo!.signInAs('driver');
    const created = await backend.requests.create({
      category: 'battery',
      description: 'Clics au démarrage',
      urgency: 'medium',
      vehicle: { type: 'car', make: 'Toyota' },
      location: { lat: 4.0531, lng: 9.7002 },
      landmark: 'Face à la pharmacie',
      contactName: 'Arielle Ekambi',
      contactPhone: '6 99 00 00 00',
      requestedTechnicianId: TECH1,
    });
    assert.equal(created.contactPhone, '+237699000000');
    assert.equal(created.placeLabel, 'Akwa, Douala');

    await backend.auth.demo!.signInAs('technician');
    const inbox = await backend.pro.inbox();
    assert.ok(inbox.some((i) => i.id === created.id && i.isDirect));
    await backend.pro.accept(created.id);
    await rejectsWith(backend.pro.advance(created.id, 'arrived'), 'invalid_transition');
    await backend.pro.advance(created.id, 'en_route');
    await backend.pro.advance(created.id, 'arrived');
    await backend.pro.saveDiagnosis(created.id, 'Batterie HS');
    await backend.pro.sendQuote(created.id, {
      items: [{ label: 'Batterie 70 Ah', kind: 'part', quantity: 1, unitPrice: 55000 }],
    });

    await backend.auth.demo!.signInAs('driver');
    let detail = await backend.requests.get(created.id);
    assert.equal(detail?.request.status, 'quoted');
    await backend.requests.respondToQuote(detail!.quotes[0]!.id, true);

    await backend.auth.demo!.signInAs('technician');
    await backend.pro.complete(created.id, { method: 'cash', amount: 55000 });

    await backend.auth.demo!.signInAs('driver');
    await backend.requests.review({ requestId: created.id, rating: 5, tags: ['punctual'] });
    detail = await backend.requests.get(created.id);
    assert.equal(detail?.request.status, 'completed');
    assert.equal(detail?.payment?.commission, 5500);
    assert.equal(detail?.review?.rating, 5);
    assert.deepEqual(
      detail?.events.map((e) => e.type),
      ['created', 'accepted', 'en_route', 'arrived', 'diagnosis', 'quote_sent', 'quote_accepted', 'completed', 'reviewed'],
    );
    await rejectsWith(backend.requests.review({ requestId: created.id, rating: 4 }), 'conflict');
  });

  it('keeps admin tools to admins', async () => {
    await backend.auth.demo!.signInAs('driver');
    await rejectsWith(backend.admin.metrics(), 'forbidden');
    await backend.auth.demo!.signInAs('admin');
    const metrics = await backend.admin.metrics();
    assert.equal(metrics.daily.length, 14);
    assert.ok(metrics.requests.last30d > 50);
    const pending = await backend.admin.technicians('pending');
    assert.equal(pending.length, 2);
    await rejectsWith(backend.admin.setVerification(pending[0]!.id, 'rejected'), 'validation');
    await backend.admin.setVerification(pending[0]!.id, 'verified');
    assert.equal((await backend.admin.technicians('pending')).length, 1);
  });
});
