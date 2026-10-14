import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { bringToNow, createSeedDb, type DemoDb } from './store';
import { effectiveAvailability } from '../../domain/availability';

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

function timestamps(db: DemoDb): number[] {
  const out: number[] = [];
  JSON.stringify(db, (_key, value: unknown) => {
    if (typeof value === 'string' && ISO.test(value)) out.push(Date.parse(value));
    return value;
  });
  return out;
}

describe('demo world clock', () => {
  it('picks up where it was left when reopened days later', () => {
    const made = new Date('2026-10-10T08:00:00.000Z');
    const db = createSeedDb(made);
    const now = made.getTime() + 3 * 86_400_000;
    const later = bringToNow(db, now);

    const before = timestamps(db);
    const after = timestamps(later);
    assert.equal(after.length, before.length);
    assert.equal(Math.max(...after), now, 'the last thing that happened happened just now');
    const shift = after[0]! - before[0]!;
    assert.ok(after.every((t, i) => t - before[i]! === shift), 'everything keeps its place relative to the rest');

    const shown = (d: DemoDb, at: number) => d.technicians.map((t) => effectiveAvailability(t, new Date(at)));
    assert.deepEqual(shown(later, now), shown(db, made.getTime()), 'every technician looks as available as when the demo was made');
    assert.ok(shown(later, now).filter((a) => a === 'available').length > 5);
  });

  it('moves on even while a technician dashboard keeps pinging', () => {
    const made = new Date('2026-10-10T08:00:00.000Z');
    const db = createSeedDb(made);
    const now = made.getTime() + 86_400_000;
    db.technicians[0]!.lastSeenAt = new Date(now - 60_000).toISOString();
    const later = bringToNow(db, now);
    assert.ok(Math.max(...timestamps(later)) <= now, 'nothing ends up in the future');
    assert.equal(Math.max(...later.events.map((e) => Date.parse(e.createdAt))), now - (Date.parse(db.createdAt) - Math.max(...db.events.map((e) => Date.parse(e.createdAt)))));
  });

  it('leaves a world that was used a few minutes ago untouched', () => {
    const db = createSeedDb(new Date());
    assert.equal(bringToNow(db), db);
  });
});
