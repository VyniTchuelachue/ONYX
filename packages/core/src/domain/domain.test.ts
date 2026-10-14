import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { describeLocation, estimateEtaMinutes, formatDistance, haversineKm, nearestCorridor, placeLabelFor } from './geo';
import { DOUALA_QUARTERS } from './places';
import { formatXAF, quoteTotal, commissionFor } from './money';
import { formatPhone, normalizePhone, whatsappHref } from './phone';
import { canTransition, milestoneIndex, nextTechnicianStep } from './status';
import { effectiveAvailability } from './availability';

const quarter = (name: string) => DOUALA_QUARTERS.find((q) => q.name === name)!;

describe('geo', () => {
  it('measures distances across Douala', () => {
    const d = haversineKm(quarter('Akwa'), quarter('Ndokoti'));
    assert.ok(d > 4.5 && d < 6, `Akwa → Ndokoti ${d}`);
  });

  it('names the nearest quarter inside Douala', () => {
    const ctx = describeLocation({ lat: 4.0436, lng: 9.7431 });
    assert.equal(ctx.inDouala, true);
    assert.equal(ctx.label, 'Ndokoti');
    assert.equal(placeLabelFor({ lat: 4.0436, lng: 9.7431 }), 'Ndokoti, Douala');
  });

  it('recognises the intercity roads', () => {
    assert.equal(nearestCorridor({ lat: 3.83, lng: 10.3 }), 'douala-yaounde'); // between Edéa and Pouma
    assert.equal(nearestCorridor({ lat: 4.69, lng: 9.71 }), 'douala-bafoussam'); // near Loum
    assert.equal(nearestCorridor({ lat: 4.08, lng: 9.4 }), 'douala-limbe'); // near Tiko
    assert.equal(nearestCorridor({ lat: 6.5, lng: 12 }), null);
    assert.equal(placeLabelFor({ lat: 3.8, lng: 10.13 }), 'Edéa (N3)');
  });

  it('formats distances for each language', () => {
    assert.equal(formatDistance(2.43, 'fr'), '2,4 km');
    assert.equal(formatDistance(2.43, 'en'), '2.4 km');
    assert.equal(formatDistance(0.42, 'en'), '420 m');
    assert.equal(formatDistance(37.6, 'fr'), '38 km');
  });

  it('estimates travel time conservatively', () => {
    assert.ok(estimateEtaMinutes(3) >= 14);
    assert.ok(estimateEtaMinutes(60) > estimateEtaMinutes(10));
  });
});

describe('money', () => {
  it('formats FCFA with non-breaking spaces', () => {
    assert.equal(formatXAF(15000, 'fr'), '15 000 FCFA');
    assert.equal(formatXAF(15000, 'en'), '15,000 FCFA');
  });
  it('totals quotes and commission', () => {
    const total = quoteTotal([
      { label: 'Batterie', kind: 'part', quantity: 1, unitPrice: 55000 },
      { label: 'Pose', kind: 'labour', quantity: 2, unitPrice: 1500 },
    ]);
    assert.equal(total, 58000);
    assert.equal(commissionFor(total), 5800);
  });
});

describe('phone', () => {
  it('normalises Cameroonian numbers however they are typed', () => {
    for (const input of ['699123456', '6 99 12 34 56', '+237 6 99 12 34 56', '00237699123456', '237699123456']) {
      assert.equal(normalizePhone(input), '+237699123456', input);
    }
    assert.equal(normalizePhone('233456789'), '+237233456789'); // Camtel landline
  });
  it('accepts foreign numbers and rejects junk', () => {
    assert.equal(normalizePhone('+33 6 12 34 56 78'), '+33612345678');
    assert.equal(normalizePhone('12345'), null);
    assert.equal(normalizePhone('+237 512345678'), null);
  });
  it('formats and links', () => {
    assert.equal(formatPhone('+237699123456'), '+237 6 99 12 34 56');
    assert.equal(whatsappHref('+237699123456', 'Bonjour'), 'https://wa.me/237699123456?text=Bonjour');
  });
});

describe('request lifecycle', () => {
  it('only allows the documented transitions', () => {
    assert.ok(canTransition('pending', 'accepted', 'technician'));
    assert.ok(!canTransition('pending', 'accepted', 'driver'));
    assert.ok(!canTransition('accepted', 'arrived', 'technician'));
    assert.ok(canTransition('quoted', 'in_progress', 'driver'));
    assert.ok(!canTransition('in_progress', 'cancelled', 'driver'));
    assert.ok(canTransition('in_progress', 'cancelled', 'admin'));
    assert.ok(!canTransition('completed', 'cancelled', 'admin'));
  });
  it('maps statuses onto the road milestones', () => {
    assert.equal(milestoneIndex('quoted'), milestoneIndex('arrived'));
    assert.equal(milestoneIndex('cancelled'), -1);
    assert.equal(nextTechnicianStep('arrived'), 'quote');
  });
});

describe('availability', () => {
  const now = new Date('2026-10-14T12:00:00Z');
  it('does not overstate availability', () => {
    const base = { availability: 'available' as const, availabilityUpdatedAt: '2026-10-14T11:00:00Z' };
    assert.equal(effectiveAvailability({ ...base, lastSeenAt: '2026-10-14T11:50:00Z' }, now), 'available');
    assert.equal(effectiveAvailability({ ...base, lastSeenAt: '2026-10-14T02:00:00Z' }, now), 'unconfirmed');
    assert.equal(effectiveAvailability({ ...base, lastSeenAt: '2026-10-14T11:50:00Z' }, now, { offline: true }), 'unverified');
  });
});
