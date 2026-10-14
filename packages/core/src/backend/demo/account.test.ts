import { strict as assert } from 'node:assert';
import { after, before, describe, it } from 'node:test';
import { createDemoBackend } from './index';
import { memoryStorage } from '../storage';
import { isBackendError } from '../errors';
import type { OnyxBackend } from '../types';
import { seedTechnicianId } from '../../seed/technicians';

const DEMO_TECH = seedTechnicianId(1);
const AWA = { email: 'awa@example.cm', password: 'long-enough' };

async function rejectsWith(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (e: unknown) => isBackendError(e) && e.code === code);
}

describe('deleting an account (demo)', () => {
  let backend: OnyxBackend;
  before(async () => {
    backend = await createDemoBackend({ storage: memoryStorage(), simulate: false, latencyMs: [0, 0] });
  });
  after(() => backend.dispose());

  it('keeps the three demo accounts', async () => {
    await backend.auth.demo!.signInAs('driver');
    await rejectsWith(backend.auth.deleteAccount(), 'forbidden');
  });

  it('erases the person but keeps their completed job, anonymised', async () => {
    await backend.auth.signUp({ ...AWA, fullName: 'Awa Ngo', phone: '6 77 00 00 00', intent: 'driver', locale: 'fr' });
    const request = await backend.requests.create({
      category: 'battery',
      description: 'Ma batterie est à plat',
      urgency: 'medium',
      vehicle: { type: 'car', make: 'Toyota', plate: 'LT 123 AB' },
      location: { lat: 4.05312, lng: 9.70024 },
      landmark: 'Devant chez moi',
      contactName: 'Awa Ngo',
      contactPhone: '6 77 00 00 00',
      requestedTechnicianId: DEMO_TECH,
    });
    await rejectsWith(backend.auth.deleteAccount(), 'conflict');

    await backend.auth.demo!.signInAs('technician');
    await backend.pro.accept(request.id);
    await backend.pro.advance(request.id, 'en_route');
    await backend.pro.advance(request.id, 'arrived');
    await backend.pro.sendQuote(request.id, { items: [{ label: 'Recharge', kind: 'labour', quantity: 1, unitPrice: 5000 }] });
    await backend.auth.signIn(AWA);
    const quote = (await backend.requests.get(request.id))!.quotes[0]!;
    await backend.requests.respondToQuote(quote.id, true);
    await backend.auth.demo!.signInAs('technician');
    await backend.pro.complete(request.id, { method: 'cash', amount: 5000 });
    await backend.auth.signIn(AWA);
    await backend.requests.review({ requestId: request.id, rating: 5, comment: 'Très rapide', tags: [] });

    await backend.auth.deleteAccount();
    assert.equal(await backend.auth.getSession(), null, 'signed out');
    await rejectsWith(backend.auth.signIn(AWA), 'invalid_credentials');

    await backend.auth.demo!.signInAs('technician');
    const job = (await backend.pro.job(request.id))!;
    assert.equal(job.request.driverId, null);
    assert.equal(job.request.contactPhone, null);
    assert.equal(job.request.contactName, 'Compte supprimé');
    assert.deepEqual(job.request.vehicle, { type: 'car' });
    assert.deepEqual(job.request.location, { lat: 4.05, lng: 9.7 });
    assert.equal(job.payment?.amount, 5000, 'the payment stays for the accounts');
    assert.equal(job.review?.rating, 5, 'the rating stays');
    assert.equal(job.review?.comment, null);
    assert.equal(job.review?.reviewerName, '');
  });
});
